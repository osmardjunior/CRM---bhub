import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Tag {
  id: string;
  company_id: string;
  name: string;
  color: string;
  department_id: string | null;
  project_id: string | null;
  created_at: string;
}

export function useTags() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['tags', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, company_id, name, color, department_id, project_id, created_at')
        .eq('company_id', companyId!)
        .order('name')
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
    staleTime: 60_000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; color: string; department_id?: string | null; project_id?: string | null }) => {
      const { error } = await supabase
        .from('tags')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag criada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; color?: string; department_id?: string | null; project_id?: string | null }) => {
      const { error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag atualizada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag removida!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
