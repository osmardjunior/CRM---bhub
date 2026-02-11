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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { origens } from '@/data/mock';

interface NewContactModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
}

export default function NewContactModal({ open, onClose }: NewContactModalProps) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', origem: '' });
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    if (!form.phone.trim()) e.phone = 'Telefone é obrigatório';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onClose();
      setForm({ name: '', phone: '', email: '', origem: '' });
      setErrors({});
    }
  };

  const handleClose = () => {
    onClose();
    setForm({ name: '', phone: '', email: '', origem: '' });
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Contato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome completo"
              className={`mt-1 ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label className="text-xs">Telefone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(00) 00000-0000"
              className={`mt-1 ${errors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
          </div>

          <div>
            <Label className="text-xs">Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com"
              className={`mt-1 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar origem" />
              </SelectTrigger>
              <SelectContent>
                {origens.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar Contato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
