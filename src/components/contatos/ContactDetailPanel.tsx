import { useState } from 'react';
import { X, MessageSquare, Save } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import StatusBadge from '@/components/StatusBadge';
import type { Contact } from '@/data/mock';
import { useNavigate } from 'react-router-dom';

interface ContactDetailPanelProps {
  contact: Contact;
  onClose: () => void;
}

export default function ContactDetailPanel({ contact, onClose }: ContactDetailPanelProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    origem: contact.origem,
    observacoes: contact.observacoes,
  });
  const [tags, setTags] = useState(contact.tags);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Detalhes do Contato</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Avatar + name header */}
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar className="h-16 w-16">
            <AvatarImage src={contact.avatar} />
            <AvatarFallback className="text-lg">{contact.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{contact.name}</p>
            <p className="text-xs text-muted-foreground">{contact.phone}</p>
          </div>
          <StatusBadge status={contact.status} />
        </div>

        <Separator />

        {/* Editable fields */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 bg-secondary border-0"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 bg-secondary border-0"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 bg-secondary border-0"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Origem</Label>
            <Input
              value={form.origem}
              onChange={(e) => setForm({ ...form, origem: e.target.value })}
              className="mt-1 bg-secondary border-0"
            />
          </div>
        </div>

        <Separator />

        {/* Tags */}
        <div>
          <Label className="text-xs text-muted-foreground">Tags</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs gap-1 cursor-pointer hover:bg-destructive/15 hover:text-destructive transition-colors"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Nova tag..."
              className="flex-1 h-8 text-xs bg-secondary border-0"
            />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleAddTag}>
              Adicionar
            </Button>
          </div>
        </div>

        <Separator />

        {/* Observações */}
        <div>
          <Label className="text-xs text-muted-foreground">Observações</Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="mt-1 bg-secondary border-0 min-h-[80px] text-sm"
            placeholder="Adicione observações sobre o contato..."
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-border p-3 space-y-2">
        <Button
          className="w-full gap-2"
          size="sm"
          onClick={() => navigate('/inbox')}
        >
          <MessageSquare size={14} />
          Abrir conversa
        </Button>
        <Button variant="outline" className="w-full gap-2" size="sm">
          <Save size={14} />
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
