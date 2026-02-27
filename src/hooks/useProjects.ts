import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Project = {
  id: string;
  company_id: string;
  department_id: string;
  name: string;
  active: boolean;
  created_at: string;
};

export function useProjects(departmentId?: string) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['projects', companyId, departmentId ?? 'all'],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('company_id', companyId!)
        .eq('active', true)
        .order('name');

      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (payload: { department_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...payload, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto criado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto atualizado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Retorna apenas os projetos acessíveis ao usuário atual:
 * - admin: todos os projetos ativos da company
 * - supervisor/agent: apenas projetos onde o usuário está em user_projects
 */
export function useMyProjects() {
  const { companyId, user, role } = useAuth();
  return useQuery({
    queryKey: ['my-projects', companyId, user?.id, role],
    enabled: !!companyId && !!user?.id,
    queryFn: async () => {
      if (role === 'admin') {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('company_id', companyId!)
          .eq('active', true)
          .order('name');
        if (error) throw error;
        return (data ?? []) as Project[];
      }

      // agent / supervisor — apenas projetos em que está cadastrado
      const { data, error } = await supabase
        .from('user_projects')
        .select('project_id, projects(*)')
        .eq('user_id', user!.id)
        .eq('active', true);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.projects)
        .filter(Boolean)
        .filter((p: Project) => p.active) as Project[];
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete — set active=false
      const { error } = await supabase
        .from('projects')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto desativado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
