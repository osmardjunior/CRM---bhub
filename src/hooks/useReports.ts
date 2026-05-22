import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAreaUserIds } from '@/lib/areaFilter';

export interface AgentMetric {
  agent_id: string;
  agent_name: string;
  conversations_handled: number;
  avg_first_response_seconds: number | null;
  avg_resolution_seconds: number | null;
  avg_nps: number | null;
}

export function useAgentMetrics(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId, user, role } = useAuth();

  return useQuery({
    queryKey: ['agent-metrics', companyId, dateFrom, dateTo, role, user?.id, projectId, agentId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agent_metrics', {
        date_from: dateFrom,
        date_to: dateTo,
        p_project_id: projectId || null,
      } as Record<string, unknown>);
      if (error) throw error;
      let all = (data ?? []) as AgentMetric[];
      // Filter by specific agent if provided
      if (agentId) {
        return all.filter(a => a.agent_id === agentId);
      }
      // Non-admin: only show own metrics
      if (role !== 'admin' && user?.id) {
        return all.filter(a => a.agent_id === user.id);
      }
      return all;
    },
  });
}

export function usePipelineConversion(dateFrom: string, dateTo: string, agentId?: string | null) {
  const { companyId, user, role } = useAuth();

  return useQuery({
    queryKey: ['pipeline-conversion', companyId, dateFrom, dateTo, role, user?.id, agentId],
    enabled: !!companyId,
    queryFn: async () => {
      // Paginate to avoid 1000-row limit
      let deals: { stage: string }[] = [];
      let from = 0;
      const PAGE = 5000;
      while (true) {
        let q = supabase.from('deals').select('stage')
          .eq('company_id', companyId!)
          .gte('updated_at', dateFrom).lte('updated_at', dateTo)
          .range(from, from + PAGE - 1);
        if (agentId) q = q.eq('assigned_user_id', agentId);
        else if (role !== 'admin' && user?.id) q = q.eq('assigned_user_id', user.id);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        deals = deals.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const total = deals.length;
      const won = deals.filter((d) => d.stage === 'ganho').length;
      const lost = deals.filter((d) => d.stage === 'perdido').length;

      return { total, won, lost, conversionRate: total > 0 ? ((won / total) * 100).toFixed(1) : '0' };
    },
  });
}

export function useChannelVolume(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId, user, role } = useAuth();

  return useQuery({
    queryKey: ['channel-volume', companyId, dateFrom, dateTo, role, user?.id, projectId, agentId],
    enabled: !!companyId,
    queryFn: async () => {
      // Paginate to avoid 1000-row limit
      let rows: { channel: string | null }[] = [];
      let from = 0;
      const PAGE = 5000;
      while (true) {
        let q = supabase.from('conversations').select('channel')
          .eq('company_id', companyId!)
          .gte('created_at', dateFrom).lte('created_at', dateTo)
          .range(from, from + PAGE - 1);
        if (projectId) q = q.eq('project_id', projectId);
        if (agentId) q = q.eq('assigned_user_id', agentId);
        else if (role !== 'admin' && user?.id) q = q.eq('assigned_user_id', user.id);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows = rows.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const ch = r.channel || 'outros';
        counts[ch] = (counts[ch] || 0) + 1;
      }
      const colorMap: Record<string, string> = {
        whatsapp: '#25D366',
        instagram: '#E1306C',
        webchat: '#3b82f6',
        telegram: '#0088cc',
        email: '#ea580c',
        outros: '#64748b',
      };
      return Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: colorMap[name] || '#64748b',
      }));
    },
  });
}

export interface LeadPerAgent {
  agent_id: string;
  agent_name: string;
  total: number;
  new: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;
}

