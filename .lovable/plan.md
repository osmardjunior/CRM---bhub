

# Correções de Filtros do Inbox + Agendamento de Mensagens

## Problemas Identificados

1. **Chats Overview mostra conversas fechadas e em atendimento misturadas** -- A pagina `/chats` (ChatsOverview) nao passa filtro de status inicial, entao carrega todas as conversas sem distinção.

2. **Filtro "Não Lidas" redundante** -- Existe um botão "Não Lidas" fixo acima da lista que deve ser removido, pois essa opção já existe dentro do painel de filtros avançados.

3. **Ícones de filtro rápido desnecessários** -- Os ícones de E-mail (Mail), Monitor (Webchat) e Wi-Fi (WhatsApp) devem ser removidos. Manter apenas Estrela (Favoritos) e Relógio (Agendados).

4. **Filtros avançados não funcionam** -- O problema principal: os filtros `name`, `phone` e `tag` são aplicados no lado do cliente DEPOIS da paginação. Se a query do banco traz 20 resultados e nenhum coincide, a lista fica vazia. Além disso, o status local do filtro avançado não é passado corretamente ao `onFilterChange`.

5. **Sem funcionalidade de agendamento de mensagens** -- Não existe no sistema a capacidade de agendar uma mensagem para ser enviada num horário futuro.

---

## Plano de Implementação

### Tarefa 1: Corrigir ChatsOverview para filtrar apenas conversas abertas

- Na pagina `ChatsOverview.tsx`, inicializar o estado `filters` com `{ status: 'open' }` para que a lista à esquerda mostre apenas conversas abertas por padrão (assim como faz o Inbox).

### Tarefa 2: Remover filtro rápido "Não Lidas" e ícones desnecessários

No arquivo `ConversationList.tsx`:
- Remover o estado `onlyUnread` e o bloco de quick filter "Não Lidas" (linhas 354-365).
- Remover a lógica `if (onlyUnread ...)` do `useMemo` de filtragem.
- No array `channelIcons`, remover os itens `email` (Mail), `webchat` (Monitor) e `whatsapp` (Wifi).
- Manter apenas `star` (Star/Favoritos) e `pending` (Clock/Agendados).
- Remover imports não utilizados (Mail, Monitor, Wifi).

### Tarefa 3: Corrigir filtros avançados

No arquivo `ConversationList.tsx`:
- Na função `handleApplyFilters`, incluir o `localStatus` no objeto `newFilters` quando selecionado (atualmente é ignorado).
- Na função `handleClearFilters`, resetar o status para o padrão.

No arquivo `src/services/api.ts` (função `listConversations`):
- Mover os filtros `name` e `phone` para serem aplicados via query do banco (usando `.ilike` ou `.like`) ao invés de filtrar no cliente após a paginação. Isso resolve o problema de aplicar filtros em apenas 20 resultados por vez.
- Para `tag`, como é um campo JSON/array no contato, manter client-side mas aumentar o limite temporário da query quando filtros client-side estão ativos.

### Tarefa 4: Agendamento de mensagens

**Banco de Dados** -- Criar tabela `scheduled_messages`:
- `id` (uuid, PK)
- `company_id` (uuid, FK)
- `conversation_id` (uuid, FK)
- `sender_id` (uuid, FK para profiles)
- `body` (text)
- `media_url` (text, nullable)
- `scheduled_at` (timestamptz) -- quando enviar
- `status` (text: 'pending', 'sent', 'cancelled', default 'pending')
- `created_at` (timestamptz)
- RLS: usuários da mesma empresa podem ler/criar/atualizar

**Frontend** -- No `ChatPanel.tsx`:
- Adicionar um botão de relógio ao lado do botão de enviar.
- Ao clicar, abrir um popover com seletor de data/hora.
- Ao confirmar, inserir na tabela `scheduled_messages` ao invés de enviar imediatamente.
- Mostrar toast de confirmação com o horário agendado.

**Backend** -- Criar edge function `process-scheduled-messages`:
- Consultar mensagens com `status = 'pending'` e `scheduled_at <= now()`.
- Para cada uma, inserir na tabela `messages` e chamar `send-whatsapp`.
- Atualizar status para `sent`.
- Configurar um cron job (pg_cron) para executar a cada minuto.

### Tarefa 5: Corrigir erro de build em Arquivos.tsx

- Corrigir o erro de TypeScript em `src/pages/Arquivos.tsx` linha 54 adicionando `as unknown as StorageFile[]` para a conversão de tipo.

---

## Detalhes Técnicos

### Estrutura da tabela scheduled_messages

```text
scheduled_messages
+------------------+------------------+
| column           | type             |
+------------------+------------------+
| id               | uuid (PK)        |
| company_id       | uuid (FK)        |
| conversation_id  | uuid (FK)        |
| sender_id        | uuid (FK)        |
| body             | text             |
| media_url        | text (nullable)  |
| scheduled_at     | timestamptz      |
| status           | text (default    |
|                  | 'pending')       |
| created_at       | timestamptz      |
+------------------+------------------+
```

### Arquivos que serao modificados
- `src/components/inbox/ConversationList.tsx` -- remover filtros redundantes, corrigir aplicação de filtros
- `src/services/api.ts` -- mover filtros para query do banco
- `src/pages/ChatsOverview.tsx` -- filtro inicial de status
- `src/components/inbox/ChatPanel.tsx` -- UI de agendamento
- `src/pages/Arquivos.tsx` -- fix build error
- `supabase/functions/process-scheduled-messages/index.ts` -- nova edge function
- Nova migração SQL para tabela e cron job

