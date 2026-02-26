import { useState } from 'react';
import { Save, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamMembers } from '@/hooks/useContacts';
import type { DealWithRelations, DealStage } from '@/services/deals';

interface DealDetailDrawerProps {
  deal: DealWithRelations;
  stages: { key: DealStage; label: string }[];
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getDaysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function DealDetailDrawer({ deal, stages, onClose, onUpdate }: DealDetailDrawerProps) {
  const { data: teamMembers } = useTeamMembers();
  const [form, setForm] = useState({
    title: deal.title,
    value: Number(deal.value),
    stage: deal.stage,
    assigned_user_id: deal.assigned_user_id ?? '',
    notes: deal.notes ?? '',
  });

  const handleSave = () => {
    onUpdate(deal.id, form);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{deal.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{getDaysAgo(deal.created_at)} dias no pipeline</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="rounded-lg bg-accent/50 border border-accent p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Valor do negócio</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(form.value)}</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 bg-secondary border-0" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Contato</Label>
            <Input value={deal.contact?.name ?? '—'} disabled className="mt-1 bg-secondary border-0" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
            <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="mt-1 bg-secondary border-0" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as DealStage })}>
              <SelectTrigger className="mt-1 bg-secondary border-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select value={form.assigned_user_id} onValueChange={(v) => setForm({ ...form, assigned_user_id: v })}>
              <SelectTrigger className="mt-1 bg-secondary border-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(teamMembers ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="text-xs text-muted-foreground">Observações</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-1 bg-secondary border-0 min-h-[80px] text-sm"
            placeholder="Anotações sobre o negócio..."
          />
        </div>
      </div>

      <div className="border-t border-border p-4">
        <Button className="w-full gap-2" size="sm" onClick={handleSave}>
          <Save size={14} />
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
