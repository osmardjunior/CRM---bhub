-- Add media attachment support to quick replies
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS media_file_name TEXT;
