
# Campanhas - Sistema de Acoes em Massa

## Visao Geral

Criar um modulo completo de **Campanhas** inspirado no Guru, onde o usuario pode configurar acoes automatizadas em massa sobre contatos/conversas do CRM. Cada campanha combina **filtros de contatos** + **dialogo/acao** + **agendamento**.

## O que o usuario vai poder fazer

### Lista de Campanhas
Uma tabela com todas as campanhas criadas, mostrando:
- Nome da campanha
- Status (badge colorido): Rascunho, Em Progresso, Concluida, Pausada
- Barra de progresso (% de contatos processados)
- Quantidade de recipientes
- Data de inicio e data de criacao
- Acoes rapidas (editar, pausar, excluir)
- Botao "Nova Campanha" no topo

### Criar/Editar Campanha (formulario em 3 secoes)

**1. INFORMACOES**
- Nome da campanha
- Descricao
- Data/hora de envio (agendar ou enviar agora)
- Horario para envio (janela de horario permitido)
- Prazo para finalizar envios
- Ignorar fins de semana (checkbox Sabado/Domingo)

**2. DIALOGO**
- Selecionar um fluxo de chatbot existente (dos `chatbot_flows`) para executar nos contatos
- Ou selecionar uma acao direta: Disparo de mensagem, Limpar chat (arquivar conversas fechadas), Delegar lead, Aplicar tag, Mover para funil

**3. CONTATOS (Filtros)**
Filtros avancados para segmentar quais contatos serao afetados:
- Inserir quem tiver estas Tags / Excluir quem tiver estas Tags
- Inserir quem tem conversa neste canal / Excluir por canal
- Cadastrado a partir de (data) / Cadastrado ate (data)
- Mais de X dias sem interagir / Menos de X dias sem interagir
- Mais de X dias sem receber mensagem / Menos de X dias sem receber
- Mais de X dias sem enviar mensagem / Menos de X dias sem enviar
- Etapa do Funil / Status de conversa
- Nome do responsavel
- Grupo/Departamento
- Delegacao: Delegar para usuario/departamento com opcoes de rodizio
- Preview dos contatos filtrados (contador e lista)

## Detalhes Tecnicos

### Nova tabela: campaigns

```text
campaigns
  id              UUID PK
  company_id      UUID NOT NULL
  name            TEXT NOT NULL
  description     TEXT DEFAULT ''
  status          TEXT DEFAULT 'draft' (draft, scheduled, running, paused, completed)
  action_type     TEXT NOT NULL (send_message, archive_chats, delegate, apply_tag, move_funnel, run_flow)
  action_config   JSONB DEFAULT '{}' (configuracao da acao: mensagem, flow_id, tag_ids, etc.)
  filters         JSONB DEFAULT '{}' (todos os filtros de segmentacao)
  schedule_at     TIMESTAMPTZ (quando iniciar)
  deadline_at     TIMESTAMPTZ (prazo para finalizar)
  skip_weekends   BOOLEAN DEFAULT false
  send_window     JSONB DEFAULT '{}' (horario permitido: {start: "08:00", end: "18:00"})
  total_contacts  INTEGER DEFAULT 0
  processed       INTEGER DEFAULT 0
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
```

RLS: mesmas policies das demais tabelas (company_id = get_user_company_id(), admin para insert/update/delete, todos podem ver).

### Arquivos que serao criados

1. **`supabase/migrations/xxx_campaigns.sql`** - Tabela campaigns com RLS e triggers
2. **`src/hooks/useCampaigns.ts`** - Hook com CRUD (listar, criar, atualizar, excluir, pausar/retomar)
3. **`src/pages/Campanhas.tsx`** - Pagina principal com lista de campanhas + formulario de criacao/edicao
4. **`src/components/campanhas/CampaignList.tsx`** - Tabela de campanhas com status, progresso e acoes
5. **`src/components/campanhas/CampaignForm.tsx`** - Formulario em 3 secoes (Informacoes, Dialogo, Contatos)
6. **`src/components/campanhas/CampaignFilters.tsx`** - Componente de filtros avancados de contatos

### Arquivos que serao modificados

1. **`src/App.tsx`** - Adicionar rota `/campanhas`
2. **`src/components/AppLayout.tsx`** - Ja tem o icone Megaphone importado; adicionar link na sidebar
3. **`src/integrations/supabase/types.ts`** - Atualizado automaticamente

### Fluxo da interface

1. Usuario acessa `/campanhas` e ve a lista de todas as campanhas
2. Clica em "Nova Campanha" e abre o formulario com 3 secoes
3. Preenche informacoes basicas (nome, descricao, agendamento)
4. Escolhe o tipo de acao (disparo de mensagem, limpar chat, delegar, etc.)
5. Configura os filtros para segmentar os contatos
6. Salva como rascunho ou agenda para execucao
7. Na lista, pode pausar, retomar ou excluir campanhas

### Integracao com dados existentes

- **Tags**: Usa `useTags()` para filtros de inclusao/exclusao por tag
- **Canais**: Usa os canais de conversa existentes (whatsapp, instagram, webchat)
- **Funis**: Usa `FunnelContext` para filtrar por etapa de funil
- **Equipe**: Usa `useTeamProfiles()` para filtros de responsavel e delegacao
- **Departamentos**: Usa `useDepartments()` para filtros por grupo
- **Fluxos de chatbot**: Usa `useChatbotFlows()` para selecionar dialogo a executar
