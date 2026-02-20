import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
  created_at: string;
}

export function useQuickReplies() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['quick_replies', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('id, shortcut, message, created_at')
        .order('shortcut', { ascending: true });
      if (error) throw error;
      return data as QuickReply[];
    },
    enabled: !!user,
  });
}

export function useCreateQuickReply() {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();

  return useMutation({
    mutationFn: async ({ shortcut, message }: { shortcut: string; message: string }) => {
      const { error } = await supabase.from('quick_replies').insert({
        shortcut: shortcut.trim().toLowerCase(),
        message: message.trim(),
        user_id: user!.id,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick_replies'] });
      toast.success('Resposta rápida salva!');
    },
    onError: (err: unknown) => {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
        toast.error('Esse atalho já existe. Escolha outro nome.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
      }
    },
  });
}

export function useDeleteQuickReplies() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('quick_replies').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick_replies'] });
      toast.success('Resposta(s) removida(s)!');
    },
    onError: () => toast.error('Erro ao remover'),
  });
}
