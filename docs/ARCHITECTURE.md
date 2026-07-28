# Arquitetura — ALL-IN CRM (bhub)

> Documento de arquitetura do projeto. Gerado por análise estática do código em **22/07/2026**.
> Fontes lidas: `GUIA-DO-CRM.md`, `infra-changes.md`, `src/App.tsx`, `src/main.tsx`, `src/pages/*`, `src/services/*`, `src/hooks/*`, `src/contexts/*`, `src/store/*`, `src/integrations/supabase/client.ts`, `src/components/AppLayout.tsx` e árvores de `src/components/*`, `supabase/migrations/*` (96 migrations) e `supabase/functions/*` (18 edge functions), `package.json`, `vite.config.ts`, `vercel.json`.

---

## 1. Visão geral da arquitetura

O ALL-IN CRM é um **SPA (Single Page Application) client-heavy** com backend serverless:

```
┌────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Vite + React 18 + TS) — hospedado na Vercel             │
│                                                                    │
│  Pages (rotas) → Components (domínio + ui/shadcn)                  │
│       │                                                            │
│       ├─ React Query (server state, cache, optimistic updates)     │
│       ├─ Contexts (Auth, Project, Funnel, Theme)                   │
│       └─ Zustand chatStore (estado de UI do Inbox)                 │
│       │                                                            │
│  Services (api.ts / deals.ts / tasks.ts) — acesso a dados          │
└───────┬───────────────────────────┬────────────────────────────────┘
        │ supabase-js (REST/RPC/Realtime/Auth)
        ▼                           ▼
┌───────────────────────┐   ┌─────────────────────────────────────────┐
│ SUPABASE Postgres     │   │ SUPABASE Edge Functions (Deno, 18 fns)  │
│ - 40+ tabelas         │   │ - incoming-message (webhook WhatsApp)   │
│ - RLS (180 policies)  │◄──│ - send-whatsapp, execute-campaign       │
│ - RPCs SECURITY DEF.  │   │ - chatbot-process, ai-*, evolution-api  │
│ - Triggers + pg_cron  │   └──────────────┬──────────────────────────┘
│ - Realtime (postgres_changes)            │ HTTPS
└───────────────────────┘                  ▼
                            ┌──────────────────────────────┐
                            │ Evolution API v2.3.7 (Railway)│
                            │ WhatsApp via Baileys + Redis  │
                            └──────────────────────────────┘
```

**Responsabilidade por camada:**

| Camada | Onde vive | Responsabilidade |
|---|---|---|
| Apresentação | `src/pages/*`, `src/components/*` | Renderização, interação, layout |
| Estado de servidor | React Query (`useQuery`/`useMutation` em `src/hooks/*`) | Cache, sincronização, optimistic updates |
| Estado de cliente | Contexts + `src/store/chatStore.ts` | Sessão, projeto ativo, filtros de UI |
| Acesso a dados | `src/services/*` + chamadas `supabase.from()` diretas | Queries, mutations, RPCs |
| Backend | `supabase/migrations`, `supabase/functions` | Persistência, autorização (RLS), integrações, jobs |

**Decisão arquitetural central:** o frontend fala **diretamente com o Postgres** via PostgREST/RLS — não há API intermediária própria. A segurança é delegada ao RLS e a RPCs `SECURITY DEFINER`. As Edge Functions atuam apenas como **pontes de integração** (webhook WhatsApp, envio, campanhas, IA) e não como camada de API de negócio.

---

## 2. Mapa da estrutura de diretórios (atual)

