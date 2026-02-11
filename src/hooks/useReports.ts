import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AgentMetric {
  agent_id: string;
  agent_name: string;
  conversations_handled: number;
  avg_first_response_seconds: number | null;
  avg_resolution_seconds: number | null;
  avg_nps: number | null;
}

export function useAgentMetrics(dateFrom: string, dateTo: string) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['agent-metrics', dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agent_metrics', {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return (data ?? []) as AgentMetric[];
    },
  });
}

export function usePipelineConversion(dateFrom: string, dateTo: string) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['pipeline-conversion', dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('stage')
        .gte('updated_at', dateFrom)
        .lte('updated_at', dateTo);

      if (error) throw error;
      const deals = data ?? [];
      const total = deals.length;
      const won = deals.filter((d) => d.stage === 'ganho').length;
      const lost = deals.filter((d) => d.stage === 'perdido').length;

      return { total, won, lost, conversionRate: total > 0 ? ((won / total) * 100).toFixed(1) : '0' };
    },
  });
}

export function useNPSSummary(dateFrom: string, dateTo: string) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['nps-summary', dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .not('score', 'is', null)
        .gte('answered_at', dateFrom)
        .lte('answered_at', dateTo);

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
