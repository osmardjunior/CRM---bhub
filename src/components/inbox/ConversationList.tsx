import { useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import ChannelBadge from '@/components/shared/ChannelBadge';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import type { ConversationWithRelations, ConversationFilters } from '@/services/api';
import type { Enums } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusTabs: { label: string; value: Enums<'conversation_status'> }[] = [
  { label: 'Abertas', value: 'open' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Fechadas', value: 'closed' },
];

interface Props {
  conversations: ConversationWithRelations[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: ConversationFilters;
  onFilterChange: (filters: Partial<ConversationFilters>) => void;
}

export default function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
}: Props) {
  const [search, setSearch] = useState('');

  const activeStatus = filters.status ?? 'open';

  const filtered = conversations.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        c.contact.name.toLowerCase().includes(q) ||
        (c.contact.phone ?? '').includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex w-80 min-w-[320px] flex-col border-r border-border">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange({ status: tab.value })}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeStatus === tab.value
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-secondary border-0"
          />
        </div>
        <Select
          value={filters.channel ?? 'todos'}
          onValueChange={(v) =>
            onFilterChange({ channel: v === 'todos' ? undefined : (v as Enums<'conversation_channel'>) })
          }
        >
          <SelectTrigger className="h-8 w-[110px] text-xs bg-secondary border-0">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="webchat">Webchat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma conversa"
            description="Não há conversas com esse filtro."
          />
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedId;
            const timeAgo = conv.last_message_at
              ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })
              : '';
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors hover:bg-accent/50 ${
                  isSelected ? 'bg-accent' : ''
                }`}
              >
                <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs">{conv.contact.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{conv.contact.name}</span>
                    <span className="text-[11px] text-muted-foreground ml-2 shrink-0">{timeAgo}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {conv.contact.phone ?? conv.contact.email ?? ''}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <ChannelBadge channel={conv.channel} />
                    <span className="text-[10px] text-muted-foreground truncate">
                      {conv.assigned_user?.name ?? 'Não atribuído'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
