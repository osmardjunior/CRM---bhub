-- Enable REPLICA IDENTITY FULL for profiles so realtime UPDATE events
-- include the full row (needed for Dashboard presence updates)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
