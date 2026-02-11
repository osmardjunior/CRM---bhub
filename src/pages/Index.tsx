import { useState } from 'react';
import { MessageSquare, Phone, Mail, Filter } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { conversations, type Conversation, type ConversationStatus } from '@/data/mock';

const channelIcons = {
  whatsapp: Phone,
  email: Mail,
  chat: MessageSquare,
};

const filters: { label: string; value: ConversationStatus | 'todas' }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Abertas', value: 'aberta' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Resolvidas', value: 'resolvida' },
];

export default function InboxPage() {
  const [activeFilter, setActiveFilter] = useState<ConversationStatus | 'todas'>('todas');
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    if (activeFilter !== 'todas' && c.status !== activeFilter) return false;
    if (search && !c.contactName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 -mt-2">
      {/* Conversation list */}
      <div className="flex w-full flex-col rounded-xl border border-border bg-card card-shadow lg:w-96 lg:min-w-[360px]">
        {/* Search + filter */}
        <div className="space-y-3 border-b border-border p-4">
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border-0"
          />
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={activeFilter === f.value ? 'default' : 'ghost'}
                className="h-7 text-xs rounded-full"
                onClick={() => setActiveFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Nenhuma conversa"
              description="Não há conversas com esse filtro."
            />
          ) : (
            filtered.map((conv) => {
              const ChannelIcon = channelIcons[conv.channel];
              const isSelected = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`flex w-full items-start gap-3 border-b border-border p-4 text-left transition-colors hover:bg-accent/50 ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={conv.contactAvatar} />
                    <AvatarFallback>{conv.contactName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">{conv.contactName}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{conv.timestamp}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ChannelIcon size={12} className="text-muted-foreground" />
                      <StatusBadge status={conv.status} />
                      {conv.unread > 0 && (
                        <Badge className="ml-auto bg-primary text-primary-foreground text-xs px-1.5 py-0 min-w-[18px] justify-center">
                          {conv.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat detail (desktop only) */}
      <div className="hidden flex-1 rounded-xl border border-border bg-card card-shadow lg:flex lg:flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-3 border-b border-border p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selected.contactAvatar} />
                <AvatarFallback>{selected.contactName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.contactName}</p>
                <p className="text-xs text-muted-foreground">Atribuído a {selected.assignedTo}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto mb-2 text-muted-foreground/50" />
                <p>Área de mensagens</p>
                <p className="text-xs mt-1">As mensagens aparecerão aqui</p>
              </div>
            </div>
            <div className="border-t border-border p-4">
              <Input placeholder="Digite sua mensagem..." className="bg-secondary border-0" />
            </div>
          </>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Selecione uma conversa"
            description="Escolha uma conversa da lista para começar."
          />
        )}
      </div>
    </div>
  );
}
