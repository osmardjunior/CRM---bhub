-- Migration: fix RLS for agents who access via user_projects
-- Adds department_id IS NULL fallback and project-department membership check
-- to funnels, funnel_stages and tags so agents can always see global items
-- and items belonging to their project's department.

-- Helper: returns department_ids of projects the user belongs to
CREATE OR REPLACE FUNCTION get_user_project_department_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT p.department_id), '{}'::uuid[])
  FROM user_projects up
  JOIN projects p ON p.id = up.project_id
  WHERE up.user_id = auth.uid()
    AND up.active = true
    AND p.active = true;
$$;

-- ── 1. FUNNELS ───────────────────────────────────────────────────────────────
-- Allow: admin | global funnel (IS NULL) | user's dept | user's project dept

DROP POLICY IF EXISTS "Users view dept funnels" ON public.funnels;

CREATE POLICY "Users view dept funnels"
  ON public.funnels FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id IS NULL
      OR department_id = ANY(get_user_department_ids())
      OR department_id = ANY(get_user_project_department_ids())
    )
  );

-- ── 2. FUNNEL_STAGES ─────────────────────────────────────────────────────────
-- Inherits dept from parent funnel — update sub-query to match new funnel policy

DROP POLICY IF EXISTS "Users view dept funnel stages" ON public.funnel_stages;

CREATE POLICY "Users view dept funnel stages"
  ON public.funnel_stages FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id IS NULL
           OR department_id = ANY(get_user_department_ids())
           OR department_id = ANY(get_user_project_department_ids())
      )
    )
  );

-- ── 3. TAGS ──────────────────────────────────────────────────────────────────
-- Allow: admin | global tag (IS NULL) | user's dept | user's project dept

DROP POLICY IF EXISTS "Users view dept tags" ON public.tags;

CREATE POLICY "Users view dept tags"
  ON public.tags FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id IS NULL
      OR department_id = ANY(get_user_department_ids())
      OR department_id = ANY(get_user_project_department_ids())
    )
  );

-- ── 4. CONTACT_FUNNEL_STAGES ─────────────────────────────────────────────────
-- Already has department_id IS NULL, but funnel sub-query needs same fix

DROP POLICY IF EXISTS "Users view dept contact_funnel_stages"   ON public.contact_funnel_stages;
DROP POLICY IF EXISTS "Users insert dept contact_funnel_stages" ON public.contact_funnel_stages;
DROP POLICY IF EXISTS "Users update dept contact_funnel_stages" ON public.contact_funnel_stages;
DROP POLICY IF EXISTS "Users delete dept contact_funnel_stages" ON public.contact_funnel_stages;

CREATE POLICY "Users view dept contact_funnel_stages"
  ON public.contact_funnel_stages FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id IS NULL
           OR department_id = ANY(get_user_department_ids())
           OR department_id = ANY(get_user_project_department_ids())
      )
    )
  );

CREATE POLICY "Users insert dept contact_funnel_stages"
  ON public.contact_funnel_stages FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id IS NULL
           OR department_id = ANY(get_user_department_ids())
           OR department_id = ANY(get_user_project_department_ids())
      )
    )
  );

CREATE POLICY "Users update dept contact_funnel_stages"
  ON public.contact_funnel_stages FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id IS NULL
           OR department_id = ANY(get_user_department_ids())
           OR department_id = ANY(get_user_project_department_ids())
      )
    )
  );

CREATE POLICY "Users delete dept contact_funnel_stages"
  ON public.contact_funnel_stages FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id IS NULL
           OR department_id = ANY(get_user_department_ids())
           OR department_id = ANY(get_user_project_department_ids())
      )
    )
  );
