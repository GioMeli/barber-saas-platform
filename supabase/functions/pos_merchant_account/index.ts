import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? 'https://velliqo.com').replace(/\/$/, '');
const STRIPE_CONNECT_DEFAULT_COUNTRY = Deno.env.get('STRIPE_CONNECT_DEFAULT_COUNTRY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type MerchantAction = 'start_onboarding' | 'refresh_status';

type PaymentAccountRow = {
  business_id: string;
  provider_account_id: string | null;
  onboarding_started_at?: string | null;
  connected_at?: string | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe is not configured' }, 503);

    const authHeader = request.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication is required' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401);

    const body = await request.json().catch(() => ({}));
    const businessId = String(body.businessId ?? '').trim();
    const action = String(body.action ?? 'refresh_status').trim() as MerchantAction;
    if (!businessId) return json({ error: 'Business is required' }, 400);
    if (!['start_onboarding', 'refresh_status'].includes(action)) return json({ error: 'Unsupported merchant action' }, 400);

    const { data: membership, error: membershipError } = await admin
      .from('business_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', authData.user.id)
      .eq('role', 'Owner')
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: 'Only the business owner can manage payment onboarding' }, 403);

    const { data: allowances, error: allowanceError } = await admin.rpc('get_business_addon_allowances', {
      p_business_id: businessId,
    });
    if (allowanceError) throw allowanceError;
    if (!allowances?.pos_active) return json({ error: 'An active Velliqo POS Suite add-on is required' }, 409);

    const [{ data: business, error: businessError }, { data: storedAccount, error: storedAccountError }] = await Promise.all([
      admin.from('businesses').select('id,name,slug,email,country,currency').eq('id', businessId).maybeSingle(),
      admin.from('business_payment_accounts').select('*').eq('business_id', businessId).maybeSingle(),
    ]);
    if (businessError) throw businessError;
    if (storedAccountError) throw storedAccountError;
    if (!business) return json({ error: 'Business not found' }, 404);

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
    let account: Stripe.Account;

    if (storedAccount?.provider_account_id) {
      account = await stripe.accounts.retrieve(storedAccount.provider_account_id);
      if ((account as Stripe.Account & { deleted?: boolean }).deleted) {
        return json({ error: 'The connected Stripe account is no longer available. Contact Velliqo support.' }, 409);
      }
    } else if (action === 'start_onboarding') {
      const storedCountry = normalizeCountry(business.country);
      if (String(business.country || '').trim() && !storedCountry) {
        return json({ error: 'Business country must be stored as a valid ISO-2 country code before Stripe onboarding.' }, 422);
      }
      const country = storedCountry || normalizeCountry(STRIPE_CONNECT_DEFAULT_COUNTRY) || undefined;
      const merchantEmail = validEmail(business.email) ? business.email : (validEmail(authData.user.email) ? authData.user.email : undefined);
      const storefrontUrl = `${APP_PUBLIC_URL}/app/${encodeURIComponent(String(business.slug || ''))}`;

      account = await stripe.accounts.create({
        controller: {
          fees: { payer: 'account' },
          losses: { payments: 'stripe' },
          requirement_collection: 'stripe',
          stripe_dashboard: { type: 'full' },
        },
        ...(country ? { country } : {}),
        ...(merchantEmail ? { email: merchantEmail } : {}),
        business_profile: {
          name: String(business.name || '').slice(0, 100) || undefined,
          url: storefrontUrl,
          ...(validEmail(business.email) ? { support_email: business.email } : {}),
          product_description: 'Appointment and service payments processed through Velliqo.',
        },
        metadata: {
          velliqo_business_id: businessId,
          velliqo_owner_user_id: authData.user.id,
        },
      }, {
        idempotencyKey: `velliqo-connect-account-${businessId}`,
      });

      const now = new Date().toISOString();
      const { error: createStoreError } = await admin.from('business_payment_accounts').upsert({
        business_id: businessId,
        provider: 'stripe',
        provider_account_id: account.id,
        onboarding_status: 'pending',
        onboarding_started_at: storedAccount?.onboarding_started_at || now,
        updated_at: now,
      }, { onConflict: 'business_id' });
      if (createStoreError) throw createStoreError;
    } else {
      return json({ account: null, status: 'not_started' });
    }

    const synced = await syncPaymentAccount(admin, businessId, account, storedAccount as PaymentAccountRow | null);

    if (action === 'refresh_status' || synced.onboarding_status === 'ready') {
      return json({ account: synced, status: synced.onboarding_status });
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${APP_PUBLIC_URL}/dashboard/pos?stripe=refresh`,
      return_url: `${APP_PUBLIC_URL}/dashboard/pos?stripe=return`,
      type: 'account_onboarding',
    });

    return json({
      account: synced,
      status: synced.onboarding_status,
      onboardingUrl: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
    });
  } catch (error) {
    console.error('pos_merchant_account failed', error);
    const stripeError = error as { code?: string; type?: string; message?: string };
    if (stripeError?.code === 'account_invalid' || stripeError?.type === 'StripePermissionError') {
      return json({ error: 'Stripe Connect is not enabled or configured for this Velliqo Stripe account.' }, 409);
    }
    return json({ error: error instanceof Error ? error.message : 'Unable to manage merchant onboarding' }, 500);
  }
});

async function syncPaymentAccount(
  admin: ReturnType<typeof createClient>,
  businessId: string,
  account: Stripe.Account,
  existing?: PaymentAccountRow | null,
) {
  const requirements = account.requirements as Stripe.Account.Requirements | null | undefined;
  const currentlyDue = requirements?.currently_due ?? [];
  const eventuallyDue = requirements?.eventually_due ?? [];
  const pastDue = requirements?.past_due ?? [];
  const pendingVerification = requirements?.pending_verification ?? [];
  const disabledReason = requirements?.disabled_reason ?? null;
  const ready = account.charges_enabled === true && account.payouts_enabled === true;
  const status = ready ? 'ready' : (disabledReason || pastDue.length > 0 ? 'restricted' : 'pending');
  const now = new Date().toISOString();
  const feesPayer = account.controller?.fees?.payer;
  const feesPaidByOwner = feesPayer === 'account' || account.type === 'standard';

  const row = {
    business_id: businessId,
    provider: 'stripe',
    provider_account_id: account.id,
    account_type: account.type || 'standard',
    onboarding_status: status,
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    details_submitted: Boolean(account.details_submitted),
    processing_fees_paid_by_owner: feesPaidByOwner,
    country: account.country || null,
    default_currency: account.default_currency || null,
    disabled_reason: disabledReason,
    requirements_currently_due: currentlyDue,
    requirements_eventually_due: eventuallyDue,
    requirements_past_due: pastDue,
    requirements_pending_verification: pendingVerification,
    onboarding_started_at: existing?.onboarding_started_at || now,
    connected_at: ready ? (existing?.connected_at || now) : (existing?.connected_at || null),
    last_synced_at: now,
    updated_at: now,
  };

  const { error } = await admin.from('business_payment_accounts').upsert(row, { onConflict: 'business_id' });
  if (error) throw error;
  return row;
}

function normalizeCountry(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const candidate = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(candidate)) return candidate;

  const aliases: Record<string, string> = {
    cyprus: 'CY', greece: 'GR', germany: 'DE', spain: 'ES', turkey: 'TR', 'türkiye': 'TR',
    'united kingdom': 'GB', britain: 'GB', england: 'GB', ireland: 'IE', france: 'FR', italy: 'IT',
    portugal: 'PT', netherlands: 'NL', belgium: 'BE', austria: 'AT', switzerland: 'CH',
    'united states': 'US', usa: 'US', canada: 'CA', australia: 'AU', 'new zealand': 'NZ',
    'united arab emirates': 'AE', uae: 'AE', india: 'IN',
  };
  return aliases[raw.toLowerCase()] || '';
}

function validEmail(value: unknown): value is string {
  const email = String(value ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
