import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const INTERVAL_MS = 60_000; // 60 seconds
const SCREEN_TIME_INCREMENT = 60; // seconds per heartbeat tick
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string;

/**
 * Creates an inline Web Worker that fires a timer message every `ms` milliseconds.
 * Web Worker timers are NOT throttled by the browser when the tab is in the background,
 * unlike setTimeout/setInterval which Chrome throttles to max 1/min in background tabs.
 */
function createWorkerTimer(ms: number, callback: () => void): () => void {
  try {
    const blob = new Blob(
      [`setInterval(()=>postMessage('tick'),${ms})`],
      { type: 'application/javascript' },
    );
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = () => callback();
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    // Fallback: plain setInterval (will be throttled in background)
    const id = setInterval(callback, ms);
    return () => clearInterval(id);
  }
}

/**
 * Updates `profiles.last_seen_at` every 30s so the dashboard
 * can derive online/away/offline status for each agent.
 *
 * Uses a Web Worker timer so heartbeats keep firing even when the
 * tab is in the background (Chrome throttles regular timers to ~1/min).
 *
 * On tab close / beforeunload, clears `last_seen_at` → instant offline.
 */
export function usePresenceHeartbeat() {
  const { user, session, companyId } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Keep token fresh for beforeunload (sync access needed)
  useEffect(() => {
    tokenRef.current = session?.access_token ?? null;
  }, [session?.access_token]);

  useEffect(() => {
    if (!user?.id) return;
    userIdRef.current = user.id;

    const trackScreenTime = async () => {
      if (!companyId) return;
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const now = new Date().toISOString();
      try {
        // Try upsert: increment total_seconds by SCREEN_TIME_INCREMENT
        const { error } = await supabase.rpc('increment_screen_time' as string, {
          p_user_id: user.id,
          p_company_id: companyId,
          p_date: today,
          p_seconds: SCREEN_TIME_INCREMENT,
          p_now: now,
        });
        if (error) {
          // Fallback: direct upsert via REST if RPC doesn't exist yet
          const s = await supabase.auth.getSession();
          const token = s.data.session?.access_token;
          if (token && SUPABASE_URL) {
            await fetch(`${SUPABASE_URL}/rest/v1/screen_time?on_conflict=user_id,date`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify({
                user_id: user.id,
                company_id: companyId,
                date: today,
                total_seconds: SCREEN_TIME_INCREMENT,
                last_heartbeat_at: now,
              }),
            }).catch(() => {});
          }
        }
      } catch {
        // Silent
      }
    };

    const beat = async () => {
      const ts = new Date().toISOString();
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ last_seen_at: ts })
          .eq('id', user.id)
          .select('id, last_seen_at');

        if (error) {
          console.error('[Heartbeat] Error:', error.message, error.code);
        } else if (!data || data.length === 0) {
          // RLS blocked — fallback to raw REST
          const s = await supabase.auth.getSession();
          const token = s.data.session?.access_token;
          if (token && SUPABASE_URL) {
            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({ last_seen_at: ts }),
            }).catch(() => {});
          }
        }
      } catch {
        // Silent — will retry on next tick
      }
      // Also track screen time
      trackScreenTime();
    };

    // Fire immediately
    beat();

    // Web Worker timer — not throttled in background tabs
    const stopWorker = createWorkerTimer(INTERVAL_MS, beat);

    // Also beat on visibility change (instant recovery when switching back)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Synchronous offline signal on page unload
    const goOffline = () => {
      const uid = userIdRef.current;
      const token = tokenRef.current;
      if (!uid || !token || !SUPABASE_URL) return;
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ last_seen_at: null }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', goOffline);

    return () => {
      stopWorker();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', goOffline);
    };
  }, [user?.id]);
}
