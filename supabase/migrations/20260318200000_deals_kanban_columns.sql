-- ============================================
-- Add missing columns to deals table for kanban-crm compatibility
-- Existing columns: id, company_id, contact_id, assigned_user_id, title, value, notes, probability, stage(enum), status, created_at, updated_at
-- Needed by kanban: pipeline_id, stage_id, owner_id, position, currency, expected_close_date, description, tags
-- ============================================

-- Add pipeline_id (which pipeline this deal belongs to)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Add stage_id (which kanban column/stage)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL;

-- Add owner_id (kanban uses owner_id, CRM uses assigned_user_id — keep both)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add position for ordering within a stage
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Add currency
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';

-- Add expected close date
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Add description (kanban uses description, CRM uses notes — keep both)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Add tags array
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Indexes for kanban queries
CREATE INDEX IF NOT EXISTS deals_pipeline_id_idx ON public.deals(pipeline_id);
CREATE INDEX IF NOT EXISTS deals_stage_id_idx ON public.deals(stage_id);
CREATE INDEX IF NOT EXISTS deals_owner_id_idx ON public.deals(owner_id);

-- Ensure deals has an ALL policy using get_my_company_id (for kanban RLS)
-- Drop old policies if they conflict, then create new one
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deals' AND policyname = 'deals_company_all'
  ) THEN
    CREATE POLICY "deals_company_all" ON public.deals FOR ALL
      USING (company_id = public.get_my_company_id())
      WITH CHECK (company_id = public.get_my_company_id());
  END IF;
END $$;
