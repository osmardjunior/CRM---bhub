-- Add configurable delay and contact exclusion to campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS excluded_contact_ids jsonb DEFAULT '[]'::jsonb;

-- Constraint: min_delay_seconds >= 2
ALTER TABLE campaigns
  ADD CONSTRAINT chk_min_delay CHECK (min_delay_seconds >= 2);

-- Constraint: max_delay >= min_delay
ALTER TABLE campaigns
  ADD CONSTRAINT chk_max_delay CHECK (max_delay_seconds >= min_delay_seconds);
