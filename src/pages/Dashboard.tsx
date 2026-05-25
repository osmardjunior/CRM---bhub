import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Loader2, Monitor } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTeamProfiles, type TeamMember } from '@/hooks/useTeamProfiles';
import { useUserProjects } from '@/hooks/useUserProjects';
import DashboardDatePicker from '@/components/dashboard/DashboardDatePicker';
import KPICards from '@/components/dashboard/KPICards';
import AgentComparisonChart from '@/components/dashboard/AgentComparisonChart';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import ChannelDistribution from '@/components/dashboard/ChannelDistribution';
import TagDistribution from '@/components/dashboard/TagDistribution';
import HourlyHeatmap from '@/components/dashboard/HourlyHeatmap';
import HourlyResponseTime from '@/components/dashboard/HourlyResponseTime';
import AgentRankingTable from '@/components/dashboard/AgentRankingTable';

/* ── helpers ── */

function deriveStatus(lastSeenAt: string | null, dbStatus: string): 'online' | 'away' | 'offline' {
  if (!lastSeenAt) return 'offline';
  const sec = (Date.now() - new Date(lastSeenAt).getTime()) / 1_000;
  if (sec < 300) return dbStatus === 'ausente' ? 'away' : 'online';
  if (sec < 600) return 'away';
  return 'offline';
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Nunca';
  const mins = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60_000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min atrás`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function fmtDate(d: Date) {
  return format(d, 'dd/MM', { locale: ptBR });
}
function fmtDateFull(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function fmtScreenTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m > 0 ? `${m.toString().padStart(2, '0')}m` : ''}`;
}

/* ── component ── */

