
-- Alias function current_company_id() -> get_user_company_id()
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Add updated_at columns
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set company_id on INSERT for contacts, conversations, messages
CREATE OR REPLACE FUNCTION public.auto_set_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := current_company_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_auto_company BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();
CREATE TRIGGER trg_conversations_auto_company BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();
CREATE TRIGGER trg_messages_auto_company BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- Tighten profiles: only admin can update other profiles (user can update own)
-- Already exists: "Users can update own profile" with (id = auth.uid())
-- Add: admin can update any profile in same company
CREATE POLICY "Admins can update company profiles"
ON public.profiles
FOR UPDATE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Add missing DELETE policy for conversations (admin only)
CREATE POLICY "Admins can delete conversations"
ON public.conversations
FOR DELETE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));
