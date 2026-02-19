
-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company departments"
  ON public.departments FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can insert departments"
  ON public.departments FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update departments"
  ON public.departments FOR UPDATE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete departments"
  ON public.departments FOR DELETE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Auto-set company_id trigger
CREATE TRIGGER set_departments_company_id
  BEFORE INSERT ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_company_id();
