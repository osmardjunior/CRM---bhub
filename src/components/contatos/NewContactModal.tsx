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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateContact } from '@/hooks/useContacts';
import { useTags } from '@/hooks/useTags';
import { supabase } from '@/integrations/supabase/client';

const sourceOptions = ['WhatsApp', 'Instagram', 'Webchat', 'Indicação', 'Google Ads', 'Facebook Ads'];

interface NewContactModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string | null;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
}

export default function NewContactModal({ open, onClose, companyId }: NewContactModalProps) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: '' });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const createContact = useCreateContact();
  const { data: availableTags } = useTags();

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    if (!form.phone.trim()) e.phone = 'Telefone é obrigatório';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !companyId) return;
    const newContact = await createContact.mutateAsync({
      company_id: companyId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      source: form.source || null,
    });
    // Insert into normalized contact_tags table
    if (selectedTagIds.length > 0 && newContact?.id) {
      await supabase.from('contact_tags').insert(
        selectedTagIds.map(tagId => ({ contact_id: newContact.id, tag_id: tagId }))
      );
    }
    handleClose();
  };

  const handleClose = () => {
    onClose();
    setForm({ name: '', phone: '', email: '', source: '' });
    setSelectedTagIds([]);
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
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" className={`mt-1 ${errors.name ? 'border-destructive' : ''}`} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs">Telefone *</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" className={`mt-1 ${errors.phone ? 'border-destructive' : ''}`} />
            {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" className={`mt-1 ${errors.email ? 'border-destructive' : ''}`} />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
              <SelectContent>
                {sourceOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Tags */}
          <div>
            <Label className="text-xs">Tags</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(availableTags ?? []).map(tag => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={selected ? 'default' : 'outline'}
                    className="text-xs cursor-pointer transition-colors"
                    style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                    onClick={() => setSelectedTagIds(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  >
                    <span className="h-2 w-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: selected ? '#fff' : tag.color }} />
                    {tag.name}
                  </Badge>
                );
              })}
              {(!availableTags || availableTags.length === 0) && (
                <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada. Crie em Configurações → Tags.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createContact.isPending}>
            {createContact.isPending ? 'Criando...' : 'Criar Contato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
