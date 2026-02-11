import { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Plus,
  CheckCircle,
  Briefcase,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import TaskModal from '@/components/tarefas/TaskModal';
import { useCreateDeal } from '@/hooks/useDeals';
import { closeConversation } from '@/services/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { ConversationDetail } from '@/services/api';

interface Props {
  conversation: ConversationDetail;
  onClose: () => void;
}

const closeReasons = [
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'spam', label: 'Spam' },
  { value: 'duplicado', label: 'Duplicado' },
  { value: 'outro', label: 'Outro' },
];

export default function ContactProfilePanel({ conversation, onClose }: Props) {
  const contact = conversation.contact;
  const tags = (contact.tags as string[]) || [];
  const queryClient = useQueryClient();

  // Task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Deal modal
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const createDeal = useCreateDeal();
  const [dealForm, setDealForm] = useState({ title: '', value: 0, notes: '' });

  // Close conversation modal
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('resolvido');
  const [closing, setClosing] = useState(false);

  const handleCreateDeal = () => {
    if (!dealForm.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    createDeal.mutate(
      { title: dealForm.title, contact_id: contact.id, value: dealForm.value, notes: dealForm.notes },
      {
        onSuccess: () => {
          setDealModalOpen(false);
          setDealForm({ title: '', value: 0, notes: '' });
        },
      },
    );
  };

  const handleCloseConversation = async () => {
    setClosing(true);
    try {
      await closeConversation(conversation.id, closeReason);
      toast.success('Conversa fechada!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      setCloseModalOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao fechar conversa');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex w-72 min-w-[288px] flex-col border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Perfil do Contato</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Contact card */}
        <div className="flex flex-col items-center p-4 pb-3">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarFallback>{contact.name[0]}</AvatarFallback>
          </Avatar>
          <h3 className="text-sm font-semibold text-foreground">{contact.name}</h3>

          <div className="mt-3 w-full space-y-2">
            {contact.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone size={12} className="shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div className="mt-3 w-full">
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-4 space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-8"
            onClick={() => setTaskModalOpen(true)}
          >
            <Plus size={14} />
            Criar tarefa
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-8"
            onClick={() => setDealModalOpen(true)}
          >
            <Briefcase size={14} />
            Criar negócio
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-8 text-destructive hover:text-destructive"
            onClick={() => setCloseModalOpen(true)}
            disabled={conversation.status === 'closed'}
          >
            <CheckCircle size={14} />
            {conversation.status === 'closed' ? 'Conversa fechada' : 'Fechar conversa'}
          </Button>
        </div>

        <Separator />

        {/* Notes */}
        {contact.notes && (
          <div className="p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Observações</h4>
            <p className="text-xs text-muted-foreground">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Task Modal */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        defaultContactId={contact.id}
        defaultContactName={contact.name}
      />

      {/* Deal Modal */}
      <Dialog open={dealModalOpen} onOpenChange={setDealModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Negócio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input
                value={dealForm.title}
                onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
                placeholder="Ex: Plano Enterprise"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Contato</Label>
              <Input value={contact.name} disabled className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                value={dealForm.value}
                onChange={(e) => setDealForm({ ...dealForm, value: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={dealForm.notes}
                onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
                placeholder="Notas sobre o negócio..."
                className="mt-1 min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDealModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending}>Criar Negócio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Conversation Modal */}
      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Fechar Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Motivo</Label>
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {closeReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCloseConversation} disabled={closing}>
              Fechar conversa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
