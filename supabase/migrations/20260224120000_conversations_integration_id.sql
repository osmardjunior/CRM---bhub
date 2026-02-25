-- Add integration_id to conversations so we always know which WhatsApp number
-- (or other channel integration) a conversation belongs to.
-- NULL for legacy rows created before this migration.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL;

-- Index for the join used in send-whatsapp lookup
CREATE INDEX IF NOT EXISTS idx_conversations_integration_id
  ON conversations (integration_id);

-- Backfill: for existing conversations, assign the first matching connected
-- integration based on company + channel (best-effort for legacy data).
-- Cast integrations.channel to text to compare with conversations.channel enum.
UPDATE conversations c
SET integration_id = (
  SELECT i.id
  FROM integrations i
  WHERE i.company_id = c.company_id
    AND i.channel::text = c.channel::text
    AND i.status = 'connected'
  ORDER BY i.created_at
  LIMIT 1
)
WHERE c.integration_id IS NULL;
