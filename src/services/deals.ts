import { supabase } from '@/integrations/supabase/client';
import { ApiError } from '@/services/api';

export type Deal = {
  id: string;
  company_id: string;
  title: string;
  contact_id: string | null;
  value: number;
  stage: 'novo_lead' | 'em_contato' | 'proposta' | 'fechamento' | 'ganho' | 'perdido';
  probability: number;
  assigned_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DealStage = Deal['stage'];

export type DealWithRelations = Deal & {
  contact: { id: string; name: string } | null;
  assigned_user: { id: string; name: string } | null;
};

export type DealInsert = {
  title: string;
  contact_id?: string | null;
  value?: number;
  stage?: DealStage;
  probability?: number;
  assigned_user_id?: string | null;
  notes?: string;
  company_id?: string;
};

export type DealUpdate = Partial<Omit<DealInsert, 'company_id'>>;

function handleError(error: { message: string; code?: string }): never {
  throw new ApiError(error.message, error.code ?? 'UNKNOWN');
}

export async function listDeals(): Promise<DealWithRelations[]> {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      contact:contacts!deals_contact_id_fkey(id, name),
      assigned_user:profiles!deals_assigned_user_id_fkey(id, name)
    `)
    .order('created_at', { ascending: false });

  if (error) handleError(error);
  return (data ?? []) as unknown as DealWithRelations[];
}

export async function createDeal(payload: DealInsert): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .insert(payload as any)
    .select()
    .single();

  if (error) handleError(error);
  return data as unknown as Deal;
}

export async function updateDeal(id: string, payload: DealUpdate): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .update(payload as any)
    .eq('id', id)
    .select()
    .single();

  if (error) handleError(error);
  return data as unknown as Deal;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) handleError(error);
}
