-- Fix: Replace partial unique index with proper UNIQUE CONSTRAINT
-- The partial index (WHERE phone IS NOT NULL AND phone <> '') was NOT recognized
-- by PostgreSQL for ON CONFLICT resolution, causing the upsert in incoming-message
-- to INSERT new contacts instead of updating existing ones → duplicate contacts.

-- Convert empty string phones to NULL
UPDATE contacts SET phone = NULL WHERE phone = '';

-- Drop the partial index
DROP INDEX IF EXISTS idx_contacts_unique_phone_company;

-- Create proper UNIQUE constraint (NULLs are treated as distinct, so LID contacts with NULL phone are fine)
ALTER TABLE contacts ADD CONSTRAINT uq_contacts_company_phone UNIQUE (company_id, phone);

-- Prevent duplicate active conversations for the same contact+integration (race condition protection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_unique_active_contact_integration
ON conversations(company_id, contact_id, channel, COALESCE(integration_id, '00000000-0000-0000-0000-000000000000'))
WHERE status NOT IN ('closed', 'resolved');
