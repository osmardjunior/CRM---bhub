-- Seed: add Ana (agent) to the first active project of her company
-- Ana's user ID: 18d19c09-2624-4859-b76c-b34349f3ba79
-- This is a test/setup migration — safe to keep (upsert, no duplicates)

DO $$
DECLARE
  v_ana_id    uuid := '18d19c09-2624-4859-b76c-b34349f3ba79';
  v_company   uuid := '958e74af-671c-4151-9f05-7d2e07b8ac48';
  v_project   uuid;
BEGIN
  -- Pick the first active project of Ana's company
  SELECT id INTO v_project
  FROM projects
  WHERE company_id = v_company AND active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_project IS NULL THEN
    RAISE NOTICE 'No active project found for company %, skipping.', v_company;
    RETURN;
  END IF;

  -- Upsert so re-running this migration is safe
  INSERT INTO user_projects (user_id, project_id, active)
  VALUES (v_ana_id, v_project, true)
  ON CONFLICT (user_id, project_id) DO UPDATE SET active = true;

  RAISE NOTICE 'Ana added to project %', v_project;
END;
$$;
