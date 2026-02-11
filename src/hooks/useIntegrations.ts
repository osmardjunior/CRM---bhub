import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Integration {
  id: string;
  company_id: string;
  channel: string;
  provider: string;
  config: Record<string, string>;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as Integration[];
    },
  });
}

export function useUpsertIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      channel: string;
      provider: string;
      config: Record<string, string>;
      status: string;
    }) => {
      // Try to find existing
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('channel', payload.channel)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('integrations')
          .update({
            provider: payload.provider,
            config: payload.config as any,
            status: payload.status,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integrations')
          .insert({
            channel: payload.channel,
            provider: payload.provider,
            config: payload.config as any,
            status: payload.status,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração salva!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (channel: string) => {
      const { error } = await supabase
        .from('integrations')
        .update({ status: 'disconnected', config: {} as any })
        .eq('channel', channel);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração desconectada.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
