
-- ============================================
-- Tabela: integrations (configurações de canais)
-- ============================================
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, channel)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Only company members can view integrations
CREATE POLICY "Users can view company integrations"
ON public.integrations FOR SELECT
USING (company_id = get_user_company_id());

-- Only admins can insert
CREATE POLICY "Admins can insert integrations"
ON public.integrations FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update integrations"
ON public.integrations FOR UPDATE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete integrations"
ON public.integrations FOR DELETE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Auto-set company_id trigger
CREATE TRIGGER set_integrations_company_id
BEFORE INSERT ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- Auto-update updated_at
CREATE TRIGGER set_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- Tabela: tags (tags centralizadas da empresa)
-- ============================================
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- All company members can view tags
CREATE POLICY "Users can view company tags"
ON public.tags FOR SELECT
USING (company_id = get_user_company_id());

-- Only admins can insert tags
CREATE POLICY "Admins can insert tags"
ON public.tags FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update tags
CREATE POLICY "Admins can update tags"
ON public.tags FOR UPDATE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete tags
CREATE POLICY "Admins can delete tags"
ON public.tags FOR DELETE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Auto-set company_id trigger
CREATE TRIGGER set_tags_company_id
BEFORE INSERT ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();
