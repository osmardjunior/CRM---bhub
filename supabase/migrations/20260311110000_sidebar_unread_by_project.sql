-- Add p_project_id filter to get_sidebar_unread_count
CREATE OR REPLACE FUNCTION get_sidebar_unread_count(
  p_user_id uuid,
  p_company_id uuid,
  p_project_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT COUNT(DISTINCT c.id)::integer
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
    )
$$;
