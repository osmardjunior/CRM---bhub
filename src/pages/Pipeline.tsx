import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal, Pencil, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────
interface FunnelStage {
  label: string;
  count: number;
}

interface Funnel {
  id: string;
  name: string;
  stages: FunnelStage[];
  expanded: boolean;
}

// ── Mock data matching reference image ────────────────────
const INITIAL_FUNNELS: Funnel[] = [
  {
    id: '1',
    name: '0. AÇÃO PIX',
    expanded: true,
    stages: [
      { label: 'ENTRADA DO LEAD', count: 0 },
      { label: 'VENDEDOR ATUANDO', count: 545 },
      { label: 'JÁ POSSUI CADASTRO', count: 85 },
      { label: 'CADASTRO REALIZADO', count: 5 },
      { label: 'CPA REALIZADO', count: 39 },
      { label: 'REDEPÓSITO', count: 2 },
      { label: 'VENDA REALIZADA', count: 0 },
      { label: 'RECUPERAÇÃO 1', count: 33 },
      { label: 'RECUPERAÇÃO 2', count: 0 },
      { label: 'SEM INTERAÇÃO', count: 42 },
    ],
  },
  {
    id: '2',
    name: '00. ROLETA',
    expanded: true,
    stages: [
      { label: 'ENTRADA DO LEAD', count: 0 },
      { label: 'VENDEDOR ATUANDO', count: 366 },
      { label: 'CADASTRO REALIZADO', count: 7 },
      { label: 'CPA REALIZADO', count: 21 },
      { label: 'JÁ TEM CADASTRO', count: 128 },
      { label: 'REDEPÓSITO', count: 1 },
      { label: 'VENDA REALIZADA', count: 1 },
      { label: 'RECUPERAÇÃO 1', count: 0 },
      { label: 'RECUPERAÇÃO 2', count: 0 },
      { label: 'SEM INTERAÇÃO', count: 0 },
    ],
  },
];

// ── Wave SVG ──────────────────────────────────────────────
function FunnelWave({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const W = 1200;
  const H = 80;
  const segW = W / stages.length;

  // Build a smooth wave path using the count as amplitude
  const topPoints: [number, number][] = stages.map((s, i) => {
    const x = i * segW + segW / 2;
    const amp = (s.count / max) * (H / 2 - 4);
    return [x, H / 2 - amp];
  });
  const botPoints: [number, number][] = stages.map((s, i) => {
    const x = i * segW + segW / 2;
    const amp = (s.count / max) * (H / 2 - 4);
    return [x, H / 2 + amp];
  });

  function catmullRom(pts: [number, number][]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const topPath = catmullRom(topPoints);
  const botPath = catmullRom([...botPoints].reverse());

  const closedPath = topPath + ' ' + botPath.replace('M', 'L') + ' Z';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: 80 }}
    >
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#16a34a" stopOpacity="1" />
          <stop offset="70%" stopColor="#84cc16" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Dividers */}
      {stages.map((_, i) => (
        <line
          key={i}
          x1={i * segW}
          y1={0}
          x2={i * segW}
          y2={H}
          stroke="#6366f1"
          strokeWidth="0.5"
          opacity="0.4"
        />
      ))}
      {/* Wave shape */}
      <path d={closedPath} fill="url(#waveGrad)" />
      {/* Baseline */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#a3e635" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

// ── Funnel Card ───────────────────────────────────────────
function FunnelCard({ funnel, onDelete, onOpen }: { funnel: Funnel; onDelete: (id: string) => void; onOpen: (id: string) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [visibilityRestrict, setVisibilityRestrict] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('mine');

  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      {/* Card header */}
      <div className="flex items-center justify-between bg-muted/40 px-4 py-3 border-b border-border">
        <button
          onClick={() => onOpen(funnel.id)}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-left"
        >
          {funnel.name}
        </button>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors hover:bg-accent"
        >
          <Plus size={12} />
          Mais Opções
        </button>
      </div>

      {/* Stages bar */}
      <div className="bg-funnel-dark overflow-x-auto">
        <div className="flex min-w-max">
          {funnel.stages.map((stage, idx) => (
            <div
              key={idx}
              className="flex-1 min-w-[110px] border-r border-funnel-dark last:border-r-0 px-3 py-3"
            >
              <div className="text-2xl font-bold text-white leading-none">{stage.count}</div>
              <div className="text-[10px] font-semibold text-success uppercase tracking-wide mt-1">
                {stage.label}
              </div>
            </div>
          ))}
        </div>

        {/* Wave visualization */}
        <div className="bg-funnel-darker px-0 pb-0">
          <FunnelWave stages={funnel.stages} />
        </div>
      </div>

      {/* Expanded options */}
      {moreOpen && (
        <div className="bg-card border-t border-border px-4 py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Left: restrict visibility */}
            <div className="flex-1 space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibilityRestrict}
                  onChange={(e) => setVisibilityRestrict(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                Restringir Usuários e Deptos que podem visualizar:
              </label>
              {visibilityRestrict && (
                <div className="border border-border rounded px-3 py-2 text-xs text-muted-foreground bg-secondary/30">
                  Nenhum Selecionado →
                </div>
              )}
            </div>

            {/* Right: view mode */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="radio"
                  name={`view-${funnel.id}`}
                  checked={viewMode === 'all'}
                  onChange={() => setViewMode('all')}
                  className="accent-primary"
                />
                <span>
                  Pode <span className="text-primary font-medium">visualizar todos os chats do funil</span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="radio"
                  name={`view-${funnel.id}`}
                  checked={viewMode === 'mine'}
                  onChange={() => setViewMode('mine')}
                  className="accent-primary"
                />
                <span>
                  Ver apenas os{' '}
                  <span className="text-primary font-medium">
                    chats delegados a si ou aos departamentos que faz parte
                  </span>
                  .
                </span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Pencil size={11} />
                Alterar Nome
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-info text-info hover:bg-info hover:text-white">
                <Download size={11} />
                Exportar em CSV
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1.5"
              onClick={() => onDelete(funnel.id)}
            >
              <Trash2 size={11} />
              Apagar Funil
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function PipelinePage() {
  const navigate = useNavigate();
  const [funnels, setFunnels] = useState<Funnel[]>(INITIAL_FUNNELS);

  const handleDelete = (id: string) => {
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  };

  const handleOpen = (id: string) => {
    navigate(`/pipeline/${id}`);
  };

  const handleCreate = () => {
    const name = `Novo Funil ${funnels.length + 1}`;
    setFunnels((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name,
        expanded: true,
        stages: [
          { label: 'ENTRADA DO LEAD', count: 0 },
          { label: 'EM ATENDIMENTO', count: 0 },
          { label: 'PROPOSTA', count: 0 },
          { label: 'FECHAMENTO', count: 0 },
          { label: 'GANHO', count: 0 },
          { label: 'PERDIDO', count: 0 },
        ],
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Funil</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nesta área estão listados todos os funis criados na sua conta.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={handleCreate}>
          <Plus size={14} />
          Criar novo funil
        </Button>
      </div>

      {/* Funnel list */}
      <div>
        {funnels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm">Nenhum funil criado ainda.</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={handleCreate}>
              <Plus size={14} />
              Criar primeiro funil
            </Button>
          </div>
        ) : (
          funnels.map((f) => (
            <FunnelCard key={f.id} funnel={f} onDelete={handleDelete} onOpen={handleOpen} />
          ))
        )}
      </div>
    </div>
  );
}
