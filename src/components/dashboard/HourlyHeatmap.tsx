import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHourlyHeatmap } from '@/hooks/useDashboardAnalytics';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Reorder to start from Monday
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

export default function HourlyHeatmap({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: cells } = useHourlyHeatmap(dateFrom, dateTo, projectId, agentId);

  const { grid, maxCount } = useMemo(() => {
    const g: Record<string, number> = {};
    let max = 0;
    for (const c of cells ?? []) {
      const key = `${c.dayOfWeek}-${c.hour}`;
      g[key] = c.count;
      if (c.count > max) max = c.count;
    }
    return { grid: g, maxCount: max };
  }, [cells]);

  if (!cells || maxCount === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock size={15} /> Mapa de Calor — Mensagens por Horário
        </h3>
        <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
          Sem dados para o período
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock size={15} /> Mapa de Calor — Mensagens por Horário
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex ml-10 mb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                {h}h
              </div>
            ))}
          </div>
          {/* Grid rows */}
          {DISPLAY_DAYS.map(dow => (
            <div key={dow} className="flex items-center gap-1 mb-0.5">
              <span className="w-9 text-right text-[10px] font-medium text-muted-foreground shrink-0">
                {DAY_LABELS[dow]}
              </span>
              <div className="flex flex-1 gap-0.5">
                {Array.from({ length: 24 }, (_, h) => {
                  const count = grid[`${dow}-${h}`] || 0;
                  const intensity = maxCount > 0 ? count / maxCount : 0;
                  return (
                    <Tooltip key={h}>
                      <TooltipTrigger asChild>
                        <div
                          className="flex-1 h-5 rounded-sm cursor-default transition-colors"
                          style={{
                            backgroundColor: intensity > 0
                              ? `hsl(210, 80%, 55%, ${0.1 + intensity * 0.85})`
                              : 'hsl(var(--muted) / 0.3)',
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {DAY_LABELS[dow]} {h}h — {count} mensagen{count !== 1 ? 's' : ''}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-center justify-end gap-1.5 mt-2 text-[9px] text-muted-foreground">
            <span>Menos</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(op => (
              <div key={op} className="h-3 w-3 rounded-sm" style={{ backgroundColor: `hsl(210, 80%, 55%, ${op})` }} />
            ))}
            <span>Mais</span>
          </div>
        </div>
      </div>
    </div>
  );
}
