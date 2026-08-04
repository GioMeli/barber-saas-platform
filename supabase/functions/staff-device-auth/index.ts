import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? '').replace(/\/$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  business_slug?: string;
  employee_id?: string;
  email?: string;
  device_id?: string;
  device_secret?: string;
  origin?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = (await request.json()) as RequestBody;
    const businessSlug = clean(body.business_slug, 120).toLowerCase();
    const employeeId = clean(body.employee_id, 120);
    const email = clean(body.email, 320).toLowerCase();
    const deviceId = clean(body.device_id, 160);
    const deviceSecret = clean(body.device_secret, 256);

    if (!businessSlug || !employeeId || !email || !deviceId || !deviceSecret) {
      return json({ error: 'Missing trusted-device credentials' }, 400);
    }
    if (!/^[a-z0-9-]{2,120}$/i.test(businessSlug) || !/^[a-z0-9-]{2,120}$/i.test(employeeId)) {
      return json({ error: 'Invalid staff app identifier' }, 400);
    }
    if (!/^[A-Za-z0-9_-]{12,160}$/.test(deviceId) || !/^[A-Za-z0-9_-]{32,256}$/.test(deviceSecret)) {
      return json({ error: 'Invalid trusted-device credential' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('id,business_id,user_id,name,email,is_active,personal_access_enabled,personal_access_status,businesses(name,slug,status)')
      .eq('id', employeeId)
      .maybeSingle();

    const business = employee && (Array.isArray(employee.businesses) ? employee.businesses[0] : employee.businesses);
    if (
      employeeError ||
      !employee ||
      !business ||
      business.status !== 'active' ||
      String(business.slug).toLowerCase() !== businessSlug ||
      !employee.is_active ||
      !employee.personal_access_enabled ||
      !['invited', 'active'].includes(String(employee.personal_access_status)) ||
      !employee.user_id ||
      String(employee.email || '').trim().toLowerCase() !== email
    ) {
      return json({ error: 'Trusted sign-in is unavailable for this staff member' }, 401);
    }

    const { data: device, error: deviceError } = await admin
      .from('staff_trusted_devices')
      .select('id,token_hash,failed_attempts,locked_until,revoked_at,user_id')
      .eq('employee_id', employee.id)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (deviceError || !device || device.revoked_at || device.user_id !== employee.user_id) {
      return json({ error: 'This device must be verified by email first' }, 401);
    }

    const now = new Date();
    if (device.locked_until && new Date(device.locked_until).getTime() > now.getTime()) {
      return json({ error: 'Trusted sign-in is temporarily locked. Use email verification or try again later.' }, 429);
    }

    const incomingHash = await sha256(deviceSecret);
    if (!constantTimeEqual(incomingHash, String(device.token_hash || ''))) {
      const attempts = Number(device.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null;
      await admin
        .from('staff_trusted_devices')
        .update({ failed_attempts: attempts, locked_until: lockedUntil, updated_at: now.toISOString() })
        .eq('id', device.id);
      return json({ error: 'Trusted-device verification failed' }, 401);
    }

    const baseUrl = resolveBaseUrl(body.origin);
    const staffAppUrl = `${baseUrl}/staff/${encodeURIComponent(business.slug)}?employee=${encodeURIComponent(employee.id)}`;
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: staffAppUrl },
    });

    if (linkError || !linkData?.user || linkData.user.id !== employee.user_id || !linkData.properties?.hashed_token) {
      throw linkError ?? new Error('Unable to create trusted staff session');
    }

    await admin
      .from('staff_trusted_devices')
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_used_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', device.id);

    await admin.from('staff_access_audit_logs').insert({
      business_id: employee.business_id,
      employee_id: employee.id,
      actor_user_id: employee.user_id,
      action: 'trusted_device_sign_in',
      metadata: { device_id: deviceId },
    });

    return json({
      ok: true,
      token_hash: linkData.properties.hashed_token,
      verification_type: 'magiclink',
      staff_app_url: staffAppUrl,
    });
  } catch (error) {
    console.error('staff-device-auth failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to sign in on this device' }, 500);
  }
});

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function resolveBaseUrl(origin?: string) {
  const fallback = APP_PUBLIC_URL || 'https://velliqo.vercel.app';
  const candidate = String(origin ?? '').replace(/\/$/, '');
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    const isLocal = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    const isSecurePreview = url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
    const isConfiguredProduction = APP_PUBLIC_URL && url.origin === new URL(APP_PUBLIC_URL).origin;
    return isLocal || isSecurePreview || isConfiguredProduction ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
