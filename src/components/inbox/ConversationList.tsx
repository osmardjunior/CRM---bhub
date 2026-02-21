import { useState, useMemo } from 'react';
import {
  Search, MessageSquare, Loader2, SlidersHorizontal, X,
  Star, Clock, MailWarning,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isGroupChat } from '@/services/api';
import ConversationAvatar from '@/components/inbox/ConversationAvatar';
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
import { useTags } from '@/hooks/useTags';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';

const statusTabs: { label: string; value: Enums<'conversation_status'> }[] = [
  { label: 'Em Atend.', value: 'open' },
  { label: 'Aguardando', value: 'pending' },
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
  const [quickFilter, setQuickFilter] = useState<'all' | 'favorites' | 'unread' | 'scheduled'>('all');
  const [localName, setLocalName] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [localTag, setLocalTag] = useState('');
  const [localUser, setLocalUser] = useState('');
  const [localStatus, setLocalStatus] = useState('');
  const [localOrder, setLocalOrder] = useState('');
  const [localChannel, setLocalChannel] = useState('');

  const { data: tags = [] } = useTags();
  const { data: teamMembers = [] } = useTeamProfiles();

  // Fetch scheduled conversation IDs for the "Agendados" quick filter
  const { data: scheduledConvIds = [] } = useQuery({
    queryKey: ['scheduled-conv-ids'],
    queryFn: async () => {
      const { data } = await supabase
        .from('scheduled_messages')
        .select('conversation_id')
        .is('sent_at', null)
        .is('cancelled_at', null);
      return [...new Set((data ?? []).map((d) => d.conversation_id))];
    },
    refetchInterval: 60_000,
  });

  const activeStatus = filters.status ?? 'open';
  const filtered = useMemo(() => {
    let list = conversations.filter((c) => {
      const isGroup = isGroupChat(c.contact.phone);
      if (isGroup) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.contact.name.toLowerCase().includes(q) ||
          (c.contact.phone ?? '').includes(q)
        );
      }
      return true;
    });

    // Apply quick filters
    if (quickFilter === 'favorites') {
      list = list.filter((c) => c.contact.is_favorite);
    } else if (quickFilter === 'unread') {
      list = list.filter((c) => (unreadCounts[c.id] ?? 0) > 0);
    } else if (quickFilter === 'scheduled') {
      list = list.filter((c) => scheduledConvIds.includes(c.id));
    }

    return list;
  }, [conversations, search, quickFilter, unreadCounts, scheduledConvIds]);

  function handleApplyFilters() {
    const newFilters: Partial<ConversationFilters> = {};
    if (localChannel && localChannel !== 'todos') {
      newFilters.channel = localChannel as Enums<'conversation_channel'>;
    }
    if (localName) newFilters.name = localName;
    if (localPhone) newFilters.phone = localPhone;
    if (localTag && localTag !== 'qualquer') newFilters.tag = localTag;
    if (localUser && localUser !== 'qualquer') newFilters.assigned_user_id = localUser;
    if (localOrder) newFilters.sort = localOrder as 'recent' | 'oldest' | 'name';
    if (localStatus && localStatus !== 'todos') {
      newFilters.status = localStatus as Enums<'conversation_status'>;
    } else {
      newFilters.status = activeStatus as Enums<'conversation_status'>;
    }
    onFilterChange(newFilters);
  }

  function handleClearFilters() {
    setLocalName('');
    setLocalPhone('');
    setLocalTag('');
    setLocalUser('');
    setLocalStatus('');
    setLocalOrder('');
    setLocalChannel('');
    onFilterChange({ status: 'open', channel: undefined, name: undefined, phone: undefined, tag: undefined, assigned_user_id: undefined, sort: undefined });
  }

  // Quick filter chips are now in the main UI below status tabs

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
          variant={filtersOpen ? 'default' : 'ghost'}
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
          <div className="px-3 py-3 border-b border-border space-y-2.5 bg-secondary/20">

            {/* Nome */}
            <div>
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Nome:</label>
              <Input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="h-7 text-xs bg-background border border-border rounded"
                placeholder=""
              />
            </div>

            {/* Aparelho */}
            <div>
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Aparelho:</label>
              <Select value={localChannel} onValueChange={setLocalChannel}>
                <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                  <SelectValue placeholder="" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Número Whatsapp */}
            <div>
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Número Whatsapp:</label>
              <Input
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                className="h-7 text-xs bg-background border border-border rounded"
                placeholder=""
              />
            </div>

            {/* Tags + Qualquer */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Tags:</label>
                <Select value={localTag} onValueChange={setLocalTag}>
                  <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">Qualquer</SelectItem>
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 self-end">
                <Select defaultValue="qualquer">
                  <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">Qualquer</SelectItem>
                    <SelectItem value="todas">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Usuário/Departamento + Qualquer */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Usuário/Departamento:</label>
                <Select value={localUser} onValueChange={setLocalUser}>
                  <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">Qualquer</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 self-end">
                <Select defaultValue="qualquer">
                  <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">Qualquer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Etapa do Funil */}
            <div>
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Etapa do Funil:</label>
              <Input
                className="h-7 text-xs bg-background border border-border rounded"
                placeholder=""
                readOnly
              />
            </div>

            {/* Status + Ordenar Por */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 block">Status:</label>
                <Select value={localStatus} onValueChange={setLocalStatus}>
                  <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="pending">Aguardando</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Ordenar Por</label>
                <Select value={localOrder} onValueChange={setLocalOrder}>
                  <SelectTrigger className="h-7 text-xs bg-background border border-border rounded">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recente</SelectItem>
                    <SelectItem value="oldest">Mais antigo</SelectItem>
                    <SelectItem value="name">Nome A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleApplyFilters}>
                Aplicar
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleClearFilters}>
                Limpar
              </Button>
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

      {/* Quick filter chips */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border overflow-x-auto scrollbar-none">
        {([
          { key: 'all' as const, label: 'Todos', icon: null, activeColor: 'bg-primary text-primary-foreground shadow-sm' },
          { key: 'favorites' as const, label: 'Favoritos', icon: Star, activeColor: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400' },
          { key: 'unread' as const, label: 'Não lidas', icon: MailWarning, activeColor: 'bg-info/15 text-info border-info/30' },
          { key: 'scheduled' as const, label: 'Agendados', icon: Clock, activeColor: 'bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400' },
        ] as const).map(({ key, label, icon: Icon, activeColor }) => (
          <button
            key={key}
            onClick={() => setQuickFilter(quickFilter === key ? 'all' : key)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border whitespace-nowrap transition-all duration-150 shrink-0 ${
              quickFilter === key
                ? activeColor
                : 'border-transparent bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-accent/60'
            }`}
          >
            {Icon && <Icon size={11} className={quickFilter === key ? '' : 'opacity-50'} />}
            {label}
          </button>
        ))}
      </div>
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
                  <ConversationAvatar
                    name={conv.contact.name}
                    avatarUrl={(conv.contact as { avatar_url?: string | null }).avatar_url}
                    isGroup={isGroupChat(conv.contact.phone)}
                    unread={unread}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`text-sm truncate ${unread > 0 ? 'font-semibold' : 'font-medium'} text-foreground`}>
                          {conv.contact.name}
                        </span>
                        {isGroupChat(conv.contact.phone) && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground shrink-0">
                            Grupo
                          </span>
                        )}
                      </div>
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
