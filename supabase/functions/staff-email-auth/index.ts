import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  business_slug?: string;
  employee_id?: string;
  email?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = (await request.json()) as RequestBody;
    const businessSlug = clean(body.business_slug, 120).toLowerCase();
    const employeeId = clean(body.employee_id, 120);
    const email = clean(body.email, 320).toLowerCase();

    if (!businessSlug || !employeeId || !email) return json({ error: 'Invalid staff sign-in request' }, 400);
    if (!/^[a-z0-9-]{2,120}$/i.test(businessSlug) || !/^[a-z0-9-]{2,120}$/i.test(employeeId)) {
      return json({ error: 'Invalid staff sign-in request' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('id,business_id,user_id,email,is_active,personal_access_enabled,personal_access_status,businesses(slug,status)')
      .eq('id', employeeId)
      .maybeSingle();

    const business = employee && (Array.isArray(employee.businesses) ? employee.businesses[0] : employee.businesses);
    const approved = Boolean(
      !employeeError && employee && business &&
      business.status === 'active' &&
      String(business.slug || '').toLowerCase() === businessSlug &&
      employee.is_active &&
      employee.personal_access_enabled &&
      ['invited', 'active'].includes(String(employee.personal_access_status)) &&
      employee.user_id &&
      String(employee.email || '').trim().toLowerCase() === email
    );

    if (!approved || !employee?.user_id) {
      // Deliberately generic so this endpoint cannot be used to enumerate staff accounts.
      return json({ error: 'This email is not approved for this staff app' }, 401);
    }

    const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(employee.user_id);
    const authUser = authUserResult?.user;
    if (authUserError || !authUser || String(authUser.email || '').trim().toLowerCase() !== email) {
      return json({ error: 'This email is not approved for this staff app' }, 401);
    }

    let authenticated = false;
    const authHeader = request.headers.get('Authorization') ?? '';
    if (authHeader.startsWith('Bearer ') && SUPABASE_ANON_KEY) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: currentUserData } = await userClient.auth.getUser();
      authenticated = Boolean(
        currentUserData.user &&
        currentUserData.user.id === employee.user_id &&
        String(currentUserData.user.email || '').trim().toLowerCase() === email
      );
    }

    return json({
      ok: true,
      authenticated,
      account_confirmed: Boolean(authUser.email_confirmed_at),
      requires_email_verification: !authenticated,
    });
  } catch (error) {
    console.error('staff-email-auth failed', error);
    return json({ error: 'Unable to verify staff email' }, 500);
  }
});

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
