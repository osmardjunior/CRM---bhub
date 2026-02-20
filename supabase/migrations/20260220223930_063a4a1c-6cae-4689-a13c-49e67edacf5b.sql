
-- 1. Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true);

CREATE POLICY "Users can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

CREATE POLICY "Users can delete own chat media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media');

-- 2. Create annotations table for internal notes
CREATE TABLE public.annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company annotations"
ON public.annotations FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company annotations"
ON public.annotations FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id());

CREATE TRIGGER set_annotations_company_id
  BEFORE INSERT ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();

-- Enable realtime for annotations
ALTER PUBLICATION supabase_realtime ADD TABLE public.annotations;
