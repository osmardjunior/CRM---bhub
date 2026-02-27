import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Department {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export function useDepartments() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['departments', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', companyId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('departments')
        .insert({ name } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Departamento criado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Primeiro deletar projetos vinculados (user_projects cascadeiam automaticamente)
      const { error: projError } = await supabase
        .from('projects')
        .delete()
        .eq('department_id', id);
      if (projError) throw projError;

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Departamento removido!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
