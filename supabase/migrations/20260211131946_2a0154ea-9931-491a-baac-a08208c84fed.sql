
-- ── Pipeline Deals ─────────────────────────────────────
CREATE TYPE public.deal_stage AS ENUM ('novo_lead', 'em_contato', 'proposta', 'fechamento', 'ganho', 'perdido');

CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  value NUMERIC NOT NULL DEFAULT 0,
  stage deal_stage NOT NULL DEFAULT 'novo_lead',
  probability INTEGER NOT NULL DEFAULT 0,
  assigned_user_id UUID REFERENCES public.profiles(id),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company deals" ON public.deals FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company deals" ON public.deals FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company deals" ON public.deals FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Admins can delete deals" ON public.deals FOR DELETE USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER auto_set_deals_company_id BEFORE INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- ── Tasks ──────────────────────────────────────────────
CREATE TYPE public.task_priority AS ENUM ('alta', 'media', 'baixa');
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_progresso', 'concluida');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority task_priority NOT NULL DEFAULT 'media',
  status task_status NOT NULL DEFAULT 'pendente',
  due_date DATE,
  assigned_user_id UUID REFERENCES public.profiles(id),
  contact_id UUID REFERENCES public.contacts(id),
  deal_id UUID REFERENCES public.deals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company tasks" ON public.tasks FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company tasks" ON public.tasks FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company tasks" ON public.tasks FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Admins can delete tasks" ON public.tasks FOR DELETE USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER auto_set_tasks_company_id BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- ── Close reason on conversations ──────────────────────
ALTER TABLE public.conversations ADD COLUMN close_reason TEXT;

-- ── Enable realtime ────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
