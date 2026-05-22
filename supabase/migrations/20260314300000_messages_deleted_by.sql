-- Track who deleted a message so admins can see deleted content + who deleted it
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

NOTIFY pgrst, 'reload schema';
