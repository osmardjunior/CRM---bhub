
-- Create saved_reports table
CREATE TABLE public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'chats',
  filters JSONB NOT NULL DEFAULT '{}',
  show_on_home BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER set_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_saved_reports_company_id
  BEFORE INSERT ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- RLS: all company users can view
CREATE POLICY "Users can view company reports"
  ON public.saved_reports FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- RLS: authenticated users can create
CREATE POLICY "Users can create reports"
  ON public.saved_reports FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id() AND created_by = auth.uid());

-- RLS: creator or admin can update
CREATE POLICY "Creator or admin can update reports"
  ON public.saved_reports FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id() AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin')));

-- RLS: creator or admin can delete
CREATE POLICY "Creator or admin can delete reports"
  ON public.saved_reports FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id() AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin')));