```
CRM---bhub/
├── src/
│   ├── main.tsx                     # bootstrap mínimo (render <App/>)
│   ├── App.tsx                      # providers, rotas, RoleGuard, QueryClient
│   ├── pages/                       # 27 páginas (3 órfãs: Tarefas, Negocios, ChatsOverview)
│   │   └── configuracoes/constants.ts
│   ├── components/
│   │   ├── ui/                      # shadcn-ui (Radix) — kit base, não editar à mão
│   │   ├── AppLayout.tsx            # shell: sidebar, topbar, navegação por papel
│   │   ├── ProtectedRoute.tsx       # guard de autenticação
│   │   ├── inbox/                   # ChatPanel (1482 LOC), ConversationList (801), …
│   │   ├── chatbot/                 # FlowEditor (781), FlowList (642), … (@xyflow/react)
│   │   ├── pipeline/ campanhas/ contatos/ dashboard/ integracoes/
│   │   ├── relatorios/ tarefas/ configuracoes/ ai/
│   │   └── shared/                  # ErrorBoundary, PageHeader, TagChips, EmptyState…
│   ├── contexts/
│   │   ├── AuthContext.tsx          # sessão, profile, role, companyId + auto-recovery
│   │   ├── ProjectContext.tsx       # projeto ativo (sessionStorage)
│   │   ├── FunnelContext.tsx        # funis/etapas — faz queries DIRETAS ao Supabase
│   │   └── ThemeContext.tsx
│   ├── hooks/                       # 30 hooks — wrapper React Query por domínio
│   │   ├── useConversations.ts      # lista infinita, detalhe, envio c/ optimistic update
│   │   ├── useInboxRealtime.ts      # canal realtime único por empresa + reconexão
│   │   ├── usePermissions.ts        # papel + custom_permissions (JSONB)
│   │   └── … (contacts, tags, campaigns, chatbot, reports, dashboard…)
│   ├── services/
│   │   ├── api.ts                   # ⚠ 871 LOC — god-service (conversations, contacts,
│   │   │                            #   annotations, reads, team, WhatsApp send)
│   │   ├── deals.ts                 # CRUD de deals (kanban CRM)
│   │   └── tasks.ts                 # CRUD de tarefas (sem página roteada)
│   ├── store/chatStore.ts           # Zustand: filtros do Inbox, painéis, som
│   ├── integrations/supabase/
│   │   ├── client.ts                # singleton supabase-js (env VITE_*)
│   │   └── types.ts                 # tipos gerados do schema (1975 LOC)
│   ├── lib/                         # areaFilter, csv, exportReport, colors, utils
│   ├── utils/whatsapp.ts            # normalização de telefone (+ teste)
│   └── test/                        # setup + example.test.ts (quase vazio)
├── supabase/
│   ├── migrations/                  # 96 migrations (fev/2026 → mai/2026)
│   └── functions/                   # 18 edge functions Deno (~6,3k LOC)
│       └── _shared/                 # código compartilhado entre functions
├── GUIA-DO-CRM.md                   # manual do usuário (feature set oficial)
├── infra-changes.md                 # runbook da Evolution API no Railway
├── vercel.json                      # SPA rewrite + cache immutable de /assets
└── deploy-vps.cjs                   # script alternativo de deploy
```

**Observações estruturais:**

- **Bug ativo em `src/App.tsx` (linhas 98–100):** `<ProjectProvider>` está **duplicado/aninhado duas vezes**. Cada instância mantém seu próprio `projectId` em estado interno; componentes consomem o provider mais interno, enquanto o externo fica órfão. Correção trivial (remover um), mas sintoma de falta de revisão estrutural do arquivo de composição.
- `src/services/` cobre só 3 domínios; o restante acessa o Supabase direto de hooks/contexts/páginas — fronteira de dados inconsistente (ver §6).
- `src/pages/Tarefas.tsx`, `Negocios.tsx` e `ChatsOverview.tsx` **não estão registradas em nenhuma rota** do `App.tsx` nem no menu (`AppLayout.tsx`), embora `GUIA-DO-CRM.md` documente "Tarefas" como feature oficial.

---

## 3. Domínios de negócio e relacionamentos

Hierarquia organizacional (multi-tenant):

```
companies (tenant raiz)
 └── departments (ex.: Vendas, Suporte)
      └── projects (camada intermediária, desde 2026-03-01)
           ├── integrations (números WhatsApp / canais)
           ├── conversations → messages
           ├── tags, quick_replies, funnels, chatbot_flows
           └── user_projects (agentes habilitados por projeto)
```

