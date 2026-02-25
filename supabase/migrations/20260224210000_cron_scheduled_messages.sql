
-- =====================================================================
-- Set up pg_cron to process scheduled messages every minute.
--
-- PREREQUISITE: Before applying this migration, run the following in
-- the Supabase SQL Editor to store the anon key for the cron HTTP call:
--
--   ALTER DATABASE postgres
--     SET "app.settings.supabase_anon_key"
--     TO '<your-anon-public-key>';
--   -- Find the key: Supabase Dashboard → Settings → API → anon/public
--
-- =====================================================================

-- Helper function invoked by pg_cron every minute.
CREATE OR REPLACE FUNCTION public.invoke_process_scheduled_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anon_key text;
  _url      text := 'https://ypjigohtcagovlqejppl.supabase.co/functions/v1/process-scheduled-messages';
BEGIN
  _anon_key := coalesce(
    current_setting('app.settings.supabase_anon_key', true),
    ''
  );

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

-- Remove any existing job with this name before (re-)creating it.
DO $$
BEGIN
  PERFORM cron.unschedule('process-scheduled-messages');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Run every minute.
SELECT cron.schedule(
  'process-scheduled-messages',
  '* * * * *',
  'SELECT public.invoke_process_scheduled_messages();'
);
