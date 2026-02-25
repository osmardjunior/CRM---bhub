-- Drop the unique constraint that prevents adding multiple integrations
-- of the same channel (e.g., multiple WhatsApp/Evolution numbers per company).
-- A company should be able to connect as many numbers as needed.
ALTER TABLE integrations
  DROP CONSTRAINT IF EXISTS integrations_company_id_channel_key;

-- Optional: add a less restrictive unique constraint on
-- (company_id, channel, provider, phone_number) so duplicate phone numbers
-- from the same provider are still rejected, but different numbers are allowed.
-- Uncomment the line below if you want that protection:
-- CREATE UNIQUE INDEX IF NOT EXISTS integrations_company_channel_provider_phone_key
--   ON integrations (company_id, channel, provider, phone_number)
--   WHERE phone_number IS NOT NULL;