| Domínio | Página(s) | Tabelas principais | Dependências |
|---|---|---|---|
| **Inbox / Atendimento** | `Inbox.tsx` | `conversations`, `messages`, `conversation_reads`, `annotations`, `message_reactions`, `delegation_logs`, `scheduled_messages` | contacts, integrations, projects, profiles |
| **Contatos** | `Contatos.tsx` | `contacts`, `contact_tags`, `contact_assignees`, `custom_field_*` | tags, conversations |
| **Pipeline / Funil** ⚠ | `Pipeline.tsx`, `FunnelKanban.tsx` | **dois modelos paralelos**: (a) `funnels`, `funnel_stages`, `contact_funnel_stages`; (b) `pipelines`, `stages`, `deals`, `activities`, `meetings`, `reminders` | contacts, departments |
| **Chatbot** | `Chatbot.tsx` | `chatbot_flows`, `chatbot_nodes` + edge `chatbot-process` | conversations (trigger por keyword/status) |
| **Campanhas** | `Campanhas.tsx` | `campaigns`, `send_rate_log` + edge `execute-campaign` (pg_cron) | contacts, tags, integrations |
| **Dashboard** | `Dashboard.tsx` | views/RPCs: `get_agent_metrics`, `get_sidebar_unread_count`, `screen_time` | todos os domínios de atendimento |
| **Relatórios** | `Relatorios.tsx` | `saved_reports`, `attendance_history`, `conversation_events` | conversations, funnels, tags |
| **NPS** | `NPS.tsx` | `satisfaction_surveys` + edge `send-satisfaction-survey` | conversations, chatbot (nó NPS) |
| **Integrações (WhatsApp)** | `Integracoes.tsx`, `Folder*.tsx` | `integrations`, `departments`, `projects`, `user_projects` | Evolution API externa |
| **IA** | drawer no Inbox + relatórios | `ai_interactions`, `ai_reports`, `ai_automation_suggestions` + edges `ai-*` | conversations, messages |
| **Tarefas** ⚠ | sem rota (`Tarefas.tsx` órfã) | `tasks` (CRUD completo em `services/tasks.ts` + `hooks/useTasks.ts`) | contacts, deals |
| **Configurações** | `Configuracoes.tsx`, `Modulos.tsx`, `MeuPerfil.tsx` | `profiles`, `user_roles`, `departments`, `companies`, `company_files` | auth |

**Relações-chave:** `contacts` é o hub — conversas, deals, tarefas e `contact_funnel_stages` pendem dele. `conversations` liga contato ↔ integração (número) ↔ projeto ↔ agente. O **Fluxo NPS** atravessa três domínios: conversa vira `resolved` → `chatbot-process` dispara nó NPS → `send-satisfaction-survey` → resposta registrada em `satisfaction_surveys` → lida na página NPS.

---

## 4. Fluxo de dados

### 4.1 Leitura (padrão dominante)

```
Supabase (RLS filtra por company_id)
  → services/api.ts (ou supabase.from() direto no hook/página)
    → hook React Query (queryKey por domínio, staleTime 15–30s)
      → Context (só p/ auth/projeto) ou consumo direto na página
        → componentes
```

Exemplo real (`Inbox.tsx`): `useInfiniteConversations(filters)` → `listConversations()` → `supabase.from('conversations').select(...)` com joins em `contacts`/`profiles`. O hook injeta automaticamente `assigned_user_id = user.id` para agents (`useConversations.ts:34-40`).

### 4.2 Escrita com optimistic update (melhor padrão do codebase)

`useSendMessage` (`useConversations.ts:73-192`):
1. `onMutate`: insere mensagem `optimistic-*` no cache React Query;
2. `mutationFn`: `sendMessage()` grava no DB (fire-and-forget de auto-move/auto-assign);
3. `sendViaWhatsApp()` invoca edge `send-whatsapp` (best-effort, nunca lança);
4. `onSuccess`: atualiza `delivery_status`/`external_message_id` e invalida caches; `onError`: rollback + toast.

### 4.3 Realtime (tempo real)

`useInboxRealtime.ts` mantém **um canal único por empresa** (`inbox-rt-{companyId}`) assinando `postgres_changes` em `messages`, `conversations` e `annotations`:
- INSERT na conversa aberta → escrita cirúrgica no cache (latência < 50ms, sem refetch);
- eventos em outras conversas → invalidação com debounce (200–300ms);
- `selectedConversationId` via `ref` para **não recriar o canal** ao trocar de conversa;
- reconexão automática (3s) + recuperação em `visibilitychange`;
- fallback: polling de 30s quando o canal não está `SUBSCRIBED` (`useConversations.ts:51`).

### 4.4 Mensagens inbound (caminho externo)

```
WhatsApp → Evolution API (Railway) → webhook Edge incoming-message
  (verificação HMAC-SHA256 opcional, normalização de telefone,
   upsert contact/conversation, insert message, trigger chatbot-process)
    → Supabase Realtime → tela do agente (< 1s ponta a ponta)
```

### 4.5 Jobs agendados

