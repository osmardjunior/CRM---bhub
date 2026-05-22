import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';

interface Props {
  onStatusClick?: (status: string | undefined) => void;
  activeStatus?: string;
}

const STATUSES = ['new', 'open', 'pending', 'resolved', 'closed'] as const;

export default function AgentLeadsSummary({ onStatusClick, activeStatus }: Props) {
  const { user, companyId, role } = useAuth();
  const { projectId } = useProjectContext();
  const isAgent = role === 'agent';

  const { data: statusCounts } = useQuery({
    queryKey: ['inbox-status-counts', companyId, projectId, isAgent, user?.id],
    queryFn: async () => {
      if (!companyId) return null;

      // Agents see only their own conversations; admins/supervisors see all
      const countResults = await Promise.all(
        STATUSES.map(status => {
          let q = supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', status);
          if (projectId) q = q.eq('project_id', projectId);
          if (isAgent && user) q = q.eq('assigned_user_id', user.id);
          return q;
        })
      );

      const counts: Record<string, number> = {};
      STATUSES.forEach((s, i) => { counts[s] = countResults[i].count ?? 0; });
      const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);

      return {
        new: counts.new, open: counts.open, pending: counts.pending,
        resolved: counts.resolved, closed: counts.closed, total,
      };
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const cards = [
    { label: 'Aberto', status: 'new', value: statusCounts?.new ?? 0, color: 'text-green-600 dark:text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/5' },
    { label: 'Atend.', status: 'open', value: statusCounts?.open ?? 0, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
    { label: 'Aguard.', status: 'pending', value: statusCounts?.pending ?? 0, color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
    { label: 'Resolv.', status: 'resolved', value: statusCounts?.resolved ?? 0, color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/5' },
    { label: 'Fechado', status: 'closed', value: statusCounts?.closed ?? 0, color: 'text-gray-500 dark:text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/5' },
    { label: 'Total', status: undefined, value: statusCounts?.total ?? 0, color: 'text-foreground', border: 'border-border', bg: 'bg-muted/5' },
  ];

  return (
    <div className="grid grid-cols-6 gap-1 px-2 py-1.5 border-b border-border">
      {cards.map((card) => {
        const isActive = activeStatus === card.status;
        return (
          <button
            key={card.label}
            onClick={() => onStatusClick?.(card.status)}
            className={`flex flex-col items-center gap-0 rounded-md px-0.5 py-1 transition-colors border ${
              isActive ? 'ring-1 ring-primary bg-primary/10 border-primary/30' : `${card.border} ${card.bg} hover:opacity-80`
            }`}
          >
            <span className={`text-base font-bold leading-tight ${card.color}`}>{card.value}</span>
            <span className="text-[8px] text-muted-foreground font-medium leading-tight">{card.label}</span>
          </button>
        );
      })}
    </div>
  );
}
