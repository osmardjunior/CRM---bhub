-- Migration: add wa_identifier_raw to contacts
-- Purpose: store LID/@lid device identifiers separately from phone numbers
-- LID contacts arrive via WhatsApp multi-device and have no E.164 phone number.

-- 1. Add wa_identifier_raw column (stores @lid JIDs like "12345678901234@lid")
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS wa_identifier_raw TEXT;

-- 2. CHECK constraint: phone_e164 must never contain "@" (JID/LID) or be a raw ID
--    This prevents the bug where "12345678901234" (a device ID) was stored as phone.
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS chk_phone_e164_no_at;
ALTER TABLE contacts
  ADD CONSTRAINT chk_phone_e164_no_at
    CHECK (phone_e164 IS NULL OR phone_e164 NOT LIKE '%@%');

ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS chk_phone_e164_format;
ALTER TABLE contacts
  ADD CONSTRAINT chk_phone_e164_format
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[0-9]{7,15}$');

-- 3. Index for LID contact lookups (wa_identifier_raw-based instead of phone-based)
CREATE INDEX IF NOT EXISTS idx_contacts_wa_identifier_raw
  ON contacts(company_id, wa_identifier_raw)
  WHERE wa_identifier_raw IS NOT NULL;

-- 4. Clean up any existing contacts where phone stores an ID (14+ digits, no E.164 format)
--    These were incorrectly stored by the old normalizeWhatsAppPhone fallback.
UPDATE contacts
SET
  wa_identifier_raw = phone || '@lid',
  phone = NULL,
  phone_e164 = NULL
WHERE
  phone IS NOT NULL
  AND phone ~ '^\d{14,18}$'           -- 14-18 raw digits (LID range)
  AND phone NOT LIKE '+%'             -- not E.164
  AND LEFT(phone, 2) != '55';        -- doesn't start with BR country code
