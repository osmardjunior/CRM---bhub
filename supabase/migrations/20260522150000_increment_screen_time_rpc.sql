CREATE OR REPLACE FUNCTION public.increment_screen_time(
  p_user_id uuid,
  p_company_id uuid,
  p_date date,
  p_seconds integer,
  p_now timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.screen_time (user_id, company_id, date, total_seconds, last_heartbeat_at)
  VALUES (p_user_id, p_company_id, p_date, p_seconds, p_now)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_seconds = screen_time.total_seconds + p_seconds,
    last_heartbeat_at = p_now,
    updated_at = now();
END;
$$;
