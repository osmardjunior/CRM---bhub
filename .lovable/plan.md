
# Proximos Passos - Dar vida ao CRM

## Diagnostico atual

| Area | Status | Problema |
|------|--------|----------|
| Inbox | OK | Funcionando com backend |
| Contatos | OK | Funcionando com backend |
| Pipeline | OK | Funcionando com backend |
| Tarefas | OK | Funcionando com backend |
| Configuracoes - Usuarios | Mock | Tabela usa dados fake, convite nao funciona |
| Configuracoes - Empresa | Mock | Dados nao salvam no banco |
| Sidebar badges | Mock | Usa numeros fixos do arquivo mock |
| Busca global | Morto | Input existe mas nao faz nada |
| Notificacoes (sino) | Morto | Botao existe mas nao faz nada |
| Troca de empresa | Mock | Dropdown com empresas fake |
| Perfil do usuario (Meu Perfil) | Morto | Menu item nao leva a nenhuma pagina |

---

## Plano de implementacao (por prioridade)

### 1. Configuracoes - Usuarios reais do backend
Substituir `mockUsers` por dados reais da tabela `profiles` + `user_roles`. Listar membros da equipe com nome, email, role e status vindos do banco.

### 2. Configuracoes - Salvar dados da empresa
Conectar o formulario de empresa a tabela `companies`. Carregar dados atuais e salvar ao clicar "Salvar".

### 3. Sidebar com contadores reais
Substituir os badges estaticos (`stats.openConversations`, `stats.overdueTasks`) por queries reais:
- Inbox badge = count de conversas com status 'open'
- Tarefas badge = count de tarefas atrasadas do usuario logado

### 4. Busca global funcional
Fazer o input de busca no header buscar em contatos, conversas e deals, mostrando resultados em um dropdown com navegacao.

### 5. Pagina "Meu Perfil"
Criar uma pagina simples onde o usuario pode editar seu nome e ver informacoes da conta.

### 6. Remover dados mock
Limpar o arquivo `src/data/mock.ts` e todas as referencias restantes.

### 7. Dashboard / Home
Criar uma pagina inicial com cards de metricas reais (total conversas abertas, deals no pipeline, tarefas pendentes, etc.) usando dados do banco.

---

## Detalhes tecnicos

### Etapa 1 - Usuarios reais em Configuracoes
- Criar hook `useTeamProfiles()` que faz join de `profiles` com `user_roles`
- Substituir `mockUsers` pelo resultado da query
- Botao "Convidar" - criar edge function `invite-user` que usa Supabase Admin API para criar usuario e enviar email

### Etapa 2 - Empresa
- Criar hook `useCompany()` com query na tabela `companies`
- Criar mutation `useUpdateCompany()` para salvar
- Adicionar RLS policy de UPDATE para admins na tabela `companies`

### Etapa 3 - Sidebar badges
- Criar hook `useSidebarStats()` com duas queries:
  - `SELECT count(*) FROM conversations WHERE status = 'open'`
  - `SELECT count(*) FROM tasks WHERE status != 'concluida' AND due_date < now() AND assigned_user_id = auth.uid()`
- Passar valores reais para o componente AppLayout
- Remover import de `stats` do mock

### Etapa 4 - Busca global
- Criar componente `GlobalSearchCommand` usando `cmdk` (ja instalado)
- Buscar em paralelo: contatos, conversas (via contact name), deals
- Ao clicar no resultado, navegar para a pagina correspondente

### Etapa 5 - Meu Perfil
- Criar pagina `src/pages/MeuPerfil.tsx`
- Formulario com nome, email (readonly), avatar
- Mutation para atualizar `profiles`

### Etapa 6 - Limpar mocks
- Deletar `src/data/mock.ts`
- Remover todas as importacoes restantes

### Etapa 7 - Dashboard
- Criar pagina `src/pages/Dashboard.tsx`
- Cards com metricas: conversas abertas, deals por stage, tarefas pendentes/atrasadas, valor total pipeline
- Graficos simples usando recharts (ja instalado)
- Redirecionar `/` para `/dashboard` ao inves de `/inbox`

---

## Ordem sugerida de execucao

Recomendo implementar na ordem acima (1 a 7), pois cada etapa eh independente e voce pode testar antes de seguir para a proxima.

Posso comecar por qualquer uma. Quer que eu faca tudo de uma vez ou etapa por etapa?
