# INFRA-SAAS — Nova Infraestrutura Multi-Tenant do ALL-IN CRM (bhub)

> Documento de projeto de infraestrutura. Gerado em **22/07/2026** a partir de pesquisa de documentação oficial (Supabase, Stripe, Meta/Evolution API, Microsoft Learn, Sentry) e do estudo de estado atual em `docs/ARCHITECTURE.md` e `infra-changes.md`.
>
> **Escopo:** transformar o CRM em um SaaS multi-tenant vendável para N empresas: isolamento robusto, billing, onboarding self-service e operação em escala — **sem trocar de stack** (permanece Vite + React + Supabase + Evolution/Cloud API + Vercel).

---

## 1. Resumo executivo

O CRM hoje é um **produto single-tenant operado para uma empresa**, embora o schema já suporte várias `companies` (ARCHITECTURE.md §3). A distância entre "suportar várias companies no banco" e "ser um SaaS vendável" está em cinco lacunas, cada uma endereçada neste documento:

| # | Lacuna atual (evidência) | O que muda |
|---|---|---|
| 1 | Isolamento depende de ~180 policies heterogêneas + RPCs `SECURITY DEFINER` proliferando (ARCHITECTURE.md §5.3, §8 risco 1) | Tenant resolvido **uma vez** via JWT claim (`tenant_id`) injetado por Custom Access Token Hook; RLS padronizada e auditável |
| 2 | Entrega WhatsApp é best-effort do browser — mensagem se perde se a aba fechar (ARCHITECTURE.md §8 risco 2) | **Fila server-side** (Supabase Queues/pgmq) com retries e dead-letter; browser só registra intenção |
| 3 | Não existe billing, planos ou limites — qualquer empresa usa tudo ilimitado | Stripe Billing por tenant, entitlements persistidos localmente, enforcement de limites no backend |
| 4 | Não existe self-service: criar empresa/projeto exige operação manual | Signup → provisionamento atômico do tenant → trial → convite de equipe |
| 5 | Operação reativa: 96 migrations remendadas (>25 `fix_*`/`backfill_*`), sem staging, sem observabilidade estruturada (ARCHITECTURE.md §8 riscos 6–8; infra-changes.md mostra incidente operacional com perda de 26 sessões WhatsApp) | Schema declarativo + Supabase Branching, Sentry, audit log por tenant, PITR, runbooks |

**Princípio norteador:** tudo que é decisão de segurança, dinheiro ou entrega de mensagem acontece **server-side** (Postgres, Edge Functions, filas). O browser continua sendo uma UI excelente — mas deixa de ser um ponto de falha silenciosa.

---

## 2. Decisão de isolamento de tenants

### 2.1 Os três padrões pesquisados

A taxonomia de referência é a da Microsoft para SaaS multi-tenant (fonte: Microsoft Learn — *Multitenant SaaS Patterns*), mapeada para o contexto Supabase:

| Critério | Database-per-tenant (silo) | Schema-per-tenant (bridge) | **Shared schema + RLS (pool)** |
|---|---|---|---|
| Isolamento de dados | Máximo (físico) | Alto (lógico forte) | Lógico — depende 100% do RLS estar correto |
| Custo por tenant | Alto (1 projeto Supabase por tenant = inviável abaixo de enterprise) | Médio | **Menor** — milhares de tenants em 1 projeto |
| Evolução de schema | N projetos × migrations | 1 migration rodada N schemas | **1 migration, 1 lugar** |
| Restore por tenant | Trivial | Fácil (pg_dump do schema) | Difícil (cirúrgico, por `company_id`) |
| Customização por tenant | Fácil | Média | Difícil (schema único) |
| Noisy neighbor | Não | Parcial | Sim — mitigável com índices/RLS performática |
| Fit com PostgREST/Supabase | Ruim (API por projeto) | Ruim (schema exposure por request é frágil) | **Nativo** — RLS é o modelo do Supabase |

