import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (!['GET', 'POST'].includes(req.method)) {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const channel = normalizeChannel(url.searchParams.get('channel'));

  if (!token || !isUuid(token)) {
    return htmlPage('Invalid link', 'This unsubscribe link is invalid or incomplete.', 400);
  }

  const { data: profile, error } = await supabase
    .from('customer_business_profiles')
    .select('id, business_id, customer_id, email, phone, unsubscribe_token')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (error || !profile) {
    return htmlPage('Link not found', 'This unsubscribe link is no longer available.', 404);
  }

  if (req.method === 'GET') {
    return confirmationPage(token, channel);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    marketing_consent_updated_at: now,
    updated_at: now,
  };

  if (channel === 'email') {
    updates.email_notifications_enabled = false;
    updates.email_unsubscribed_at = now;
  } else if (channel === 'sms') {
    updates.sms_notifications_enabled = false;
    updates.sms_unsubscribed_at = now;
  } else {
    updates.marketing_consent = false;
    updates.email_notifications_enabled = false;
    updates.sms_notifications_enabled = false;
    updates.email_unsubscribed_at = now;
    updates.sms_unsubscribed_at = now;
  }

  const { error: updateError } = await supabase
    .from('customer_business_profiles')
    .update(updates)
    .eq('id', profile.id);

  if (updateError) {
    console.error('Unsubscribe update failed', updateError);
    return htmlPage('Unable to update preferences', 'Please try again later.', 500);
  }

  const suppressions: Array<Record<string, unknown>> = [];
  if ((channel === 'email' || channel === 'all') && profile.email) {
    suppressions.push({
      business_id: profile.business_id,
      customer_id: profile.customer_id,
      channel: 'email',
      destination: String(profile.email).trim().toLowerCase(),
      reason: 'customer_unsubscribe',
      source: 'customer',
      lifted_at: null,
    });
  }
  if ((channel === 'sms' || channel === 'all') && profile.phone) {
    suppressions.push({
      business_id: profile.business_id,
      customer_id: profile.customer_id,
      channel: 'sms',
      destination: normalizePhone(String(profile.phone)),
      reason: 'customer_unsubscribe',
      source: 'customer',
      lifted_at: null,
    });
  }

  for (const suppression of suppressions) {
    await supabase
      .from('marketing_suppressions')
      .upsert({ ...suppression, lifted_at: null }, { onConflict: 'business_id,channel,destination' });
  }

  return htmlPage(
    'Preferences updated',
    channel === 'all'
      ? 'You will no longer receive marketing messages from this business.'
      : `You will no longer receive marketing ${channel === 'email' ? 'emails' : 'SMS messages'} from this business.`,
    200,
    true,
  );
});

function confirmationPage(token: string, channel: 'email' | 'sms' | 'all') {
  const action = `${SUPABASE_URL}/functions/v1/marketing-unsubscribe?token=${encodeURIComponent(token)}&channel=${channel}`;
  const label = channel === 'all' ? 'all marketing messages' : `marketing ${channel === 'email' ? 'emails' : 'SMS messages'}`;
  const backLink = APP_PUBLIC_URL
    ? `<a href="${escapeHtml(APP_PUBLIC_URL)}" class="secondary">Return to Velliqo</a>`
    : '';

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Manage marketing preferences</title>
  <style>${styles()}</style>
</head>
<body>
  <main class="card">
    <div class="brand">Velliqo</div>
    <h1>Unsubscribe from ${escapeHtml(label)}</h1>
    <p>Confirm below. Appointment confirmations and other essential service messages are not affected.</p>
    <form method="post" action="${escapeHtml(action)}">
      <button type="submit">Confirm unsubscribe</button>
    </form>
    ${backLink}
  </main>
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function htmlPage(title: string, message: string, status: number, success = false) {
  const backLink = APP_PUBLIC_URL
    ? `<a href="${escapeHtml(APP_PUBLIC_URL)}" class="secondary">Return to Velliqo</a>`
    : '';

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${styles()}</style>
</head>
<body>
  <main class="card">
    <div class="brand">Velliqo</div>
    <div class="status ${success ? 'success' : ''}">${success ? '✓' : '!'}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${backLink}
  </main>
</body>
</html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function styles() {
  return `
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f6f7fb; color:#0f172a; padding:24px; }
    .card { width:min(520px,100%); box-sizing:border-box; background:white; border:1px solid #e2e8f0; border-radius:24px; padding:32px; box-shadow:0 20px 60px rgba(15,23,42,.08); text-align:center; }
    .brand { font-weight:800; letter-spacing:.02em; color:#111827; margin-bottom:20px; }
    h1 { font-size:28px; line-height:1.2; margin:0 0 12px; }
    p { color:#64748b; line-height:1.65; margin:0 0 24px; }
    button, .secondary { display:inline-flex; align-items:center; justify-content:center; min-height:44px; border-radius:12px; padding:0 18px; font-weight:700; text-decoration:none; cursor:pointer; }
    button { border:0; background:#111827; color:white; }
    .secondary { margin-top:12px; color:#111827; border:1px solid #cbd5e1; }
    .status { width:52px; height:52px; border-radius:999px; display:grid; place-items:center; margin:0 auto 18px; background:#fee2e2; color:#b91c1c; font-weight:900; font-size:24px; }
    .status.success { background:#dcfce7; color:#15803d; }
  `;
}

function normalizeChannel(value: string | null): 'email' | 'sms' | 'all' {
  if (value === 'email' || value === 'sms') return value;
  return 'all';
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, '');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
