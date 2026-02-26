-- ============================================================
-- Deals + contact_funnel_stages: department isolation
--
-- Strategy for deals:
--   department_id IS NULL  → visible to all company members (unassigned)
--   department_id SET      → only admin + members of that dept
--
-- Strategy for contact_funnel_stages:
--   No new column needed — inherits department from parent funnel via JOIN
--   Same NULL fallback: funnels without department_id are open to all
-- ============================================================

-- ── 1. Add department_id to deals ──

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deals_department_id_idx ON public.deals(department_id);

-- ── 2. Update RLS: DEALS ──

DROP POLICY IF EXISTS "Users can view company deals"   ON public.deals;
DROP POLICY IF EXISTS "Users can insert company deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update company deals" ON public.deals;
DROP POLICY IF EXISTS "Admins can delete deals"        ON public.deals;

CREATE POLICY "Users view dept deals"
  ON public.deals FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id IS NULL
      OR department_id = ANY(get_user_department_ids())
    )
  );

CREATE POLICY "Users insert dept deals"
  ON public.deals FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id IS NULL
      OR department_id = ANY(get_user_department_ids())
    )
  );

CREATE POLICY "Users update dept deals"
  ON public.deals FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id IS NULL
      OR department_id = ANY(get_user_department_ids())
    )
  );

CREATE POLICY "Admins delete deals"
  ON public.deals FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id() AND has_role(auth.uid(), 'admin')
  );

-- ── 3. Update RLS: CONTACT_FUNNEL_STAGES (inherit dept via parent funnel) ──

DROP POLICY IF EXISTS "Users can view company contact_funnel_stages"   ON public.contact_funnel_stages;
DROP POLICY IF EXISTS "Users can insert company contact_funnel_stages" ON public.contact_funnel_stages;
DROP POLICY IF EXISTS "Users can update company contact_funnel_stages" ON public.contact_funnel_stages;
DROP POLICY IF EXISTS "Users can delete company contact_funnel_stages" ON public.contact_funnel_stages;

CREATE POLICY "Users view dept contact_funnel_stages"
  ON public.contact_funnel_stages FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id IS NULL
           OR department_id = ANY(get_user_department_ids())
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
      )
    )
  );
