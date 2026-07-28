# API-CONTRACT — Camada de Contratos do ALL-IN CRM (modelo SaaS multi-tenant)

> Documento de projeto de contrato de API. Gerado em **24/07/2026** a partir de `docs/ARCHITECTURE.md` (estado atual) e `docs/INFRA-SAAS.md` (modelo alvo), com mapeamento linha a linha da superfície de dados real (`src/services/*`, `src/integrations/supabase/types.ts`, `supabase/functions/*`).
>
> **Escopo:** definir a fronteira de dados que hoje não existe formalmente — endpoints/RPCs, request/response, erros, versionamento, autenticação — para o novo modelo SaaS. Não é reescrita do app: é o CONTRATO que frontend e backend seguirão.

---

## 0. Resumo executivo

Hoje o frontend fala **diretamente com o Postgres** via PostgREST/RLS, sem contrato versionado (ARCHITECTURE.md §1, §8 risco 🟡10). O "contrato" atual é o schema do banco: renomear uma coluna quebra o cliente em runtime, e RPCs `SECURITY DEFINER` proliferam recebendo `p_company_id` **do próprio cliente** (`src/services/api.ts:163-173`). As 16 edge functions são pontes de integração com envelopes de resposta inconsistentes (`{error}` com 4xx numa, `{ok:false,error}` com **HTTP 200** na outra — `supabase/functions/send-whatsapp/index.ts:61-168`).

Este documento define a **API v1**: uma camada de contrato híbrida em três planos (dados, operações, servidor), com envelope de erro único, versionamento explícito, idempotência no envio de mensagens e tenant **sempre vindo do JWT** — nunca do cliente.

**Números:** 97 operações mapeadas em 15 domínios (§3), 6 contratos assíncronos (§4), 11 RPCs `SECURITY DEFINER` absorvidas num catálogo fechado (§6.2), 5 fases de migração alinhadas ao roadmap do INFRA-SAAS §10 (§7).

---

## 1. Decisão de estilo de API

### 1.1 As quatro opções avaliadas

| Critério | (a) PostgREST direto + convenções | (b) RPCs versionadas `api_v1.*` | (c) Edge Functions como REST de negócio | **(d) Híbrido** |
|---|---|---|---|---|
| Custo de migração | **Menor** — só convenção | Médio — reescrever queries com embeds | **Altíssimo** — reescrever 27 páginas + 30 hooks | Médio — incremental por domínio |
| Força do contrato | Fraca — schema é o contrato | **Forte** — catálogo fechado | Forte — código é o contrato | Forte onde importa |
| Autorização | RLS nativa (madura: ~180 policies, ARCHITECTURE.md §5.3) | Manual em cada RPC (`SECURITY DEFINER`) | Manual com service role (**risco**: bypass de RLS por endpoint) | RLS no plano de dados; validação explícita nos demais |
| Perde embeds PostgREST (`select('*,contact:contacts(...)')`, usado em `api.ts:186-189,358-360`)? | Não | **Sim** — reescrever como JSON nas RPCs | Sim | Não |
| Cobre envio WhatsApp / billing / webhooks? | Não — não é o papel do PostgREST | Parcial | Sim | Sim (plano servidor) |
| Fit com INFRA-SAAS §3 | Parcial | Parcial | Ruim (edges viram API geral, contrariando o desenho) | **É exatamente o desenho do §3** |

### 1.2 Decisão: **(d) Híbrido em três planos**

```
┌─────────────────────────────────────────────────────────────────────┐
│ PLANO DE DADOS (CRUD tenant-scoped)                                 │
│   PostgREST sobre `public` + RLS (tenant via JWT — INFRA-SAAS §4)   │
│   Regra de evolução: ADDITIVE-ONLY (nunca renomear/remover coluna   │
│   sem ciclo de deprecação) + tipos gerados em CI + client tipado    │
├─────────────────────────────────────────────────────────────────────┤
│ PLANO DE OPERAÇÕES (queries complexas / agregações / ações)         │
│   Schema `api_v1` EXPOSTO no PostgREST: RPCs versionadas + views    │
│   redigidas. Catálogo FECHADO — absorve as SECURITY DEFINER atuais  │
├─────────────────────────────────────────────────────────────────────┤
│ PLANO DE SERVIDOR (decisões de segurança/dinheiro/entrega)          │
│   Edge Functions REST `/functions/v1/*`: envio de mensagem (fila),  │
│   billing, provisionamento, webhooks, workers. As ÚNICAS edges de   │
│   "negócio" permitidas (INFRA-SAAS §3: "tudo que é decisão de       │
│   segurança, dinheiro ou entrega acontece server-side")             │
└─────────────────────────────────────────────────────────────────────┘
```

**Justificativa (3 linhas):** o ativo mais maduro do projeto é o modelo pool RLS + PostgREST (INFRA-SAAS §2.2) e o frontend depende de embeds/filtros do PostgREST em ~100 call sites — migrar tudo para REST em edges (c) é big-bang proibido pelo princípio de fases reversíveis (INFRA-SAAS §10); PostgREST puro (a) não cobre envio confiável, billing e webhooks, que o INFRA-SAAS §6/§5 já alocam para filas e edges; o híbrido (d) formaliza o contrato onde o risco vive (operações e servidor) sem tocar no que funciona (CRUD com RLS), e o OpenAPI em `docs/api/openapi-v1.yaml` documenta a API lógica única independente do plano que a implementa.

**Consequência prática:** "a API" é uma só do ponto de vista do consumidor. O OpenAPI documenta paths REST lógicos; a coluna "Implementação" de cada operação no §3 diz se ela é PostgREST direto, RPC `api_v1.*` ou edge `/functions/v1/*`. O cliente TS (`§5`) esconde essa diferença.

---

## 2. Convenções de contrato

### 2.1 Versionamento e deprecação

- **Versão na URL das edges** (`/functions/v1/...`) e **no schema das RPCs** (`api_v1.*`). Plano de dados PostgREST herda a versão do contrato TS gerado.
- **Mudanças additive-only na v1:** novo campo opcional, novo endpoint, novo valor de enum **no final** = permitido sem version bump. Renomear/remover/estreitar tipo = **v2** do endpoint/RPC, convivendo com a v1.
- **Deprecação:** header `Deprecation: true` + `Sunset: <data RFC 8594>` (mínimo **90 dias**) na resposta da versão antiga; changelog em `docs/api/CHANGELOG.md`; remoção só após o sunset.
- **Versão de contrato no bootstrap:** `GET /v1/tenancy/current` retorna `contract_version` e `min_supported_client` — o frontend compara com seu `CACHE_VERSION` (mecanismo já existente em `AuthContext.tsx:9-19`, referenciado pelo INFRA-SAAS Fase 2) e força reload quando incompatível.

### 2.2 Envelope de resposta

**Plano de dados (PostgREST):** envelope nativo do PostgREST (array/objeto direto, `content-range` para contagens). O client tipado (§5) normaliza internamente — o consumidor nunca vê o formato bruto.

**Plano de operações (RPCs) e servidor (edges):** envelope único obrigatório:

```jsonc
// Sucesso — HTTP 2xx
{ "data": { /* payload */ }, "meta": { "request_id": "uuid", "contract_version": "1.4.0" } }

// Falha — HTTP 4xx/5xx
{ "error": { "code": "VALIDATION_ERROR", "message": "Telefone inválido para E.164.",
             "details": { "field": "phone" }, "request_id": "uuid" } }
