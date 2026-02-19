
-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  action_type TEXT NOT NULL DEFAULT 'send_message',
  action_config JSONB NOT NULL DEFAULT '{}',
  filters JSONB NOT NULL DEFAULT '{}',
  schedule_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  skip_weekends BOOLEAN NOT NULL DEFAULT false,
  send_window JSONB NOT NULL DEFAULT '{}',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view company campaigns"
  ON public.campaigns FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can insert campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- Auto-set company_id trigger
CREATE TRIGGER set_campaigns_company_id
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- Auto-update updated_at trigger
CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
