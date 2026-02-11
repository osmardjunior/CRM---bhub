import { Kanban, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { pipelineDeals, type PipelineStage } from '@/data/mock';

const stages: { key: PipelineStage; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: 'bg-muted-foreground/20' },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-info/20' },
  { key: 'proposta', label: 'Proposta', color: 'bg-warning/20' },
  { key: 'fechado', label: 'Fechado', color: 'bg-success/20' },
  { key: 'perdido', label: 'Perdido', color: 'bg-destructive/20' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function PipelinePage() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mt-2 h-[calc(100vh-7rem)]">
      {stages.map((stage) => {
        const deals = pipelineDeals.filter((d) => d.stage === stage.key);
        const total = deals.reduce((s, d) => s + d.value, 0);
        return (
          <div
            key={stage.key}
            className="flex min-w-[260px] flex-col rounded-xl border border-border bg-card card-shadow flex-1"
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                <Badge variant="secondary" className="text-xs ml-1">{deals.length}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{formatCurrency(total)}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {deals.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Nenhum negócio</div>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-border bg-background p-3 card-shadow hover:card-shadow-md transition-shadow cursor-pointer"
                  >
                    <p className="text-sm font-medium text-foreground">{deal.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{deal.contactName}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(deal.value)}</span>
                      <span className="text-xs text-muted-foreground">{deal.probability}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