```

Isso elimina a inconsistência atual: hoje `send-whatsapp` retorna `{ok:false, error}` com **HTTP 200** (`send-whatsapp/index.ts:61-168`), `{delivered:false, reason}` com 200 (`:597`), `{error}` com 400/404/422 (`:177,190,203`), enquanto `execute-campaign` usa `{ok:true, skipped}` e `{error}` 404 (`execute-campaign/index.ts:39-67`). Na v1, **HTTP status carrega a classe do resultado; `error.code` carrega a semântica**; `ok:false` com 200 é proibido.

### 2.3 Códigos de erro padronizados

Mapeamento dos códigos Postgres/PostgREST já tratados em `ApiError` (`src/services/api.ts:44-66`) para os códigos do contrato:

| Origem (atual) | HTTP | `error.code` v1 | Quando |
|---|---|---|---|
| — | 401 | `UNAUTHORIZED` | JWT ausente/expirado; `is_active=false` (hook INFRA-SAAS §4.1) |
| `42501` (RLS) | 403 | `FORBIDDEN` | RLS negou; role insuficiente; permissão granular ausente |
| `PGRST116` | 404 | `NOT_FOUND` | Recurso inexistente **ou invisível pelo tenant** (não vazar existência cross-tenant) |
| `23505` | 409 | `CONFLICT` | Unique violation (ex.: contato duplicado; idempotency replay retorna 200, não 409 — ver §2.5) |
| `23503` | 422 | `INVALID_REFERENCE` | FK inválida (ex.: `contact_id` inexistente) |
| check constraint / validação de input | 422 | `VALIDATION_ERROR` | Payload malformado; telefone não-E.164 (hoje 422 sem código em `send-whatsapp/index.ts:228-230`) |
| cota do plano estourada | 402 | `QUOTA_EXCEEDED` | Mensagens/mês acima da faixa (INFRA-SAAS §5.3 ponto 3 — mensagem fica `quota_exceeded`) |
| limite do plano (seats, números) | 402 | `PLAN_LIMIT_REACHED` | Convite acima de seats; `INSERT` em `integrations` acima do limite (INFRA-SAAS §5.3 pontos 1-2) |
| feature não contratada | 403 | `FEATURE_NOT_AVAILABLE` | `tenant_features` sem a `feature_key` (ex.: `chatbot` no plano Starter) |
| — | 409 | `IDEMPOTENCY_CONFLICT` | Mesma `Idempotency-Key` com payload **diferente** |
| — | 429 | `RATE_LIMITED` | Rate limit por tenant (envio, campanhas — hoje `send_rate_log`) |
| Evolution API 4xx/5xx/timeout | 502 | `UPSTREAM_PROVIDER_ERROR` | Falha na Evolution/Cloud API (hoje vaza texto bruto: `send-whatsapp/index.ts:109`) |
| Stripe/Evolution fora (grace) | 503 | `SERVICE_UNAVAILABLE` | Dependência indisponível sem fallback |
| demais | 500 | `INTERNAL` | Não mapeado; `request_id` obrigatório p/ correlação nos logs (INFRA-SAAS §8.2) |

`message` sempre em **pt-BR** (vira toast direto, como hoje `friendlyMessages` em `api.ts:44-49`); `code` sempre em inglês UPPER_SNAKE (máquina).

### 2.4 Paginação, filtros e ordenação

- **Cursor (padrão para fluxos de alta frequência):** `GET /v1/conversations`, `GET .../messages`. Parâmetros `limit` (default 20, máx 100) + `cursor` opaco (base64 de `[sort_value, id]`). Resposta: `data[]` + `meta.page: { next_cursor, has_more }`. Motivo: listas ordenadas por `last_message_at`/`created_at` mudam sob o leitor via Realtime (ARCHITECTURE.md §4.3) — offset pagina errado quando uma nova mensagem chega (hoje o código compensa com lista infinita + refetch, `useConversations.ts`).
- **Offset (mantido por compatibilidade em listas administrativas):** `GET /v1/contacts`, `/v1/tenancy/members`, `/v1/nps/surveys`, `/v1/admin/audit-log`. Parâmetros `page` (0-based, como hoje em `api.ts:157-160,474-477`) + `limit`; resposta `meta.page: { page, total, total_pages }` — mesmo shape de `PaginatedResult` (`api.ts:147-152`).
- **Filtros:** query params com o nome da coluna (`status`, `channel`, `integration_id`, `project_id`, `assigned_user_id`, `tag_id`, `q` para busca). **Sentinels mágicos proibidos:** o `'__none__'` atual (`api.ts:199-202,261`) vira `assigned_user_id=null` (string `"null"` explícita) ou param booleano dedicado (`unassigned=true`). Busca textual: `q` único (server-side decide onde buscar — elimina os 4 roundtrips de `api.ts:279-335`, ver RPC `list_conversations` no §3.2).
- **Ordenação:** `sort=recent|oldest|name` (mesmos valores atuais, `api.ts:134`), documentado que `name` ordena por `contact.name` **server-side** na RPC (hoje é client-side, `api.ts:341-343`).
- **Seleção de campos:** o plano de dados mantém o `select` do PostgREST no client tipado; RPCs e edges retornam o shape documentado completo (sem seleção parcial).

### 2.5 Idempotência

- **Obrigatória:** `POST /v1/conversations/{id}/messages` (envio!), `POST /v1/tenancy/signup`, `POST /v1/billing/checkout-session`, `POST /v1/campaigns/{id}:execute`, `POST /v1/integrations` (criar número). Header `Idempotency-Key: <uuid>` gerado no cliente **no momento da intenção** (não no retry).
- **Implementação:** coluna `messages.client_request_id uuid` com `unique (company_id, client_request_id)`. Replay com mesma key + mesmo payload → **200 com o recurso existente**; mesma key + payload diferente → **409 `IDEMPOTENCY_CONFLICT`**. Na fila (§4.1) a key viaja no payload e o worker faz dedup por `message_id` antes de chamar a Evolution (INFRA-SAAS Fase 1 — mitigação de dupla entrega na transição).
- **Inbound (webhook Evolution):** dedup por `messages.external_message_id` com `unique` + `ON CONFLICT DO NOTHING` — já previsto no INFRA-SAAS §6.2; hoje não há garantia documentada e a edge gera fallback `evo_${Date.now()}` (`incoming-message/index.ts:182`) que **derrota dedup** — na v1 o fallback é rejeitado com 422 e log (Evolution retransmite com o mesmo `key.id`, que é estável).

### 2.6 Timestamps, IDs e nomenclatura

- **Timestamps:** sempre ISO 8601 UTC (`timestamptz`), como hoje (`created_at` etc. em `types.ts`). Filtros de data aceitam `date` (`YYYY-MM-DD`, interpretado no fuso do tenant) ou `timestamptz` completo — documentado por parâmetro.
- **IDs:** UUID v4. IDs de recursos **nunca** expõem sequênciais. `external_message_id` é opaco (string do provedor).
- **Idioma do contrato:** campos, paths e códigos em **inglês snake_case**; `message` de erro e conteúdo de negócio (nomes de tags, etapas) em pt-BR. **Valores de enum existentes permanecem congelados como estão no banco** — `deal_stage` (`novo_lead…perdido`), `task_status` (`pendente…`), `task_priority` (`alta…`) são pt-BR (`types.ts:1807-1816`) e mudá-los seria breaking em dados + código: a v1 os trata como **strings opacas congeladas**, e enums **novos** nascem em inglês. Decisão registrada aqui para não ser reaberta.
- **Tenant:** ausente de todos os payloads e paths (§6.1) — vem do JWT.

---

## 3. Mapa de domínios → endpoints

Legenda: **Impl** = plano de implementação (`postgrest` = CRUD direto com RLS via client tipado; `rpc` = função em schema `api_v1`; `edge` = `/functions/v1/*`). **AuthZ** = papel mínimo + observações (todas exigem JWT com `tenant_id`; granularidade extra via `custom_permissions`, hoje consultada por `usePermissions().can(key)` — ARCHITECTURE.md §5.3). **Origem atual** = evidência arquivo:linha.

### 3.1 auth/tenancy — 8 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Cadastro self-service | `POST /v1/tenancy/signup` | edge `provision-tenant` | público (CAPTCHA) | sync (tenant atômico) + async (Stripe) | `register-company/index.ts:23`; INFRA-SAAS §7 |
| 2 | Bootstrap da sessão | `GET /v1/tenancy/current` | rpc `api_v1.get_current_context` | membro | sync | `AuthContext.tsx` (§5.2 ARCH); `api.ts:104-117` |
| 3 | Convidar membro | `POST /v1/tenancy/invites` | edge `invite-member` | admin | sync (valida seat) | `invite-user/index.ts:76`; INFRA-SAAS §4.3 |
| 4 | Listar membros | `GET /v1/tenancy/members` | postgrest `profiles`+`user_roles` | supervisor+ | sync (offset) | `api.ts:657-669` |
| 5 | Atualizar membro | `PATCH /v1/tenancy/members/{user_id}` | rpc `api_v1.update_member` | admin | sync | `profiles.custom_permissions`/`allowed_integration_ids` (`types.ts:1322-1323`) |
| 6 | Remover membro | `DELETE /v1/tenancy/members/{user_id}` | edge `delete-user` (renomear) | admin | sync (soft: `is_active=false`) | `delete-user/index.ts:75` |
| 7 | Entitlements do plano | `GET /v1/tenancy/entitlements` | postgrest view `tenant_features` | membro | sync | INFRA-SAAS §5.2 (nova) |
| 8 | Configurar SSO SAML | `POST /v1/tenancy/sso` | edge (admin API Supabase) | admin + plano Enterprise | async | INFRA-SAAS §4.4 (nova) |

**Schemas-chave:**

```jsonc
// POST /v1/tenancy/signup — request (origem: register-company/index.ts:23)
{ "company_name": "Clínica X", "user_name": "Ana", "email": "ana@x.com",
  "password": "•••", "segment": "clinica" }              // segment: novo p/ seed (INFRA-SAAS §7)
// 201 — { "data": { "tenant_id": "uuid", "user_id": "uuid", "trial_ends_at": "…Z" } }
// Erros: 409 CONFLICT (email), 422 VALIDATION_ERROR, 429 RATE_LIMITED (CAPTCHA falho)

// GET /v1/tenancy/current — 200 (resolve o bootstrap frágil do AuthContext, ARCH §5.2)
{ "data": { "user": { "id": "uuid", "name": "Ana", "email": "…", "role": "admin",
                      "custom_permissions": { "campaigns_create": true } },
            "tenant": { "id": "uuid", "name": "Clínica X", "plan": "pro", "trial_ends_at": null },
            "entitlements": ["chatbot", "campaigns"],
            "contract_version": "1.0.0", "min_supported_client": "1.0.0" } }

// POST /v1/tenancy/invites — request (origem: invite-user/index.ts:76)
{ "name": "João", "email": "joao@x.com", "role": "agent", "allowed_integration_ids": ["uuid"] }
// 201 { "data": { "user_id": "uuid", "invited_at": "…Z" } }
// Erros: 402 PLAN_LIMIT_REACHED (seats), 409 CONFLICT (email já membro), 403 FORBIDDEN
```

> **Eliminadas na v1:** edge `ensure-user-role` (self-healing de role que mascara falha de bootstrap — INFRA-SAAS §4.3) e o fallback de role via `user_metadata` (vulnerabilidade de privilege escalation — INFRA-SAAS §4.1; hoje em `AuthContext.tsx`).

### 3.2 inbox/conversations — 13 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar conversas (filtros unificados) | `GET /v1/conversations` | **rpc** `api_v1.list_conversations` | membro (agent: escopo projeto/atribuídas) | sync (cursor) | `api.ts:154-346` |
| 2 | Detalhe da conversa | `GET /v1/conversations/{id}` | rpc `api_v1.get_conversation` | membro no escopo | sync | `api.ts:348-402` |
| 3 | Atualizar conversa | `PATCH /v1/conversations/{id}` | postgrest | membro no escopo | sync | `api.ts:447-448` (auto-move/auto-assign) |
| 4 | Fechar conversa | `POST /v1/conversations/{id}:close` | postgrest (ou rpc c/ evento) | membro no escopo | sync | `api.ts:771-784` |
| 5 | Arquivar/desarquivar | `POST /v1/conversations/{id}:archive` `{archived: bool}` | postgrest | membro no escopo | sync | `api.ts:253-258` |
| 6 | Marcar lida | `POST /v1/conversations/{id}/read` | postgrest upsert | membro | sync | `api.ts:686-716` |
| 7 | Marcar não-lida | `DELETE /v1/conversations/{id}/read` | postgrest delete | membro | sync | `api.ts:828-838` |
| 8 | Contadores de não-lidas | `GET /v1/conversations/unread-counts` | **rpc** `api_v1.get_unread_counts` | membro | sync | `api.ts:718-767` |
| 9 | Badge da sidebar | `GET /v1/conversations/sidebar-stats` | **rpc** `api_v1.get_sidebar_stats` | membro | sync | RPC `get_sidebar_unread_count` (`types.ts:1772-1779`) |
| 10 | Listar anotações | `GET /v1/conversations/{id}/annotations` | postgrest | membro no escopo | sync | `api.ts:807-816` |
| 11 | Criar anotação | `POST /v1/conversations/{id}/annotations` | postgrest | membro no escopo | sync | `api.ts:856-871` |
| 12 | Editar anotação | `PATCH /v1/annotations/{id}` | postgrest | autor ou admin | sync | `api.ts:840-846` |
| 13 | Excluir anotação | `DELETE /v1/annotations/{id}` | postgrest | autor ou admin | sync | `api.ts:848-854` |

**A RPC central — `api_v1.list_conversations`:** absorve em **1 roundtrip** o que hoje são até 4 (tag → `contact_tags` → `contacts` → `messages`, `api.ts:279-335`), mais as chamadas RPC separadas de unread (`api.ts:163-173`) e funil (`api.ts:268-276`):

```sql
-- assinatura do contrato (implementação interna livre; tenant vem do JWT, NUNCA de argumento)
api_v1.list_conversations(
  p_limit int default 20, p_cursor text default null,
  p_status text[] default null, p_channel text default null,
  p_assigned_user_id uuid default null, p_unassigned boolean default false,
  p_integration_id uuid default null, p_project_id uuid default null,
  p_tag_ids uuid[] default null, p_funnel_id uuid default null, p_stage_id uuid default null,
  p_q text default null,              -- busca única: contato (nome/phone/email) OU corpo de mensagem
  p_has_unread boolean default false,
  p_archived boolean default false,
  p_sort text default 'recent'        -- recent | oldest | name
) returns table ( /* colunas do shape ConversationSummary abaixo */, next_cursor text )
```

```jsonc
// ConversationSummary (derivado do select real em api.ts:186-189)
{ "id": "uuid", "status": "open|pending|closed|new|resolved", "channel": "whatsapp|instagram|webchat",
  "last_message_at": "…Z", "last_message_preview": "…", "contact_id": "uuid",
  "assigned_user_id": "uuid|null", "department_id": "uuid|null", "project_id": "uuid|null",
  "integration_id": "uuid|null", "chatbot_active": true, "archived_at": null,
  "created_at": "…Z", "updated_at": "…Z",
  "contact": { "id": "uuid", "name": "…", "phone": "…", "phone_e164": "…", "email": null,
               "tags": [ { "name": "VIP", "color": "#f00" } ], "is_group": false,
               "source": "…", "avatar_url": null },
  "assigned_user": { "id": "uuid", "name": "…", "display_name": "…" } | null,
  "unread_count": 3 }                  // agregado na RPC (hoje: RPC separada, api.ts:728)
