-- Prevent duplicate contacts with the same phone within the same company
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique_phone_company
  ON public.contacts(company_id, phone)
  WHERE phone IS NOT NULL AND phone <> '';
