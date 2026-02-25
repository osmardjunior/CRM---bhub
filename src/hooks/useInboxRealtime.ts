import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { markConversationRead } from '@/services/api';
import type { ConversationDetail, MessageWithSender } from '@/services/api';

/**
 * Subscribes to realtime changes on messages, conversations, and annotations.
 *
 * Strategy:
 * - New message in the selected conversation → INSERT directly into React Query cache
 *   (no DB refetch, sub-50ms latency from webhook to screen)
 * - New message in other conversations → debounced invalidation of conversation list
 * - Conversation status/assignment change → immediate list invalidation
 * - Sidebar badge → debounced invalidation
 *
 * IMPORTANT: selectedConversationId is stored in a ref so that the Supabase channel
 * is NOT recreated every time the user switches conversations. The channel persists
 * for the entire session (until companyId changes), preventing the ~300-500ms
 * reconnection window where events would be silently lost.
 */
export function useInboxRealtime(selectedConversationId: string | null) {
  const queryClient = useQueryClient();
  const { companyId, user, profile } = useAuth();

  // Stable ref — updated synchronously but does NOT trigger channel recreation
  const selectedIdRef = useRef(selectedConversationId);

  // Keep ref in sync with prop without rebuilding the channel
  useEffect(() => {
    selectedIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // Debounce references to avoid invalidating on every rapid-fire message
  const listInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scheduleListInvalidate = () => {
    if (listInvalidateTimer.current) clearTimeout(listInvalidateTimer.current);
    listInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }, 200); // coalesce bursts — reduced from 800ms for snappier UI
  };

  const scheduleStatsInvalidate = () => {
    if (statsInvalidateTimer.current) clearTimeout(statsInvalidateTimer.current);
    statsInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
    }, 300); // reduced from 1000ms
  };

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`inbox-rt-${companyId}`)

      // ── New message ──────────────────────────────────────────────────────
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: any) => {
          const msg = payload.new as MessageWithSender & Record<string, unknown>;
          if (!msg) return;

          if (msg.conversation_id === selectedIdRef.current) {
            // ── Surgical cache insert: message appears in < 50ms ────────────
            queryClient.setQueryData<ConversationDetail>(
              ['conversation', selectedIdRef.current],
              (old) => {
                if (!old) return old;
                // Replace optimistic placeholder if exists, otherwise append
                const withoutOptimistic = old.messages.filter(
                  (m) => !(m.id as string).startsWith('optimistic-'),
                );
                const alreadyExists = withoutOptimistic.some((m) => m.id === msg.id);
                if (alreadyExists) return old;
                return {
                  ...old,
                  messages: [...withoutOptimistic, msg as unknown as MessageWithSender],
                };
              },
            );
            // User is actively viewing this conversation — mark as read immediately
            // unless spy_mode is enabled (supervisor monitoring without clearing notifications).
            if (user && companyId && !(profile as any)?.spy_mode) {
              markConversationRead(selectedIdRef.current, {
                userId: user.id,
                companyId,
              }).catch(() => {});
            }
            // Still update list order (last message preview), but NOT stats/unread counts
            scheduleListInvalidate();
          } else {
            // Message in a background conversation — update everything including unread
            scheduleListInvalidate();
            scheduleStatsInvalidate();
          }
        },
      )

      // ── Conversation updated (status, assignment, etc.) ──────────────────
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: any) => {
          const updated = payload.new as Record<string, unknown>;
          // Update selected conversation detail if it changed
          if (updated?.id === selectedIdRef.current) {
            queryClient.invalidateQueries({ queryKey: ['conversation', selectedIdRef.current] });
          }
          scheduleListInvalidate();
          scheduleStatsInvalidate();
        },
      )

      // ── New conversation ─────────────────────────────────────────────────
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          scheduleListInvalidate();
          scheduleStatsInvalidate();
        },
      )

      // ── Message updated (delivery_status, etc.) ──────────────────────────
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: any) => {
          const msg = payload.new as MessageWithSender & Record<string, unknown>;
          if (!msg || msg.conversation_id !== selectedIdRef.current) return;
          // Patch the specific message in cache (e.g., delivery_status → 'failed')
          queryClient.setQueryData<ConversationDetail>(
            ['conversation', selectedIdRef.current],
            (old) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.map((m) =>
                  m.id === msg.id ? { ...m, ...(msg as unknown as MessageWithSender) } : m,
                ),
              };
            },
          );
        },
      )

      // ── New annotation ───────────────────────────────────────────────────
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'annotations',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: any) => {
          const ann = payload.new as Record<string, unknown>;
          if (ann?.conversation_id === selectedIdRef.current) {
            queryClient.invalidateQueries({ queryKey: ['conversation', selectedIdRef.current] });
            queryClient.invalidateQueries({ queryKey: ['annotations', selectedIdRef.current] });
          }
        },
      )

      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (status === 'CHANNEL_ERROR') console.error('[Realtime] Erro no canal inbox:', err);
          else console.warn('[Realtime] Timeout — reconectando em 3s');
          // Força invalidação para recuperar mensagens perdidas
          queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
          queryClient.invalidateQueries({ queryKey: ['conversation'] });
          // Reconectar após 3 segundos
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          reconnectTimer.current = setTimeout(() => {
            console.log('[Realtime] 🔄 Tentando reconectar...');
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            // Forçar remontagem invalidando companyId (via queryClient trigger)
            queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
          }, 3_000);
        } else if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Inbox realtime ativo');
          // Limpar timer de reconexão se conectou com sucesso
          if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
          }
        }
      });

    channelRef.current = channel;

    return () => {
      if (listInvalidateTimer.current) clearTimeout(listInvalidateTimer.current);
      if (statsInvalidateTimer.current) clearTimeout(statsInvalidateTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // selectedConversationId is intentionally NOT in deps — it's tracked via selectedIdRef
    // so the channel persists across conversation switches (no reconnection window).
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps
}
