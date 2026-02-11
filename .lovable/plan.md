
# Limpeza e Ajustes Finais do CRM

## O que ainda esta ficticio/estatico

| Item | Onde | Problema |
|------|------|----------|
| Webhook URL hardcoded | Configuracoes.tsx | URL fake `api.allinsistemas.com/webhooks/...` |
| WhatsApp conexao fake | Configuracoes.tsx | `whatsappConnected` e estado local, nao salva nada |
| Convite de usuario | Configuracoes.tsx | Botao "Convidar" mostra toast "em breve" |
| Aba "Canais" inteira | Configuracoes.tsx | Instagram/Webchat marcados "Em breve", WhatsApp nao persiste |
| Sem aba de Tags | Configuracoes.tsx | Nao existe gerenciamento centralizado de tags |
| Sem aba de Integracoes | Configuracoes.tsx | Falta uma area para configurar integracao WhatsApp real |
| Notificacao (sino) | AppLayout.tsx | Botao existe mas nao faz nada |
| StatusBadge "mock" comentario | StatusBadge.tsx | Comentario "Legacy / mock statuses" - inofensivo |

---

## Plano de implementacao

### 1. Reestruturar abas de Configuracoes

Trocar as abas atuais (Empresa / Usuarios / Canais) por:

- **Empresa** - dados da empresa (ja funciona)
- **Usuarios e Permissoes** - equipe real (ja funciona, falta convite real)
- **Integracoes** - WhatsApp e futuros canais com persistencia no banco
- **Tags** - gerenciamento centralizado de tags usadas em contatos

### 2. Criar tabela `integrations` no banco

Tabela para salvar configuracoes de canais conectados:

```text
integrations
  id          uuid PK
  company_id  uuid FK -> companies
  channel     text (whatsapp, instagram, webchat)
  provider    text (meta, twilio, 360dialog)
  config      jsonb (token, phone_id, etc - dados sensiveis)
  status      text (connected, disconnected)
  created_at  timestamptz
  updated_at  timestamptz
```

Com RLS: somente admins da mesma empresa podem ler/escrever.

### 3. Criar tabela `tags` no banco

Tabela para tags centralizadas da empresa:

```text
tags
  id          uuid PK
  company_id  uuid FK -> companies
  name        text
  color       text (hex ou classe CSS)
  created_at  timestamptz
```

Com RLS: todos da empresa podem ler, admins podem criar/editar/deletar.

### 4. Aba Integracoes - conectar WhatsApp de verdade

- Carregar estado de conexao da tabela `integrations`
- Ao clicar "Conectar", salvar provider + token + phoneId no banco
- Gerar webhook URL real baseada no project ID
- Mostrar status real (conectado/desconectado)
- Botao "Desconectar" atualiza status no banco

### 5. Aba Tags - CRUD de tags

- Listar tags da empresa com nome e cor
- Botao "Nova tag" abre inline form (nome + seletor de cor)
- Editar/excluir tags existentes
- Atualizar selects de tags nos formularios de contatos para usar essas tags centralizadas

### 6. Convite real de usuario (edge function)

- Criar edge function `invite-user` que usa Supabase Admin API
- Recebe nome, email, role e company_id
- Cria usuario com `supabase.auth.admin.createUser()`
- Passa metadata (company_id, role, name) para o trigger `handle_new_user`
- Botao "Convidar" em Configuracoes chama essa function

### 7. Notificacao no sino

- Ao clicar no sino, abrir um dropdown com:
  - Tarefas atrasadas do usuario
  - Conversas nao lidas recentes
- Badge vermelho no sino = contagem real (ja parcialmente implementado com `stats.overdueTasks`)

---

## Detalhes tecnicos

### Migration SQL

Criacao das tabelas `integrations` e `tags` com RLS, triggers de `company_id` automatico, e `updated_at`.

### Edge Function `invite-user`

- Validacao de permissao (somente admin)
- Uso de `SUPABASE_SERVICE_ROLE_KEY` para criar usuario
- Retorna sucesso/erro para o frontend

### Hooks novos

- `useIntegrations()` - CRUD na tabela integrations
- `useTags()` - CRUD na tabela tags
- Refatorar `ContactDetailPanel` e `NewContactModal` para usar tags centralizadas

### Arquivos que serao alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/migrations/` | Nova migration com tabelas integrations + tags |
| `supabase/functions/invite-user/index.ts` | Nova edge function |
| `src/pages/Configuracoes.tsx` | Reestruturar abas, adicionar Integracoes e Tags |
| `src/hooks/useIntegrations.ts` | Novo hook |
| `src/hooks/useTags.ts` | Novo hook |
| `src/components/AppLayout.tsx` | Dropdown de notificacoes no sino |
| `src/components/contatos/ContactDetailPanel.tsx` | Usar tags centralizadas |
| `src/components/contatos/NewContactModal.tsx` | Usar tags centralizadas |
