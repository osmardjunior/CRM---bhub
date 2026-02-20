import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FunnelContact {
  id: string; // contact_funnel_stages.id
  contact_id: string;
  stage_id: string;
  funnel_id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_avatar: string | null;
}

export function useContactFunnelStages(funnelId: string | undefined) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['contact-funnel-stages', funnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_funnel_stages')
        .select('id, contact_id, stage_id, funnel_id, contacts(name, phone, avatar_url)')
        .eq('funnel_id', funnelId!);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        contact_id: row.contact_id,
        stage_id: row.stage_id,
        funnel_id: row.funnel_id,
        contact_name: row.contacts?.name ?? 'Sem nome',
        contact_phone: row.contacts?.phone ?? null,
        contact_avatar: row.contacts?.avatar_url ?? null,
      })) as FunnelContact[];
    },
    enabled: !!funnelId && !!companyId,
  });
}

export function useMoveContactStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newStageId }: { id: string; newStageId: string }) => {
      const { error } = await supabase
        .from('contact_funnel_stages')
        .update({ stage_id: newStageId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-funnel-stages'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddContactToStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      funnelId,
      stageId,
    }: {
      contactId: string;
      funnelId: string;
      stageId: string;
    }) => {
      // Upsert: remove existing entry for this contact in this funnel, then insert
      await supabase
        .from('contact_funnel_stages')
        .delete()
        .eq('contact_id', contactId)
        .eq('funnel_id', funnelId);

      const { error } = await supabase
        .from('contact_funnel_stages')
        .insert({ contact_id: contactId, funnel_id: funnelId, stage_id: stageId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-funnel-stages'] });
      toast.success('Contato adicionado à etapa');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveContactFromStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contact_funnel_stages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-funnel-stages'] });
      toast.success('Contato removido da etapa');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
