import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Session, User } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [businessMemberships, setBusinessMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrate = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await fetchProfileAndMemberships(nextSession.user.id);
      } else {
        setProfile(null);
        setBusinessMemberships([]);
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfileAndMemberships = async (userId: string) => {
    setLoading(true);
    try {
      const [{ data: profileData, error: profileError }, { data: membershipsData, error: membershipsError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('business_members').select('*, businesses(*)').eq('user_id', userId),
      ]);

      if (profileError) console.error('Profile load failed:', profileError);
      if (membershipsError) console.error('Membership load failed:', membershipsError);

      setProfile(profileData ?? null);
      setBusinessMemberships(membershipsData ?? []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setBusinessMemberships([]);
    } finally {
      setLoading(false);
    }
  };

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
    refreshAuthData: user ? () => fetchProfileAndMemberships(user.id) : async () => undefined,
  };
}
