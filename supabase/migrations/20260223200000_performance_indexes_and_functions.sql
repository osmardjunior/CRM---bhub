-- ── Performance indexes ───────────────────────────────────────────────────
-- Note: CONCURRENTLY cannot be used inside a migration transaction,
-- so we use regular CREATE INDEX (locks are brief on small tables at launch).

-- Messages: the most queried table
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_company_type_created
  ON public.messages(company_id, sender_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON public.messages(deleted_at) WHERE deleted_at IS NULL;

-- Conversations: listing and sorting
CREATE INDEX IF NOT EXISTS idx_conversations_company_status_last
  ON public.conversations(company_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_contact_id
  ON public.conversations(contact_id);

-- Contacts: search (trigram extension required)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING gin(phone gin_trgm_ops);

-- Conversation reads
CREATE INDEX IF NOT EXISTS idx_conv_reads_user
  ON public.conversation_reads(user_id);

-- ── Trigger: auto-update last_message_at on INSERT ────────────────────────
-- Removes the extra UPDATE roundtrip from sendMessage()

CREATE OR REPLACE FUNCTION public.fn_update_conv_last_message_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR NEW.created_at > last_message_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conv_last_message_at ON public.messages;
CREATE TRIGGER trg_update_conv_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_conv_last_message_at();

-- ── RPC: get_unread_counts ─────────────────────────────────────────────────
-- Replaces N+1 client-side queries with a single JOIN aggregation.
-- Called with: supabase.rpc('get_unread_counts', { p_user_id, p_conversation_ids })

CREATE OR REPLACE FUNCTION public.get_unread_counts(
  p_user_id       uuid,
  p_conversation_ids uuid[]
)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT
    m.conversation_id,
    COUNT(m.id) AS unread_count
  FROM public.messages m
  LEFT JOIN public.conversation_reads cr
    ON  cr.conversation_id = m.conversation_id
    AND cr.user_id          = p_user_id
  WHERE m.conversation_id = ANY(p_conversation_ids)
    AND m.sender_type IN ('user', 'system')
    AND m.deleted_at IS NULL
    AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
  GROUP BY m.conversation_id
$$;

-- ── RPC: get_sidebar_unread_count ─────────────────────────────────────────
-- Returns a single integer: number of active conversations with unread messages.
-- Replaces "fetch all conversations + client-side comparison" in useSidebarStats.

CREATE OR REPLACE FUNCTION public.get_sidebar_unread_count(
  p_user_id    uuid,
  p_company_id uuid
)
RETURNS integer
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT COUNT(DISTINCT c.id)::integer
  FROM public.conversations c
  LEFT JOIN public.conversation_reads cr
    ON  cr.conversation_id = c.id
    AND cr.user_id          = p_user_id
  WHERE c.company_id = p_company_id
    AND c.status IN ('new', 'open', 'pending')
    AND (cr.last_read_at IS NULL OR c.last_message_at > cr.last_read_at)
$$;
