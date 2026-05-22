import { useMemo } from 'react';
import { Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useHourlyResponseTime } from '@/hooks/useDashboardAnalytics';

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

function getBarColor(minutes: number): string {
  if (minutes === 0) return 'hsl(var(--muted) / 0.3)';
  if (minutes <= 10) return '#22c55e'; // green
  if (minutes <= 30) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function HourlyResponseTime({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: items } = useHourlyResponseTime(dateFrom, dateTo, projectId, agentId);

  const chartData = useMemo(() => {
    if (!items) return [];
    return items.map(i => ({
      hour: `${i.hour}h`,
      avgMinutes: i.avgMinutes,
      count: i.count,
    }));
  }, [items]);

  const hasData = chartData.some(d => d.count > 0);

  if (!items || !hasData) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Timer size={15} /> Tempo Médio de Resposta por Hora
        </h3>
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
          Sem dados para o período
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <Timer size={15} /> Tempo Médio de Resposta por Hora
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Hora em que o lead enviou a mensagem — quanto tempo levou para receber resposta
      </p>

      <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" /> {'≤ 10min'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-500" /> {'≤ 30min'}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" /> {'> 30min'}</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatMinutes(v)} width={50} />
          <Tooltip
            formatter={(value: number, _: string, entry: { payload: { count: number } }) => [
              `${formatMinutes(value)} (${entry.payload.count} respostas)`,
              'Tempo médio',
            ]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="avgMinutes" radius={[3, 3, 0, 0]} maxBarSize={24}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={getBarColor(entry.avgMinutes)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
