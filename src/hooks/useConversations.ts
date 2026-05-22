import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  listConversations,
  getConversation,
  sendMessage,
  sendViaWhatsApp,
  getUnreadCounts,
  markConversationRead,
  type ConversationFilters,
  type ConversationWithRelations,
  type ConversationDetail,
  type MessageWithSender,
} from '@/services/api';

export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => listConversations(filters),
  });
}

export function useInfiniteConversations(
  filters?: Omit<ConversationFilters, 'page'>,
  options?: { frozen?: boolean; realtimeActive?: boolean },
) {
  const { user, role } = useAuth();
  const frozen = options?.frozen ?? false;
  const realtimeActive = options?.realtimeActive ?? false;

  // Agents see only their own assigned conversations
  const effectiveFilters = useMemo(() => {
    const isAgentOnly = role !== 'admin' && role !== 'supervisor';
    if (isAgentOnly && user && !filters?.assigned_user_id) {
      return { ...filters, assigned_user_id: user.id };
    }
    return filters;
  }, [filters, role, user]);

  return useInfiniteQuery({
    queryKey: ['conversations-infinite', effectiveFilters],
    queryFn: ({ pageParam = 0 }) => listConversations({ ...effectiveFilters, page: pageParam, limit: 20 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 20) return undefined;
      return allPages.length;
    },
    // Polling desabilitado quando Realtime está SUBSCRIBED ou quando frozen.
    refetchInterval: (frozen || realtimeActive) ? false : 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !frozen,
    staleTime: frozen ? Infinity : 15_000,
  });
}

export function useConversationDetail(
  conversationId: string | null,
  options?: { realtimeActive?: boolean },
) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    enabled: !!conversationId,
    queryFn: () => getConversation(conversationId!),
    // Polling desabilitado quando Realtime está SUBSCRIBED
    refetchInterval: options?.realtimeActive ? false : 30_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user, companyId, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, body, replyToId }: { conversationId: string; body: string; replyToId?: string | null }) => {
      const msg = await sendMessage(
        conversationId,
        body,
        replyToId,
        user && companyId ? { userId: user.id, companyId } : undefined,
      );
      // Deliver via WhatsApp and capture result for toast feedback
      const delivery = await sendViaWhatsApp(conversationId, body, undefined, replyToId, msg.id);
      return { msg, delivery };
    },

    // ── Optimistic update: message appears instantly ──────────────────────
    onMutate: async ({ conversationId, body, replyToId }) => {
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      const previous = queryClient.getQueryData<ConversationDetail>(['conversation', conversationId]);

      // Resolve reply_to preview from existing messages in cache
      let replyToPreview = null;
      if (replyToId && previous) {
        const parent = previous.messages.find((m) => m.id === replyToId);
        if (parent) {
          replyToPreview = {
            id: parent.id!,
            body: parent.body ?? null,
            sender_type: parent.sender_type,
            sender_name: parent.sender_name ?? parent.sender?.name ?? null,
          };
        }
      }

      const optimisticMsg: MessageWithSender = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        company_id: companyId ?? '',
        body,
        sender_type: 'agent',
        sender_id: user?.id ?? null,
        sender_name: profile?.name ?? null,
        sender: profile ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        external_message_id: null,
        media_url: null,
        media_type: null,
        media_mime_type: null,
        reply_to_id: replyToId ?? null,
        reply_to: replyToPreview,
        deleted_at: null,
      } as unknown as MessageWithSender;

      if (previous) {
        queryClient.setQueryData<ConversationDetail>(['conversation', conversationId], {
          ...previous,
          // Auto-move "new" → "open" (pending stays pending until chatbot keyword trigger)
          status: previous.status === 'new' ? 'open' : previous.status,
          assigned_user_id: previous.assigned_user_id ?? user?.id ?? null,
          assigned_user: previous.assigned_user ?? profile ?? null,
          messages: [...previous.messages, optimisticMsg],
        } as ConversationDetail);
      }

      return { previous };
    },

    onError: (_err, variables, context: { previous?: ConversationDetail } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversation', variables.conversationId], context.previous);
      }
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    },

    onSuccess: (data, variables) => {
      const { msg, delivery } = data;

      // Show delivery failure toast with reason
      if (!delivery.delivered) {
        let reason: string;
        if (delivery.reason === 'rate_limited') {
          reason = 'Limite de envio atingido para este número. Aguarde alguns minutos antes de enviar novamente.';
        } else if (delivery.reason === 'No active integration found') {
          reason = 'Nenhuma integração WhatsApp conectada.';
        } else {
          reason = delivery.error ?? delivery.reason ?? 'Erro desconhecido';
        }
        toast.warning(`Mensagem salva, mas não enviada via WhatsApp: ${reason}`);

        // Mark message as failed in DB so the red tick appears
        if (msg?.id) {
          import('@/integrations/supabase/client').then(({ supabase }) => {
            supabase.from('messages').update({ delivery_status: 'failed' }).eq('id', msg.id).then(() => {});
          });
        }
      } else if (delivery.messageId && msg?.id) {
        // Save the Evolution external message ID so edit/delete can reference it later
        import('@/integrations/supabase/client').then(({ supabase }) => {
          supabase.from('messages').update({ external_message_id: delivery.messageId, delivery_status: 'sent' }).eq('id', msg.id).then(() => {});
        });
      }

      // Mark as read unless spy_mode is enabled
      if (!profile?.spy_mode) {
        markConversationRead(
          variables.conversationId,
          user && companyId ? { userId: user.id, companyId } : undefined,
        ).catch(() => {});
      }

      // Refresh from server to replace optimistic with real data
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
    },
  });
}

