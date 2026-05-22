import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type UserProject = {
  user_id: string;
  project_id: string;
  active: boolean;
  created_at: string;
};

export function useUserProjects(projectId: string) {
  return useQuery({
    queryKey: ['user-projects', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_projects')
        .select('user_id, project_id, active, created_at')
        .eq('project_id', projectId)
        .eq('active', true);
      if (error) throw error;
      return (data ?? []) as UserProject[];
    },
  });
}

export function useAddUserToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { error } = await supabase
        .from('user_projects')
        .upsert({ user_id: userId, project_id: projectId, active: true }, { onConflict: 'user_id,project_id' });
      if (error) throw error;
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['user-projects', projectId] });
      toast.success('Usuário adicionado ao projeto!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveUserFromProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { error } = await supabase
        .from('user_projects')
        .update({ active: false })
        .eq('user_id', userId)
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['user-projects', projectId] });
      toast.success('Usuário removido do projeto!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
