import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listConversations,
  getConversation,
  sendMessage,
  getConversationReads,
  getUnreadCounts,
  markConversationRead,
  type ConversationFilters,
  type ConversationWithRelations,
} from '@/services/api';

export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => listConversations(filters),
  });
}

export function useConversationDetail(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    enabled: !!conversationId,
    queryFn: () => getConversation(conversationId!),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendMessage(conversationId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUnreadCounts(conversations: ConversationWithRelations[]) {
  const conversationIds = conversations.map((c) => c.id);

  return useQuery({
    queryKey: ['unread-counts', conversationIds],
    enabled: conversationIds.length > 0,
    queryFn: async () => {
      const reads = await getConversationReads();
      return getUnreadCounts(conversationIds, reads);
    },
    refetchInterval: 30_000, // fallback polling every 30s
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
    },
  });
}
