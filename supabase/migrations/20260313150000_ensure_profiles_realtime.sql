-- Ensure profiles table is in the realtime publication
-- and has REPLICA IDENTITY FULL so UPDATE events include all columns.
-- This is critical for the Dashboard's live online/offline status indicators.

DO $$
BEGIN
  -- Add to publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- REPLICA IDENTITY FULL is idempotent — safe to run multiple times
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
