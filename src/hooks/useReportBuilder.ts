import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ReportType = 'chats' | 'messages' | 'users' | 'charts' | 'contacts';

export interface ReportFilters {
  includeTags?: string[];
  excludeTags?: string[];
  isArchived?: 'yes' | 'no' | 'any';
  hasUnreadMsg?: 'yes' | 'no' | 'any';
  status?: 'open' | 'closed' | 'pending' | 'new' | 'any';
  assignedUserIds?: string[];
  departmentIds?: string[];
  channels?: string[];
  botStatus?: 'active' | 'inactive' | 'any';
  funnelId?: string;
  stageId?: string;
  excludeFunnelId?: string;
  excludeStageId?: string;
  integrationIds?: string[];
  registeredLastDays?: number | null;
  registeredFrom?: string;
  registeredTo?: string;
  interactedLastDays?: number | null;
  daysWithoutInteraction?: number | null;
  daysWithoutReceiving?: number | null;
  daysWithoutSending?: number | null;
}

export interface SavedReport {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  report_type: ReportType;
  filters: ReportFilters;
  show_on_home: boolean;
  created_at: string;
  updated_at: string;
}

export function useSavedReports() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ['saved-reports', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('id, name, report_type, filters, show_on_home, created_at, updated_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedReport[];
    },
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  const { user, companyId } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      report_type: ReportType;
      filters: ReportFilters;
      show_on_home?: boolean;
    }) => {
      const { error } = await supabase.from('saved_reports').insert({
        name: payload.name,
        report_type: payload.report_type,
        filters: payload.filters as unknown as Record<string, unknown>,
        show_on_home: payload.show_on_home ?? false,
        created_by: user?.id,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Relatório salvo!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Relatório removido!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

const PAGE_SIZE = 25;

export function useReportQuery(
  reportType: ReportType,
  filters: ReportFilters,
  page: number,
  enabled: boolean,
) {
  const { companyId, user, role } = useAuth();
  // Non-admin users only see their own data
  const agentUserId = role !== 'admin' ? user?.id : undefined;

  return useQuery({
    queryKey: ['report-results', reportType, filters, page, agentUserId],
    enabled: enabled && !!companyId,
    queryFn: async () => {
      const offset = (page - 1) * PAGE_SIZE;

      if (reportType === 'chats') {
        return queryChats(filters, offset, companyId!, agentUserId);
      }
      if (reportType === 'messages') {
        return queryMessages(filters, offset, companyId!, agentUserId);
      }
      if (reportType === 'contacts') {
        return queryContacts(filters, offset, companyId!, agentUserId);
      }
      return { rows: [], total: 0 };
    },
  });
}

async function queryChats(filters: ReportFilters, offset: number, companyId: string, agentUserId?: string) {
  let query = supabase
    .from('conversations')
    .select('id, status, channel, assigned_user_id, department_id, chatbot_active, last_message_at, created_at, contact:contacts(id, name, phone, tags, created_at, last_contact_at)', { count: 'exact' })
    .eq('company_id', companyId);

  // Non-admin: force filter to only their assigned conversations
  if (agentUserId) {
    query = query.eq('assigned_user_id', agentUserId);
  } else if (filters.assignedUserIds && filters.assignedUserIds.length > 0) {
    query = query.in('assigned_user_id', filters.assignedUserIds);
  }

  if (filters.status && filters.status !== 'any') {
    query = query.eq('status', filters.status);
  }
  if (filters.channels && filters.channels.length > 0) {
    query = query.in('channel', filters.channels as ('whatsapp' | 'instagram' | 'webchat')[]);
  }
  if (filters.departmentIds && filters.departmentIds.length > 0) {
    query = query.in('department_id', filters.departmentIds);
  }
  if (filters.botStatus === 'active') {
    query = query.eq('chatbot_active', true);
  } else if (filters.botStatus === 'inactive') {
    query = query.eq('chatbot_active', false);
  }

  // Integration (phone number) filter
  if (filters.integrationIds && filters.integrationIds.length > 0) {
    query = query.in('integration_id', filters.integrationIds);
  }

  // Tag filters on contact — use JSONB @> operator via .contains()
  // Pass an array, not JSON.stringify (PostgREST handles serialization)
  if (filters.includeTags && filters.includeTags.length > 0) {
    for (const tag of filters.includeTags) {
      query = query.filter('contact.tags', 'cs', JSON.stringify([tag]));
    }
  }
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    for (const tag of filters.excludeTags) {
      query = query.filter('contact.tags', 'not.cs', JSON.stringify([tag]));
    }
  }

  // Date filters on contact
  if (filters.registeredFrom) {
    query = query.filter('contact.created_at', 'gte', filters.registeredFrom);
  }
  if (filters.registeredTo) {
    query = query.filter('contact.created_at', 'lte', filters.registeredTo);
  }
  if (filters.registeredLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.registeredLastDays);
    query = query.filter('contact.created_at', 'gte', d.toISOString());
  }

  // Interaction date filters (last_message_at on conversation)
  if (filters.interactedLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.interactedLastDays);
    query = query.gte('last_message_at', d.toISOString());
  }
  if (filters.daysWithoutInteraction) {
    const d = new Date();
    d.setDate(d.getDate() - filters.daysWithoutInteraction);
    query = query.lte('last_message_at', d.toISOString());
  }

  // Days without receiving (no incoming message from contact in X days)
  if (filters.daysWithoutReceiving) {
    const convIds = await getConversationsWithoutIncomingMessage(filters.daysWithoutReceiving);
    if (convIds.length === 0) return { rows: [], total: 0 };
    query = query.in('id', convIds);
  }

  // Days without sending (no outgoing message from agent in X days)
  if (filters.daysWithoutSending) {
    const convIds = await getConversationsWithoutOutgoingMessage(filters.daysWithoutSending);
    if (convIds.length === 0) return { rows: [], total: 0 };
    query = query.in('id', convIds);
  }

  query = query
    .order('last_message_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

async function queryMessages(filters: ReportFilters, offset: number, companyId: string, agentUserId?: string) {
  // First get conversation IDs matching filters, then fetch messages
  let convQuery = supabase
    .from('conversations')
    .select('id')
    .eq('company_id', companyId);

  // Non-admin: force filter to only their assigned conversations
  if (agentUserId) {
    convQuery = convQuery.eq('assigned_user_id', agentUserId);
  } else if (filters.assignedUserIds && filters.assignedUserIds.length > 0) {
    convQuery = convQuery.in('assigned_user_id', filters.assignedUserIds);
  }
  if (filters.channels && filters.channels.length > 0) {
    convQuery = convQuery.in('channel', filters.channels);
  }
  if (filters.status && filters.status !== 'any') {
    convQuery = convQuery.eq('status', filters.status);
  }
  if (filters.integrationIds && filters.integrationIds.length > 0) {
    convQuery = convQuery.in('integration_id', filters.integrationIds);
  }

  const { data: convRows, error: convErr } = await convQuery;
  if (convErr) throw convErr;
  const convIds = (convRows ?? []).map(c => c.id);
  if (convIds.length === 0) return { rows: [], total: 0 };

  let query = supabase
    .from('messages')
    .select('id, conversation_id, body, sender_type, sender_name, type, created_at', { count: 'exact' })
    .in('conversation_id', convIds);

  if (filters.registeredFrom) {
    query = query.gte('created_at', filters.registeredFrom);
  }
  if (filters.registeredTo) {
    query = query.lte('created_at', filters.registeredTo);
  }
  if (filters.registeredLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.registeredLastDays);
    query = query.gte('created_at', d.toISOString());
  }
  if (filters.interactedLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.interactedLastDays);
    query = query.gte('created_at', d.toISOString());
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  // Enrich with conversation + contact info
  const msgRows = data ?? [];
  if (msgRows.length === 0) return { rows: [], total: count ?? 0 };

  const uniqueConvIds = [...new Set(msgRows.map(m => m.conversation_id))];
  const { data: convData } = await supabase
    .from('conversations')
    .select('id, channel, status, contact:contacts(name, phone)')
    .in('id', uniqueConvIds);

  const convMap: Record<string, any> = {};
  for (const c of (convData ?? [])) {
    convMap[c.id] = c;
  }

  const enriched = msgRows.map(m => ({
    ...m,
    conversation: convMap[m.conversation_id] || null,
  }));

  return { rows: enriched, total: count ?? 0 };
}

async function queryContacts(filters: ReportFilters, offset: number, companyId: string, agentUserId?: string) {
  let query = supabase
    .from('contacts')
    .select('id, name, phone, phone_e164, email, tags, responsible_user_id, created_at, last_contact_at', { count: 'exact' })
    .eq('company_id', companyId);

  // Non-admin: force filter to only their responsible contacts
  if (agentUserId) {
    query = query.eq('responsible_user_id', agentUserId);
  } else if (filters.assignedUserIds && filters.assignedUserIds.length > 0) {
    query = query.in('responsible_user_id', filters.assignedUserIds);
  }

  // Tag filters — fix: pass array not JSON.stringify
  if (filters.includeTags && filters.includeTags.length > 0) {
    for (const tag of filters.includeTags) {
      query = query.contains('tags', [tag]);
    }
  }
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    for (const tag of filters.excludeTags) {
      query = query.filter('tags', 'not.cs', JSON.stringify([tag]));
    }
  }

  if (filters.registeredFrom) {
    query = query.gte('created_at', filters.registeredFrom);
  }
  if (filters.registeredTo) {
    query = query.lte('created_at', filters.registeredTo);
  }
  if (filters.registeredLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.registeredLastDays);
    query = query.gte('created_at', d.toISOString());
  }
  if (filters.daysWithoutInteraction) {
    const d = new Date();
    d.setDate(d.getDate() - filters.daysWithoutInteraction);
    query = query.lte('last_contact_at', d.toISOString());
  }
  if (filters.interactedLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.interactedLastDays);
    query = query.gte('last_contact_at', d.toISOString());
  }

  // Funnel/stage filter for contacts — filter by contact_funnel_stages
  if (filters.funnelId) {
    const contactIds = await getContactIdsByFunnel(filters.funnelId, filters.stageId);
    if (contactIds.length === 0) return { rows: [], total: 0 };
    query = query.in('id', contactIds);
  }

  // Exclude funnel — remove contacts that are in the specified funnel/stage
  if (filters.excludeFunnelId) {
    const excludeIds = await getContactIdsByFunnel(filters.excludeFunnelId, filters.excludeStageId);
    if (excludeIds.length > 0) {
      // Supabase doesn't have "not in" with arrays > 100, so we batch
      for (let i = 0; i < excludeIds.length; i += 100) {
        const batch = excludeIds.slice(i, i + 100);
        query = query.filter('id', 'not.in', `(${batch.join(',')})`);
      }
    }
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

// Fetch conversation IDs where the last incoming message (from contact) is older than X days
async function getConversationsWithoutIncomingMessage(days: number): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Limit lookback to 1 year to avoid loading the entire messages table
  const lookbackFrom = new Date();
  lookbackFrom.setFullYear(lookbackFrom.getFullYear() - 1);

  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .in('sender_type', ['user', 'contact'])
    .gte('created_at', lookbackFrom.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error || !data) return [];

  // Group by conversation_id and keep the latest incoming message per conversation
  const latestPerConv: Record<string, string> = {};
  for (const msg of data) {
    if (!latestPerConv[msg.conversation_id]) {
      latestPerConv[msg.conversation_id] = msg.created_at;
    }
  }

  // Return conversations where the latest incoming message is before the cutoff
  return Object.entries(latestPerConv)
    .filter(([, date]) => new Date(date) < cutoff)
    .map(([id]) => id);
}

// Fetch conversation IDs where the last outgoing message (from agent) is older than X days
async function getConversationsWithoutOutgoingMessage(days: number): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Limit lookback to 1 year to avoid loading the entire messages table
  const lookbackFrom = new Date();
  lookbackFrom.setFullYear(lookbackFrom.getFullYear() - 1);

  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, created_at')
    .eq('sender_type', 'agent')
    .gte('created_at', lookbackFrom.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error || !data) return [];

  const latestPerConv: Record<string, string> = {};
  for (const msg of data) {
    if (!latestPerConv[msg.conversation_id]) {
      latestPerConv[msg.conversation_id] = msg.created_at;
    }
  }

  return Object.entries(latestPerConv)
    .filter(([, date]) => new Date(date) < cutoff)
    .map(([id]) => id);
}

// Fetch contact IDs in a specific funnel (and optionally stage)
async function getContactIdsByFunnel(funnelId: string, stageId?: string): Promise<string[]> {
  let query = supabase
    .from('contact_funnel_stages')
    .select('contact_id')
    .eq('funnel_id', funnelId);

  if (stageId) {
    query = query.eq('stage_id', stageId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((r: any) => r.contact_id);
}
