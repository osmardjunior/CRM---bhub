-- ============================================
-- Kanban CRM tables (pipelines, stages, activities, reminders, meetings)
-- deals table already exists — add missing columns
-- ============================================

-- Enums
DO $$ BEGIN CREATE TYPE public.deal_status AS ENUM ('active', 'won', 'lost', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.activity_type AS ENUM ('note', 'call', 'email', 'meeting', 'task', 'status_change'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Pipeline Principal',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipelines_company_all" ON public.pipelines;
CREATE POLICY "pipelines_company_all" ON public.pipelines FOR ALL
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- Stages (kanban columns)
CREATE TABLE IF NOT EXISTS public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stages_company_all" ON public.stages;
CREATE POLICY "stages_company_all" ON public.stages FOR ALL
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- Deals: add missing columns for kanban compatibility
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Activities (deal timeline)
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  type public.activity_type NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS activities_deal_id_idx ON public.activities(deal_id, created_at DESC);
DROP POLICY IF EXISTS "activities_company_select" ON public.activities;
CREATE POLICY "activities_company_select" ON public.activities FOR SELECT
  USING (company_id = public.get_my_company_id());
DROP POLICY IF EXISTS "activities_own_insert" ON public.activities;
CREATE POLICY "activities_own_insert" ON public.activities FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND user_id = auth.uid());

-- Reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  remind_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS reminders_user_pending_idx ON public.reminders(user_id, is_completed, remind_at) WHERE is_completed = false;
DROP POLICY IF EXISTS "reminders_company_select" ON public.reminders;
CREATE POLICY "reminders_company_select" ON public.reminders FOR SELECT
  USING (company_id = public.get_my_company_id());
DROP POLICY IF EXISTS "reminders_own_insert" ON public.reminders;
CREATE POLICY "reminders_own_insert" ON public.reminders FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS "reminders_own_update" ON public.reminders;
CREATE POLICY "reminders_own_update" ON public.reminders FOR UPDATE
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reminders_own_delete" ON public.reminders;
CREATE POLICY "reminders_own_delete" ON public.reminders FOR DELETE
  USING (user_id = auth.uid());

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS meetings_user_date_idx ON public.meetings(user_id, start_at);
CREATE INDEX IF NOT EXISTS meetings_company_date_idx ON public.meetings(company_id, start_at);
DROP POLICY IF EXISTS "meetings_company_all" ON public.meetings;
CREATE POLICY "meetings_company_all" ON public.meetings FOR ALL
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- Add whatsapp_number to contacts if missing
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'geral';
