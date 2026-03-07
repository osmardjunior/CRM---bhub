-- Add department_id and project_id to chatbot_flows for folder navigation
ALTER TABLE chatbot_flows
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chatbot_flows_dept ON chatbot_flows(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_project ON chatbot_flows(project_id) WHERE project_id IS NOT NULL;
