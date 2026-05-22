-- Backfill: create a default pipeline + stages for every company that doesn't have one yet
DO $$
DECLARE
  r RECORD;
  v_pipeline_id UUID;
BEGIN
  FOR r IN
    SELECT c.id AS company_id
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pipelines p WHERE p.company_id = c.id
    )
  LOOP
    INSERT INTO public.pipelines (company_id, name, is_default)
    VALUES (r.company_id, 'Pipeline Principal', true)
    RETURNING id INTO v_pipeline_id;

    INSERT INTO public.stages (pipeline_id, company_id, name, color, position, is_won, is_lost)
    VALUES
      (v_pipeline_id, r.company_id, 'Leads',         '#F59E0B', 0, false, false),
      (v_pipeline_id, r.company_id, 'Qualificação',  '#3B82F6', 1, false, false),
      (v_pipeline_id, r.company_id, 'Negociação',    '#8B5CF6', 2, false, false),
      (v_pipeline_id, r.company_id, 'Fechado',       '#10B981', 3, true,  false);
  END LOOP;
END $$;
