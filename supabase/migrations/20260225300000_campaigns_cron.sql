-- Cron job: trigger scheduled campaigns every minute
-- Uses the same pattern as process-scheduled-messages

CREATE OR REPLACE FUNCTION public.invoke_execute_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwamlnb2h0Y2Fnb3ZscWVqcHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzY2NjgsImV4cCI6MjA4NzMxMjY2OH0.F-115tqaHkiXp_gKztS0SDu089aVum03CaYMDkzUakc';
  _url      text := 'https://ypjigohtcagovlqejppl.supabase.co/functions/v1/execute-campaign';
BEGIN
  PERFORM net.http_post(
    url     := _url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'apikey',        _anon_key,
                 'Authorization', 'Bearer ' || _anon_key
               ),
    body    := '{}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'invoke_execute_campaigns failed: %', SQLERRM;
END;
$$;

-- Schedule: run every minute
SELECT cron.schedule(
  'execute-scheduled-campaigns',
  '* * * * *',
  'SELECT public.invoke_execute_campaigns()'
);
