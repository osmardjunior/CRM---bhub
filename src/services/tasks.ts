import { supabase } from '@/integrations/supabase/client';
import { ApiError } from '@/services/api';

export type TaskRecord = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  priority: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'em_progresso' | 'concluida';
  due_date: string | null;
  assigned_user_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithRelations = TaskRecord & {
  contact: { id: string; name: string } | null;
  assigned_user: { id: string; name: string } | null;
};

export type TaskInsert = {
  title: string;
  description?: string;
  priority?: TaskRecord['priority'];
  status?: TaskRecord['status'];
  due_date?: string | null;
  assigned_user_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  company_id?: string;
};

export type TaskUpdate = Partial<Omit<TaskInsert, 'company_id'>>;

function handleError(error: { message: string; code?: string }): never {
  throw new ApiError(error.message, error.code ?? 'UNKNOWN');
}

export async function listTasks(): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      contact:contacts!tasks_contact_id_fkey(id, name),
      assigned_user:profiles!tasks_assigned_user_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false });

  if (error) handleError(error);
  return (data ?? []) as unknown as TaskWithRelations[];
}

export async function createTask(payload: TaskInsert): Promise<TaskRecord> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(payload as any)
    .select()
    .single();

  if (error) handleError(error);
  return data as unknown as TaskRecord;
}

export async function updateTask(id: string, payload: TaskUpdate): Promise<TaskRecord> {
  const { data, error } = await supabase
    .from('tasks')
    .update(payload as any)
    .eq('id', id)
    .select()
    .single();

  if (error) handleError(error);
  return data as unknown as TaskRecord;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) handleError(error);
}
