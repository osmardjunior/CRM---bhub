import { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Plus,
  CheckCircle,
  Briefcase,
  User,
  Tag,
  Calendar,
  Info,
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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
      <Icon size={13} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export default function ContactProfilePanel({ conversation, onClose }: Props) {
  const contact = conversation.contact;
  const tags = (contact.tags as string[]) || [];
  const queryClient = useQueryClient();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const createDeal = useCreateDeal();
  const [dealForm, setDealForm] = useState({ title: '', value: 0, notes: '' });
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

  const createdAt = new Date(contact.created_at ?? '').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex w-72 min-w-[272px] flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Perfil do Contato</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X size={13} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Contact card */}
        <div className="flex flex-col items-center pt-5 pb-4 px-4 border-b border-border">
          <Avatar className="h-14 w-14 mb-3 ring-2 ring-primary/20">
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {contact.name[0]}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-sm font-bold text-foreground text-center">{contact.name}</h3>
          {contact.phone && (
            <p className="text-xs text-primary font-medium mt-0.5">{contact.phone}</p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 justify-center">
              {tags.map((tag) => (
                <Badge key={tag} className="text-[10px] px-2 py-0.5 bg-accent text-accent-foreground border-0 rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-3 py-3 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações rápidas</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs justify-start"
              onClick={() => setTaskModalOpen(true)}
            >
              <Plus size={12} />
              Tarefa
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs justify-start"
              onClick={() => setDealModalOpen(true)}
            >
              <Briefcase size={12} />
              Negócio
            </Button>
          </div>
          {conversation.status !== 'closed' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 mt-1.5 gap-1.5 text-xs justify-start text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setCloseModalOpen(true)}
            >
              <CheckCircle size={12} />
              Fechar conversa
            </Button>
          )}
        </div>

        {/* Responsável */}
        <div className="px-3 py-3 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Responsável</p>
          <div className="flex items-center gap-2 py-1.5 px-2 bg-secondary/50 rounded-lg">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {conversation.assigned_user?.name?.[0] ?? '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground">
              {conversation.assigned_user?.name ?? 'Não atribuído'}
            </span>
          </div>
        </div>

        {/* Contact info */}
        <div className="px-3 py-3 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Informações</p>
          <div>
            {contact.phone && <InfoRow icon={Phone} label="WhatsApp" value={contact.phone} />}
            {contact.email && <InfoRow icon={Mail} label="E-mail" value={contact.email} />}
            {contact.source && <InfoRow icon={Info} label="Origem" value={contact.source} />}
            <InfoRow icon={Calendar} label="Data de cadastro" value={createdAt} />
          </div>
        </div>

        {/* Tags section */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tags</p>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Plus size={11} />
            </Button>
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0.5 rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma tag adicionada</p>
          )}
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="px-3 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{contact.notes}</p>
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
