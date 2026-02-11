import {
  X,
  Phone,
  Mail,
  Tag,
  Plus,
  CheckCircle,
  Briefcase,
  MessageSquare,
  UserCircle,
  Clock,
  ArrowRightLeft,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { timelineEvents, type Conversation, type TimelineEvent } from '@/data/mock';

const timelineIcons: Record<TimelineEvent['type'], typeof MessageSquare> = {
  message: MessageSquare,
  note: Tag,
  status: ArrowRightLeft,
  assign: UserCircle,
  tag: Tag,
};

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

export default function ContactProfilePanel({ conversation, onClose }: Props) {
  const events = timelineEvents[conversation.id] || [];

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
            <AvatarImage src={conversation.contactAvatar} />
            <AvatarFallback>{conversation.contactName[0]}</AvatarFallback>
          </Avatar>
          <h3 className="text-sm font-semibold text-foreground">{conversation.contactName}</h3>

          <div className="mt-3 w-full space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone size={12} className="shrink-0" />
              <span>{conversation.contactPhone}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail size={12} className="shrink-0" />
              <span className="truncate">{conversation.contactEmail}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="mt-3 w-full">
            {conversation.contactTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {conversation.contactTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-4 space-y-1.5">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8">
            <Plus size={14} />
            Criar tarefa
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8">
            <Briefcase size={14} />
            Criar negócio
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8 text-destructive hover:text-destructive">
            <CheckCircle size={14} />
            Fechar conversa
          </Button>
        </div>

        <Separator />

        {/* Timeline */}
        <div className="p-4">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Linha do Tempo</h4>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-0">
              {events.map((event, i) => {
                const Icon = timelineIcons[event.type];
                return (
                  <div key={event.id} className="flex gap-3 relative pb-4">
                    {/* Line connector */}
                    {i < events.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                    )}
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon size={12} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{event.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{event.timestamp}</span>
                        {event.user && (
                          <span className="text-[10px] text-muted-foreground">• {event.user}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
