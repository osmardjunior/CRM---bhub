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
  Clock,
  CalendarIcon,
  Reply,
  BellRing,
  Smartphone,
  ArrowLeftRight,
  AlertTriangle,
  Pencil,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle,
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
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import MessageBubble from '@/components/inbox/MessageBubble';
import ConversationAvatar from '@/components/inbox/ConversationAvatar';
import AudioRecorder from '@/components/inbox/AudioRecorder';
import { useSendMessage } from '@/hooks/useConversations';
import { useTypingIndicator } from '@/hooks/useInboxRealtime';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useUserProjects } from '@/hooks/useUserProjects';
import { useMyProjects } from '@/hooks/useProjects';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useProjectContext } from '@/contexts/ProjectContext';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { isGroupChat, createAnnotation, sendViaWhatsApp, deleteMessage, markConversationUnread, closeConversation } from '@/services/api';

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { ConversationDetail, Annotation, MessageWithSender } from '@/services/api';
import { listAnnotations, updateAnnotation, deleteAnnotation } from '@/services/api';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type MergedItem =
  | (MessageWithSender & { _type: 'message' })
  | (Annotation & { _type: 'annotation' });
import AIChatAssistDrawer from '@/components/ai/AIChatAssistDrawer';
import AIAnnotationHelper from '@/components/ai/AIAnnotationHelper';
import { useChatStore } from '@/store/chatStore';
import ScheduleMessageButton from '@/components/inbox/ScheduleMessageButton';

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
  onBack?: (opts?: { skipAutoSelect?: boolean }) => void;
  listCollapsed?: boolean;
  onToggleList?: () => void;
}

