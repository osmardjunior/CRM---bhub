import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, MessageSquare, Loader2, SlidersHorizontal, X,
  Star, Clock, MailWarning, XCircle, UserPlus, ArrowRightLeft,
  Lock, Unlock,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isGroupChat } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import ConversationAvatar from '@/components/inbox/ConversationAvatar';
import AgentLeadsSummary from '@/components/inbox/AgentLeadsSummary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import EmptyState from '@/components/shared/EmptyState';

import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import type { ConversationWithRelations, ConversationFilters } from '@/services/api';
import type { Enums, TablesUpdate } from '@/integrations/supabase/types';
import { useTags } from '@/hooks/useTags';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useUserProjects } from '@/hooks/useUserProjects';
import { useMyProjects } from '@/hooks/useProjects';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

const statusTabs: { label: string; value: Enums<'conversation_status'> | '_archived' | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Aberto', value: 'new' },
  { label: 'Atend.', value: 'open' },
  { label: 'Aguard.', value: 'pending' },
  { label: 'Resolv.', value: 'resolved' },
  { label: 'Fechado', value: 'closed' },
  { label: 'Arquiv.', value: '_archived' },
];

const statusColors: Record<string, string> = {
  new: 'bg-green-600 text-white',
  open: 'bg-blue-600 text-white',
  pending: 'bg-amber-500 text-white',
  resolved: 'bg-purple-600 text-white',
  closed: 'bg-red-700 text-white',
};

const statusLabels: Record<string, string> = {
  new: 'Aberto',
  open: 'Atend.',
  pending: 'Aguard.',
  resolved: 'Resolv.',
  closed: 'Fechado',
};

