-- Add last_message_preview column to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

-- Trigger to auto-update last_message_preview when a new message is inserted
CREATE OR REPLACE FUNCTION update_conversation_last_message_preview()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_preview = LEFT(NEW.body, 120)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_last_message_preview ON messages;
CREATE TRIGGER trg_update_last_message_preview
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message_preview();

-- Backfill existing conversations with latest message preview
UPDATE conversations c
SET last_message_preview = sub.body
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    LEFT(body, 120) AS body
  FROM messages
  ORDER BY conversation_id, created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.last_message_preview IS NULL;