export default function ChatPanel({ conversation, loading, onToggleProfile, profileOpen, onBack, listCollapsed, onToggleList }: Props) {
  const [input, setInput] = useState('');
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplySelectedIdx, setQuickReplySelectedIdx] = useState(0);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{
    file?: File;
    url?: string;
    mimeType: string;
    fileName: string;
    previewUrl?: string;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageWithSender | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<{ id: string; body: string } | null>(null);
  const isContactTyping = useTypingIndicator(conversation?.id ?? null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage();
  const { data: allTeamMembers = [] } = useTeamProfiles();
  const { data: quickReplies = [] } = useQuickReplies();
  const permissions = usePermissions();
  const { user, companyId, role } = useAuth();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [changeNumberOpen, setChangeNumberOpen] = useState(false);

  // Scheduled messages for this conversation
  const { data: scheduledMsgs = [] } = useQuery({
    queryKey: ['scheduled-messages-banner', conversation?.id],
    enabled: !!conversation?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('id, content, scheduled_at')
        .eq('conversation_id', conversation!.id)
        .is('sent_at', null)
        .is('cancelled_at', null)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { setAIDrawerOpen } = useChatStore();

  // Auto-focus input when switching conversations
  useEffect(() => {
    if (conversation?.id) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [conversation?.id]);

  // Clear pending media and upload state when switching conversations
  useEffect(() => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
    setUploading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // Reset textarea height when input is cleared (after sending)
  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input]);

  const { projectId } = useProjectContext();
  const { data: myProjects = [] } = useMyProjects();
  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of myProjects) map[p.id] = p.name;
    return map;
  }, [myProjects]);
  const showProjectBadge = !projectId;

  // Use conversation's project_id for filtering delegation candidates
  const convProjectId = conversation?.project_id ?? projectId;
  const { data: projectMembers = [] } = useUserProjects(convProjectId || '');
  // If conversation has a project, prefer members from that project
  // But always show all team members as fallback so delegation is never blocked
  const projectFilteredMembers = convProjectId
    ? allTeamMembers.filter(m => projectMembers.some(pm => pm.user_id === m.id))
    : [];
  const teamMembers = projectFilteredMembers.length > 1 ? projectFilteredMembers : allTeamMembers;
  const { data: allIntegrations } = useIntegrations(projectId || undefined);
  const whatsappIntegrations = allIntegrations?.filter(i => i.channel === 'whatsapp') ?? [];

  const handleChangeIntegration = async (integrationId: string) => {
    if (!conversation) return;
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ integration_id: integrationId })
        .eq('id', conversation.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      setChangeNumberOpen(false);
      toast.success('Número alterado com sucesso');
    } catch {
      toast.error('Erro ao trocar número');
    }
  };

  // Everyone can delegate — as long as there are other members to delegate to
  const canReassign = teamMembers.length > 1;
  const reassignTooltip = !canReassign ? 'Nenhum colega disponível para delegar' : undefined;

  const availableMembers = teamMembers;

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
      ].sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (diff !== 0) return diff;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      }),
    [messages, annotations],
  );
  const grouped = useMemo(() => groupMessagesByDate(mergedItems), [mergedItems]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mergedItems.length]);

  const handleEditMessage = (msg: MessageWithSender) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setInput(msg.body ?? '');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSendEdit = async (newBody: string) => {
    if (!editingMessage?.id || !conversation) return;
    try {
      // Optimistic update
      queryClient.setQueryData<ConversationDetail>(['conversation', conversation.id], (old) => {
        if (!old) return old;
        return { ...old, messages: old.messages.map((m) => m.id === editingMessage.id ? { ...m, body: newBody, edited_at: new Date().toISOString() } : m) };
      });
      // DB update
      await supabase.from('messages').update({ body: newBody, edited_at: new Date().toISOString() }).eq('id', editingMessage.id);
      // Evolution edit (best-effort) — fetch external_message_id from DB if not in cache
      let extId = editingMessage.external_message_id;
      if (!extId) {
        const { data: dbMsg } = await supabase.from('messages').select('external_message_id').eq('id', editingMessage.id).maybeSingle();
        extId = dbMsg?.external_message_id ?? null;
      }
      // Send edit to WhatsApp via Evolution API
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          const editRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ conversation_id: conversation.id, message_id: editingMessage.id, external_message_id: extId, new_body: newBody }),
          });
          const editData = await editRes.json();
          if (!editData.ok) {
            toast.warning(`Mensagem editada no CRM, mas não no WhatsApp: ${editData.error}`);
          }
        } catch {
          toast.warning('Mensagem editada no CRM, mas falha ao comunicar com WhatsApp.');
        }
      }
    } catch {
      toast.error('Erro ao editar mensagem');
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    }
    setEditingMessage(null);
    setInput('');
  };

  const handleSend = async () => {
    if (!conversation) return;

    // Sending media with optional caption
    if (pendingMedia) {
      if (uploading) return;
      setUploading(true);
      try {
        let mediaUrl = pendingMedia.url;
        // If it's a local file, upload first
        if (pendingMedia.file && companyId) {
          const ext = pendingMedia.fileName.split('.').pop() ?? 'bin';
          const path = `${companyId}/${conversation.id}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('chat-media').upload(path, pendingMedia.file);
          if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);
          const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
          mediaUrl = urlData.publicUrl;
        }
        if (!mediaUrl) throw new Error('URL da mídia não disponível');
        const caption = input.trim() || pendingMedia.fileName.replace(/^\d+_/, '');
        await sendMediaMessage(mediaUrl, caption);
        toast.success('Arquivo enviado!');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
      } finally {
        if (pendingMedia.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
        setPendingMedia(null);
        setInput('');
        setUploading(false);
      }
      return;
    }

    if (!input.trim()) return;
    if (editingMessage) {
      await handleSendEdit(input.trim());
      return;
    }
    if (isAnnotationMode) {
      try {
        await createAnnotation(conversation.id, input.trim());
        setInput('');
        queryClient.invalidateQueries({ queryKey: ['annotations', conversation.id] });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar anotação');
      }
    } else {
      const body = input.trim();
      setInput('');
      // 0.5s delay before sending — humanized behavior
      await new Promise((resolve) => setTimeout(resolve, 500));
      sendMessage.mutate({ conversationId: conversation.id, body, replyToId: replyingTo?.id });
      setReplyingTo(null);
      // Auto-change status from "Aberto" to "Em Atendimento" on first agent message
      if (conversation.status === 'new') {
        supabase.from('conversations').update({ status: 'open' }).eq('id', conversation.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
          queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
        });
      }
    }
  };

  const handleQuickReply = (text: string, mediaUrl?: string | null, mediaFileName?: string | null) => {
    setQuickReplyOpen(false);
    setQuickReplyFilter('');
    setQuickReplySelectedIdx(0);
    setInput(text);
    // If quick reply has a media attachment, set as pending preview
    if (mediaUrl && mediaFileName) {
      const mimeType = mediaFileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/jpeg'
        : mediaFileName.match(/\.(mp4|mov|avi|webm)$/i) ? 'video/mp4'
        : mediaFileName.match(/\.(mp3|ogg|wav|aac)$/i) ? 'audio/mpeg'
        : 'application/octet-stream';
      if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia({ url: mediaUrl, mimeType, fileName: mediaFileName });
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Slash command detection — opens on "/" alone (shows all) or "/text" (filters)
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith('/')) {
      setQuickReplyFilter(value.length > 1 ? value.slice(1).toLowerCase() : '');
      setQuickReplyOpen(true);
      setQuickReplySelectedIdx(0);
    } else if (quickReplyOpen) {
      setQuickReplyOpen(false);
      setQuickReplyFilter('');
      setQuickReplySelectedIdx(0);
    }
  };

  const filteredQuickReplies = quickReplyFilter
    ? quickReplies.filter(
        (qr) =>
          qr.shortcut.toLowerCase().includes(quickReplyFilter) ||
          qr.message.toLowerCase().includes(quickReplyFilter),
      )
    : quickReplies;

  // File upload — prepare preview instead of sending immediately
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0 || !conversation) return;
    const file = files[0];
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    // Revoke previous preview URL if any
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    const previewUrl = file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : undefined;
    setPendingMedia({ file, mimeType: file.type, fileName: file.name, previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [conversation, pendingMedia?.previewUrl]);

  // Actually send media (file or url) with caption
  const sendMediaMessage = useCallback(async (mediaUrl: string, body: string) => {
    if (!conversation || !companyId || !user) return;
    const { data: insertedMsg, error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      company_id: companyId,
      sender_type: 'agent',
      sender_id: user.id,
      body,
      media_url: mediaUrl,
    }).select('id').single();
    if (msgErr) throw new Error(`Falha ao salvar mensagem: ${msgErr.message}`);

    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

    // Send via WhatsApp (pass message_id so external_message_id is saved for edit/delete)
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
          body: JSON.stringify({ conversation_id: conversation.id, body, media_url: mediaUrl, message_id: insertedMsg.id }),
        });
        const whatsappData = await whatsappRes.json().catch(() => ({})) as { delivered?: boolean; error?: string; reason?: string };
        if (!whatsappData.delivered) {
          toast.warning('Arquivo salvo, mas não encaminhado via WhatsApp: ' + (whatsappData.error ?? whatsappData.reason ?? 'integração não encontrada'));
        }
      }
    } catch {
      // WhatsApp send is non-fatal
    }

    queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });

    // Auto-change status from "Aberto" to "Em Atendimento"
    if (conversation.status === 'new') {
      supabase.from('conversations').update({ status: 'open' }).eq('id', conversation.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
        queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
      });
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

      const { data: insertedAudioMsg, error: msgErr } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        company_id: companyId,
        sender_type: 'agent',
        sender_id: user.id,
        body: '🎤 Áudio',
        media_url: mediaUrl,
      }).select('id').single();
      if (msgErr) throw new Error(`Falha ao salvar mensagem: ${msgErr.message}`);

      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

      // WhatsApp send (pass message_id so external_message_id is saved for edit/delete)
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
            body: JSON.stringify({ conversation_id: conversation.id, body: '🎤 Áudio', media_url: mediaUrl, message_id: insertedAudioMsg.id }),
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

  const handleChangeStatus = async (newStatus: 'new' | 'open' | 'pending' | 'resolved' | 'closed') => {
    if (!conversation) return;
    const isClosing = newStatus === 'resolved' || newStatus === 'closed';
    if (isClosing) setClosing(true);
    const closeReason = newStatus === 'resolved' ? 'resolvido' : newStatus === 'closed' ? 'fechado' : null;
    const statusMessages: Record<string, string> = {
      new: 'Conversa reaberta!',
      open: 'Em Atendimento!',
      pending: 'Aguardando!',
      resolved: 'Conversa resolvida!',
      closed: 'Conversa fechada!',
    };
    try {
      const { data: updated, error } = await supabase
        .from('conversations')
        .update({ status: newStatus, close_reason: closeReason })
        .eq('id', conversation.id)
        .select('id')
        .single();
      if (error) throw error;
      if (!updated) throw new Error('Nenhuma conversa atualizada — possível problema de permissão');
      toast.success(statusMessages[newStatus]);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leads-report'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status');
    } finally {
      if (isClosing) setClosing(false);
    }
  };

  const handleAssignAgent = async (userId: string) => {
    if (!conversation) return;
    try {
      const { data: updated, error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: userId })
        .eq('id', conversation.id)
        .select('id')
        .single();
      if (error) throw error;
      if (!updated) throw new Error('Falha ao atribuir agente — possível problema de permissão');
      toast.success('Agente atribuído!');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['conversation'] });
      queryClient.invalidateQueries({ queryKey: ['leads-report'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-status-counts'] });
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
    new: 'Aberto',
    open: 'Em Atendimento',
    pending: 'Aguardando',
    resolved: 'Resolvido',
    closed: 'Fechado',
  };

  const statusButtonClass: Record<string, string> = {
    new: 'bg-green-600 hover:bg-green-700 text-white',
    open: 'bg-blue-600 hover:bg-blue-700 text-white',
    pending: 'bg-amber-500 hover:bg-amber-600 text-white',
    resolved: 'bg-purple-600 hover:bg-purple-700 text-white',
    closed: 'bg-red-700 hover:bg-red-800 text-white',
  };

  const contact = conversation.contact ?? { name: 'Sem contato', phone: null, phone_e164: null, email: null, wa_identifier_raw: null, avatar_url: null, tags: null, is_group: false, source: null, id: '', responsible_user_id: null, created_at: '' };
  const contactAvatarUrl = (contact as { avatar_url?: string | null }).avatar_url;
  const isGroup = isGroupChat(contact.phone);
  // Contatos LID: chegaram com ID de dispositivo WhatsApp (@lid), sem número de telefone
  const isLidContact = !!contact.wa_identifier_raw && !contact.phone;

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-card overflow-hidden">
        {onBack && (
          <Button variant="ghost" size="icon" className="md:hidden h-7 w-7 shrink-0" onClick={onBack}>
            <ChevronLeft size={16} />
          </Button>
        )}
        {onToggleList && (
          <Button variant="ghost" size="icon" className="hidden md:flex h-7 w-7 shrink-0" onClick={onToggleList} title={listCollapsed ? 'Mostrar conversas' : 'Ocultar conversas'}>
            {listCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </Button>
        )}
        <ConversationAvatar
          name={contact.name}
          avatarUrl={contactAvatarUrl}
          isGroup={isGroup}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
            {isGroup && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground shrink-0">
                Grupo
              </span>
            )}
            {showProjectBadge && conversation.project_id && projectMap[conversation.project_id] && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                {projectMap[conversation.project_id]}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {isContactTyping ? (
              <span className="text-green-500 dark:text-green-400 font-medium animate-pulse">digitando...</span>
            ) : isGroup ? 'Conversa em grupo' : contact.phone}
          </p>
        </div>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className={`h-7 gap-1 text-[11px] font-semibold rounded-full px-2.5 shrink-0 ${statusButtonClass[conversation.status] ?? statusButtonClass.closed}`}
            >
              {statusLabel[conversation.status] ?? conversation.status}
              <ChevronDown size={11} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
              {conversation.status !== 'new' && (
                <DropdownMenuItem className="text-xs flex flex-col items-start gap-0.5" onClick={() => handleChangeStatus('new')}>
                  <span className="font-semibold text-green-600 dark:text-green-400">Aberto</span>
                  <span className="text-muted-foreground text-[10px]">Uma nova conversa ou reiniciada.</span>
                </DropdownMenuItem>
              )}
              {conversation.status !== 'open' && (
                <DropdownMenuItem className="text-xs flex flex-col items-start gap-0.5" onClick={() => handleChangeStatus('open')}>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Em Atendimento</span>
                  <span className="text-muted-foreground text-[10px]">Cliente está sendo atendido.</span>
                </DropdownMenuItem>
              )}
              {conversation.status !== 'pending' && (
                <DropdownMenuItem className="text-xs flex flex-col items-start gap-0.5" onClick={() => handleChangeStatus('pending')}>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Aguardando</span>
                  <span className="text-muted-foreground text-[10px]">Aguardando uma ação sua ou do cliente.</span>
                </DropdownMenuItem>
              )}
              {conversation.status !== 'resolved' && (
                <DropdownMenuItem className="text-xs flex flex-col items-start gap-0.5" onClick={() => handleChangeStatus('resolved')} disabled={closing}>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">Resolvido</span>
                  <span className="text-muted-foreground text-[10px]">Cliente foi atendido e foi resolvido.</span>
                </DropdownMenuItem>
              )}
              {conversation.status !== 'closed' && (
                <DropdownMenuItem className="text-xs flex flex-col items-start gap-0.5" onClick={() => handleChangeStatus('closed')} disabled={closing}>
                  <span className="font-semibold text-red-700 dark:text-red-400">Fechado</span>
                  <span className="text-muted-foreground text-[10px]">Cliente foi atendido sem conclusão.</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

        {/* Assign dropdown */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden sm:block">
              <Select
                value={conversation.assigned_user_id ?? ''}
                disabled={!canReassign}
                onValueChange={handleAssignAgent}
              >
                <SelectTrigger className={`h-7 w-[120px] text-[11px] ${!canReassign ? 'opacity-60' : ''}`}>
                  <SelectValue placeholder="Atribuir" />
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

        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onToggleProfile}>
          {profileOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
        </Button>

        {/* Mais Opções */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7">
              <MoreVertical size={15} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Assign agent — visible only on small screens where inline select is hidden */}
            <div className="lg:hidden px-2 py-1.5 border-b border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Responsável</p>
              <Select
                value={conversation.assigned_user_id ?? ''}
                disabled={!canReassign}
                onValueChange={handleAssignAgent}
              >
                <SelectTrigger className="h-7 text-xs w-full">
                  <SelectValue placeholder="Atribuir agente" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DropdownMenuItem className="text-xs gap-2" onClick={() => setAIDrawerOpen(true)}>
              <Sparkles size={13} /> Assistente IA
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })}>
              <RefreshCw size={13} /> Recarregar mensagens
            </DropdownMenuItem>
            {permissions.can('chats_add_note') && (
              <DropdownMenuItem className="text-xs gap-2" onClick={() => setIsAnnotationMode(true)}>
                <StickyNote size={13} /> Escrever uma anotação
              </DropdownMenuItem>
            )}
            {permissions.can('chatbot_execute') && (
              <DropdownMenuItem className="text-xs gap-2" onClick={() => setAIDrawerOpen(true)}>
                <Bot size={13} /> Executar Diálogo / Chatbot
              </DropdownMenuItem>
            )}
            {/* Trocar número de envio */}
            {whatsappIntegrations.length > 1 && (
              <div className="px-2 py-1.5 border-b border-border">
                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                  <Smartphone size={10} /> Enviar por:
                </p>
                {whatsappIntegrations.map((integ) => (
                  <button
                    key={integ.id}
                    onClick={() => handleChangeIntegration(integ.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                      conversation.integration_id === integ.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${integ.status === 'connected' ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className="truncate">{integ.device_name || integ.phone_number || 'Número'}</span>
                    {integ.phone_number && integ.device_name && (
                      <span className="text-[10px] text-muted-foreground truncate">{integ.phone_number}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <DropdownMenuItem className="text-xs gap-2" onClick={() => {
              const url = `${window.location.origin}/inbox?id=${conversation.id}`;
              navigator.clipboard.writeText(url);
              toast.success('Link da conversa copiado!');
            }}>
              <Copy size={13} /> Copiar link da conversa
            </DropdownMenuItem>
            {conversation.status !== 'closed' && (
              <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive" onClick={async () => {
                try {
                  await closeConversation(conversation.id, 'resolvido');
                  toast.success('Conversa fechada!');
                  queryClient.invalidateQueries({ queryKey: ['conversations'] });
                  queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
                  queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
                  queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
                } catch { toast.error('Erro ao fechar conversa'); }
              }}>
                <CheckCircle size={13} /> Fechar conversa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-xs gap-2 text-muted-foreground" onClick={async () => {
              try {
                const convId = conversation.id;
                // 1. Deselect FIRST so realtime won't re-mark as read
                if (onBack) onBack({ skipAutoSelect: true });
                // 2. Wait a tick for React to propagate selectedId=null to the realtime ref
                await new Promise(r => setTimeout(r, 50));
                // 3. Now safely delete the conversation_reads record
                await markConversationUnread(convId);
                // 4. Force unread badge to show (overwrite any stale optimistic state)
                queryClient.setQueriesData<Record<string, number>>(
                  { queryKey: ['unread-counts'] },
                  (old) => old ? { ...old, [convId]: 1 } : old,
                );
                // 5. Refresh lists and sidebar
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
                queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
                queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
                // 6. Re-apply unread badge after sidebar refresh (prevents race with refetch)
                setTimeout(() => {
                  queryClient.setQueriesData<Record<string, number>>(
                    { queryKey: ['unread-counts'] },
                    (old) => old ? { ...old, [convId]: Math.max(old[convId] ?? 0, 1) } : old,
                  );
                }, 500);
                toast.success('Conversa marcada como não lida');
              } catch {
                toast.error('Erro ao marcar como não lido');
              }
            }}>
              <BellRing size={13} /> Marcar como não lida
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI Chat Assist Drawer */}
      <AIChatAssistDrawer conversation={conversation} />

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 chat-messages-bg"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
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
                  const isEditingThis = editingAnnotation?.id === item.id;
                  return (
                    <div key={item.id} className="flex justify-center my-2 group/ann">
                      <div className="max-w-[80%] rounded-xl px-3.5 py-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 shadow-sm relative">
                        {/* Action buttons */}
                        <div className="absolute -top-1 -right-1 opacity-0 group-hover/ann:opacity-100 transition-opacity flex gap-0.5 z-10">
                          <button
                            className="p-1 rounded-full bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                            title="Editar"
                            onClick={() => setEditingAnnotation({ id: item.id, body: item.body })}
                          >
                            <Pencil size={10} className="text-amber-700 dark:text-amber-300" />
                          </button>
                          <button
                            className="p-1 rounded-full bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                            title="Excluir"
                            onClick={async () => {
                              try {
                                await deleteAnnotation(item.id);
                                queryClient.invalidateQueries({ queryKey: ['annotations', conversation.id] });
                                toast.success('Anotação excluída');
                              } catch {
                                toast.error('Erro ao excluir anotação');
                              }
                            }}
                          >
                            <X size={10} className="text-red-700 dark:text-red-300" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Lock size={10} className="text-amber-600 dark:text-amber-400" />
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            {item.author?.name ?? 'Agente'} · Anotação interna
                          </span>
                        </div>
                        {isEditingThis ? (
                          <div className="flex flex-col gap-1.5">
                            <textarea
                              className="text-sm bg-white dark:bg-amber-950/50 border border-amber-400 dark:border-amber-600 rounded px-2 py-1 text-amber-900 dark:text-amber-100 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                              rows={2}
                              value={editingAnnotation.body}
                              onChange={(e) => setEditingAnnotation({ ...editingAnnotation, body: e.target.value })}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setEditingAnnotation(null);
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const newBody = editingAnnotation.body.trim();
                                  if (newBody) {
                                    updateAnnotation(item.id, newBody)
                                      .then(() => {
                                        queryClient.invalidateQueries({ queryKey: ['annotations', conversation.id] });
                                        toast.success('Anotação atualizada');
                                      })
                                      .catch(() => toast.error('Erro ao editar anotação'));
                                  }
                                  setEditingAnnotation(null);
                                }
                              }}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-300"
                                onClick={() => setEditingAnnotation(null)}
                              >
                                Cancelar
                              </button>
                              <button
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600"
                                onClick={async () => {
                                  const newBody = editingAnnotation.body.trim();
                                  if (newBody) {
                                    try {
                                      await updateAnnotation(item.id, newBody);
                                      queryClient.invalidateQueries({ queryKey: ['annotations', conversation.id] });
                                      toast.success('Anotação atualizada');
                                    } catch {
                                      toast.error('Erro ao editar anotação');
                                    }
                                  }
                                  setEditingAnnotation(null);
                                }}
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{item.body}</p>
                        )}
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
                    msg={{ ...item, deleted_by_name: item.deleted_at ? (item.sender_name ?? item.sender?.name ?? null) : null }}
                    isOutgoing={item.sender_type === 'agent' || item.sender_type === 'system'}
                    contactName={contact.name}
                    contactAvatarUrl={contactAvatarUrl}
                    isGroup={isGroup}
                    showSenderHeader={showSenderHeader}
                    isAdminView={permissions.isSupervisorOrAbove}
                    onReply={(m) => { setReplyingTo(m as MessageWithSender); setTimeout(() => inputRef.current?.focus(), 50); }}
                    onEdit={(m) => handleEditMessage(m as MessageWithSender)}
                    onScrollToMessage={(msgId) => {
                      const el = document.querySelector(`[data-message-id="${msgId}"]`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('ring-2', 'ring-primary', 'rounded-2xl');
                        setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'rounded-2xl'), 2000);
                      }
                    }}
                    onDelete={async (msgId) => {
                      try {
                        // Optimistic delete
                        queryClient.setQueryData<ConversationDetail>(['conversation', conversation.id], (old) => {
                          if (!old) return old;
                          return { ...old, messages: old.messages.map((m) => m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m) };
                        });
                        await deleteMessage(msgId, user?.id);
                        // Delete on WhatsApp via Evolution API
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.access_token) {
                          try {
                            const delRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
                              body: JSON.stringify({ conversation_id: conversation.id, message_id: msgId }),
                            });
                            const delData = await delRes.json();
                            if (!delData.ok) {
                              toast.warning(`Mensagem apagada no CRM, mas não no WhatsApp: ${delData.error}`);
                            }
                          } catch {
                            toast.warning('Mensagem apagada no CRM, mas falha ao comunicar com WhatsApp.');
                          }
                        }
                      } catch {
                        toast.error('Erro ao apagar mensagem');
                        queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
                      }
                    }}
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

      {/* Edit preview bar */}
      {editingMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-300 dark:border-blue-700">
          <Pencil size={13} className="text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Editando mensagem</p>
            <p className="text-[10px] text-muted-foreground truncate">{editingMessage.body}</p>
          </div>
          <button onClick={() => { setEditingMessage(null); setInput(''); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Reply preview bar */}
      {replyingTo && !isAnnotationMode && !editingMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/60 border-t border-border">
          <Reply size={13} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">
              {replyingTo.sender_type === 'agent' ? 'Você' : (replyingTo.sender_name ?? replyingTo.sender?.name ?? contact.name)}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{replyingTo.body ?? '📎 Mídia'}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Media preview bar */}
      {pendingMedia && (
        <div className="flex items-center gap-3 px-3 py-2 bg-secondary/60 border-t border-border">
          {pendingMedia.mimeType.startsWith('image/') && pendingMedia.previewUrl ? (
            <img src={pendingMedia.previewUrl} alt="Preview" className="h-14 w-14 rounded-md object-cover shrink-0" />
          ) : pendingMedia.mimeType.startsWith('image/') && pendingMedia.url ? (
            <img src={pendingMedia.url} alt="Preview" className="h-14 w-14 rounded-md object-cover shrink-0" />
          ) : pendingMedia.mimeType.startsWith('video/') && pendingMedia.previewUrl ? (
            <video src={pendingMedia.previewUrl} className="h-14 w-14 rounded-md object-cover shrink-0" muted />
          ) : (
            <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Paperclip size={20} className="text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{pendingMedia.fileName.replace(/^\d+_/, '')}</p>
            <p className="text-[10px] text-muted-foreground">
              {pendingMedia.file ? `${(pendingMedia.file.size / 1024 / 1024).toFixed(1)} MB` : 'Biblioteca de mídia'}
              {' — '}Digite uma legenda ou envie direto
            </p>
          </div>
          <button
            onClick={() => {
              if (pendingMedia.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
              setPendingMedia(null);
            }}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <X size={16} />
          </button>
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

        {/* Banner LID: contato sem número de telefone (ID de dispositivo WhatsApp) */}
        {isLidContact && !isAnnotationMode && (
          <div className="flex items-start gap-2 mb-2 px-2 py-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                Contato identificado por ID do WhatsApp (LID) — sem número de telefone
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                Para responder, adicione o número de telefone ao contato.
              </p>
            </div>
            <button
              onClick={onToggleProfile}
              className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline shrink-0 whitespace-nowrap"
            >
              Adicionar número
            </button>
          </div>
        )}

        {/* Banner: número desconectado/restringido/banido */}
        {conversation.integration && conversation.integration.status !== 'connected' && !isAnnotationMode && (
          <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md border ${
            conversation.integration.status === 'banned'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
              : conversation.integration.status === 'restricted'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
          }`}>
            <Smartphone size={13} className={`shrink-0 ${
              conversation.integration.status === 'banned' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            }`} />
            <p className={`text-[11px] flex-1 ${
              conversation.integration.status === 'banned' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
            }`}>
              Número <span className="font-semibold">{conversation.integration.device_name}{conversation.integration.phone_number ? ` (${conversation.integration.phone_number})` : ''}</span>
              {' '}{conversation.integration.status === 'banned' ? 'banido' : conversation.integration.status === 'restricted' ? 'restringido' : 'desconectado'}
              {' '}— mensagens podem ser enviadas por outro número
            </p>
          </div>
        )}

        {/* Banner: mensagens agendadas */}
        {scheduledMsgs.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
            <Clock size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 flex-1 truncate">
              Mensagem agendada para{' '}
              <span className="font-semibold font-mono">
                {format(new Date(scheduledMsgs[0].scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              {scheduledMsgs.length > 1 && (
                <span className="ml-1 text-blue-500 dark:text-blue-400">+{scheduledMsgs.length - 1} mais</span>
              )}
            </p>
            <button
              onClick={async () => {
                if (!confirm('Cancelar esta mensagem agendada?')) return;
                await supabase.from('scheduled_messages').update({ cancelled_at: new Date().toISOString() }).eq('id', scheduledMsgs[0].id);
                queryClient.invalidateQueries({ queryKey: ['scheduled-messages-banner', conversation.id] });
                queryClient.invalidateQueries({ queryKey: ['scheduled-messages-panel', conversation.id] });
              }}
              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Quick reply popover (slash command) */}
        {quickReplyOpen && (
          <div className="mb-2 rounded-lg border border-border bg-popover shadow-md">
            {filteredQuickReplies.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                Nenhuma resposta encontrada
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto">
                {filteredQuickReplies.map((qr, idx) => (
                  <button
                    key={qr.id}
                    onClick={() => handleQuickReply(qr.message, qr.media_url, qr.media_file_name)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 border-b border-border/50 last:border-0 ${
                      idx === quickReplySelectedIdx ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <span className="text-xs font-mono text-primary font-semibold shrink-0">/{qr.shortcut}</span>
                    <span className="text-muted-foreground truncate text-xs">{qr.message}</span>
                    {qr.media_file_name && <Paperclip size={10} className="shrink-0 text-primary/60" />}
                  </button>
                ))}
              </div>
            )}
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
              <PopoverContent className="w-80 p-0" align="start" side="top">
                <ScrollArea className="h-72">
                  {([
                    { label: 'Mais usados', emojis: ['😀','😂','🥰','😍','😎','😊','👍','👏','❤️','🔥','✅','🎉','💪','🙏','🤝','✨'] },
                    { label: 'Rostos', emojis: ['😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥱','😤','😡','🤬','😈','👿','💀','☠️','💩','🤡','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'] },
                    { label: 'Gestos', emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💅','🤳','💪'] },
                    { label: 'Corações', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','😍','🥰','😘','💋','💌'] },
                    { label: 'Mãos e Pessoas', emojis: ['🧑','👩','👨','🧑‍💼','👩‍💼','👨‍💼','🧑‍💻','👩‍💻','👨‍💻','🙋','🙋‍♀️','🙋‍♂️','💁','💁‍♀️','💁‍♂️','🙅','🙅‍♀️','🙅‍♂️','🙆','🤦','🤦‍♀️','🤦‍♂️','🤷','🤷‍♀️','🤷‍♂️','🧏','💆','💇','🚶','🏃','💃','🕺','🧑‍🤝‍🧑','👫','👬','👭'] },
                    { label: 'Natureza', emojis: ['🌸','🌺','🌻','🌹','🌷','🌼','🪻','💐','🍀','🌿','🌱','🌵','🌴','🌳','🍃','🍂','🍁','🌾','🌊','🔥','⭐','🌟','💫','✨','☀️','🌤️','⛅','🌈','🌙','⚡','❄️','🌪️'] },
                    { label: 'Comida', emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍑','🥭','🍍','🥥','🍔','🍕','🌮','🌯','🥗','🍜','🍝','🍣','🍱','🍰','🎂','🍩','🍪','🍫','☕','🍵','🥤','🍺','🍷','🥂','🍾'] },
                    { label: 'Atividades', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🏒','🥊','🎯','🏆','🥇','🥈','🥉','🎮','🎲','🎪','🎨','🎬','🎤','🎧','🎵','🎶','🎹','🥁','🎸','🎺','🎻'] },
                    { label: 'Viagem', emojis: ['🚗','🚕','🏎️','🚌','🚎','🚐','🛻','🚚','✈️','🚀','🛸','🚁','🛶','⛵','🚢','🏠','🏡','🏢','🏥','🏦','🏪','🏫','🏛️','⛪','🕌','🌍','🌎','🌏','🗺️','🧭'] },
                    { label: 'Objetos', emojis: ['📱','💻','⌨️','🖥️','🖨️','📷','📹','🎥','📞','☎️','📟','📠','📺','📻','🔊','🔔','📢','📣','💡','🔦','🕯️','📖','📚','✏️','🖊️','📝','📋','📌','📎','🔗','✂️','📐','📏','🔒','🔓','🔑','🗝️'] },
                    { label: 'Símbolos', emojis: ['✅','❌','✔️','❎','➕','➖','➡️','⬅️','⬆️','⬇️','↩️','↪️','🔄','🔃','⚠️','🚫','⛔','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','💠','🔘','🏳️','🏴','🚩','🏁'] },
                    { label: 'Negócios', emojis: ['💰','💵','💴','💶','💷','💳','💎','⚖️','🧰','🔧','🔨','⚙️','🧲','📊','📈','📉','📃','📄','📑','🗂️','📁','📂','🗄️','🗃️','📦','📮','📧','📩','📤','📥','✉️','💼','🏷️','🔖'] },
                  ] as const).map((cat) => (
                    <div key={cat.label} className="px-2 pt-2 pb-1">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 sticky top-0 bg-popover py-0.5">{cat.label}</p>
                      <div className="grid grid-cols-8 gap-0.5">
                        {cat.emojis.map((emoji, i) => (
                          <button
                            key={`${cat.label}-${i}`}
                            className="h-8 w-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                            onClick={() => setInput((prev) => prev + emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
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
                        onClick={() => handleQuickReply(qr.message, qr.media_url, qr.media_file_name)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-primary font-semibold">/{qr.shortcut}</span>
                          {qr.media_file_name && <Paperclip size={10} className="text-primary/60" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{qr.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Textarea
            ref={inputRef}
            placeholder={isAnnotationMode ? 'Escreva uma anotação interna...' : pendingMedia ? 'Digite uma legenda para o arquivo...' : 'Digite uma mensagem...'}
            value={input}
            onChange={(e) => {
              handleInputChange(e.target.value);
              // Auto-expand textarea height
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                  e.preventDefault();
                  const file = items[i].getAsFile();
                  if (file) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    handleFileSelect(dt.files);
                  }
                  return;
                }
              }
            }}
            onKeyDown={(e) => {
              if (quickReplyOpen && filteredQuickReplies.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setQuickReplySelectedIdx((prev) => (prev + 1) % filteredQuickReplies.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setQuickReplySelectedIdx((prev) => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const selectedQr = filteredQuickReplies[quickReplySelectedIdx];
                  handleQuickReply(selectedQr.message, selectedQr.media_url, selectedQr.media_file_name);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setQuickReplyOpen(false);
                  setQuickReplyFilter('');
                  setQuickReplySelectedIdx(0);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            className={`flex-1 min-h-[38px] max-h-[120px] resize-none border-0 text-sm py-2 leading-relaxed ${isAnnotationMode ? 'bg-amber-100/50 dark:bg-amber-900/20' : 'bg-secondary'}`}
            rows={1}
          />

          <div className="flex items-center gap-0.5">
            {!input.trim() && !isAnnotationMode && !pendingMedia ? (
              <AudioRecorder onSend={handleAudioSend} />
            ) : null}
            {/* Schedule message button */}
            {input.trim() && !isAnnotationMode && permissions.can('messages_schedule') && (
              <ScheduleMessageButton
                conversationId={conversation.id}
                companyId={companyId}
                userId={user?.id}
                messageBody={input.trim()}
                onScheduled={() => setInput('')}
              />
            )}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!input.trim() && !pendingMedia) || uploading || (isLidContact && !isAnnotationMode)}
              className={`h-8 w-8 rounded-full shrink-0 ${isAnnotationMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
