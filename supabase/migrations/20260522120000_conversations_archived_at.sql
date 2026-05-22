-- Add archived_at to conversations for persistent archive/mute behavior
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Index for filtering archived conversations efficiently
CREATE INDEX IF NOT EXISTS idx_conversations_archived
  ON public.conversations(company_id, archived_at)
  WHERE archived_at IS NOT NULL;
