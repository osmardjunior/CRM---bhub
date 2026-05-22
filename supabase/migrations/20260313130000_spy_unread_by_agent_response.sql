-- Spy mode v3: unread = contact messages newer than the last agent/bot response
-- Much more reliable than checking conversation_reads — an agent who responded
-- definitely handled the conversation, even if markConversationRead was never called.

DROP FUNCTION IF EXISTS public.get_unread_counts(uuid, uuid[], boolean);

CREATE OR REPLACE FUNCTION public.get_unread_counts(
  p_user_id          uuid,
  p_conversation_ids uuid[],
  p_spy_mode         boolean DEFAULT false
)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_spy_mode THEN
    -- Spy mode: count user/system messages that are newer than the last agent response
    -- If the agent responded after the contact, unread = 0 (agent handled it)
    RETURN QUERY
      SELECT m.conversation_id, COUNT(m.id) AS unread_count
      FROM public.messages m
      WHERE m.conversation_id = ANY(p_conversation_ids)
        AND m.sender_type IN ('user', 'system')
        AND m.deleted_at IS NULL
        AND m.created_at > COALESCE(
          -- Find the most recent agent/bot response OR any team member's read timestamp
          GREATEST(
            (SELECT MAX(m2.created_at)
             FROM public.messages m2
             WHERE m2.conversation_id = m.conversation_id
               AND m2.sender_type = 'agent'
               AND m2.deleted_at IS NULL),
            (SELECT MAX(cr.last_read_at)
             FROM public.conversation_reads cr
             WHERE cr.conversation_id = m.conversation_id)
          ),
          '1970-01-01'::timestamptz
        )
      GROUP BY m.conversation_id;
  ELSE
    -- Normal mode: unread = messages newer than this user's own last read
    RETURN QUERY
      SELECT m.conversation_id, COUNT(m.id) AS unread_count
      FROM public.messages m
      LEFT JOIN public.conversation_reads cr
        ON cr.conversation_id = m.conversation_id AND cr.user_id = p_user_id
      WHERE m.conversation_id = ANY(p_conversation_ids)
        AND m.sender_type IN ('user', 'system')
        AND m.deleted_at IS NULL
        AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
      GROUP BY m.conversation_id;
  END IF;
END;
$$;

-- Also update sidebar for spy mode
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid, uuid, boolean);

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
BEGIN
  IF p_spy_mode THEN
    SELECT COUNT(DISTINCT c.id)::integer INTO result
    FROM public.conversations c
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending')
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = p_user_id AND ur.role IN ('admin', 'supervisor'))
        OR c.assigned_user_id = p_user_id
      )
      -- Has user messages newer than the last agent response or team read
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
    SELECT COUNT(DISTINCT c.id)::integer INTO result
    FROM public.conversations c
    LEFT JOIN public.conversation_reads cr
      ON cr.conversation_id = c.id AND cr.user_id = p_user_id
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending')
      AND (cr.last_read_at IS NULL OR c.last_message_at > cr.last_read_at)
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = p_user_id AND ur.role IN ('admin', 'supervisor'))
        OR c.assigned_user_id = p_user_id
      );
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

NOTIFY pgrst, 'reload schema';
