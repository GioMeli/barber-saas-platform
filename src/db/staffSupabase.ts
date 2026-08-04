import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isStaffRoute =
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/staff/') || window.location.pathname === '/staff-portal');
const employeeSessionId =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('employee')?.replace(/[^a-z0-9-]/gi, '').slice(0, 120)
    : null;

/**
 * Staff sessions use their own persistent storage key so an installed staff app
 * does not replace an owner/customer session opened in the normal Velliqo app.
 */
export const staffSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isStaffRoute,
    storageKey: `velliqo.staff.auth.${employeeSessionId || 'shared'}`,
  },
});