```

Erros: 403 `FORBIDDEN` (fora de escopo), 422 `VALIDATION_ERROR` (cursor inválido), 404 `NOT_FOUND` (detalhe fora do tenant). **Segurança:** a RPC é `SECURITY DEFINER` do catálogo fechado (§6.2) e valida `company_id = private.current_tenant_id()` internamente — elimina o anti-padrão atual em que o **cliente envia `p_company_id`/`p_user_id`** para `get_unread_conversation_ids` (`api.ts:164-173`) e `get_sidebar_unread_count` (`types.ts:1772-1779`): qualquer usuário autenticado pode hoje consultar IDs de conversas de **outro tenant** se a validação interna faltar. Na v1, tenant como argumento é **proibido** (§6.1).

### 3.3 messages — 9 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar mensagens | `GET /v1/conversations/{id}/messages` | postgrest (cursor) | membro no escopo | sync | `api.ts:363-369` (limite 300) |
| 2 | **Enviar mensagem** | `POST /v1/conversations/{id}/messages` | **edge** `enqueue-outbound` | membro no escopo | **async (fila)** | `api.ts:404-455` + `api.ts:69-101` |
| 3 | Editar mensagem | `PATCH /v1/messages/{id}` | edge → fila | autor ou admin | async (best-effort remoto) | `send-whatsapp/index.ts:58-116` |
| 4 | Excluir mensagem | `DELETE /v1/messages/{id}?scope=local\|everyone` | edge → fila | autor ou admin | async | `api.ts:819-825`; `send-whatsapp/index.ts:119-168` |
| 5 | Reagir | `POST /v1/messages/{id}/reactions` `{emoji}` | postgrest upsert | membro | sync | tabela `message_reactions` (`types.ts:1157-1191`) |
| 6 | Remover reação | `DELETE /v1/messages/{id}/reactions/{reaction_id}` | postgrest | autor da reação | sync | idem |
| 7 | Listar agendadas | `GET /v1/conversations/{id}/scheduled-messages` | postgrest | membro no escopo | sync | tabela `scheduled_messages` (`types.ts:1519`) |
| 8 | Agendar mensagem | `POST /v1/conversations/{id}/scheduled-messages` | postgrest insert | membro no escopo | sync (disparo async via cron) | edge `process-scheduled-messages` (ARCH §4.5) |
| 9 | Cancelar agendada | `DELETE /v1/scheduled-messages/{id}` | postgrest (set `cancelled_at`) | autor ou admin | sync | `scheduled_messages.cancelled_at` |

**O contrato mais importante da v1 — envio (elimina o risco 🔴2 do ARCHITECTURE.md §8):**

```jsonc
// POST /v1/conversations/{id}/messages
// Headers: Authorization: Bearer <jwt>, Idempotency-Key: <uuid>
{ "body": "Olá!", "media_url": null, "reply_to_id": null, "client_request_id": "uuid" }

