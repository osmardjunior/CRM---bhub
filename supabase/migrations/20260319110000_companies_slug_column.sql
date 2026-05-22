-- Add slug column to companies (needed by register_company RPC)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing companies without slug
UPDATE public.companies
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

-- Update register_company to handle companies without UNIQUE slug constraint
CREATE OR REPLACE FUNCTION public.register_company(
  p_company_name TEXT,
  p_user_name TEXT,
  p_user_email TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_pipeline_id UUID;
  v_slug TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Generate slug from company name
  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create company
  INSERT INTO public.companies (name, slug)
  VALUES (p_company_name, v_slug)
  RETURNING id INTO v_company_id;

  -- Create profile (upsert in case profile already exists)
  INSERT INTO public.profiles (id, company_id, name, email, role)
  VALUES (v_user_id, v_company_id, p_user_name, p_user_email, 'owner')
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name;

  -- Create default pipeline
  INSERT INTO public.pipelines (company_id, name, is_default)
  VALUES (v_company_id, 'Pipeline Principal', true)
  RETURNING id INTO v_pipeline_id;

  -- Create 4 default stages
  INSERT INTO public.stages (pipeline_id, company_id, name, color, position, is_won, is_lost)
  VALUES
    (v_pipeline_id, v_company_id, 'Leads',         '#F59E0B', 0, false, false),
    (v_pipeline_id, v_company_id, 'Qualificação',  '#3B82F6', 1, false, false),
    (v_pipeline_id, v_company_id, 'Negociação',    '#8B5CF6', 2, false, false),
    (v_pipeline_id, v_company_id, 'Fechado',       '#10B981', 3, true,  false);

  RETURN v_company_id;
END;
$$;