`pg_cron` invoca via net/http as edges `invoke_execute_campaigns` e `invoke_process_scheduled_messages` (migrations `20260224210000_cron_scheduled_messages.sql`, `20260225300000_campaigns_cron.sql`) — campanhas e mensagens agendadas rodam **sem o frontend**.

---

## 5. Modelo de dados e segurança

### 5.1 Tabelas principais (conforme `supabase/migrations` e `types.ts`)

- **Tenant/identidade:** `companies`, `profiles` (espelha `auth.users`, guarda `custom_permissions` JSONB, `spy_mode`, `allowed_integration_ids`), `user_roles` (enum `app_role`: admin/supervisor/agent), `profile_departments` (+`role_in_department`), `departments`, `projects`, `user_projects`.
- **Atendimento:** `contacts`, `conversations` (status: open/pending/closed + new/resolved; `archived_at`, `department_id`, `project_id`, `integration_id`, `last_message_preview`), `messages` (reply, soft-delete `deleted_at/deleted_by`, `delivery_status`, `edited_at`), `conversation_reads`, `annotations`, `message_reactions`, `scheduled_messages`, `conversation_events`, `attendance_history`, `delegation_*`, `screen_time`.
- **Vendas:** `funnels`/`funnel_stages`/`contact_funnel_stages` **e** `pipelines`/`stages`/`deals`/`activities`/`meetings`/`reminders` (duplicidade — ver §8).
- **Automação:** `chatbot_flows`, `chatbot_nodes`, `campaigns`, `quick_replies`, `send_rate_log`.
- **Outros:** `tags`/`contact_tags`, `satisfaction_surveys`, `integrations`, `ai_*`, `tasks`, `company_files`, `saved_reports`, `custom_field_*`.

### 5.2 Autenticação

- Supabase Auth com sessão em `localStorage` (`client.ts:11-16`); **SSO** do portal ALL-IN absorvendo tokens pelo hash da URL (`AuthContext.tsx:99-110`).
- `AuthContext` carrega `profiles` + `user_roles` em paralelo, bloqueia `is_active=false`, tem fallback de role via `user_metadata` com self-healing via edge `ensure-user-role`, e **auto-recovery: se `loading` travar por 10s, limpa storage e recarrega a página** (`AuthContext.tsx:43-58`) — workaround agressivo que mascara causa raiz.
- Versionamento manual de cache do cliente (`CACHE_VERSION` em `AuthContext.tsx:9-19`).

### 5.3 Autorização (defesa em três níveis)

1. **RLS no Postgres** (≈180 policies; `has_role()` e `get_user_company_id()` como `SECURITY DEFINER` para evitar recursão) — isolamento por `company_id`, refinado por departamento (`20260227000000_department_isolation.sql`) e projeto (`user_projects`).
2. **Guards de rota** no frontend: `ProtectedRoute` + `RoleGuard` (papel OU permissão granular) em `App.tsx:49-62`.
3. **Permissões granulares** por usuário: `profiles.custom_permissions` JSONB, consultadas por `usePermissions().can(key)` (ex.: `tags_view`, `campaigns_create`, `reports_*`). Admin sempre passa.

**Ressalvas:** existem RPCs `SECURITY DEFINER` que **contornam RLS de propósito** (`get_funnel_contact_ids`, `get_unread_conversation_ids`, `get_sidebar_unread_count`, `get_agent_metrics`, `swap_funnel_stage_positions`) — cada uma é um ponto que precisa validar company/role internamente. Há **três helpers equivalentes** para company do usuário (`get_user_company_id`, `get_my_company_id`, `current_company_id`) e policies heterogêneas (`*_company_all` vs. dezenas de `Admins can …`), sinal de evolução sem convenção fixa.

---

## 6. Padrões e convenções vigentes

**O que é consistente (manter):**
- **Path alias `@/`** para todos os imports (`vite.config.ts`).
- **Query keys por domínio** (`['conversations-infinite']`, `['conversation', id]`, `['unread-counts']`, `['sidebar-stats']`) e invalidação cruzada disciplinada.
- **Lazy loading de páginas** não críticas em `App.tsx` (code splitting por rota).
- **Tipos do DB gerados** (`integrations/supabase/types.ts`) consumidos via `Tables<>/TablesInsert<>/TablesUpdate<>`.
- Erros de serviço normalizados via `ApiError` + mapa de mensagens amigáveis por código Postgres (`services/api.ts:44-66`).
- Comentários explicando *o porquê* de decisões não óbvias (ex.: ref estável do realtime, fallback de RPCs).