// 202 Accepted — o browser NÃO envia mais WhatsApp (hoje: sendViaWhatsApp best-effort, api.ts:69-101;
// se a aba fecha, a mensagem se perde — ARCH §4.2/§8 risco 2)
{ "data": { "id": "uuid", "conversation_id": "uuid", "delivery_status": "queued",
            "client_request_id": "uuid", "created_at": "…Z" },
  "meta": { "request_id": "uuid" } }

// Erros: 402 QUOTA_EXCEEDED (cota do mês; mensagem fica registrada com delivery_status='quota_exceeded'
//       — inbound NUNCA é bloqueado, INFRA-SAAS §5.3), 403 FORBIDDEN, 404 NOT_FOUND,
//       409 IDEMPOTENCY_CONFLICT, 422 VALIDATION_ERROR (contato LID sem telefone — hoje 422 em
//       send-whatsapp/index.ts:196-205)
```

**Transição de status (máquina de estados do contrato):** `queued → sent → delivered | failed` (+ `quota_exceeded` terminal). Atualizada **pelo worker** (§4.1) e propagada por Realtime — o optimistic update do React Query (melhor padrão do codebase, ARCH §4.2) **não muda**: hoje o cliente já grava e depois corrige `delivery_status`/`external_message_id` (`api.ts:69-101` faz isso à mão; na v1 quem corrige é o worker). Edição/exclusão remota dependem de `external_message_id` presente — sem ele, 422 com mensagem clara (comportamento já existente em `send-whatsapp/index.ts:70-73,125-128`, agora formalizado).

### 3.4 contacts — 10 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar contatos | `GET /v1/contacts` | postgrest (offset) | membro (agent: escopo) | sync | `api.ts:471-557` |
| 2 | Criar contato | `POST /v1/contacts` | postgrest | membro (`contacts_create`) | sync | `api.ts:608-620` |
| 3 | Detalhe | `GET /v1/contacts/{id}` | postgrest | membro | sync | padrão do Inbox/ContactProfilePanel |
| 4 | Atualizar | `PATCH /v1/contacts/{id}` | postgrest | membro | sync | `api.ts:622-635` |
| 5 | Excluir | `DELETE /v1/contacts/{id}` | **rpc** `api_v1.delete_contact` | admin/supervisor | sync (fecha conversas ativas antes) | `api.ts:637-654` |
| 6 | Exportar CSV | `GET /v1/contacts:export` | rpc ou edge | supervisor+ (`reports_export`) | sync até 10k; async acima | `api.ts:560-606` |
| 7 | Definir tags | `PUT /v1/contacts/{id}/tags` `{tag_ids: []}` | rpc `api_v1.set_contact_tags` | membro | sync (substitui leitura dupla JSONB×normalizado, `api.ts:481,530-543`) | `contact_tags` (`types.ts:514`) |
| 8 | Ler campos custom | `GET /v1/contacts/{id}/custom-fields` | postgrest | membro | sync | `custom_field_*` (`types.ts:811-882`) |
| 9 | Gravar campos custom | `PUT /v1/contacts/{id}/custom-fields` | postgrest upsert | membro | sync | idem |
| 10 | Definir responsáveis | `PUT /v1/contacts/{id}/assignees` `{user_ids: []}` | postgrest replace | supervisor+ | sync | `contact_assignees` (`types.ts:436-463`) |

Request/response derivados do select real (`api.ts:481`): `{id, name, phone, phone_e164, email, source, responsible_user_id, company_id(nunca exposto p/ escrita), is_group, created_at, last_contact_at, responsible:{id,name}, tags:[{id,name,color}]}`. Erros: 409 `CONFLICT` (telefone duplicado no tenant — `23505`), 422 `INVALID_REFERENCE` (responsável inexistente). **`tags` JSONB legado (`contacts.tags`, ARCH §6 inconsistência 4):** marcado `deprecated` no contrato; leitura servida pelo lado normalizado; remoção na v2.

### 3.5 tags — 4 operações

| # | Operação | Método + path | Impl | AuthZ | Origem atual |
|---|---|---|---|---|---|
| 1 | Listar | `GET /v1/tags` | postgrest | membro (`tags_view`) | tabela `tags` (`types.ts:1569-1606`) |
| 2 | Criar | `POST /v1/tags` | postgrest | `tags_create` | idem |
| 3 | Atualizar | `PATCH /v1/tags/{id}` | postgrest | `tags_edit` | idem |
| 4 | Excluir | `DELETE /v1/tags/{id}` | postgrest | `tags_delete` (desvincula em cascade) | idem |

Shape: `{id, name, color, department_id, project_id, created_at}`. Erros: 409 `CONFLICT` (nome duplicado no escopo).

### 3.6 pipeline/deals — 10 operações

> **Decisão de contrato sobre a duplicidade de funis** (ARCH §3/§8 risco 5 — `funnels/contact_funnel_stages` × `pipelines/stages/deals`): a v1 expõe **deals como modelo canônico** e marca os endpoints de `funnels` como `deprecated` desde o dia 1, com sunset atrelado à consolidação de dados (decisão de produto pendente, ARCH §7 item 6). O contrato não carrega os dois modelos para sempre.

| # | Operação | Método + path | Impl | AuthZ | Origem atual |
|---|---|---|---|---|---|
| 1 | Listar deals | `GET /v1/deals?pipeline_id=` | postgrest | membro | `deals.ts:45-58` |
| 2 | Criar deal | `POST /v1/deals` | postgrest | membro | `deals.ts:60-69` |
| 3 | Detalhe do deal | `GET /v1/deals/{id}` | postgrest | membro | — |
| 4 | Atualizar deal | `PATCH /v1/deals/{id}` (inclui `stage`) | postgrest | membro | `deals.ts:71-81` |
| 5 | Excluir deal | `DELETE /v1/deals/{id}` | postgrest | supervisor+ | `deals.ts:83-86` |
| 6 | Listar pipelines c/ etapas | `GET /v1/pipelines` | postgrest | membro | `pipelines`/`stages` (ARCH §5.1) |
| 7 | Criar pipeline | `POST /v1/pipelines` | postgrest | admin/supervisor | idem |
| 8 | Atualizar pipeline | `PATCH /v1/pipelines/{id}` | postgrest | admin/supervisor | idem |
| 9 | Reordenar etapas | `POST /v1/pipelines/{id}/stages:reorder` | **rpc** `api_v1.reorder_stages` | admin/supervisor | absorve `swap_funnel_stage_positions` (`types.ts:1724-1732`) |
| 10 | **[deprecated]** Funis legados | `GET /v1/funnels` (+ stages, contact stages) | postgrest | membro | `funnels`/`funnel_stages`/`contact_funnel_stages`; `FunnelContext.tsx:46-99` |

Shape do Deal (de `deals.ts:5-18` + `types.ts:883-946`): `{id, title, contact_id, value, stage: "novo_lead|em_contato|proposta|fechamento|ganho|perdido", probability, assigned_user_id, department_id, notes, created_at, updated_at, contact:{id,name}, assigned_user:{id,name}}`. **Breaking corrigido na v1:** `listDeals(companyId)` e `listTasks(companyId)` recebem o tenant **do cliente** hoje (`deals.ts:45`, `tasks.ts:43`) — na v1 o parâmetro some (JWT). RLS hoje protege a leitura, mas o contrato não deve nem aceitar o argumento.

### 3.7 chatbot — 5 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar fluxos (com nós) | `GET /v1/chatbot/flows` | postgrest | membro (`chatbot_view`) | sync | `chatbot_flows`+`chatbot_nodes` (`types.ts:317-411`) |
| 2 | Criar fluxo | `POST /v1/chatbot/flows` | postgrest | `chatbot_create` + feature `chatbot` | sync | idem |
| 3 | Atualizar fluxo | `PATCH /v1/chatbot/flows/{id}` | postgrest | `chatbot_edit` | sync | idem |
| 4 | Excluir fluxo | `DELETE /v1/chatbot/flows/{id}` | postgrest | `chatbot_delete` | sync | idem |
| 5 | Simular fluxo/IA | `POST /v1/chatbot/flows:simulate` | **edge** `chatbot-process` (modo teste) | `chatbot_edit` | sync (chama LLM) | `chatbot-process/index.ts:83-92` (`test_ai`) |

Request do #5 (preserva o contrato real): `{ "flow_id": "uuid|null", "ai_instructions": "…", "ai_context": "…", "user_message": "…" }` → `200 { "data": { "ai_response": "…", "trace": [ /* nós percorridos */ ] } }`. Erros: 403 `FEATURE_NOT_AVAILABLE` (plano sem `chatbot`), 502 `UPSTREAM_PROVIDER_ERROR` (LLM). **O caminho de runtime do bot** (`incoming-message` → `chatbot-process` com `{conversation_id, message_body, company_id, contact_id, flow_id}` — `incoming-message/index.ts:1729-1739`) é **interno service-to-service**, não faz parte do contrato de cliente: vira fila/evento interno (§4.4) com auth service-role.

### 3.8 campaigns — 5 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar campanhas | `GET /v1/campaigns` | postgrest | `campaigns_view` | sync | `campaigns` (`types.ts:252-316`) |
| 2 | Criar campanha | `POST /v1/campaigns` | postgrest | `campaigns_create` + feature `campaigns` | sync | idem |
| 3 | Detalhe/progresso | `GET /v1/campaigns/{id}` | postgrest | `campaigns_view` | sync | `processed`/`total_contacts` |
| 4 | Pausar/retomar/cancelar | `PATCH /v1/campaigns/{id}` `{status}` | postgrest | `campaigns_edit` | sync | status machine hoje na edge |
| 5 | Executar agora | `POST /v1/campaigns/{id}:execute` | **edge** → fila `campaign_dispatch` | `campaigns_execute` | **async** | `execute-campaign/index.ts:26-54` |

Shape (real): `{id, name, description, action_type, action_config, filters, send_window:{start,end}, skip_weekends, schedule_at, deadline_at, status: draft|scheduled|running|paused|completed|canceled, total_contacts, processed, created_at, updated_at}`. Resposta do #5: `202 { "data": { "campaign_id": "uuid", "queued_contacts": 1234 } }` (substitui `{ok:true, triggered}` de `execute-campaign/index.ts:39-53`). Erros: 402 `PLAN_LIMIT_REACHED` (campanhas ativas), 409 `CONFLICT` (já `completed` — hoje `skipped:already_completed` com 200, `:72-75`), 429 `RATE_LIMITED` (rate limit por tenant — hoje `send_rate_log`, ARCH §3). O dispatcher "sem `campaign_id` = varre agendadas" (`:30-54`) é **interno** (pg_cron, ARCH §4.5) e sai do contrato público.

### 3.9 reports — 4 operações

| # | Operação | Método + path | Impl | AuthZ | Origem atual |
|---|---|---|---|---|---|
| 1 | Listar relatórios salvos | `GET /v1/reports` | postgrest | `reports_view` | `saved_reports` (`types.ts:1483-1518`) |
| 2 | Salvar relatório | `POST /v1/reports` | postgrest | `reports_create` | idem |
| 3 | Excluir relatório | `DELETE /v1/reports/{id}` | postgrest | dono ou admin | idem |
| 4 | Métricas de agentes | `GET /v1/reports/agent-metrics?date_from=&date_to=` | **rpc** `api_v1.get_agent_metrics` | supervisor+ (`reports_view`) | RPC atual (`types.ts:1705-1715`) |

Response #4 (preserva shape real): `[{ agent_id, agent_name, avg_first_response_seconds, avg_resolution_seconds, avg_nps, conversations_handled }]`. Absorvida no catálogo com validação de tenant interna (hoje `SECURITY DEFINER` sem tenant no args — o tenant é inferido; na v1 é assertido).

### 3.10 nps — 3 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar pesquisas | `GET /v1/nps/surveys` (offset, filtros data/score) | postgrest | `nps_view` | sync | `satisfaction_surveys` (`types.ts:1415-1482`) |
| 2 | Estatísticas | `GET /v1/nps/stats?date_from=&date_to=` | rpc `api_v1.get_nps_stats` | `nps_view` | sync | página `NPS.tsx` (ARCH §3) |
| 3 | Enviar pesquisa manual | `POST /v1/nps/surveys:send` `{conversation_id}` | **edge** `send-satisfaction-survey` | supervisor+ | **async** (fila) | `send-satisfaction-survey/index.ts:43` |

Fluxo NPS ponta a ponta (conversa `resolved` → nó NPS do bot → envio → resposta — ARCH §3 "Fluxo NPS") permanece **server-side**; o contrato de cliente é só leitura + disparo manual.

### 3.11 integrations (números WhatsApp) — 7 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Listar integrações | `GET /v1/integrations` | postgrest **view redigida** `api_v1.integrations` | membro | sync | `integrations` (`types.ts:1107-1156`) |
| 2 | Criar (nova instância) | `POST /v1/integrations` | **edge** `integrations-manager` | admin + limite de plano | async (provisiona na Evolution) | `evolution-api/index.ts:61+` (`create-instance`) |
| 3 | Detalhe | `GET /v1/integrations/{id}` | view redigida | membro | sync | — |
| 4 | Atualizar (não-secreto) | `PATCH /v1/integrations/{id}` | postgrest (colunas allowlist) | admin | sync | `device_name`, `restrict_users`, `project_id` |
| 5 | Excluir | `DELETE /v1/integrations/{id}` | edge (desprovisiona) | admin | async | — |
| 6 | Obter QR / reconectar | `POST /v1/integrations/{id}/qrcode` | edge `integrations-manager` | admin | sync (chama Evolution) | `evolution-api/index.ts` (`connect`) |
| 7 | Sincronizar histórico | `POST /v1/integrations/{id}/sync-history` | edge `sync-all-history` | admin | **async** | `sync-all-history/index.ts:31` |

**Segurança central deste domínio:** `integrations.config` JSONB guarda `api_key`, `api_url`, `instance_name` da Evolution (uso real em `send-whatsapp/index.ts:89-99`). A view `api_v1.integrations` **omite `config.api_key`** e expõe apenas `{id, channel, provider, provider_type, device_name, phone_number, status, project_id, restrict_users, created_at}` (+ `provider_type: baileys|cloud_api` nova — INFRA-SAAS §3). Escrita de `config` só via edge com service role. Erros: 402 `PLAN_LIMIT_REACHED` (números), 502 `UPSTREAM_PROVIDER_ERROR` (Evolution fora — o incidente de 130 instâncias mortas do `infra-changes.md` não pode voltar como 500 genérico).

### 3.12 tasks — 5 operações

| # | Operação | Método + path | Impl | AuthZ | Origem atual |
|---|---|---|---|---|---|
| 1 | Listar | `GET /v1/tasks?contact_id=&deal_id=&status=` | postgrest | membro | `tasks.ts:43-56` |
| 2 | Criar | `POST /v1/tasks` | postgrest | membro | `tasks.ts:58-67` |
| 3 | Detalhe | `GET /v1/tasks/{id}` | postgrest | membro | — |
| 4 | Atualizar | `PATCH /v1/tasks/{id}` | postgrest | membro | `tasks.ts:69-79` |
| 5 | Excluir | `DELETE /v1/tasks/{id}` | postgrest | autor ou supervisor+ | `tasks.ts:81-84` |

Shape real (`tasks.ts:5-18`): enums pt-BR congelados `priority: alta|media|baixa`, `status: pendente|em_progresso|concluida` (§2.6). Nota de produto: a página `Tarefas.tsx` é órfã (ARCH §6 inconsistência 5) — o contrato existe de qualquer forma; rotear ou remover é decisão fora deste documento.

### 3.13 ai — 4 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Gerar anotação IA | `POST /v1/ai/annotations` | edge `ai-annotation` | membro + feature `ai_reports` | sync (LLM) | `ai-annotation/index.ts:35` |
| 2 | Assistente de resposta | `POST /v1/ai/chat-assist` | edge `ai-chat-assist` | membro + feature | sync (LLM) | `ai-chat-assist/index.ts:36` |
| 3 | Gerar relatório IA | `POST /v1/ai/reports` | edge `ai-report-gen` | supervisor+ + feature | async (relatório longo) | `ai-report-gen/index.ts:36` |
| 4 | Listar relatórios IA | `GET /v1/ai/reports` | postgrest `ai_reports` | supervisor+ | sync | `ai_reports` (`types.ts:119-151`) |

Requests preservados: #1 `{conversation_id, recent_messages[], contact_metadata}`; #2 `{conversation_id, messages[], metadata}`; #3 `{period_start, period_end, metrics}` (renomeados de camelCase para snake_case — **breaking controlado**: essas edges só são chamadas pelo frontend, migração na mesma release). Erros: 403 `FEATURE_NOT_AVAILABLE`, 429 `RATE_LIMITED` (custo de LLM por tenant), 502 `UPSTREAM_PROVIDER_ERROR`. Telefones mascarados antes de sair para o LLM (LGPD — INFRA-SAAS §8.4).

### 3.14 billing/entitlements — 6 operações

| # | Operação | Método + path | Impl | AuthZ | Sync/Async | Origem atual |
|---|---|---|---|---|---|---|
| 1 | Assinatura atual | `GET /v1/billing/subscription` | rpc/view | admin | sync | INFRA-SAAS §5.1 (novo) |
| 2 | Checkout (mudar plano) | `POST /v1/billing/checkout-session` `{price_lookup_key}` | edge (Stripe Checkout) | admin | sync (retorna URL) | INFRA-SAAS §5.1 (novo) |
| 3 | Portal do cliente | `POST /v1/billing/portal-session` | edge (Stripe Portal) | admin | sync (retorna URL) | INFRA-SAAS §5.1 (novo) |
| 4 | Uso do ciclo | `GET /v1/billing/usage` | view `usage_counters` | admin | sync | INFRA-SAAS §5.3 (novo) |
| 5 | Catálogo de planos | `GET /v1/billing/plans` | view `plan_limits` | membro | sync | INFRA-SAAS §5.1/§5.3 (novo) |
| 6 | Webhook Stripe | `POST /webhooks/stripe` | edge `stripe-webhook` | **server-to-server** (assinatura Stripe) | async interno | INFRA-SAAS §5.2 (novo) |

Responses: #1 `{ "data": { "plan": "pro", "status": "trialing|active|past_due|canceled", "trial_ends_at": "…Z", "seats": { "used": 4, "limit": 10 }, "whatsapp_numbers": { "used": 2, "limit": 3 }, "current_period_end": "…Z", "grace_until": null } }`; #4 `{ "data": { "messages_outbound": { "used": 3120, "included": 5000 }, "period": "2026-07" } }`. **Fail-open documentado:** `past_due` mantém tudo por 7 dias (`grace_until`), `canceled` revoga escrita e preserva leitura/export por 30 dias (INFRA-SAAS §5.4) — o contrato reflete isso em `subscription.status` + `entitlements`, nunca em bloqueio silencioso.

### 3.15 admin (bhub-interno + admin do tenant) — 4 operações

| # | Operação | Método + path | Impl | AuthZ | Origem atual |
|---|---|---|---|---|---|
| 1 | Audit log do tenant | `GET /v1/admin/audit-log` (offset) | postgrest `audit_log` | admin do tenant | INFRA-SAAS §8.3 (novo) |
| 2 | DLQ de envio | `GET /v1/admin/queues/dead-letter` | edge (service role lê `pgmq.a_*`) | admin | INFRA-SAAS §6.2 (novo) |
| 3 | Reprocessar DLQ | `POST /v1/admin/queues/dead-letter:requeue` `{msg_ids[]}` | edge | admin | INFRA-SAAS §6.2 (novo) |
| 4 | Exportar dados do tenant (LGPD) | `POST /v1/admin/tenants/{id}/export` | edge | admin do próprio tenant; bhub ops p/ suporte | INFRA-SAAS §5.4/§8.4 (novo) |

### 3.16 Resumo quantitativo

| Domínio | Operações | Plano principal |
|---|---|---|
| auth/tenancy | 8 | edge + rpc |
| inbox/conversations (+anotações) | 13 | rpc + postgrest |
| messages (+agendadas) | 9 | edge (async) + postgrest |
| contacts | 10 | postgrest + rpc |
| tags | 4 | postgrest |
| pipeline/deals | 10 | postgrest + rpc |
| chatbot | 5 | postgrest + edge |
| campaigns | 5 | postgrest + edge (async) |
| reports | 4 | postgrest + rpc |
| nps | 3 | postgrest + edge |
| integrations | 7 | edge + view redigida |
| tasks | 5 | postgrest |
| ai | 4 | edge |
| billing/entitlements | 6 | edge + views |
| admin | 4 | postgrest + edge |
| **Total** | **97** | |

---

## 4. Contratos de eventos assíncronos

### 4.1 Fila de envio WhatsApp — `whatsapp_outbound` (pgmq)

Produtor: database webhook (pg_net) sobre `INSERT messages WHERE direction='outbound' AND delivery_status='queued'` → edge `enqueue-outbound` (INFRA-SAAS §6.2). Consumidor: edge `worker-send-whatsapp` (trigger em cascata + sweeper pg_cron 1 min — padrão já existente, ARCH §4.5).

```jsonc
// payload pgmq.send('whatsapp_outbound', ...) — versionado pelo campo v
{ "v": 1,
  "message_id": "uuid",            // PK da mensagem — dedup natural do worker
  "tenant_id": "uuid",             // quota + roteamento de integration
  "integration_id": "uuid|null",
  "idempotency_key": "uuid",       // = messages.client_request_id
  "enqueued_at": "…Z" }
