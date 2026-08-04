import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { staffSupabase } from '@/db/staffSupabase';

export function useStaffAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    void staffSupabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Unable to restore staff session', error);
      applySession(data.session);
    });

    const {
      data: { subscription },
    } = staffSupabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading };
}
