

# Plano de Correções e Implementações em Blocos

Vou organizar tudo em blocos priorizados por impacto no uso diario. Cada bloco sera implementado, testado e validado antes de passar ao proximo.

---

## Bloco 1 -- Funil Funcional (Contatos no Kanban)

**Problema atual:** O Kanban do funil nao conecta contatos reais. As colunas ficam vazias, sem como vincular clientes a etapas. A tabela `contact_funnel_stages` existe no banco mas nao e usada no frontend.

**O que sera feito:**
- Carregar contatos vinculados a cada etapa do funil via `contact_funnel_stages`
- Mostrar cards de contato reais nas colunas do Kanban (nome, telefone, tags)
- Botao "Adicionar Chats" abre um seletor de contatos para vincular a etapa
- Drag-and-drop entre colunas para mover contato de etapa
- Remover contato de uma etapa

---

## Bloco 2 -- Tags no Perfil do Contato (Correcao)

**Problema atual:** As tags estao sendo salvas no campo JSON `contacts.tags` (texto livre), mas o sistema tem a tabela relacional `contact_tags` + `tags`. A UI de tags no painel de perfil precisa usar a tabela correta.

**O que sera feito:**
- Migrar a logica de tags do `ContactProfilePanel` para usar `contact_tags` (insert/delete na tabela de juncao)
- Exibir tags com cores reais da tabela `tags`
- Garantir que adicionar/remover tag funcione corretamente

---

## Bloco 3 -- Acoes Rapidas Simplificadas (Estilo Guru)

**Problema atual:** As acoes rapidas no perfil do contato mostram "Tarefa" e "Negocio", que sao conceitos complexos demais para o uso rapido. No Guru, as acoes rapidas sao: Delegar, Arquivar, Favoritar, Ativar/Desativar Chatbot, Mover no Funil.

**O que sera feito:**
- Substituir botoes "Tarefa" e "Negocio" por acoes praticas:
  - **Delegar** -- select de agente para atribuir a conversa
  - **Arquivar** -- toggle `is_archived` no contato
  - **Favoritar** -- toggle `is_favorite` no contato (estrela)
  - **Chatbot On/Off** -- toggle `chatbot_enabled`
  - **Mover no Funil** -- select de funil + etapa para posicionar o contato
- "Fechar conversa" permanece como esta

---

## Bloco 4 -- Painel Direito com Abas de Historico

**Problema atual:** O painel direito so mostra informacoes basicas. Faltam as abas de historico que existem no Guru.

**O que sera feito:**
- Adicionar sistema de abas no `ContactProfilePanel`:
  - **Dados** -- informacoes do contato (ja existe)
  - **Atendimento** -- historico de `attendance_history`
  - **Anotacoes** -- lista de `annotations` da conversa
  - **Funil** -- posicao atual em funis via `contact_funnel_stages`
  - **Delegacoes** -- historico de `delegation_history`
  - **NPS** -- pesquisas de `satisfaction_surveys`

---

## Bloco 5 -- Paginas Faltantes na Sidebar

**Problema atual:** Rotas `/nps`, `/arquivos`, `/modulos`, `/suporte` existem na sidebar mas nao tem pagina implementada.

**O que sera feito:**
- **/nps** -- painel com pesquisas de satisfacao (lista + media + graficos)
- **/arquivos** -- galeria de midias enviadas/recebidas do storage `chat-media`
- **/modulos** -- pagina de configuracao de modulos ativos
- **/suporte** -- pagina simples com informacoes de contato/ajuda

---

## Bloco 6 -- Melhorias de Chat (Emoji, Reply, Busca)

**O que sera feito:**
- Emoji picker no input de mensagem
- Reply/quote -- clicar em mensagem para responder com referencia
- Busca global de mensagens
- Notificacoes sonoras (toggle no header usando `soundEnabled` do chatStore)

---

## Detalhes Tecnicos

### Bloco 1 (Funil)
- Criar hook `useContactFunnelStages` com queries em `contact_funnel_stages` JOIN `contacts`
- Atualizar `FunnelKanban.tsx` para consumir dados reais
- Usar `@hello-pangea/dnd` (ja instalado) para drag-and-drop entre colunas
- Modal de selecao de contatos com busca

### Bloco 2 (Tags)
- `ContactProfilePanel`: substituir `updateContact(id, { tags })` por `insert/delete` em `contact_tags`
- Query: `contact_tags` JOIN `tags` para exibir cor e nome

### Bloco 3 (Acoes Rapidas)
- Usar `updateContact(id, { is_archived, is_favorite, chatbot_enabled })`
- Delegar: `update conversations set assigned_user_id`
- Mover funil: `upsert contact_funnel_stages`

### Bloco 4 (Abas)
- Componente `Tabs` do Radix UI (ja instalado)
- Queries individuais por aba (lazy loading)

### Bloco 5 (Paginas)
- Criar 4 novos arquivos em `src/pages/`
- Adicionar rotas em `App.tsx`
- Hooks de dados correspondentes

### Bloco 6 (Chat)
- Instalar `emoji-mart` ou usar emoji picker nativo
- Estado de reply no `chatStore`
- Busca via query fulltext em `messages.body`

---

## Ordem de Execucao

Cada bloco sera implementado sequencialmente. Apos cada bloco, voce testa e confirma antes de seguir para o proximo.

1. Bloco 1 (Funil) -- impacto direto no fluxo de vendas
2. Bloco 2 (Tags) -- correcao de bug existente
3. Bloco 3 (Acoes rapidas) -- usabilidade diaria
4. Bloco 4 (Abas historico) -- visibilidade de dados
5. Bloco 5 (Paginas) -- completude do sistema
6. Bloco 6 (Chat) -- melhorias de experiencia

