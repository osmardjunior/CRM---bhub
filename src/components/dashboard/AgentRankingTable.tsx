import { useState, useMemo } from 'react';
import { Trophy, ArrowUpDown } from 'lucide-react';
import { useAgentMetrics, useLeadsPerAgent } from '@/hooks/useReports';

function formatSeconds(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

type SortKey = 'conversations' | 'first_response' | 'resolution' | 'nps' | 'resolved' | 'closed' | 'rate';

export default function AgentRankingTable({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: agents } = useAgentMetrics(dateFrom, dateTo, projectId, agentId);
  const { data: leads } = useLeadsPerAgent(dateFrom, dateTo, projectId, agentId);
  const [sortBy, setSortBy] = useState<SortKey>('resolved');
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const agentList = agents ?? [];
    const leadList = leads ?? [];

    const combined = agentList.map(a => {
      const lead = leadList.find(l => l.agent_id === a.agent_id);
      const resolved = lead?.resolved ?? 0;
      const closed = lead?.closed ?? 0;
      const total = lead?.total ?? Number(a.conversations_handled);
      return {
        id: a.agent_id,
        name: a.agent_name,
        conversations: Number(a.conversations_handled),
        first_response: a.avg_first_response_seconds != null ? Number(a.avg_first_response_seconds) : null,
        resolution: a.avg_resolution_seconds != null ? Number(a.avg_resolution_seconds) : null,
        nps: a.avg_nps != null ? Number(a.avg_nps) : null,
        resolved,
        closed,
        rate: total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0,
      };
    });

    combined.sort((a, b) => {
      const av = a[sortBy] ?? (sortAsc ? Infinity : -Infinity);
      const bv = b[sortBy] ?? (sortAsc ? Infinity : -Infinity);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return combined;
  }, [agents, leads, sortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, field, className = '' }: { label: string; field: SortKey; className?: string }) => (
    <th className={`py-2.5 px-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} className={sortBy === field ? 'text-primary' : 'opacity-40'} />
      </span>
    </th>
  );

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Trophy size={15} /> Ranking de Agentes
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">Clique nos headers para ordenar</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30">
              <th className="py-2.5 px-3 text-[10px] font-medium text-muted-foreground text-left w-8">#</th>
              <th className="py-2.5 px-3 text-[10px] font-medium text-muted-foreground text-left">Agente</th>
              <SortHeader label="Conversas" field="conversations" className="text-right" />
              <SortHeader label="1ª Resposta" field="first_response" className="text-right hidden sm:table-cell" />
              <SortHeader label="Resolução" field="resolution" className="text-right hidden sm:table-cell" />
              <SortHeader label="NPS" field="nps" className="text-right hidden md:table-cell" />
              <SortHeader label="Resolvidos" field="resolved" className="text-right" />
              <SortHeader label="Fechados" field="closed" className="text-right hidden md:table-cell" />
              <SortHeader label="Taxa (%)" field="rate" className="text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                <td className="py-2.5 px-3 text-center">
                  {i < 3 ? <span className="text-sm">{MEDALS[i]}</span> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                      {row.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium truncate">{row.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right text-xs font-semibold">{row.conversations}</td>
                <td className="py-2.5 px-3 text-right text-xs text-muted-foreground hidden sm:table-cell">{formatSeconds(row.first_response)}</td>
                <td className="py-2.5 px-3 text-right text-xs text-muted-foreground hidden sm:table-cell">{formatSeconds(row.resolution)}</td>
                <td className="py-2.5 px-3 text-right text-xs hidden md:table-cell">
                  {row.nps != null ? (
                    <span className={row.nps >= 4 ? 'text-green-500' : row.nps >= 3 ? 'text-amber-500' : 'text-red-500'}>
                      {row.nps.toFixed(1)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right text-xs font-semibold text-green-500">{row.resolved}</td>
                <td className="py-2.5 px-3 text-right text-xs text-muted-foreground hidden md:table-cell">{row.closed}</td>
                <td className="py-2.5 px-3 text-right">
                  <span className={`text-xs font-semibold ${row.rate >= 60 ? 'text-green-500' : row.rate >= 30 ? 'text-amber-500' : 'text-red-500'}`}>
                    {row.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