```

Semântica (preserva INFRA-SAAS §6.2): `pgmq.read(n=10, vt=30)`; sucesso → `UPDATE messages SET delivery_status='sent', external_message_id=…, sent_by='worker'` + `pgmq.delete`; falha transitória → não deleta (reaparece; `read_ct` = tentativas); `read_ct > 5` → `pgmq.archive` (DLQ `a_whatsapp_outbound`) + `delivery_status='failed'` + evento no audit log. **Antes de enviar, o worker checa quota** (`usage_counters`) → estourada: `delivery_status='quota_exceeded'` (INFRA-SAAS §5.3 ponto 3). Erros da Evolution mapeados: 4xx definitivo (número inexistente) → `failed` sem retry; 5xx/timeout → retry. O `provider_type` da integration escolhe Baileys × Cloud API (INFRA-SAAS §3) — o contrato da fila não muda entre providers.

### 4.2 Fila de campanhas — `campaign_dispatch`

```jsonc
{ "v": 1, "campaign_id": "uuid", "tenant_id": "uuid",
  "contact_ids": ["uuid"],          // lote fatiado pelo produtor (execute-campaign)
  "batch_index": 3, "rate_limit_key": "tenant:uuid", "enqueued_at": "…Z" }
```

Worker aplica rate limit por tenant (substitui `send_rate_log` como mecanismo central — INFRA-SAAS §6.2), respeita `send_window`/`skip_weekends` (hoje checados em `execute-campaign/index.ts:86-89`), incrementa `campaigns.processed` e enfileira cada envio em `whatsapp_outbound` (composição de filas, não envio direto).

### 4.3 Webhook Stripe → entitlements — `POST /webhooks/stripe`

- **Auth:** assinatura `Stripe-Signature` (verificação com webhook secret; ≠ auth de usuário).
- **Eventos tratados:** `customer.subscription.created|updated|deleted`, `invoice.payment_failed`, `entitlements.active_entitlement_summary.updated` (fonte: INFRA-SAAS §5.2).
- **Efeito:** upsert em `tenant_features` (`company_id, feature_key, source, expires_at` — schema em INFRA-SAAS §5.2) + `companies.plan` + grace em `past_due`. **Resposta 200 imediata** e processamento idempotente por `event.id` (Stripe retransmite; tabela `processed_webhook_events(event_id unique)`).
- **Reconcile:** job diário lendo List Active Entitlements (INFRA-SAAS Fase 3 — cobre webhook perdido).
- Falha de billing **nunca** derruba atendimento (fail-open, INFRA-SAAS §5.4).

### 4.4 Webhook Evolution → mensagem inbound — `POST /webhooks/evolution`

**Este contrato JÁ EXISTE e é preservado** (`incoming-message/index.ts`) — a v1 apenas o formaliza e endurece:

- **Headers:** `x-evolution-signature: <hex HMAC-SHA256 do body>` (verificação constant-time, `index.ts:19-44`) ou `x-webhook-secret` (legado, sunset assim que todas as instâncias migrarem). Sem secret configurado → hoje aceita tudo (backwards compat, `:17`); na v1, secret **obrigatório** por integration.
- **Payload (Evolution v2, inalterado):** `{ "event": "messages.upsert", "instance": "<instance_name>", "data": { "key": { "remoteJid", "fromMe", "id", "participant?" }, "message": { "conversation" | "extendedTextMessage" | "imageMessage" | … , "contextInfo"? }, "pushName", "messageTimestamp", "profilePictureUrl"?, "media"? } }` — parsing completo em `parseEvolutionPayload` (`index.ts:61-220`), incluindo: sufixo multi-device `:108` removido antes de normalizar (`:98-101`), LID `@lid` não normalizado como telefone (`:103-109`), grupos `@g.us` com `participant` como remetente real (`:111-116`), `fromMe=true` não nomeia o contato (`:194-198`), `contextInfo.stanzaId` → reply threading (`:128-148`).
- **Eventos não-mensagem:** `messages.update`, `messages.delete`, `presence.update`, `connection.update` → `200 { "data": { "handled": "<event>" } }` (hoje `{ok:true, handled:…}` em `:856,872,928,957` — envelope muda, semântica não).
- **Resposta:** `200 { "data": { "conversation_id": "uuid", "deduplicated": false } }` (hoje `{ok:true, conversation_id}` em `:1749-1752`). Sempre 200 para erros de negócio recuperáveis (Evolution retransmite em não-200); 401 só para assinatura inválida; 500 reservado a falhas que **devem** gerar retransmissão.
- **Idempotência:** `messages.external_message_id` unique + `ON CONFLICT DO NOTHING` (§2.5); resposta `deduplicated: true` quando replay.
- **Trigger do chatbot:** sai do fire-and-forget HTTP (`index.ts:1729-1739`) e vira evento interno na fila `chatbot_triggers` `{v:1, conversation_id, message_body, tenant_id, contact_id, flow_id}` — consumido por `chatbot-process` com retry. Guards preservados: não re-disparar em conversa já atribuída (`:1709-1717`), keyword reabre `pending` (`:1718-1726`).

### 4.5 Realtime — canais e payloads

| Canal | Tipo | Autorização | Payload |
|---|---|---|---|
| `inbox-rt-{tenant_id}` | `postgres_changes` (messages, conversations, annotations) + broadcast | canal `private: true` + policy em `realtime.messages` amarrando `realtime.topic()` ao `tenant_id` do JWT (INFRA-SAAS §4.5) | postgres_changes: row completo (RLS das tabelas filtra — doc oficial); broadcast abaixo |
| `inbox-rt-{tenant_id}` (broadcast) | `message.delivery_status_changed` | idem | `{ message_id, conversation_id, delivery_status, external_message_id? }` — publicado pelo worker |
| `inbox-rt-{tenant_id}` (broadcast) | `conversation.assigned` | idem | `{ conversation_id, assigned_user_id, actor_id }` |
| `presence-{tenant_id}` | presence | idem | `{ user_id, online_at }` (online-first do round-robin lê `last_seen_at` — `incoming-message/index.ts:307-323`) |
| `typing-{conversation_id}` | broadcast efêmero | membro no escopo da conversa | `{ user_id, is_typing }` |

Migração: o canal único por empresa já existe (`inbox-rt-{companyId}` — ARCH §4.3); a v1 adiciona `private: true`, a policy em `realtime.messages`, e os eventos de broadcast do worker. **Compat:** o nome do canal não muda (cliente antigo reconecta no mesmo tópico), mas clientes antigos sem JWT com claim serão rejeitados após a Fase 2 — coordenado por `min_supported_client` (§2.1).

---

## 5. Tipos TypeScript compartilhados

### 5.1 Estrutura proposta

Monorepo single-package por ora (sem `packages/` até haver segundo consumidor — o worker Deno importa via path/tsconfig compartilhado):

```
src/shared/api-contracts/
├── index.ts                     # barrel export
├── db/
│   └── database.types.ts        # GERADO: supabase gen types typescript (CI) — hoje src/integrations/supabase/types.ts
├── errors.ts                    # ApiError (movido de services/api.ts:51-58) + ApiErrorCode (enum §2.3)
│                                #   + fromPostgrestError(): mapeia 23505/23503/42501/PGRST116 → códigos v1
├── envelope.ts                  # ApiEnvelope<T>, ApiErrorBody, unwrap() — normaliza postgrest × rpc × edge
├── pagination.ts                # CursorPage<T>, OffsetPage<T>, encodeCursor/decodeCursor
├── realtime.ts                  # nomes de canal (inboxRtChannel(tenantId)…) + payloads §4.5 tipados
├── events/
│   ├── queues.ts                # WhatsappOutboundMessage, CampaignDispatchMessage (zod, §4.1-4.2)
│   └── webhooks.ts              # EvolutionWebhookPayload (espelha parseEvolutionPayload), StripeEventTypes
└── v1/
    ├── tenancy.ts   conversations.ts   messages.ts   contacts.ts   tags.ts
    ├── deals.ts     chatbot.ts         campaigns.ts  reports.ts    nps.ts
    ├── integrations.ts  tasks.ts       ai.ts         billing.ts    admin.ts
    # cada arquivo: Request types + zod schemas, Response types, Errors do domínio
