import {
  X,
  Phone,
  Mail,
  Plus,
  CheckCircle,
  Briefcase,
  Clock,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ConversationDetail } from '@/services/api';

interface Props {
  conversation: ConversationDetail;
  onClose: () => void;
}

export default function ContactProfilePanel({ conversation, onClose }: Props) {
  const contact = conversation.contact;
  const tags = (contact.tags as string[]) || [];

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
            <AvatarFallback>{contact.name[0]}</AvatarFallback>
          </Avatar>
          <h3 className="text-sm font-semibold text-foreground">{contact.name}</h3>

          <div className="mt-3 w-full space-y-2">
            {contact.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone size={12} className="shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-3 w-full">
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
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

        {/* Notes */}
        {contact.notes && (
          <div className="p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Observações</h4>
            <p className="text-xs text-muted-foreground">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
