import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Conversation = Tables<'conversations'> & {
  contact: Tables<'contacts'>;
  assigned_user: Tables<'profiles'> | null;
};

export type Message = Tables<'messages'> & {
  sender: Tables<'profiles'> | null;
};

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts!conversations_contact_id_fkey(*),
          assigned_user:profiles!conversations_assigned_user_id_fkey(*)
        `)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(*)
        `)
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
  });
}
