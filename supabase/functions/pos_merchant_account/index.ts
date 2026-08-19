import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@19.1.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const APP_PUBLIC_URL = (Deno.env.get('APP_PUBLIC_URL') ?? 'https://velliqo.com').replace(/\/$/, '');
const STRIPE_CONNECT_DEFAULT_COUNTRY = Deno.env.get('STRIPE_CONNECT_DEFAULT_COUNTRY') ?? '';

// New Connect platforms created in current Stripe environments must create
// connected accounts through Accounts v2. We still retrieve the resulting v2
// Account through the v1 compatibility endpoint because the rest of Velliqo's
// Phase 15B.1 status cache uses the stable v1 Account projection
// (charges_enabled, payouts_enabled and requirements arrays). Stripe documents
// that v2 Account IDs can be passed to Accounts v1 endpoints for this purpose.
const STRIPE_V2_API_VERSION = '2026-07-29.preview';

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

type StripeV2Account = {
  id: string;
  object?: string;
  closed?: boolean | null;
};

type StripeV2AccountLink = {
  url: string;
  expires_at: string;
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
      account = await retrieveAccountCompat(stripe, storedAccount.provider_account_id);
    } else if (action === 'start_onboarding') {
      const storedCountry = normalizeCountry(business.country);
      if (String(business.country || '').trim() && !storedCountry) {
        return json({ error: 'Business country must be stored as a valid ISO-2 country code before Stripe onboarding.' }, 422);
      }
      const country = storedCountry || normalizeCountry(STRIPE_CONNECT_DEFAULT_COUNTRY);
      if (!country) {
        return json({ error: 'A valid business country is required before Stripe onboarding.' }, 422);
      }

      const merchantEmail = validEmail(business.email)
        ? String(business.email).trim()
        : (validEmail(authData.user.email) ? String(authData.user.email).trim() : '');
      if (!merchantEmail) {
        return json({ error: 'A valid owner or business email is required before Stripe onboarding.' }, 422);
      }

      const storefrontUrl = `${APP_PUBLIC_URL}/app/${encodeURIComponent(String(business.slug || ''))}`;
      const currency = normalizeCurrency(business.currency);

      const createdV2 = await stripeV2Request<StripeV2Account>('/v2/core/accounts', {
        method: 'POST',
        idempotencyKey: `velliqo-connect-account-v2-${businessId}`,
        body: {
          contact_email: merchantEmail,
          display_name: String(business.name || '').slice(0, 100) || 'Velliqo business',
          dashboard: 'full',
          identity: {
            country: country.toLowerCase(),
          },
          configuration: {
            merchant: {
              capabilities: {
                card_payments: { requested: true },
              },
            },
          },
          defaults: {
            ...(currency ? { currency } : {}),
            profile: {
              business_url: storefrontUrl,
              product_description: 'Appointment and service payments processed through Velliqo.',
            },
            responsibilities: {
              fees_collector: 'stripe',
              losses_collector: 'stripe',
            },
          },
          metadata: {
            velliqo_business_id: businessId,
            velliqo_owner_user_id: authData.user.id,
          },
          include: ['configuration.merchant', 'defaults', 'identity', 'requirements'],
        },
      });

      const now = new Date().toISOString();
      const { error: createStoreError } = await admin.from('business_payment_accounts').upsert({
        business_id: businessId,
        provider: 'stripe',
        provider_account_id: createdV2.id,
        account_type: 'accounts_v2',
        onboarding_status: 'pending',
        onboarding_started_at: storedAccount?.onboarding_started_at || now,
        updated_at: now,
      }, { onConflict: 'business_id' });
      if (createStoreError) throw createStoreError;

      account = await retrieveAccountCompat(stripe, createdV2.id);
    } else {
      return json({ account: null, status: 'not_started' });
    }

    const synced = await syncPaymentAccount(admin, businessId, account, storedAccount as PaymentAccountRow | null);

    if (action === 'refresh_status' || synced.onboarding_status === 'ready') {
      return json({ account: synced, status: synced.onboarding_status });
    }

    const accountLink = await stripeV2Request<StripeV2AccountLink>('/v2/core/account_links', {
      method: 'POST',
      body: {
        account: account.id,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            collection_options: { fields: 'eventually_due' },
            configurations: ['merchant'],
            refresh_url: `${APP_PUBLIC_URL}/dashboard/pos?stripe=refresh`,
            return_url: `${APP_PUBLIC_URL}/dashboard/pos?stripe=return`,
          },
        },
      },
    });

    return json({
      account: synced,
      status: synced.onboarding_status,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error('pos_merchant_account failed', error);
    const stripeError = error as { code?: string; type?: string; message?: string; status?: number };
    if (
      stripeError?.code === 'account_invalid'
      || stripeError?.code === 'platform_registration_required'
      || stripeError?.code === 'connect_profile_not_submitted'
      || stripeError?.code === 'connect_identity_not_verified'
      || stripeError?.code === 'account_create_activation_required'
      || stripeError?.code === 'accounts_v2_access_blocked'
      || stripeError?.type === 'StripePermissionError'
    ) {
      return json({ error: 'Stripe Connect is not fully enabled or verified for this Velliqo Stripe account.' }, 409);
    }
    return json({ error: error instanceof Error ? error.message : 'Unable to manage merchant onboarding' }, 500);
  }
});

async function retrieveAccountCompat(stripe: Stripe, accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  if ((account as Stripe.Account & { deleted?: boolean }).deleted) {
    throw Object.assign(new Error('The connected Stripe account is no longer available. Contact Velliqo support.'), { code: 'account_invalid' });
  }
  return account as Stripe.Account;
}

async function stripeV2Request<T>(
  path: string,
  options: { method: 'POST' | 'GET'; body?: Record<string, unknown>; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': STRIPE_V2_API_VERSION,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: options.method,
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    const stripeError = payload?.error || payload;
    const message = String(stripeError?.message || `Stripe request failed with HTTP ${response.status}`);
    throw Object.assign(new Error(message), {
      code: stripeError?.code,
      type: stripeError?.type,
      status: response.status,
      requestId: response.headers.get('request-id') || response.headers.get('Request-Id') || undefined,
    });
  }
  return payload as T;
}

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
    account_type: 'accounts_v2',
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

function normalizeCurrency(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase();
  return /^[a-z]{3}$/.test(raw) ? raw : '';
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
