
-- Enable realtime for messages and conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Create conversation_reads table
CREATE TABLE public.conversation_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads"
  ON public.conversation_reads FOR SELECT
  USING (company_id = get_user_company_id() AND user_id = auth.uid());

CREATE POLICY "Users can upsert own reads"
  ON public.conversation_reads FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND user_id = auth.uid());

CREATE POLICY "Users can update own reads"
  ON public.conversation_reads FOR UPDATE
  USING (company_id = get_user_company_id() AND user_id = auth.uid());

-- Auto-set company_id trigger
CREATE TRIGGER trg_conversation_reads_auto_company
  BEFORE INSERT ON public.conversation_reads
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();
