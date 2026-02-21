import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function calcNPS(scores: number[]) {
  const total = scores.length;
  if (total === 0) return { nps: null, total: 0, promoters: 0, passives: 0, detractors: 0 };
  // Standard NPS scale 0-10: promoters 9-10, passives 7-8, detractors 0-6
  // Our DB stores 1-5 scale: promoters >=4, passives =3, detractors <=2
  const promoters = scores.filter((s) => s >= 4).length;
  const detractors = scores.filter((s) => s <= 2).length;
  const passives = total - promoters - detractors;
  const nps = Math.round(((promoters - detractors) / total) * 100);
  return { nps, total, promoters, passives, detractors };
}

export function useNPSCard() {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['nps-card', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .not('score', 'is', null)
        .gte('answered_at', thirtyDaysAgo.toISOString());

      if (error) throw error;
      const scores = (data ?? []).map((d) => Number(d.score));
      const { nps, total } = calcNPS(scores);
      if (total === 0) return { nps: null, total: 0, label: 'Sem dados' };
      return { nps, total, label: `${nps! > 0 ? '+' : ''}${nps}` };
    },
  });
}

export function useNPSStats(dateFrom: string, dateTo: string) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['nps-stats', companyId, dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .not('score', 'is', null)
        .gte('answered_at', dateFrom)
        .lte('answered_at', dateTo);

      if (error) throw error;
      const scores = (data ?? []).map((d) => Number(d.score));
      return calcNPS(scores);
    },
  });
}

export function useNPSSurveys(dateFrom: string, dateTo: string) {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['nps-surveys', companyId, dateFrom, dateTo],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select(`
          id, score, comment, answered_at, sent_at,
          contact:contacts(name, phone),
          assigned_user:profiles!satisfaction_surveys_assigned_user_id_fkey(name)
        `)
        .gte('sent_at', dateFrom)
        .lte('sent_at', dateTo)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
