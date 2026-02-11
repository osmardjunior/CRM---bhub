import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
}

export function useTeamProfiles() {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['team-profiles', companyId],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email, status')
        .eq('company_id', companyId!);
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rErr) throw rErr;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

      return (profiles ?? []).map(p => ({
        ...p,
        role: roleMap.get(p.id) ?? 'agent',
      })) as TeamMember[];
    },
    enabled: !!companyId,
  });
}
