import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  description: string;
  status: string;
  action_type: string;
  action_config: Record<string, any>;
  filters: Record<string, any>;
  schedule_at: string | null;
  deadline_at: string | null;
  skip_weekends: boolean;
  send_window: Record<string, any>;
  total_contacts: number;
  processed: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  excluded_contact_ids: string[];
  created_at: string;
  updated_at: string;
}

export function useCampaigns() {
  const { companyId } = useAuth();
  const { projectId } = useProjectContext();
  return useQuery({
    queryKey: ['campaigns', companyId, projectId],
    queryFn: async () => {
      let query = supabase
        .from('campaigns')
        .select('id, name, status, target_count, sent_count, actions, filters, created_at, project_id, company_id')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(100);

      if (projectId) {
        query = query.or(`project_id.eq.${projectId},project_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<Campaign>) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...payload, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha criada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { error } = await supabase
        .from('campaigns')
        .update(updates as TablesUpdate<'campaigns'>)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha excluída!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRunCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'scheduled', schedule_at: new Date().toISOString() })
        .eq('id', campaignId);
      if (error) throw error;
      // Trigger immediately and await the response
      const { error: fnError } = await supabase.functions.invoke('execute-campaign', {
        body: { campaign_id: campaignId },
      });
      if (fnError) throw new Error(`Falha ao executar campanha: ${fnError.message}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha iniciada!');
    },
    onError: (err: Error) => toast.error(`Erro ao executar: ${err.message}`),
  });
}
