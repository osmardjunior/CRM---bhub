-- Delegation audit log
CREATE TABLE IF NOT EXISTS public.delegation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id),
  to_user_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delegation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view delegation logs"
  ON public.delegation_logs FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can insert delegation logs"
  ON public.delegation_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX idx_delegation_logs_conversation ON public.delegation_logs(conversation_id);
CREATE INDEX idx_delegation_logs_company ON public.delegation_logs(company_id, created_at DESC);
