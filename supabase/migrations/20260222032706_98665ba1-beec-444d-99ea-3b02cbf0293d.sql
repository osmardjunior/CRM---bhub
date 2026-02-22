
-- Add missing enum values for chatbot_node_type
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'close_chat';
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'delay';
ALTER TYPE chatbot_node_type ADD VALUE IF NOT EXISTS 'webhook';

-- Merge duplicate contacts: move conversations to the oldest contact
WITH duplicates AS (
  SELECT company_id, phone,
    array_agg(id ORDER BY created_at ASC) AS ids
  FROM contacts
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY company_id, phone
  HAVING count(*) > 1
)
UPDATE conversations c
SET contact_id = d.ids[1]
FROM duplicates d
WHERE c.contact_id = ANY(d.ids[2:])
  AND c.company_id = d.company_id;

-- Also move contact_tags, contact_assignees, contact_funnel_stages, deals, tasks, satisfaction_surveys
WITH duplicates AS (
  SELECT company_id, phone,
    (array_agg(id ORDER BY created_at ASC))[1] AS keep_id,
    array_agg(id ORDER BY created_at ASC) AS ids
  FROM contacts
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY company_id, phone
  HAVING count(*) > 1
)
UPDATE deals d2
SET contact_id = dup.keep_id
FROM duplicates dup
WHERE d2.contact_id = ANY(dup.ids[2:])
  AND d2.company_id = dup.company_id;

WITH duplicates AS (
  SELECT company_id, phone,
    (array_agg(id ORDER BY created_at ASC))[1] AS keep_id,
    array_agg(id ORDER BY created_at ASC) AS ids
  FROM contacts
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY company_id, phone
  HAVING count(*) > 1
)
UPDATE tasks t
SET contact_id = dup.keep_id
FROM duplicates dup
WHERE t.contact_id = ANY(dup.ids[2:])
  AND t.company_id = dup.company_id;

-- Delete duplicate contacts (keep the oldest)
WITH duplicates AS (
  SELECT company_id, phone,
    (array_agg(id ORDER BY created_at ASC))[1] AS keep_id
  FROM contacts
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY company_id, phone
  HAVING count(*) > 1
)
DELETE FROM contacts c
USING duplicates d
WHERE c.company_id = d.company_id
  AND c.phone = d.phone
  AND c.id != d.keep_id;

-- Add UNIQUE constraint to prevent future duplicates
ALTER TABLE contacts
  ADD CONSTRAINT contacts_company_phone_unique
  UNIQUE (company_id, phone);