**Inconsistências encontradas:**

| # | Inconsistência | Evidência |
|---|---|---|
| 1 | **Camada de serviço parcial**: só 3 arquivos em `services/`; `FunnelContext` faz queries e toasts direto (context virou service); vários hooks/páginas chamam `supabase.from()` sem passar por service | `contexts/FunnelContext.tsx:46-99`, `hooks/useTags.ts`, `hooks/useProjects.ts` |
| 2 | **Dois gerenciadores de server-state**: React Query (dominante) × estado manual com `fetch/refetch` em Context | `FunnelContext.tsx` reimplementa cache/refetch que o React Query já daria |
| 3 | **Dois modelos de funil concorrentes** (funnels/contact_funnel_stages × pipelines/stages/deals) | migrations `20260211…` vs. `20260318100000_kanban_crm_tables.sql`; `services/deals.ts` × `contexts/FunnelContext.tsx` |
| 4 | **Tags em dupla fonte**: `contacts.tags` JSONB (legado) × `contact_tags` normalizado — lidos em paralelo | `services/api.ts:481,530-543` |
| 5 | **Páginas órfãs** sem rota/menu: `Tarefas.tsx`, `Negocios.tsx`, `ChatsOverview.tsx` (Tarefas consta no manual do usuário!) | `App.tsx` vs. `GUIA-DO-CRM.md` §9 |
| 6 | **Casts inseguros** `as unknown as X` e `@ts-expect-error` recorrentes | `api.ts:552`, `useInboxRealtime.ts:103` (5×) |
| 7 | **Componentes-página gigantes** com regras de negócio dentro | `ChatPanel.tsx` (1482), `ConversationList.tsx` (801), `ContactProfilePanel.tsx` (796), `FlowEditor.tsx` (781) |
| 8 | **Sentinels mágicos** de filtro (`'__none__'`) espalhados | `api.ts:199-202,261` |
| 9 | Queries em cascata sequenciais (tag → contact_tags → contacts → messages) no filtro do Inbox | `api.ts:279-335` (até 4 roundtrips por busca) |

---

## 7. Estrutura alvo recomendada

Evoluir para **arquitetura por features (vertical slices)**, preservando o que funciona (React Query + services tipados + RLS). Migração incremental, sem big-bang:

```
src/
├── app/                          # composição: App.tsx, providers, router, guards
├── shared/
│   ├── ui/                       # shadcn (atual components/ui)
│   ├── components/               # ErrorBoundary, PageHeader, EmptyState…
│   ├── contexts/                 # Auth, Theme (globais de verdade)
│   ├── lib/  hooks/  store/      # utilitários e stores cross-feature
│   └── api/
│       ├── client.ts             # supabase singleton (move de integrations/)
│       ├── types.ts              # types gerado
│       └── errors.ts             # ApiError + handleError (extrair de api.ts)
└── features/
    ├── inbox/
    │   ├── components/  hooks/   # ChatPanel, ConversationList… (fatiar os >800 LOC)
    │   ├── api.ts                # queries/mutations de conversations+messages+reads
    │   └── realtime.ts           # canal + typing indicator
    ├── contacts/        { components, hooks, api.ts }
    ├── pipeline/                 # UM modelo só (consolidar funnels × pipelines)
    ├── chatbot/  campaigns/  reports/  nps/  integrations/
    ├── tasks/                    # reintegrar rota OU remover de vez
    ├── ai/  dashboard/  settings/
    └── auth/                     # Login, Cadastro, guards de role
```

**Refactors incrementais (ordem segura):**
1. Remover o `<ProjectProvider>` duplicado (`App.tsx:100`) — bug de 1 linha.
2. Fatiar `services/api.ts` em `features/*/api.ts` por domínio (manter re-exports temporários para não quebrar imports).
3. Converter `FunnelContext` em hooks React Query (`useFunnels`, `useFunnelMutations`) dentro de `features/pipeline` — elimina o segundo mecanismo de server-state.
4. Proibir `supabase.from()` fora de `features/*/api.ts` (regra de lint `no-restricted-imports`).
5. Fatiar `ChatPanel`/`ConversationList`/`ContactProfilePanel` em subcomponentes com estado local; extrair regras (status flow, delegação, mídia) para hooks.
6. Consolidar o modelo de funil (decisão de produto: kanban CRM `deals` **ou** `contact_funnel_stages`) e migrar dados do perdedor.
7. Resolver páginas órfãs: rotear `/tarefas` (feature documentada) e deletar `Negocios`/`ChatsOverview` ou reintegrá-las.
8. Normalizar helpers SQL (`get_user_company_id` único) e convenção de nomes de policies.

