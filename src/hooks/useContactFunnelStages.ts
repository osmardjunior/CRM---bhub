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

export function useContactFunnelStages(funnelId: string | undefined, agentUserId?: string) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['contact-funnel-stages', funnelId, agentUserId],
    queryFn: async () => {
      // When agentUserId is set, pre-fetch the contact_ids assigned to that agent
      let allowedContactIds: string[] | null = null;
      if (agentUserId) {
        const { data: convContacts } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('assigned_user_id', agentUserId);
        allowedContactIds = Array.from(new Set((convContacts ?? []).map((c: any) => c.contact_id).filter(Boolean)));
      }

      let query = supabase
        .from('contact_funnel_stages')
        .select('id, contact_id, stage_id, funnel_id, contacts(name, phone, avatar_url)')
        .eq('funnel_id', funnelId!);

      if (allowedContactIds !== null) {
        if (allowedContactIds.length === 0) return [] as FunnelContact[];
        query = query.in('contact_id', allowedContactIds);
      }

      const { data, error } = await query;
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

export function useContactFunnelsByContact(contactId: string | undefined) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['contact-funnel-stages-by-contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_funnel_stages')
        .select('id, contact_id, stage_id, funnel_id, contacts(name, phone, avatar_url)')
        .eq('contact_id', contactId!);

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
    enabled: !!contactId && !!companyId,
  });
}

function invalidateFunnelStages(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['contact-funnel-stages'] });
  qc.invalidateQueries({ queryKey: ['contact-funnel-stages-by-contact'] });
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
    onMutate: async ({ id, newStageId }) => {
      await qc.cancelQueries({ queryKey: ['contact-funnel-stages'] });
      // Snapshot all cached lists so we can rollback on error
      const snapshots = qc.getQueriesData<FunnelContact[]>({ queryKey: ['contact-funnel-stages'] });
      // Optimistically move the contact to the new stage in every cached list
      qc.setQueriesData<FunnelContact[]>({ queryKey: ['contact-funnel-stages'] }, (old) => {
        if (!old) return old;
        return old.map((c) => c.id === id ? { ...c, stage_id: newStageId } : c);
      });
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([queryKey, data]) => {
        qc.setQueryData(queryKey, data);
      });
      toast.error('Erro ao mover contato');
    },
    onSettled: () => invalidateFunnelStages(qc),
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
        .insert({ contact_id: contactId, funnel_id: funnelId, stage_id: stageId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFunnelStages(qc);
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
      invalidateFunnelStages(qc);
      toast.success('Contato removido da etapa');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
