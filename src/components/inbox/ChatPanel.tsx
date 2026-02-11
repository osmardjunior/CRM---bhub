import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Zap,
  PanelRightClose,
  PanelRightOpen,
  AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { messages, agents, quickReplies, type Conversation } from '@/data/mock';

interface Props {
  conversation: Conversation | null;
  onToggleProfile: () => void;
  profileOpen: boolean;
}

export default function ChatPanel({ conversation, onToggleProfile, profileOpen }: Props) {
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState(messages);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [assignee, setAssignee] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const convMessages = conversation
    ? localMessages.filter((m) => m.conversationId === conversation.id)
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  useEffect(() => {
    if (conversation) {
      setAssignee(conversation.assignedTo || '');
    }
  }, [conversation?.id]);

  const handleSend = () => {
    if (!input.trim() || !conversation) return;
    const newMsg = {
      id: `m-${Date.now()}`,
      conversationId: conversation.id,
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      direction: 'outgoing' as const,
      senderName: 'Davi César',
    };
    setLocalMessages((prev) => [...prev, newMsg]);
    setInput('');
  };

  const handleQuickReply = (text: string) => {
    setInput(text);
    setQuickReplyOpen(false);
  };

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
          <AvatarImage src={conversation.contactAvatar} />
          <AvatarFallback className="text-xs">{conversation.contactName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{conversation.contactName}</span>
            <StatusBadge status={conversation.status} />
          </div>
          <p className="text-xs text-muted-foreground">{conversation.contactPhone}</p>
        </div>

        {/* Assign dropdown */}
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Atribuir agente" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="shrink-0" onClick={onToggleProfile}>
          {profileOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </Button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-secondary/30">
        {convMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={32} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Envie a primeira mensagem para iniciar a conversa.</p>
          </div>
        ) : (
          convMessages.map((msg) => {
            const isOutgoing = msg.direction === 'outgoing';
            return (
              <div
                key={msg.id}
                className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    isOutgoing
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-card border border-border text-foreground rounded-bl-md'
                  }`}
                >
                  {!isOutgoing && (
                    <p className="text-[10px] font-semibold mb-0.5 opacity-70">{msg.senderName}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1 text-right ${isOutgoing ? 'opacity-70' : 'text-muted-foreground'}`}>
                    {msg.timestamp}
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

          {/* Quick replies */}
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
            disabled={!input.trim()}
            className="shrink-0"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
