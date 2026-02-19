
-- Add multi-device columns to integrations
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '';
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS restrict_users UUID[] DEFAULT '{}';
