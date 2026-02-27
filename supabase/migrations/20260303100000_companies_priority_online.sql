-- Add priority_online_agents flag to companies
-- When true, round-robin picks online agents first (last_seen_at within 5 minutes)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS priority_online_agents boolean NOT NULL DEFAULT false;
