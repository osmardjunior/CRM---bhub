-- Fix: get_unread_conversation_ids was returning too many IDs (2500+) which caused
-- the .in('id', [...]) URL to exceed PostgREST/CloudFlare limits (~16KB).
-- The huge URL made the conversation query fail silently, showing a blank list.
--
-- Changes:
-- 1. Add LIMIT 200 + ORDER BY last_message_at DESC to cap returned IDs
-- 2. Remove redundant user_roles admin check (RLS already handles visibility)
-- 3. Apply same fixes to get_sidebar_unread_count for consistency

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Fix get_unread_conversation_ids
-- ═══════════════════════════════════════════════════════════════════════
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
    -- Spy mode: unread = user/system message newer than last agent reply AND any user's read
    SELECT array_agg(sub.id) INTO result FROM (
      SELECT c.id
      FROM public.conversations c
      WHERE c.company_id = p_company_id
        AND c.status IN ('new', 'open', 'pending')
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
        )
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT 200
    ) sub;
  ELSE
    -- Normal mode: unread = user/system message newer than THIS user's last read
    SELECT array_agg(sub.id) INTO result FROM (
      SELECT c.id
      FROM public.conversations c
      LEFT JOIN public.conversation_reads cr
        ON cr.conversation_id = c.id AND cr.user_id = p_user_id
      WHERE c.company_id = p_company_id
        AND c.status IN ('new', 'open', 'pending')
        AND (p_project_id IS NULL OR c.project_id = p_project_id)
        AND EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.conversation_id = c.id
            AND m.sender_type IN ('user', 'system')
            AND m.deleted_at IS NULL
            AND (cr.last_read_at IS NULL OR m.created_at > cr.last_read_at)
        )
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT 200
    ) sub;
  END IF;

  RETURN COALESCE(result, '{}');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Fix get_sidebar_unread_count — remove role check for consistency
-- ═══════════════════════════════════════════════════════════════════════
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
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
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
