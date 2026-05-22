-- Rate limiting table for WhatsApp message sends per integration
-- Tracks each outbound message timestamp to enforce per-minute/hour/day limits
CREATE TABLE IF NOT EXISTS send_rate_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized index for rate limit lookups (integration + recent timestamps)
CREATE INDEX IF NOT EXISTS idx_send_rate_log_lookup ON send_rate_log(integration_id, sent_at DESC);

-- Auto-cleanup function: remove entries older than 25 hours
CREATE OR REPLACE FUNCTION cleanup_old_rate_logs() RETURNS void AS $$
BEGIN
  DELETE FROM send_rate_log WHERE sent_at < NOW() - INTERVAL '25 hours';
END;
$$ LANGUAGE plpgsql;

-- RLS: service role only (edge functions use service role key)
ALTER TABLE send_rate_log ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role can access (which is what we want)