```

### 5.2 Geração e derivação

1. **Fonte da verdade dos recursos:** `supabase gen types typescript --linked > src/shared/api-contracts/db/database.types.ts` em CI (falha o build se divergir do commit — elimina o drift atual: `register-company/index.ts:43` insere `slug` em `companies`, coluna **ausente** dos tipos gerados em `types.ts:412-435`; drift exato desse tipo é o risco 🟡10 do ARCHITECTURE.md).
2. **Tipos de domínio derivam dos gerados** (como hoje `Tables<>`/`TablesInsert<>` em `api.ts:5-10`), nunca redeclarados à mão: `type ConversationSummary = Pick<Tables<'conversations'>, …> & { contact: …; unread_count: number }`.
3. **Zod só nas bordas não-PostgREST:** payloads de edges, filas e webhooks (PostgREST já é validado pelo banco). `z.infer` gera os tipos TS dos eventos — um schema só serve frontend, edge Deno e testes.
4. **Consumo pelo frontend:** um `createApiClient(supabase)` em `src/shared/api-contracts/client/` expõe métodos por domínio (`client.conversations.list(filters) → CursorPage<ConversationSummary>`) encapsulando postgrest/rpc/edge + `unwrap()` de envelope + `fromPostgrestError`. Hooks React Query passam a importar **só daqui** — o god-service `api.ts` (871 LOC, ARCH §8 risco 4) vira façade de re-exports durante a migração e morre ao final (§7).

---

## 6. Segurança do contrato

### 6.1 O que NUNCA existe via PostgREST direto

| Objeto | Por quê | Caminho na v1 |
|---|---|---|
| `companies` (write), `profiles.company_id` (update) | troca de tenant = escalada cross-tenant | somente edge `provision-tenant`/service role; coluna `company_id` imutável via trigger |
| `user_roles` (write) | privilege escalation (hoje mitigado por RLS; o fallback `user_metadata` torna pior — INFRA-SAAS §4.1) | rpc `api_v1.update_member` (admin, valida tenant) |
| `tenant_features`, `plan_limits`, `usage_counters` (write) | dinheiro — cliente escrevendo entitlement/cota | somente `stripe-webhook`/triggers (service role); leitura via views |
| `integrations.config` (leitura de `api_key`, escrita) | segredo de infraestrutura do tenant | view redigida p/ leitura; edge p/ escrita (§3.11) |
| `audit_log` (write/delete) | integridade forense | triggers + edges (insert-only); sem update/delete |
| tabelas `pgmq.*`, `realtime.messages` | infra | acesso via workers/edges |
| troca de `tenant_id` no JWT | impossível por construção: claim só em `app_metadata` via Custom Access Token Hook (INFRA-SAAS §4.1); `user_metadata` nunca carrega autorização |

**Regra transversal:** nenhum endpoint/RPC da v1 aceita `company_id`/`tenant_id`/`user_id`-do-chamador como argumento. Hoje `sendMessage`/`markConversationRead` aceitam `opts:{userId, companyId}` do cliente (`api.ts:404-427,686-706`) e as RPCs de unread recebem `p_company_id`/`p_user_id` do browser (`api.ts:163-173,728-732`) — na v1 tudo isso é derivado do JWT server-side. **Validação obrigatória por endpoint:** RLS com `private.current_tenant_id()` (INFRA-SAAS §4.2) no plano de dados; `assert tenant_id = private.current_tenant_id()` dentro de cada RPC do catálogo; edges comparam o tenant do JWT com o tenant do recurso antes de operar.

### 6.2 RPCs `SECURITY DEFINER`: catálogo fechado (absorção)

As 11 funções atuais (`types.ts:1703-1788`) viram o catálogo versionado — cada uma com validação interna de tenant, schema não-público para helpers e teste pgTAP de isolamento (INFRA-SAAS §4.2/§9.3):

| Atual | Destino na v1 |
|---|---|
| `get_user_company_id`, `current_company_id` (+`get_my_company_id`) | eliminadas → `private.current_tenant_id()` lê o JWT (INFRA-SAAS Fases 0→2) |
| `get_unread_conversation_ids` | absorvida por `api_v1.list_conversations(has_unread=true)` |
| `get_unread_counts` | `api_v1.get_unread_counts` (mantida; args de tenant removidos) |
| `get_sidebar_unread_count` | `api_v1.get_sidebar_stats` |
| `get_funnel_contact_ids`, `get_funnel_contact_ids_multi`, `get_stage_contact_ids` | absorvidas por `api_v1.list_conversations(funnel_id, stage_id)` |
| `get_funnel_filtered_conversation_ids` | absorvida por `api_v1.list_conversations` (filtros completos) |
| `get_agent_metrics` | `api_v1.get_agent_metrics` |
| `swap_funnel_stage_positions` | `api_v1.reorder_stages` |
| `has_role` | mantida em `private` (helper de RLS, não exposta) |
| — nova regra — | nova RPC `SECURITY DEFINER` = ADR + pgTAP (INFRA-SAAS §9.3) |

Edges eliminadas/renomeadas: `ensure-user-role` **eliminada** (INFRA-SAAS §4.3); `send-whatsapp` (chamada do browser) **aposentada** após modo sombra (INFRA-SAAS §6.3) — subsistindo apenas como `worker-send-whatsapp` interna; `register-company` → absorvida por `provision-tenant` (§3.1#1); `invite-user` → `invite-member`; `evolution-api` (proxy genérico com `action` — `evolution-api/index.ts:40`) → `integrations-manager` com operações explícitas (fim do proxy free-form, que hoje aceita `api_url`/`api_key` arbitrários do cliente — SSRF-shaped).

### 6.3 Autenticação por plano

- **Cliente→API:** JWT do Supabase Auth com `app_metadata.tenant_id` + `app_metadata.user_role` (hook, INFRA-SAAS §4.1). Claim ausente = **nega** (Fase 2, re-login coordenado via `min_supported_client`).
- **Service-to-service interno:** o padrão atual de comparar o Bearer com `SUPABASE_SERVICE_ROLE_KEY` (`_shared/auth.ts:34-40`, duplicado inline em `send-whatsapp/index.ts:38-40`) é substituído por **JWT de serviço assinado** (ou, no mínimo, header `x-internal-call` + segredo rotacionável por function) — a igualdade de string com a service key transforma qualquer vazamento de env em acesso total.
- **Webhooks:** HMAC por provedor (Evolution §4.4, Stripe §4.3), secrets por integration/endpoint, nunca compartilhados com o cliente.

---

## 7. Plano de migração (alinhado ao INFRA-SAAS §10)

Princípio: **nenhuma fase quebra o app**; cada uma entrega contrato novo atrás de façade e remove o antigo só após sombra. `services/api.ts` permanece como camada de compatibilidade re-exportando do client novo até a última fase (estratégia já recomendada no ARCH §7 item 2).

| Fase | Alinhada a | Conteúdo do contrato | Compat / reversão |
|---|---|---|---|
| **A — Fundação do contrato** (1–2 sem) | INFRA Fase 0 | Criar `src/shared/api-contracts/` (§5) com tipos gerados em CI; mover `ApiError`+`handleError` (`api.ts:44-66`) para `errors.ts` com os códigos §2.3; lint `no-restricted-imports` proibindo `supabase.from()` fora de `features/*/api.ts` (ARCH §9 Sprint 1.3); publicar regra additive-only + template de ADR de contrato | Zero mudança de runtime; PR de tipos falha CI se schema driftar (expõe o caso `slug`, §5.2) |
| **B — Contrato de mensagens** (2 sem) | INFRA Fase 1 | `POST /v1/conversations/{id}/messages` (202+fila+`Idempotency-Key`) atrás de feature flag; worker em **modo sombra** 1 semana (browser ainda chama `send-whatsapp`; worker só marca `sent_by='worker-shadow'` e compara — INFRA-SAAS §6.3); cortar o envio do browser; aposentar `send-whatsapp` pública | Rollback = desligar flag (browser volta a enviar); dedup por `message_id` evita dupla entrega na transição |
| **C — Identidade e catálogo RPC** (2–3 sem) | INFRA Fase 2 | JWT com `tenant_id`; criar schema `api_v1` + as 4 RPCs do catálogo (§6.2) validando tenant internamente; migrar `listConversations`/`getUnreadCounts`/sidebar/metrics hook a hook; remover `p_company_id`/`opts.companyId` dos call sites; envelope §2.2 nas edges existentes (chatbot-process, execute-campaign…) | RPCs novas convivem com as antigas; `CACHE_VERSION`/logout forçado para tokens sem claim (INFRA Fase 2); diff de resultados antigo×novo em staging antes de ligar |
| **D — Billing** (3 sem) | INFRA Fase 3 | Endpoints §3.14 + `tenant_features`/`usage_counters` legíveis; frontend passa a ler entitlements de `/v1/tenancy/current` em vez de inferir módulo por permissão; códigos 402 ativados primeiro em **modo aviso** (banner, sem bloqueio) e só depois enforcement | Grandfathering: tenants legados entram como Enterprise-trial 60d (INFRA Fase 3) |
| **E — Self-service e admin** (2 sem) | INFRA Fase 4 | `provision-tenant` v1 (absorve `register-company`), `invite-member` (absorve `invite-user`), endpoints §3.15; remoção final de `ensure-user-role` e do auto-recovery de 10s do AuthContext | `register-company` antiga responde 410 Gone com `Sunset` após cutover |

**Ao final da Fase E:** todo acesso a dados do frontend passa por `api-client` tipado; `services/api.ts` é deletado; o contrato v1 (este documento + `docs/api/openapi-v1.yaml` + tipos gerados) é a única fonte da fronteira.

**Regras permanentes de evolução do contrato (a partir da Fase A):**
1. Mudança breaking exige v2 + sunset ≥ 90 dias (§2.1).
2. Toda PR que altera RPC/edge/view de contrato atualiza `docs/api/openapi-v1.yaml` e os zod schemas no mesmo commit (CI checa).
3. Código de erro novo entra no enum §2.3 com mensagem pt-BR — proibido erro sem `code`.
4. Tenant nunca viaja em payload/path — linter customizado rejeita `company_id` em request schemas.

---

## 8. Apêndice A — Drifts e riscos de contrato detectados no código atual (que esta estrutura elimina)

1. **Envio de mensagem dependente do browser** (risco 🔴2 ARCH §8): `sendMessage` grava e `sendViaWhatsApp` dispara best-effort (`api.ts:404-455`, `69-101`) → contrato async §3.3#2 + fila §4.1.
2. **Tenant enviado pelo cliente** a RPCs `SECURITY DEFINER` (`api.ts:163-173`, `types.ts:1772-1787`) e services (`deals.ts:45`, `tasks.ts:43`) → proibido na v1 (§6.1); RPCs absorvidas com assert interno (§6.2).
3. **Drift schema↔tipos** (`companies.slug` inserido em `register-company/index.ts:43`, ausente de `types.ts:412-435`) e casts `as unknown as` recorrentes (`api.ts:552,400`) → tipos gerados em CI + zod (§5.2).
4. **Envelopes de erro inconsistentes** entre edges (`{error}` 4xx × `{ok:false,error}` **200** × `{delivered,reason}` — `send-whatsapp/index.ts:61-168,597,669`) → envelope único §2.2.
5. **Sentinels mágicos e N roundtrips** no filtro do Inbox (`api.ts:199-202,261,279-335`) → RPC única §3.2.
6. **Proxy free-form para Evolution** (`evolution-api/index.ts:40` aceita `action`/`api_url`/`api_key` arbitrários) → operações explícitas §3.11.
7. **Auth interno por igualdade com service-role key** (`_shared/auth.ts:34-40`) → §6.3.
8. **Fallback de role via `user_metadata`** (editável pelo usuário — INFRA-SAAS §4.1) → eliminado na Fase C.

---

*Fim do documento. Manter sincronizado com `docs/api/openapi-v1.yaml` e com o catálogo de RPCs `api_v1` a cada mudança de contrato. Próxima revisão: ao concluir a Fase A do §7.*
