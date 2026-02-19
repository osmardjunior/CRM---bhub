

# Redesign dos Relatorios - Estilo Guru

## Visao Geral

Transformar a pagina de Relatorios de um dashboard fixo com graficos pre-definidos para um **sistema de relatorios personalizaveis**, onde o usuario pode criar, salvar e visualizar relatorios com filtros avancados - igual ao Guru.

## O que o usuario vai poder fazer

### Menu lateral de tipos de relatorio
Uma sidebar dentro da pagina de relatorios com as categorias:
- **Chats** - Lista de conversas com filtros
- **Historico de Mensagens** - Historico detalhado por contato
- **Relatorios de Usuarios** - Performance dos agentes/usuarios
- **Relatorios Graficos** - Graficos e metricas visuais (o que ja existe hoje)
- **Contatos** - Lista filtrada de contatos do CRM

### Criar relatorio personalizado
Formulario com filtros avancados (igual ao PDF do Guru):

**Informacoes basicas:**
- Nome do relatorio

**Filtros por Tags:**
- Inserir quem tem estas Tags
- Excluir quem tem estas Tags

**Outras opcoes:**
- Esta Arquivado (sim/nao/indiferente)
- Possui Msg nao lida
- Status de Atendimento (aberto/fechado/indiferente)

**Filtros por delegacao:**
- Delegado ao usuario (selecionar usuarios)
- Delegado ao departamento (selecionar departamentos)

**Filtros por canal:**
- Aparelho/Canal (WhatsApp, Instagram, Webchat)

**Status do Bot:**
- Indiferente / Ativo / Inativo

**Etapa do Funil:**
- Selecionar funil e etapa

**Filtros de interacao e cadastro:**
- Cadastrado nos ultimos X dias
- Cadastrado a partir de / ate
- Interagiu nos ultimos X dias
- Mais de X dias sem interagir
- Dias sem receber mensagem
- Dias sem enviar mensagem

**Visualizacao:**
- Quem pode ter acesso ao relatorio
- Mostrar na Tela Inicial (toggle)

### Tabela de resultados
Apos aplicar os filtros, uma tabela paginada mostrando:
- Nome do contato
- WhatsApp/Telefone
- Data de cadastro
- Ultima mensagem
- Data da ultima mensagem
- Tags

Com paginacao no rodape (igual ao Guru).

### Relatorios salvos
Lista de relatorios salvos pelo usuario para acesso rapido.

## Detalhes Tecnicos

### Nova tabela: saved_reports

```text
saved_reports
  id              UUID PK
  company_id      UUID NOT NULL
  created_by      UUID NOT NULL (user que criou)
  name            TEXT NOT NULL
  report_type     TEXT NOT NULL (chats, messages, users, charts, contacts)
  filters         JSONB DEFAULT '{}'
  show_on_home    BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
```

RLS: usuarios da mesma empresa podem ver; apenas o criador ou admin pode editar/excluir.

### Arquivos que serao criados

1. **`supabase/migrations/xxx_saved_reports.sql`** - Tabela saved_reports com RLS
2. **`src/hooks/useReportBuilder.ts`** - Hook para salvar/listar relatorios + queries dinamicas de filtros
3. **`src/components/relatorios/ReportSidebar.tsx`** - Menu lateral com categorias de relatorio
4. **`src/components/relatorios/ReportFilters.tsx`** - Formulario de filtros avancados (tags, datas, delegacao, etc.)
5. **`src/components/relatorios/ReportResults.tsx`** - Tabela de resultados com paginacao
6. **`src/components/relatorios/SavedReportsList.tsx`** - Lista de relatorios salvos

### Arquivos que serao modificados

1. **`src/pages/Relatorios.tsx`** - Refatorado: layout 2 colunas (sidebar de tipos + area principal com filtros/resultados). Os graficos atuais serao movidos para a categoria "Relatorios Graficos"
2. **`src/hooks/useReports.ts`** - Manter hooks existentes, usados na aba "Relatorios Graficos"
3. **`src/integrations/supabase/types.ts`** - Atualizado automaticamente

### Estrutura do layout

```text
+------------------+----------------------------------------+
| Sidebar          | Area Principal                         |
|                  |                                        |
| > Chats          | [Nome do Relatorio]                    |
| > Historico Msgs |                                        |
| > Rel. Usuarios  | +-- FILTROS --------------------------+|
| > Rel. Graficos  | | Tags: [+] [-]                       ||
| > Contatos       | | Status: [select]                    ||
|                  | | Delegado a: [select]                ||
| --- Salvos ---   | | Departamento: [select]              ||
| Meu Relatorio 1  | | Canal: [select]                     ||
| Meu Relatorio 2  | | Funil: [select]                     ||
|                  | | Cadastro: de [date] ate [date]      ||
|                  | | Interacao: X dias                   ||
|                  | +------------------------------------+|
|                  |                                        |
|                  | [Ver Relatorio] [Salvar Relatorio]      |
|                  |                                        |
|                  | +-- RESULTADOS -----------------------+|
|                  | | Nome | WhatsApp | Cadastro | ...    ||
|                  | | ...  | ...      | ...      | ...    ||
|                  | +------------------------------------+|
|                  | Paginacao: < 1 2 3 4 5 >               |
+------------------+----------------------------------------+
```

### Integracao com dados existentes

- **Tags**: `useTags()` para filtros de inclusao/exclusao
- **Equipe**: `useTeamProfiles()` para filtro de delegacao por usuario
- **Departamentos**: `useDepartments()` para filtro por departamento
- **Funis**: `FunnelContext` para filtro por etapa de funil
- **Contatos**: Query direta na tabela `contacts` com filtros dinamicos
- **Conversas**: Query na tabela `conversations` + `messages` para historico
- **Graficos existentes**: Os hooks `useAgentMetrics`, `usePipelineConversion`, `useNPSSummary` continuam sendo usados na aba "Relatorios Graficos"

### Queries dinamicas de filtros

O hook `useReportBuilder` vai construir queries Supabase dinamicamente com base nos filtros selecionados. Exemplo para o tipo "Chats":

- Base: `supabase.from('conversations').select('*, contact:contacts(*)')`
- Filtro por tag: join com contacts.tags JSONB
- Filtro por status: `.eq('status', 'open')`
- Filtro por delegacao: `.eq('assigned_user_id', userId)`
- Filtro por canal: `.eq('channel', 'whatsapp')`
- Filtro por data: `.gte('created_at', dateFrom).lte('created_at', dateTo)`
- Paginacao: `.range(offset, offset + pageSize - 1)`

