import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSidebarStats() {
  const { user, companyId } = useAuth();

  return useQuery({
    queryKey: ['sidebar-stats', companyId],
    queryFn: async () => {
      const [unreadRes, taskRes] = await Promise.all([
        // Single server-side aggregation replacing full table scan + client comparison
        supabase.rpc('get_sidebar_unread_count', {
          p_user_id: user!.id,
          p_company_id: companyId!,
        }),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'concluida')
          .lt('due_date', new Date().toISOString().split('T')[0])
          .eq('assigned_user_id', user!.id),
      ]);

      return {
        openConversations: (unreadRes.data as number) ?? 0,
        overdueTasks: taskRes.count ?? 0,
      };
    },
    enabled: !!user && !!companyId,
    refetchInterval: 10_000, // fallback polling — realtime invalida via useInboxRealtime
  });
}
