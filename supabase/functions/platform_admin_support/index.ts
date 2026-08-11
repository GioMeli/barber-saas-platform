import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401);

    const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
    if (profile?.role !== 'Platform Admin') return json({ error: 'Platform Admin access required' }, 403);

    const body = await request.json();
    const action = String(body.action ?? '');
    const businessId = String(body.businessId ?? '').trim();
    if (!businessId) return json({ error: 'Business is required' }, 400);

    if (action === 'update_owner_email') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Valid email is required' }, 400);

      const { data: member } = await admin.from('business_members').select('user_id').eq('business_id', businessId).eq('role', 'Owner').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (!member?.user_id) return json({ error: 'Business owner not found' }, 404);

      const { data: beforeProfile } = await admin.from('profiles').select('email').eq('id', member.user_id).maybeSingle();
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(member.user_id, { email, email_confirm: true } as any);
      if (updateAuthError) throw updateAuthError;

      const { error: profileError } = await admin.from('profiles').update({ email, updated_at: new Date().toISOString() }).eq('id', member.user_id);
      if (profileError) throw profileError;

      await admin.from('platform_admin_audit_logs').insert({
        actor_id: authData.user.id,
        business_id: businessId,
        action: 'owner_auth_email_update',
        target_type: 'profile',
        target_id: member.user_id,
        before_state: { email: beforeProfile?.email ?? null },
        after_state: { email },
      });

      return json({ ok: true, email });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    console.error('platform_admin_support failed', error);
    return json({ error: error instanceof Error ? error.message : 'Support action failed' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
