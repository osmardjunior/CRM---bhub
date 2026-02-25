-- Add department_id to conversations so conversations can be filtered/grouped by department
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_department_id_idx ON public.conversations(department_id);
