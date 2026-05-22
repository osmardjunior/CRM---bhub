import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';

export interface LeadsReportFilters {
  dateFrom: string;
  dateTo: string;
  agentId?: string;
  tagIds?: string[];
  funnelIds?: string[];
  stageIds?: string[];
  integrationId?: string;
  status?: string;
  search?: string;
  /** IDs from get_unread_conversation_ids RPC — undefined = no filter, [] = no unread */
  unreadIds?: string[];
  page: number;
  pageSize: number;
}

export interface LeadRow {
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  phone: string | null;
  status: string;
  agent_name: string | null;
  tags: { name: string; color: string | null }[];
  funnel_names: string[];
  stage_names: string[];
  created_at: string;
}

export interface AgentCount {
  agent_id: string;
  agent_name: string;
  total: number;
  new: number;
  open: number;
  pending: number;
  closed: number;
}

function hasAdvancedFilters(filters: LeadsReportFilters): boolean {
  return !!(
    (filters.funnelIds && filters.funnelIds.length > 0) ||
    (filters.stageIds && filters.stageIds.length > 0) ||
    (filters.tagIds && filters.tagIds.length > 0)
  );
}

/**
 * Uses existing RPCs to resolve contact IDs for tag/funnel/stage filters.
 */
async function getAdvancedContactIds(
  filters: LeadsReportFilters,
): Promise<{ include: string[] | null }> {
  let include: string[] | null = null;

  // --- INCLUDE: funnel filter ---
  if (filters.funnelIds?.length) {
    const { data, error } = await supabase.rpc('get_funnel_contact_ids_multi', {
      p_funnel_ids: filters.funnelIds,
      p_stage_ids: null,
    });
    if (error) throw error;
    const ids = (data ?? []).map((r: { contact_id: string }) => r.contact_id);
    include = include === null ? ids : include.filter(id => new Set(ids).has(id));
  }

  // --- INCLUDE: stage filter ---
  if (filters.stageIds?.length) {
    const { data, error } = await supabase.rpc('get_stage_contact_ids', {
      p_stage_ids: filters.stageIds,
    });
    if (error) throw error;
    const ids = (data ?? []).map((r: { contact_id: string }) => r.contact_id);
    include = include === null ? ids : include.filter(id => new Set(ids).has(id));
  }

  // --- INCLUDE: tag filter ---
  if (filters.tagIds?.length) {
    const { data } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', filters.tagIds);
    const ids = [...new Set((data ?? []).map(r => r.contact_id as string))];
    include = include === null ? ids : include.filter(id => new Set(ids).has(id));
  }

  return { include };
}

export function useLeadsReport(filters: LeadsReportFilters) {
  const { companyId, user, role } = useAuth();
  const { projectId } = useProjectContext();

  return useQuery({
    queryKey: ['leads-report', companyId, projectId, filters],
    enabled: !!companyId,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const useAdvanced = hasAdvancedFilters(filters);

      let convRows: { id: string; contact_id: string; status: string; assigned_user_id: string | null; created_at: string; contact: unknown }[] = [];
      let total = 0;

      // --- Unread filter: if unreadIds is defined and empty → no results ---
      if (filters.unreadIds !== undefined && filters.unreadIds.length === 0) {
        const agentCounts = await fetchAgentCounts(companyId!, filters, role!, user?.id, projectId);
        return { rows: [], total: 0, agentCounts };
      }

      // Build base query (used in both paths)
      const buildQuery = (includeContactIds: string[] | null) => {
        let q = supabase
          .from('conversations')
          .select('id, contact_id, status, assigned_user_id, created_at, contact:contacts!inner(id, name, phone, phone_e164)', { count: 'exact' })
          .eq('company_id', companyId!)
          .gte('created_at', filters.dateFrom)
          .lte('created_at', filters.dateTo);

        if (projectId) q = q.eq('project_id', projectId);

        if (role !== 'admin') {
          q = q.eq('assigned_user_id', user!.id);
        } else if (filters.agentId === '__unassigned__') {
          q = q.is('assigned_user_id', null);
        } else if (filters.agentId) {
          q = q.eq('assigned_user_id', filters.agentId);
        }

        if (filters.status) q = q.eq('status', filters.status);
        if (filters.integrationId) q = q.eq('integration_id', filters.integrationId);
        if (filters.search) {
          q = q.or(
            `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,phone_e164.ilike.%${filters.search}%`,
            { referencedTable: 'contacts' },
          );
        }

        // Contact ID filter (from tags/funnels/stages)
        if (includeContactIds !== null && includeContactIds.length > 0) {
          q = q.in('contact_id', includeContactIds);
        }

        // Unread filter: restrict to conversation IDs from RPC
        if (filters.unreadIds && filters.unreadIds.length > 0) {
          q = q.in('id', filters.unreadIds);
        }

        return q;
      };

      if (useAdvanced) {
        const { include } = await getAdvancedContactIds(filters);

        if (include !== null && include.length === 0) {
          const agentCounts = await fetchAgentCounts(companyId!, filters, role!, user?.id, projectId);
          return { rows: [], total: 0, agentCounts };
        }

        let query = buildQuery(include);
        query = query.order('created_at', { ascending: false });
        const offset = (filters.page - 1) * filters.pageSize;
        query = query.range(offset, offset + filters.pageSize - 1);

        const { data, error, count } = await query;
        if (error) throw error;
        convRows = (data ?? []) as typeof convRows;
        total = count ?? 0;

      } else {
        let query = buildQuery(null);
        query = query.order('created_at', { ascending: false });
        const offset = (filters.page - 1) * filters.pageSize;
        query = query.range(offset, offset + filters.pageSize - 1);

        const { data, error, count } = await query;
        if (error) throw error;
        convRows = (data ?? []) as typeof convRows;
        total = count ?? 0;
      }

      if (convRows.length === 0) {
        const agentCounts = await fetchAgentCounts(companyId!, filters, role!, user?.id, projectId);
        return { rows: [], total, agentCounts };
      }

      // Enrichment: agent names, tags, funnel/stage names
      const contactIds = [...new Set(convRows.map(r => r.contact_id))];
      const agentIds = [...new Set(convRows.map(r => r.assigned_user_id).filter(Boolean))] as string[];

      const nameMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', agentIds);
        for (const p of profiles ?? []) nameMap[p.id] = p.name || 'Sem nome';
      }

      const tagMap: Record<string, { name: string; color: string | null }[]> = {};
      if (contactIds.length > 0) {
        const { data: ctRows } = await supabase
          .from('contact_tags')
          .select('contact_id, tags:tag_id(name, color)')
          .in('contact_id', contactIds);
        for (const row of ctRows ?? []) {
          const cid = row.contact_id;
          if (!tagMap[cid]) tagMap[cid] = [];
          const tag = row.tags as { name: string; color: string | null } | null;
          if (tag?.name) tagMap[cid].push({ name: tag.name, color: tag.color });
        }
      }

      const funnelNamesMap: Record<string, string[]> = {};
      const stageNamesMap: Record<string, string[]> = {};
      if (contactIds.length > 0) {
        const { data: fsRows } = await supabase
          .from('contact_funnel_stages')
          .select('contact_id, funnel:funnel_id(name), stage:stage_id(label)')
          .in('contact_id', contactIds);
        for (const row of fsRows ?? []) {
          const cid = row.contact_id;
          const funnel = row.funnel as { name: string } | null;
          const stage = row.stage as { label: string } | null;
          if (funnel?.name) {
            if (!funnelNamesMap[cid]) funnelNamesMap[cid] = [];
            if (!funnelNamesMap[cid].includes(funnel.name)) funnelNamesMap[cid].push(funnel.name);
          }
          if (stage?.label) {
            if (!stageNamesMap[cid]) stageNamesMap[cid] = [];
            if (!stageNamesMap[cid].includes(stage.label)) stageNamesMap[cid].push(stage.label);
          }
        }
      }

      const rows: LeadRow[] = convRows.map((c) => {
        const contact = c.contact as { name?: string; phone_e164?: string; phone?: string } | null;
        return {
          conversation_id: c.id,
          contact_id: c.contact_id,
          contact_name: contact?.name || 'Sem nome',
          phone: contact?.phone_e164 || contact?.phone || null,
          status: c.status,
          agent_name: c.assigned_user_id ? (nameMap[c.assigned_user_id] || 'Sem nome') : 'Não Delegado',
          tags: tagMap[c.contact_id] ?? [],
          funnel_names: funnelNamesMap[c.contact_id] ?? [],
          stage_names: stageNamesMap[c.contact_id] ?? [],
          created_at: c.created_at,
        };
      });

      const agentCounts = await fetchAgentCounts(companyId!, filters, role!, user?.id, projectId);
      return { rows, total, agentCounts };
    },
  });
}

