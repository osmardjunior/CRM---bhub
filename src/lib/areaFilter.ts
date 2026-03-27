import { supabase } from '@/integrations/supabase/client';

// Micro area IDs que pertencem ao CRM (guru-spark-ui)
const CRM_AREA_IDS = ['crm'];

/**
 * Retorna os IDs dos usuários que têm permissão na área do CRM.
 * Usado para filtrar listagens de membros — só mostra quem pertence a esta área.
 */
export async function getAreaUserIds(): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('user_micro_area_permissions')
    .select('user_id')
    .in('micro_area_id', CRM_AREA_IDS);

  if (error || !data || data.length === 0) return null;
  return [...new Set(data.map(r => r.user_id))];
}
