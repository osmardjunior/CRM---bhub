import { supabase } from '@/integrations/supabase/client';

// Micro area IDs que pertencem ao CRM (guru-spark-ui)
const CRM_AREA_IDS = ['crm'];

/**
 * Retorna os IDs dos usuários que têm permissão na área do CRM.
 * Usa RPC SECURITY DEFINER para bypassar a RLS (que limita SELECT a auth.uid()).
 * Retorna null se a RPC não existir ou não tiver dados (fallback: sem filtro).
 */
export async function getAreaUserIds(): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_area_user_ids', {
      p_micro_area_ids: CRM_AREA_IDS,
    });

    if (error) return null;
    if (!data || data.length === 0) return null;
    return [...new Set((data as { user_id: string }[]).map(r => r.user_id))];
  } catch {
    return null;
  }
}