async function fetchAgentCounts(
  companyId: string,
  filters: LeadsReportFilters,
  role: string,
  userId?: string,
  projectId?: string | null,
): Promise<AgentCount[]> {
  let query = supabase
    .from('conversations')
    .select('assigned_user_id, status')
    .eq('company_id', companyId)
    .gte('created_at', filters.dateFrom)
    .lte('created_at', filters.dateTo);

  if (projectId) query = query.eq('project_id', projectId);
  if (role !== 'admin' && userId) query = query.eq('assigned_user_id', userId);
  if (filters.status) query = query.eq('status', filters.status);

  const PAGE = 1000;
  let allRows: { assigned_user_id: string | null; status: string }[] = [];
  let offset = 0;
  while (true) {
    const { data: batch } = await query.range(offset, offset + PAGE - 1);
    if (!batch || batch.length === 0) break;
    allRows = allRows.concat(batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
    query = supabase
      .from('conversations')
      .select('assigned_user_id, status')
      .eq('company_id', companyId)
      .gte('created_at', filters.dateFrom)
      .lte('created_at', filters.dateTo);
    if (projectId) query = query.eq('project_id', projectId);
    if (role !== 'admin' && userId) query = query.eq('assigned_user_id', userId);
    if (filters.status) query = query.eq('status', filters.status);
  }

  const countMap: Record<string, { total: number; new: number; open: number; pending: number; closed: number }> = {};
  const UNASSIGNED = '__unassigned__';

  for (const row of allRows) {
    const uid = row.assigned_user_id ?? UNASSIGNED;
    if (!countMap[uid]) countMap[uid] = { total: 0, new: 0, open: 0, pending: 0, closed: 0 };
    countMap[uid].total++;
    if (row.status === 'new') countMap[uid].new++;
    else if (row.status === 'open') countMap[uid].open++;
    else if (row.status === 'pending') countMap[uid].pending++;
    else if (row.status === 'closed') countMap[uid].closed++;
  }

  const agentIds = Object.keys(countMap).filter(id => id !== UNASSIGNED);
  const nameMap: Record<string, string> = {};
  if (agentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', agentIds);
    for (const p of profiles ?? []) nameMap[p.id] = p.name || 'Sem nome';
  }

  const result: AgentCount[] = [];
  if (countMap[UNASSIGNED]) {
    result.push({ agent_id: UNASSIGNED, agent_name: 'Não Delegado', ...countMap[UNASSIGNED] });
  }
  result.push(
    ...agentIds
      .map(id => ({ agent_id: id, agent_name: nameMap[id] || 'Sem nome', ...countMap[id] }))
      .sort((a, b) => b.total - a.total),
  );
  return result;
}
