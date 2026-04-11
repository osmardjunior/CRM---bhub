import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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

export function useInfiniteConversations(filters?: Omit<ConversationFilters, 'page'>) {
  return useInfiniteQuery({
    queryKey: ['conversations-infinite', filters],
    queryFn: ({ pageParam = 0 }) => listConversations({ ...filters, page: pageParam, limit: 20 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 20) return undefined;
      return allPages.length;
    },
    // Polling de fallback: garante atualização mesmo quando o Realtime falha.
    // O Realtime ainda é o mecanismo primário (sub-50ms); este é o safety net.
    refetchInterval: 8_000,            // 8s (era 15s)
    refetchIntervalInBackground: false, // só quando a aba está ativa
    staleTime: 0,                       // sempre refetch ao invalidar
  });
}

export function useConversationDetail(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    enabled: !!conversationId,
    queryFn: () => getConversation(conversationId!),
    // Realtime handles sub-50ms updates; this is just a safety net for when realtime fails.
    // 15s is enough — reducing from 3s avoids race-conditions with optimistic updates.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    // Keep previous data during refetch so conversation never becomes null
    // (prevents handleSend from returning early on the second send)
    placeholderData: keepPreviousData,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user, companyId, profile } = useAuth();

  return useMutation({
    // Only awaits the DB insert — WhatsApp delivery is fire-and-forget
    mutationFn: async ({ conversationId, body, replyToId }: { conversationId: string; body: string; replyToId?: string | null }) => {
      const msg = await sendMessage(
        conversationId,
        body,
        replyToId,
        user && companyId ? { userId: user.id, companyId } : undefined,
      );
      return { msg };
    },

    // ── Optimistic update: message appears instantly ──────────────────────
    onMutate: async ({ conversationId, body, replyToId }) => {
      // Cancel any in-flight refetch so it can't overwrite the optimistic message.
      // No await — cancelQueries marks the query as cancelled synchronously in React Query state;
      // the actual HTTP response is discarded when it arrives. Awaiting would delay onMutate
      // (and therefore mutationFn start) by the full round-trip time of the in-flight request.
      queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });

      const previous = queryClient.getQueryData<ConversationDetail>(['conversation', conversationId]);
      const optimisticId = `optimistic-${Date.now()}`;

      const optimisticMsg: MessageWithSender = {
        id: optimisticId,
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
        reply_to: null,
        deleted_at: null,
      } as unknown as MessageWithSender;

      if (previous) {
        queryClient.setQueryData<ConversationDetail>(['conversation', conversationId], {
          ...previous,
          messages: [...previous.messages, optimisticMsg],
        });
      }

      return { previous, optimisticId };
    },

    onError: (_err, variables, context: { previous?: ConversationDetail; optimisticId?: string } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversation', variables.conversationId], context.previous);
      }
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    },

    onSuccess: ({ msg }, variables, context) => {
      const { optimisticId } = (context ?? {}) as { optimisticId?: string };

      // Replace optimistic placeholder with the real DB message id so subsequent
      // polls and realtime events don't cause a duplicate or flash.
      if (optimisticId) {
        const current = queryClient.getQueryData<ConversationDetail>(['conversation', variables.conversationId]);
        if (current) {
          queryClient.setQueryData<ConversationDetail>(
            ['conversation', variables.conversationId],
            {
              ...current,
              messages: current.messages.map((m) =>
                m.id === optimisticId ? { ...m, id: msg.id } : m,
              ),
            },
          );
        }
      }

      // Fire-and-forget: WhatsApp delivery runs in background without blocking UI
      sendViaWhatsApp(variables.conversationId, variables.body).then((delivery) => {
        if (!delivery.delivered) {
          const reason = delivery.reason === 'No active integration found'
            ? 'Nenhuma integração WhatsApp conectada.'
            : (delivery.error ?? delivery.reason ?? 'Erro desconhecido');
          toast.warning(`Mensagem salva, mas não enviada via WhatsApp: ${reason}`);

          if (msg?.id) {
            import('@/integrations/supabase/client').then(({ supabase }) => {
              supabase.from('messages').update({ delivery_status: 'failed' }).eq('id', msg.id).catch(() => {});
            });
          }
        }
      }).catch(() => {
        toast.warning('Não foi possível verificar entrega via WhatsApp.');
      });

      // Mark as read unless spy_mode is enabled
      if (!(profile as any)?.spy_mode) {
        markConversationRead(
          variables.conversationId,
          user && companyId ? { userId: user.id, companyId } : undefined,
        ).catch(() => {});
      }

      // No invalidations here — realtime subscription handles syncing without
      // disrupting consecutive sends. refetchInterval (15s) is the fallback.
    },
  });
}

export function useUnreadCounts(conversations: ConversationWithRelations[]) {
  const { user } = useAuth();
  const conversationIds = conversations.map((c) => c.id);

  return useQuery({
    queryKey: ['unread-counts', conversationIds],
    enabled: conversationIds.length > 0 && !!user,
    // Single RPC replaces N queries
    queryFn: () => getUnreadCounts(conversationIds, user!.id),
    refetchInterval: 8_000, // fallback polling — realtime invalida imediatamente via useInboxRealtime
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  const { user, companyId, profile } = useAuth();

  return useMutation({
    mutationFn: (conversationId: string) => {
      // Spy mode: do not clear unread — supervisor monitors without marking as read
      if ((profile as any)?.spy_mode) return Promise.resolve();
      return markConversationRead(
        conversationId,
        user && companyId ? { userId: user.id, companyId } : undefined,
      );
    },
    onMutate: (conversationId: string) => {
      // Optimistic update: zero the badge instantly without waiting for DB
      if ((profile as any)?.spy_mode) return;
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
