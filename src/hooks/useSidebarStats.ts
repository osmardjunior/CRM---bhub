import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';

export function useSidebarStats() {
  const { user, companyId, profile } = useAuth();
  const { projectId } = useProjectContext();
  const spyMode = !!profile?.spy_mode;

  return useQuery({
    queryKey: ['sidebar-stats', companyId, projectId, spyMode],
    queryFn: async () => {
      const rpcParams: Record<string, unknown> = {
        p_user_id: user!.id,
        p_company_id: companyId!,
        p_spy_mode: spyMode,
      };
      if (projectId) {
        rpcParams.p_project_id = projectId;
      }

      const [unreadRes, taskRes] = await Promise.all([
        supabase.rpc('get_sidebar_unread_count', rpcParams),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId!)
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
    refetchInterval: 60_000, // was 10s — Realtime invalidates, this is just safety net
    staleTime: 30_000,
  });
}
