-- Add 'new' and 'resolved' to the conversation_status enum
ALTER TYPE public.conversation_status ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE public.conversation_status ADD VALUE IF NOT EXISTS 'resolved';

-- When a new inbound message arrives on a closed/resolved conversation,
-- the incoming-message function will reopen it to 'new'.
-- Existing conversations default to their current status — no data migration needed.
