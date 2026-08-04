import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? '').replace(/\/$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AccessAction = 'enable' | 'resend' | 'revoke';

type RequestBody = {
  action?: AccessAction;
  employee_id?: string;
  origin?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication is required' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);

    const body = (await request.json()) as RequestBody;
    const action = body.action;
    const employeeId = String(body.employee_id ?? '').trim();
    if (!action || !['enable', 'resend', 'revoke'].includes(action) || !employeeId) {
      return json({ error: 'Invalid staff access request' }, 400);
    }

    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('id,business_id,user_id,name,email,personal_access_enabled,staff_access_version,businesses(name,slug,logo_url,status)')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError || !employee) return json({ error: 'Staff member not found' }, 404);

    const { data: ownerMembership } = await admin
      .from('business_members')
      .select('id')
      .eq('business_id', employee.business_id)
      .eq('user_id', userData.user.id)
      .eq('role', 'Owner')
      .maybeSingle();

    if (!ownerMembership) return json({ error: 'Only the business owner can manage staff access' }, 403);

    const business = Array.isArray(employee.businesses) ? employee.businesses[0] : employee.businesses;
    if (!business || business.status !== 'active') return json({ error: 'Business is not active' }, 409);

    const baseUrl = resolveBaseUrl(body.origin);
    const staffAppUrl = `${baseUrl}/staff/${encodeURIComponent(business.slug)}?employee=${encodeURIComponent(employee.id)}&employeeName=${encodeURIComponent(employee.name || 'Staff')}`;

    if (action === 'revoke') {
      const now = new Date().toISOString();
      const { error: revokeError } = await admin
        .from('employees')
        .update({
          personal_access_enabled: false,
          personal_access_status: 'revoked',
          staff_app_revoked_at: now,
          staff_access_version: Number(employee.staff_access_version ?? 1) + 1,
          updated_at: now,
        })
        .eq('id', employee.id)
        .eq('business_id', employee.business_id);
      if (revokeError) throw revokeError;

      await admin
        .from('staff_trusted_devices')
        .update({ revoked_at: now, updated_at: now })
        .eq('employee_id', employee.id)
        .is('revoked_at', null);

      await admin.from('staff_access_audit_logs').insert({
        business_id: employee.business_id,
        employee_id: employee.id,
        actor_user_id: userData.user.id,
        action: 'access_revoked',
        metadata: { staff_app_url: staffAppUrl },
      });

      return json({ ok: true, action, staff_app_url: staffAppUrl });
    }

    const email = String(employee.email ?? '').trim().toLowerCase();
    if (!email) return json({ error: 'A staff email address is required' }, 400);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: staffAppUrl,
        data: {
          full_name: employee.name,
          role: 'Employee',
          staff_employee_id: employee.id,
          staff_business_id: employee.business_id,
        },
      },
    });
    if (linkError || !linkData?.user) throw linkError ?? new Error('Unable to create staff account');

    const linkedUserId = linkData.user.id;
    const now = new Date().toISOString();

    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', linkedUserId)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (!existingProfile) {
      const { error: profileError } = await admin.from('profiles').insert({
        id: linkedUserId,
        role: 'Employee',
        full_name: employee.name,
        email,
        updated_at: now,
      });
      if (profileError) throw profileError;
    }

    const { error: updateError } = await admin
      .from('employees')
      .update({
        user_id: linkedUserId,
        personal_access_enabled: true,
        personal_access_status: 'invited',
        staff_app_invited_at: now,
        staff_app_revoked_at: null,
        updated_at: now,
      })
      .eq('id', employee.id)
      .eq('business_id', employee.business_id);
    if (updateError) throw updateError;

    // A personal staff account must never inherit broad business-member permissions.
    await admin
      .from('business_members')
      .delete()
      .eq('business_id', employee.business_id)
      .eq('user_id', linkedUserId)
      .eq('role', 'Employee');

    const emailSent = await sendInviteEmail({
      to: email,
      employeeName: employee.name,
      businessName: business.name,
      businessLogo: business.logo_url,
      actionLink: linkData.properties.action_link,
      staffAppUrl,
    });

    await admin.from('staff_access_audit_logs').insert({
      business_id: employee.business_id,
      employee_id: employee.id,
      actor_user_id: userData.user.id,
      action: action === 'resend' ? 'invite_resent' : 'access_enabled',
      metadata: { email, email_sent: emailSent, staff_app_url: staffAppUrl },
    });

    return json({
      ok: true,
      action,
      email_sent: emailSent,
      staff_app_url: staffAppUrl,
      access_status: 'invited',
    });
  } catch (error) {
    console.error('manage-staff-access failed', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to manage staff access' }, 500);
  }
});

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

async function sendInviteEmail(input: {
  to: string;
  employeeName: string;
  businessName: string;
  businessLogo?: string | null;
  actionLink: string;
  staffAppUrl: string;
}) {
  if (!RESEND_API_KEY || !EMAIL_FROM) return false;

  const logo = input.businessLogo
    ? `<img src="${escapeHtml(input.businessLogo)}" alt="" style="width:52px;height:52px;border-radius:14px;object-fit:cover" />`
    : `<div style="width:52px;height:52px;border-radius:14px;background:#111827;color:white;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">${escapeHtml(input.businessName.charAt(0))}</div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [input.to],
      subject: `${input.businessName} staff app access`,
      html: `
        <div style="background:#f8fafc;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#0f172a">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px">
            <div style="display:flex;gap:14px;align-items:center">${logo}<div><div style="font-size:18px;font-weight:800">${escapeHtml(input.businessName)}</div><div style="font-size:13px;color:#64748b">Personal staff workspace</div></div></div>
            <h1 style="margin:28px 0 10px;font-size:26px;line-height:1.2">Your appointment app is ready</h1>
            <p style="font-size:15px;line-height:1.7;color:#475569">Hello ${escapeHtml(input.employeeName)}, use the secure button below to open your personal schedule. No password is required.</p>
            <a href="${escapeHtml(input.actionLink)}" style="display:inline-block;margin-top:18px;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:800">Open staff app</a>
            <p style="margin-top:24px;font-size:12px;line-height:1.6;color:#94a3b8">The link is personal and single-use. You can request another passwordless link from ${escapeHtml(input.staffAppUrl)}.</p>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    console.error('Unable to send staff invite', await response.text());
    return false;
  }
  return true;
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
