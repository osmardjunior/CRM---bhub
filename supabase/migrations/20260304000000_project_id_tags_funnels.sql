-- Add project_id (optional) to tags and funnels tables
-- This allows tags and funnels to be scoped to a specific project within a department

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tags_project ON tags(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE funnels
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funnels_project ON funnels(project_id) WHERE project_id IS NOT NULL;
