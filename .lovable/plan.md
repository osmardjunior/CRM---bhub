
# Plano: Corrigir funcionalidades do Inbox (midia, perfil, status, tags, atribuicao)

## Problemas identificados

1. **Mensagens de midia (audio, imagem, figurinha, video)** nao sao exibidas -- o chat so mostra texto
2. **Foto de perfil do contato** nao aparece no chat
3. **Nao e possivel alterar o status** da conversa (ex: Em Atendimento / Aguardando)
4. **Nao e possivel adicionar tags** ao contato via painel lateral
5. **Nao e possivel atribuir agente** -- o seletor nao tem handler de mudanca

---

## 1. Exibir mensagens de midia no chat

O campo `media_url` ja existe na tabela `messages` e o webhook ja salva URLs de midia. Porem o `ChatPanel.tsx` renderiza apenas `msg.body` como texto.

**Mudancas em `src/components/inbox/ChatPanel.tsx`:**
- Na renderizacao de cada mensagem, verificar `msg.media_url`
- Se existir, identificar o tipo de midia pela extensao/conteudo:
  - **Imagem** (jpg, png, webp, jpeg): exibir `<img>` clicavel
  - **Audio** (ogg, mp3, m4a, opus): exibir player `<audio>` nativo
  - **Video** (mp4, 3gp): exibir `<video>` com controles
  - **Sticker** (webp sem extensao longa): exibir como imagem menor sem fundo
  - **Documento**: exibir link para download
- Se `msg.body` tambem existir (caption), mostrar abaixo da midia

## 2. Foto de perfil do contato

A Evolution API envia o `profilePictureUrl` no webhook. Precisamos salvar e exibir.

**Mudancas:**
- **Tabela `contacts`**: Adicionar coluna `avatar_url` (text, nullable)
- **`supabase/functions/incoming-message/index.ts`**: Ao criar ou atualizar contato, buscar `profilePictureUrl` do payload da Evolution e salvar no `avatar_url`
- **`src/components/inbox/ConversationList.tsx`**: Usar `AvatarImage` com `contact.avatar_url` quando disponivel
- **`src/components/inbox/ChatPanel.tsx`**: Idem no header e nos baloes de mensagem
- **`src/components/inbox/ContactProfilePanel.tsx`**: Idem no perfil lateral

## 3. Alterar status da conversa (Em Atendimento / Aguardando)

Atualmente o dropdown so tem "Fechar conversa". Precisa permitir trocar entre `open` (Em Atendimento) e `pending` (Aguardando).

**Mudancas em `src/components/inbox/ChatPanel.tsx`:**
- Expandir o `DropdownMenu` no header para incluir opcoes:
  - "Em Atendimento" (status: open)
  - "Aguardando" (status: pending)
  - "Fechar conversa" (status: closed)
- Criar funcao `handleChangeStatus(newStatus)` que faz `supabase.from('conversations').update({ status }).eq('id', conversation.id)`
- Invalidar queries apos mudanca

## 4. Adicionar tags ao contato

O botao "+" na secao de tags do `ContactProfilePanel` nao tem funcionalidade.

**Mudancas em `src/components/inbox/ContactProfilePanel.tsx`:**
- Ao clicar no "+", abrir um popover/dialog com:
  - Lista de tags disponiveis (da tabela `tags`) com checkboxes
  - Tags ja aplicadas aparecem marcadas
- Ao marcar/desmarcar, chamar `updateContact(contact.id, { tags: [...] })` para salvar
- Permitir remover tags clicando no "X" de cada badge

## 5. Atribuir agente a conversa

O `Select` de agente no header do `ChatPanel` nao tem `onValueChange`, entao selecionar um agente nao faz nada.

**Mudancas em `src/components/inbox/ChatPanel.tsx`:**
- Adicionar `onValueChange` ao `Select` que:
  - Faz `supabase.from('conversations').update({ assigned_user_id: newUserId }).eq('id', conversation.id)`
  - Invalida queries `['conversation']` e `['conversations']`
  - Mostra toast de confirmacao
- Respeitar permissoes: agentes so podem atribuir a si mesmos, supervisores/admins podem atribuir a qualquer membro

---

## Detalhes tecnicos

### Migracao de banco de dados
```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avatar_url text;
```

### Arquivos modificados
| Arquivo | Mudanca |
|---|---|
| `src/components/inbox/ChatPanel.tsx` | Renderizar midia, alterar status, atribuir agente |
| `src/components/inbox/ContactProfilePanel.tsx` | Adicionar/remover tags, exibir avatar |
| `src/components/inbox/ConversationList.tsx` | Exibir avatar do contato |
| `supabase/functions/incoming-message/index.ts` | Salvar avatar_url e media_url |
| Migracao SQL | Adicionar coluna `avatar_url` em `contacts` |

### Fluxo de renderizacao de midia

Para cada mensagem com `media_url`:
1. Extrair extensao da URL
2. Mapear para tipo: image, audio, video, sticker, document
3. Renderizar componente apropriado dentro do balao de mensagem
4. Manter `msg.body` como legenda abaixo da midia (quando houver)
