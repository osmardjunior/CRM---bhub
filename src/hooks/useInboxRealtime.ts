import { useEffect, useRef, useState } from 'react';
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
export function useInboxRealtime(selectedConversationId: string | null, onBackgroundMessage?: () => void, listFrozen?: boolean): { isSubscribed: boolean } {
  const queryClient = useQueryClient();
  const { companyId, user, profile } = useAuth();
  const [reconnectCount, setReconnectCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Stable ref — updated synchronously but does NOT trigger channel recreation
  const selectedIdRef = useRef(selectedConversationId);
  const onBackgroundMsgRef = useRef(onBackgroundMessage);
  const listFrozenRef = useRef(listFrozen ?? false);

  // Keep refs in sync with props without rebuilding the channel
  useEffect(() => {
    selectedIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    onBackgroundMsgRef.current = onBackgroundMessage;
  }, [onBackgroundMessage]);

  useEffect(() => {
    listFrozenRef.current = listFrozen ?? false;
  }, [listFrozen]);

  // Debounce references to avoid invalidating on every rapid-fire message
  const listInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scheduleListInvalidate = () => {
    if (listFrozenRef.current) return;
    if (listInvalidateTimer.current) clearTimeout(listInvalidateTimer.current);
    listInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }, 200);
  };

  // Surgical in-place update: updates preview text without reordering the list
  const patchConversationPreview = (convId: string, preview: string | null) => {
    queryClient.setQueriesData<{ pages: ConversationWithRelations[][]; pageParams: unknown[] }>(
      { queryKey: ['conversations-infinite'] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((conv) =>
              conv.id === convId ? { ...conv, last_message_preview: preview } : conv,
            ),
          ),
        };
      },
    );
  };

  const scheduleStatsInvalidate = (incrementConvId?: string) => {
    // Optimistic: immediately bump unread count for the conversation that got a new message
    if (incrementConvId) {
      queryClient.setQueriesData<Record<string, number>>(
        { queryKey: ['unread-counts'] },
        (old) => old ? { ...old, [incrementConvId]: (old[incrementConvId] ?? 0) + 1 } : old,
      );
    }
    if (statsInvalidateTimer.current) clearTimeout(statsInvalidateTimer.current);
    statsInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
    }, 300);
  };

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`inbox-rt-${companyId}`)

      // ── New message ──────────────────────────────────────────────────────
      .on(
        // @ts-expect-error supabase-js RealtimeChannel.on() type mismatch
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: any) => {
          const msg = payload.new as MessageWithSender & Record<string, unknown>;
          if (!msg) return;

          // Play notification sound for ANY lead message (selected or background)
          if (msg.sender_type === 'user') {
            onBackgroundMsgRef.current?.();
          }

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

                // Resolve reply_to context from existing messages in cache
                let enrichedMsg = msg as unknown as MessageWithSender;
                const replyToId = (msg as Record<string, unknown>).reply_to_id as string | undefined;
                if (replyToId) {
                  const parent = withoutOptimistic.find((m) => m.id === replyToId);
                  if (parent) {
                    enrichedMsg = {
                      ...enrichedMsg,
                      reply_to: {
                        id: parent.id!,
                        body: parent.body ?? null,
                        sender_type: parent.sender_type,
                        sender_name: parent.sender_name ?? parent.sender?.name ?? null,
                      },
                    } as MessageWithSender;
                  }
                }

                return {
                  ...old,
                  messages: [...withoutOptimistic, enrichedMsg],
                };
              },
            );
            // User is actively viewing this conversation — mark as read immediately
            // unless spy_mode is enabled (supervisor monitoring without clearing notifications).
            if (user && companyId && !profile?.spy_mode) {
              // Optimistic: zero badge immediately
              queryClient.setQueriesData<Record<string, number>>(
                { queryKey: ['unread-counts'] },
                (old) => old ? { ...old, [selectedIdRef.current!]: 0 } : old,
              );
              markConversationRead(selectedIdRef.current, {
                userId: user.id,
                companyId,
              }).catch(() => {});
            }
            // Update preview in-place without reordering the list
            patchConversationPreview(selectedIdRef.current!, msg.body as string | null);
          } else {
            // Message in a background conversation — update preview in-place without reordering
            patchConversationPreview(msg.conversation_id as string, msg.body as string | null);
            // Optimistic increment so badge appears instantly without waiting for DB
            const isContactMsg = msg.sender_type === 'user' || msg.sender_type === 'system';
            scheduleStatsInvalidate(isContactMsg ? (msg.conversation_id as string) : undefined);
          }
        },
      )

      // ── Conversation updated (status, assignment, etc.) ──────────────────
      .on(
        // @ts-expect-error supabase-js RealtimeChannel.on() type mismatch
        'postgres_changes',
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
        // @ts-expect-error supabase-js RealtimeChannel.on() type mismatch
        'postgres_changes',
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
        // @ts-expect-error supabase-js RealtimeChannel.on() type mismatch
        'postgres_changes',
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
        // @ts-expect-error supabase-js RealtimeChannel.on() type mismatch
        'postgres_changes',
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
          setIsSubscribed(false);
          if (status === 'CHANNEL_ERROR') console.error('[Realtime] Erro no canal inbox:', err);
          else console.warn('[Realtime] Timeout — reconectando em 3s');
          // Força invalidação para recuperar mensagens perdidas
          queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
          queryClient.invalidateQueries({ queryKey: ['conversation'] });
          // Reconectar após 3 segundos
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          reconnectTimer.current = setTimeout(() => {
            console.log('[Realtime] Tentando reconectar...');
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            // Trigger useEffect re-run to recreate the channel
            setReconnectCount(c => c + 1);
          }, 3_000);
        } else if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          console.log('[Realtime] Inbox realtime ativo');
          // Limpar timer de reconexão se conectou com sucesso
          if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
          }
        }
      });

    channelRef.current = channel;

    // ── Visibility change: recover from sleep/tab-switch ─────────────────
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      // Force-invalidate caches to recover any messages lost while hidden
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
      if (selectedIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['conversation', selectedIdRef.current] });
      }
      // Check if channel is still alive — if not, trigger reconnect
      if (channelRef.current?.state !== 'joined') {
        console.log('[Realtime] Canal morto após visibilitychange — reconectando...');
        supabase.removeChannel(channelRef.current!);
        channelRef.current = null;
        setReconnectCount(c => c + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (listInvalidateTimer.current) clearTimeout(listInvalidateTimer.current);
      if (statsInvalidateTimer.current) clearTimeout(statsInvalidateTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsSubscribed(false);
    };
    // selectedConversationId is intentionally NOT in deps — it's tracked via selectedIdRef
    // so the channel persists across conversation switches (no reconnection window).
  }, [companyId, reconnectCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isSubscribed };
}

/**
 * Subscribe to typing broadcast for a specific conversation.
 * Returns true when the contact is typing.
 */
export function useTypingIndicator(conversationId: string | null): boolean {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as { is_typing: boolean };
        setIsTyping(data.is_typing);
        if (data.is_typing) {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsTyping(false), 5000);
        } else {
          if (typingTimer.current) clearTimeout(typingTimer.current);
        }
      })
      .subscribe();

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      setIsTyping(false);
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return isTyping;
}
