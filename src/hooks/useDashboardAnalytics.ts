import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Paginate any supabase query builder to avoid the 1000-row default limit. */
async function paginateAll<T>(
  buildQuery: (from: number, to: number) => ReturnType<typeof supabase.from>,
  pageSize = 5000,
): Promise<T[]> {
  let all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await (buildQuery(offset, offset + pageSize - 1) as unknown as Promise<{ data: T[] | null }>);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

/* ── Tag Distribution ── */

export interface TagDistItem {
  tag_name: string;
  tag_color: string;
  count: number;
}

export function useTagDistribution(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['tag-distribution', companyId, dateFrom, dateTo, projectId, agentId],
    enabled: !!companyId,
    staleTime: 120_000,
    queryFn: async () => {
      // Get contact_ids from conversations in the period (paginated)
      const convRows = await paginateAll<{ contact_id: string }>((from, to) => {
        let q = supabase
          .from('conversations')
          .select('contact_id')
          .eq('company_id', companyId!)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .range(from, to);
        if (projectId) q = q.eq('project_id', projectId);
        if (agentId) q = q.eq('assigned_user_id', agentId);
        return q as unknown as ReturnType<typeof supabase.from>;
      });
      const contactIds = [...new Set(convRows.map(c => c.contact_id))];
      if (contactIds.length === 0) return [];

      // Get tags for these contacts in batches (paginated within each batch)
      const ctRows: { tag_id: string; tags: unknown }[] = [];
      for (let i = 0; i < contactIds.length; i += 300) {
        const batch = contactIds.slice(i, i + 300);
        // Paginate within each batch to avoid 1000-row limit on contact_tags
        let offset = 0;
        const TPAGE = 2000;
        while (true) {
          let tq = supabase
            .from('contact_tags')
            .select('tag_id, tags:tag_id!inner(name, color, project_id)')
            .in('contact_id', batch)
            .range(offset, offset + TPAGE - 1);
          if (projectId) {
            tq = tq.or(`project_id.eq.${projectId},project_id.is.null`, { referencedTable: 'tags' });
          }
          const { data } = await tq;
          if (!data || data.length === 0) break;
          ctRows.push(...data);
          if (data.length < TPAGE) break;
          offset += TPAGE;
        }
      }

      const countMap: Record<string, { name: string; color: string; count: number }> = {};
      for (const row of ctRows ?? []) {
        const tag = row.tags as unknown as { name: string; color: string | null; project_id: string | null } | null;
        if (!tag?.name) continue;
        const tid = row.tag_id;
        if (!countMap[tid]) countMap[tid] = { name: tag.name, color: tag.color || '#64748b', count: 0 };
        countMap[tid].count++;
      }

      return Object.values(countMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(t => ({ tag_name: t.name, tag_color: t.color, count: t.count }));
    },
  });
}

/* ── Hourly Heatmap ── */

export interface HeatmapCell {
  hour: number;
  dayOfWeek: number;
  count: number;
}

export function useHourlyHeatmap(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['hourly-heatmap', companyId, dateFrom, dateTo, projectId, agentId],
    enabled: !!companyId,
    staleTime: 120_000,
    queryFn: async () => {
      // If project or agent filtered, get conversation IDs first (paginated)
      let convFilter: string[] | null = null;
      if (projectId || agentId) {
        const convRows = await paginateAll<{ id: string }>((from, to) => {
          let q = supabase.from('conversations').select('id')
            .eq('company_id', companyId!).range(from, to);
          if (projectId) q = q.eq('project_id', projectId);
          if (agentId) q = q.eq('assigned_user_id', agentId);
          return q as unknown as ReturnType<typeof supabase.from>;
        });
        convFilter = convRows.map(c => c.id);
        if (convFilter.length === 0) return [];
      }

      // Paginate messages
      const allMsgs: { created_at: string }[] = [];
      const msgBatches = convFilter ? [] as string[][] : [null];
      if (convFilter) {
        for (let i = 0; i < convFilter.length; i += 500) {
          msgBatches.push(convFilter.slice(i, i + 500));
        }
      }
      for (const batch of msgBatches) {
        const batchMsgs = await paginateAll<{ created_at: string }>((from, to) => {
          let mq = supabase.from('messages').select('created_at')
            .eq('company_id', companyId!)
            .gte('created_at', dateFrom).lte('created_at', dateTo)
            .is('deleted_at', null).range(from, to);
          if (batch) mq = mq.in('conversation_id', batch);
          return mq as unknown as ReturnType<typeof supabase.from>;
        });
        allMsgs.push(...batchMsgs);
      }
      const data = allMsgs;

      // Group by hour and day of week
      const grid: Record<string, number> = {};
      for (const row of data ?? []) {
        const d = new Date(row.created_at);
        const hour = d.getHours();
        const dow = d.getDay(); // 0=Sun
        const key = `${dow}-${hour}`;
        grid[key] = (grid[key] || 0) + 1;
      }

      const cells: HeatmapCell[] = [];
      for (let dow = 0; dow < 7; dow++) {
        for (let hour = 0; hour < 24; hour++) {
          cells.push({ hour, dayOfWeek: dow, count: grid[`${dow}-${hour}`] || 0 });
        }
      }
      return cells;
    },
  });
}

/* ── Project Metrics ── */

export interface ProjectMetric {
  project_id: string;
  project_name: string;
  total: number;
  new: number;
  open: number;
  pending: number;
  closed: number;
}

