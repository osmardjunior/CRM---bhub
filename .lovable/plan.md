

# Correcoes: Duplicatas, JIDs Invalidos, fromMe e Build Errors

## Resumo dos Problemas

1. **Contatos duplicados** (ex: duas "Auto Escola Super Positiva" com mesmo telefone `553192356412`) -- condicao de corrida no webhook cria contato duplicado
2. **Contato "Davi" com telefone invalido** (`192526690594951` e `86539514179772`) -- JIDs de status broadcast ou newsletter sendo criados como contatos
3. **Mensagens duplicadas** -- mensagem enviada pelo CRM nao tem `external_message_id`, quando volta pelo webhook com `fromMe=true` passa pela checagem de idempotencia e cria duplicata
4. **Erros de build** no chatbot -- o enum `chatbot_node_type` no banco tem 9 valores, mas o `types.ts` gerado espera 12 (faltam `close_chat`, `delay`, `webhook`)

---

## Plano de Implementacao

### 1. Filtrar JIDs invalidos no webhook

**Arquivo:** `supabase/functions/incoming-message/index.ts`

Adicionar verificacao apos o parse do payload Evolution para ignorar:
- Status broadcasts (`status@broadcast`)
- Newsletters (`newsletter` no JID)
- Telefones com mais de 15 digitos (nao sao numeros reais)
- Telefones vazios

```text
// Logo apos extrair from_phone (linha ~244), antes da validacao:
const digits = from_phone.replace(/\D/g, '');
if (digits.length > 15 || digits.length < 8 || from_phone.includes('status') || from_phone.includes('newsletter')) {
  return { ok: true, skipped: true, reason: 'invalid_jid' };
}
```

### 2. Deduplicar mensagens fromMe

**Arquivo:** `supabase/functions/incoming-message/index.ts`

Apos a checagem de idempotencia por `external_message_id` (linha ~345), adicionar segunda verificacao para `fromMe`:

```text
if (from_me) {
  const recentCutoff = new Date(Date.now() - 60000).toISOString();
  const { data: recentMatch } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('body', messageBody)
    .eq('sender_type', 'agent')
    .gte('created_at', recentCutoff)
    .limit(1)
    .maybeSingle();
  
  if (recentMatch) {
    // Atualizar external_message_id na mensagem existente e pular insercao
    await supabase.from('messages')
      .update({ external_message_id })
      .eq('id', recentMatch.id);
    return { ok: true, deduplicated: true };
  }
}
```

Nota: esta verificacao precisa acontecer DEPOIS de encontrar/criar a conversa, pois precisa do `conversation.id`.

### 3. Prevenir contatos duplicados (UNIQUE constraint + upsert)

**Migracao SQL:**

Primeiro mesclar duplicatas existentes, depois adicionar constraint:

```text
-- Mesclar contatos duplicados: mover conversas para o contato mais antigo
WITH duplicates AS (
  SELECT company_id, phone,
    array_agg(id ORDER BY created_at ASC) AS ids
  FROM contacts
  WHERE phone IS NOT NULL
  GROUP BY company_id, phone
  HAVING count(*) > 1
)
UPDATE conversations c
SET contact_id = d.ids[1]
FROM duplicates d
WHERE c.contact_id = ANY(d.ids[2:])
  AND c.company_id = d.company_id;

-- Deletar contatos duplicados (manter o mais antigo)
WITH duplicates AS (
  SELECT company_id, phone,
    (array_agg(id ORDER BY created_at ASC))[1] AS keep_id
  FROM contacts
  WHERE phone IS NOT NULL
  GROUP BY company_id, phone
  HAVING count(*) > 1
)
DELETE FROM contacts c
USING duplicates d
WHERE c.company_id = d.company_id
  AND c.phone = d.phone
  AND c.id != d.keep_id;

-- Adicionar constraint UNIQUE
ALTER TABLE contacts
  ADD CONSTRAINT contacts_company_phone_unique
  UNIQUE (company_id, phone);
```

**Arquivo:** `supabase/functions/incoming-message/index.ts`

Trocar o `insert` de contato por upsert:

```text
const { data: newContact } = await supabase
  .from('contacts')
  .upsert({
    company_id, name: from_name || from_phone,
    phone: from_phone, source: channel,
    tags: [], is_group, avatar_url: ...
  }, { onConflict: 'company_id,phone' })
  .select('id, name, is_group')
  .single();
```

### 4. Limpar contatos com JIDs invalidos

**Script SQL (via insert tool):**

```text
-- Deletar contatos "Davi" com telefones invalidos (JIDs nao-conversacionais)
DELETE FROM contacts
WHERE phone IN ('86539514179772', '192526690594951')
  AND company_id = 'a0000000-0000-0000-0000-000000000001';
```

Tambem deletar conversas orfas associadas.

### 5. Corrigir build errors do chatbot (enum)

**Migracao SQL:** Adicionar os 3 valores faltantes ao enum `chatbot_node_type`:

```text
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'close_chat';
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'delay';
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'webhook';
```

**Arquivo:** `src/components/chatbot/NodeEditModal.tsx`

Adicionar as 3 entradas faltantes ao `NODE_TYPE_LABELS`:

```text
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  message: 'Mensagem',
  menu: 'Menu de Opcoes',
  collect_data: 'Coleta de Dados',
  ai_response: 'Resposta IA',
  transfer: 'Encaminhar para Atendente',
  condition: 'Condicao de Horario',
  apply_tag: 'Aplicar Tag',
  move_to_funnel: 'Mover para Funil',
  delegate: 'Delegar Chat',
  close_chat: 'Encerrar Chat',
  delay: 'Atraso / Espera',
  webhook: 'Webhook',
};
```

---

## Arquivos Modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/incoming-message/index.ts` | Filtrar JIDs invalidos, deduplicar fromMe, upsert contatos |
| `src/components/chatbot/NodeEditModal.tsx` | Adicionar close_chat, delay, webhook ao NODE_TYPE_LABELS |
| Migracao SQL | UNIQUE constraint + limpeza de duplicatas + enum values |
| Script SQL (dados) | Deletar contatos com JIDs invalidos |

