-- Fix: send_rate_log was never auto-cleaned, growing infinitely and causing 504s
-- 1. Delete all old entries immediately
DELETE FROM send_rate_log WHERE sent_at < NOW() - INTERVAL '25 hours';

-- 2. Schedule automatic cleanup via pg_cron (runs every hour)
-- pg_cron is available on Supabase pro+ plans; on free tier this is a no-op
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_rate_logs');
    PERFORM cron.schedule('cleanup_rate_logs', '0 * * * *', 'DELETE FROM send_rate_log WHERE sent_at < NOW() - INTERVAL ''25 hours''');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skipping auto-cleanup schedule';
END $$;
