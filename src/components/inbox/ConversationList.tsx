import { useState, useRef, useCallback } from 'react';
import { Search, MessageSquare, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
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

const statusColors: Record<string, string> = {
  open: 'bg-success text-success-foreground',
  pending: 'bg-warning text-warning-foreground',
  closed: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  open: 'Em Atend.',
  pending: 'Pendente',
  closed: 'Fechado',
};

interface Props {
  conversations: ConversationWithRelations[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: ConversationFilters;
  onFilterChange: (filters: Partial<ConversationFilters>) => void;
  unreadCounts: Record<string, number>;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export default function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  unreadCounts,
  hasMore,
  onLoadMore,
  loadingMore,
}: Props) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    <div className="flex w-[320px] min-w-[300px] flex-col border-r border-border bg-card">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar mensagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-secondary border-0 rounded-lg"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        <Button
          variant={filtersOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={14} />
        </Button>
      </div>

      {/* Expandable filters */}
      <Collapsible open={filtersOpen}>
        <CollapsibleContent>
          <div className="px-3 py-2.5 border-b border-border space-y-2 bg-secondary/30">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Canal</p>
              <Select
                value={filters.channel ?? 'todos'}
                onValueChange={(v) =>
                  onFilterChange({ channel: v === 'todos' ? undefined : (v as Enums<'conversation_channel'>) })
                }
              >
                <SelectTrigger className="h-7 text-xs bg-secondary border-0">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Status tabs */}
      <div className="flex border-b border-border shrink-0">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange({ status: tab.value })}
            className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              activeStatus === tab.value
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border bg-secondary/20">
          <p className="text-[10px] text-muted-foreground">
            Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> resultado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          if (!hasMore || !onLoadMore || loadingMore) return;
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
            onLoadMore();
          }
        }}
      >
        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma conversa"
            description="Não há conversas com esse filtro."
          />
        ) : (
          <>
            {filtered.map((conv) => {
              const isSelected = conv.id === selectedId;
              const unread = unreadCounts[conv.id] ?? 0;
              const timeAgo = conv.last_message_at
                ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })
                : '';
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                    isSelected ? 'bg-accent border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                        {conv.contact.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm truncate ${unread > 0 ? 'font-semibold' : 'font-medium'} text-foreground`}>
                        {conv.contact.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[conv.status]}`}>
                          {statusLabels[conv.status]}
                        </span>
                      </div>
                    </div>

                    <p className={`mt-0.5 text-xs truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {conv.contact.phone ?? conv.contact.email ?? 'Sem contato'}
                    </p>

                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ChannelBadge channel={conv.channel} />
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          {conv.assigned_user?.name ?? 'Não atribuído'}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
