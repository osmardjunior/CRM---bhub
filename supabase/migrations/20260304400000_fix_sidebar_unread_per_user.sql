-- Fix: get_sidebar_unread_count retornava o total global da empresa.
-- Agora filtra por usuário:
--   Admin/Supervisor: vê todas as conversas da empresa com não lidas
--   Agente: vê apenas as conversas atribuídas a ele com não lidas

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
    AND (
      -- Admin e supervisor veem tudo
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p_user_id
          AND ur.role IN ('admin', 'supervisor')
      )
      OR
      -- Agente: só conversas atribuídas a ele
      c.assigned_user_id = p_user_id
    )
$$;
