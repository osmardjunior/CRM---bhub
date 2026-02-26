-- Migration: projects + user_projects + role_in_department
-- Adds Projects as an intermediate layer between departments and integrations/conversations.

-- 1. Add role_in_department to profile_departments (backward-compatible, default 'agent')
ALTER TABLE profile_departments
  ADD COLUMN IF NOT EXISTS role_in_department text NOT NULL
    DEFAULT 'agent'
    CHECK (role_in_department IN ('admin','supervisor','agent'));

-- 2. Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid        NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  name          text        NOT NULL,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, department_id, name)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 3. Create user_projects table
CREATE TABLE IF NOT EXISTS user_projects (
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid    NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_company_dept
  ON projects(company_id, department_id);

CREATE INDEX IF NOT EXISTS idx_projects_active
  ON projects(company_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_projects_user
  ON user_projects(user_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_projects_project
  ON user_projects(project_id) WHERE active = true;
