import { useState } from 'react';
import { X, Save, CalendarDays, User, DollarSign, FileText, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PipelineDeal, PipelineStage } from '@/data/mock';
import { agents } from '@/data/mock';

interface DealDetailDrawerProps {
  deal: PipelineDeal;
  stages: { key: PipelineStage; label: string }[];
  onClose: () => void;
  onUpdate: (deal: PipelineDeal) => void;
}

const mockTimeline = [
  { id: '1', action: 'Negócio criado', user: 'Sistema', time: 'Há 30 dias' },
  { id: '2', action: 'Etapa alterada para "Em Contato"', user: 'Ana Silva', time: 'Há 25 dias' },
  { id: '3', action: 'Nota adicionada', user: 'Carlos Rocha', time: 'Há 18 dias' },
  { id: '4', action: 'Proposta enviada', user: 'Ana Silva', time: 'Há 10 dias' },
  { id: '5', action: 'Follow-up realizado', user: 'Felipe Moura', time: 'Há 3 dias' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getDaysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function DealDetailDrawer({ deal, stages, onClose, onUpdate }: DealDetailDrawerProps) {
  const [form, setForm] = useState({
    title: deal.title,
    contactName: deal.contactName,
    value: deal.value,
    stage: deal.stage,
    assignedTo: deal.assignedTo,
    notes: deal.notes,
  });

  const handleSave = () => {
    onUpdate({ ...deal, ...form });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{deal.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{getDaysAgo(deal.createdAt)} dias no pipeline</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Value highlight */}
        <div className="rounded-lg bg-accent/50 border border-accent p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Valor do negócio</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(form.value)}</p>
        </div>

        {/* Editable fields */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 bg-secondary border-0" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Contato</Label>
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 bg-secondary border-0" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="mt-1 bg-secondary border-0" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as PipelineStage })}>
              <SelectTrigger className="mt-1 bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
              <SelectTrigger className="mt-1 bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Notes */}
        <div>
          <Label className="text-xs text-muted-foreground">Observações</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-1 bg-secondary border-0 min-h-[80px] text-sm"
            placeholder="Anotações sobre o negócio..."
          />
        </div>

        <Separator />

        {/* Activity timeline */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Atividade</h3>
          <div className="space-y-3">
            {mockTimeline.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  <div className="flex-1 w-px bg-border" />
                </div>
                <div className="pb-3">
                  <p className="text-sm text-foreground">{event.action}</p>
                  <p className="text-xs text-muted-foreground">{event.user} · {event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-2">
        <Button variant="outline" className="w-full gap-2" size="sm">
          <CheckSquare size={14} />
          Criar tarefa
        </Button>
        <Button className="w-full gap-2" size="sm" onClick={handleSave}>
          <Save size={14} />
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
