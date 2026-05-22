import { useState, useMemo } from 'react';
import { CalendarIcon, Clock, MessageSquare, Star, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAgentMetrics, usePipelineConversion, useNPSSummary, useChannelVolume, useLeadsPerAgent } from '@/hooks/useReports';

function formatSeconds(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

const quickOptions = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export default function ChartsPanel() {
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const dateFromISO = useMemo(() => dateFrom.toISOString(), [dateFrom]);
  const dateToISO = useMemo(() => dateTo.toISOString(), [dateTo]);

  const { data: agents } = useAgentMetrics(dateFromISO, dateToISO);
  const { data: pipeline } = usePipelineConversion(dateFromISO, dateToISO);
  const { data: nps } = useNPSSummary(dateFromISO, dateToISO);
  const { data: channelData } = useChannelVolume(dateFromISO, dateToISO);
  const { data: leadsData } = useLeadsPerAgent(dateFromISO, dateToISO);

  const agentChartData = (agents ?? []).map((a) => ({
    name: a.agent_name.split(' ')[0],
    conversas: Number(a.conversations_handled),
  }));

  const channels = channelData ?? [];

  const npsColor = nps?.nps != null
    ? nps.nps >= 50 ? 'text-success' : nps.nps >= 0 ? 'text-warning' : 'text-destructive'
    : 'text-muted-foreground';

  const summaryCards = [
    {
      label: 'NPS',
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
      {/* Date picker row */}
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {quickOptions.map((opt) => (
          <Button
            key={opt.days}
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              setDateFrom(subDays(new Date(), opt.days));
              setDateTo(new Date());
            }}
          >
            {opt.label}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-8 gap-1.5 text-xs font-normal')}>
              <CalendarIcon size={13} />
              {format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(d) => d && setDateFrom(d)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">até</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-8 gap-1.5 text-xs font-normal')}>
              <CalendarIcon size={13} />
              {format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(d) => d && setDateTo(d)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
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
            <MessageSquare size={15} /> Volume por Canal
          </h3>
          {channels.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channels}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {channels.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
              Sem dados para o período selecionado
            </div>
          )}
        </div>

        {/* Leads por Agente */}
        <div className="rounded-xl border border-border bg-card card-shadow p-5 md:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users size={15} /> Leads Recebidos por Agente
          </h3>
          {(leadsData ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Agente</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Total</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Aberto</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">Em Atendimento</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">Aguardando</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium hidden md:table-cell">Fechado</th>
                  </tr>
                </thead>
                <tbody>
                  {(leadsData ?? []).map((a) => (
                    <tr key={a.agent_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{a.agent_name}</td>
                      <td className="py-2 text-right font-semibold">{a.total}</td>
                      <td className="py-2 text-right text-blue-600 dark:text-blue-400">{a.new}</td>
                      <td className="py-2 text-right text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">{a.open}</td>
                      <td className="py-2 text-right text-amber-600 dark:text-amber-400 hidden sm:table-cell">{a.pending}</td>
                      <td className="py-2 text-right text-muted-foreground hidden md:table-cell">{a.closed}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right">{(leadsData ?? []).reduce((s, a) => s + a.total, 0)}</td>
                    <td className="py-2 text-right text-blue-600 dark:text-blue-400">{(leadsData ?? []).reduce((s, a) => s + a.new, 0)}</td>
                    <td className="py-2 text-right text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">{(leadsData ?? []).reduce((s, a) => s + a.open, 0)}</td>
                    <td className="py-2 text-right text-amber-600 dark:text-amber-400 hidden sm:table-cell">{(leadsData ?? []).reduce((s, a) => s + a.pending, 0)}</td>
                    <td className="py-2 text-right text-muted-foreground hidden md:table-cell">{(leadsData ?? []).reduce((s, a) => s + a.closed, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[100px] text-sm text-muted-foreground">
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
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">1ª Resposta</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">Resolução</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">NPS</th>
                  </tr>
                </thead>
                <tbody>
                  {(agents ?? []).map((a) => (
                    <tr key={a.agent_id} className="border-b">
                      <td className="py-2 font-medium">{a.agent_name}</td>
                      <td className="py-2 text-right text-muted-foreground hidden sm:table-cell">{formatSeconds(a.avg_first_response_seconds)}</td>
                      <td className="py-2 text-right text-muted-foreground hidden sm:table-cell">{formatSeconds(a.avg_resolution_seconds)}</td>
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
