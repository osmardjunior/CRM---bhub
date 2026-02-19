import { useState, useCallback } from 'react';
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
  status?: 'open' | 'closed' | 'pending' | 'any';
  assignedUserIds?: string[];
  departmentIds?: string[];
  channels?: string[];
  botStatus?: 'active' | 'inactive' | 'any';
  funnelId?: string;
  stageId?: string;
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
  return useQuery({
    queryKey: ['saved-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedReport[];
    },
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  const { user } = useAuth();

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
        filters: payload.filters as any,
        show_on_home: payload.show_on_home ?? false,
        created_by: user?.id,
      } as any);
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
  return useQuery({
    queryKey: ['report-results', reportType, filters, page],
    enabled,
    queryFn: async () => {
      const offset = (page - 1) * PAGE_SIZE;

      if (reportType === 'chats') {
        return queryChats(filters, offset);
      }
      if (reportType === 'contacts' || reportType === 'messages') {
        return queryContacts(filters, offset);
      }
      return { rows: [], total: 0 };
    },
  });
}

async function queryChats(filters: ReportFilters, offset: number) {
  let query = supabase
    .from('conversations')
    .select('*, contact:contacts!inner(*)', { count: 'exact' });

  if (filters.status && filters.status !== 'any') {
    query = query.eq('status', filters.status);
  }
  if (filters.channels && filters.channels.length > 0) {
    query = query.in('channel', filters.channels as ('whatsapp' | 'instagram' | 'webchat')[]);
  }
  if (filters.assignedUserIds && filters.assignedUserIds.length > 0) {
    query = query.in('assigned_user_id', filters.assignedUserIds);
  }
  if (filters.botStatus === 'active') {
    query = query.eq('chatbot_active', true);
  } else if (filters.botStatus === 'inactive') {
    query = query.eq('chatbot_active', false);
  }

  // Tag filters on contact
  if (filters.includeTags && filters.includeTags.length > 0) {
    for (const tag of filters.includeTags) {
      query = query.contains('contact.tags', JSON.stringify([tag]));
    }
  }

  // Date filters on contact
  if (filters.registeredFrom) {
    query = query.gte('contact.created_at', filters.registeredFrom);
  }
  if (filters.registeredTo) {
    query = query.lte('contact.created_at', filters.registeredTo);
  }
  if (filters.registeredLastDays) {
    const d = new Date();
    d.setDate(d.getDate() - filters.registeredLastDays);
    query = query.gte('contact.created_at', d.toISOString());
  }

  // Interaction date filters
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

  query = query
    .order('last_message_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

async function queryContacts(filters: ReportFilters, offset: number) {
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' });

  if (filters.includeTags && filters.includeTags.length > 0) {
    for (const tag of filters.includeTags) {
      query = query.contains('tags', JSON.stringify([tag]));
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
  if (filters.assignedUserIds && filters.assignedUserIds.length > 0) {
    query = query.in('responsible_user_id', filters.assignedUserIds);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}
