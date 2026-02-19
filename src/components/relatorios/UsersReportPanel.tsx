import { useMemo } from 'react';
import { useAgentMetrics } from '@/hooks/useReports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

function formatSeconds(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function UsersReportPanel() {
  const dateTo = useMemo(() => new Date().toISOString(), []);
  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const { data: agents, isLoading } = useAgentMetrics(dateFrom, dateTo);

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card card-shadow">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Performance dos Agentes (últimos 30 dias)</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agente</TableHead>
            <TableHead className="text-right">Conversas</TableHead>
            <TableHead className="text-right">1ª Resposta</TableHead>
            <TableHead className="text-right">Resolução</TableHead>
            <TableHead className="text-right">NPS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(agents ?? []).map((a) => (
            <TableRow key={a.agent_id}>
              <TableCell className="font-medium">{a.agent_name}</TableCell>
              <TableCell className="text-right">{a.conversations_handled}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatSeconds(a.avg_first_response_seconds)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatSeconds(a.avg_resolution_seconds)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{a.avg_nps != null ? Number(a.avg_nps).toFixed(1) : '—'}</TableCell>
            </TableRow>
          ))}
          {(agents ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem dados</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
