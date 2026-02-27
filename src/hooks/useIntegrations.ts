import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Integration {
  id: string;
  company_id: string;
  channel: string;
  provider: string;
  config: Record<string, string>;
  status: string;
  phone_number: string | null;
  device_name: string;
  restrict_users: string[];
  department_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useIntegrations(projectId?: string) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['integrations', companyId, projectId ?? 'all'],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('integrations')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Integration[];
    },
  });
}

export function useAddDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      channel: string;
      provider: string;
      config: Record<string, string>;
      phone_number: string;
      device_name: string;
      department_id?: string | null;
      project_id?: string | null;
    }) => {
      const { error } = await supabase
        .from('integrations')
        .insert({
          channel: payload.channel,
          provider: payload.provider,
          config: payload.config as any,
          phone_number: payload.phone_number,
          device_name: payload.device_name,
          department_id: payload.department_id || null,
          project_id: payload.project_id || null,
          status: 'connected',
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Aparelho adicionado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from('integrations')
        .update(payload.updates)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Aparelho atualizado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDisconnectDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .update({ status: 'disconnected', config: {} as any })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Aparelho desativado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Aparelho removido.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Keep backward compat
export function useUpsertIntegration() {
  return useAddDevice();
}

export function useDisconnectIntegration() {
  return useDisconnectDevice();
}
