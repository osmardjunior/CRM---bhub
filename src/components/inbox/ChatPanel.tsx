import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  Smile,
  ChevronDown,
  ChevronLeft,
  Users,
  Lock,
  StickyNote,
  X,
  Loader2,
  Sparkles,
  MoreVertical,
  RefreshCw,
  BellOff,
  Bot,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import MessageBubble from '@/components/inbox/MessageBubble';
import ConversationAvatar from '@/components/inbox/ConversationAvatar';
import AudioRecorder from '@/components/inbox/AudioRecorder';
import { useSendMessage } from '@/hooks/useConversations';
import { useTeamMembers } from '@/hooks/useContacts';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { isGroupChat, createAnnotation, sendViaWhatsApp } from '@/services/api';

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { ConversationDetail, Annotation, MessageWithSender } from '@/services/api';
import { listAnnotations } from '@/services/api';

type MergedItem =
  | (MessageWithSender & { _type: 'message' })
  | (Annotation & { _type: 'annotation' });
import AIChatAssistDrawer from '@/components/ai/AIChatAssistDrawer';
import AIAnnotationHelper from '@/components/ai/AIAnnotationHelper';
import { useChatStore } from '@/store/chatStore';

function groupMessagesByDate(items: MergedItem[]) {
  const groups: { date: string; messages: MergedItem[] }[] = [];
  let current: { date: string; messages: MergedItem[] } | null = null;

  for (const msg of items) {
    const d = new Date(msg.created_at);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (!current || current.date !== label) {
      current = { date: label, messages: [] };
      groups.push(current);
    }
    current.messages.push(msg);
  }
  return groups;
}

interface Props {
  conversation: ConversationDetail | null;
  loading: boolean;
  onToggleProfile: () => void;
  profileOpen: boolean;
  onBack?: () => void;
}

