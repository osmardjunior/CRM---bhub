import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
      const scores = (data ?? []).map((d) => d.score!);
      const total = scores.length;
      if (total === 0) return { nps: null, total: 0, label: 'Sem dados' };

      const promoters = scores.filter((s) => s >= 4).length;
      const detractors = scores.filter((s) => s <= 2).length;
      const nps = Math.round(((promoters - detractors) / total) * 100);

      return { nps, total, label: `${nps > 0 ? '+' : ''}${nps}` };
    },
  });
}
