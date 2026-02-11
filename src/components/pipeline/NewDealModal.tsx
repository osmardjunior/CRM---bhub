import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamMembers, useContacts } from '@/hooks/useContacts';
import { useCreateDeal } from '@/hooks/useDeals';
import type { DealStage } from '@/services/deals';

const stages: { key: DealStage; label: string }[] = [
  { key: 'novo_lead', label: 'Novo Lead' },
  { key: 'em_contato', label: 'Em Contato' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'fechamento', label: 'Fechamento' },
  { key: 'ganho', label: 'Ganho' },
  { key: 'perdido', label: 'Perdido' },
];

interface NewDealModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewDealModal({ open, onClose }: NewDealModalProps) {
  const { data: teamMembers } = useTeamMembers();
  const { data: contacts } = useContacts();
  const createDeal = useCreateDeal();

  const [form, setForm] = useState({
    title: '',
    value: '',
    stage: 'novo_lead' as DealStage,
    contactId: '',
    assignedUserId: '',
    probability: '',
    notes: '',
  });
  const [errors, setErrors] = useState<{ title?: string }>({});

  const resetForm = () => {
    setForm({
      title: '',
      value: '',
      stage: 'novo_lead',
      contactId: '',
      assignedUserId: '',
      probability: '',
      notes: '',
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setErrors({ title: 'Título é obrigatório' });
      return;
    }

    createDeal.mutate(
      {
        title: form.title,
        value: form.value ? Number(form.value) : 0,
        stage: form.stage,
        contact_id: form.contactId && form.contactId !== 'none' ? form.contactId : null,
        assigned_user_id: form.assignedUserId && form.assignedUserId !== 'none' ? form.assignedUserId : null,
        probability: form.probability ? Number(form.probability) : 0,
        notes: form.notes || '',
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Nome do negócio"
              className={`mt-1 ${errors.title ? 'border-destructive' : ''}`}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0,00"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Probabilidade (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })}
                placeholder="0"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Etapa</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as DealStage })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={form.assignedUserId || 'none'} onValueChange={(v) => setForm({ ...form, assignedUserId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(teamMembers ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Contato vinculado</Label>
            <Select value={form.contactId || 'none'} onValueChange={(v) => setForm({ ...form, contactId: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {(contacts ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas sobre o negócio..."
              className="mt-1 min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createDeal.isPending}>
            Criar Negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
