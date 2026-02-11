

# Plano Completo: Funcionalidades MVP Faltantes

Este plano cobre 5 grandes funcionalidades que completam o CRM como MVP de producao.

---

## 1. NPS / Pesquisa de Satisfacao

### O que sera feito
Ao encerrar uma conversa, o sistema envia automaticamente uma pesquisa de satisfacao (nota 1-5 + comentario opcional). O contato responde via WhatsApp e a nota e armazenada.

### Banco de dados
Nova tabela `satisfaction_surveys`:

```text
satisfaction_surveys
  id              uuid PK
  company_id      uuid FK -> companies
  conversation_id uuid FK -> conversations
  contact_id      uuid FK -> contacts
  assigned_user_id uuid FK -> profiles (agente que atendeu)
  score           integer (1 a 5)
  comment         text (nullable)
  sent_at         timestamptz
  answered_at     timestamptz (nullable)
  created_at      timestamptz
```

RLS: mesma empresa pode ler; insercao via service role (edge function).

### Logica
- Ao fechar conversa (status -> closed), um trigger ou chamada no frontend dispara o envio da pesquisa via edge function `send-satisfaction-survey`
- A edge function envia uma mensagem WhatsApp perguntando a nota (usa a mesma API configurada em `integrations`)
- Quando o contato responde com um numero 1-5, o webhook `incoming-message` detecta que ha uma pesquisa pendente e registra o score
- Dashboard exibe NPS calculado: % promotores (4-5) - % detratores (1-2)

### Arquivos novos
- `supabase/functions/send-satisfaction-survey/index.ts`
- `src/hooks/useSatisfaction.ts`

### Arquivos alterados
- `supabase/functions/incoming-message/index.ts` -- detectar resposta de pesquisa
- `src/pages/Dashboard.tsx` -- card de NPS
- `src/services/api.ts` -- funcao closeConversation dispara pesquisa

---

## 2. Relatorios com Metricas de Performance

### O que sera feito
Nova pagina `/relatorios` com:
- **Tempo medio de primeira resposta** por agente (diferenca entre mensagem do usuario e primeira resposta do agente)
- **Tempo medio de resolucao** (abertura ate fechamento da conversa)
- **Conversas atendidas por agente** (bar chart)
- **NPS por agente** (quando implementado)
- **Taxa de conversao do pipeline** (ganho / total)
- Filtro por periodo (7d, 30d, 90d, custom)

### Banco de dados
Nao necessita novas tabelas. Os calculos serao feitos via queries agregadas nas tabelas existentes (`messages`, `conversations`, `deals`, `satisfaction_surveys`).

Uma database function `get_agent_metrics(date_from, date_to)` sera criada para calcular:
- first_response_time por conversa
- resolution_time por conversa
- contagem por agente

### Arquivos novos
- `src/pages/Relatorios.tsx` -- pagina com graficos recharts
- `src/hooks/useReports.ts` -- hook com queries agregadas

### Arquivos alterados
- `src/App.tsx` -- rota `/relatorios`
- `src/components/AppLayout.tsx` -- item no menu (icone BarChart3)

---

## 3. Envio Real de Mensagens WhatsApp via API

### O que sera feito
Quando o agente envia uma mensagem no Inbox, alem de salvar no banco, o sistema chama a API do provedor (Meta/Twilio/360dialog) para entregar a mensagem ao contato.

### Edge Function `send-whatsapp`
- Recebe: `conversation_id`, `body`, `company_id`
- Busca a integracao ativa da empresa na tabela `integrations`
- Identifica o provedor e chama a API correspondente:
  - **Meta Cloud API**: POST `https://graph.facebook.com/v21.0/{phone_id}/messages`
  - **Twilio**: POST `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`
  - **360dialog**: POST `https://waba.360dialog.io/v1/messages`
- Retorna sucesso/erro

### Fluxo no frontend
1. Agente digita mensagem e clica "Enviar"
2. `sendMessage()` em `api.ts` salva no banco (ja funciona)
3. Apos salvar, chama a edge function `send-whatsapp` para entrega real
4. Se falhar na API externa, mostra toast de erro mas mantem a mensagem salva

### Arquivos novos
- `supabase/functions/send-whatsapp/index.ts`

