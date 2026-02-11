import { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Search, Plus, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DealDetailDrawer from '@/components/pipeline/DealDetailDrawer';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import { useDeals, useUpdateDeal, useCreateDeal } from '@/hooks/useDeals';
import { useTeamMembers } from '@/hooks/useContacts';
import type { DealStage, DealWithRelations } from '@/services/deals';
import { Briefcase } from 'lucide-react';

const stages: { key: DealStage; label: string; color: string }[] = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-muted-foreground' },
  { key: 'em_contato', label: 'Em Contato', color: 'bg-info' },
  { key: 'proposta', label: 'Proposta', color: 'bg-warning' },
  { key: 'fechamento', label: 'Fechamento', color: 'bg-primary' },
  { key: 'ganho', label: 'Ganho', color: 'bg-success' },
  { key: 'perdido', label: 'Perdido', color: 'bg-destructive' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getDaysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function PipelinePage() {
  const { data: deals, isLoading } = useDeals();
  const { data: teamMembers } = useTeamMembers();
  const updateDeal = useUpdateDeal();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!deals) return [];
    return deals.filter((d) => {
      const matchSearch =
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        (d.contact?.name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchAgent = agentFilter === 'all' || d.assigned_user_id === agentFilter;
      return matchSearch && matchAgent;
    });
  }, [deals, search, agentFilter]);

  const selectedDeal = deals?.find((d) => d.id === selectedDealId) || null;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStage = result.destination.droppableId as DealStage;
    updateDeal.mutate({ id: result.draggableId, stage: newStage });
  };

  const handleDealUpdate = (id: string, updates: Record<string, any>) => {
    updateDeal.mutate({ id, ...updates });
    setSelectedDealId(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)] -m-4 lg:-m-6">
        <div className="p-4 lg:p-6"><TableSkeleton rows={5} cols={4} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-4 lg:-m-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar negócios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary border-0 text-sm"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm bg-secondary border-0">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(teamMembers ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 ml-auto h-9">
          <Plus size={15} />
          Novo negócio
        </Button>
      </div>

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto p-4 lg:p-6">
          {stages.map((stage) => {
            const stageDeals = filtered.filter((d) => d.stage === stage.key);
            const total = stageDeals.reduce((s, d) => s + Number(d.value), 0);

            return (
              <Droppable key={stage.key} droppableId={stage.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex min-w-[250px] w-[250px] flex-col rounded-xl border border-border bg-card card-shadow shrink-0 transition-colors ${
                      snapshot.isDraggingOver ? 'border-primary/40 bg-accent/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-border px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                        <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                        <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">{formatCurrency(total)}</span>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto p-2">
                      {stageDeals.length === 0 ? (
                        <div className="py-10 text-center text-xs text-muted-foreground">
                          Nenhum negócio
                        </div>
                      ) : (
                        stageDeals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => setSelectedDealId(deal.id)}
                                className={`rounded-lg border border-border bg-background p-3 cursor-pointer transition-shadow ${
                                  dragSnapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : 'card-shadow hover:card-shadow-md'
                                }`}
                              >
                                <p className="text-sm font-medium text-foreground leading-snug">{deal.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{deal.contact?.name ?? '—'}</p>
                                <div className="mt-2.5 flex items-center justify-between">
                                  <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(deal.value))}</span>
                                  <span className="text-[11px] text-muted-foreground">{getDaysAgo(deal.created_at)}d</span>
                                </div>
                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                  <User size={12} />
                                  <span className="truncate">{deal.assigned_user?.name ?? '—'}</span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Backdrop + Drawer */}
      {selectedDeal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setSelectedDealId(null)}
          />
          <DealDetailDrawer
            deal={selectedDeal}
            stages={stages}
            onClose={() => setSelectedDealId(null)}
            onUpdate={handleDealUpdate}
          />
        </>
      )}
    </div>
  );
}