Fontes: Microsoft Learn (padrões de tenancy), Supabase RLS docs, Supabase RLS Performance Guide (GitHub Discussion #14576).

### 2.2 Decisão: **shared schema + RLS, com tenant_id no JWT**

**Manter o modelo atual (pool)** e corrigi-lo, em vez de migrar para silo/bridge. Justificativas:

1. **O investimento já feito é no modelo pool.** São ~180 policies e toda a hierarquia `companies → departments → projects` funcionando (ARCHITECTURE.md §3, §5.3). Trocar o modelo de isolamento invalidaria o ativo mais maduro do projeto.
2. **Custo operacional.** Database-per-tenant no Supabase implicaria um projeto (ou branch) por empresa cliente — inviável para um SaaS de SMB brasileiro com ticket de centenas de reais/mês. O modelo pool é o de menor custo por tenant (Microsoft Learn, tabela comparativa §I).
3. **Evolução de schema.** Com 96 migrations em 3 meses (ARCHITECTURE.md §8 risco 6), multiplicar isso por N bancos/schemas é operacionalmente suicida. O pool concentra a evolução em um único pipeline (ver §9).
4. **O risco do pool (RLS incorreto = vazamento cross-tenant) é gerenciável** com as práticas oficiais: policies padronizadas geradas a partir de templates, testes de RLS automatizados (pgTAP / supabase-test-helpers, recomendado no guia oficial), e redução drástica das RPCs `SECURITY DEFINER` (hoje o risco 🔴1 do ARCHITECTURE.md).
5. **Saída de emergência preservada (modelo híbrido).** O padrão híbrido da Microsoft permite mover um tenant enterprise para banco dedicado no futuro **sem mudar o schema** — o `company_id` já é a chave de particionamento lógico em todas as tabelas. Oferecer "tenant dedicado" como plano enterprise futuro é um upsell, não uma reescrita.

**O que muda na prática:** o tenant deixa de ser descoberto por função SQL consultando `profiles` a cada query (`get_user_company_id()` e seus dois clones — ARCHITECTURE.md §5.3) e passa a vir **pronto no JWT** (`app_metadata.tenant_id`), injetado na emissão do token por um Custom Access Token Hook (ver §4). Isso elimina o lookup por linha e padroniza a policy em uma única expressão auditável.

---

## 3. Arquitetura alvo

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Vite + React 18 + TS) — Vercel                                     │
│                                                                              │
│  - supabase-js com NOVAS API keys (sb_publishable_) — substitui anon legacy  │
│  - Sentry (errors + tracing + session replay) com tag tenant_id              │
│  - Realtime: canal PRIVADO por tenant (private: true, RLS realtime.messages) │
│  - Feature flags de plano lidas de tenant_features (via view pública)        │
└──────┬───────────────────────────────────────────────────────────────────────┘
       │ HTTPS/WSS (JWT com app_metadata.tenant_id + role)
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ SUPABASE (projeto único, shared schema)                                      │
│                                                                              │
│  Auth ────────────────────────────────────────────────────────────           │
│   ├─ Custom Access Token Hook → injeta tenant_id, role, entitlements_ver     │
│   ├─ Convites: auth.admin.inviteUserByEmail (via edge, service role)         │
│   ├─ SSO/SAML por tenant (sso_provider_id ↔ companies)  [plano Enterprise]   │
│   └─ MFA TOTP obrigatório p/ admins (policy restrictive aal2)                │
│                                                                              │
│  Postgres ──────────────────────────────────────────────                     │
│   ├─ RLS padronizada: tenant_id = (select auth.jwt()->>'tenant_id')          │
│   ├─ Índices em toda coluna company_id (RLS performance guide)               │
│   ├─ 1 helper único app.current_tenant_id() (aposenta os 3 atuais)           │
│   ├─ RPCs SECURITY DEFINER auditadas e reduzidas a catálogo fechado          │
│   ├─ audit_log (quem fez o quê, por tenant) + pgAudit (DDL/writes admin)     │
│   ├─ usage_counters (mensagens/mês, agentes ativos, números) p/ billing      │
│   └─ tenant_features (entitlements do Stripe, cache local)                   │
│                                                                              │
│  Filas (Supabase Queues / pgmq) ─────────────────────────────                │
│   ├─ whatsapp_outbound (envio) ──► worker edge (cron 1 min + webhook)        │
│   ├─ whatsapp_outbound_dlq (após N tentativas, via archive + requeue manual) │
│   └─ campaign_dispatch (disparo de campanhas com rate limit)                 │
│                                                                              │
│  Edge Functions (Deno) ──────────────────────────────────────                │
│   ├─ incoming-message (webhook Evolution/Cloud API, HMAC + idempotência)     │
│   ├─ worker-send-whatsapp (consome fila, retry, atualiza delivery_status)    │
│   ├─ stripe-webhook (subscriptions + entitlements → tenant_features)         │
│   ├─ provision-tenant (signup → tenant atomico + seed)                       │
│   ├─ invite-member (convite com role e validação de seat limit)              │
│   └─ chatbot-process, ai-*, execute-campaign (existentes, adaptadas p/ fila) │
│                                                                              │
│  Cron (pg_cron) ─────────────────────────────────────────────                │
│   ├─ tick worker-send-whatsapp (fallback do trigger; já existe padrão §4.5)  │
│   ├─ agregação usage_counters → Stripe meter events (1×/dia)                 │
│   └─ retenção/expurgo audit_log e arquivos (LGPD)                            │
│                                                                              │
│  Backups: Daily (Pro) + PITR (RPO ≤ 2 min)                                   │
│  Logs: Logs Explorer + alertas; branches: staging persistente + preview/PR   │
└──────┬───────────────────────────────┬───────────────────────────────────────┘
       │ HTTPS                          │ Webhook (HTTPS + assinatura)
       ▼                                ▼
