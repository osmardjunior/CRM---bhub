import { useState, useRef, useEffect } from 'react';
import { normalizeWhatsAppNumber } from '@/utils/whatsapp';
import {
  X, Phone, Mail, Plus, Calendar, Info, GitBranch,
  Star, Archive, Bot, UserPlus, History, User,
  StickyNote, Pencil, AlertTriangle, Smartphone,
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
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useUserProjects } from '@/hooks/useUserProjects';
import { updateContact, deleteContact } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { useTags } from '@/hooks/useTags';
import { useContactTags, useAddContactTag, useRemoveContactTag } from '@/hooks/useContactTags';
import { useFunnels } from '@/contexts/FunnelContext';
import { useContactFunnelsByContact, useAddContactToStage, useRemoveContactFromStage } from '@/hooks/useContactFunnelStages';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { ConversationDetail } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { usePermissions } from '@/hooks/usePermissions';
import ContactHistorySection from '@/components/inbox/contact-sections/ContactHistorySection';
import ContactAnnotationsSection from '@/components/inbox/contact-sections/ContactAnnotationsSection';

interface Props {
  conversation: ConversationDetail;
  onClose: () => void;
}

type ActiveSection = 'perfil' | 'tags' | 'funil' | 'agendadas' | 'anotacoes' | 'historico';

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
  const { projectId: globalProjectId } = useProjectContext();

  const isAllProjects = globalProjectId === '';
  const effectiveProjectId: string | null = isAllProjects
    ? null
    : (globalProjectId
      || conversation.integration?.project_id
      || conversation.project_id
      || null);

  const { data: allTags = [] } = useTags();
  const { funnels: allFunnels } = useFunnels();

  const availableTags = isAllProjects
    ? allTags
    : effectiveProjectId
      ? allTags.filter(t => !t.project_id || t.project_id === effectiveProjectId)
      : allTags.filter(t => !t.project_id);
  const { data: contactTags = [] } = useContactTags(contact.id);
  const addTag = useAddContactTag();
  const removeTag = useRemoveContactTag();

  const funnels = isAllProjects
    ? allFunnels
    : effectiveProjectId
      ? allFunnels.filter(f => !f.project_id || f.project_id === effectiveProjectId)
      : allFunnels.filter(f => !f.project_id);

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

  const [deleteContactOpen, setDeleteContactOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(contact.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [newSchedContent, setNewSchedContent] = useState('');
  const [newSchedAt, setNewSchedAt] = useState('');
  const [savingScheduled, setSavingScheduled] = useState(false);

  const { data: allTeamMembers = [] } = useTeamProfiles();
  const { data: projectMembers = [] } = useUserProjects(effectiveProjectId ?? '');
  const permissions = usePermissions();
  const projectFilteredMembers = effectiveProjectId
    ? allTeamMembers.filter(m => projectMembers.some(pm => pm.user_id === m.id))
    : [];
  const teamMembersBase = projectFilteredMembers.length > 1 ? projectFilteredMembers : allTeamMembers;

  // For agents: filter to same department as conversation
  const { data: myDeptIds = [] } = useQuery({
    queryKey: ['my-departments', user?.id],
    enabled: !!user?.id && !permissions.isSupervisorOrAbove,
    queryFn: async () => {
      const { data } = await supabase.from('profile_departments').select('department_id').eq('profile_id', user!.id);
      return (data ?? []).map(r => r.department_id);
    },
  });

  const { data: deptMemberIds = [] } = useQuery({
    queryKey: ['dept-members', myDeptIds],
    enabled: myDeptIds.length > 0 && !permissions.isSupervisorOrAbove,
    queryFn: async () => {
      const { data } = await supabase.from('profile_departments').select('profile_id').in('department_id', myDeptIds);
      return [...new Set((data ?? []).map(r => r.profile_id))];
    },
  });

  // Agents see only same-department colleagues; supervisors/admins see all
  const teamMembers = permissions.isSupervisorOrAbove
    ? teamMembersBase
    : deptMemberIds.length > 0
      ? teamMembersBase.filter(m => deptMemberIds.includes(m.id) && m.id !== user?.id)
      : teamMembersBase;

  // Agents can only delegate conversations assigned to them
  const canDelegate = permissions.isSupervisorOrAbove || conversation.assigned_user_id === user?.id;

  const [delegatePopoverOpen, setDelegatePopoverOpen] = useState(false);

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(contact.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNameInput(contact.name); }, [contact.name]);
  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === contact.name) { setEditingName(false); return; }
    try {
      await updateContact(contact.id, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      toast.success('Nome atualizado');
    } catch { toast.error('Erro ao atualizar nome'); }
    setEditingName(false);
  };

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (!trimmed || trimmed === contact.phone) { setEditingPhone(false); return; }
    let normalized: string;
    try { normalized = normalizeWhatsAppNumber(trimmed); }
    catch (err: unknown) { toast.error('Telefone inválido: ' + (err instanceof Error ? err.message : 'Formato inválido')); return; }
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
      const { error, count } = await supabase.from('conversations').update({ assigned_user_id: userId }, { count: 'exact' }).eq('id', conversation.id);
      if (error) throw error;
      if (count === 0) {
        toast.error('Falha ao delegar — nenhuma conversa foi atualizada');
        return;
      }
      // Audit log
      if (user?.id && companyId) {
        supabase.from('delegation_logs').insert({
          conversation_id: conversation.id,
          from_user_id: user.id,
          to_user_id: userId,
          company_id: companyId,
        }).then(({ error: logErr }) => { if (logErr) console.warn('delegation log failed:', logErr); });
      }
      toast.success('Conversa delegada!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      queryClient.invalidateQueries({ queryKey: ['leads-report'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-status-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
      setDelegatePopoverOpen(false);
    } catch { toast.error('Erro ao delegar conversa'); }
  };

  const isArchived = !!(conversation as any).archived_at;
  const handleToggleArchive = async () => {
    try {
      const newValue = isArchived ? null : new Date().toISOString();
      await supabase.from('conversations').update({ archived_at: newValue }).eq('id', conversation.id);
      toast.success(isArchived ? 'Conversa desarquivada' : 'Conversa arquivada');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch { toast.error('Erro ao arquivar conversa'); }
  };

  const handleToggleFavorite = async () => {
    try {
      await updateContact(contact.id, { is_favorite: !contact.is_favorite });
      toast.success(contact.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
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
    <div className="flex w-full md:w-72 md:min-w-[272px] flex-col border-l border-border bg-card h-full">
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

        {/* PERFIL */}
        {activeSection === 'perfil' && (
          <>
            {/* Contact card */}
            <div className="flex flex-col items-center pt-5 pb-4 px-4 border-b border-border">
              <div className="mb-3">
                <ConversationAvatar name={contact.name} avatarUrl={contactAvatarUrl} isGroup={isGroupChat(contact.phone)} size="lg" />
              </div>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="text-sm font-bold text-foreground text-center bg-transparent border-b border-primary outline-none w-full px-2 py-0.5"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  onBlur={handleSaveName}
                />
              ) : (
                <h3
                  className="text-sm font-bold text-foreground text-center cursor-pointer hover:text-primary transition-colors group flex items-center gap-1 justify-center"
                  onClick={() => setEditingName(true)}
                  title="Clique para editar o nome"
                >
                  {contact.name}
                  <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                </h3>
              )}
              {contact.phone && <p className="text-xs text-primary font-medium mt-0.5">{contact.phone}</p>}
            </div>

            {/* Aparelho Origem — ABOVE quick actions for visibility */}
            {(conversation.integration || conversation.integration_id) && (
              <div className="px-3 py-3 border-b border-border">
                <div className="flex items-start gap-2.5">
                  <Smartphone size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Aparelho Origem</p>
                    {conversation.integration ? (
                      <>
                        <p className="text-xs font-medium text-foreground truncate">
                          {conversation.integration.device_name}
                          {conversation.integration.phone_number && (
                            <span className="text-muted-foreground ml-1">({conversation.integration.phone_number})</span>
                          )}
                        </p>
                        <span className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium ${
                          conversation.integration.status === 'connected' ? 'text-green-500' :
                          conversation.integration.status === 'banned' ? 'text-red-500' :
                          conversation.integration.status === 'restricted' ? 'text-amber-500' :
                          'text-muted-foreground'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            conversation.integration.status === 'connected' ? 'bg-green-500' :
                            conversation.integration.status === 'banned' ? 'bg-red-500' :
                            conversation.integration.status === 'restricted' ? 'bg-amber-500' :
                            'bg-gray-400'
                          }`} />
                          {conversation.integration.status === 'connected' ? 'Conectado' :
                           conversation.integration.status === 'banned' ? 'Banido' :
                           conversation.integration.status === 'restricted' ? 'Restringido' :
                           'Desconectado'}
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-muted-foreground italic truncate">Número removido</p>
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-red-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          Integração excluída
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="px-3 py-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações rápidas</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Popover open={delegatePopoverOpen} onOpenChange={setDelegatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs justify-start" disabled={!canDelegate} title={!canDelegate ? 'Você só pode delegar conversas atribuídas a você' : undefined}><UserPlus size={12} />Delegar</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="start">
                    <p className="text-xs font-semibold mb-2">Delegar para</p>
                    <div className="max-h-48 overflow-y-auto overscroll-contain space-y-0.5">
                      {teamMembers.length > 0 ? teamMembers.map((m) => (
                        <button key={m.id} onClick={() => handleDelegate(m.id)} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left">
                          <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">{m.name[0]}</AvatarFallback></Avatar>
                          {m.name}
                        </button>
                      )) : (
                        <p className="text-xs text-muted-foreground italic px-2 py-1">Nenhum colega neste projeto</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs justify-start ${contact.is_favorite ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' : ''}`} onClick={handleToggleFavorite}>
                  <Star size={12} className={contact.is_favorite ? 'fill-amber-500' : ''} />
                  {contact.is_favorite ? 'Favorito' : 'Favoritar'}
                </Button>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs justify-start ${isArchived ? 'bg-muted text-muted-foreground' : ''}`} onClick={handleToggleArchive}>
                  <Archive size={12} />{isArchived ? 'Desarquivar' : 'Arquivar'}
                </Button>
                <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs justify-start ${(contact.chatbot_enabled ?? true) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : ''}`} onClick={handleToggleChatbot}>
                  <Bot size={12} />{(contact.chatbot_enabled ?? true) ? 'Bot On' : 'Bot Off'}
                </Button>
              </div>
            </div>

            {/* Tags inline */}
            <div className="px-3 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tags</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors">
                      <Plus size={10} /> Adicionar
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <p className="text-xs font-semibold mb-2">Gerenciar tags</p>
                    <div className="max-h-[40vh] overflow-y-auto overscroll-contain space-y-0.5">
                      {availableTags.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors">
                          <Checkbox
                            checked={contactTagIds.includes(t.id)}
                            onCheckedChange={() => handleToggleTag(t.id)}
                            disabled={addTag.isPending || removeTag.isPending}
                          />
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-xs">{t.name}</span>
                        </label>
                      ))}
                      {availableTags.length === 0 && (
                        <p className="text-xs text-muted-foreground italic px-2 py-1">Nenhuma tag cadastrada</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {contactTags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {contactTags.map((ct) => (
                    <span
                      key={ct.tag_id}
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ borderColor: ct.tag_color + '80', color: ct.tag_color, backgroundColor: ct.tag_color + '18' }}
                      onClick={() => removeTag.mutate({ contactId: contact.id, tagId: ct.tag_id })}
                      title="Clique para remover"
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ct.tag_color }} />
                      {ct.tag_name}
                      <X size={8} className="shrink-0" />
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">Nenhuma tag adicionada</p>
              )}
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

        {/* TAGS */}
        {activeSection === 'tags' && (
          <div className="px-3 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Tags do contato</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"><Plus size={11} />Adicionar</Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <p className="text-xs font-semibold mb-2">Gerenciar tags</p>
                  <div className="max-h-[50vh] overflow-y-auto overscroll-contain space-y-1">
                    {availableTags.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors">
                        <Checkbox checked={contactTagIds.includes(t.id)} onCheckedChange={() => handleToggleTag(t.id)} disabled={addTag.isPending || removeTag.isPending} />
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-xs">{t.name}</span>
                      </label>
                    ))}
                    {availableTags.length === 0 && <p className="text-xs text-muted-foreground italic px-2 py-1">Nenhuma tag cadastrada</p>}
                  </div>
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

        {/* FUNIL */}
        {activeSection === 'funil' && (
          <div className="px-3 py-4 space-y-4">
            <p className="text-xs font-semibold text-foreground">Funil de Vendas</p>

            {contactFunnelEntries.length > 0 ? (
              <div className="space-y-3">
                {contactFunnelEntries.map((entry) => {
                  const funnel = funnels.find((f) => f.id === entry.funnel_id);
                  const currentStage = funnel?.stages.find((s) => s.id === entry.stage_id);
                  const isMoving = addContactToStage.isPending || removeContactFromStage.isPending;
                  return (
                    <div key={entry.id} className="bg-secondary/60 rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{funnel?.name ?? 'Funil'}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{currentStage?.label ?? 'Etapa'}</p>
                        </div>
                        <button onClick={() => removeContactFromStage.mutate(entry.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded shrink-0" title="Remover do funil">
                          <X size={12} />
                        </button>
                      </div>
                      {funnel && funnel.stages.length > 0 && (
                        <div className="px-3 pb-3 pt-1 border-t border-border/40">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Mover para:</p>
                          <div className="flex flex-col gap-1">
                            {funnel.stages.map((s) => {
                              const isCurrent = s.id === entry.stage_id;
                              return (
                                <button
                                  key={s.id}
                                  disabled={isCurrent || isMoving}
                                  onClick={async () => {
                                    await removeContactFromStage.mutateAsync(entry.id);
                                    addContactToStage.mutate({ contactId: contact.id, funnelId: funnel.id, stageId: s.id });
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                                    isCurrent
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'bg-background border border-border hover:bg-accent hover:border-primary/30 text-foreground'
                                  } ${isMoving && !isCurrent ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full shrink-0 ${isCurrent ? 'bg-primary-foreground' : 'bg-muted-foreground/40'}`} />
                                    {s.label}
                                    {isCurrent && <span className="ml-auto text-[9px] opacity-80">Atual</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
                <>
                  <div className="flex flex-col gap-1">
                    {selectedFunnel.stages.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStageId(s.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                          selectedStageId === s.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-background border border-border hover:bg-accent hover:border-primary/30 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${selectedStageId === s.id ? 'bg-primary-foreground' : 'bg-muted-foreground/40'}`} />
                          {s.label}
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedStageId && (
                    <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={handleAddToFunnel} disabled={addContactToStage.isPending}>
                      <Plus size={12} />Adicionar ao Funil
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* AGENDADAS */}
        {activeSection === 'agendadas' && (
          <div className="px-3 py-4 space-y-4">
            <p className="text-xs font-semibold text-foreground">Mensagens Agendadas</p>

            {scheduledMessages.length > 0 ? (
              <div className="space-y-2">
                {scheduledMessages.map((msg: Record<string, unknown>) => (
                  <div key={msg.id as string} className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{msg.content as string}</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                        {new Date(msg.scheduled_at as string).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => handleCancelScheduled(msg.id as string)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0 mt-0.5" title="Cancelar">
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

        {/* ANOTAÇÕES */}
        {activeSection === 'anotacoes' && (
          <ContactAnnotationsSection
            conversationId={conversation.id}
            companyId={companyId}
            userId={user?.id}
          />
        )}

        {/* HISTÓRICO */}
        {activeSection === 'historico' && (
          <ContactHistorySection
            conversationId={conversation.id}
            contactId={contact.id}
            currentConversationId={conversation.id}
          />
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

    </div>
  );
}
