import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AccessHours = {
  enabled: boolean;
  intervals: { start: string; end: string }[];
  blocked_days: number[];
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  display_name: string | null;
  spy_mode: boolean;
  access_hours: AccessHours;
  custom_permissions: Record<string, boolean>;
  is_active: boolean;
  round_robin_weight: number;
  last_seen_at: string | null;
}

export function useTeamProfiles() {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['team-profiles', companyId],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email, status, display_name, spy_mode, access_hours, custom_permissions, is_active, round_robin_weight, last_seen_at')
        .eq('company_id', companyId!);
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rErr) throw rErr;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

      return (profiles ?? []).map(p => ({
        ...p,
        display_name: p.display_name ?? null,
        spy_mode: (p as any).spy_mode ?? false,
        access_hours: ((p as any).access_hours ?? { enabled: false, intervals: [], blocked_days: [] }) as AccessHours,
        custom_permissions: ((p as any).custom_permissions ?? {}) as Record<string, boolean>,
        is_active: (p as any).is_active !== false,
        round_robin_weight: (p as any).round_robin_weight ?? 1,
        last_seen_at: (p as any).last_seen_at ?? null,
        role: roleMap.get(p.id) ?? 'agent',
      })) as TeamMember[];
    },
    enabled: !!companyId,
  });
}
