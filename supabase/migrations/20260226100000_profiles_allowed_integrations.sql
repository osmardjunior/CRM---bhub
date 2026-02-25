-- Which integrations (WhatsApp numbers) this user can receive messages from.
-- NULL = receives from ALL integrations (default behavior).
-- Array of integration IDs = receives only from those numbers.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_integration_ids UUID[] DEFAULT NULL;
