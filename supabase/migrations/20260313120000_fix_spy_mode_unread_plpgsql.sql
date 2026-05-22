-- Fix spy mode unread counts: rewrite with plpgsql IF/ELSE for reliability
-- The previous LATERAL + CASE approach in pure SQL may not evaluate correctly

-- Drop all overloads to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_unread_counts(uuid, uuid[]);
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
    -- Spy mode: unread = messages newer than the latest read by ANY team member
    RETURN QUERY
      SELECT m.conversation_id, COUNT(m.id) AS unread_count
      FROM public.messages m
      LEFT JOIN (
        SELECT cr.conversation_id, MAX(cr.last_read_at) AS last_read_at
        FROM public.conversation_reads cr
        GROUP BY cr.conversation_id
      ) team_reads ON team_reads.conversation_id = m.conversation_id
      WHERE m.conversation_id = ANY(p_conversation_ids)
        AND m.sender_type IN ('user', 'system')
        AND m.deleted_at IS NULL
        AND (team_reads.last_read_at IS NULL OR m.created_at > team_reads.last_read_at)
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

-- Drop all overloads of sidebar function
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid, boolean);

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
    LEFT JOIN (
      SELECT cr.conversation_id, MAX(cr.last_read_at) AS last_read_at
      FROM public.conversation_reads cr
      GROUP BY cr.conversation_id
    ) team_reads ON team_reads.conversation_id = c.id
    WHERE c.company_id = p_company_id
      AND c.status IN ('new', 'open', 'pending')
      AND (team_reads.last_read_at IS NULL OR c.last_message_at > team_reads.last_read_at)
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = p_user_id AND ur.role IN ('admin', 'supervisor'))
        OR c.assigned_user_id = p_user_id
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

-- Force PostgREST to reload schema cache so the new function signatures are picked up
NOTIFY pgrst, 'reload schema';
