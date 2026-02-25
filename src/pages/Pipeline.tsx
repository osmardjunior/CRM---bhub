import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Download, Trash2, X, GripVertical, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFunnels, Funnel } from '@/contexts/FunnelContext';
import { useDepartments } from '@/hooks/useDepartments';

// ── Wave SVG ──────────────────────────────────────────────
function FunnelWave({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const W = 1200;
  const H = 80;
  const segW = W / stages.length;

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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 80 }}>
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#16a34a" stopOpacity="1" />
          <stop offset="70%" stopColor="#84cc16" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#a3e635" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {stages.map((_, i) => (
        <line key={i} x1={i * segW} y1={0} x2={i * segW} y2={H} stroke="#6366f1" strokeWidth="0.5" opacity="0.4" />
      ))}
      <path d={closedPath} fill="url(#waveGrad)" />
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#a3e635" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

// ── Create Funnel Modal ────────────────────────────────────
function CreateFunnelModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; stages: { label: string; count: number }[]; department_id?: string | null }) => void;
}) {
  const [name, setName] = useState('');
  const [stages, setStages] = useState<string[]>(['ENTRADA DO LEAD', '']);
  const [funnelDeptId, setFunnelDeptId] = useState('');
  const { data: departments = [] } = useDepartments();

  const addStage = () => setStages((s) => [...s, '']);
  const removeStage = (idx: number) => setStages((s) => s.filter((_, i) => i !== idx));
  const updateStage = (idx: number, val: string) =>
    setStages((s) => s.map((v, i) => (i === idx ? val : v)));

  const handleSubmit = () => {
    const validStages = stages.filter((s) => s.trim() !== '');
    if (!name.trim() || validStages.length === 0) return;
    onCreate({
      name: name.trim(),
      stages: validStages.map((label) => ({ label: label.trim(), count: 0 })),
      department_id: funnelDeptId || null,
    });
    setName('');
    setStages(['ENTRADA DO LEAD', '']);
    setFunnelDeptId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar novo funil</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Nome do funil
            </label>
            <Input
              placeholder="Ex: Funil de Vendas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Departamento
            </label>
            <Select value={funnelDeptId || '_none'} onValueChange={v => setFunnelDeptId(v === '_none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Todos os departamentos</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Etapas do funil
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {stages.map((stage, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <GripVertical size={14} className="text-muted-foreground shrink-0 cursor-grab" />
                  <Input
                    placeholder={`Etapa ${idx + 1}`}
                    value={stage}
                    onChange={(e) => updateStage(idx, e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  {stages.length > 1 && (
                    <button
                      onClick={() => removeStage(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full gap-1.5 text-xs border-dashed"
              onClick={addStage}
            >
              <Plus size={13} />
              Adicionar etapa
            </Button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleSubmit}
              disabled={!name.trim() || stages.filter((s) => s.trim()).length === 0}
            >
              Criar funil
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Funnel Card ───────────────────────────────────────────
function FunnelCard({
  funnel,
  onDelete,
  onOpen,
}: {
  funnel: Funnel;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [visibilityRestrict, setVisibilityRestrict] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('mine');

  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      <div className="flex items-center justify-between bg-muted/40 px-4 py-3 border-b border-border">
        <button
          onClick={() => onOpen(funnel.id)}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-left"
        >
          {funnel.name}
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
            <Filter size={11} />
            Métricas
          </Button>
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors hover:bg-accent"
          >
            <Plus size={12} />
            Mais Opções
          </button>
        </div>
      </div>

      <div className="bg-funnel-dark overflow-x-auto">
        <div className="flex min-w-max">
          {funnel.stages.map((stage, idx) => {
            const prevCount = idx > 0 ? funnel.stages[idx - 1].count : stage.count;
            const conversionRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 100;
            return (
            <div
              key={idx}
              className="flex-1 min-w-[110px] border-r border-funnel-dark last:border-r-0 px-3 py-3"
            >
              <div className="text-2xl font-bold text-white leading-none">{stage.count}</div>
              <div className="text-[10px] font-semibold text-success uppercase tracking-wide mt-1">
                {stage.label}
              </div>
              {idx > 0 && (
                <div className="text-[9px] text-yellow-400 mt-1">
                  Conv: {conversionRate}%
                </div>
              )}
            </div>
          );
          })}
        </div>

        <div className="bg-funnel-darker px-0 pb-0">
          <FunnelWave stages={funnel.stages} />
        </div>
      </div>

      {moreOpen && (
        <div className="bg-card border-t border-border px-4 py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-4">
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

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="radio" name={`view-${funnel.id}`} checked={viewMode === 'all'} onChange={() => setViewMode('all')} className="accent-primary" />
                <span>Pode <span className="text-primary font-medium">visualizar todos os chats do funil</span></span>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="radio" name={`view-${funnel.id}`} checked={viewMode === 'mine'} onChange={() => setViewMode('mine')} className="accent-primary" />
                <span>Ver apenas os <span className="text-primary font-medium">chats delegados a si ou aos departamentos que faz parte</span>.</span>
              </label>
            </div>
          </div>

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
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={() => onDelete(funnel.id)}>
              <Trash2 size={11} />
              Apagar Funil
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────
function FunnelEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Filter size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Nenhum funil criado ainda</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Crie seu primeiro funil, defina as etapas e comece a acompanhar seus leads em cada fase do atendimento.
      </p>
      <Button className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={onCreate}>
        <Plus size={14} />
        Criar primeiro funil
      </Button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function PipelinePage() {
  const navigate = useNavigate();
  const { funnels, addFunnel, deleteFunnel } = useFunnels();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Funil</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nesta área estão listados todos os funis criados na sua conta.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} />
          Criar novo funil
        </Button>
      </div>

      {funnels.length === 0 ? (
        <FunnelEmptyState onCreate={() => setShowCreate(true)} />
      ) : (
        <div>
          {funnels.map((f) => (
            <FunnelCard
              key={f.id}
              funnel={f}
              onDelete={deleteFunnel}
              onOpen={(id) => navigate(`/pipeline/${id}`)}
            />
          ))}
        </div>
      )}

      <CreateFunnelModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={addFunnel}
      />
    </div>
  );
}