const statusOptions: { value: Enums<'conversation_status'>; label: string }[] = [
  { value: 'new', label: 'Aberto' },
  { value: 'open', label: 'Em Atendimento' },
  { value: 'pending', label: 'Aguardando' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
];

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
  frozen?: boolean;
  onToggleFreeze?: () => void;
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
  frozen,
  onToggleFreeze,
}: Props) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState(filters.search ?? '');
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const stored = localStorage.getItem('inbox_filters_open');
    return stored !== null ? stored === 'true' : true; // default open
  });

  // Track current scroll position so we can restore after data refresh
  const lastScrollTop = useRef(0);

  // Restore scroll position after list re-renders (e.g. after sending a message)
  useEffect(() => {
    if (scrollRef.current && lastScrollTop.current > 0) {
      const target = lastScrollTop.current;
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = target;
      });
    }
  }, [conversations]);

  // ── Bulk selection state ──────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const selectionCount = selectedIds.size;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters.status, filters.statusIn, filters.channel, filters.assigned_user_id]);

  // Sync search when parent sets it via URL (e.g. navigating from /contatos with ?search=)
  useEffect(() => {
    setSearch(filters.search ?? '');
  }, [filters.search]);
  const [quickFilter, setQuickFilter] = useState<'all' | 'favorites' | 'unread' | 'scheduled'>('all');
  const [localName, setLocalName] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [localTag, setLocalTag] = useState('');
  const [localUser, setLocalUser] = useState('');
  const [localStatus, setLocalStatus] = useState('');
  const [localOrder, setLocalOrder] = useState('');
  const [localChannel, setLocalChannel] = useState('');
  const [localIntegration, setLocalIntegration] = useState('');
  const [localFunnel, setLocalFunnel] = useState('');
  const [localStage, setLocalStage] = useState('');

  // Debounced server-side search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ search: value || undefined });
    }, 400);
  }, [onFilterChange]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const { user, companyId, profile } = useAuth();
  const { data: tags = [] } = useTags();
  const { data: allTeamMembers = [] } = useTeamProfiles();
  const { projectId } = useProjectContext();
  // Reset funnel filter when project changes
  useEffect(() => {
    setLocalFunnel('');
    setLocalStage('');
  }, [projectId]);
  const { data: myProjects = [] } = useMyProjects();
  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of myProjects) map[p.id] = p.name;
    return map;
  }, [myProjects]);
  const showProjectBadge = !projectId; // "Todos os projetos"
  const { data: projectMembers = [] } = useUserProjects(projectId || '');
  const teamMembers = projectId
    ? allTeamMembers.filter(m => projectMembers.some(pm => pm.user_id === m.id))
    : allTeamMembers;
  const { data: integrations = [] } = useIntegrations(projectId || undefined);
  const activeIntegrations = integrations.filter(i => i.status === 'connected');
  // Fetch funnels + stages directly (avoid FunnelContext dependency in main bundle)
  const { data: allFunnels = [] } = useQuery({
    queryKey: ['inbox-funnels', companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: funnelsData } = await supabase
        .from('funnels')
        .select('id, name, project_id')
        .order('created_at', { ascending: true });
      if (!funnelsData || funnelsData.length === 0) return [];
      const funnelIds = funnelsData.map(f => f.id);
      const { data: stagesData } = await supabase
        .from('funnel_stages')
        .select('id, funnel_id, label, position')
        .in('funnel_id', funnelIds)
        .order('position', { ascending: true });
      return funnelsData.map(f => ({
        id: f.id,
        name: f.name,
        project_id: f.project_id as string | null,
        stages: (stagesData ?? []).filter(s => s.funnel_id === f.id).map(s => ({ id: s.id, label: s.label })),
      }));
    },
  });
  const projectFunnels = useMemo(() => {
    if (!projectId) return allFunnels;
    return allFunnels.filter(f => !f.project_id || f.project_id === projectId);
  }, [allFunnels, projectId]);
  const selectedFunnelStages = useMemo(() => {
    if (!localFunnel || localFunnel === 'qualquer') return [];
    const f = projectFunnels.find(fn => fn.id === localFunnel);
    return f?.stages ?? [];
  }, [projectFunnels, localFunnel]);

  // Server-side unread filter: when "Não lidas" is active, tell the backend
  // to return only unread conversations (regardless of pagination position).
  // When switching away, clear the filter so all conversations load again.
  useEffect(() => {
    if (quickFilter === 'unread' && user && companyId) {
      onFilterChange({
        has_unread: true,
        has_unread_user_id: user.id,
        has_unread_company_id: companyId,
      });
    } else {
      onFilterChange({
        has_unread: undefined,
        has_unread_user_id: undefined,
        has_unread_company_id: undefined,
        conversation_ids: undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickFilter]);

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

  const activeStatus = (filters as any).archived ? '_archived' : filters.status;
  const filtered = useMemo(() => {
    let list = conversations.filter((c) => c.contact && !isGroupChat(c.contact.phone));

    if (quickFilter === 'favorites') {
      list = list.filter((c) => c.contact?.is_favorite);
    } else if (quickFilter === 'unread') {
      // Server-side filter via has_unread handles this — no client-side filtering needed.
      // Only keep client-side as fallback in case unreadCounts data is stale.
    } else if (quickFilter === 'scheduled') {
      list = list.filter((c) => scheduledConvIds.includes(c.id));
    }

    return list;
  }, [conversations, quickFilter, unreadCounts, scheduledConvIds]);

  // ── Bulk selection helpers ────────────────────────────────────────────
  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someSelected = selectionCount > 0 && !allVisibleSelected;

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────
  const invalidateAfterBulk = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations-infinite'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['sidebar-stats'] });
  };

  const handleBulkStatusChange = async (status: string) => {
    if (!selectionCount) return;
    setBulkLoading(true);
    try {
      const ids = [...selectedIds];
      const updateData: Record<string, unknown> = { status };
      if (status === 'closed') updateData.close_reason = 'bulk_close';
      const { error } = await supabase
        .from('conversations')
        .update(updateData as TablesUpdate<'conversations'>)
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} conversa${ids.length > 1 ? 's' : ''} atualizada${ids.length > 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      invalidateAfterBulk();
    } catch {
      toast.error('Erro ao atualizar conversas');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAssign = async (userId: string) => {
    if (!selectionCount) return;
    setBulkLoading(true);
    try {
      const ids = [...selectedIds];
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: userId } as TablesUpdate<'conversations'>)
        .in('id', ids);
      if (error) throw error;
      const agentName = teamMembers.find((m) => m.id === userId)?.name ?? 'Agente';
      toast.success(`${ids.length} conversa${ids.length > 1 ? 's' : ''} atribuída${ids.length > 1 ? 's' : ''} a ${agentName}`);
      setSelectedIds(new Set());
      invalidateAfterBulk();
    } catch {
      toast.error('Erro ao atribuir agente');
    } finally {
      setBulkLoading(false);
    }
  };

  function handleApplyFilters() {
    const newFilters: Partial<ConversationFilters> = {};
    if (localChannel && localChannel !== 'todos') {
      newFilters.channel = localChannel as Enums<'conversation_channel'>;
    }
    if (localName) newFilters.name = localName;
    if (localPhone) newFilters.phone = localPhone;
    if (localTag && localTag !== 'qualquer') newFilters.tag = localTag;
    if (localUser && localUser !== 'qualquer') newFilters.assigned_user_id = localUser;
    if (localIntegration && localIntegration !== 'qualquer') newFilters.integration_id = localIntegration;
    if (localFunnel && localFunnel !== 'qualquer') {
      newFilters.funnel_id = localFunnel;
      if (localStage && localStage !== 'qualquer') newFilters.stage_id = localStage;
    } else {
      newFilters.funnel_id = undefined;
      newFilters.stage_id = undefined;
    }
    if (localOrder) newFilters.sort = localOrder as 'recent' | 'oldest' | 'name';
    if (localStatus && localStatus !== 'todos') {
      newFilters.status = localStatus as Enums<'conversation_status'>;
    } else if (localStatus === 'todos') {
      newFilters.status = undefined;
    } else {
      newFilters.status = activeStatus;
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
    setLocalIntegration('');
    setLocalFunnel('');
    setLocalStage('');
    setQuickFilter('all');
    onFilterChange({ status: undefined, statusIn: undefined, archived: undefined, channel: undefined, name: undefined, phone: undefined, tag: undefined, integration_id: undefined, funnel_id: undefined, stage_id: undefined, sort: undefined, conversation_ids: undefined, has_unread: undefined, has_unread_user_id: undefined, has_unread_company_id: undefined } as any);

  }

  // Quick filter chips are now in the main UI below status tabs

  return (
    <div className="flex w-[320px] min-w-[300px] flex-col border-r border-border bg-card">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, telefone, email ou mensagem..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 text-[11px] bg-secondary border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/30"
          />
          {search && (
            <button onClick={() => handleSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        {onToggleFreeze && (
          <Button
            variant={frozen ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleFreeze}
            title={frozen ? 'Descongelar lista' : 'Congelar lista'}
          >
            {frozen ? <Lock size={14} /> : <Unlock size={14} />}
          </Button>
        )}
        <Button
          variant={filtersOpen ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            const next = !filtersOpen;
            setFiltersOpen(next);
            localStorage.setItem('inbox_filters_open', String(next));
          }}
        >
          <SlidersHorizontal size={14} />
        </Button>
      </div>

      {/* Expandable filters */}
      <Collapsible open={filtersOpen}>
        <CollapsibleContent>
          <div className="px-2.5 py-2 border-b border-border bg-secondary/20">
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="h-6 text-[11px] bg-background border border-border rounded px-2"
                placeholder="Nome"
              />
              <Input
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                className="h-6 text-[11px] bg-background border border-border rounded px-2"
                placeholder="Telefone"
              />
              <Select value={localChannel} onValueChange={setLocalChannel}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                </SelectContent>
              </Select>
              <Select value={localTag} onValueChange={setLocalTag}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer tag</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localUser} onValueChange={setLocalUser}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer agente</SelectItem>
                  <SelectItem value="__none__">Não delegado</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localIntegration} onValueChange={setLocalIntegration}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Telefone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer telefone</SelectItem>
                  {integrations.map((ig) => {
                    const isOff = ig.status !== 'connected';
                    const statusIcon = ig.status === 'connected' ? '🟢' : ig.status === 'banned' ? '🔴' : ig.status === 'restricted' ? '🟡' : '⚪';
                    return (
                      <SelectItem key={ig.id} value={ig.id} className={isOff ? 'opacity-70' : ''}>
                        {statusIcon} {ig.device_name}{ig.phone_number ? ` (${ig.phone_number})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={localFunnel} onValueChange={(v) => { setLocalFunnel(v); setLocalStage(''); }}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer funil</SelectItem>
                  {projectFunnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localStage} onValueChange={setLocalStage} disabled={!localFunnel || localFunnel === 'qualquer'}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer etapa</SelectItem>
                  {selectedFunnelStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localOrder} onValueChange={setLocalOrder}>
                <SelectTrigger className="h-6 text-[11px] bg-background border border-border rounded">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recente</SelectItem>
                  <SelectItem value="oldest">Mais antigo</SelectItem>
                  <SelectItem value="name">Nome A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <Button size="sm" className="flex-1 h-6 text-[11px]" onClick={handleApplyFilters}>
                Aplicar
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-6 text-[11px]" onClick={handleClearFilters}>
                Limpar
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Agent leads summary cards */}
      <AgentLeadsSummary
        activeStatus={activeStatus}
        onStatusClick={(status) => {
          if (status) {
            onFilterChange({ status: status as Enums<'conversation_status'>, statusIn: undefined });
          } else {
            onFilterChange({ status: undefined, statusIn: undefined });
          }
        }}
      />

      {/* Status tabs */}
      <div className="flex border-b border-border shrink-0 overflow-x-auto scrollbar-none">
        {statusTabs.map((tab) => (
          <button
            key={tab.value ?? 'all'}
            onClick={() => {
              if (tab.value === '_archived') {
                onFilterChange({ status: undefined, statusIn: undefined, archived: true } as any);
              } else if (tab.value) {
                onFilterChange({ status: tab.value as any, statusIn: undefined, archived: undefined } as any);
              } else {
                onFilterChange({ status: undefined, statusIn: undefined, archived: undefined } as any);
              }
            }}
            className={`flex-1 min-w-[48px] py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors whitespace-nowrap px-1 ${
              activeStatus === tab.value
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick filter chips — Favoritos, Não lidas, Agendados (sem "Todos" duplicado) */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border overflow-x-auto scrollbar-none">
        {([
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
            <Icon size={11} className={quickFilter === key ? '' : 'opacity-50'} />
            {label}
          </button>
        ))}
      </div>

      {/* Results count OR Bulk action bar */}
      {!loading && filtered.length > 0 && (
        selectionCount > 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-primary/5">
            <Checkbox
              checked={allVisibleSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={handleSelectAll}
              className="h-3.5 w-3.5"
            />
            <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">
              {selectionCount} sel.
            </span>
            <div className="h-3 w-px bg-border mx-0.5" />

            {/* Status change */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" disabled={bulkLoading}>
                  <ArrowRightLeft size={11} /> Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((opt) => (
                  <DropdownMenuItem key={opt.value} onClick={() => handleBulkStatusChange(opt.value)}>
                    <span className={`h-2 w-2 rounded-full mr-2 ${statusColors[opt.value]?.split(' ')[0]}`} />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign agent */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" disabled={bulkLoading}>
                  <UserPlus size={11} /> Atribuir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                {teamMembers.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => handleBulkAssign(m.id)}>
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close all */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] gap-1 text-destructive hover:text-destructive"
              disabled={bulkLoading}
              onClick={() => handleBulkStatusChange('closed')}
            >
              <XCircle size={11} /> Fechar
            </Button>

            <div className="flex-1" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="px-3 py-1.5 border-b border-border bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">
              Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> resultado{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        )
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          lastScrollTop.current = el.scrollTop;
          // Disable infinite scroll when filtering client-side (unread/favorites/scheduled)
          // to avoid loop of loading pages with no visible results
          if (quickFilter !== 'all') return;
          if (!hasMore || !onLoadMore || loadingMore) return;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
            onLoadMore();
          }
        }}
      >
        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={quickFilter === 'unread' ? MailWarning : quickFilter === 'favorites' ? Star : quickFilter === 'scheduled' ? Clock : MessageSquare}
            title={
              quickFilter === 'unread' ? 'Nenhuma conversa não lida'
              : quickFilter === 'favorites' ? 'Nenhum favorito'
              : quickFilter === 'scheduled' ? 'Nenhum agendamento'
              : 'Nenhuma conversa'
            }
            description={
              quickFilter === 'unread' ? 'Você está em dia! Todas as conversas foram lidas.'
              : quickFilter === 'favorites' ? 'Nenhuma conversa foi marcada como favorita.'
              : quickFilter === 'scheduled' ? 'Não há mensagens agendadas no momento.'
              : 'Não há conversas com esse filtro.'
            }
          />
        ) : (
          <>
            {filtered.map((conv) => {
              const isSelected = conv.id === selectedId;
              const isChecked = selectedIds.has(conv.id);
              const unread = unreadCounts[conv.id] ?? 0;
              const timeLabel = conv.last_message_at
                ? (() => {
                    const d = new Date(conv.last_message_at);
                    const now = new Date();
                    const diffH = (now.getTime() - d.getTime()) / 3_600_000;
                    if (diffH < 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    if (now.getFullYear() !== d.getFullYear()) return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  })()
                : '';
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    if (selectionCount > 0) {
                      toggleSelect(conv.id);
                    } else {
                      onSelect(conv.id);
                    }
                  }}
                  className={`group flex w-full items-center gap-2.5 border-b border-border/40 px-3 py-2 text-left transition-colors hover:bg-accent/50 ${
                    isSelected ? 'bg-accent border-l-2 border-l-primary' : ''
                  } ${isChecked ? 'bg-primary/5' : ''}`}
                >
                  {/* Avatar / Checkbox area */}
                  <div className="relative shrink-0 w-9 h-9">
                    {/* Checkbox overlay */}
                    <div
                      className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity ${
                        selectionCount > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(conv.id);
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        className="h-4 w-4 bg-background shadow-sm"
                        tabIndex={-1}
                      />
                    </div>
                    {/* Avatar — fades when checkbox is visible */}
                    <div className={`transition-opacity ${selectionCount > 0 ? 'opacity-0' : 'group-hover:opacity-0'}`}>
                      <ConversationAvatar
                        name={conv.contact.name}
                        avatarUrl={(conv.contact as { avatar_url?: string | null }).avatar_url}
                        isGroup={isGroupChat(conv.contact.phone)}
                        size="sm"
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + Status badge + Timestamp */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[13px] truncate ${unread > 0 ? 'font-semibold' : 'font-medium'} text-foreground`}>
                          {conv.contact.name}
                        </span>
                        {isGroupChat(conv.contact.phone) && (
                          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-accent text-accent-foreground shrink-0">
                            Grupo
                          </span>
                        )}
                        {showProjectBadge && conv.project_id && projectMap[conv.project_id] && (
                          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0 truncate max-w-[80px]" title={projectMap[conv.project_id]}>
                            {projectMap[conv.project_id]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wider ${statusColors[conv.status]}`}>
                          {statusLabels[conv.status]}
                        </span>
                        <span className={`text-[10px] shrink-0 ${unread > 0 ? 'text-green-500 font-semibold' : 'text-muted-foreground'}`}>{timeLabel}</span>
                      </div>
                    </div>

                    {/* Row 2: Last message preview + unread badge */}
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className={`text-[11px] truncate ${unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conv.last_message_preview ?? conv.contact.phone ?? conv.contact.email ?? 'Sem contato'}
                      </p>
                      {unread > 0 && (
                        <span className="flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-green-500 text-white text-[10px] font-bold shrink-0 shadow-sm">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>

                    {/* Row 3: removed — agent name and channel badge no longer shown */}
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
