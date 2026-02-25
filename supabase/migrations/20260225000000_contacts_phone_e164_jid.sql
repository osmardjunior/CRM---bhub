-- Migration: add phone_e164 and remote_jid_raw to contacts
-- phone_e164   — número normalizado em formato E.164 (+55DDDNNNNNNNN)
-- remote_jid_raw — JID bruto recebido do webhook da Evolution (para auditoria)

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS remote_jid_raw TEXT;

-- Backfill: converter valores já existentes no campo phone para E.164
-- Heurística conservadora: só converte o que parecer claramente um número BR
UPDATE contacts
SET phone_e164 = CASE
  -- Já tem "+" → assumir E.164 correto
  WHEN phone ~ '^\+' THEN phone
  -- 13 dígitos começando com 55 → +55DDD9NNNNNNNN
  WHEN phone ~ '^55[0-9]{11}$' THEN '+' || phone
  -- 12 dígitos começando com 55 → +55DDDNNNNNNNN
  WHEN phone ~ '^55[0-9]{10}$' THEN '+' || phone
  -- 11 dígitos sem 55 (DDD+9d) → +55DDD9NNNNNNNN
  WHEN phone ~ '^[1-9][0-9]{10}$' THEN '+55' || phone
  ELSE NULL
END
WHERE phone IS NOT NULL AND phone_e164 IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_phone_e164 ON contacts(phone_e164);
