import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { useAgentMetrics, useLeadsPerAgent } from '@/hooks/useReports';

const STATUS_COLORS = {
  new: '#ef4444',
  open: '#3b82f6',
  pending: '#f59e0b',
  closed: '#6b7280',
};

const RADAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

export default function AgentComparisonChart({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: leadsData } = useLeadsPerAgent(dateFrom, dateTo, projectId, agentId);
  const { data: metricsData } = useAgentMetrics(dateFrom, dateTo, projectId, agentId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // All available agents (exclude unassigned)
  const allAgents = useMemo(() => {
    return (metricsData ?? []).filter(a => a.agent_id !== '__unassigned__');
  }, [metricsData]);

  // Toggle selection (max 6)
  const toggleAgent = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  // If no selection, use top 5 by default
  const activeAgentIds = selectedIds.length >= 2
    ? selectedIds
    : allAgents.slice(0, 5).map(a => a.agent_id);

  // Stacked bar chart data — filtered by selection
  const barData = useMemo(() => {
    const leads = leadsData ?? [];
    const filtered = activeAgentIds.length > 0
      ? leads.filter(a => activeAgentIds.includes(a.agent_id))
      : leads.slice(0, 10);
    return filtered.map(a => ({
      name: a.agent_name.split(' ')[0],
      Aberto: a.new,
      'Em Atendimento': a.open,
      Aguardando: a.pending,
      Resolvido: a.resolved,
      Fechado: a.closed,
    }));
  }, [leadsData, activeAgentIds]);

  // Radar chart data - normalize to 0-100
  const radarData = useMemo(() => {
    const agents = metricsData ?? [];
    const leads = leadsData ?? [];
    if (agents.length === 0) return { dimensions: [], agents: [] };

    const filtered = activeAgentIds.length > 0
      ? agents.filter(a => activeAgentIds.includes(a.agent_id))
      : agents.slice(0, 5);

    if (filtered.length === 0) return { dimensions: [], agents: [] };

    // Find max values for normalization (from ALL agents for fair comparison)
    const maxConv = Math.max(...agents.map(a => Number(a.conversations_handled)), 1);
    const maxFR = Math.max(...agents.map(a => a.avg_first_response_seconds ?? 0), 1);
    const maxRes = Math.max(...agents.map(a => a.avg_resolution_seconds ?? 0), 1);

    const dimensions = ['Volume', 'Velocidade', 'Resolução', 'NPS', 'Taxa Fechamento'];

    const agentRadar = filtered.map((a, i) => {
      const lead = leads.find(l => l.agent_id === a.agent_id);
      const closedRate = lead ? (lead.total > 0 ? ((lead.resolved + lead.closed) / lead.total) * 100 : 0) : 0;
      const speed = a.avg_first_response_seconds ? Math.max(0, 100 - (Number(a.avg_first_response_seconds) / maxFR) * 100) : 0;
      const resolution = a.avg_resolution_seconds ? Math.max(0, 100 - (Number(a.avg_resolution_seconds) / maxRes) * 100) : 0;
      const npsNorm = a.avg_nps != null ? Math.min(100, Math.max(0, Number(a.avg_nps) * 20)) : 0;

      return {
        name: a.agent_name.split(' ')[0],
        color: RADAR_COLORS[i % RADAR_COLORS.length],
        values: {
          Volume: Math.round((Number(a.conversations_handled) / maxConv) * 100),
          Velocidade: Math.round(speed),
          'Resolução': Math.round(resolution),
          NPS: Math.round(npsNorm),
          'Taxa Fechamento': Math.round(closedRate),
        },
      };
    });

    const dimensionData = dimensions.map(dim => {
      const row: Record<string, unknown> = { dimension: dim };
      agentRadar.forEach(a => { row[a.name] = a.values[dim as keyof typeof a.values]; });
      return row;
    });

    return { dimensions: dimensionData, agents: agentRadar };
  }, [metricsData, leadsData, activeAgentIds]);

  const hasBarData = barData.length > 0;
  const hasRadarData = radarData.agents.length > 0;

  return (
    <div className="space-y-4">
      {/* Agent multi-select chips */}
      {allAgents.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground mb-2">
            Selecione 2-6 agentes para comparar (vazio = top 5 automático)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allAgents.map(a => {
              const selected = selectedIds.includes(a.agent_id);
              return (
                <button
                  key={a.agent_id}
                  onClick={() => toggleAgent(a.agent_id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                  } ${!selected && selectedIds.length >= 6 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {a.agent_name.split(' ')[0]}
                </button>
              );
            })}
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Stacked Bar Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users size={15} /> Leads por Agente
          </h3>
          {hasBarData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Aberto" stackId="a" fill={STATUS_COLORS.new} />
                <Bar dataKey="Em Atendimento" stackId="a" fill={STATUS_COLORS.open} />
                <Bar dataKey="Aguardando" stackId="a" fill={STATUS_COLORS.pending} />
                <Bar dataKey="Resolvido" stackId="a" fill="#22c55e" />
                <Bar dataKey="Fechado" stackId="a" fill={STATUS_COLORS.closed} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              Sem dados para o período
            </div>
          )}
        </div>

        {/* Radar Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users size={15} /> Comparativo de Performance
          </h3>
          {hasRadarData ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData.dimensions}>
                <PolarGrid strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                {radarData.agents.map(a => (
                  <Radar
                    key={a.name}
                    name={a.name}
                    dataKey={a.name}
                    stroke={a.color}
                    fill={a.color}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              Sem dados para o período
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
