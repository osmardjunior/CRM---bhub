import { FolderOpen } from 'lucide-react';
import { useProjectMetrics } from '@/hooks/useDashboardAnalytics';

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

export default function ProjectBreakdown({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: projects, isLoading } = useProjectMetrics(dateFrom, dateTo, projectId, agentId);

  if (isLoading) return null;
  if (!projects || projects.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <FolderOpen size={15} /> Performance por Projeto
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((p) => {
          const closedPct = p.total > 0 ? Math.round((p.closed / p.total) * 100) : 0;
          const healthColor = closedPct >= 60 ? 'border-green-500/30 bg-green-500/5' : closedPct >= 30 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5';
          return (
            <div key={p.project_id} className={`rounded-lg border ${healthColor} p-3.5`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground truncate">{p.project_name}</span>
                <span className="text-lg font-bold text-foreground">{p.total}</span>
              </div>
              {/* Status bar */}
              {p.total > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden mb-2">
                  {p.new > 0 && <div className="bg-red-500" style={{ width: `${(p.new / p.total) * 100}%` }} />}
                  {p.open > 0 && <div className="bg-blue-500" style={{ width: `${(p.open / p.total) * 100}%` }} />}
                  {p.pending > 0 && <div className="bg-amber-500" style={{ width: `${(p.pending / p.total) * 100}%` }} />}
                  {p.closed > 0 && <div className="bg-gray-500" style={{ width: `${(p.closed / p.total) * 100}%` }} />}
                </div>
              )}
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{p.new}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{p.open}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{p.pending}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-gray-500" />{p.closed}</span>
                <span className="ml-auto font-medium">{closedPct}% fechado</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
