

# Melhorias Visuais: Chats Individuais vs Grupos

## Problemas Identificados

1. **Mensagens em grupo mostram apenas um remetente** -- O `MessageBubble` exibe o nome do contato da conversa para todas as mensagens recebidas, sem diferenciar os participantes do grupo. Todas as mensagens parecem ser da mesma pessoa.

2. **Avatares genericos** -- Na lista de conversas e no header do chat, grupos mostram apenas um icone `Users` generico e individuais mostram a primeira letra do nome. Nao ha diferenciacao visual profissional.

3. **Formatacao geral precisa de polimento** -- Espacamentos, tamanhos e hierarquia visual precisam de refinamento para um look profissional.

---

## O que sera feito

### 1. MessageBubble -- Suporte a multiplos remetentes em grupo

- Detectar se a conversa e grupo (via `isGroupChat`)
- Passar flag `isGroup` para o `MessageBubble`
- Em grupos, mostrar nome do remetente com cor unica por participante (hash do nome para cor)
- Mostrar mini-avatar ao lado de cada mensagem em grupo com inicial do remetente
- Agrupar mensagens consecutivas do mesmo remetente (sem repetir nome/avatar)

### 2. Avatares profissionais na lista de conversas

- **Grupos**: icone estilizado com gradiente e icone de grupo (silhuetas sobrepostas), borda diferenciada
- **Individuais**: avatar com gradiente baseado no nome, inicial centralizada com fonte bold
- Se `avatar_url` existir no contato, usar a imagem real
- Adicionar indicador visual de status online (bolinha verde) quando aplicavel
- Badge de contagem de participantes nos grupos

### 3. Header do ChatPanel melhorado

- Avatar maior e mais destacado no header
- Para grupos: mostrar contagem de membros abaixo do nome
- Para individuais: mostrar telefone formatado e status
- Tipografia mais clara com hierarquia nome > subtitulo

### 4. Formatacao geral refinada

- Bolhas de mensagem com sombras mais suaves
- Espacamento entre mensagens ajustado
- Timestamps mais discretos
- Transicoes suaves ao hover
- Cores diferenciadas para remetentes em grupo

---

## Detalhes Tecnicos

### Arquivos modificados

1. **`src/components/inbox/MessageBubble.tsx`**
   - Adicionar prop `isGroup: boolean`
   - Gerar cor unica por remetente usando hash do `sender_name`
   - Mostrar avatar inline para cada remetente diferente em grupo
   - Agrupar mensagens consecutivas do mesmo remetente

2. **`src/components/inbox/ConversationList.tsx`**
   - Criar componente `ConversationAvatar` com visual profissional
   - Grupos: icone com fundo gradiente, badge de membros
   - Individuais: avatar com inicial estilizada ou foto real
   - Melhorar layout do item da lista (espacamento, tipografia)

3. **`src/components/inbox/ChatPanel.tsx`**
   - Passar `isGroup` flag para cada `MessageBubble`
   - Melhorar header com avatar maior e info contextual
   - Para grupos: exibir "X participantes" como subtitulo

4. **`src/components/inbox/ContactProfilePanel.tsx`**
   - Avatar no perfil consistente com o novo design

### Funcao de cor por remetente (hash)

Sera criada uma funcao `getColorForName(name: string)` que retorna uma cor HSL consistente para cada nome, garantindo que cada participante de grupo tenha uma cor unica e reconhecivel.

### Sem mudancas no banco de dados

Todas as alteracoes sao puramente visuais/frontend. Os dados de `sender_name`, `sender_id`, e `avatar_url` ja existem nas mensagens e contatos.

