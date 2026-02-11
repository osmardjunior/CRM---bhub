import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Zap,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { useSendMessage } from '@/hooks/useConversations';
import { useTeamMembers } from '@/hooks/useContacts';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationDetail, MessageWithSender } from '@/services/api';

const quickReplies = [
  'Olá! Como posso ajudar você hoje?',
  'Agradecemos o seu contato! Vou verificar e retorno em instantes.',
  'Pode me informar o número do seu pedido, por favor?',
  'Estou transferindo você para o setor responsável.',
  'Seu problema foi resolvido? Posso ajudar em mais alguma coisa?',
  'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
  'Obrigado pela preferência! Tenha um ótimo dia! 😊',
];

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

  // Agent can only assign to self; supervisor/admin can assign to anyone
  const canReassign = permissions.canReassignConversations;
  const reassignTooltip = getPermissionTooltip('canReassignConversations', permissions);

  const availableMembers = canReassign
    ? (teamMembers ?? [])
    : (teamMembers ?? []).filter((m) => m.id === user?.id);

  const messages = conversation?.messages ?? [];

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
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={MessageSquare}
          title="Selecione uma conversa"
          description="Escolha uma conversa da lista para começar."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs">{conversation.contact.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{conversation.contact.name}</span>
            <StatusBadge status={conversation.status} />
          </div>
          <p className="text-xs text-muted-foreground">{conversation.contact.phone}</p>
        </div>

        {/* Assign dropdown */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select value={conversation.assigned_user_id ?? ''} disabled={!canReassign && conversation.assigned_user_id === user?.id}>
                <SelectTrigger className={`h-8 w-[150px] text-xs ${!canReassign ? 'opacity-60' : ''}`}>
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

        <Button variant="ghost" size="icon" className="shrink-0" onClick={onToggleProfile}>
          {profileOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </Button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-secondary/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={32} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Envie a primeira mensagem para iniciar a conversa.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutgoing = msg.sender_type === 'agent';
            return (
              <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    isOutgoing
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border text-foreground rounded-bl-md'
                  }`}
                >
                  {!isOutgoing && (
                    <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                      {msg.sender?.name ?? conversation.contact.name}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                  <p className={`text-[10px] mt-1 text-right ${isOutgoing ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <Paperclip size={18} />
          </Button>

          <Dialog open={quickReplyOpen} onOpenChange={setQuickReplyOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                <Zap size={18} />
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

          <Input
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 bg-secondary border-0"
          />

          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="shrink-0"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
