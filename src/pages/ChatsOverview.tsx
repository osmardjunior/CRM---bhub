import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import ConversationList from '@/components/inbox/ConversationList';
import {
  useInfiniteConversations,
  useUnreadCounts,
  useMarkConversationRead,
} from '@/hooks/useConversations';
import { useInboxRealtime } from '@/hooks/useInboxRealtime';
import type { ConversationFilters } from '@/services/api';

// ── Types ────────────────────────────────────────────────
interface AgentChatSummary {
  id: string | null;
  name: string;
  email: string | null;
  open: number;
  inProgress: number;
  waiting: number;
  total: number;
}

// ── Hook ─────────────────────────────────────────────────
function useChatsOverview() {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['chats-overview', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, status, assigned_user_id, profiles:assigned_user_id(id, name, email)')
        .eq('company_id', companyId!)
        .in('status', ['open', 'pending']);

      if (error) throw error;

      const agentMap: Record<string, AgentChatSummary> = {
        __unassigned__: { id: null, name: 'Ninguém Delegado', email: null, open: 0, inProgress: 0, waiting: 0, total: 0 },
      };

      for (const conv of conversations ?? []) {
        const userId = conv.assigned_user_id ?? '__unassigned__';
        const profile = conv.profiles as any;

        if (!agentMap[userId]) {
          agentMap[userId] = {
            id: profile?.id ?? null,
            name: profile?.name ?? 'Desconhecido',
            email: profile?.email ?? null,
            open: 0, inProgress: 0, waiting: 0, total: 0,
          };
        }

        if (conv.status === 'open') {
          if (conv.assigned_user_id) agentMap[userId].inProgress += 1;
          else agentMap['__unassigned__'].open += 1;
        } else if (conv.status === 'pending') {
          agentMap[userId].waiting += 1;
        }
        agentMap[userId].total += 1;
      }

      const rows = Object.values(agentMap);
      const totals: AgentChatSummary = {
        id: '__total__', name: 'TOTAL', email: null,
        open: rows.reduce((s, r) => s + r.open, 0),
        inProgress: rows.reduce((s, r) => s + r.inProgress, 0),
        waiting: rows.reduce((s, r) => s + r.waiting, 0),
        total: rows.reduce((s, r) => s + r.total, 0),
      };

      return { rows, totals };
    },
    refetchInterval: 30_000,
  });
}

// ── Overview table ───────────────────────────────────────
function OverviewTable() {
  const { data, isLoading } = useChatsOverview();
  const totals = data?.totals;
  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-base font-bold text-foreground">Chats não resolvidos/fechados</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visualize todos os chats que ainda não tiveram o atendimento concluído.
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Departamento ou Usuário
              </th>
              <th className="px-4 py-3 text-center min-w-[160px]">
                <span className="inline-flex items-center justify-center gap-1 bg-destructive/15 text-destructive rounded-md px-3 py-1 font-bold text-xs uppercase tracking-wide">
                  Aberto{totals ? ` (${totals.open})` : ''}
                </span>
              </th>
              <th className="px-4 py-3 text-center min-w-[200px]">
                <span className="inline-flex items-center justify-center gap-1 bg-info/15 text-info rounded-md px-3 py-1 font-bold text-xs uppercase tracking-wide">
                  Em Atendimento{totals ? ` (${totals.inProgress})` : ''}
                </span>
              </th>
              <th className="px-4 py-3 text-center min-w-[170px]">
                <span className="inline-flex items-center justify-center gap-1 bg-warning/15 text-warning rounded-md px-3 py-1 font-bold text-xs uppercase tracking-wide">
                  Aguardando{totals ? ` (${totals.waiting})` : ''}
                </span>
              </th>
              <th className="px-5 py-3 text-center min-w-[90px]">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </td>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3.5 text-center">
                        <Skeleton className="h-8 w-14 mx-auto rounded-md" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, idx) => (
                  <tr key={row.id ?? idx} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                    {/* Agent */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {row.id === null ? (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users size={14} className="text-muted-foreground" />
                          </div>
                        ) : (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {row.name[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                          {row.email && <p className="text-xs text-muted-foreground truncate">{row.email}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Aberto */}
                    <td className="px-4 py-3 text-center">
                      {row.open > 0 ? (
                        <div className="inline-flex items-center justify-center min-w-[52px] bg-destructive/10 text-destructive rounded-md px-3 py-1.5 text-sm font-semibold">
                          {row.open}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </td>

                    {/* Em Atendimento */}
                    <td className="px-4 py-3 text-center">
                      {row.inProgress > 0 ? (
                        <div className="inline-flex items-center justify-center min-w-[52px] bg-info/10 text-info rounded-md px-3 py-1.5 text-sm font-semibold">
                          {row.inProgress}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </td>

                    {/* Aguardando */}
                    <td className="px-4 py-3 text-center">
                      {row.waiting > 0 ? (
                        <div className="inline-flex items-center justify-center min-w-[52px] bg-warning/10 text-warning rounded-md px-3 py-1.5 text-sm font-semibold">
                          {row.waiting}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm font-semibold text-foreground">{row.total}</span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function ChatsOverview() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Omit<ConversationFilters, 'page'>>({});

  const {
    data: infiniteData,
    isLoading: listLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteConversations(filters);

  const conversations = useMemo(() => infiniteData?.pages.flat() ?? [], [infiniteData]);
  const { data: unreadCounts } = useUnreadCounts(conversations);
  const markRead = useMarkConversationRead();

  const effectiveSelectedId = selectedId ?? conversations[0]?.id ?? null;
  useInboxRealtime(effectiveSelectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    markRead.mutate(id);
  };

  const handleFilterChange = (newFilters: Partial<ConversationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] -mt-2 gap-0 rounded-xl border border-border bg-card card-shadow overflow-hidden">
      {/* Left: Conversation List */}
      <ConversationList
        conversations={conversations}
        loading={listLoading}
        selectedId={effectiveSelectedId}
        onSelect={handleSelect}
        filters={filters}
        onFilterChange={handleFilterChange}
        unreadCounts={unreadCounts ?? {}}
        hasMore={!!hasNextPage}
        onLoadMore={() => fetchNextPage()}
        loadingMore={isFetchingNextPage}
      />

      {/* Right: Overview table */}
      <div className="flex-1 overflow-hidden">
        <OverviewTable />
      </div>
    </div>
  );
}
