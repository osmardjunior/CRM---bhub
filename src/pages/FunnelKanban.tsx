import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, MoreHorizontal, ArrowLeft, ChevronDown, Pencil, X, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFunnels } from '@/contexts/FunnelContext';
import {
  useContactFunnelStages, useMoveContactStage, useAddContactToStage, useRemoveContactFromStage,
  type FunnelContact,
} from '@/hooks/useContactFunnelStages';
import AddContactToStageModal from '@/components/pipeline/AddContactToStageModal';

// ── Add Stage Modal ────────────────────────────────────────
function AddStageModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (label: string) => void }) {
  const [label, setLabel] = useState('');
  const handleSubmit = () => { if (!label.trim()) return; onAdd(label.trim().toUpperCase()); setLabel(''); onClose(); };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova Etapa</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome da etapa</label>
            <Input placeholder="Ex: QUALIFICAÇÃO" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} autoFocus />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={handleSubmit} disabled={!label.trim()}>Adicionar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Rename Stage Modal ─────────────────────────────────────
function RenameStageModal({ open, currentLabel, onClose, onRename }: { open: boolean; currentLabel: string; onClose: () => void; onRename: (l: string) => void }) {
  const [label, setLabel] = useState(currentLabel);
  const handleSubmit = () => { if (!label.trim()) return; onRename(label.trim().toUpperCase()); onClose(); };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Renomear Etapa</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome da etapa</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} autoFocus />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={!label.trim()}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Lead Card ─────────────────────────────────────────────
