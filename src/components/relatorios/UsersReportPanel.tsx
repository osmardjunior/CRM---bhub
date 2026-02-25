import { useState, useMemo } from 'react';
import { useAgentMetrics } from '@/hooks/useReports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function formatNps(avgScore: number | null): string {
  if (avgScore == null || isNaN(Number(avgScore))) return '—';
  return `${Number(avgScore).toFixed(1)}/5`;
}

export default function UsersReportPanel() {
  const [period, setPeriod] = useState('30');

  const dateTo = useMemo(() => new Date().toISOString(), []);
  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d.toISOString();
  }, [period]);

  const { data: agents, isLoading } = useAgentMetrics(dateFrom, dateTo);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  const periodLabel = periodOptions.find((o) => o.value === period)?.label ?? period;

  return (
    <div className="rounded-xl border border-border bg-card card-shadow">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Performance dos Agentes — {periodLabel}</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agente</TableHead>
            <TableHead className="text-right">Conversas</TableHead>
            <TableHead className="text-right">1ª Resposta</TableHead>
            <TableHead className="text-right">Resolução</TableHead>
            <TableHead className="text-right">Satisfação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(agents ?? []).map((a) => (
            <TableRow key={a.agent_id}>
              <TableCell className="font-medium">{a.agent_name}</TableCell>
              <TableCell className="text-right">{a.conversations_handled}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatSeconds(a.avg_first_response_seconds)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatSeconds(a.avg_resolution_seconds)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatNps(a.avg_nps)}</TableCell>
            </TableRow>
          ))}
          {(agents ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem dados para o período selecionado</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
