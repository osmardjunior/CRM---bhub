-- Track daily screen time per agent via presence heartbeat
CREATE TABLE IF NOT EXISTS public.screen_time (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_seconds integer NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_screen_time_company_date ON public.screen_time(company_id, date);
CREATE INDEX IF NOT EXISTS idx_screen_time_user_date ON public.screen_time(user_id, date);

-- RLS
ALTER TABLE public.screen_time ENABLE ROW LEVEL SECURITY;

-- Agents can upsert their own screen time
CREATE POLICY "Users can upsert own screen_time"
  ON public.screen_time
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all screen_time in their company
CREATE POLICY "Admins can read company screen_time"
  ON public.screen_time
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );
