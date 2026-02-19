
CREATE TABLE public.quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  shortcut TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT quick_replies_shortcut_check CHECK (shortcut ~ '^[a-zA-Z0-9_]+$'),
  CONSTRAINT quick_replies_shortcut_length CHECK (char_length(shortcut) <= 50),
  CONSTRAINT quick_replies_message_length CHECK (char_length(message) <= 2000)
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quick replies"
  ON public.quick_replies FOR SELECT
  USING (user_id = auth.uid() AND company_id = get_user_company_id());

CREATE POLICY "Users can insert own quick replies"
  ON public.quick_replies FOR INSERT
  WITH CHECK (user_id = auth.uid() AND company_id = get_user_company_id());

CREATE POLICY "Users can update own quick replies"
  ON public.quick_replies FOR UPDATE
  USING (user_id = auth.uid() AND company_id = get_user_company_id());

CREATE POLICY "Users can delete own quick replies"
  ON public.quick_replies FOR DELETE
  USING (user_id = auth.uid() AND company_id = get_user_company_id());

CREATE INDEX idx_quick_replies_user_id ON public.quick_replies(user_id);
CREATE INDEX idx_quick_replies_company_id ON public.quick_replies(company_id);

CREATE TRIGGER set_quick_replies_updated_at
  BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
