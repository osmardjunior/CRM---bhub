import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to realtime changes on messages and conversations
 * scoped to the current user's company.
 * Invalidates React Query caches so UI updates automatically.
 */
export function useInboxRealtime(selectedConversationId: string | null) {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const handleMessageChange = useCallback(
    (payload: any) => {
      const newMsg = payload.new;
      if (!newMsg) return;

      // Refresh conversation list (preview text, ordering)
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Refresh unread counts
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });

      // If the message belongs to the selected conversation, refresh it
      if (newMsg.conversation_id === selectedConversationId) {
        queryClient.invalidateQueries({
          queryKey: ['conversation', selectedConversationId],
        });
      }
    },
    [queryClient, selectedConversationId],
  );

  const handleConversationChange = useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `company_id=eq.${companyId}`,
        },
        handleMessageChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `company_id=eq.${companyId}`,
        },
        handleConversationChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, handleMessageChange, handleConversationChange]);
}
