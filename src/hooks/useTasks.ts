import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  type TaskInsert,
  type TaskUpdate,
} from '@/services/tasks';

export function useTasks() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['tasks', companyId],
    enabled: !!companyId,
    queryFn: () => listTasks(companyId!),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskInsert) => createTask(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada com sucesso!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: TaskUpdate & { id: string }) => updateTask(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa atualizada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa excluída!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
