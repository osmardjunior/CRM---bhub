import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

export interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
  created_at: string;
  project_id?: string | null;
  media_url?: string | null;
  media_file_name?: string | null;
}

export function useQuickReplies() {
  const { user, companyId } = useAuth();
  const { projectId } = useProjectContext();

  return useQuery({
    queryKey: ['quick_replies', companyId, projectId],
    queryFn: async () => {
      let query = supabase
        .from('quick_replies')
        .select('id, shortcut, message, created_at, project_id, media_url, media_file_name')
        .eq('company_id', companyId!)
        .order('shortcut', { ascending: true });

      if (projectId) {
        // Show replies for this project + global (no project)
        query = query.or(`project_id.eq.${projectId},project_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QuickReply[];
    },
    enabled: !!user && !!companyId,
  });
}

export function useCreateQuickReply() {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();
  const { projectId } = useProjectContext();

  return useMutation({
    mutationFn: async ({ shortcut, message, media_url, media_file_name }: { shortcut: string; message: string; media_url?: string | null; media_file_name?: string | null }) => {
      const { error } = await supabase.from('quick_replies').insert({
        shortcut: shortcut.trim().toLowerCase(),
        message: message.trim(),
        user_id: user!.id,
        company_id: companyId!,
        project_id: projectId || null,
        media_url: media_url || null,
        media_file_name: media_file_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick_replies'] });
      toast.success('Resposta rápida salva!');
    },
    onError: (err: unknown) => {
      const pgErr = err as { code?: string; message?: string; details?: string };
      console.error('[QuickReply] Create error:', pgErr);
      if (pgErr.code === '23505') {
        toast.error('Esse atalho já existe. Escolha outro nome.');
      } else if (pgErr.code === '42501') {
        toast.error('Sem permissão para criar resposta rápida. Verifique suas permissões.');
      } else {
        toast.error(pgErr.message || 'Erro ao salvar resposta rápida');
      }
    },
  });
}

export function useUpdateQuickReply() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shortcut, message, media_url, media_file_name }: { id: string; shortcut: string; message: string; media_url?: string | null; media_file_name?: string | null }) => {
      const { error } = await supabase
        .from('quick_replies')
        .update({ shortcut: shortcut.trim().toLowerCase(), message: message.trim(), media_url: media_url ?? null, media_file_name: media_file_name ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick_replies'] });
      toast.success('Resposta rápida atualizada!');
    },
    onError: (err: unknown) => {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
        toast.error('Esse atalho já existe. Escolha outro nome.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
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
