
-- Add channels column to chatbot_flows
ALTER TABLE chatbot_flows ADD COLUMN IF NOT EXISTS channels jsonb DEFAULT '{}';

-- Add new node types to the enum
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'apply_tag';
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'move_to_funnel';
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'delegate';
