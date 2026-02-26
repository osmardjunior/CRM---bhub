import { useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import PageHeader from '@/components/shared/PageHeader';
import { useDeals, useUpdateDeal, useDeleteDeal } from '@/hooks/useDeals';
import type { DealWithRelations, DealStage } from '@/services/deals';
import DealDetailDrawer from '@/components/pipeline/DealDetailDrawer';
import NewDealModal from '@/components/pipeline/NewDealModal';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'novo_lead',   label: 'Novo Lead',   color: 'bg-blue-500/15 text-blue-600 border-blue-500/20' },
  { key: 'em_contato',  label: 'Em Contato',  color: 'bg-amber-500/15 text-amber-600 border-amber-500/20' },
  { key: 'proposta',    label: 'Proposta',    color: 'bg-purple-500/15 text-purple-600 border-purple-500/20' },
  { key: 'fechamento',  label: 'Fechamento',  color: 'bg-orange-500/15 text-orange-600 border-orange-500/20' },
  { key: 'ganho',       label: 'Ganho',       color: 'bg-success/15 text-success border-success/20' },
  { key: 'perdido',     label: 'Perdido',     color: 'bg-destructive/15 text-destructive border-destructive/20' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function NegociosPage() {
  const { data: deals = [], isLoading } = useDeals();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  const [newOpen, setNewOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const wonValue = deals.filter(d => d.stage === 'ganho').reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Negócios"
        subtitle="Acompanhe o pipeline de negócios e oportunidades."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> Novo negócio
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <p className="text-xs text-muted-foreground">Total de negócios</p>
          <p className="text-2xl font-bold text-foreground mt-1">{deals.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <p className="text-xs text-muted-foreground">Valor total</p>
          <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <p className="text-xs text-muted-foreground">Ganhos</p>
          <p className="text-lg font-bold text-success mt-1">{formatCurrency(wonValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-shadow">
          <p className="text-xs text-muted-foreground">Taxa de conversão</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {deals.length > 0 ? Math.round((deals.filter(d => d.stage === 'ganho').length / deals.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Deals table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp size={15} className="text-primary" />
            Pipeline de negócios
          </h2>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : deals.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Nenhum negócio cadastrado.</p>
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setNewOpen(true)}>
              <Plus size={13} /> Criar primeiro negócio
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {deals.map(deal => {
              const stage = STAGES.find(s => s.key === deal.stage);
              return (
                <div
                  key={deal.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-accent/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                    {deal.contact && (
                      <p className="text-xs text-muted-foreground mt-0.5">{deal.contact.name}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0">
                    {formatCurrency(Number(deal.value) || 0)}
                  </span>
                  {stage && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${stage.color}`}>
                      {stage.label}
                    </Badge>
                  )}
                  {deal.assigned_user && (
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {deal.assigned_user.name}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={e => { e.stopPropagation(); setDeleteId(deal.id); }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selectedDeal} onOpenChange={(o) => !o && setSelectedDeal(null)}>
        <SheetContent side="right" className="p-0 w-full sm:max-w-md">
          {selectedDeal && (
            <DealDetailDrawer
              deal={selectedDeal}
              stages={STAGES}
              onClose={() => setSelectedDeal(null)}
              onUpdate={(id, updates) => {
                updateDeal.mutate({ id, ...updates });
                setSelectedDeal(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* New Deal Modal */}
      <NewDealModal open={newOpen} onClose={() => setNewOpen(false)} />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negócio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteDeal.mutate(deleteId); setDeleteId(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