export function useUnreadCounts(conversations: ConversationWithRelations[]) {
  const { user, companyId, profile } = useAuth();
  const spyMode = !!profile?.spy_mode;

  // Stabilize the IDs array: only change the queryKey when the actual set of IDs changes,
  // not on every re-render or conversation list reorder. This prevents badge flickering.
  // CRITICAL: when conversations is temporarily empty (during resetQueries), keep the
  // previous IDs so the query stays enabled and keepPreviousData works correctly.
  const idsRef = useRef<string[]>([]);
  const stableIds = useMemo(() => {
    const newIds = conversations.map((c) => c.id);
    // During reset transitions, conversations is briefly []. Keep previous IDs.
    if (newIds.length === 0 && idsRef.current.length > 0) {
      return idsRef.current;
    }
    const sorted = [...newIds].sort();
    const prevSorted = [...idsRef.current].sort();
    if (sorted.length === prevSorted.length && sorted.every((id, i) => id === prevSorted[i])) {
      return idsRef.current; // same set of IDs — keep previous reference
    }
    idsRef.current = newIds;
    return newIds;
  }, [conversations]);

  return useQuery({
    queryKey: ['unread-counts', stableIds, spyMode],
    enabled: stableIds.length > 0 && !!user && !!companyId,
    queryFn: () => getUnreadCounts(stableIds, user!.id, companyId!, spyMode),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  const { user, companyId, profile } = useAuth();

  return useMutation({
    mutationFn: (conversationId: string) => {
      // Spy mode: do not clear unread — supervisor monitors without marking as read
      if (profile?.spy_mode) return Promise.resolve();
      return markConversationRead(
        conversationId,
        user && companyId ? { userId: user.id, companyId } : undefined,
      );
    },
    onMutate: (conversationId: string) => {
      // Optimistic update: zero the badge instantly without waiting for DB
      if (profile?.spy_mode) return;
      queryClient.setQueriesData<Record<string, number>>(
        { queryKey: ['unread-counts'] },
        (old) => old ? { ...old, [conversationId]: 0 } : old,
      );
    },
    onSuccess: () => {
      // Refresh sidebar badge count (conversation list badge already updated optimistically)
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
    },
  });
}
