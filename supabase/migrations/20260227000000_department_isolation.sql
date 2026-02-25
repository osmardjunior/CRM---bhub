-- ============================================================
-- Department Isolation — Multi-tenant by department
-- Rules:
--   - Users can belong to multiple departments (profile_departments)
--   - Admin sees everything (no dept filter)
--   - Supervisor/Agent sees only resources from their dept(s)
--   - Each resource (tag, funnel, campaign, integration) belongs to 1 dept
--   - Conversations inherit department_id from their integration
-- ============================================================

-- ── 1. profile_departments (many-to-many: user ↔ department) ──

CREATE TABLE public.profile_departments (
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, department_id)
);

ALTER TABLE public.profile_departments ENABLE ROW LEVEL SECURITY;

-- Users see their own memberships; admin/supervisor see all within the company
CREATE POLICY "Users view own dept memberships"
  ON public.profile_departments FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Admins manage dept memberships"
  ON public.profile_departments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── 2. Utility function: get_user_department_ids() ──

CREATE OR REPLACE FUNCTION public.get_user_department_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT department_id
    FROM public.profile_departments
    WHERE profile_id = auth.uid()
  )
$$;

-- ── 3. Add department_id to resource tables ──

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.funnels
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- conversations already has department_id from migration 20260226500000

-- ── 4. Update RLS: TAGS ──

DROP POLICY IF EXISTS "Users can view company tags" ON public.tags;
CREATE POLICY "Users view dept tags"
  ON public.tags FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
    )
  );

DROP POLICY IF EXISTS "Admins can insert tags" ON public.tags;
CREATE POLICY "Admins insert dept tags"
  ON public.tags FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id() AND has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins can update tags" ON public.tags;
CREATE POLICY "Admins update dept tags"
  ON public.tags FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete tags" ON public.tags;
CREATE POLICY "Admins delete dept tags"
  ON public.tags FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- ── 5. Update RLS: FUNNELS ──

DROP POLICY IF EXISTS "Users can view company funnels" ON public.funnels;
CREATE POLICY "Users view dept funnels"
  ON public.funnels FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
    )
  );

DROP POLICY IF EXISTS "Users can insert company funnels" ON public.funnels;
CREATE POLICY "Admins insert dept funnels"
  ON public.funnels FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update company funnels" ON public.funnels;
CREATE POLICY "Admins update dept funnels"
  ON public.funnels FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete funnels" ON public.funnels;
CREATE POLICY "Admins delete dept funnels"
  ON public.funnels FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- ── 6. Update RLS: FUNNEL_STAGES (inherit dept from parent funnel via JOIN) ──

DROP POLICY IF EXISTS "Users can view company funnel stages" ON public.funnel_stages;
CREATE POLICY "Users view dept funnel stages"
  ON public.funnel_stages FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR funnel_id IN (
        SELECT id FROM public.funnels
        WHERE department_id = ANY(get_user_department_ids())
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert company funnel stages" ON public.funnel_stages;
CREATE POLICY "Admins insert funnel stages"
  ON public.funnel_stages FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update company funnel stages" ON public.funnel_stages;
CREATE POLICY "Admins update funnel stages"
  ON public.funnel_stages FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete company funnel stages" ON public.funnel_stages;
CREATE POLICY "Admins delete funnel stages"
  ON public.funnel_stages FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- ── 7. Update RLS: CAMPAIGNS ──

DROP POLICY IF EXISTS "Users can view company campaigns" ON public.campaigns;
CREATE POLICY "Users view dept campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
    )
  );

DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.campaigns;
CREATE POLICY "Admins insert dept campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update campaigns" ON public.campaigns;
CREATE POLICY "Admins update dept campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.campaigns;
CREATE POLICY "Admins delete dept campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- ── 8. Update RLS: INTEGRATIONS ──

DROP POLICY IF EXISTS "Users can view company integrations" ON public.integrations;
CREATE POLICY "Users view dept integrations"
  ON public.integrations FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
    )
  );

DROP POLICY IF EXISTS "Admins can insert integrations" ON public.integrations;
CREATE POLICY "Admins insert dept integrations"
  ON public.integrations FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update integrations" ON public.integrations;
CREATE POLICY "Admins update dept integrations"
  ON public.integrations FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete integrations" ON public.integrations;
CREATE POLICY "Admins delete dept integrations"
  ON public.integrations FOR DELETE TO authenticated
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- ── 9. Update RLS: CONVERSATIONS ──

DROP POLICY IF EXISTS "Users can view company conversations" ON public.conversations;
CREATE POLICY "Users view dept conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
    )
  );

-- INSERT/UPDATE keep company scope (dept set automatically by trigger)
DROP POLICY IF EXISTS "Users can insert company conversations" ON public.conversations;
CREATE POLICY "Users insert conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can update company conversations" ON public.conversations;
CREATE POLICY "Users update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id());

-- ── 10. Trigger: conversations auto-inherit department_id from integration ──

CREATE OR REPLACE FUNCTION public.auto_set_conversation_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL AND NEW.integration_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id
    FROM public.integrations
    WHERE id = NEW.integration_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_conversation_department ON public.conversations;
CREATE TRIGGER set_conversation_department
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_conversation_department();
