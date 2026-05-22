-- Fix get_sidebar_unread_count: use actual message-level check instead of c.last_message_at
-- The old logic counted conversations where ANY message (including agent messages) was newer
-- than the user's last read. This inflated the count because agent messages updated last_message_at.
-- Now aligned with get_unread_conversation_ids: only counts conversations with unread USER/SYSTEM messages.

CREATE OR REPLACE FUNCTION public.get_sidebar_unread_count(
  p_user_id    uuid,
  p_company_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_spy_mode   boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql STABLE AS $$
DECLARE
  result integer;
  is_admin_or_sup boolean;
BEGIN
  -- Check if user is admin/supervisor (they see all conversations)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role IN ('admin', 'supervisor')
  ) INTO is_admin_or_sup;

  IF p_spy_mode THEN
    SELECT COUNT(DISTINCT c.id)::integer INTO result
    FROM public.conversations c
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending')
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (is_admin_or_sup OR c.assigned_user_id = p_user_id)
      AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.conversation_id = c.id
          AND m.sender_type IN ('user', 'system')
          AND m.deleted_at IS NULL
          AND m.created_at > COALESCE(
            GREATEST(
              (SELECT MAX(m2.created_at)
               FROM public.messages m2
               WHERE m2.conversation_id = c.id
                 AND m2.sender_type = 'agent'
                 AND m2.deleted_at IS NULL),
              (SELECT MAX(cr.last_read_at)
               FROM public.conversation_reads cr
               WHERE cr.conversation_id = c.id)
            ),
            '1970-01-01'::timestamptz
          )
      );
  ELSE
    -- Normal mode: count conversations with user/system messages newer than this user's last read
    SELECT COUNT(DISTINCT c.id)::integer INTO result
    FROM public.conversations c
    LEFT JOIN public.conversation_reads cr
      ON cr.conversation_id = c.id AND cr.user_id = p_user_id
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending')
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (is_admin_or_sup OR c.assigned_user_id = p_user_id)
      AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.conversation_id = c.id
          AND m.sender_type IN ('user', 'system')
          AND m.deleted_at IS NULL
          AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
      );
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

NOTIFY pgrst, 'reload schema';