export default function Dashboard() {
  const navigate = useNavigate();
  const { companyId, user, role } = useAuth();
  const qc = useQueryClient();
  const { projectId } = useProjectContext();
  const isAgent = role === 'agent';
  const userId = user?.id;
  // Analytics date range (admin only)
  const [analyticsFrom, setAnalyticsFrom] = useState(() => subDays(new Date(), 30));
  const [analyticsTo, setAnalyticsTo] = useState(() => new Date());
  const [analyticsAgentId, setAnalyticsAgentId] = useState<string | null>(null);
  const analyticsFromISO = useMemo(() => analyticsFrom.toISOString(), [analyticsFrom]);
  const analyticsToISO = useMemo(() => analyticsTo.toISOString(), [analyticsTo]);
  const { data: team = [] } = useTeamProfiles();
  const { data: projectMembers } = useUserProjects(projectId ?? '');

  // Tick for relative times
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  // Realtime presence
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel('dashboard-presence')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: Record<string, unknown>) => {
        const u = payload.new as Record<string, unknown> | undefined;
        if (!u?.id) return;
        qc.setQueryData<TeamMember[]>(['team-profiles', companyId], old =>
          old?.map(m => m.id === u.id ? { ...m, last_seen_at: (u.last_seen_at as string | null) ?? m.last_seen_at } : m)
        );
        setTick(t => t + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, qc]);

  // Filter agents by project for data queries
  const memberIds = projectId && projectMembers ? new Set(projectMembers.map(pm => pm.user_id)) : null;
  // Users table: filter by project when one is selected
  const activeAgents = team.filter(m => {
    if (!m.is_active) return false;
    if (memberIds && !memberIds.has(m.id)) return false;
    return true;
  });

  // Agent status counts for top bar
  const agentStatusData = useMemo(() => {
    const sorted = [...activeAgents].sort((a, b) => {
      const order = { online: 0, away: 1, offline: 2 };
      return order[deriveStatus(a.last_seen_at, a.status)] - order[deriveStatus(b.last_seen_at, b.status)];
    });
    let online = 0, away = 0, offline = 0;
    for (const a of activeAgents) {
      const s = deriveStatus(a.last_seen_at, a.status);
      if (s === 'online') online++;
      else if (s === 'away') away++;
      else offline++;
    }
    return { sorted, online, away, offline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgents, tick]);

  /* ── Query 1: agent table (conversations by agent × status) ── */
  type AgentRow = { id: string | null; name: string; new: number; open: number; pending: number; resolved: number; closed: number; total: number };
  const { data: agentTableData = [], isLoading } = useQuery({
    queryKey: ['dashboard-agent-table', companyId, projectId, isAgent, userId],
    queryFn: async () => {
      // Paginate to avoid 1000-row default limit
      let allData: { assigned_user_id: string | null; status: string }[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase.from('conversations')
          .select('assigned_user_id, status')
          .range(from, from + PAGE - 1);
        if (projectId) q = q.eq('project_id', projectId);
        if (isAgent && userId) q = q.eq('assigned_user_id', userId);
        const { data, error } = await q;
        if (error) {
          console.error('[Dashboard] agent table query error:', error);
          break;
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      console.log(`[Dashboard] agent table: ${allData.length} conversations loaded (project=${projectId || 'all'}, isAgent=${isAgent})`);

      const data = allData;
      const map: Record<string, { new: number; open: number; pending: number; resolved: number; closed: number }> = {};
      const NONE = '__none__';
      for (const r of data ?? []) {
        const uid = r.assigned_user_id ?? NONE;
        if (!map[uid]) map[uid] = { new: 0, open: 0, pending: 0, resolved: 0, closed: 0 };
        if (r.status === 'new') map[uid].new++;
        else if (r.status === 'open') map[uid].open++;
        else if (r.status === 'pending') map[uid].pending++;
        else if (r.status === 'resolved') map[uid].resolved++;
        else if (r.status === 'closed') map[uid].closed++;
      }

      // Fetch agent names
      const agentIds = Object.keys(map).filter(id => id !== NONE);
      const nameMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', agentIds);
        for (const p of profiles ?? []) nameMap[p.id] = p.name || 'Sem nome';
      }

      const rows: AgentRow[] = [];
      // "Ninguém Delegado" first
      if (map[NONE]) {
        const s = map[NONE];
        rows.push({ id: null, name: 'Ninguém Delegado', ...s, total: s.new + s.open + s.pending + s.resolved + s.closed });
      }
      // Agents sorted by total desc
      const agentRows = agentIds
        .map(id => {
          const s = map[id];
          return { id, name: nameMap[id] || 'Sem nome', ...s, total: s.new + s.open + s.pending + s.resolved + s.closed };
        })
        .sort((a, b) => b.total - a.total);
      rows.push(...agentRows);
      return rows;
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  /* ── Query 1b: screen time (today) per agent ── */
  const todayStr = useMemo(() => fmtDateFull(new Date()), []);
  const { data: screenTimeMap = {} } = useQuery({
    queryKey: ['dashboard-screen-time', companyId, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('screen_time')
        .select('user_id, total_seconds')
        .eq('company_id', companyId!)
        .eq('date', todayStr);
      const map: Record<string, number> = {};
      for (const row of data ?? []) map[row.user_id] = row.total_seconds;
      return map;
    },
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  /* ── Query 2: status cards (all statuses + unread counts) ── */
  const STATUSES = ['new', 'open', 'pending', 'resolved', 'closed'] as const;
  const { data: statusCounts } = useQuery({
    queryKey: ['dashboard-status-counts', companyId, projectId, isAgent, userId],
    queryFn: async () => {
      // Use count queries (head:true) — no row limit, very fast
      const countResults = await Promise.all(
        STATUSES.map(status => {
          let q = supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);
          if (projectId) q = q.eq('project_id', projectId);
          if (isAgent && userId) q = q.eq('assigned_user_id', userId);
          return q;
        })
      );

      const counts: Record<string, number> = {};
      STATUSES.forEach((s, i) => { counts[s] = countResults[i].count ?? 0; });
      const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);

      const c = {
        new: counts.new, open: counts.open, pending: counts.pending,
        resolved: counts.resolved, closed: counts.closed, total,
        unread_new: 0, unread_open: 0, unread_pending: 0, unread_resolved: 0, unread_closed: 0, unread_total: 0,
      };

      // Unread: paginate conversations to avoid 1000 limit
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: reads } = await supabase
          .from('conversation_reads')
          .select('conversation_id, last_read_at')
          .eq('user_id', authUser.id)
          .eq('company_id', companyId!);

        const readMap: Record<string, string> = {};
        for (const r of reads ?? []) readMap[r.conversation_id] = r.last_read_at;

        // Fetch all conversations in pages
        let allConvs: { id: string; status: string }[] = [];
        let from = 0;
        const PAGE = 1000;
        while (true) {
          let q = supabase.from('conversations').select('id, status').range(from, from + PAGE - 1);
          if (projectId) q = q.eq('project_id', projectId);
          if (isAgent && userId) q = q.eq('assigned_user_id', userId);
          const { data } = await q;
          if (!data || data.length === 0) break;
          allConvs = allConvs.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }

        // Fetch latest user message per conversation in batches (paginated)
        const latestByConv: Record<string, string> = {};
        for (let i = 0; i < allConvs.length; i += 2000) {
          const batch = allConvs.slice(i, i + 2000).map(cv => cv.id);
          let msgFrom = 0;
          const MSG_PAGE = 1000;
          while (true) {
            const { data: msgs } = await supabase
              .from('messages')
              .select('conversation_id, created_at')
              .in('conversation_id', batch)
              .eq('sender_type', 'user')
              .order('created_at', { ascending: false })
              .range(msgFrom, msgFrom + MSG_PAGE - 1);
            if (!msgs || msgs.length === 0) break;
            for (const m of msgs) {
              if (!latestByConv[m.conversation_id]) latestByConv[m.conversation_id] = m.created_at;
            }
            if (msgs.length < MSG_PAGE || batch.every(id => latestByConv[id])) break;
            msgFrom += MSG_PAGE;
          }
        }

        for (const conv of allConvs) {
          const lastRead = readMap[conv.id];
          const lastUserMsg = latestByConv[conv.id];
          if (lastUserMsg && (!lastRead || lastUserMsg > lastRead)) {
            if (conv.status === 'new') c.unread_new++;
            else if (conv.status === 'open') c.unread_open++;
            else if (conv.status === 'pending') c.unread_pending++;
            else if (conv.status === 'resolved') c.unread_resolved++;
            else if (conv.status === 'closed') c.unread_closed++;
            c.unread_total++;
          }
        }
      }

      return c;
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  /* ── Query 3: new chats per day (last 7 days) ── */
  const last7 = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }), []);
  const { data: dailyChats } = useQuery({
    queryKey: ['dashboard-daily-chats', companyId, projectId, isAgent, userId],
    queryFn: async () => {
      const from = startOfDay(subDays(new Date(), 6)).toISOString();
      let q = supabase.from('conversations').select('created_at, assigned_user_id').gte('created_at', from);
      if (projectId) q = q.eq('project_id', projectId);
      if (isAgent && userId) q = q.eq('assigned_user_id', userId);
      const { data } = await q;
      const byDay: Record<string, { chats: number; assigned: number }> = {};
      for (const d of last7) byDay[fmtDateFull(d)] = { chats: 0, assigned: 0 };
      for (const r of data ?? []) {
        const key = fmtDateFull(new Date(r.created_at));
        if (byDay[key]) {
          byDay[key].chats++;
          if (r.assigned_user_id) byDay[key].assigned++;
        }
      }
      return last7.map(d => ({ day: fmtDate(d), chats: byDay[fmtDateFull(d)].chats, atendimentos: byDay[fmtDateFull(d)].assigned }));
    },
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  const chatStats = useMemo(() => {
    if (!dailyChats) return { totalChats: 0, avgChats: 0, totalAtend: 0, avgAtend: 0 };
    const tc = dailyChats.reduce((s, d) => s + d.chats, 0);
    const ta = dailyChats.reduce((s, d) => s + d.atendimentos, 0);
    return { totalChats: tc, avgChats: (tc / 7).toFixed(1), totalAtend: ta, avgAtend: (ta / 7).toFixed(1) };
  }, [dailyChats]);

  /* ── Query 4: messages per day (last 7 days) ── */
  const { data: dailyMessages } = useQuery({
    queryKey: ['dashboard-daily-messages', companyId, projectId, isAgent, userId],
    queryFn: async () => {
      const from = startOfDay(subDays(new Date(), 6)).toISOString();
      // Get conversation IDs for this project/agent (if filtered)
      let convFilter: string[] | null = null;
      if (projectId || (isAgent && userId)) {
        let cq = supabase.from('conversations').select('id');
        if (projectId) cq = cq.eq('project_id', projectId);
        if (isAgent && userId) cq = cq.eq('assigned_user_id', userId);
        const { data: convs } = await cq;
        convFilter = (convs ?? []).map(c => c.id);
        if (convFilter.length === 0) return last7.map(d => ({ day: fmtDate(d), recebidas: 0, enviadas: 0 }));
      }

      let q = supabase.from('messages').select('created_at, sender_type').eq('company_id', companyId!).gte('created_at', from).is('deleted_at', null);
      if (convFilter) q = q.in('conversation_id', convFilter.slice(0, 500));
      const { data } = await q;

      const byDay: Record<string, { recv: number; sent: number }> = {};
      for (const d of last7) byDay[fmtDateFull(d)] = { recv: 0, sent: 0 };
      for (const r of data ?? []) {
        const key = fmtDateFull(new Date(r.created_at));
        if (byDay[key]) {
          if (r.sender_type === 'agent') byDay[key].sent++;
          else byDay[key].recv++;
        }
      }
      return last7.map(d => ({ day: fmtDate(d), recebidas: byDay[fmtDateFull(d)].recv, enviadas: byDay[fmtDateFull(d)].sent }));
    },
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  const msgStats = useMemo(() => {
    if (!dailyMessages) return { totalSent: 0, avgSent: 0, totalRecv: 0, avgRecv: 0 };
    const ts = dailyMessages.reduce((s, d) => s + d.enviadas, 0);
    const tr = dailyMessages.reduce((s, d) => s + d.recebidas, 0);
    return { totalSent: ts, avgSent: (ts / 7).toFixed(0), totalRecv: tr, avgRecv: (tr / 7).toFixed(0) };
  }, [dailyMessages]);

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{isAgent ? 'Meu Painel' : 'Painel Inicial'}</h1>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Activity size={10} className="text-green-500 animate-pulse" /> Tempo real
        </p>
      </div>

      {/* ═══ Agent Status Bar ═══ */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Equipe</h2>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> {agentStatusData.online} online
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> {agentStatusData.away} ausente
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400" /> {agentStatusData.offline} offline
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {agentStatusData.sorted.map(agent => {
            const s = deriveStatus(agent.last_seen_at, agent.status);
            const dotColor = s === 'online' ? 'bg-green-500' : s === 'away' ? 'bg-amber-500' : 'bg-red-400';
            const bgColor = s === 'online' ? 'bg-green-500/10 border-green-500/20' : s === 'away' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted/30 border-border';
            return (
              <div key={agent.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bgColor} transition-colors`}>
                <div className="relative shrink-0">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                    {agent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-card ${dotColor}`} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground leading-tight">{agent.name.split(' ')[0]}</span>
                  {screenTimeMap[agent.id] ? (
                    <span className="text-[9px] text-muted-foreground leading-tight flex items-center gap-0.5">
                      <Monitor size={8} /> {fmtScreenTime(screenTimeMap[agent.id])}
                    </span>
                  ) : null}
                </div>
                {s !== 'online' && (
                  <span className="text-[9px] text-muted-foreground leading-tight">{formatLastSeen(agent.last_seen_at)}</span>
                )}
              </div>
            );
          })}
          {activeAgents.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum agente no projeto</p>
          )}
        </div>
      </div>

      {/* ═══ Section 1: Agent Table ═══ */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Visão Geral dos Chats</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Distribuição de todos os chats por agente e status.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground bg-muted/30 w-[30%]">DEPARTAMENTO OU USUÁRIO</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-center text-white bg-red-500 w-[15%]">ABERTO</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-center text-white bg-blue-500 w-[15%]">EM ATENDIMENTO</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-center text-white bg-amber-500 w-[12%] hidden sm:table-cell">AGUARDANDO</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-center text-white bg-purple-500 w-[12%] hidden sm:table-cell">RESOLVIDO</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-center text-white bg-gray-500 w-[12%] hidden sm:table-cell">FECHADO</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-center text-muted-foreground bg-muted/30 w-[10%]">TOTAL</th>
                <th className="py-2.5 px-3 text-xs font-medium text-center text-muted-foreground bg-muted/30 w-[10%] hidden md:table-cell">TELA HOJE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground"><Loader2 size={18} className="inline animate-spin" /></td></tr>
              ) : agentTableData.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa</td></tr>
              ) : (
                agentTableData.map((row, i) => (
                  <tr key={row.id ?? '__none__'} className={`border-b last:border-0 ${i === 0 && !row.id ? 'bg-muted/20' : 'hover:bg-accent/30'} transition-colors`}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {row.id ? (
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {row.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">?</div>
                        )}
                        <span className={`text-xs font-medium truncate ${!row.id ? 'text-muted-foreground italic' : ''}`}>{row.name}</span>
                      </div>
                    </td>
                    {[
                      { count: row.new, status: 'new', color: 'text-red-600 dark:text-red-400' },
                      { count: row.open, status: 'open', color: 'text-blue-600 dark:text-blue-400' },
                      { count: row.pending, status: 'pending', color: 'text-amber-600 dark:text-amber-400', hideOnMobile: true },
                      { count: row.resolved, status: 'resolved', color: 'text-purple-600 dark:text-purple-400', hideOnMobile: true },
                      { count: row.closed, status: 'closed', color: 'text-gray-600 dark:text-gray-400', hideOnMobile: true },
                    ].map(({ count, status, color, hideOnMobile }) => (
                      <td key={status} className={`py-2.5 px-3 text-center text-sm font-bold ${hideOnMobile ? 'hidden sm:table-cell' : ''}`}>
                        <button
                          className={`${count > 0 ? color : 'text-muted-foreground/40'} hover:underline cursor-pointer`}
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('status', status);
                            if (row.id) params.set('assigned', row.id);
                            else params.set('assigned', 'none');
                            navigate(`/inbox?${params.toString()}`);
                          }}
                        >{count}</button>
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-center text-sm font-bold">
                      <button
                        className="text-foreground hover:underline cursor-pointer"
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (row.id) params.set('assigned', row.id);
                          else params.set('assigned', 'none');
                          navigate(`/inbox?${params.toString()}`);
                        }}
                      >{row.total}</button>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-muted-foreground hidden md:table-cell">
                      {row.id && screenTimeMap[row.id] ? (
                        <span className="inline-flex items-center gap-1">
                          <Monitor size={10} className="text-primary" />
                          {fmtScreenTime(screenTimeMap[row.id])}
                        </span>
                      ) : row.id ? '—' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Section 2: Status Cards (clickable → Inbox) ═══ */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: 'ABERTO', status: 'new', value: statusCounts?.new ?? 0, unread: statusCounts?.unread_new ?? 0, color: 'text-red-500', border: 'border-red-500/30', bg: 'bg-red-500/5', hoverBg: 'hover:bg-red-500/10' },
          { label: 'ATENDIMENTO', status: 'open', value: statusCounts?.open ?? 0, unread: statusCounts?.unread_open ?? 0, color: 'text-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/5', hoverBg: 'hover:bg-blue-500/10' },
          { label: 'AGUARDANDO', status: 'pending', value: statusCounts?.pending ?? 0, unread: statusCounts?.unread_pending ?? 0, color: 'text-amber-500', border: 'border-amber-500/30', bg: 'bg-amber-500/5', hoverBg: 'hover:bg-amber-500/10' },
          { label: 'RESOLVIDO', status: 'resolved', value: statusCounts?.resolved ?? 0, unread: statusCounts?.unread_resolved ?? 0, color: 'text-purple-500', border: 'border-purple-500/30', bg: 'bg-purple-500/5', hoverBg: 'hover:bg-purple-500/10' },
          { label: 'FECHADO', status: 'closed', value: statusCounts?.closed ?? 0, unread: statusCounts?.unread_closed ?? 0, color: 'text-gray-500', border: 'border-gray-500/30', bg: 'bg-gray-500/5', hoverBg: 'hover:bg-gray-500/10' },
          { label: 'TOTAL', status: '', value: statusCounts?.total ?? 0, unread: statusCounts?.unread_total ?? 0, color: 'text-foreground', border: 'border-border', bg: 'bg-muted/5', hoverBg: 'hover:bg-muted/20' },
        ].map(c => (
          <button
            key={c.label}
            onClick={() => {
              const params = new URLSearchParams();
              if (c.status) params.set('status', c.status);
              navigate(`/inbox?${params.toString()}`);
            }}
            className={`rounded-xl border ${c.border} ${c.bg} ${c.hoverBg} p-3 text-left transition-colors cursor-pointer`}
          >
            <p className={`text-[9px] font-semibold ${c.color} uppercase tracking-wide`}>{c.label}</p>
            <p className={`text-xl font-bold ${c.color} mt-0.5`}>{c.value}</p>
            {c.unread > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-medium text-red-500">{c.unread} não lida{c.unread > 1 ? 's' : ''}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ═══ Section 3: New Chats - Last 7 Days ═══ */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Novos Chats - Últimos 7 dias</h2>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="space-y-2 shrink-0 md:w-[160px]">
            <div>
              <p className="text-xs text-muted-foreground">Chats:</p>
              <p className="text-lg font-bold text-foreground">{chatStats.totalChats}</p>
              <p className="text-[10px] text-muted-foreground">Média/Dia: {chatStats.avgChats}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atendimentos:</p>
              <p className="text-lg font-bold text-blue-500">{chatStats.totalAtend}</p>
              <p className="text-[10px] text-muted-foreground">Média/Dia: {chatStats.avgAtend}</p>
            </div>
          </div>
          <div className="flex-1 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChats ?? []}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend verticalAlign="top" height={30} />
                <Area type="monotone" dataKey="chats" name="Novos Chats" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="atendimentos" name="Novos Atendimentos" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══ Section 4: Messages - Last 7 Days ═══ */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Mensagens - Últimos 7 dias</h2>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="space-y-2 shrink-0 md:w-[160px]">
            <div>
              <p className="text-xs text-muted-foreground">Enviadas:</p>
              <p className="text-lg font-bold text-emerald-500">{msgStats.totalSent}</p>
              <p className="text-[10px] text-muted-foreground">Média/Dia: {msgStats.avgSent}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebidas:</p>
              <p className="text-lg font-bold text-blue-500">{msgStats.totalRecv}</p>
              <p className="text-[10px] text-muted-foreground">Média/Dia: {msgStats.avgRecv}</p>
            </div>
          </div>
          <div className="flex-1 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyMessages ?? []}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend verticalAlign="top" height={30} />
                <Bar dataKey="recebidas" name="Recebidas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="enviadas" name="Enviadas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══ Análise Avançada (Admin only) ═══ */}
      {!isAgent && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border pt-6 mt-2 gap-3">
            <h2 className="text-base font-semibold text-foreground">Análise Avançada</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                value={analyticsAgentId ?? ''}
                onChange={e => setAnalyticsAgentId(e.target.value || null)}
              >
                <option value="">Todos os agentes</option>
                {activeAgents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <DashboardDatePicker
                dateFrom={analyticsFrom}
                dateTo={analyticsTo}
                setDateFrom={setAnalyticsFrom}
                setDateTo={setAnalyticsTo}
              />
            </div>
          </div>

          <KPICards dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
          <AgentComparisonChart dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
          <ProjectBreakdown dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />

          <div className="grid md:grid-cols-2 gap-6">
            <ChannelDistribution dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
            <TagDistribution dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <HourlyHeatmap dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
            <HourlyResponseTime dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
          </div>
          <AgentRankingTable dateFrom={analyticsFromISO} dateTo={analyticsToISO} projectId={projectId} agentId={analyticsAgentId} />
        </>
      )}

    </div>
  );
}