export function useLeadsPerAgent(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId, user, role } = useAuth();

  return useQuery({
    queryKey: ['leads-per-agent', companyId, dateFrom, dateTo, role, user?.id, projectId, agentId],
    enabled: !!companyId,
    queryFn: async () => {
      // Paginate ALL conversations (including unassigned) to avoid 1000-row limit
      let allData: { assigned_user_id: string | null; status: string }[] = [];
      let from = 0;
      const PAGE = 5000;
      while (true) {
        let q = supabase.from('conversations')
          .select('assigned_user_id, status')
          .eq('company_id', companyId!)
          .gte('created_at', dateFrom).lte('created_at', dateTo)
          .range(from, from + PAGE - 1);
        if (projectId) q = q.eq('project_id', projectId);
        if (agentId) q = q.eq('assigned_user_id', agentId);
        else if (role !== 'admin' && user?.id) q = q.eq('assigned_user_id', user.id);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const NONE = '__unassigned__';
      const map: Record<string, { total: number; new: number; open: number; pending: number; resolved: number; closed: number }> = {};
      for (const row of allData) {
        const uid = row.assigned_user_id ?? NONE;
        if (!map[uid]) map[uid] = { total: 0, new: 0, open: 0, pending: 0, resolved: 0, closed: 0 };
        map[uid].total++;
        if (row.status === 'new') map[uid].new++;
        else if (row.status === 'open') map[uid].open++;
        else if (row.status === 'pending') map[uid].pending++;
        else if (row.status === 'resolved') map[uid].resolved++;
        else if (row.status === 'closed') map[uid].closed++;
      }

      // Fetch active agents from this area (not just those with conversations)
      const areaUserIds = await getAreaUserIds();
      let profileQuery = supabase.from('profiles').select('id, name').eq('company_id', companyId!).eq('is_active', true);
      if (areaUserIds) profileQuery = profileQuery.in('id', areaUserIds);
      // If project filtered, only show agents in that project
      if (projectId) {
        const { data: members } = await supabase.from('user_projects').select('user_id').eq('project_id', projectId).eq('active', true);
        const memberIds = (members ?? []).map(m => m.user_id);
        if (memberIds.length > 0) profileQuery = profileQuery.in('id', memberIds);
      }
      const { data: profiles } = await profileQuery;

      const nameMap: Record<string, string> = {};
      for (const p of profiles ?? []) {
        nameMap[p.id] = p.name || 'Sem nome';
        // Ensure every active agent has an entry even with 0 conversations
        if (!map[p.id]) map[p.id] = { total: 0, new: 0, open: 0, pending: 0, resolved: 0, closed: 0 };
      }

      const result: LeadPerAgent[] = [];

      // Add unassigned first if exists
      if (map[NONE]) {
        result.push({ agent_id: NONE, agent_name: 'Não Delegado', ...map[NONE] });
      }

      // Add all agents sorted by total desc
      const agentIds = Object.keys(map).filter(id => id !== NONE);
      result.push(
        ...agentIds
          .map((id) => ({
            agent_id: id,
            agent_name: nameMap[id] || 'Sem nome',
            ...map[id],
          }))
          .sort((a, b) => b.total - a.total)
      );

      return result;
    },
  });
}

export function useNPSSummary(dateFrom: string, dateTo: string, projectId?: string | null, agentId?: string | null) {
  const { companyId, user, role } = useAuth();

  return useQuery({
    queryKey: ['nps-summary', companyId, dateFrom, dateTo, role, user?.id, projectId, agentId],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('satisfaction_surveys')
        .select('score, conversation_id')
        .eq('company_id', companyId!)
        .not('score', 'is', null)
        .gte('answered_at', dateFrom)
        .lte('answered_at', dateTo);

      // Project/agent filter or non-admin: filter via conversation IDs (paginated)
      if (projectId || agentId || (role !== 'admin' && user?.id)) {
        let allConvIds: string[] = [];
        let from = 0;
        const PAGE = 5000;
        while (true) {
          let cq = supabase.from('conversations').select('id').eq('company_id', companyId!).range(from, from + PAGE - 1);
          if (projectId) cq = cq.eq('project_id', projectId);
          if (agentId) cq = cq.eq('assigned_user_id', agentId);
          else if (role !== 'admin' && user?.id) cq = cq.eq('assigned_user_id', user.id);
          const { data: convRows } = await cq;
          if (!convRows || convRows.length === 0) break;
          allConvIds = allConvIds.concat(convRows.map(c => c.id));
          if (convRows.length < PAGE) break;
          from += PAGE;
        }
        if (allConvIds.length === 0) return { nps: null, promoters: 0, detractors: 0, total: 0 };
        query = query.in('conversation_id', allConvIds.slice(0, 500));
      }

      const { data, error } = await query;
      if (error) throw error;
      const scores = (data ?? []).map((d) => d.score!);
      const total = scores.length;
      if (total === 0) return { nps: null, promoters: 0, detractors: 0, total: 0 };

      const promoters = scores.filter((s) => s >= 4).length;
      const detractors = scores.filter((s) => s <= 2).length;
      const nps = Math.round(((promoters - detractors) / total) * 100);

      return { nps, promoters, detractors, total };
    },
  });
}