---

## 8. Riscos arquiteturais e dívidas técnicas (priorizados)

| P | Risco / Dívida | Impacto | Esforço |
|---|---|---|---|
| 🔴 1 | **Amostra de RLS bypass crescendo**: RPCs `SECURITY DEFINER` multiplicam-se a cada fix (`get_unread_*`, `get_funnel_*`, `get_agent_metrics`…). Cada uma é revisão de segurança manual; erro = vazamento cross-tenant | Alto (segurança/multi-tenant) | Médio |
| 🔴 2 | **Lógica de entrega de mensagem depende do cliente**: `sendMessage` grava no DB e a entrega WhatsApp é best-effort do browser; se a aba fechar entre os passos, a mensagem fica salva e nunca enviada (`delivery_status` atualizado via cliente) | Alto (perda silenciosa de mensagens) | Médio → mover p/ edge/DB webhook |
| 🔴 3 | **`App.tsx` com provider duplicado + composição frágil**; AuthContext com auto-reload de 10s escondendo falhas de bootstrap | Alto (bugs intermitentes de estado/sessão) | Baixo |
| 🟠 4 | **God-files**: `api.ts` (871) e componentes de 800–1500 LOC concentram regras de vários domínios — dificultam teste, review e mudança paralela | Alto (manutenibilidade) | Alto (incremental) |
| 🟠 5 | **Modelo de funil duplicado** (`funnels` × `pipelines/deals`) e tags em dupla fonte (JSONB × normalizado) | Médio-alto (divergência de dados) | Alto (decisão + migração) |
| 🟠 6 | **Schema evoluído por remendo**: 96 migrations em ~3 meses, >25 delas `fix_*`/`backfill_*`; 3 helpers de company; policies heterogêneas | Médio (risco de regressão em RLS) | Médio |
| 🟡 7 | **Filtros do Inbox com N roundtrips sequenciais** por busca (tag→ids→contacts→messages) e sort client-side | Médio (latência percebida) | Médio (mover p/ RPC única) |
| 🟡 8 | **Cobertura de testes quase nula** (`example.test.ts`, `whatsapp.test.ts`); Playwright instalado sem specs | Médio (refactors inseguros) | Contínuo |
| 🟡 9 | **Páginas órfãs** (Tarefas/Negocios/ChatsOverview) — código morto ou feature perdida; manual diverge do app | Baixo-médio | Baixo |
| 🟡 10 | **Acoplamento direto frontend↔PostgREST** (sem contrato de API versionado): qualquer rename de coluna quebra o cliente em runtime; casts `as unknown as` escondem drift de tipos | Médio (evolução) | Contínuo |

---

## 9. Próximos passos recomendados (roadmap curto)

**Sprint 1 — Estabilização (baixo risco, alto retorno):**
1. Corrigir `ProjectProvider` duplicado e tipar o realtime (remover `@ts-expect-error`).
2. Decidir destino de `Tarefas` (rotear) e deletar páginas mortas.
3. Adicionar lint rule proibindo `supabase.from()` fora de `services|features/*/api.ts`.
4. Testes de fumaça (Vitest) para `api.ts` e guards de permissão.

**Sprint 2 — Fronteira de dados:**
5. Fatiar `api.ts` por domínio com re-exports de compatibilidade.
6. Converter `FunnelContext` para React Query; padronizar query keys.
7. Mover filtros de busca do Inbox para RPC única (1 roundtrip).

**Sprint 3 — Consolidação:**
8. Decisão de produto sobre funil único + plano de migração de dados.
9. Mover entrega WhatsApp para fluxo server-side (edge consome fila/tabela `messages` com `delivery_status=pending`), eliminando a janela de perda no cliente.
10. Auditoria das RPCs `SECURITY DEFINER` + unificação dos helpers de company; documentar contratos em `docs/`.

**Contínuo:** fatiar god-components ao tocar cada feature; ADRs curtos em `docs/adr/` para decisões como a consolidação do funil.

---

*Fim do documento. Manter atualizado a cada mudança estrutural significativa (novas camadas, consolidação de funil, mudança de backend).*
