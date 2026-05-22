-- Add project_id to company_files for per-project file isolation
ALTER TABLE company_files ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index for efficient project-scoped queries
CREATE INDEX IF NOT EXISTS idx_company_files_project_id ON company_files(project_id) WHERE project_id IS NOT NULL;
