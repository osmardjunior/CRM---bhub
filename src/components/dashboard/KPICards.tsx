import { Clock, Timer, Star, TrendingUp, MessageSquare } from 'lucide-react';
import { useAgentMetrics, usePipelineConversion, useNPSSummary } from '@/hooks/useReports';
import { useAvgMessagesPerConversation } from '@/hooks/useDashboardAnalytics';

function formatSeconds(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

export default function KPICards({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: agents } = useAgentMetrics(dateFrom, dateTo, projectId, agentId);
  const { data: pipeline } = usePipelineConversion(dateFrom, dateTo, agentId);
  const { data: nps } = useNPSSummary(dateFrom, dateTo, projectId, agentId);
  const { data: avgMsgs } = useAvgMessagesPerConversation(dateFrom, dateTo, projectId, agentId);

  // Calculate averages from all agents
  const agentList = agents ?? [];
  const avgFirstResponse = agentList.length > 0
    ? agentList.reduce((sum, a) => sum + (a.avg_first_response_seconds ?? 0), 0) / agentList.filter(a => a.avg_first_response_seconds != null).length || null
    : null;
  const avgResolution = agentList.length > 0
    ? agentList.reduce((sum, a) => sum + (a.avg_resolution_seconds ?? 0), 0) / agentList.filter(a => a.avg_resolution_seconds != null).length || null
    : null;

  const npsColor = nps?.nps != null
    ? nps.nps >= 50 ? 'text-green-500' : nps.nps >= 0 ? 'text-amber-500' : 'text-red-500'
    : 'text-muted-foreground';

  const cards = [
    {
      label: 'TMA (1ª Resposta)',
      value: formatSeconds(avgFirstResponse),
      icon: Clock,
      color: 'text-blue-500',
      sub: `${agentList.filter(a => a.avg_first_response_seconds != null).length} agentes`,
    },
    {
      label: 'TMR (Resolução)',
      value: formatSeconds(avgResolution),
      icon: Timer,
      color: 'text-purple-500',
      sub: `${agentList.filter(a => a.avg_resolution_seconds != null).length} agentes`,
    },
    {
      label: 'NPS',
      value: nps?.nps != null ? `${nps.nps > 0 ? '+' : ''}${nps.nps}` : '—',
      icon: Star,
      color: npsColor,
      sub: nps?.total ? `${nps.total} respostas` : 'Sem dados',
    },
    {
      label: 'Conversão',
      value: pipeline ? `${pipeline.conversionRate}%` : '—',
      icon: TrendingUp,
      color: 'text-green-500',
      sub: pipeline ? `${pipeline.won} ganhos de ${pipeline.total}` : '',
    },
    {
      label: 'Msgs/Conversa',
      value: avgMsgs != null ? avgMsgs.toString() : '—',
      icon: MessageSquare,
      color: 'text-primary',
      sub: 'Média no período',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <c.icon size={14} className={c.color} />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{c.label}</span>
          </div>
          <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
