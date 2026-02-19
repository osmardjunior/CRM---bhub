import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';

interface AgentChatSummary {
  id: string | null;
  name: string;
  email: string | null;
  open: number;
  inProgress: number;
  waiting: number;
  total: number;
}

function useChatsOverview() {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['chats-overview', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      // Fetch all open/pending conversations with assigned user
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, status, assigned_user_id, profiles:assigned_user_id(id, name, email)')
        .eq('company_id', companyId!)
        .in('status', ['open', 'pending']);

      if (error) throw error;

      // Group by agent
      const agentMap: Record<string, AgentChatSummary> = {};

      // "Ninguém Delegado" bucket
      agentMap['__unassigned__'] = {
        id: null,
        name: 'Ninguém Delegado',
        email: null,
        open: 0,
        inProgress: 0,
        waiting: 0,
        total: 0,
      };

      for (const conv of conversations ?? []) {
        const userId = conv.assigned_user_id ?? '__unassigned__';
        const profile = conv.profiles as any;

        if (!agentMap[userId]) {
          agentMap[userId] = {
            id: profile?.id ?? null,
            name: profile?.name ?? 'Desconhecido',
            email: profile?.email ?? null,
            open: 0,
            inProgress: 0,
            waiting: 0,
            total: 0,
          };
        }

        // open = aberto (sem agente ou recém criado)
        // pending = aguardando resposta do cliente
        if (conv.status === 'open') {
          if (conv.assigned_user_id) {
            agentMap[userId].inProgress += 1;
          } else {
            agentMap['__unassigned__'].open += 1;
          }
        } else if (conv.status === 'pending') {
          agentMap[userId].waiting += 1;
        }

        agentMap[userId].total += 1;
      }

      const rows = Object.values(agentMap);

      // Totals
      const totals: AgentChatSummary = {
        id: '__total__',
        name: 'TOTAL',
        email: null,
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

export default function ChatsOverview() {
  const { data, isLoading } = useChatsOverview();

  const totals = data?.totals;
  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={22} className="text-primary" />
          Chats não resolvidos/fechados
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualize todos os chats que ainda não tiveram o atendimento concluído.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[35%]">
                  Departamento ou Usuário
                </th>
                <th className="px-4 py-3.5 text-center min-w-[140px]">
                  <div className="flex items-center justify-center gap-2 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg px-3 py-1.5 font-semibold text-xs uppercase tracking-wide mx-auto w-fit">
                    Aberto{totals ? ` (${totals.open})` : ''}
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center min-w-[180px]">
                  <div className="flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-1.5 font-semibold text-xs uppercase tracking-wide mx-auto w-fit">
                    Em Atendimento{totals ? ` (${totals.inProgress})` : ''}
                  </div>
                </th>
                <th className="px-4 py-3.5 text-center min-w-[160px]">
                  <div className="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-1.5 font-semibold text-xs uppercase tracking-wide mx-auto w-fit">
                    Aguardando{totals ? ` (${totals.waiting})` : ''}
                  </div>
                </th>
                <th className="px-5 py-3.5 text-center min-w-[90px]">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </td>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3.5 text-center">
                        <Skeleton className="h-8 w-12 mx-auto rounded-lg" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhum chat aberto no momento 🎉
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.id ?? idx}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    {/* Agent info */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {row.id === null ? (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <MessageSquare size={14} className="text-muted-foreground" />
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
                          {row.email && (
                            <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Aberto */}
                    <td className="px-4 py-3 text-center">
                      {row.open > 0 ? (
                        <div className="inline-flex items-center justify-center min-w-[56px] bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg px-3 py-1.5 text-sm font-semibold">
                          {row.open}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </td>

                    {/* Em Atendimento */}
                    <td className="px-4 py-3 text-center">
                      {row.inProgress > 0 ? (
                        <div className="inline-flex items-center justify-center min-w-[56px] bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-lg px-3 py-1.5 text-sm font-semibold">
                          {row.inProgress}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </td>

                    {/* Aguardando */}
                    <td className="px-4 py-3 text-center">
                      {row.waiting > 0 ? (
                        <div className="inline-flex items-center justify-center min-w-[56px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-1.5 text-sm font-semibold">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
