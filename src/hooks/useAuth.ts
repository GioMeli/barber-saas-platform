import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [businessMemberships, setBusinessMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const hydratedUserIdRef = useRef<string | null>(null);

  const fetchProfileAndMemberships = useCallback(async (userId: string, blocking = false) => {
    if (blocking) setLoading(true);
    try {
      const [{ data: profileData, error: profileError }, { data: membershipsData, error: membershipsError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('business_members').select('*, businesses(*)').eq('user_id', userId),
      ]);

      if (!mountedRef.current) return;
      if (profileError) console.error('Profile load failed:', profileError);
      if (membershipsError) console.error('Membership load failed:', membershipsError);

      setProfile(profileData ?? null);
      setBusinessMemberships(membershipsData ?? []);
      hydratedUserIdRef.current = userId;
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (mountedRef.current && blocking) setBusinessMemberships([]);
    } finally {
      if (mountedRef.current && blocking) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const hydrate = async (nextSession: Session | null, event?: string) => {
      if (!mountedRef.current) return;
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const sameHydratedUser = Boolean(nextUserId && hydratedUserIdRef.current === nextUserId);

      setSession(nextSession);
      setUser(nextUser);

      if (!nextUser) {
        hydratedUserIdRef.current = null;
        setProfile(null);
        setBusinessMemberships([]);
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED and tab-focus session recovery must never unmount the Owner
      // workspace. Background revalidation preserves open forms and unsaved React state.
      const backgroundRefresh = sameHydratedUser && event !== 'SIGNED_IN' && event !== 'USER_UPDATED';
      await fetchProfileAndMemberships(nextUser.id, !backgroundRefresh);
      if (backgroundRefresh && mountedRef.current) setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session, 'INITIAL_SESSION'));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void hydrate(nextSession, event);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndMemberships]);

  const activeMembership = businessMemberships[0] ?? null;
  const activeBusiness = activeMembership?.businesses ?? null;

  return {
    session,
    user,
    profile,
    businessMemberships,
    activeMembership,
    activeBusiness,
    loading,
    refreshAuthData: user ? () => fetchProfileAndMemberships(user.id, false) : async () => undefined,
  };
}