function LeadCard({ contact, index, onRemove }: { contact: FunnelContact; index: number; onRemove: () => void }) {
  return (
    <Draggable draggableId={contact.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-card rounded border border-border px-3 py-2 text-sm cursor-grab group transition-colors shadow-sm ${snapshot.isDragging ? 'shadow-md ring-2 ring-primary/30' : 'hover:bg-accent/50'}`}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={contact.contact_avatar ?? undefined} />
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{contact.contact_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate text-foreground">{contact.contact_name}</p>
              {contact.contact_phone && <p className="text-[10px] text-muted-foreground truncate">{contact.contact_phone}</p>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5" title="Remover">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Stage Column ──────────────────────────────────────────
function StageColumn({
  funnelId, stageId, stageIndex, stagesCount, label, contacts, onAddContact,
}: {
  funnelId: string; stageId: string; stageIndex: number; stagesCount: number; label: string; contacts: FunnelContact[];
  onAddContact: (stageId: string) => void;
}) {
  const { deleteStage, renameStage, moveStage } = useFunnels();
  const removeContact = useRemoveContactFromStage();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col w-[220px] min-w-[220px] bg-muted/50 rounded-lg overflow-hidden border border-border shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between bg-sidebar px-3 py-2.5">
          <div>
            <p className="text-[10px] font-bold text-sidebar-foreground uppercase tracking-wide leading-none">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{contacts.length} contato{contacts.length !== 1 ? 's' : ''}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5"><MoreHorizontal size={14} /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setRenameOpen(true)}><Pencil size={13} className="mr-2" />Renomear etapa</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => moveStage(funnelId, stageId, 'left')} disabled={stageIndex === 0}>← Mover para esquerda</DropdownMenuItem>
              <DropdownMenuItem onClick={() => moveStage(funnelId, stageId, 'right')} disabled={stageIndex === stagesCount - 1}>→ Mover para direita</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}><X size={13} className="mr-2" />Excluir etapa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Droppable area */}
        <Droppable droppableId={stageId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[300px] max-h-[calc(100vh-260px)] transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
            >
              {contacts.length === 0 && !snapshot.isDraggingOver && (
                <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum contato</p>
                </div>
              )}
              {contacts.map((c, i) => (
                <LeadCard key={c.id} contact={c} index={i} onRemove={() => removeContact.mutate(c.id)} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Footer */}
        <div className="bg-muted/80 border-t border-border px-2 py-2">
          <button
            onClick={() => onAddContact(stageId)}
            className="w-full flex items-center justify-center gap-1 bg-background hover:bg-accent text-foreground text-[10px] font-semibold py-1.5 rounded border border-border transition-colors"
          >
            <Plus size={10} />
            Adicionar Contato
          </button>
        </div>
      </div>

      <RenameStageModal open={renameOpen} currentLabel={label} onClose={() => setRenameOpen(false)} onRename={(newLabel) => renameStage(funnelId, stageId, newLabel)} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa "{label}"?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Os contatos nesta etapa perderão o vínculo com ela.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteStage(funnelId, stageId)}>Excluir</AlertDialogAction>
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
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4"><Filter size={28} className="text-muted-foreground" /></div>
      <h3 className="text-base font-semibold text-foreground mb-1">Funil não encontrado</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">Este funil não existe ou foi removido.</p>
      <Button variant="outline" onClick={onBack}>Voltar para Funis</Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function FunnelKanban() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getFunnel, addStage } = useFunnels();
  const [search, setSearch] = useState('');
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [addContactStageId, setAddContactStageId] = useState<string | null>(null);

  const funnel = getFunnel(id ?? '');
  const { data: funnelContacts = [] } = useContactFunnelStages(id);
  const moveContact = useMoveContactStage();
  const addContactToStage = useAddContactToStage();

  if (!funnel) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2 -mx-4 lg:-mx-6 overflow-hidden items-center justify-center">
        <FunnelNotFound onBack={() => navigate('/pipeline')} />
      </div>
    );
  }

  // Group contacts by stage
  const contactsByStage: Record<string, FunnelContact[]> = {};
  funnel.stages.forEach((s) => { contactsByStage[s.id] = []; });
  funnelContacts.forEach((c) => {
    if (contactsByStage[c.stage_id]) {
      // Search filter
      if (search && !c.contact_name.toLowerCase().includes(search.toLowerCase()) && !(c.contact_phone ?? '').includes(search)) return;
      contactsByStage[c.stage_id].push(c);
    }
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStageId = destination.droppableId;
    const contact = funnelContacts.find((c) => c.id === draggableId);
    if (!contact || contact.stage_id === newStageId) return;
    moveContact.mutate({ id: draggableId, newStageId });
  };

  const existingContactIds = funnelContacts.map((c) => c.contact_id);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2 -mx-4 lg:-mx-6 overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 bg-sidebar px-4 py-2.5 shrink-0">
        <button onClick={() => navigate('/pipeline')} className="flex items-center gap-1.5 text-sidebar-foreground hover:text-sidebar-accent-foreground text-sm font-medium transition-colors mr-1">
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">{funnel.name}</span>
        </button>
        <span className="text-sidebar-muted hidden sm:inline">|</span>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-muted" />
          <Input placeholder="Pesquisar contato..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-muted rounded focus-visible:ring-1 focus-visible:ring-primary" />
        </div>
        <div className="flex-1" />
        <Button size="sm" className="h-7 text-xs gap-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => setAddStageOpen(true)}>
          <Plus size={12} />Nova Etapa
        </Button>
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden bg-muted/30 p-3">
          <div className="flex gap-3 h-full min-w-max">
            {funnel.stages.map((stage, idx) => (
              <StageColumn
                key={stage.id}
                funnelId={funnel.id}
                stageId={stage.id}
                stageIndex={idx}
                stagesCount={funnel.stages.length}
                label={stage.label}
                contacts={contactsByStage[stage.id] || []}
                onAddContact={(stageId) => setAddContactStageId(stageId)}
              />
            ))}
            {/* Add stage placeholder */}
            <div className="flex flex-col w-[180px] min-w-[180px] shrink-0">
              <button onClick={() => setAddStageOpen(true)} className="flex items-center justify-center gap-2 h-full border-2 border-dashed border-border rounded-lg text-muted-foreground hover:bg-accent hover:border-primary/30 transition-colors text-sm font-medium">
                <Plus size={16} />Nova Etapa
              </button>
            </div>
          </div>
        </div>
      </DragDropContext>

      <AddStageModal open={addStageOpen} onClose={() => setAddStageOpen(false)} onAdd={(label) => addStage(funnel.id, label)} />

      {addContactStageId && (
        <AddContactToStageModal
          open={!!addContactStageId}
          onClose={() => setAddContactStageId(null)}
          existingContactIds={existingContactIds}
          onAdd={(contactId) => addContactToStage.mutate({ contactId, funnelId: funnel.id, stageId: addContactStageId })}
        />
      )}
    </div>
  );
}
