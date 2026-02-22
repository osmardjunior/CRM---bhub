import { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Plus,
  CheckCircle,
  Calendar,
  Info,
  GitBranch,
  Star,
  Archive,
  Bot,
  UserPlus,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ConversationAvatar from '@/components/inbox/ConversationAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { isGroupChat } from '@/services/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { updateContact } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { useTags } from '@/hooks/useTags';
import { useContactTags, useAddContactTag, useRemoveContactTag } from '@/hooks/useContactTags';
import { closeConversation } from '@/services/api';
import { useFunnels } from '@/contexts/FunnelContext';
import { useContactFunnelsByContact, useAddContactToStage, useRemoveContactFromStage } from '@/hooks/useContactFunnelStages';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
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

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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
  const queryClient = useQueryClient();
  const { data: availableTags = [] } = useTags();
  const { data: contactTags = [] } = useContactTags(contact.id);
  const addTag = useAddContactTag();
  const removeTag = useRemoveContactTag();

  // Funnel
  const { funnels } = useFunnels();
  const { data: contactFunnelStages = [] } = useContactFunnelsByContact(contact.id);
  const addContactToStage = useAddContactToStage();
  const removeContactFromStage = useRemoveContactFromStage();
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');

  // Filter funnel stages for this contact
  const contactFunnelEntries = contactFunnelStages.filter((cfs) => cfs.contact_id === contact.id);

  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId);

  const handleAddToFunnel = () => {
    if (!selectedFunnelId || !selectedStageId) return;
    addContactToStage.mutate({ contactId: contact.id, funnelId: selectedFunnelId, stageId: selectedStageId });
    setSelectedFunnelId('');
    setSelectedStageId('');
  };

  // Conversation history for this contact
  const { data: contactConversations = [] } = useQuery({
    queryKey: ['contact-conversations', contact.id],
    enabled: !!contact.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, status, created_at, last_message_at')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('resolvido');
  const [closing, setClosing] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Team for delegation
  const { data: teamMembers = [] } = useTeamProfiles();
  const [delegatePopoverOpen, setDelegatePopoverOpen] = useState(false);

  const handleDelegate = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: userId })
        .eq('id', conversation.id);
      if (error) throw error;
      toast.success('Conversa delegada!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      setDelegatePopoverOpen(false);
    } catch {
      toast.error('Erro ao delegar conversa');
    }
  };

  const handleToggleArchive = async () => {
    try {
      await updateContact(contact.id, { is_archived: !contact.is_archived });
      toast.success(contact.is_archived ? 'Contato desarquivado' : 'Contato arquivado');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch {
      toast.error('Erro ao arquivar contato');
    }
  };

  const handleToggleFavorite = async () => {
    try {
      await updateContact(contact.id, { is_favorite: !contact.is_favorite });
      toast.success(contact.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch {
      toast.error('Erro ao favoritar contato');
    }
  };

  const handleToggleChatbot = async () => {
    const newVal = !(contact.chatbot_enabled ?? true);
    try {
      await updateContact(contact.id, { chatbot_enabled: newVal });
      toast.success(newVal ? 'Chatbot ativado' : 'Chatbot desativado');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch {
      toast.error('Erro ao alterar chatbot');
    }
  };
  const contactTagIds = contactTags.map((ct) => ct.tag_id);

  const handleToggleTag = (tagId: string) => {
    if (contactTagIds.includes(tagId)) {
      removeTag.mutate({ contactId: contact.id, tagId });
    } else {
      addTag.mutate({ contactId: contact.id, tagId });
    }
  };

  const handleRemoveTag = (tagId: string) => {
    removeTag.mutate({ contactId: contact.id, tagId });
  };

  const handleCloseConversation = async () => {
    setClosing(true);
    try {
      await closeConversation(conversation.id, closeReason);
      toast.success('Conversa fechada!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      setCloseModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fechar conversa');
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

  const contactAvatarUrl = (contact as { avatar_url?: string | null }).avatar_url;

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
          <div className="mb-3">
            <ConversationAvatar
              name={contact.name}
              avatarUrl={contactAvatarUrl}
              isGroup={isGroupChat(contact.phone)}
              size="lg"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground text-center">{contact.name}</h3>
          {contact.phone && (
            <p className="text-xs text-primary font-medium mt-0.5">{contact.phone}</p>
          )}

          {/* Tags */}
          {contactTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 justify-center">
              {contactTags.map((ct) => (
                <Badge key={ct.tag_id} className="text-[10px] px-2 py-0.5 border-0 rounded-full text-white" style={{ backgroundColor: ct.tag_color }}>
                  {ct.tag_name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-3 py-3 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações rápidas</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Popover open={delegatePopoverOpen} onOpenChange={setDelegatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs justify-start">
                  <UserPlus size={12} />
                  Delegar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start">
                <p className="text-xs font-semibold mb-2">Delegar para</p>
                <ScrollArea className="max-h-40">
                  <div className="space-y-0.5">
                    {teamMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleDelegate(m.id)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{m.name[0]}</AvatarFallback>
                        </Avatar>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs justify-start ${contact.is_favorite ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' : ''}`}
              onClick={handleToggleFavorite}
            >
              <Star size={12} className={contact.is_favorite ? 'fill-amber-500' : ''} />
              {contact.is_favorite ? 'Favorito' : 'Favoritar'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs justify-start ${contact.is_archived ? 'bg-muted text-muted-foreground' : ''}`}
              onClick={handleToggleArchive}
            >
              <Archive size={12} />
              {contact.is_archived ? 'Desarquivar' : 'Arquivar'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs justify-start ${(contact.chatbot_enabled ?? true) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : ''}`}
              onClick={handleToggleChatbot}
            >
              <Bot size={12} />
              {(contact.chatbot_enabled ?? true) ? 'Bot On' : 'Bot Off'}
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
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus size={11} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <p className="text-xs font-semibold mb-2">Gerenciar tags</p>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {availableTags.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={contactTagIds.includes(t.id)}
                          onCheckedChange={() => handleToggleTag(t.id)}
                          disabled={addTag.isPending || removeTag.isPending}
                        />
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="text-xs">{t.name}</span>
                      </label>
                    ))}
                    {availableTags.length === 0 && (
                      <p className="text-xs text-muted-foreground italic px-2 py-1">Nenhuma tag cadastrada</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          {contactTags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {contactTags.map((ct) => (
                <Badge
                  key={ct.tag_id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 rounded-full gap-0.5 cursor-pointer hover:bg-destructive/15 hover:text-destructive transition-colors"
                  style={{ borderColor: ct.tag_color, color: ct.tag_color }}
                  onClick={() => handleRemoveTag(ct.tag_id)}
                >
                  {ct.tag_name}
                  <X size={9} className="shrink-0" />
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma tag adicionada</p>
          )}
        </div>

        {/* Funnel section */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <GitBranch size={11} />
              Funil
            </p>
          </div>

          {/* Current funnel positions */}
          {contactFunnelEntries.length > 0 && (
            <div className="space-y-1 mb-2">
              {contactFunnelEntries.map((entry) => {
                const funnel = funnels.find((f) => f.id === entry.funnel_id);
                const stage = funnel?.stages.find((s) => s.id === entry.stage_id);
                return (
                  <div key={entry.id} className="flex items-center justify-between bg-secondary/50 rounded px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-foreground truncate">{funnel?.name ?? 'Funil'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{stage?.label ?? 'Etapa'}</p>
                    </div>
                    <button
                      onClick={() => removeContactFromStage.mutate(entry.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0"
                      title="Remover do funil"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add to funnel */}
          <div className="space-y-1.5">
            <Select value={selectedFunnelId} onValueChange={(v) => { setSelectedFunnelId(v); setSelectedStageId(''); }}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="Selecionar funil..." />
              </SelectTrigger>
              <SelectContent>
                {funnels.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedFunnel && (
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Selecionar etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedFunnel.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedFunnelId && selectedStageId && (
              <Button
                size="sm"
                className="w-full h-7 text-[11px] gap-1 bg-success hover:bg-success/90 text-success-foreground"
                onClick={handleAddToFunnel}
                disabled={addContactToStage.isPending}
              >
                <Plus size={11} />
                Adicionar ao Funil
              </Button>
            )}
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="px-3 py-3 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{contact.notes}</p>
          </div>
        )}

        {/* Conversation history */}
        <div className="px-3 py-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <MessageSquare size={11} />
            Histórico de conversas
          </p>
          {contactConversations.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma conversa anterior</p>
          ) : (
            <div className="space-y-1">
              {contactConversations.map((conv) => {
                const statusColors: Record<string, string> = {
                  open: 'bg-success/15 text-success',
                  pending: 'bg-warning/15 text-warning',
                  closed: 'bg-muted text-muted-foreground',
                };
                const statusLabels: Record<string, string> = {
                  open: 'Em Atend.',
                  pending: 'Aguardando',
                  closed: 'Fechada',
                };
                const dateStr = new Date(conv.last_message_at ?? conv.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                });
                return (
                  <div
                    key={conv.id}
                    className={`flex items-center justify-between rounded px-2 py-1.5 ${conv.id === conversation.id ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/40'}`}
                  >
                    <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[conv.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {conv.id === conversation.id ? '● Atual' : (statusLabels[conv.status] ?? conv.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