export default function ChatPanel({ conversation, loading, onToggleProfile, profileOpen, onBack }: Props) {
  const [input, setInput] = useState('');
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessage();
  const { data: teamMembers } = useTeamMembers();
  const { data: quickReplies = [] } = useQuickReplies();
  const permissions = usePermissions();
  const { user, companyId } = useAuth();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const { setAIDrawerOpen } = useChatStore();

  const canReassign = permissions.canReassignConversations;
  const reassignTooltip = getPermissionTooltip('canReassignConversations', permissions);

  const availableMembers = canReassign
    ? (teamMembers ?? [])
    : (teamMembers ?? []).filter((m) => m.id === user?.id);

  // Fetch annotations for current conversation
  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations', conversation?.id],
    enabled: !!conversation?.id,
    queryFn: () => listAnnotations(conversation!.id),
  });

  // Merge messages and annotations by created_at — memoized to avoid re-sorting on every render
  const messages = useMemo(() => conversation?.messages ?? [], [conversation?.messages]);
  const mergedItems = useMemo(
    () =>
      [
        ...messages.map((m) => ({ ...m, _type: 'message' as const })),
        ...annotations.map((a) => ({ ...a, _type: 'annotation' as const })),
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages, annotations],
  );
  const grouped = useMemo(() => groupMessagesByDate(mergedItems), [mergedItems]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mergedItems.length]);

  const handleSend = async () => {
    if (!input.trim() || !conversation) return;
    if (isAnnotationMode) {
      try {
        await createAnnotation(conversation.id, input.trim());
        setInput('');
        queryClient.invalidateQueries({ queryKey: ['annotations', conversation.id] });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar anotação');
      }
    } else {
      sendMessage.mutate({ conversationId: conversation.id, body: input.trim() });
      setInput('');
    }
  };

  const handleQuickReply = (text: string) => {
    setInput(text);
    setQuickReplyOpen(false);
    setQuickReplyFilter('');
  };

  // Slash command detection
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith('/') && value.length > 1) {
      setQuickReplyFilter(value.slice(1).toLowerCase());
      setQuickReplyOpen(true);
    } else if (quickReplyOpen && !value.startsWith('/')) {
      setQuickReplyOpen(false);
      setQuickReplyFilter('');
    }
  };

  const filteredQuickReplies = quickReplyFilter
    ? quickReplies.filter(
        (qr) =>
          qr.shortcut.toLowerCase().includes(quickReplyFilter) ||
          qr.message.toLowerCase().includes(quickReplyFilter),
      )
    : quickReplies;

  // File upload
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !conversation || !companyId || !user) return;
    const file = files[0];
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${companyId}/${conversation.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-media')
        .upload(path, file);
      if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      const mediaUrl = urlData.publicUrl;

      const body = file.type.startsWith('image/') ? '📷 Imagem' : file.type.startsWith('audio/') ? '🎵 Áudio' : `📎 ${file.name}`;

      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        company_id: companyId,
        sender_type: 'agent',
        sender_id: user.id,
        body,
        media_url: mediaUrl,
      });
      if (msgErr) throw new Error(`Falha ao salvar mensagem: ${msgErr.message}`);

      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

      // Send via WhatsApp — check delivery and show feedback
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const whatsappRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ conversation_id: conversation.id, body, media_url: mediaUrl }),
          });
          const whatsappData = await whatsappRes.json().catch(() => ({})) as { delivered?: boolean; error?: string; reason?: string };
          if (!whatsappData.delivered) {
            toast.warning('Arquivo salvo, mas não foi possível encaminhar via WhatsApp: ' + (whatsappData.error ?? whatsappData.reason ?? 'integração não encontrada'));
          }
        }
      } catch {
        // WhatsApp send failure is non-fatal — file was already saved
      }

      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Arquivo enviado!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [conversation, companyId, user, queryClient]);

  // Audio send
  const handleAudioSend = useCallback(async (blob: Blob) => {
    if (!conversation || !companyId || !user) {
      toast.error('Sessão inválida. Recarregue a página e tente novamente.');
      return;
    }
    if (blob.size === 0) {
      toast.error('Gravação vazia. Tente gravar novamente.');
      return;
    }
    setUploading(true);
    try {
      const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
      const contentType = blob.type || 'audio/webm';
      const path = `${companyId}/${conversation.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from('chat-media').upload(path, blob, { contentType });
      if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      const mediaUrl = urlData.publicUrl;

      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        company_id: companyId,
        sender_type: 'agent',
        sender_id: user.id,
        body: '🎤 Áudio',
        media_url: mediaUrl,
      });
      if (msgErr) throw new Error(`Falha ao salvar mensagem: ${msgErr.message}`);

      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

      // WhatsApp send — check delivery and show feedback
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const whatsappRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ conversation_id: conversation.id, body: '🎤 Áudio', media_url: mediaUrl }),
          });
          const whatsappData = await whatsappRes.json().catch(() => ({})) as { delivered?: boolean; error?: string; reason?: string };
          if (!whatsappData.delivered) {
            toast.warning('Áudio salvo, mas não foi possível encaminhar via WhatsApp: ' + (whatsappData.error ?? whatsappData.reason ?? 'integração não encontrada'));
          }
        } else {
          toast.warning('Áudio salvo, mas sessão expirada para envio via WhatsApp');
        }
      } catch {
        toast.warning('Áudio salvo, mas falha ao encaminhar via WhatsApp');
      }

      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Áudio enviado!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar áudio');
    } finally {
      setUploading(false);
    }
  }, [conversation, companyId, user, queryClient]);

  const handleChangeStatus = async (newStatus: 'open' | 'pending' | 'closed') => {
    if (!conversation) return;
    if (newStatus === 'closed') {
      setClosing(true);
      try {
        const { error } = await supabase
          .from('conversations')
          .update({ status: 'closed', close_reason: 'resolvido' })
          .eq('id', conversation.id);
        if (error) throw error;
        toast.success('Conversa fechada!');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao fechar conversa');
      } finally {
        setClosing(false);
      }
    } else {
      try {
        const { error } = await supabase
          .from('conversations')
          .update({ status: newStatus, close_reason: null })
          .eq('id', conversation.id);
        if (error) throw error;
        toast.success(newStatus === 'open' ? 'Em Atendimento!' : 'Aguardando!');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao alterar status');
      }
    }
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
    queryClient.invalidateQueries({ queryKey: ['conversation'] });
    // Deselect so the conversation leaves the current tab view
    if (onBack) onBack();
  };

  const handleAssignAgent = async (userId: string) => {
    if (!conversation) return;
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: userId })
        .eq('id', conversation.id);
      if (error) throw error;
      toast.success('Agente atribuído!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atribuir agente');
    }
  };

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <ListSkeleton rows={1} />
        </div>
        <div className="flex-1 p-4">
          <ListSkeleton rows={5} />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-secondary/20">
        <EmptyState
          icon={MessageSquare}
          title="Selecione uma conversa"
          description="Escolha uma conversa da lista para começar."
        />
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    open: 'Em Atendimento',
    pending: 'Aguardando',
    closed: 'Fechado',
  };

  const contactAvatarUrl = (conversation.contact as { avatar_url?: string | null }).avatar_url;
  const isGroup = isGroupChat(conversation.contact.phone);

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" onClick={onBack}>
            <ChevronLeft size={18} />
          </Button>
        )}
        <ConversationAvatar
          name={conversation.contact.name}
          avatarUrl={contactAvatarUrl}
          isGroup={isGroup}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{conversation.contact.name}</span>
            {isGroup && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                Grupo
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isGroup ? 'Conversa em grupo' : conversation.contact.phone}
          </p>
        </div>

        {/* Status dropdown */}
        {conversation.status !== 'closed' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className={`h-8 gap-1.5 text-xs font-semibold rounded-full px-3 ${
                  conversation.status === 'open'
                    ? 'bg-success hover:bg-success/90 text-success-foreground'
                    : 'bg-warning hover:bg-warning/90 text-warning-foreground'
                }`}
              >
                {statusLabel[conversation.status]}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {conversation.status !== 'open' && (
                <DropdownMenuItem className="text-xs" onClick={() => handleChangeStatus('open')}>
                  Em Atendimento
                </DropdownMenuItem>
              )}
              {conversation.status !== 'pending' && (
                <DropdownMenuItem className="text-xs" onClick={() => handleChangeStatus('pending')}>
                  Aguardando
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive text-xs"
                onClick={() => handleChangeStatus('closed')}
                disabled={closing}
              >
                Fechar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <StatusBadge status={conversation.status} />
        )}

        {/* Assign dropdown */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={conversation.assigned_user_id ?? ''}
                disabled={!canReassign && conversation.assigned_user_id === user?.id}
                onValueChange={handleAssignAgent}
              >
                <SelectTrigger className={`h-8 w-[140px] text-xs ${!canReassign ? 'opacity-60' : ''}`}>
                  <SelectValue placeholder="Atribuir agente" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          {reassignTooltip && (
            <TooltipContent side="bottom">
              <p className="text-xs">{reassignTooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-primary" onClick={() => setAIDrawerOpen(true)}>
              <Sparkles size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p className="text-xs">Assistente IA</p></TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onToggleProfile}>
          {profileOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </Button>

        {/* Mais Opções */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="text-xs gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })}>
              <RefreshCw size={13} /> Recarregar mensagens
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onClick={() => setIsAnnotationMode(true)}>
              <StickyNote size={13} /> Escrever uma anotação
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onClick={() => setAIDrawerOpen(true)}>
              <Bot size={13} /> Executar Diálogo / Chatbot
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2 text-muted-foreground" onClick={async () => {
              await supabase.from('conversations').update({ last_message_at: new Date(0).toISOString() }).eq('id', conversation.id);
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
            }}>
              <BellOff size={13} /> Marcar como não lido
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI Chat Assist Drawer */}
      <AIChatAssistDrawer conversation={conversation} />

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          background: 'hsl(var(--secondary) / 0.5)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {mergedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={32} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Envie a primeira mensagem para iniciar a conversa.</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[11px] text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50 shadow-sm">
                  {group.date}
                </span>
              </div>
              {group.messages.map((item, idx) => {
                if (item._type === 'annotation') {
                  return (
                    <div key={item.id} className="flex justify-center my-2">
                      <div className="max-w-[80%] rounded-xl px-3.5 py-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Lock size={10} className="text-amber-600 dark:text-amber-400" />
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            {item.author?.name ?? 'Agente'} · Anotação interna
                          </span>
                        </div>
                        <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{item.body}</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 text-right mt-0.5">
                          {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                }
                // Determine if we should show sender header (first msg or different sender from previous)
                const prevItem = idx > 0 ? group.messages[idx - 1] : null;
                const currentSender = item.sender_name ?? item.sender?.name ?? '';
                const prevSender = prevItem && prevItem._type === 'message'
                  ? (prevItem.sender_name ?? prevItem.sender?.name ?? '')
                  : null;
                const showSenderHeader = !prevSender || prevSender !== currentSender || prevItem?._type === 'annotation';

                return (
                  <MessageBubble
                    key={item.id}
                    msg={item}
                    isOutgoing={item.sender_type === 'agent'}
                    contactName={conversation.contact.name}
                    contactAvatarUrl={contactAvatarUrl}
                    isGroup={isGroup}
                    showSenderHeader={showSenderHeader}
                  />
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload indicator */}
      {uploading && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 border-t border-border">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span className="text-xs text-primary font-medium">Enviando arquivo...</span>
        </div>
      )}

      {/* Composer */}
      <div className={`border-t border-border bg-card p-2.5 ${isAnnotationMode ? 'bg-amber-50 dark:bg-amber-950/30 border-t-amber-300 dark:border-t-amber-700' : ''}`}>
        {/* Annotation mode indicator */}
        {isAnnotationMode && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <Lock size={12} className="text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Modo anotação interna — não será enviada ao contato</span>
            <button onClick={() => setIsAnnotationMode(false)} className="ml-auto">
              <X size={12} className="text-amber-600 hover:text-amber-800" />
            </button>
          </div>
        )}

        {/* Quick reply popover (slash command) */}
        {quickReplyOpen && filteredQuickReplies.length > 0 && (
          <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
            {filteredQuickReplies.map((qr) => (
              <button
                key={qr.id}
                onClick={() => handleQuickReply(qr.message)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 border-b border-border/50 last:border-0"
              >
                <span className="text-xs font-mono text-primary font-semibold">/{qr.shortcut}</span>
                <span className="text-muted-foreground truncate">{qr.message}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip size={17} />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isAnnotationMode ? 'default' : 'ghost'}
                  size="icon"
                  className={`h-8 w-8 ${isAnnotationMode ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setIsAnnotationMode(!isAnnotationMode)}
                >
                  <StickyNote size={17} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{isAnnotationMode ? 'Voltar para mensagem' : 'Anotação interna'}</p>
              </TooltipContent>
            </Tooltip>
            {isAnnotationMode && conversation && (
              <AIAnnotationHelper conversation={conversation} onInsert={(text) => setInput(text)} />
            )}
            {/* Emoji picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Smile size={17} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start" side="top">
                <div className="grid grid-cols-8 gap-0.5">
                  {['😀','😂','🥰','😍','🤩','😎','🥳','😊','👍','👏','🙌','🤝','❤️','🔥','⭐','✅','🎉','🎊','💪','🙏','😅','😭','😡','😱','🤔','💡','📢','📌','📅','📋','💰','💳','🛒','🏆','🎯','✨','🌟','💫','📱','💻','📧','📞','🕐','⏰','🗓️','📊','📈','📉','🔒','🔓','⚠️','✔️','❌','➕','➖','➡️','⬅️','🔄','💬','📩','📤','📥'].map((emoji) => (
                    <button
                      key={emoji}
                      className="h-8 w-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                      onClick={() => setInput((prev) => prev + emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={quickReplyOpen && !input.startsWith('/')} onOpenChange={(open) => { setQuickReplyOpen(open); if (!open) setQuickReplyFilter(''); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Zap size={17} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">Respostas Rápidas</p>
                  <p className="text-[10px] text-muted-foreground">Ou digite / no campo de mensagem</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {quickReplies.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">
                      Nenhuma resposta rápida cadastrada.<br />Crie na página Respostas Rápidas.
                    </p>
                  ) : (
                    quickReplies.map((qr) => (
                      <button
                        key={qr.id}
                        onClick={() => handleQuickReply(qr.message)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                      >
                        <span className="text-xs font-mono text-primary font-semibold">/{qr.shortcut}</span>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{qr.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Textarea
            placeholder={isAnnotationMode ? 'Escreva uma anotação interna...' : 'Digite uma mensagem...'}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            className={`flex-1 min-h-[38px] max-h-[120px] resize-none border-0 text-sm py-2 leading-relaxed ${isAnnotationMode ? 'bg-amber-100/50 dark:bg-amber-900/20' : 'bg-secondary'}`}
            rows={1}
          />

          <div className="flex items-center gap-0.5">
            {!input.trim() && !isAnnotationMode ? (
              <AudioRecorder onSend={handleAudioSend} />
            ) : null}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className={`h-8 w-8 rounded-full shrink-0 ${isAnnotationMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
            >
              <Send size={15} />
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
    </div>
  );
}
