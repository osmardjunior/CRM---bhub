import { useState, useMemo } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useNPSStats, useNPSSurveys } from '@/hooks/useSatisfaction';

const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

function dateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

// SVG Gauge chart component
function GaugeChart({ value }: { value: number | null }) {
  const clamped = Math.max(-100, Math.min(100, value ?? 0));
  // Map -100..100 to 0..180 degrees (semicircle)
  const angle = ((clamped + 100) / 200) * 180;
  const rad = (angle - 90) * (Math.PI / 180);
  const r = 80;
  const cx = 110;
  const cy = 100;
  const needleX = cx + r * Math.cos(rad);
  const needleY = cy + r * Math.sin(rad);

  const color =
    value === null ? '#94a3b8'
    : value >= 50 ? '#22c55e'
    : value >= 0 ? '#f59e0b'
    : '#ef4444';

  const label =
    value === null ? 'Sem dados'
    : value >= 50 ? 'Excelente'
    : value >= 0 ? 'Bom'
    : 'Crítico';

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="130" viewBox="0 0 220 130">
        {/* Background arc segments */}
        {/* Red: -100 to 0 (0° to 90°) */}
        <path d="M 30 100 A 80 80 0 0 1 110 20" fill="none" stroke="#fee2e2" strokeWidth="18" strokeLinecap="round" />
        {/* Yellow: 0 to 50 (90° to 135°) */}
        <path d="M 110 20 A 80 80 0 0 1 166 43" fill="none" stroke="#fef3c7" strokeWidth="18" strokeLinecap="round" />
        {/* Green: 50 to 100 (135° to 180°) */}
        <path d="M 166 43 A 80 80 0 0 1 190 100" fill="none" stroke="#dcfce7" strokeWidth="18" strokeLinecap="round" />
        {/* Colored arc up to value */}
        <path
          d={`M 30 100 A 80 80 0 ${angle > 90 ? 1 : 0} 1 ${needleX} ${needleY}`}
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        {/* Labels */}
        <text x="22" y="118" fontSize="9" fill="#94a3b8">-100</text>
        <text x="103" y="16" fontSize="9" fill="#94a3b8" textAnchor="middle">0</text>
        <text x="190" y="118" fontSize="9" fill="#94a3b8" textAnchor="end">+100</text>
      </svg>
      <div className="text-center -mt-2">
        <p className="text-3xl font-bold" style={{ color }}>
          {value !== null ? `${value > 0 ? '+' : ''}${value}` : '—'}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function scoreLabel(score: number | null) {
  if (score === null) return { text: 'Sem resposta', color: 'text-muted-foreground' };
  if (score >= 4) return { text: 'Promotor', color: 'text-success' };
  if (score === 3) return { text: 'Neutro', color: 'text-warning' };
  return { text: 'Detrator', color: 'text-destructive' };
}

export default function NPSPage() {
  const [periodIdx, setPeriodIdx] = useState(1); // default 30 days
  const { from, to } = useMemo(() => dateRange(PERIODS[periodIdx].days), [periodIdx]);

  const { data: stats, isLoading: statsLoading } = useNPSStats(from, to);
  const { data: surveys = [], isLoading: surveysLoading } = useNPSSurveys(from, to);

  const donutData = stats && stats.total > 0 ? [
    { name: 'Promotores', value: stats.promoters, color: '#22c55e' },
    { name: 'Neutros', value: stats.passives, color: '#f59e0b' },
    { name: 'Detratores', value: stats.detractors, color: '#ef4444' },
  ] : [];

  const pct = (n: number) => stats && stats.total > 0 ? `${Math.round((n / stats.total) * 100)}%` : '0%';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">NPS — Net Promoter Score</h1>
          <p className="text-sm text-muted-foreground">Acompanhe a satisfação dos seus clientes</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map((p, i) => (
            <Button
              key={p.label}
              variant={periodIdx === i ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPeriodIdx(i)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Gauge */}
        <div className="rounded-xl border border-border bg-card card-shadow p-6 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-foreground mb-4 self-start">Pontuação NPS</h3>
          {statsLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <GaugeChart value={stats?.nps ?? null} />
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Baseado em <strong>{stats?.total ?? 0}</strong> respostas nos últimos {PERIODS[periodIdx].label}
          </p>
        </div>

        {/* Donut */}
        <div className="rounded-xl border border-border bg-card card-shadow p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição</h3>
          {statsLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : donutData.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Star size={28} className="opacity-30" />
              <p className="text-sm">Nenhuma resposta neste período</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2} dataKey="value">
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'respostas']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold">{pct(d.value)} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Respostas', value: stats?.total ?? 0, icon: Users, color: 'text-primary' },
          { label: 'Promotores', value: `${stats?.promoters ?? 0} (${pct(stats?.promoters ?? 0)})`, icon: TrendingUp, color: 'text-success' },
          { label: 'Neutros', value: `${stats?.passives ?? 0} (${pct(stats?.passives ?? 0)})`, icon: Minus, color: 'text-warning' },
          { label: 'Detratores', value: `${stats?.detractors ?? 0} (${pct(stats?.detractors ?? 0)})`, icon: TrendingDown, color: 'text-destructive' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card card-shadow p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={15} className={c.color} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Surveys table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Respostas individuais</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar size={13} />
            <span>{PERIODS[periodIdx].label}</span>
          </div>
        </div>
        {surveysLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : surveys.length === 0 ? (
          <div className="p-10 text-center">
            <Star size={28} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma pesquisa enviada neste período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Contato</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Atendente</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Nota</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Comentário</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((s) => {
                  const contact = s.contact as { name?: string; phone?: string } | null;
                  const agent = s.assigned_user as { name?: string } | null;
                  const { text, color } = scoreLabel(s.score !== null ? Number(s.score) : null);
                  return (
                    <tr key={s.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm">{contact?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{contact?.phone ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-sm">
                        {agent?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-base font-bold">{s.score ?? '—'}</span>
                          <span className={`text-[10px] font-medium ${color}`}>{text}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell max-w-[200px]">
                        <p className="truncate">{s.comment || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {s.answered_at
                          ? new Date(s.answered_at).toLocaleDateString('pt-BR')
                          : s.sent_at
                          ? `Enviado ${new Date(s.sent_at).toLocaleDateString('pt-BR')}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
