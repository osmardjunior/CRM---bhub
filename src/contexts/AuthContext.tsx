import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: string | null;
  companyId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    // Run both queries in parallel — cuts initial load time in half
    const [{ data: profileData }, { data: roleData }, { data: { user: authUser } }] = await Promise.all([
      supabase.from('profiles').select('id, name, email, company_id, status, display_name, spy_mode, access_hours, custom_permissions, is_active, round_robin_weight, last_seen_at, allowed_integration_ids').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    // Block inactive users: sign them out immediately
    if (profileData && profileData.is_active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setLoading(false);
      return;
    }

    if (profileData) setProfile(profileData);

    // Use user_roles first; fall back to auth user_metadata.role for users
    // not yet inserted in user_roles (e.g. invited agents without a role row)
    const resolvedRole = roleData?.role ?? (authUser?.user_metadata?.role as string | undefined) ?? null;
    if (resolvedRole) setRole(resolvedRole);

    // Self-healing: if role came from metadata fallback (no user_roles row),
    // call the ensure-user-role function to fix the missing row silently.
    if (!roleData?.role && resolvedRole) {
      supabase.functions.invoke('ensure-user-role').catch(() => {});
    }

    // Only mark loading=false AFTER profile is ready — prevents race conditions
    // where spy_mode and other profile flags are read before they're populated.
    setLoading(false);
  };

  useEffect(() => {
    // SSO: absorver token vindo do portal ALL-IN via hash da URL
    const hash = window.location.hash
    if (hash.includes('type=portal_sso')) {
      const params = new URLSearchParams(hash.slice(1))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          // limpar hash após absorver
          history.replaceState(null, '', window.location.pathname)
        })
      }
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // setTimeout breaks out of the Supabase callback context to avoid deadlock
          setTimeout(() => fetchProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        fetchProfile(existingSession.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear last_seen_at before signing out → instant offline on Dashboard
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ last_seen_at: null })
        .eq('id', user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        companyId: profile?.company_id ?? null,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
