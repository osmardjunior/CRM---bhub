-- Migration: fix RLS to allow project members (via user_projects) to access
-- their projects and conversations, even without profile_departments entry.

-- ── 1. projects SELECT ───────────────────────────────────────────────────────
-- Add: OR id = ANY(get_user_project_ids())
-- so agents added via user_projects can read their assigned projects.

DROP POLICY IF EXISTS "projects_select" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
      OR id = ANY(get_user_project_ids())
    )
  );

-- ── 2. conversations SELECT ──────────────────────────────────────────────────
-- Add: OR (project_id IS NOT NULL AND project_id = ANY(get_user_project_ids()))
-- OR assigned_user_id = auth.uid()
-- so agents can see conversations in their projects or assigned to them.

DROP POLICY IF EXISTS "Users view dept conversations" ON public.conversations;

CREATE POLICY "Users view dept conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
      OR (project_id IS NOT NULL AND project_id = ANY(get_user_project_ids()))
      OR assigned_user_id = auth.uid()
    )
  );
