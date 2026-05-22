-- RPC to get IDs of conversations with unread messages for a user.
-- Used by the "Não lidas" filter in the inbox.

CREATE OR REPLACE FUNCTION public.get_unread_conversation_ids(
  p_user_id    uuid,
  p_company_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_spy_mode   boolean DEFAULT false
)
RETURNS uuid[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  result uuid[];
BEGIN
  IF p_spy_mode THEN
    SELECT array_agg(c.id) INTO result
    FROM public.conversations c
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending', 'resolved')
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.conversation_id = c.id
          AND m.sender_type IN ('user', 'system')
          AND m.deleted_at IS NULL
          AND m.created_at > COALESCE(
            GREATEST(
              (SELECT MAX(m2.created_at) FROM public.messages m2
               WHERE m2.conversation_id = c.id AND m2.sender_type = 'agent' AND m2.deleted_at IS NULL),
              (SELECT MAX(cr.last_read_at) FROM public.conversation_reads cr
               WHERE cr.conversation_id = c.id)
            ),
            '1970-01-01'::timestamptz
          )
      );
  ELSE
    SELECT array_agg(c.id) INTO result
    FROM public.conversations c
    LEFT JOIN public.conversation_reads cr
      ON cr.conversation_id = c.id AND cr.user_id = p_user_id
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending', 'resolved')
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (cr.last_read_at IS NULL OR c.last_message_at > cr.last_read_at);
  END IF;

  RETURN COALESCE(result, '{}');
END;
$$;

NOTIFY pgrst, 'reload schema';
