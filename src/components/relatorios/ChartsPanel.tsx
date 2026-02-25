import { useState, useMemo } from 'react';
import { Clock, MessageSquare, Star, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAgentMetrics, usePipelineConversion, useNPSSummary } from '@/hooks/useReports';

const periodOptions = [
  { label: '7 dias', value: '7' },
  { label: '30 dias', value: '30' },
  { label: '90 dias', value: '90' },
];

function formatSeconds(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function ChartsPanel() {
  const [period, setPeriod] = useState('30');

  const dateTo = useMemo(() => new Date().toISOString(), []);
  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d.toISOString();
  }, [period]);

  const { data: agents } = useAgentMetrics(dateFrom, dateTo);
  const { data: pipeline } = usePipelineConversion(dateFrom, dateTo);
  const { data: nps } = useNPSSummary(dateFrom, dateTo);

  const agentChartData = (agents ?? []).map((a) => ({
    name: a.agent_name.split(' ')[0],
    conversas: Number(a.conversations_handled),
  }));

  const npsColor = nps?.nps != null
    ? nps.nps >= 50 ? 'text-success' : nps.nps >= 0 ? 'text-warning' : 'text-destructive'
    : 'text-muted-foreground';

  const periodLabel = periodOptions.find((o) => o.value === period)?.label ?? period;

  const summaryCards = [
    {
      label: `NPS (${periodLabel})`,
      value: nps?.nps != null ? `${nps.nps > 0 ? '+' : ''}${nps.nps}` : '—',
      icon: Star, color: npsColor,
      sub: nps?.total ? `${nps.total} respostas` : 'Sem dados',
    },
    {
      label: 'Taxa de Conversão',
      value: pipeline ? `${pipeline.conversionRate}%` : '—',
      icon: TrendingUp, color: 'text-success',
      sub: pipeline ? `${pipeline.won} ganhos de ${pipeline.total}` : '',
    },
    {
      label: 'Total Conversas',
      value: (agents ?? []).reduce((s, a) => s + Number(a.conversations_handled), 0),
      icon: MessageSquare, color: 'text-primary',
      sub: `${(agents ?? []).length} agentes`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card card-shadow p-5">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={16} className={c.color} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card card-shadow p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users size={15} /> Conversas por Agente
          </h3>
          {agentChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agentChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="conversas" fill="hsl(168, 60%, 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
              Sem dados para o período selecionado
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card card-shadow p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock size={15} /> Performance por Agente
          </h3>
          {(agents ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Agente</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">1ª Resposta</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Resolução</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">NPS</th>
                  </tr>
                </thead>
                <tbody>
                  {(agents ?? []).map((a) => (
                    <tr key={a.agent_id} className="border-b">
                      <td className="py-2 font-medium">{a.agent_name}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatSeconds(a.avg_first_response_seconds)}</td>
                      <td className="py-2 text-right text-muted-foreground">{formatSeconds(a.avg_resolution_seconds)}</td>
                      <td className="py-2 text-right text-muted-foreground">{a.avg_nps != null ? Number(a.avg_nps).toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
              Sem dados para o período selecionado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