### Arquivos alterados
- `src/services/api.ts` -- `sendMessage()` chama edge function apos insert
- `supabase/config.toml` -- registrar nova function

---

## 4. Importacao / Exportacao de Contatos CSV

### Importacao
- Botao "Importar CSV" na pagina de Contatos
- Modal com drag-and-drop de arquivo CSV
- Parse no frontend com `FileReader` + split por linhas
- Mapeamento de colunas (nome, telefone, email, origem, tags)
- Preview dos primeiros 5 registros antes de confirmar
- Insercao em lote via `supabase.from('contacts').insert([...])`

### Exportacao
- Botao "Exportar CSV" na pagina de Contatos
- Gera CSV no frontend com os contatos filtrados atuais
- Download automatico via `Blob` + `URL.createObjectURL`

### Arquivos novos
- `src/components/contatos/ImportContactsModal.tsx`
- `src/lib/csv.ts` -- funcoes parseCSV / generateCSV

### Arquivos alterados
- `src/pages/Contatos.tsx` -- botoes Importar/Exportar na toolbar

---

## 5. Paginacao nas Listas

### O que sera feito
Adicionar paginacao server-side em Contatos e Conversas (as duas listas que podem crescer bastante).

### Contatos
- Query com `.range(from, to)` no Supabase (paginacao offset)
- 25 registros por pagina
- Componente de paginacao no rodape da tabela (usando `src/components/ui/pagination.tsx` ja existente)
- Contagem total com `{ count: 'exact', head: true }`

### Conversas (Inbox)
- Scroll infinito na lista lateral (mais natural para chat)
- Carrega 20 conversas iniciais
- Ao chegar no final da lista, carrega mais 20

### Arquivos alterados
- `src/services/api.ts` -- `listContacts` e `listConversations` com parametros `page`/`limit`
- `src/hooks/useContacts.ts` -- estado de paginacao
- `src/pages/Contatos.tsx` -- componente Pagination no rodape
- `src/hooks/useConversations.ts` -- useInfiniteQuery para scroll infinito
- `src/components/inbox/ConversationList.tsx` -- detectar scroll ao fundo

---

## Resumo de Mudancas

### Novas tabelas (migration)
| Tabela | Descricao |
|--------|-----------|
| `satisfaction_surveys` | Pesquisas NPS vinculadas a conversas |

### Database function (migration)
| Funcao | Descricao |
|--------|-----------|
| `get_agent_metrics(date_from, date_to)` | Retorna metricas agregadas por agente |

### Novas edge functions
| Funcao | Descricao |
|--------|-----------|
| `send-whatsapp` | Envia mensagem real via API do provedor |
| `send-satisfaction-survey` | Envia pesquisa NPS ao encerrar conversa |

### Novos arquivos frontend
| Arquivo | Descricao |
|---------|-----------|
| `src/pages/Relatorios.tsx` | Pagina de relatorios com graficos |
| `src/hooks/useReports.ts` | Hook para queries de metricas |
| `src/hooks/useSatisfaction.ts` | Hook para pesquisas NPS |
| `src/components/contatos/ImportContactsModal.tsx` | Modal de importacao CSV |
| `src/lib/csv.ts` | Utilitarios de parse/generate CSV |

### Arquivos alterados
| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Rota `/relatorios` |
| `src/components/AppLayout.tsx` | Item "Relatorios" no menu |
| `src/pages/Dashboard.tsx` | Card de NPS |
| `src/pages/Contatos.tsx` | Paginacao + botoes CSV |
| `src/services/api.ts` | Paginacao, envio WhatsApp real, pesquisa NPS |
| `src/hooks/useContacts.ts` | Paginacao server-side |
| `src/hooks/useConversations.ts` | useInfiniteQuery |
| `src/components/inbox/ConversationList.tsx` | Scroll infinito |
| `supabase/functions/incoming-message/index.ts` | Detectar resposta de pesquisa NPS |
| `supabase/config.toml` | Registrar novas functions |

### Ordem de implementacao
1. Paginacao (base para performance)
2. Envio real WhatsApp (funcionalidade core)
3. NPS / Pesquisa de satisfacao (depende do envio WhatsApp)
4. Relatorios (depende de dados reais + NPS)
5. Import/Export CSV (independente, pode ser paralelo)