┌──────────────────────┐      ┌─────────────────────────────────────────────┐
│ STRIPE BILLING       │      │ MENSAGERIA WHATSAPP                          │
│ - Customer por tenant│      │  Fase 1: Evolution API v2.3.7 (Railway)      │
│ - Subscription/plano │      │    Baileys, multi-instância, Redis + volume  │
│ - Entitlements       │      │  Fase 2 (enterprise): instâncias Cloud API   │
│ - Metered (mensagens)│      │    oficiais Meta DENTRO da própria Evolution │
└──────────────────────┘      └─────────────────────────────────────────────┘
```

**Decisões embutidas no diagrama:**

- **Evolution API permanece**, mas evolui de "caixa-preta única" para **camada de mensageria gerenciada**: o runbook `infra-changes.md` mostra que ela já exigiu volume persistente, Redis e limpeza de 130 instâncias mortas — ou seja, já é um serviço que operamos seriamente. A própria Evolution v2.x suporta **dois providers**: Baileys (WhatsApp Web, gratuito, risco de ban) e **WhatsApp Cloud API oficial da Meta** (paga por conversa, SLA da Meta, sem risco de ban) — fonte: README oficial do repositório `evolution-foundation/evolution-api`. Isso permite a estratégia pragmática: **SMBs entram no Baileys (barato); enterprise/tenants de volume migram para instâncias Cloud API dentro da mesma Evolution**, sem trocar a integração do CRM. A tabela `integrations` ganha coluna `provider_type: 'baileys' | 'cloud_api'`.
- **Trade-off assumido:** Cloud API cobra por conversa (categoria marketing/utility/service) e exige templates aprovados pela Meta e verificação de Business; Baileys é grátis mas viola os ToS do WhatsApp e pode ser banido — risco que hoje é invisível para o cliente e deve virar **termo contratual explícito por plano**. (Nota de pesquisa: as páginas oficiais da Meta em developers.facebook.com bloquearam o fetch automático — HTTP 400; as características da Cloud API foram validadas via README oficial da Evolution API, que a integra nativamente. Recomenda-se validação manual da doc da Meta antes da Fase 5.)
- **Stripe** fica fora do caminho crítico: falha de billing nunca derruba atendimento (fail-open com grace period, ver §5.4).

---

## 4. Modelo de identidade e acesso

### 4.1 JWT como veículo do tenant

Hoje o tenant é resolvido por funções SQL (`get_user_company_id`, `get_my_company_id`, `current_company_id` — três helpers equivalentes, ARCHITECTURE.md §5.3) consultando `profiles` a cada statement. O modelo alvo usa o **Custom Access Token Hook** do Supabase Auth (fonte: docs oficiais de Auth Hooks), uma função Postgres executada a cada emissão/refresh de token:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb := event->'claims';
  v_tenant uuid; v_role text; v_active boolean;
begin
  select p.company_id, ur.role::text, p.is_active
    into v_tenant, v_role, v_active
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  where p.id = (event->>'user_id')::uuid;

  if v_active is distinct from true then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'user_inactive'));
  end if;

  claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(v_tenant));
  claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(coalesce(v_role,'agent')));
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

Pontos de atenção vindos da documentação oficial:

- **Autorização vai em `app_metadata`, nunca em `user_metadata`** — `user_metadata` é editável pelo próprio usuário via `supabase.auth.update()` (aviso explícito da doc de RLS). Hoje o `AuthContext` tem fallback de role via `user_metadata` (ARCHITECTURE.md §5.2) — **isso é uma vulnerabilidade de privilege escalation** e deve ser eliminado na Fase 2.
- **JWT não é "fresh":** se um agente for desligado, o token dele continua válido até expirar. Mitigação oficial: janela de expiração curta do JWT + revogação de refresh token (dashboard Auth settings). O bloqueio `is_active=false` que hoje ocorre no frontend (AuthContext) passa a ocorrer também no hook (erro 403 acima) — defesa em profundidade real.
- O hook roda **em toda emissão de token** — a query deve ser coberta por índice em `profiles.id`/`user_roles.user_id` e a função deve ser `stable` com grants explícitos (a doc recomenda **evitar** `security definer` em hooks, preferindo grants a `supabase_auth_admin`).

### 4.2 RLS alvo: uma convenção, um helper

Template único de policy (substitui o mosaico `*_company_all` vs `Admins can …`, ARCHITECTURE.md §5.3):

```sql
-- schema private: helpers fora da API (recomendação oficial)
create schema if not exists private;

create or replace function private.current_tenant_id()
returns uuid language sql stable as
$$ select nullif((select auth.jwt()) -> 'app_metadata' ->> 'tenant_id','')::uuid $$;

-- exemplo em conversations
alter table public.conversations enable row level security;

create policy tenant_isolation on public.conversations
  to authenticated
  using ( company_id = (select private.current_tenant_id()) )
  with check ( company_id = (select private.current_tenant_id()) );
