import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  Smile,
  Mic,
  ChevronDown,
  Users,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import MessageBubble from '@/components/inbox/MessageBubble';
import { useSendMessage } from '@/hooks/useConversations';
import { useTeamMembers } from '@/hooks/useContacts';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { isGroupChat } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { ConversationDetail } from '@/services/api';

const quickReplies = [
  'Olá! Como posso ajudar você hoje?',
  'Agradecemos o seu contato! Vou verificar e retorno em instantes.',
  'Pode me informar o número do seu pedido, por favor?',
  'Estou transferindo você para o setor responsável.',
  'Seu problema foi resolvido? Posso ajudar em mais alguma coisa?',
  'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
  'Obrigado pela preferência! Tenha um ótimo dia! 😊',
];

function groupMessagesByDate(messages: any[]) {
  const groups: { date: string; messages: any[] }[] = [];
  let current: { date: string; messages: any[] } | null = null;

  for (const msg of messages) {
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
}

export default function ChatPanel({ conversation, loading, onToggleProfile, profileOpen }: Props) {
  const [input, setInput] = useState('');
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessage = useSendMessage();
  const { data: teamMembers } = useTeamMembers();
  const permissions = usePermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);

  const canReassign = permissions.canReassignConversations;
  const reassignTooltip = getPermissionTooltip('canReassignConversations', permissions);

  const availableMembers = canReassign
    ? (teamMembers ?? [])
    : (teamMembers ?? []).filter((m) => m.id === user?.id);

  const messages = conversation?.messages ?? [];
  const grouped = groupMessagesByDate(messages);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || !conversation) return;
    sendMessage.mutate({ conversationId: conversation.id, body: input.trim() });
    setInput('');
  };

  const handleQuickReply = (text: string) => {
    setInput(text);
    setQuickReplyOpen(false);
  };

  const handleChangeStatus = async (newStatus: 'open' | 'pending' | 'closed') => {
    if (!conversation) return;
    if (newStatus === 'closed') {
      setClosing(true);
      try {
        const { error } = await supabase
          .from('conversations')
          .update({ status: 'closed' as any, close_reason: 'resolvido' } as any)
          .eq('id', conversation.id);
        if (error) throw error;
        toast.success('Conversa fechada!');
      } catch (err: any) {
        toast.error(err.message ?? 'Erro ao fechar conversa');
      } finally {
        setClosing(false);
      }
    } else {
      try {
        const { error } = await supabase
          .from('conversations')
          .update({ status: newStatus as any, close_reason: null } as any)
          .eq('id', conversation.id);
        if (error) throw error;
        toast.success(newStatus === 'open' ? 'Em Atendimento!' : 'Aguardando!');
      } catch (err: any) {
        toast.error(err.message ?? 'Erro ao alterar status');
      }
    }
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['conversation'] });
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
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao atribuir agente');
    }
  };

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

  const contactAvatarUrl = (conversation.contact as any).avatar_url;

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 bg-card">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={contactAvatarUrl ?? undefined} />
          <AvatarFallback className={`text-sm font-semibold ${isGroupChat(conversation.contact.phone) ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
            {isGroupChat(conversation.contact.phone) ? <Users size={16} /> : conversation.contact.name[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{conversation.contact.name}</span>
            {isGroupChat(conversation.contact.phone) && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                Grupo
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{conversation.contact.phone}</p>
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

        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onToggleProfile}>
          {profileOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </Button>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        style={{
          background: 'hsl(var(--secondary) / 0.5)',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {messages.length === 0 ? (
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
              {group.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOutgoing={msg.sender_type === 'agent'}
                  contactName={conversation.contact.name}
                  contactAvatarUrl={contactAvatarUrl}
                />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-2.5">
        <div className="flex items-end gap-1.5">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Paperclip size={17} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Smile size={17} />
            </Button>
            <Dialog open={quickReplyOpen} onOpenChange={setQuickReplyOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Zap size={17} />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Respostas Rápidas</DialogTitle>
                </DialogHeader>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {quickReplies.map((qr, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickReply(qr)}
                      className="w-full text-left rounded-lg px-3 py-2.5 text-sm hover:bg-accent transition-colors border border-border"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Textarea
            placeholder="Digite uma mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            className="flex-1 min-h-[38px] max-h-[120px] resize-none bg-secondary border-0 text-sm py-2 leading-relaxed"
            rows={1}
          />

          <div className="flex items-center gap-0.5">
            {!input.trim() ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Mic size={17} />
              </Button>
            ) : null}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="h-8 w-8 rounded-full shrink-0"
            >
              <Send size={15} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
