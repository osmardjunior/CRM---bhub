
# Plano de Implementacao: Chat Center (Fase 1 -- Prioridade Essencial)

Dado o tamanho do escopo total (32+ funcionalidades faltantes), este plano cobre a **Fase 1** -- os 5 itens de maior impacto no atendimento diario. As fases seguintes serao planejadas apos a conclusao desta.

---

## Escopo da Fase 1

1. Envio de arquivos/imagens pelo compositor (botao de clipe)
2. Gravacao e envio de audio (botao de mic)
3. Respostas rapidas conectadas ao banco de dados
4. Filtros avancados funcionais na lista de conversas
5. Anotacoes internas (visiveis apenas para a equipe)

---

## 1. Envio de Arquivos e Imagens

**O que muda:** O botao de clipe no compositor passa a abrir um seletor de arquivos. O arquivo eh enviado para o storage, a URL eh salva na mensagem e enviada via WhatsApp.

**Detalhes tecnicos:**

- Criar storage bucket `chat-media` (publico, com RLS para insert/select por company)
- No `ChatPanel.tsx`, ao clicar no clipe:
  - Abrir `<input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" />`
  - Fazer upload para `chat-media/{company_id}/{conversation_id}/{filename}`
  - Inserir mensagem com `media_url` apontando para a URL publica do storage
  - Chamar `send-whatsapp` com `media_url` alem do `body`
- Atualizar `send-whatsapp/index.ts` para enviar midia (Evolution API: `sendMedia` endpoint; Meta: `image/document` type)
- Suportar drag-and-drop na area de mensagens (preview antes de enviar)

**Migracao SQL:**
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);

CREATE POLICY "Users can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');
```

---

## 2. Gravacao e Envio de Audio

**O que muda:** O botao de microfone inicia gravacao de audio. Ao soltar, mostra preview com opcao de enviar ou descartar.

**Detalhes tecnicos:**

- Usar `MediaRecorder` API do navegador
- Estados: `idle` -> `recording` -> `preview` -> `sending`
- No estado `recording`: mostrar timer e botao de parar/descartar
- No estado `preview`: player de audio inline + botoes enviar/descartar
- Audio gravado como `audio/ogg; codecs=opus` (compativel com WhatsApp)
- Upload para `chat-media` bucket, depois enviar como mensagem com `media_url`
- Criar componente `AudioRecorder.tsx` separado para manter o `ChatPanel` limpo

---

## 3. Respostas Rapidas do Banco de Dados

**O que muda:** O botao de raio (Zap) busca da tabela `quick_replies` em vez da lista fixa hardcoded.

**Detalhes tecnicos:**

- No `ChatPanel.tsx`:
  - Importar `useQuickReplies` (hook ja existe e funciona)
  - Substituir o array `quickReplies` fixo pela query do banco
  - Adicionar busca por atalho: digitar `/` no textarea filtra respostas rapidas em um popover inline (estilo autocomplete)
  - Exibir `shortcut` e `message` na lista de respostas
- Manter fallback para lista vazia ("Nenhuma resposta rapida cadastrada. Crie na pagina Respostas Rapidas.")

---

## 4. Filtros Avancados Funcionais

**O que muda:** Os filtros de nome, telefone, tag, usuario, status e ordenacao passam a funcionar de verdade no backend.

**Detalhes tecnicos:**

- Atualizar `ConversationFilters` em `api.ts` para incluir:
  - `name?: string` -- filtro por nome do contato (ilike)
  - `phone?: string` -- filtro por telefone (ilike)
  - `tag?: string` -- filtro por tag do contato
  - `assigned_user_id?: string` -- filtro por agente atribuido
  - `sort?: 'recent' | 'oldest' | 'name'` -- ordenacao
- Atualizar `listConversations()` para aplicar todos os filtros na query Supabase
- No `ConversationList.tsx`, conectar `handleApplyFilters` para enviar todos os filtros locais (nao apenas channel)
- Filtro de tag: buscar conversas onde o contato tem a tag selecionada (feito client-side apos query, pois tags sao JSONB no contato)

---

## 5. Anotacoes Internas

**O que muda:** Agentes podem escrever notas internas visiveis apenas para a equipe, sem enviar para o contato.

**Detalhes tecnicos:**

- **Nova tabela `annotations`:**
```sql
CREATE TABLE public.annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company annotations"
ON annotations FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company annotations"
ON annotations FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id());

ALTER PUBLICATION supabase_realtime ADD TABLE annotations;
```

- No `ChatPanel.tsx`:
  - Adicionar toggle "Mensagem / Anotacao" no compositor (botao ou switch)
  - Quando em modo anotacao, mudar cor do fundo do textarea para amarelo claro
  - Ao enviar anotacao: inserir na tabela `annotations` (NAO na tabela `messages`, NAO enviar via WhatsApp)
  - Buscar anotacoes junto com mensagens e intercalar por `created_at`
  - Renderizar anotacoes com fundo amarelo distinto e icone de cadeado, mostrando nome do autor

---

## Arquivos que serao modificados/criados

| Arquivo | Tipo | Mudanca |
|---|---|---|
| Migracao SQL | novo | Bucket storage + tabela annotations + RLS |
| `src/components/inbox/ChatPanel.tsx` | editar | Clipe funcional, audio recorder, respostas rapidas do banco, toggle anotacao |
| `src/components/inbox/AudioRecorder.tsx` | novo | Componente de gravacao de audio |
| `src/components/inbox/MessageBubble.tsx` | editar | Renderizar anotacoes com estilo diferenciado |
| `src/services/api.ts` | editar | Novos filtros em ConversationFilters + listConversations |
| `src/components/inbox/ConversationList.tsx` | editar | Aplicar todos os filtros no handleApplyFilters |
| `src/hooks/useConversations.ts` | editar | Buscar e intercalar anotacoes na query de detalhes |
| `src/hooks/useInboxRealtime.ts` | editar | Subscrever a tabela annotations para realtime |
| `supabase/functions/send-whatsapp/index.ts` | editar | Suportar envio de midia (imagem, documento, audio) |

---

## Ordem de implementacao

1. Migracao SQL (bucket + tabela annotations)
2. Filtros avancados (backend + frontend)
3. Respostas rapidas do banco
4. Envio de arquivos/imagens (upload + send-whatsapp media)
5. Gravacao de audio
6. Anotacoes internas

Essa ordem permite testar cada funcionalidade de forma independente conforme implementada.
