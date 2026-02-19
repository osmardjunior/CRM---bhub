
-- Funnels table
CREATE TABLE public.funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company funnels" ON public.funnels FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company funnels" ON public.funnels FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company funnels" ON public.funnels FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Admins can delete funnels" ON public.funnels FOR DELETE USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_funnels_updated_at BEFORE UPDATE ON public.funnels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER auto_set_funnels_company_id BEFORE INSERT ON public.funnels FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();

-- Funnel stages table
CREATE TABLE public.funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company funnel stages" ON public.funnel_stages FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company funnel stages" ON public.funnel_stages FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company funnel stages" ON public.funnel_stages FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Users can delete company funnel stages" ON public.funnel_stages FOR DELETE USING (company_id = get_user_company_id());

CREATE TRIGGER auto_set_funnel_stages_company_id BEFORE INSERT ON public.funnel_stages FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
