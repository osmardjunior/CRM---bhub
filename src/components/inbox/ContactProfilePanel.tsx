import { useState, useRef } from 'react';
import { normalizeWhatsAppNumber } from '@/utils/whatsapp';
import {
  X, Phone, Mail, Plus, CheckCircle, Calendar, Info, GitBranch,
  Star, Archive, Bot, UserPlus, MessageSquare, History, User,
  ArrowRight, StickyNote, Pencil, Trash2, AlertTriangle, Smartphone,
  Clock, Tag as TagIcon, type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ConversationAvatar from '@/components/inbox/ConversationAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { isGroupChat } from '@/services/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { updateContact, deleteContact } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { useTags } from '@/hooks/useTags';
import { useContactTags, useAddContactTag, useRemoveContactTag } from '@/hooks/useContactTags';
import { closeConversation } from '@/services/api';
import { useFunnels } from '@/contexts/FunnelContext';
import { useContactFunnelsByContact, useAddContactToStage, useRemoveContactFromStage } from '@/hooks/useContactFunnelStages';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { ConversationDetail } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  conversation: ConversationDetail;
  onClose: () => void;
}

type ActiveSection = 'perfil' | 'tags' | 'funil' | 'agendadas' | 'anotacoes' | 'historico';

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
  const { user, companyId } = useAuth();

  const [activeSection, setActiveSection] = useState<ActiveSection>('perfil');

  const { data: availableTags = [] } = useTags();
  const { data: contactTags = [] } = useContactTags(contact.id);
  const addTag = useAddContactTag();
  const removeTag = useRemoveContactTag();

  const { funnels } = useFunnels();
  const { data: contactFunnelStages = [] } = useContactFunnelsByContact(contact.id);
  const addContactToStage = useAddContactToStage();
  const removeContactFromStage = useRemoveContactFromStage();
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const contactFunnelEntries = contactFunnelStages.filter((cfs) => cfs.contact_id === contact.id);
  const selectedFunnel = funnels.find((f) => f.id === selectedFunnelId);

  const handleAddToFunnel = () => {
    if (!selectedFunnelId || !selectedStageId) return;
    addContactToStage.mutate({ contactId: contact.id, funnelId: selectedFunnelId, stageId: selectedStageId });
    setSelectedFunnelId('');
    setSelectedStageId('');
  };

  // Conversation history
  const { data: contactConversations = [] } = useQuery({
    queryKey: ['contact-conversations', contact.id],
    enabled: !!contact.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations').select('id, status, created_at, last_message_at')
        .eq('contact_id', contact.id).order('last_message_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Scheduled messages
  const { data: scheduledMessages = [] } = useQuery({
    queryKey: ['scheduled-messages-panel', conversation.id],
    enabled: !!conversation.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_messages').select('*')
        .eq('conversation_id', conversation.id)
        .is('sent_at', null).is('cancelled_at', null)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Annotations
  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations-panel', conversation.id],
    enabled: !!conversation.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annotations')
        .select('*, author:profiles!annotations_author_id_fkey(name)')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Events timeline
  const { data: convEvents = [] } = useQuery({
    queryKey: ['conversation-events', conversation.id],
    enabled: !!conversation.id && activeSection === 'historico',
    queryFn: async () => {
      const [eventsRes, annotationsRes] = await Promise.all([
        supabase.from('conversation_events')
          .select('*, actor:profiles!conversation_events_actor_id_fkey(name)')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('annotations')
          .select('*, author:profiles!annotations_author_id_fkey(name)')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false }).limit(50),
      ]);
      const events = (eventsRes.data ?? []).map((e: any) => ({ ...e, _kind: 'event' as const }));
      const notes = (annotationsRes.data ?? []).map((a: any) => ({ ...a, _kind: 'annotation' as const }));
      return [...events, ...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('resolvido');
  const [closing, setClosing] = useState(false);
  const [deleteContactOpen, setDeleteContactOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(contact.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [newAnnotation, setNewAnnotation] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [newSchedContent, setNewSchedContent] = useState('');
  const [newSchedAt, setNewSchedAt] = useState('');
  const [savingScheduled, setSavingScheduled] = useState(false);

  const { data: teamMembers = [] } = useTeamProfiles();
  const [delegatePopoverOpen, setDelegatePopoverOpen] = useState(false);

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (!trimmed || trimmed === contact.phone) { setEditingPhone(false); return; }
    let normalized: string;
    try { normalized = normalizeWhatsAppNumber(trimmed); }
    catch (err: any) { toast.error('Telefone inválido: ' + err.message); return; }
    setSavingPhone(true);
    try {
      await updateContact(contact.id, { phone: normalized, phone_e164: normalized });
      toast.success('Telefone atualizado');
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setEditingPhone(false);
    } catch { toast.error('Erro ao atualizar telefone'); }
    finally { setSavingPhone(false); }
  };

  const handleDeleteContact = async () => {
    setDeletingContact(true);
    try {
      await deleteContact(contact.id);
      toast.success('Contato excluído');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      onClose();
    } catch { toast.error('Erro ao excluir contato'); }
    finally { setDeletingContact(false); setDeleteContactOpen(false); }
  };

  const handleDelegate = async (userId: string) => {
    try {
      const { error } = await supabase.from('conversations').update({ assigned_user_id: userId }).eq('id', conversation.id);
      if (error) throw error;
      toast.success('Conversa delegada!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      setDelegatePopoverOpen(false);
    } catch { toast.error('Erro ao delegar conversa'); }
  };

  const handleToggleArchive = async () => {
    try {
      await updateContact(contact.id, { is_archived: !contact.is_archived });
      toast.success(contact.is_archived ? 'Contato desarquivado' : 'Contato arquivado');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch { toast.error('Erro ao arquivar contato'); }
  };

  const handleToggleFavorite = async () => {
    try {
      await updateContact(contact.id, { is_favorite: !contact.is_favorite });
      toast.success(contact.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch { toast.error('Erro ao favoritar contato'); }
  };

  const handleToggleChatbot = async () => {
    const newVal = !(contact.chatbot_enabled ?? true);
    try {
      await updateContact(contact.id, { chatbot_enabled: newVal });
      toast.success(newVal ? 'Chatbot ativado' : 'Chatbot desativado');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch { toast.error('Erro ao alterar chatbot'); }
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
    } finally { setClosing(false); }
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim()) return;
    setSavingAnnotation(true);
    try {
      const { error } = await supabase.from('annotations').insert({
        conversation_id: conversation.id, company_id: companyId,
        author_id: user?.id, body: newAnnotation.trim(),
      });
      if (error) throw error;
      setNewAnnotation('');
      queryClient.invalidateQueries({ queryKey: ['annotations-panel', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events', conversation.id] });
      toast.success('Anotação salva');
    } catch { toast.error('Erro ao salvar anotação'); }
    finally { setSavingAnnotation(false); }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const { error } = await supabase.from('scheduled_messages')
        .update({ cancelled_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages-panel', conversation.id] });
      toast.success('Mensagem cancelada');
    } catch { toast.error('Erro ao cancelar mensagem'); }
  };

  const handleAddScheduled = async () => {
    if (!newSchedContent.trim() || !newSchedAt) return;
    setSavingScheduled(true);
    try {
      const { error } = await supabase.from('scheduled_messages').insert({
        conversation_id: conversation.id, company_id: companyId,
        created_by: user?.id, content: newSchedContent.trim(),
        scheduled_at: new Date(newSchedAt).toISOString(), type: 'text',
      });
      if (error) throw error;
      setNewSchedContent(''); setNewSchedAt('');
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages-panel', conversation.id] });
      toast.success('Mensagem agendada');
    } catch { toast.error('Erro ao agendar mensagem'); }
    finally { setSavingScheduled(false); }
  };

  const contactTagIds = contactTags.map((ct) => ct.tag_id);
  const handleToggleTag = (tagId: string) => {
    if (contactTagIds.includes(tagId)) removeTag.mutate({ contactId: contact.id, tagId });
    else addTag.mutate({ contactId: contact.id, tagId });
  };

  const createdAt = new Date(contact.created_at ?? '').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const contactAvatarUrl = (contact as { avatar_url?: string | null }).avatar_url;

  const sections: { key: ActiveSection; icon: LucideIcon; label: string }[] = [
    { key: 'perfil',    icon: User,        label: 'Perfil'     },
    { key: 'tags',      icon: TagIcon,     label: 'Tags'       },
    { key: 'funil',     icon: GitBranch,   label: 'Funil'      },
    { key: 'agendadas', icon: Clock,       label: 'Agendadas'  },
    { key: 'anotacoes', icon: StickyNote,  label: 'Anotações'  },
    { key: 'historico', icon: History,     label: 'Histórico'  },
  ];

  return (
    <div className="flex w-72 min-w-[272px] flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5 shrink-0">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Informações</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X size={13} /></Button>
      </div>

      {/* Section nav */}
      <div className="grid grid-cols-6 border-b border-border shrink-0">
        {sections.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            title={label}
            className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors text-[9px] font-semibold uppercase tracking-wide ${
              activeSection === key
                ? 'border-b-2 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <Icon size={13} />
            <span className="leading-none">{label.slice(0, 5)}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── PERFIL ───────────────────────────────────────── */}
        {activeSection === 'perfil' && (
          <>
            {/* Contact card */}
            <div className="flex flex-col items-center pt-5 pb-4 px-4 border-b border-border">
              <div className="mb-3">
                <ConversationAvatar name={contact.name} avatarUrl={contactAvatarUrl} isGroup={isGroupChat(contact.phone)} size="lg" />
              </div>
              <h3 className="text-sm font-bold text-foreground text-center">{contact.name}</h3>
              {contact.phone && <p className="text-xs text-primary font-medium mt-0.5">{contact.phone}</p>}
            </div>

            {/* Quick actions */}
            <div className="px-3 py-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações rápidas</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Popover open={delegatePopoverOpen} onOpenChange={setDelegatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs justify-start"><UserPlus size={12} />Delegar</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="start">
                    <p className="text-xs font-semibold mb-2">Delegar para</p>
                    <ScrollArea className="max-h-40">
                      <div className="space-y-0.5">
                        {teamMembers.map((m) => (
                          <button key={m.id} onClick={() => handleDelegate(m.id)} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left">
                            <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">{m.name[0]}</AvatarFallback></Avatar>
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs justify-start ${contact.is_favorite ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' : ''}`} onClick={handleToggleFavorite}>
                  <Star size={12} className={contact.is_favorite ? 'fill-amber-500' : ''} />
                  {contact.is_favorite ? 'Favorito' : 'Favoritar'}
                </Button>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs justify-start ${contact.is_archived ? 'bg-muted text-muted-foreground' : ''}`} onClick={handleToggleArchive}>
                  <Archive size={12} />{contact.is_archived ? 'Desarquivar' : 'Arquivar'}
                </Button>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs justify-start ${(contact.chatbot_enabled ?? true) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : ''}`} onClick={handleToggleChatbot}>
                  <Bot size={12} />{(contact.chatbot_enabled ?? true) ? 'Bot On' : 'Bot Off'}
                </Button>
              </div>
              {conversation.status !== 'closed' && (
                <Button variant="outline" size="sm" className="w-full h-8 mt-1.5 gap-1.5 text-xs justify-start text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setCloseModalOpen(true)}>
                  <CheckCircle size={12} />Fechar conversa
                </Button>
              )}
              <Button variant="outline" size="sm" className="w-full h-8 mt-1 gap-1.5 text-xs justify-start text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setDeleteContactOpen(true)}>
                <Trash2 size={12} />Excluir contato
              </Button>
            </div>

            {/* Responsável */}
            <div className="px-3 py-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Responsável</p>
              <div className="flex items-center gap-2 py-1.5 px-2 bg-secondary/50 rounded-lg">
                <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{conversation.assigned_user?.name?.[0] ?? '?'}</AvatarFallback></Avatar>
                <span className="text-xs font-medium text-foreground">{conversation.assigned_user?.name ?? 'Não atribuído'}</span>
              </div>
            </div>

            {/* Contact info */}
            <div className="px-3 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Informações</p>
              <div className="flex items-start gap-2.5 py-2 border-b border-border/50">
                <Phone size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">WhatsApp</p>
                  {editingPhone ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input ref={phoneInputRef} value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSavePhone(); if (e.key === 'Escape') setEditingPhone(false); }}
                        className="flex-1 text-xs border border-border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                        placeholder="+55 11 99999-9999" autoFocus disabled={savingPhone} />
                      <button onClick={handleSavePhone} disabled={savingPhone} className="text-[10px] bg-primary text-primary-foreground rounded px-1.5 py-0.5 font-medium hover:bg-primary/90 shrink-0">{savingPhone ? '...' : 'OK'}</button>
                      <button onClick={() => { setEditingPhone(false); setPhoneInput(contact.phone ?? ''); }} className="text-muted-foreground hover:text-foreground shrink-0"><X size={11} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <p className="text-xs font-medium text-foreground truncate flex-1">{contact.phone || <span className="text-muted-foreground italic">Não informado</span>}</p>
                      <button onClick={() => { setPhoneInput(contact.phone ?? ''); setEditingPhone(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0" title="Editar telefone"><Pencil size={10} /></button>
                    </div>
                  )}
                </div>
              </div>
              {contact.email && <InfoRow icon={Mail} label="E-mail" value={contact.email} />}
              {contact.source && <InfoRow icon={Info} label="Origem" value={contact.source} />}
              {conversation.integration && (
                <InfoRow icon={Smartphone} label="Aparelho Origem" value={conversation.integration.phone_number ?? conversation.integration.device_name} />
              )}
              <InfoRow icon={Calendar} label="Data de cadastro" value={createdAt} />
              {contact.notes && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{contact.notes}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAGS ─────────────────────────────────────────── */}
        {activeSection === 'tags' && (
          <div className="px-3 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Tags do contato</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"><Plus size={11} />Adicionar</Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <p className="text-xs font-semibold mb-2">Gerenciar tags</p>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {availableTags.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors">
                          <Checkbox checked={contactTagIds.includes(t.id)} onCheckedChange={() => handleToggleTag(t.id)} disabled={addTag.isPending || removeTag.isPending} />
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-xs">{t.name}</span>
                        </label>
                      ))}
                      {availableTags.length === 0 && <p className="text-xs text-muted-foreground italic px-2 py-1">Nenhuma tag cadastrada</p>}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {contactTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contactTags.map((ct) => (
                  <Badge key={ct.tag_id} variant="outline"
                    className="text-[11px] px-2 py-1 rounded-full gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                    style={{ borderColor: ct.tag_color, color: ct.tag_color }}
                    onClick={() => removeTag.mutate({ contactId: contact.id, tagId: ct.tag_id })}>
                    {ct.tag_name}<X size={9} className="shrink-0" />
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <TagIcon size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Nenhuma tag adicionada</p>
                <p className="text-[11px] mt-0.5">Clique em Adicionar para começar</p>
              </div>
            )}
          </div>
        )}

        {/* ── FUNIL ────────────────────────────────────────── */}
        {activeSection === 'funil' && (
          <div className="px-3 py-4 space-y-4">
            <p className="text-xs font-semibold text-foreground">Funil de Vendas</p>

            {contactFunnelEntries.length > 0 ? (
              <div className="space-y-2">
                {contactFunnelEntries.map((entry) => {
                  const funnel = funnels.find((f) => f.id === entry.funnel_id);
                  const stage = funnel?.stages.find((s) => s.id === entry.stage_id);
                  return (
                    <div key={entry.id} className="flex items-center justify-between bg-secondary/60 rounded-lg px-3 py-2.5 border border-border">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{funnel?.name ?? 'Funil'}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{stage?.label ?? 'Etapa'}</p>
                      </div>
                      <button onClick={() => removeContactFromStage.mutate(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0 ml-2" title="Remover do funil">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <GitBranch size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Contato não está em nenhum funil</p>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adicionar ao funil</p>
              <Select value={selectedFunnelId} onValueChange={(v) => { setSelectedFunnelId(v); setSelectedStageId(''); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar funil..." /></SelectTrigger>
                <SelectContent>
                  {funnels.map((f) => <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedFunnel && (
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar etapa..." /></SelectTrigger>
                  <SelectContent>
                    {selectedFunnel.stages.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {selectedFunnelId && selectedStageId && (
                <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={handleAddToFunnel} disabled={addContactToStage.isPending}>
                  <Plus size={12} />Adicionar ao Funil
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── AGENDADAS ─────────────────────────────────────── */}
        {activeSection === 'agendadas' && (
          <div className="px-3 py-4 space-y-4">
            <p className="text-xs font-semibold text-foreground">Mensagens Agendadas</p>

            {scheduledMessages.length > 0 ? (
              <div className="space-y-2">
                {scheduledMessages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{msg.content}</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                        {new Date(msg.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => handleCancelScheduled(msg.id)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0 mt-0.5" title="Cancelar">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Clock size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Nenhuma mensagem agendada</p>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nova mensagem agendada</p>
              <textarea className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3} placeholder="Texto da mensagem..." value={newSchedContent} onChange={(e) => setNewSchedContent(e.target.value)} />
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Data e hora</Label>
                <input type="datetime-local" className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                  value={newSchedAt} onChange={(e) => setNewSchedAt(e.target.value)} />
              </div>
              <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={handleAddScheduled} disabled={savingScheduled || !newSchedContent.trim() || !newSchedAt}>
                <Clock size={12} />{savingScheduled ? 'Agendando...' : 'Agendar mensagem'}
              </Button>
            </div>
          </div>
        )}

        {/* ── ANOTAÇÕES ─────────────────────────────────────── */}
        {activeSection === 'anotacoes' && (
          <div className="px-3 py-4 space-y-4">
            <p className="text-xs font-semibold text-foreground">Anotações</p>

            {annotations.length > 0 ? (
              <div className="space-y-2">
                {annotations.map((ann: any) => (
                  <div key={ann.id} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">{ann.author?.name ?? 'Agente'}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(ann.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{ann.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <StickyNote size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Nenhuma anotação ainda</p>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nova anotação</p>
              <textarea className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3} placeholder="Escrever anotação..." value={newAnnotation} onChange={(e) => setNewAnnotation(e.target.value)} />
              <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={handleAddAnnotation} disabled={savingAnnotation || !newAnnotation.trim()}>
                <Plus size={12} />{savingAnnotation ? 'Salvando...' : 'Salvar anotação'}
              </Button>
            </div>
          </div>
        )}

        {/* ── HISTÓRICO ─────────────────────────────────────── */}
        {activeSection === 'historico' && (
          <div className="px-3 py-4">
            <p className="text-xs font-semibold text-foreground mb-3">Linha do tempo</p>

            {/* Conversation list */}
            {contactConversations.length > 0 && (
              <div className="mb-4 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MessageSquare size={10} />Conversas
                </p>
                {contactConversations.map((conv) => {
                  const statusColors: Record<string, string> = {
                    new: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    resolved: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                    closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  };
                  const statusLabels: Record<string, string> = { new: 'Aberta', open: 'Em Atend.', pending: 'Aguardando', resolved: 'Resolvida', closed: 'Fechada' };
                  const dateStr = new Date(conv.last_message_at ?? conv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                  return (
                    <div key={conv.id} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${conv.id === conversation.id ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/40'}`}>
                      <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[conv.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {conv.id === conversation.id ? '● Atual' : (statusLabels[conv.status] ?? conv.status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Events timeline */}
            {convEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <History size={28} className="mb-2 opacity-30" />
                <p className="text-xs">Nenhum evento registrado</p>
              </div>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3">
                  {convEvents.map((ev: any) => {
                    const date = new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    const statusLabel: Record<string, string> = { new: 'Aberto', open: 'Em Atendimento', pending: 'Aguardando', resolved: 'Resolvido', closed: 'Fechado' };
                    const statusColor: Record<string, string> = { new: 'text-green-600', open: 'text-blue-600', pending: 'text-amber-600', resolved: 'text-purple-600', closed: 'text-red-700' };

                    if (ev._kind === 'annotation') return (
                      <div key={ev.id} className="relative">
                        <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-background" />
                        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <StickyNote size={10} className="text-amber-600" />
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">{ev.author?.name ?? 'Agente'}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground">{date}</span>
                          </div>
                          <p className="text-[11px] text-foreground leading-relaxed">{ev.body}</p>
                        </div>
                      </div>
                    );

                    if (ev.event_type === 'status_change') return (
                      <div key={ev.id} className="relative flex items-start gap-2">
                        <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[10px] font-semibold ${statusColor[ev.payload?.from] ?? 'text-muted-foreground'}`}>{statusLabel[ev.payload?.from] ?? ev.payload?.from}</span>
                            <ArrowRight size={9} className="text-muted-foreground shrink-0" />
                            <span className={`text-[10px] font-semibold ${statusColor[ev.payload?.to] ?? 'text-muted-foreground'}`}>{statusLabel[ev.payload?.to] ?? ev.payload?.to}</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground">{ev.actor?.name ?? 'Sistema'} · {date}</p>
                        </div>
                      </div>
                    );

                    if (ev.event_type === 'agent_assigned') return (
                      <div key={ev.id} className="relative flex items-start gap-2">
                        <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-blue-400 border-2 border-background" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <User size={9} className="text-blue-500" />
                            <span className="text-[10px] text-foreground">Agente atribuído</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground">{date}</p>
                        </div>
                      </div>
                    );

                    return (
                      <div key={ev.id} className="relative flex items-start gap-2">
                        <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-muted border-2 border-background" />
                        <div className="flex-1">
                          <span className="text-[10px] text-muted-foreground">{ev.event_type}</span>
                          <p className="text-[9px] text-muted-foreground">{date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Delete contact dialog */}
      <Dialog open={deleteContactOpen} onOpenChange={setDeleteContactOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle size={16} />Excluir contato</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-foreground font-medium">{contact.name}</p>
            <p className="text-xs text-muted-foreground">Esta ação é <strong>permanente</strong> e não pode ser desfeita.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContactOpen(false)} disabled={deletingContact}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={deletingContact}>{deletingContact ? 'Excluindo...' : 'Excluir permanentemente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Fechar Conversa</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Motivo</Label>
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{closeReasons.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCloseConversation} disabled={closing}>Fechar conversa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
