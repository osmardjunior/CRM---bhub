
-- Update the cron helper function to embed the anon (public) key directly.
-- This key is safe to store here — it is the same PUBLIC key exposed in the
-- frontend bundle (VITE_SUPABASE_PUBLISHABLE_KEY).  It allows pg_cron to
-- call the Edge Function without requiring superuser ALTER DATABASE SET.
CREATE OR REPLACE FUNCTION public.invoke_process_scheduled_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwamlnb2h0Y2Fnb3ZscWVqcHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzY2NjgsImV4cCI6MjA4NzMxMjY2OH0.F-115tqaHkiXp_gKztS0SDu089aVum03CaYMDkzUakc';
  _url      text := 'https://ypjigohtcagovlqejppl.supabase.co/functions/v1/process-scheduled-messages';
BEGIN
  PERFORM net.http_post(
    url     := _url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'apikey',        _anon_key,
                 'Authorization', 'Bearer ' || _anon_key
               ),
    body    := '{}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_process_scheduled_messages failed: %', SQLERRM;
END;
$$;
