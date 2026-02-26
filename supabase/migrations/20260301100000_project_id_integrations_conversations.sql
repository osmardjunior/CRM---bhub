-- Migration: add project_id to integrations + conversations
-- Adds helper SQL functions, triggers (auto-inherit + anti-mixing), RLS, and seed data.

-- ── 1. project_id on integrations ───────────────────────────────────────────
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_integrations_project
  ON integrations(project_id) WHERE project_id IS NOT NULL;

-- ── 2. project_id on conversations ──────────────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_project_status
  ON conversations(project_id, status, last_message_at DESC)
  WHERE project_id IS NOT NULL;

-- ── 3. Helper RLS functions ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_project_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(array_agg(up.project_id), '{}'::uuid[])
  FROM user_projects up
  WHERE up.user_id = auth.uid() AND up.active = true;
$$;

CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_projects
    WHERE user_id = auth.uid()
      AND project_id = p_project_id
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION is_dept_role(p_dept_id uuid, p_roles text[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_departments
    WHERE profile_id = auth.uid()
      AND department_id = p_dept_id
      AND role_in_department = ANY(p_roles)
  );
$$;

-- ── 4. Trigger: auto-inherit project_id from integration ────────────────────

CREATE OR REPLACE FUNCTION auto_set_conversation_project()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.integration_id IS NOT NULL AND NEW.project_id IS NULL THEN
    SELECT project_id INTO NEW.project_id
    FROM integrations WHERE id = NEW.integration_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_project ON conversations;
CREATE TRIGGER trg_conversation_project
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION auto_set_conversation_project();

-- ── 5. Trigger: anti-mixing constraint ──────────────────────────────────────

CREATE OR REPLACE FUNCTION check_conversation_project_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_integration_project uuid;
BEGIN
  IF NEW.integration_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    SELECT project_id INTO v_integration_project
    FROM integrations WHERE id = NEW.integration_id;
    IF v_integration_project IS NOT NULL
       AND v_integration_project <> NEW.project_id THEN
      RAISE EXCEPTION
        'conversation.project_id (%) diverges from integration.project_id (%)',
        NEW.project_id, v_integration_project;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_conversation_project ON conversations;
CREATE TRIGGER trg_check_conversation_project
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION check_conversation_project_consistency();

-- ── 6. RLS — projects ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "projects_select"              ON projects;
DROP POLICY IF EXISTS "projects_insert_update_delete" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      has_role(auth.uid(), 'admin')
      OR department_id = ANY(get_user_department_ids())
    )
  );

CREATE POLICY "projects_insert_update_delete" ON projects
  FOR ALL
  USING    (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── 7. RLS — user_projects ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_projects_select" ON user_projects;
DROP POLICY IF EXISTS "user_projects_manage" ON user_projects;

CREATE POLICY "user_projects_select" ON user_projects
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM projects p
      JOIN profile_departments pd ON pd.department_id = p.department_id
      WHERE p.id = project_id
        AND pd.profile_id = auth.uid()
        AND pd.role_in_department IN ('admin','supervisor')
    )
  );

CREATE POLICY "user_projects_manage" ON user_projects
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM projects p
      JOIN profile_departments pd ON pd.department_id = p.department_id
      WHERE p.id = project_id
        AND pd.profile_id = auth.uid()
        AND pd.role_in_department IN ('admin','supervisor')
    )
  );

-- ── 8. Seed mínimo ──────────────────────────────────────────────────────────
-- Inserts "Atendimento" department and 3 projects linked to the first company.
-- Admins will assign projects to users via the UI.

DO $$
DECLARE
  v_company_id  uuid;
  v_dept_id     uuid;
  v_proj_name   text;
BEGIN
  SELECT id INTO v_company_id FROM companies LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN; -- no company yet, skip seed
  END IF;

  -- Insert "Atendimento" department if it doesn't exist for this company
  INSERT INTO departments (company_id, name)
    SELECT v_company_id, 'Atendimento'
    WHERE NOT EXISTS (
      SELECT 1 FROM departments WHERE company_id = v_company_id AND name = 'Atendimento'
    );

  SELECT id INTO v_dept_id FROM departments
    WHERE company_id = v_company_id AND name = 'Atendimento' LIMIT 1;

  IF v_dept_id IS NULL THEN
    RETURN; -- dept not found, skip projects
  END IF;

  FOREACH v_proj_name IN ARRAY ARRAY['TipsPlace','Davi Couto','Rei dos Cantos'] LOOP
    INSERT INTO projects (company_id, department_id, name)
    VALUES (v_company_id, v_dept_id, v_proj_name)
    ON CONFLICT (company_id, department_id, name) DO NOTHING;
  END LOOP;
END;
$$;
