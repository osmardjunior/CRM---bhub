-- Fix get_agent_metrics to include ALL conversations (not just closed)
-- and show all active agents even if they have 0 conversations

CREATE OR REPLACE FUNCTION public.get_agent_metrics(date_from timestamptz, date_to timestamptz)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  conversations_handled bigint,
  avg_first_response_seconds numeric,
  avg_resolution_seconds numeric,
  avg_nps numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  WITH company_filter AS (
    SELECT get_user_company_id() AS cid
  ),
  -- All conversations assigned to an agent in the date range (any status)
  all_convs AS (
    SELECT c.id, c.assigned_user_id, c.created_at AS conv_created, c.updated_at AS conv_updated, c.status
    FROM conversations c, company_filter cf
    WHERE c.company_id = cf.cid
      AND c.created_at BETWEEN date_from AND date_to
      AND c.assigned_user_id IS NOT NULL
  ),
  -- Also include active agents with no conversations in the period
  active_agents AS (
    SELECT p.id AS agent_id, p.name AS agent_name
    FROM profiles p, company_filter cf
    WHERE p.company_id = cf.cid
      AND p.is_active = true
  ),
  first_responses AS (
    SELECT m.conversation_id,
           MIN(m.created_at) AS first_agent_response
    FROM messages m
    JOIN all_convs ac ON ac.id = m.conversation_id
    WHERE m.sender_type = 'agent'
    GROUP BY m.conversation_id
  ),
  first_user_msgs AS (
    SELECT m.conversation_id,
           MIN(m.created_at) AS first_user_msg
    FROM messages m
    JOIN all_convs ac ON ac.id = m.conversation_id
    WHERE m.sender_type = 'user'
    GROUP BY m.conversation_id
  ),
  nps_scores AS (
    SELECT s.assigned_user_id, AVG(s.score) AS avg_score
    FROM satisfaction_surveys s, company_filter cf
    WHERE s.company_id = cf.cid
      AND s.answered_at BETWEEN date_from AND date_to
      AND s.score IS NOT NULL
    GROUP BY s.assigned_user_id
  ),
  -- Metrics per agent from conversations
  agent_conv_metrics AS (
    SELECT
      ac.assigned_user_id,
      COUNT(DISTINCT ac.id) AS conversations_handled,
      AVG(EXTRACT(EPOCH FROM (fr.first_agent_response - fu.first_user_msg)))::numeric AS avg_first_response_seconds,
      AVG(
        CASE WHEN ac.status = 'closed'
          THEN EXTRACT(EPOCH FROM (ac.conv_updated - ac.conv_created))::numeric
          ELSE NULL
        END
      ) AS avg_resolution_seconds
    FROM all_convs ac
    LEFT JOIN first_responses fr ON fr.conversation_id = ac.id
    LEFT JOIN first_user_msgs fu ON fu.conversation_id = ac.id
    GROUP BY ac.assigned_user_id
  )
  SELECT
    aa.agent_id,
    aa.agent_name,
    COALESCE(acm.conversations_handled, 0) AS conversations_handled,
    acm.avg_first_response_seconds,
    acm.avg_resolution_seconds,
    ns.avg_score AS avg_nps
  FROM active_agents aa
  LEFT JOIN agent_conv_metrics acm ON acm.assigned_user_id = aa.agent_id
  LEFT JOIN nps_scores ns ON ns.assigned_user_id = aa.agent_id
  WHERE COALESCE(acm.conversations_handled, 0) > 0 OR ns.avg_score IS NOT NULL
  ORDER BY COALESCE(acm.conversations_handled, 0) DESC;
$$;
