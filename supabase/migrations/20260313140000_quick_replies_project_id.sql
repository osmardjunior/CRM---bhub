-- Add project_id to quick_replies so they can be scoped per project
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_project ON quick_replies(project_id);

-- Add project_id to campaigns so they can be scoped per project
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_campaigns_project ON campaigns(project_id);
