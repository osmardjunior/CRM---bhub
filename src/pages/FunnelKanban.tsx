import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, MoreHorizontal, ArrowLeft, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFunnels } from '@/contexts/FunnelContext';

// ── Add Stage Modal ────────────────────────────────────────
function AddStageModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string) => void;
}) {
  const [label, setLabel] = useState('');

  const handleSubmit = () => {
    if (!label.trim()) return;
    onAdd(label.trim().toUpperCase());
    setLabel('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova Etapa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Nome da etapa
            </label>
            <Input
              placeholder="Ex: QUALIFICAÇÃO"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleSubmit}
              disabled={!label.trim()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Rename Stage Modal ─────────────────────────────────────
function RenameStageModal({
  open,
  currentLabel,
  onClose,
  onRename,
}: {
  open: boolean;
  currentLabel: string;
  onClose: () => void;
  onRename: (newLabel: string) => void;
}) {
  const [label, setLabel] = useState(currentLabel);

  const handleSubmit = () => {
    if (!label.trim()) return;
    onRename(label.trim().toUpperCase());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renomear Etapa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Nome da etapa
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!label.trim()}
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Lead Card ─────────────────────────────────────────────
function LeadCard({ name }: { name: string }) {
  return (
    <div className="bg-white rounded border border-amber-200 px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-amber-50 transition-colors shadow-sm">
      {name}
    </div>
  );
}

// ── Stage Column ──────────────────────────────────────────
function StageColumn({
  funnelId,
  stageId,
  stageIndex,
  stagesCount,
  label,
  leads,
}: {
  funnelId: string;
  stageId: string;
  stageIndex: number;
  stagesCount: number;
  label: string;
  leads: string[];
}) {
  const { deleteStage, renameStage, moveStage } = useFunnels();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col w-[200px] min-w-[200px] bg-amber-200 rounded-lg overflow-hidden border border-amber-300 shrink-0">
        {/* Column header */}
        <div className="flex items-center justify-between bg-sidebar px-3 py-2.5">
          <div>
            <p className="text-[10px] font-bold text-sidebar-foreground uppercase tracking-wide leading-none">
              {label}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{leads.length}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil size={13} className="mr-2" />
                Renomear etapa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => moveStage(funnelId, stageId, 'left')}
                disabled={stageIndex === 0}
              >
                ← Mover para esquerda
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => moveStage(funnelId, stageId, 'right')}
                disabled={stageIndex === stagesCount - 1}
              >
                → Mover para direita
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <X size={13} className="mr-2" />
                Excluir etapa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Leads list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[400px] max-h-[calc(100vh-220px)]">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-6 text-center">
              <p className="text-xs text-amber-700 font-medium">0/0</p>
              <p className="text-[10px] text-amber-600">(0%)</p>
            </div>
          ) : (
            leads.map((name, i) => <LeadCard key={i} name={name} />)
          )}
        </div>

        {/* Column footer */}
        <div className="bg-amber-100 border-t border-amber-300 px-2 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-amber-800 font-semibold">
              {leads.length}/0{' '}
              <span className="font-normal text-amber-700">(0%)</span>
            </span>
          </div>
          <button className="w-full flex items-center justify-center gap-1 bg-white/80 hover:bg-white text-amber-800 text-[10px] font-semibold py-1 rounded border border-amber-300 transition-colors">
            <Plus size={10} />
            Adicionar Chats
          </button>
        </div>
      </div>

      {/* Rename Modal */}
      <RenameStageModal
        open={renameOpen}
        currentLabel={label}
        onClose={() => setRenameOpen(false)}
        onRename={(newLabel) => renameStage(funnelId, stageId, newLabel)}
      />

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa "{label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Os chats nesta etapa não serão deletados, mas perderão o vínculo com ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteStage(funnelId, stageId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Not Found ─────────────────────────────────────────────
function FunnelNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-24">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Filter size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Funil não encontrado</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Este funil não existe ou foi removido.
      </p>
      <Button variant="outline" onClick={onBack}>
        Voltar para Funis
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function FunnelKanban() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFunnel, addStage } = useFunnels();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addStageOpen, setAddStageOpen] = useState(false);

  const funnel = getFunnel(id ?? '');

  if (!funnel) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2 -mx-4 lg:-mx-6 overflow-hidden items-center justify-center">
        <FunnelNotFound onBack={() => navigate('/pipeline')} />
      </div>
    );
  }

  const filteredStages = funnel.stages.map((stage) => ({
    ...stage,
    leads: search
      ? ([] as string[]).filter((l) => l.toLowerCase().includes(search.toLowerCase()))
      : [],
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2 -mx-4 lg:-mx-6 overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 bg-sidebar px-4 py-2.5 shrink-0">
        <button
          onClick={() => navigate('/pipeline')}
          className="flex items-center gap-1.5 text-sidebar-foreground hover:text-sidebar-accent-foreground text-sm font-medium transition-colors mr-1"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">{funnel.name}</span>
        </button>

        <span className="text-sidebar-muted hidden sm:inline">|</span>

        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-muted" />
          <Input
            placeholder="Pesquisar Chat:"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-muted rounded focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${filtersOpen ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60'}`}
        >
          <Filter size={12} />
          <span>Filtros</span>
          <ChevronDown size={10} />
        </button>

        <div className="flex-1" />

        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-success hover:bg-success/90 text-success-foreground"
          onClick={() => setAddStageOpen(true)}
        >
          <Plus size={12} />
          Nova Etapa
        </Button>
      </div>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="flex items-center gap-3 bg-sidebar px-4 py-2 border-t border-sidebar-border shrink-0">
          <span className="text-xs text-sidebar-muted">Filtrar por:</span>
          <select className="h-6 text-xs bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded px-2">
            <option>Todos os status</option>
            <option>Aberto</option>
            <option>Pendente</option>
          </select>
          <select className="h-6 text-xs bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded px-2">
            <option>Todos os agentes</option>
          </select>
        </div>
      )}

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-amber-100 p-3">
        <div className="flex gap-3 h-full min-w-max">
          {filteredStages.map((stage, idx) => (
            <StageColumn
              key={stage.id}
              funnelId={funnel.id}
              stageId={stage.id}
              stageIndex={idx}
              stagesCount={funnel.stages.length}
              label={stage.label}
              leads={stage.leads}
            />
          ))}

          {/* Add stage button */}
          <div className="flex flex-col w-[180px] min-w-[180px] shrink-0">
            <button
              onClick={() => setAddStageOpen(true)}
              className="flex items-center justify-center gap-2 h-full border-2 border-dashed border-amber-400 rounded-lg text-amber-700 hover:bg-amber-200 hover:border-amber-500 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Nova Etapa
            </button>
          </div>
        </div>
      </div>

      {/* Add Stage Modal */}
      <AddStageModal
        open={addStageOpen}
        onClose={() => setAddStageOpen(false)}
        onAdd={(label) => addStage(funnel.id, label)}
      />
    </div>
  );
}
