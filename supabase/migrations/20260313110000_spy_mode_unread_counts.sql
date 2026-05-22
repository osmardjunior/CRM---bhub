-- Spy mode: unread counts based on ANY team member's read, not the spy user's own.
-- When p_spy_mode = true, uses MAX(last_read_at) across ALL users for each conversation
-- so the spy sees "unread" only if NO agent has read/responded yet.

-- Drop existing functions first to change signatures cleanly
DROP FUNCTION IF EXISTS public.get_unread_counts(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_sidebar_unread_count(uuid, uuid, uuid);

-- ── get_unread_counts with spy_mode support ──
CREATE OR REPLACE FUNCTION public.get_unread_counts(
  p_user_id          uuid,
  p_conversation_ids uuid[],
  p_spy_mode         boolean DEFAULT false
)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT
    m.conversation_id,
    COUNT(m.id) AS unread_count
  FROM public.messages m
  LEFT JOIN LATERAL (
    SELECT
      CASE WHEN p_spy_mode THEN
        (SELECT MAX(cr2.last_read_at)
         FROM public.conversation_reads cr2
         WHERE cr2.conversation_id = m.conversation_id)
      ELSE
        (SELECT cr1.last_read_at
         FROM public.conversation_reads cr1
         WHERE cr1.conversation_id = m.conversation_id
           AND cr1.user_id = p_user_id)
      END AS last_read_at
  ) read_ts ON true
  WHERE m.conversation_id = ANY(p_conversation_ids)
    AND m.sender_type IN ('user', 'system')
    AND m.deleted_at IS NULL
    AND (read_ts.last_read_at IS NULL OR m.created_at > read_ts.last_read_at)
  GROUP BY m.conversation_id
$$;

-- ── get_sidebar_unread_count with spy_mode + project_id support ──
CREATE OR REPLACE FUNCTION public.get_sidebar_unread_count(
  p_user_id    uuid,
  p_company_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_spy_mode   boolean DEFAULT false
)
RETURNS integer
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT COUNT(DISTINCT c.id)::integer
  FROM public.conversations c
  LEFT JOIN LATERAL (
    SELECT
      CASE WHEN p_spy_mode THEN
        (SELECT MAX(cr2.last_read_at)
         FROM public.conversation_reads cr2
         WHERE cr2.conversation_id = c.id)
      ELSE
        (SELECT cr1.last_read_at
         FROM public.conversation_reads cr1
         WHERE cr1.conversation_id = c.id
           AND cr1.user_id = p_user_id)
      END AS last_read_at
  ) read_ts ON true
  WHERE c.company_id = p_company_id
    AND c.status IN ('new', 'open', 'pending')
    AND (read_ts.last_read_at IS NULL OR c.last_message_at > read_ts.last_read_at)
    AND (p_project_id IS NULL OR c.project_id = p_project_id)
    AND (
      EXISTS (SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = p_user_id AND ur.role IN ('admin', 'supervisor'))
      OR c.assigned_user_id = p_user_id
    )
$$;