```

Fundamentação de performance (Supabase RLS docs + RLS Performance Guide, com benchmarks medidos em tabela de 100K–1M linhas):

1. **`(select auth.jwt())` wrapped** → Postgres gera `initPlan` e cacheia por statement (ganho medido: 94,97%–99,99% conforme o caso).
2. **Índice em toda coluna usada em policy** (`company_id`, `user_id`): ganho medido de 99,94% — hoje nem toda tabela do CRM tem índice em `company_id`; a Fase 0 inclui auditoria de índices.
3. **`to authenticated` explícito** em toda policy: evita executar a expressão para `anon` (ganho 99,78% no acesso anônimo).
4. **Filtro explícito no cliente** (`.eq('company_id', tenantId)`) além do RLS: o RLS é segurança, o filtro ajuda o planner (ganho 94,74%).
5. **Joins invertidos:** `team_id in (select ... where user_id = auth.uid())` em vez de `auth.uid() in (select ... where team_id = table.team_id)` (9.000ms → 20ms no benchmark).

RPCs `SECURITY DEFINER` (`get_funnel_contact_ids`, `get_unread_conversation_ids`, `get_sidebar_unread_count`, `get_agent_metrics`, `swap_funnel_stage_positions` — ARCHITECTURE.md §5.3) passam por **auditoria e catálogo fechado**: cada uma deve (a) validar `company_id = private.current_tenant_id()` internamente, (b) morar em schema não exposto, (c) ter teste pgTAP provando que não vaza cross-tenant. Novas RPCs `SECURITY DEFINER` exigem justificativa em ADR (ver §9.3).

### 4.3 Convites, roles e granularidade

- **Convite de equipe:** edge `invite-member` (service role) chama `supabase.auth.admin.inviteUserByEmail(email, { data: { invited_tenant, invited_role } })` (referência oficial da API Admin). O trigger `handle_new_user` cria `profiles` + `user_roles` a partir do convite, vinculando ao tenant. Substitui o fluxo atual de criação manual e elimina a edge `ensure-user-role` (self-healing de role que hoje mascara falha de bootstrap — ARCHITECTURE.md §5.2).
- **Roles:** mantém enum `app_role` (admin/supervisor/agent) + `profiles.custom_permissions` JSONB para granularidade fina (hoje consultado por `usePermissions().can(key)` — ARCHITECTURE.md §5.3). Role vai no JWT; `custom_permissions` permanece em DB (checado em policies específicas via helper `private.has_permission(key)`), porque muda com frequência e JWT não é fresh.
- **MFA:** TOTP do Supabase Auth com enforcement por **policy restrictive** `(select auth.jwt()->>'aal') = 'aal2'` nas tabelas sensíveis para admins (padrão oficial de MFA enforcement). Começar exigindo MFA de admins de tenant; usuários finais opcional.

### 4.4 SSO enterprise (SAML)

O Supabase Auth suporta **múltiplas conexões SAML por projeto** via CLI (`supabase sso add --type saml --domains empresa.com`), e a documentação confirma explicitamente o caso **multi-tenant SSO**: cada conexão gera um `sso_provider_id` distinto, presente no JWT em `amr[0].provider`, que pode ser mapeado para o tenant em RLS:

```sql
-- companies.sso_provider_id uuid unique  (preenchido no onboarding enterprise)
create policy "SSO users scoped to their tenant" on public.companies
  as restrictive to authenticated
  using ( sso_provider_id is null
          or sso_provider_id = (select auth.jwt()#>>'{amr,0,provider}')::uuid );
```

Fonte: Supabase SSO/SAML docs (seção FAQ *"Is multi-tenant SSO with SAML supported?"*). Observações da doc: SSO exige plano Pro+ e custa US$ 0,015/SSO MAU acima da quota — precificar no plano Enterprise. Login pelo app via `supabase.auth.signInWithSSO({ domain: 'empresa.com' })`.

### 4.5 Realtime Authorization (canais privados por tenant)

Hoje há um canal único `inbox-rt-{companyId}` com `postgres_changes` (ARCHITECTURE.md §4.3). Dois endurecimentos, conforme a doc de Realtime Authorization:

1. **Desabilitar "Allow public access"** nas Realtime Settings e instanciar canais com `{ config: { private: true } }`.
2. **Policies em `realtime.messages`** amarrando o tópico ao tenant do JWT:

```sql
create policy "tenant realtime access" on realtime.messages
  for select to authenticated
  using ( realtime.topic() = 'inbox-rt-' || ((select auth.jwt())->'app_metadata'->>'tenant_id')
          and realtime.messages.extension in ('broadcast','presence') );
```

`postgres_changes` já respeita o RLS das tabelas assinadas (a doc confirma: registros só vão para clientes autorizados pela RLS da tabela), então a filtragem por `company_id` continua valendo — a policy acima protege broadcast/presence (typing indicators, online status) que hoje não têm controle. Aviso da doc: RLS complexa no Realtime aumenta latência de conexão — manter a policy barata (JWT claim puro, sem join).

---

## 5. Billing e planos

### 5.1 Modelo

- **1 Stripe Customer por tenant** (`companies.stripe_customer_id`), **1 Subscription por tenant** — o ciclo de vida oficial da subscription (`trialing → active → past_due → unpaid → canceled`, fonte: Stripe *How subscriptions work*) vira a máquina de estados do acesso.
- **Catálogo de preços:**
  - Plano base (licensed): Starter / Pro / Enterprise — `price` recorrente mensal por **seat de agente** (`quantity` = nº de agentes ativos; ajustado via API quando o tenant convida/remove).
  - Add-on **números WhatsApp**: licensed, quantity = nº de `integrations` ativas.
  - **Mensagens/mês**: metered. ⚠️ Verificação de deprecação: a Stripe marcou "Usage Records" como **legacy** e recomenda **Metronome** para novas integrações de usage-based billing (fonte: Stripe *Basic usage-based billing*). Decisão pragmática: **começar com faixas incluídas por plano** (ex.: 5k/50k/ilimitado mensagens) medidas por `usage_counters` próprio; adotar Metronome quando houver demanda real por cobrança variável — evita integrar uma plataforma nova antes da hora.
- **Checkout e portal:** Stripe Checkout (assinatura/troca de plano) + Customer Portal (fatura, cartão, cancelamento) — não construir UI de pagamento própria.

### 5.2 Entitlements (feature flags por plano)

Usar **Stripe Entitlements**: cada feature vira um `Feature` com `lookup_key` (`chatbot`, `campaigns`, `ai_reports`, `sso_saml`, `api_access`…) anexada aos Products. O webhook `entitlements.active_entitlement_summary.updated` (fonte: Stripe Entitlements docs) dispara a cada mudança de assinatura e é consumido pela edge `stripe-webhook`, que **persiste o resultado em `public.tenant_features`** — a própria doc do Stripe recomenda persistir entitlements internamente para resolução rápida:

```sql
create table public.tenant_features (
  company_id uuid not null references companies,
  feature_key text not null,
  source text not null default 'stripe',   -- stripe | manual_override | trial
  expires_at timestamptz,                  -- grace period de past_due
  primary key (company_id, feature_key)
);
-- RLS: leitura para membros do tenant; escrita apenas service_role
```

O frontend lê `tenant_features` (view simples) para esconder/mostrar módulos — substituindo gradualmente os `custom_permissions` como mecanismo de *plano* (permissions continuam sendo *papel do usuário dentro do tenant*; entitlements são *o que a empresa contratou* — conceitos hoje misturados).

### 5.3 Enforcement de limites no backend

Limites nunca no frontend. Três pontos de enforcement:

1. **Seats (agentes):** na edge `invite-member`, antes de convidar: `select count(*) from profiles where company_id = $1 and is_active` vs limite do plano (tabela `plan_limits` ou metadata do Price). Excedeu → 402/403 com upsell.
2. **Números WhatsApp:** no `INSERT` de `integrations` — policy `with check` chamando `private.check_limit('whatsapp_numbers')` (função que lê `plan_limits` e conta). Mesma técnica para campanhas ativas.
3. **Mensagens/mês:** `usage_counters` incrementado por trigger no `INSERT` de `messages` outbound (barato, em linha) + agregação diária via cron. O **worker de envio** (§6) consulta o contador antes de enviar: estourou a cota → mensagem vai para status `quota_exceeded` e o tenant é notificado (nunca bloquear inbox inbound — receber mensagem é direito do cliente final).

### 5.4 Fail-open com grace period

Falha do Stripe ou webhook atrasado **não pode derrubar atendimento** (diferente de auth). Regra: `tenant_features` expira por `expires_at`, e `past_due` concede grace de 7 dias com banner no app antes de revogar. Cancelamento (`canceled`) revoga escrita mas preserva leitura/export por 30 dias (obrigação LGPD de portabilidade, §8.4).

---

## 6. Pipeline de mensagens confiável

### 6.1 O problema hoje

`useSendMessage` grava a mensagem no DB e chama a edge `send-whatsapp` **do browser, best-effort** (ARCHITECTURE.md §4.2, §8 risco 🔴2): se a aba fechar entre os passos, a mensagem fica salva e **nunca enviada**, com `delivery_status` atualizado pelo próprio cliente. Em um SaaS vendável isso é perda silenciosa de receita do cliente.

### 6.2 Arquitetura alvo: Supabase Queues (pgmq)

A pesquisa convergiu para **Supabase Queues** (extensão `pgmq`, nativa do Postgres ≥ 15.6.1.143, fonte: Supabase Queues docs + pgmq repo):

```
Browser: INSERT messages (delivery_status='queued')   ── única responsabilidade do cliente
    │
    ├─ Database webhook (pg_net, assíncrono) ──► edge enqueue-outbound
    │      (pg_net não bloqueia a transação — doc Database Webhooks)
    │      → pgmq.send('whatsapp_outbound', {message_id, tenant_id, integration_id})
    │
    ▼
pgmq.q_whatsapp_outbound  (FIFO, durable, exactly-once dentro da visibility window)
    │
    ▼  pgmq.read(n=10, sleep_seconds=30)   ← visibility timeout = janela de retry
Edge worker-send-whatsapp (invocada por: (a) database webhook em cascade,
    │                     (b) pg_cron a cada 1 min como sweeper/fallback)
    ├─ checa quota do tenant (§5.3)
    ├─ POST Evolution API / Cloud API (por integration.provider_type)
    ├─ sucesso → UPDATE messages SET delivery_status='sent', external_message_id=...
    │            → pgmq.delete(msg_id)
    ├─ falha transitória → NÃO deleta: mensagem reaparece após 30s
    │            (read_ct incrementa a cada leitura = contador de tentativas nativo)
    └─ read_ct > 5 → pgmq.archive(msg_id)  ──► pgmq.a_whatsapp_outbound (DLQ)
                   → UPDATE messages SET delivery_status='failed' + alerta no Inbox
```

Por que pgmq e não alternativas:

- **Postgres-nativo, zero infra nova** (contrasta com adicionar RabbitMQ/Redis queue ao stack). A própria Evolution API suporta RabbitMQ/SQS/Kafka para *seus* eventos (README oficial), mas para o CRM a fila dentro do Supabase elimina um serviço a operar.
- **Durável e auditável:** mensagens são linhas em `pgmq.q_*`/`pgmq.a_*` — inspecionáveis com SQL, e a tabela de archive serve de **dead-letter queue** com reprocessamento manual ou por edge.
- **Exactly-once dentro da visibility window** (garantia documentada) + `read_ct` nativo = retries com backoff trivial.
- **Padrão de consumo oficial**: edge function lê N mensagens, processa, deleta; erro → mensagem permanece (fonte: *Consuming Supabase Queue Messages with Edge Functions*). O CRM **já usa pg_cron para invocar edges** (`invoke_execute_campaigns`, `invoke_process_scheduled_messages` — ARCHITECTURE.md §4.5), então o padrão operacional já existe na casa.
- Campanhas migram do mesmo jeito: `execute-campaign` vira produtor para `campaign_dispatch` com rate limit por tenant (hoje `send_rate_log` — ARCHITECTURE.md §3) — resolve o throttling de forma centralizada.

**Idempotência inbound:** a edge `incoming-message` (webhook da Evolution, ARCHITECTURE.md §4.4) passa a gravar `external_message_id` com **unique constraint** e `ON CONFLICT DO NOTHING` — webhooks retransmitem e hoje não há garantia de dedup documentada.

### 6.3 Migração compatível

A tabela `messages` e o optimistic update do React Query (melhor padrão do codebase, ARCHITECTURE.md §4.2) **não mudam**: o status `queued → sent → delivered/failed` é atualizado pelo worker, e o Realtime existente propaga a mudança para a UI. O browser deixa de chamar `send-whatsapp` — a edge homônima é aposentada após período de sombra (worker roda em paralelo comparando resultados por 1 semana).

---

## 7. Onboarding self-service

Fluxo alvo (tudo server-side após o signup):

```
1. Visitante preenche: email, senha, nome da empresa, segmento     (frontend)
2. supabase.auth.signUp()                                          (Auth nativo)
3. Edge provision-tenant (service role, idempotente por user_id):
     BEGIN
       INSERT companies (name, slug único, trial_ends_at = now()+14d)
       INSERT profiles (company_id, is_active)  ← vincula o auth.users recém-criado
       INSERT user_roles (admin)
       INSERT departments ('Geral') + projects ('Principal')
       INSERT funnels+stages seed (modelo por segmento) + quick_replies exemplo
       INSERT tenant_features (plano trial: tudo ligado, expires_at = trial_end)
     COMMIT                                            ← atômico: ou tenant inteiro ou nada
4. Stripe: create Customer (metadata.company_id) + Subscription trialing
     (assíncrono via stripe-webhook; falha aqui NÃO bloqueia o trial — reconcile job)
5. E-mail de boas-vindas + checklist in-app:
     [ ] conectar número WhatsApp (QR via Evolution — fluxo existente em Integracoes.tsx)
     [ ] convidar equipe (invite-member, valida seat limit do trial)
     [ ] importar contatos (CSV — lib existente em src/lib/csv)
6. Fim do trial → banner → Stripe Checkout → webhook ativa plano pago
```

Decisões:

- **Provisionamento atômico via edge com service role** (não via RPC chamada pelo usuário): elimina a classe de bugs de "tenant pela metade" que hoje exige self-healing no AuthContext (auto-recovery de 10s limpando storage — ARCHITECTURE.md §5.2, workaround que mascara causa raiz e some quando o bootstrap fica determinístico).
- **Seed por segmento** (clínica, imobiliária, ecommerce…): converte melhor que CRM vazio; seeds vivem em `supabase/seeds/templates/*.sql` versionados.
- **Subdomínio por tenant fica para fase posterior** (`empresa.app.crm.com`); no MVP o tenant é implícito pelo login (como hoje via `companyId` no AuthContext — ARCHITECTURE.md §5.2), o que já elimina qualquer seleção manual de empresa.

---

## 8. Observabilidade, auditoria e compliance

### 8.1 Erros e performance — Sentry

SPA Vite + React 18: SDK `@sentry/react` (fonte: docs Sentry para React — cobre exatamente "client-side React applications (SPAs) built with tools like Vite"):

- `Sentry.init` antes de qualquer import (`instrument.js`), com `browserTracingIntegration` + `replayIntegration` (Session Replay: 10% das sessões, 100% das sessões com erro — sampling recomendado na doc).
- **Source maps via wizard do Vite** (`npx @sentry/wizard@latest -i sourcemaps`) — sem isso stack traces são inúteis em produção.
- **Contexto multi-tenant:** `Sentry.setTag('tenant_id', companyId)` no AuthContext + `setUser({id})`. Todo erro passa a ser filtrável por cliente — essencial para suporte de N empresas.
- Cobre hoje: o ErrorBoundary existente (`src/components/shared/ErrorBoundary.tsx`) vira `Sentry.ErrorBoundary`; o auto-reload de 10s do AuthContext (ARCHITECTURE.md §5.2) passa a reportar ao Sentry antes de recarregar — transformando workaround em telemetria.
- Edge Functions: `Sentry.captureException` no wrapper `_shared` (Deno) com tenant no contexto.

### 8.2 Logs de plataforma — Supabase Logs + alertas

- **Logs Explorer** (fonte: Supabase Logging docs): fontes `postgres_logs`, `edge_logs`, `function_logs`, `auth_logs`, `realtime_logs` consultáveis em SQL; boas práticas da doc: filtrar por timestamp, uma fonte por vez, seguir request por âncora (request id) entre fontes.
- **Auth logs** respondem "quem logou, de onde" por tenant (campo `metadata.auth_event`).
- **Evolution API:** healthcheck já configurado no Railway (`infra-changes.md` §4); adicionar probe externo (ex.: cron → edge → GET `/` da Evolution a cada 5 min → alerta) e painel com contagem de instâncias `open/connecting/close` — o incidente documentado (130 instâncias mortas, 26 sessões perdidas por falta de volume) não pode se repetir sem alerta.
- **pgAudit** para DDL/writes administrativos (`alter role authenticator set pgaudit.log to 'write'` — receita oficial), com escopo estreito para não gerar ruído (aviso da própria doc).

### 8.3 Audit log de negócio por tenant

Requisito de venda B2B (e LGPD): "quem viu/alterou/apagou o quê". Tabela própria (não confundir com pgAudit, que é infra):

```sql
create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid not null,                       -- RLS: tenant lê o seu
  actor_id uuid,                                  -- profiles.id
  action text not null,                           -- contact.deleted, conversation.exported, campaign.sent…
  entity text, entity_id uuid,
  metadata jsonb,                                 -- antes/depois resumido, IP, UA
  created_at timestamptz not null default now()
);
-- populada por triggers nas ações sensíveis + chamadas explícitas nas edges
-- retenção: pg_cron apaga/particiona > 12 meses (parametrizável por plano)
```

### 8.4 LGPD

- **Papéis:** tenant = controlador dos dados dos contatos dele; bhub = operadora; Supabase/Stripe/Railway/Vercel = suboperadores (exigir DPAs; Supabase e Stripe publicam os seus).
- **Minimização em logs:** a doc de Logging do Supabase alerta explicitamente para **não logar PII** (ex.: em `User-Agent`); aplicar o mesmo no Sentry (`dataCollection: { userInfo: false, httpBodies: [] }` se necessário) e mascarar telefones em `console.log` de edges.
- **Direitos do titular:** exclusão de contato já tem soft-delete (`deleted_at/deleted_by` — ARCHITECTURE.md §5.1); adicionar job de **anonimização dura** (telefone → hash, mensagens → purga) após prazo legal; exportação por contato (titular) e por tenant (portabilidade, §5.4).
- **Branches sem dados de produção:** Supabase Branching é *data-less* por design (fonte: Branching docs) — staging/preview com seed sintético = ambiente de dev sem vazar dados de clientes. Hoje, sem branching, qualquer teste tende a acontecer contra produção.

### 8.5 Backups e continuidade

- Plano Pro: daily backups (7 dias de retenção); **habilitar PITR** (add-on, RPO ≤ 2 min via WAL-G, fonte: Database Backups docs) — o Production Checklist recomenda PITR quando o banco passa de 4 GB e exige compute ≥ Small.
- **Ressalva multi-tenant:** PITR restaura o banco inteiro — restore cirúrgico de um tenant exige playbook próprio (restaurar para projeto clone via *Restore to a new project*, extrair `WHERE company_id = …`). Documentar como runbook.
- Checklist de produção do Supabase (fonte: *Going into prod*) adotado integralmente como gate de lançamento: SSL enforcement, network restrictions, MFA nos owners da org, SMTP próprio (hoje e-mails de auth saem do remetente padrão — péssimo para marca de SaaS e sujeito ao rate limit de 2 e-mails/hora sem SMTP custom), CAPTCHA no signup, múltiplos owners na org.

---

## 9. Operação de schema

### 9.1 Baseline + schemas declarativos

O estado atual — **96 migrations em ~3 meses, >25 delas `fix_*`/`backfill_*`** (ARCHITECTURE.md §8 risco 6) — é o sintoma clássico de evolução sem convenção. Plano:

1. **Squash em baseline:** gerar `supabase db dump > supabase/schemas/prod.sql` (caminho oficial para adotar declarative schemas em projeto existente, fonte: *Declarative database schemas* docs), quebrar em arquivos por domínio (`schemas/tenancy.sql`, `schemas/inbox.sql`, `schemas/pipeline.sql`…) e colapsar as 96 migrations em **uma baseline** `00000000000000_baseline.sql`. Histórico preservado em `supabase/migrations_archive/`.
2. **Daí em diante, schema files são a fonte da verdade:** edita-se `supabase/schemas/*.sql` e gera-se migration com `supabase db diff -f nome_descritivo`. A doc avisa: mudanças feitas direto no Studio/SQL editor **não entram no diff** — disciplina de PR obrigatória.
3. **Caveats do diff** (documentados): DML não é capturado (seeds/backfills continuam sendo migrations manuais versionadas), `alter policy` e alguns grants têm edge cases — **toda migration gerada é revisada em PR**, e policies ficam em arquivo próprio (`schemas/rls.sql`) para revisão concentrada de segurança.

### 9.2 Ambientes com Supabase Branching

- **GitHub integration:** push em `main` faz deploy automático (migrations + edge functions) — fim do `supabase db push` manual de máquina local (recomendação explícita do Production Checklist).
- **Preview branch por PR** (efêmera, com seed) → teste de migration e de RLS antes de mergear; **branch persistente `staging`** para QA e demos de vendas.
- Pipeline de promotion: `PR → preview branch (CI roda pgTAP de RLS + Vitest) → merge → staging → tag → prod`.

### 9.3 Convenções (novas regras da casa)

- Nomes de policies: `<table>_tenant_select|insert|update|delete` ou `<table>_role_<ação>` — acaba o mosaico `*_company_all` × `Admins can …` (ARCHITECTURE.md §5.3).
- Proibido migration com prefixo `fix_`/`backfill_` sem ADR curto em `docs/adr/` (a casa já recomenda ADRs — ARCHITECTURE.md §9).
- Uma RPC `SECURITY DEFINER` nova = um ADR + teste pgTAP de isolamento (resposta estrutural ao risco 🔴1).
- `supabase db lint` + Security Advisor + Performance Advisor no CI (ambos apontados pelo Production Checklist).

---

## 10. Roadmap de migração

Partindo do estado atual (ARCHITECTURE.md) em fases incrementais, cada uma entregando valor e reversível:

### Fase 0 — Fundação de dados e RLS (2–3 semanas) — risco: MÉDIO
- Squash baseline + schemas declarativos + branching (staging + preview).
- Auditoria de índices em todas as colunas usadas por policies (`company_id` em 1º lugar); reescrita das ~180 policies no template §4.2 com `(select …)` e `to authenticated`.
- Unificação dos 3 helpers de company em `private.current_tenant_id()` (lendo `profiles` ainda, antes do JWT hook — mudança mecânica).
- Testes pgTAP de isolamento cross-tenant nas 10 tabelas mais sensíveis.
- **Riscos:** regressão silenciosa de permissão (mitigar com pgTAP comparando antes/depois e deploy em staging com tráfego espelhado manual); diff inicial grande.

### Fase 1 — Pipeline de mensagens server-side (2 semanas) — risco: MÉDIO
- Habilitar pgmq; criar `whatsapp_outbound` + worker edge + sweeper cron; unique em `external_message_id`.
- Rodar em **modo sombra** 1 semana (worker e browser enviam; worker só marca) → cortar o envio do browser.
- **Riscos:** dupla entrega na transição (mitigar com flag `sent_by` e dedup por `message_id`); Evolution instável afeta só a fila, não o Inbox (melhora de resiliência imediata).

### Fase 2 — Identidade SaaS (2–3 semanas) — risco: ALTO
- Custom Access Token Hook (`tenant_id`, `user_role` em `app_metadata`); remover fallback de role via `user_metadata` (vulnerabilidade, §4.1); expiração curta de JWT.
- `private.current_tenant_id()` passa a ler o JWT (troca de implementação, policies intactas).
- Edge `invite-member` + trigger `handle_new_user`; aposentar `ensure-user-role` e o auto-recovery de 10s do AuthContext.
- Realtime privado (`private: true` + policy em `realtime.messages`; desabilitar public access).
- **Riscos:** tokens antigos sem claim → política de "claim ausente = nega" exige re-login forçado coordenado (versionar pelo `CACHE_VERSION` já existente em AuthContext); hook lento degrada login (mitigar com índices e `stable`).

### Fase 3 — Billing e limites (3 semanas) — risco: MÉDIO
- Conta Stripe, catálogo (3 planos + add-on números), Checkout + Portal; edge `stripe-webhook` → `tenant_features`; `plan_limits` + enforcement nos 3 pontos (§5.3); `usage_counters` por trigger.
- **Riscos:** webhooks perdidos (mitigar com reconcile job diário lendo List Active Entitlements — a doc sugere exatamente isso para reconciliação); tenant legado sem plano → grandfathering automático em Enterprise-trial de 60 dias.

### Fase 4 — Self-service e operação (2 semanas) — risco: BAIXO
- `provision-tenant` + página pública de signup + trial de 14 dias; Sentry completo; audit_log; PITR; SMTP próprio; checklist de produção como gate.
- **Riscos:** seeds por segmento exigem curadoria de produto (risco de escopo, não técnico).

### Fase 5 — WhatsApp enterprise via Cloud API (3–4 semanas, opcional/por demanda) — risco: ALTO
- `integrations.provider_type`; provisionamento de instâncias Cloud API na Evolution (provider nativo da v2.x); templates Meta; repasse de custo por conversa no plano.
- **Riscos:** burocracia Meta (verificação de Business, aprovação de templates — semanas); mudança de UX (janela de 24h, templates obrigatórios); **validar manualmente a doc oficial da Meta antes de começar** (ver nota em §3).

**Fora do caminho crítico, em paralelo:** consolidar os dois modelos de funil (ARCHITECTURE.md §8 risco 5) e fatiar `services/api.ts` (risco 4) — dívidas de produto/manutenibilidade que não bloqueiam o SaaS, mas encarecem cada fase se ignoradas.

---

## 11. Referências

Fontes consultadas durante a pesquisa (22/07/2026):

**Supabase — isolamento, RLS e performance**
1. Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security
2. RLS Performance and Best Practices (GitHub Discussion #14576, com benchmarks) — https://github.com/orgs/supabase/discussions/14576
3. Realtime Authorization — https://supabase.com/docs/guides/realtime/authorization

**Supabase — Auth para SaaS**
4. Auth Hooks (visão geral e modelo de segurança) — https://supabase.com/docs/guides/auth/auth-hooks
5. Custom Access Token Hook — https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
6. SSO com SAML 2.0 (incl. FAQ multi-tenant SSO) — https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml
7. Multi-Factor Authentication (enforcement via RLS restrictive + `aal`) — https://supabase.com/docs/guides/auth/auth-mfa

**Supabase — filas, jobs e webhooks**
8. Supabase Queues (pgmq) — https://supabase.com/docs/guides/queues
9. Queues Quickstart (RLS em filas, `pgmq_public`) — https://supabase.com/docs/guides/queues/quickstart
10. Consuming Queue Messages with Edge Functions — https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions
11. Database Webhooks (pg_net) — https://supabase.com/docs/guides/database/webhooks
12. Cron (pg_cron) — https://supabase.com/docs/guides/cron

**Supabase — operação**
13. Declarative database schemas (`db diff`) — https://supabase.com/docs/guides/local-development/declarative-database-schemas
14. Branching (preview/persistent, pipeline de deploy, data-less) — https://supabase.com/docs/guides/deployment/branching
15. Production Checklist (security, rate limits, SMTP, PITR gate) — https://supabase.com/docs/guides/deployment/going-into-prod
16. Database Backups (daily + PITR, RPO 2 min, restore para novo projeto) — https://supabase.com/docs/guides/platform/backups
17. Logging / Logs Explorer (+ pgAudit, aviso sobre PII) — https://supabase.com/docs/guides/platform/logs

**Padrões multi-tenant**
18. Microsoft Learn — Multitenant SaaS database tenancy patterns (silo/bridge/pool, comparativo) — https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns

**Stripe — billing**
19. How subscriptions work (lifecycle, status, webhooks) — https://stripe.com/docs/billing/subscriptions/overview
20. Entitlements (features, `lookup_key`, webhook `active_entitlement_summary.updated`, recomendação de persistir localmente) — https://docs.stripe.com/billing/entitlements
21. Usage-based billing (⚠️ "Usage Records" legacy; Metronome recomendado para novas integrações) — https://docs.stripe.com/billing/subscriptions/usage-based

**WhatsApp**
22. Evolution API — README oficial (`evolution-foundation/evolution-api`): providers Baileys **e** WhatsApp Cloud API oficial, filas (RabbitMQ/SQS/Kafka), storage S3, release v2.3.7 — https://github.com/evolution-foundation/evolution-api
23. (Referência oficial da Meta — WhatsApp Business Platform/Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api — **não acessível ao fetch automatizado** (HTTP 400) durante a pesquisa; características validadas indiretamente via fonte 22. Validar manualmente antes da Fase 5.)

**Observabilidade**
24. Sentry para React (SPA/Vite, tracing, Session Replay, source maps, dataCollection/PII) — https://docs.sentry.io/platforms/javascript/guides/react/

**Fontes internas**
25. `docs/ARCHITECTURE.md` — estado atual (RLS, RPCs, realtime, riscos priorizados)
26. `infra-changes.md` — runbook Evolution API no Railway (incidente, volume, Redis, healthcheck)
27. `.env.example` — chaves Supabase atuais (anon key JWT legacy; migrar para `sb_publishable_`)

---

*Fim do documento. Revisar a cada fase concluída do roadmap (§10) e ao mudar qualquer decisão das seções 2–6.*
