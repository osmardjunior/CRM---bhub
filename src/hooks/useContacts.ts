import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listContacts,
  createContact,
  updateContact,
  listTeamMembers,
  type ContactFilters,
  type ContactInsert,
  type ContactUpdate,
} from '@/services/api';

export function useContacts(filters?: ContactFilters) {
  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => listContacts(filters),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ContactInsert, 'company_id'> & { company_id?: string }) =>
      createContact(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'], refetchType: 'active' });
      toast.success('Contato criado com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: ContactUpdate & { id: string }) =>
      updateContact(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'], refetchType: 'active' });
      toast.success('Contato atualizado!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: listTeamMembers,
  });
}
