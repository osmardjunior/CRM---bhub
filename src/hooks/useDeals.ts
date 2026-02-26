import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  listDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  type DealInsert,
  type DealUpdate,
} from '@/services/deals';

export function useDeals() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['deals', companyId],
    enabled: !!companyId,
    queryFn: () => listDeals(companyId!),
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DealInsert) => createDeal(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Negócio criado com sucesso!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: DealUpdate & { id: string }) => updateDeal(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Negócio atualizado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Negócio excluído!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
