import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSidebarStats() {
  const { user, companyId } = useAuth();

  return useQuery({
    queryKey: ['sidebar-stats', companyId],
    queryFn: async () => {
      const [convRes, taskRes] = await Promise.all([
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'concluida')
          .lt('due_date', new Date().toISOString().split('T')[0])
          .eq('assigned_user_id', user!.id),
      ]);

      return {
        openConversations: convRes.count ?? 0,
        overdueTasks: taskRes.count ?? 0,
      };
    },
    enabled: !!user && !!companyId,
    refetchInterval: 30000,
  });
}
