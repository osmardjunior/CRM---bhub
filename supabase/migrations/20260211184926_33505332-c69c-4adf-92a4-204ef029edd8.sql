
-- =============================================
-- 1. satisfaction_surveys table
-- =============================================
CREATE TABLE public.satisfaction_surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  contact_id uuid NOT NULL REFERENCES public.contacts(id),
  assigned_user_id uuid REFERENCES public.profiles(id),
  score integer CHECK (score >= 1 AND score <= 5),
  comment text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company surveys"
  ON public.satisfaction_surveys FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company surveys"
  ON public.satisfaction_surveys FOR INSERT
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update company surveys"
  ON public.satisfaction_surveys FOR UPDATE
  USING (company_id = get_user_company_id());

-- Auto-set company_id trigger
CREATE TRIGGER auto_set_company_id_satisfaction
  BEFORE INSERT ON public.satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- =============================================
-- 2. get_agent_metrics database function
-- =============================================
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
  closed_convs AS (
    SELECT c.id, c.assigned_user_id, c.created_at AS conv_created, c.updated_at AS conv_closed
    FROM conversations c, company_filter cf
    WHERE c.company_id = cf.cid
      AND c.status = 'closed'
      AND c.updated_at BETWEEN date_from AND date_to
      AND c.assigned_user_id IS NOT NULL
  ),
  first_responses AS (
    SELECT m.conversation_id,
           MIN(m.created_at) AS first_agent_response
    FROM messages m
    JOIN closed_convs cc ON cc.id = m.conversation_id
    WHERE m.sender_type = 'agent'
    GROUP BY m.conversation_id
  ),
  first_user_msgs AS (
    SELECT m.conversation_id,
           MIN(m.created_at) AS first_user_msg
    FROM messages m
    JOIN closed_convs cc ON cc.id = m.conversation_id
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
  )
  SELECT
    cc.assigned_user_id AS agent_id,
    p.name AS agent_name,
    COUNT(DISTINCT cc.id) AS conversations_handled,
    AVG(EXTRACT(EPOCH FROM (fr.first_agent_response - fu.first_user_msg)))::numeric AS avg_first_response_seconds,
    AVG(EXTRACT(EPOCH FROM (cc.conv_closed - cc.conv_created)))::numeric AS avg_resolution_seconds,
    ns.avg_score AS avg_nps
  FROM closed_convs cc
  JOIN profiles p ON p.id = cc.assigned_user_id
  LEFT JOIN first_responses fr ON fr.conversation_id = cc.id
  LEFT JOIN first_user_msgs fu ON fu.conversation_id = cc.id
  LEFT JOIN nps_scores ns ON ns.assigned_user_id = cc.assigned_user_id
  GROUP BY cc.assigned_user_id, p.name, ns.avg_score;
$$;

-- =============================================
-- 3. Enable realtime for satisfaction_surveys
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.satisfaction_surveys;