export function useProjectMetrics(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['project-metrics', companyId, dateFrom, dateTo, projectId, agentId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      // Get all conversations in date range (paginated)
      const convs = await paginateAll<{ project_id: string; status: string }>((from, to) => {
        let q = supabase.from('conversations')
          .select('project_id, status')
          .eq('company_id', companyId!)
          .gte('created_at', dateFrom).lte('created_at', dateTo)
          .not('project_id', 'is', null).range(from, to);
        if (projectId) q = q.eq('project_id', projectId);
        if (agentId) q = q.eq('assigned_user_id', agentId);
        return q as unknown as ReturnType<typeof supabase.from>;
      });

      if (convs.length === 0) return [];

      // Group by project
      const map: Record<string, { total: number; new: number; open: number; pending: number; closed: number }> = {};
      for (const c of convs) {
        const pid = c.project_id!;
        if (!map[pid]) map[pid] = { total: 0, new: 0, open: 0, pending: 0, closed: 0 };
        map[pid].total++;
        if (c.status === 'new') map[pid].new++;
        else if (c.status === 'open') map[pid].open++;
        else if (c.status === 'pending') map[pid].pending++;
        else if (c.status === 'closed' || c.status === 'resolved') map[pid].closed++;
      }

      // Get project names
      const projectIds = Object.keys(map);
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      const nameMap: Record<string, string> = {};
      for (const p of projects ?? []) nameMap[p.id] = p.name;

      return projectIds
        .map(id => ({
          project_id: id,
          project_name: nameMap[id] || 'Sem nome',
          ...map[id],
        }))
        .sort((a, b) => b.total - a.total);
    },
  });
}

/* ── Hourly Response Time ── */

export interface HourlyResponseItem {
  hour: number;
  avgMinutes: number;
  count: number;
}

export function useHourlyResponseTime(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['hourly-response-time', companyId, dateFrom, dateTo, projectId, agentId],
    enabled: !!companyId,
    staleTime: 120_000,
    queryFn: async () => {
      // Get conversations in period
      const convs = await paginateAll<{ id: string }>((from, to) => {
        let q = supabase.from('conversations').select('id')
          .eq('company_id', companyId!)
          .gte('created_at', dateFrom).lte('created_at', dateTo)
          .range(from, to);
        if (projectId) q = q.eq('project_id', projectId);
        if (agentId) q = q.eq('assigned_user_id', agentId);
        return q as unknown as ReturnType<typeof supabase.from>;
      });

      if (convs.length === 0) return [];
      const convIds = convs.map(c => c.id);

      // Fetch messages in batches (sender_type, created_at, conversation_id)
      const allMsgs: { conversation_id: string; sender_type: string; created_at: string }[] = [];
      for (let i = 0; i < convIds.length; i += 500) {
        const batch = convIds.slice(i, i + 500);
        const msgs = await paginateAll<{ conversation_id: string; sender_type: string; created_at: string }>((from, to) =>
          supabase.from('messages')
            .select('conversation_id, sender_type, created_at')
            .eq('company_id', companyId!)
            .in('conversation_id', batch)
            .gte('created_at', dateFrom).lte('created_at', dateTo)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .range(from, to) as unknown as ReturnType<typeof supabase.from>
        );
        allMsgs.push(...msgs);
      }

      // Group by conversation and compute response times
      const byConv: Record<string, typeof allMsgs> = {};
      for (const m of allMsgs) {
        (byConv[m.conversation_id] ??= []).push(m);
      }

      // For each conversation, find pairs: last user msg → first agent response
      const hourBuckets: Record<number, { totalMinutes: number; count: number }> = {};
      for (const msgs of Object.values(byConv)) {
        for (let j = 0; j < msgs.length; j++) {
          if (msgs[j].sender_type === 'user') {
            // Find next agent message
            for (let k = j + 1; k < msgs.length; k++) {
              if (msgs[k].sender_type === 'agent' || msgs[k].sender_type === 'admin') {
                const userTime = new Date(msgs[j].created_at);
                const agentTime = new Date(msgs[k].created_at);
                const diffMinutes = (agentTime.getTime() - userTime.getTime()) / 60000;
                if (diffMinutes >= 0 && diffMinutes < 1440) { // Cap at 24h
                  const hour = userTime.getHours();
                  if (!hourBuckets[hour]) hourBuckets[hour] = { totalMinutes: 0, count: 0 };
                  hourBuckets[hour].totalMinutes += diffMinutes;
                  hourBuckets[hour].count++;
                }
                j = k - 1; // Skip to agent msg
                break;
              }
            }
          }
        }
      }

      const result: HourlyResponseItem[] = [];
      for (let h = 0; h < 24; h++) {
        const bucket = hourBuckets[h];
        result.push({
          hour: h,
          avgMinutes: bucket ? Math.round(bucket.totalMinutes / bucket.count) : 0,
          count: bucket?.count ?? 0,
        });
      }
      return result;
    },
  });
}

/* ── Avg Messages Per Conversation ── */

export function useAvgMessagesPerConversation(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['avg-msgs-per-conv', companyId, dateFrom, dateTo, projectId, agentId],
    enabled: !!companyId,
    staleTime: 120_000,
    queryFn: async () => {
      // Count conversations
      let cq = supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);
      if (projectId) cq = cq.eq('project_id', projectId);
      const { count: convCount } = await cq;

      if (!convCount || convCount === 0) return 0;

      // Count messages
      let mq = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .is('deleted_at', null);

      if (projectId) {
        // Get conv IDs for project (paginated)
        const convRows = await paginateAll<{ id: string }>((from, to) =>
          supabase.from('conversations').select('id')
            .eq('company_id', companyId!).eq('project_id', projectId)
            .range(from, to) as unknown as ReturnType<typeof supabase.from>
        );
        const convIds = convRows.map(c => c.id);
        if (convIds.length === 0) return 0;
        mq = mq.in('conversation_id', convIds.slice(0, 500));
      }

      const { count: msgCount } = await mq;
      return Number(((msgCount || 0) / convCount).toFixed(1));
    },
  });
}
