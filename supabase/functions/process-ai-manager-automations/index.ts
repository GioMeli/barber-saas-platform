import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTOMATION_SECRET = Deno.env.get('AI_AUTOMATION_FUNCTION_SECRET') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini';
const OPENAI_BASE_URL = (Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Language = 'en' | 'el' | 'de' | 'es' | 'tr';
type Severity = 'info' | 'opportunity' | 'warning' | 'critical';
type Category = 'business_health' | 'finance' | 'customers' | 'scheduling' | 'staff' | 'services' | 'inventory' | 'marketing';

type AutomationSettings = {
  business_id: string;
  default_language: Language | string | null;
  proactive_briefing_enabled: boolean;
  briefing_time: string | null;
  notify_owner_on_ai_alert: boolean;
  monitor_revenue_changes: boolean;
  monitor_no_shows: boolean;
  monitor_customer_retention: boolean;
  monitor_inventory: boolean;
  monitor_marketing_performance: boolean;
};

type Business = {
  id: string;
  name: string;
  timezone: string | null;
  currency: string | null;
  industry_key: string | null;
  country: string | null;
};

type Metrics = {
  periodDays: number;
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShows: number;
    completionRate: number;
    cancellationRate: number;
    noShowRate: number;
    nextSevenDays: number;
  };
  finance: {
    revenue: number;
    previousRevenue: number;
    revenueChangePercent: number;
    expenses: number;
    previousExpenses: number;
    estimatedProfit: number;
  };
  customers: {
    total: number;
    newInPeriod: number;
    returning: number;
    atRisk: number;
    dormant: number;
  };
  inventory: {
    activeProducts: number;
    lowStock: number;
    outOfStock: number;
    lowStockNames: string[];
  };
  marketing: {
    campaigns: number;
    sent: number;
    delivered: number;
    converted: number;
    conversionRate: number;
    attributedRevenue: number;
  };
};

type AlertDraft = {
  category: Category;
  severity: Severity;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  suggestedPrompt: string;
  destinationPath: string;
  dedupeKey: string;
};

type BriefingDraft = {
  title: string;
  summary: string;
  priorities: Array<{
    category: Category;
    severity: Severity;
    title: string;
    explanation: string;
    next_step: string;
  }>;
  recommended_prompts: string[];
  provider: 'openai' | 'velliqo_free';
  model: string;
  inputTokens: number;
  outputTokens: number;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const scheduled = secureEquals(request.headers.get('x-ai-automation-secret') ?? '', AUTOMATION_SECRET);

    if (scheduled) {
      const result = await runScheduledScan();
      return json(result);
    }

    const authorization = request.headers.get('Authorization') ?? '';
    if (!authorization) return json({ error: 'Authentication is required' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid authentication session' }, 401);

    const businessId = String(body?.businessId || '').trim();
    if (!businessId) return json({ error: 'businessId is required' }, 400);

    const { data: membership } = await service
      .from('business_members')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (!membership || !['Owner', 'Manager'].includes(String(membership.role))) {
      return json({ error: 'Only an owner or manager can refresh the AI manager briefing' }, 403);
    }

    const settings = await loadSettings(businessId);
    if (!settings) return json({ error: 'Velliqo AI settings were not found' }, 404);

    const result = await processBusiness(settings, {
      force: Boolean(body?.force),
      runType: 'manual_refresh',
      requestedBy: authData.user.id,
    });
    return json(result);
  } catch (error) {
    console.error('process-ai-manager-automations failed', error);
    return json({ error: errorMessage(error) }, 500);
  }
});

async function runScheduledScan() {
  if (!AUTOMATION_SECRET) throw new Error('AI_AUTOMATION_FUNCTION_SECRET is not configured');

  const { data, error } = await service
    .from('ai_settings')
    .select([
      'business_id',
      'default_language',
      'proactive_briefing_enabled',
      'briefing_time',
      'notify_owner_on_ai_alert',
      'monitor_revenue_changes',
      'monitor_no_shows',
      'monitor_customer_retention',
      'monitor_inventory',
      'monitor_marketing_performance',
    ].join(','))
    .eq('enabled', true)
    .eq('proactive_insights', true)
    .eq('proactive_briefing_enabled', true)
    .limit(200);

  if (error) throw error;

  const results: Array<Record<string, unknown>> = [];
  for (const row of (data || []) as AutomationSettings[]) {
    try {
      const result = await processBusiness(row, { force: false, runType: 'scheduled_scan' });
      results.push({ business_id: row.business_id, ...result });
    } catch (error) {
      console.error('AI automation business failed', row.business_id, error);
      results.push({ business_id: row.business_id, status: 'failed', error: errorMessage(error) });
    }
  }

  return {
    scanned: (data || []).length,
    completed: results.filter((item) => item.status === 'completed').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

async function loadSettings(businessId: string): Promise<AutomationSettings | null> {
  const { data, error } = await service
    .from('ai_settings')
    .select([
      'business_id',
      'default_language',
      'proactive_briefing_enabled',
      'briefing_time',
      'notify_owner_on_ai_alert',
      'monitor_revenue_changes',
      'monitor_no_shows',
      'monitor_customer_retention',
      'monitor_inventory',
      'monitor_marketing_performance',
    ].join(','))
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return (data as AutomationSettings | null) || null;
}

async function processBusiness(
  settings: AutomationSettings,
  options: { force: boolean; runType: 'manual_refresh' | 'scheduled_scan'; requestedBy?: string },
) {
  const { data: businessData, error: businessError } = await service
    .from('businesses')
    .select('id,name,timezone,currency,industry_key,country')
    .eq('id', settings.business_id)
    .maybeSingle();
  if (businessError) throw businessError;
  if (!businessData) return { status: 'skipped', reason: 'business_not_found' };

  const business = businessData as Business;
  const timezone = safeTimezone(business.timezone || 'UTC');
  const localDate = localDateParts(new Date(), timezone).date;
  const localMinutes = localDateParts(new Date(), timezone).minutes;
  const dueMinutes = timeToMinutes(settings.briefing_time || '08:00');

  if (!options.force && localMinutes < dueMinutes) {
    return { status: 'skipped', reason: 'before_configured_time', local_date: localDate };
  }

  const { data: existing } = await service
    .from('ai_manager_briefings')
    .select('id,generated_at')
    .eq('business_id', business.id)
    .eq('briefing_date', localDate)
    .maybeSingle();

  if (existing && !options.force) {
    return { status: 'skipped', reason: 'already_generated', briefing_id: existing.id, local_date: localDate };
  }

  const { data: run, error: runError } = await service
    .from('ai_automation_runs')
    .insert({
      business_id: business.id,
      run_type: options.runType,
      status: 'started',
      metadata: { local_date: localDate, timezone, requested_by: options.requestedBy || null },
    })
    .select('id')
    .single();
  if (runError) throw runError;

  try {
    const metrics = await buildMetrics(business.id);
    const alerts = buildAlerts(metrics, settings, normalizeLanguage(settings.default_language));
    const healthScore = calculateHealthScore(metrics);
    const briefing = await generateBriefing({
      language: normalizeLanguage(settings.default_language),
      business,
      metrics,
      alerts,
      healthScore,
    });

    const { data: briefingRow, error: briefingError } = await service
      .from('ai_manager_briefings')
      .upsert({
        business_id: business.id,
        briefing_date: localDate,
        language: normalizeLanguage(settings.default_language),
        title: briefing.title,
        summary: briefing.summary,
        business_health_score: healthScore,
        priorities: briefing.priorities,
        recommended_prompts: briefing.recommended_prompts,
        provider: briefing.provider,
        model: briefing.model,
        input_tokens: briefing.inputTokens,
        output_tokens: briefing.outputTokens,
        estimated_cost: estimateOpenAICost(briefing.model, briefing.inputTokens, briefing.outputTokens),
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,briefing_date' })
      .select('*')
      .single();
    if (briefingError) throw briefingError;

    const activeKeys = alerts.map((item) => item.dedupeKey);
    let createdOrUpdated = 0;
    for (const alert of alerts) {
      const { error: alertError } = await service
        .from('ai_manager_alerts')
        .upsert({
          business_id: business.id,
          category: alert.category,
          severity: alert.severity,
          title: alert.title,
          summary: alert.summary,
          evidence: alert.evidence,
          recommendation: alert.recommendation,
          suggested_prompt: alert.suggestedPrompt,
          destination_path: alert.destinationPath,
          status: 'new',
          dedupe_key: alert.dedupeKey,
          detected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          expires_at: addDaysIso(14),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id,dedupe_key' });
      if (alertError) throw alertError;
      createdOrUpdated += 1;
    }

    const staleQuery = service
      .from('ai_manager_alerts')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('business_id', business.id)
      .in('status', ['new', 'reviewed']);
    if (activeKeys.length) staleQuery.not('dedupe_key', 'in', `(${activeKeys.map(escapePostgrestValue).join(',')})`);
    await staleQuery;

    if (settings.notify_owner_on_ai_alert) {
      await service.rpc('create_ai_owner_notification', {
        p_business_id: business.id,
        p_title: briefing.title,
        p_message: briefing.summary.slice(0, 500),
        p_type: 'ai_briefing',
        p_metadata: {
          briefing_id: briefingRow.id,
          dedupe_key: `briefing:${localDate}`,
          destination_path: '/dashboard/ai',
          health_score: healthScore,
        },
      });

      for (const alert of alerts.filter((item) => item.severity === 'critical' || item.severity === 'warning')) {
        await service.rpc('create_ai_owner_notification', {
          p_business_id: business.id,
          p_title: alert.title,
          p_message: alert.summary.slice(0, 500),
          p_type: 'ai_alert',
          p_metadata: {
            dedupe_key: `alert:${alert.dedupeKey}:${localDate}`,
            alert_key: alert.dedupeKey,
            severity: alert.severity,
            destination_path: alert.destinationPath,
          },
        });
      }
    }

    await service.from('ai_usage_events').insert({
      business_id: business.id,
      user_id: options.requestedBy || null,
      agent_key: 'business_coach',
      provider: briefing.provider,
      model: briefing.model,
      input_tokens: briefing.inputTokens,
      output_tokens: briefing.outputTokens,
      estimated_cost: estimateOpenAICost(briefing.model, briefing.inputTokens, briefing.outputTokens),
      success: true,
    });

    await service
      .from('ai_settings')
      .update({ automation_last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('business_id', business.id);

    await service
      .from('ai_automation_runs')
      .update({
        status: 'completed',
        provider: briefing.provider,
        model: briefing.model,
        input_tokens: briefing.inputTokens,
        output_tokens: briefing.outputTokens,
        estimated_cost: estimateOpenAICost(briefing.model, briefing.inputTokens, briefing.outputTokens),
        alerts_created: createdOrUpdated,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      status: 'completed',
      briefing_id: briefingRow.id,
      local_date: localDate,
      provider: briefing.provider,
      alerts: createdOrUpdated,
      health_score: healthScore,
    };
  } catch (error) {
    await service
      .from('ai_automation_runs')
      .update({
        status: 'failed',
        error_message: errorMessage(error).slice(0, 1000),
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    throw error;
  }
}

async function buildMetrics(businessId: string): Promise<Metrics> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const previousStart = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const nextSeven = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const customerWindow = new Date(now.getTime() - 180 * 86_400_000).toISOString();

  const [appointmentsResult, previousAppointmentsResult, upcomingResult, currentSalesResult, previousSalesResult, currentExpensesResult, previousExpensesResult, customersResult, customerAppointmentsResult, productsResult, campaignsResult] = await Promise.all([
    service.from('appointments').select('id,status,total_price,total_duration,start_time,customer_id,employee_id').eq('business_id', businessId).gte('start_time', periodStart).lt('start_time', now.toISOString()).limit(5000),
    service.from('appointments').select('id,status,total_price,total_duration,start_time,customer_id').eq('business_id', businessId).gte('start_time', previousStart).lt('start_time', periodStart).limit(5000),
    service.from('appointments').select('id,status,start_time').eq('business_id', businessId).gte('start_time', now.toISOString()).lt('start_time', nextSeven).limit(5000),
    service.from('sale_transactions').select('status,total_amount,paid_amount,completed_at').eq('business_id', businessId).gte('completed_at', periodStart).lt('completed_at', now.toISOString()).limit(5000),
    service.from('sale_transactions').select('status,total_amount,paid_amount,completed_at').eq('business_id', businessId).gte('completed_at', previousStart).lt('completed_at', periodStart).limit(5000),
    service.from('expenses').select('amount,date').eq('business_id', businessId).gte('date', periodStart.slice(0, 10)).lte('date', now.toISOString().slice(0, 10)).limit(5000),
    service.from('expenses').select('amount,date').eq('business_id', businessId).gte('date', previousStart.slice(0, 10)).lt('date', periodStart.slice(0, 10)).limit(5000),
    service.from('customers').select('id,created_at').eq('business_id', businessId).limit(10000),
    service.from('appointments').select('customer_id,status,start_time').eq('business_id', businessId).gte('start_time', customerWindow).not('customer_id', 'is', null).limit(10000),
    service.from('products').select('name,current_stock,min_stock,cost_price,selling_price,is_active').eq('business_id', businessId).eq('is_active', true).limit(5000),
    service.from('marketing_campaigns').select('status,sent_count,delivered_count,converted_count,attributed_revenue,created_at').eq('business_id', businessId).gte('created_at', periodStart).limit(5000),
  ]);

  for (const result of [appointmentsResult, previousAppointmentsResult, upcomingResult, currentSalesResult, previousSalesResult, currentExpensesResult, previousExpensesResult, customersResult, customerAppointmentsResult, productsResult, campaignsResult]) {
    if (result.error) throw result.error;
  }

  const appointments = appointmentsResult.data || [];
  const upcoming = upcomingResult.data || [];
  const completed = appointments.filter((item: any) => item.status === 'completed').length;
  const cancelled = appointments.filter((item: any) => ['cancelled_by_customer', 'cancelled_by_business'].includes(item.status)).length;
  const noShows = appointments.filter((item: any) => item.status === 'no_show').length;
  const total = appointments.length;

  const revenue = sum((currentSalesResult.data || []).filter((item: any) => item.status !== 'voided').map((item: any) => Number(item.paid_amount || item.total_amount || 0)));
  const previousRevenue = sum((previousSalesResult.data || []).filter((item: any) => item.status !== 'voided').map((item: any) => Number(item.paid_amount || item.total_amount || 0)));
  const expenses = sum((currentExpensesResult.data || []).map((item: any) => Number(item.amount || 0)));
  const previousExpenses = sum((previousExpensesResult.data || []).map((item: any) => Number(item.amount || 0)));

  const visitMap = new Map<string, Date[]>();
  for (const item of customerAppointmentsResult.data || []) {
    if (!item.customer_id || item.status !== 'completed') continue;
    const visits = visitMap.get(item.customer_id) || [];
    visits.push(new Date(item.start_time));
    visitMap.set(item.customer_id, visits);
  }
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);
  const oneTwentyDaysAgo = new Date(now.getTime() - 120 * 86_400_000);
  let returning = 0;
  let atRisk = 0;
  let dormant = 0;
  for (const visits of visitMap.values()) {
    visits.sort((a, b) => b.getTime() - a.getTime());
    if (visits.length > 1) returning += 1;
    const last = visits[0];
    if (last < sixtyDaysAgo && last >= oneTwentyDaysAgo) atRisk += 1;
    if (last < oneTwentyDaysAgo) dormant += 1;
  }

  const products = productsResult.data || [];
  const lowStockProducts = products.filter((item: any) => Number(item.current_stock || 0) <= Number(item.min_stock || 0));
  const campaigns = campaignsResult.data || [];
  const sent = sum(campaigns.map((item: any) => Number(item.sent_count || 0)));
  const delivered = sum(campaigns.map((item: any) => Number(item.delivered_count || 0)));
  const converted = sum(campaigns.map((item: any) => Number(item.converted_count || 0)));

  return {
    periodDays: 30,
    appointments: {
      total,
      completed,
      cancelled,
      noShows,
      completionRate: percent(completed, total),
      cancellationRate: percent(cancelled, total),
      noShowRate: percent(noShows, total),
      nextSevenDays: upcoming.filter((item: any) => !['cancelled_by_customer', 'cancelled_by_business', 'no_show'].includes(item.status)).length,
    },
    finance: {
      revenue: round2(revenue),
      previousRevenue: round2(previousRevenue),
      revenueChangePercent: percentChange(revenue, previousRevenue),
      expenses: round2(expenses),
      previousExpenses: round2(previousExpenses),
      estimatedProfit: round2(revenue - expenses),
    },
    customers: {
      total: (customersResult.data || []).length,
      newInPeriod: (customersResult.data || []).filter((item: any) => new Date(item.created_at) >= new Date(periodStart)).length,
      returning,
      atRisk,
      dormant,
    },
    inventory: {
      activeProducts: products.length,
      lowStock: lowStockProducts.length,
      outOfStock: products.filter((item: any) => Number(item.current_stock || 0) <= 0).length,
      lowStockNames: lowStockProducts.slice(0, 8).map((item: any) => String(item.name || '')).filter(Boolean),
    },
    marketing: {
      campaigns: campaigns.length,
      sent,
      delivered,
      converted,
      conversionRate: percent(converted, delivered || sent),
      attributedRevenue: round2(sum(campaigns.map((item: any) => Number(item.attributed_revenue || 0)))),
    },
  };
}

function buildAlerts(metrics: Metrics, settings: AutomationSettings, language: Language): AlertDraft[] {
  const copy = copies(language);
  const alerts: AlertDraft[] = [];

  if (settings.monitor_revenue_changes && metrics.finance.previousRevenue > 0 && metrics.finance.revenueChangePercent <= -15) {
    const severe = metrics.finance.revenueChangePercent <= -30;
    alerts.push({
      category: 'finance',
      severity: severe ? 'critical' : 'warning',
      title: copy.revenueDropTitle,
      summary: template(copy.revenueDropSummary, { value: Math.abs(metrics.finance.revenueChangePercent).toFixed(1) }),
      evidence: { current_revenue: metrics.finance.revenue, previous_revenue: metrics.finance.previousRevenue, change_percent: metrics.finance.revenueChangePercent },
      recommendation: copy.revenueDropRecommendation,
      suggestedPrompt: copy.revenueDropPrompt,
      destinationPath: '/dashboard/reports',
      dedupeKey: 'finance:revenue_drop',
    });
  }

  if (settings.monitor_no_shows && metrics.appointments.noShows > 0 && metrics.appointments.noShowRate >= 5) {
    alerts.push({
      category: 'scheduling',
      severity: metrics.appointments.noShowRate >= 10 ? 'critical' : 'warning',
      title: copy.noShowTitle,
      summary: template(copy.noShowSummary, { count: metrics.appointments.noShows, rate: metrics.appointments.noShowRate.toFixed(1) }),
      evidence: { no_shows: metrics.appointments.noShows, total_appointments: metrics.appointments.total, rate: metrics.appointments.noShowRate },
      recommendation: copy.noShowRecommendation,
      suggestedPrompt: copy.noShowPrompt,
      destinationPath: '/dashboard/calendar',
      dedupeKey: 'scheduling:no_show_rate',
    });
  }

  if (settings.monitor_customer_retention && metrics.customers.atRisk > 0) {
    alerts.push({
      category: 'customers',
      severity: metrics.customers.atRisk >= 10 ? 'warning' : 'opportunity',
      title: copy.retentionTitle,
      summary: template(copy.retentionSummary, { count: metrics.customers.atRisk }),
      evidence: { at_risk: metrics.customers.atRisk, dormant: metrics.customers.dormant, returning: metrics.customers.returning },
      recommendation: copy.retentionRecommendation,
      suggestedPrompt: copy.retentionPrompt,
      destinationPath: '/dashboard/customers',
      dedupeKey: 'customers:at_risk',
    });
  }

  if (settings.monitor_inventory && metrics.inventory.lowStock > 0) {
    alerts.push({
      category: 'inventory',
      severity: metrics.inventory.outOfStock > 0 ? 'critical' : 'warning',
      title: copy.inventoryTitle,
      summary: template(copy.inventorySummary, { low: metrics.inventory.lowStock, out: metrics.inventory.outOfStock }),
      evidence: { low_stock: metrics.inventory.lowStock, out_of_stock: metrics.inventory.outOfStock, products: metrics.inventory.lowStockNames },
      recommendation: copy.inventoryRecommendation,
      suggestedPrompt: copy.inventoryPrompt,
      destinationPath: '/dashboard/products',
      dedupeKey: 'inventory:low_stock',
    });
  }

  if (settings.monitor_marketing_performance && metrics.marketing.delivered >= 5 && metrics.marketing.converted === 0) {
    alerts.push({
      category: 'marketing',
      severity: 'opportunity',
      title: copy.marketingTitle,
      summary: template(copy.marketingSummary, { delivered: metrics.marketing.delivered }),
      evidence: { delivered: metrics.marketing.delivered, converted: metrics.marketing.converted, campaigns: metrics.marketing.campaigns },
      recommendation: copy.marketingRecommendation,
      suggestedPrompt: copy.marketingPrompt,
      destinationPath: '/dashboard/marketing',
      dedupeKey: 'marketing:no_conversions',
    });
  }

  if (metrics.appointments.nextSevenDays === 0 && metrics.appointments.total > 0) {
    alerts.push({
      category: 'scheduling',
      severity: 'opportunity',
      title: copy.capacityTitle,
      summary: copy.capacitySummary,
      evidence: { next_seven_days: 0, previous_30_day_appointments: metrics.appointments.total },
      recommendation: copy.capacityRecommendation,
      suggestedPrompt: copy.capacityPrompt,
      destinationPath: '/dashboard/calendar',
      dedupeKey: 'scheduling:empty_next_week',
    });
  }

  return alerts.slice(0, 8);
}

async function generateBriefing(input: {
  language: Language;
  business: Business;
  metrics: Metrics;
  alerts: AlertDraft[];
  healthScore: number;
}): Promise<BriefingDraft> {
  if (!OPENAI_API_KEY) return deterministicBriefing(input);

  const languageName: Record<Language, string> = { en: 'English', el: 'Greek', de: 'German', es: 'Spanish', tr: 'Turkish' };
  const instructions = `You are Velliqo AI Manager. Produce a concise daily executive briefing for a salon or barbershop owner in ${languageName[input.language]}. Use only supplied aggregate facts. Never invent causes, customers or completed actions. Distinguish measurable facts from recommendations. Prioritize at most four items. Return strict JSON only.`;

  const payload = {
    model: OPENAI_MODEL,
    store: false,
    reasoning: { effort: 'low' },
    input: [
      { role: 'system', content: instructions },
      { role: 'user', content: JSON.stringify({ business: input.business, health_score: input.healthScore, metrics: input.metrics, detected_alerts: input.alerts }) },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'velliqo_daily_manager_briefing',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary', 'priorities', 'recommended_prompts'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            priorities: {
              type: 'array',
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['category', 'severity', 'title', 'explanation', 'next_step'],
                properties: {
                  category: { type: 'string', enum: ['business_health', 'finance', 'customers', 'scheduling', 'staff', 'services', 'inventory', 'marketing'] },
                  severity: { type: 'string', enum: ['info', 'opportunity', 'warning', 'critical'] },
                  title: { type: 'string' },
                  explanation: { type: 'string' },
                  next_step: { type: 'string' },
                },
              },
            },
            recommended_prompts: { type: 'array', maxItems: 4, items: { type: 'string' } },
          },
        },
      },
    },
  };

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed with status ${response.status}`);
    const outputText = extractResponseText(data);
    if (!outputText) throw new Error('OpenAI returned an empty response');
    const parsed = JSON.parse(outputText);
    return {
      title: String(parsed.title || '').trim(),
      summary: String(parsed.summary || '').trim(),
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 4) : [],
      recommended_prompts: Array.isArray(parsed.recommended_prompts) ? parsed.recommended_prompts.map(String).filter(Boolean).slice(0, 4) : [],
      provider: 'openai',
      model: String(data?.model || OPENAI_MODEL),
      inputTokens: Number(data?.usage?.input_tokens || 0),
      outputTokens: Number(data?.usage?.output_tokens || 0),
    };
  } catch (error) {
    console.error('OpenAI proactive briefing failed; using deterministic fallback', errorMessage(error));
    return deterministicBriefing(input);
  }
}

function deterministicBriefing(input: {
  language: Language;
  business: Business;
  metrics: Metrics;
  alerts: AlertDraft[];
  healthScore: number;
}): BriefingDraft {
  const copy = copies(input.language);
  const priorities = input.alerts.slice(0, 4).map((alert) => ({
    category: alert.category,
    severity: alert.severity,
    title: alert.title,
    explanation: alert.summary,
    next_step: alert.recommendation,
  }));
  if (!priorities.length) {
    priorities.push({
      category: 'business_health',
      severity: 'info',
      title: copy.stableTitle,
      explanation: template(copy.stableSummary, { score: input.healthScore }),
      next_step: copy.stableRecommendation,
    });
  }
  return {
    title: template(copy.briefingTitle, { business: input.business.name }),
    summary: template(copy.briefingSummary, {
      score: input.healthScore,
      appointments: input.metrics.appointments.total,
      revenue: input.metrics.finance.revenue.toFixed(2),
      currency: input.business.currency || 'EUR',
      alerts: input.alerts.length,
    }),
    priorities,
    recommended_prompts: [copy.promptBusiness, copy.promptRevenue, copy.promptSchedule, copy.promptCustomers],
    provider: 'velliqo_free',
    model: 'velliqo-proactive-v1',
    inputTokens: 0,
    outputTokens: 0,
  };
}

function calculateHealthScore(metrics: Metrics) {
  let score = 80;
  if (metrics.appointments.noShowRate >= 10) score -= 15;
  else if (metrics.appointments.noShowRate >= 5) score -= 7;
  if (metrics.appointments.cancellationRate >= 15) score -= 10;
  if (metrics.finance.previousRevenue > 0 && metrics.finance.revenueChangePercent <= -20) score -= 15;
  else if (metrics.finance.revenueChangePercent >= 10) score += 5;
  if (metrics.finance.estimatedProfit < 0) score -= 15;
  if (metrics.customers.atRisk > 0) score -= Math.min(10, metrics.customers.atRisk * 2);
  if (metrics.inventory.outOfStock > 0) score -= Math.min(10, metrics.inventory.outOfStock * 3);
  if (metrics.marketing.delivered > 0 && metrics.marketing.converted > 0) score += 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function copies(language: Language) {
  const all: Record<Language, Record<string, string>> = {
    en: {
      briefingTitle: '{{business}} daily manager briefing', briefingSummary: 'Health score {{score}}/100. {{appointments}} appointments and {{revenue}} {{currency}} collected revenue were recorded in the last 30 days. Velliqo identified {{alerts}} priority items.',
      revenueDropTitle: 'Revenue has declined', revenueDropSummary: 'Collected revenue is down {{value}}% compared with the previous 30-day period.', revenueDropRecommendation: 'Review daily sales, appointment completion and pricing before changing campaigns or staffing.', revenueDropPrompt: 'Analyse the revenue decline and prepare a recovery plan.',
      noShowTitle: 'No-shows are reducing capacity', noShowSummary: '{{count}} no-shows represent {{rate}}% of appointments.', noShowRecommendation: 'Review the affected days and prepare confirmation or recovery actions before changing policy.', noShowPrompt: 'Analyse my no-shows and recommend safe actions.',
      retentionTitle: 'Customers need re-engagement', retentionSummary: '{{count}} customers are currently in the at-risk window.', retentionRecommendation: 'Review consent and prepare a targeted win-back campaign draft.', retentionPrompt: 'Prepare a customer re-engagement plan for at-risk customers.',
      inventoryTitle: 'Inventory requires attention', inventorySummary: '{{low}} products are at or below minimum stock and {{out}} are out of stock.', inventoryRecommendation: 'Review affected products and suppliers before placing an order.', inventoryPrompt: 'Analyse low stock and prioritise the products I should reorder.',
      marketingTitle: 'Campaigns are not recording conversions', marketingSummary: '{{delivered}} campaign messages were delivered without a recorded conversion.', marketingRecommendation: 'Review the offer, audience and conversion tracking before increasing delivery volume.', marketingPrompt: 'Analyse campaign performance and prepare an improved draft.',
      capacityTitle: 'Next week has open capacity', capacitySummary: 'No active appointments are recorded for the next seven days.', capacityRecommendation: 'Verify the calendar and prepare a last-minute availability campaign draft if appropriate.', capacityPrompt: 'Review next week’s capacity and prepare a safe action plan.',
      stableTitle: 'Business performance is stable', stableSummary: 'The current aggregate health score is {{score}}/100 and no monitored threshold needs urgent attention.', stableRecommendation: 'Review the briefing and ask Velliqo to analyse the area that matters most today.',
      promptBusiness: 'Explain today’s business priorities in more detail.', promptRevenue: 'Analyse revenue and profit changes.', promptSchedule: 'Find scheduling and capacity opportunities.', promptCustomers: 'Find customer retention opportunities.',
    },
    el: {
      briefingTitle: 'Ημερήσια ενημέρωση διευθυντή για {{business}}', briefingSummary: 'Βαθμολογία υγείας {{score}}/100. Καταγράφηκαν {{appointments}} ραντεβού και εισπραγμένα έσοδα {{revenue}} {{currency}} τις τελευταίες 30 ημέρες. Το Velliqo εντόπισε {{alerts}} σημεία προτεραιότητας.',
      revenueDropTitle: 'Τα έσοδα έχουν μειωθεί', revenueDropSummary: 'Τα εισπραγμένα έσοδα μειώθηκαν κατά {{value}}% σε σύγκριση με την προηγούμενη περίοδο 30 ημερών.', revenueDropRecommendation: 'Ελέγξτε τις ημερήσιες πωλήσεις, την ολοκλήρωση ραντεβού και τις τιμές πριν αλλάξετε καμπάνιες ή στελέχωση.', revenueDropPrompt: 'Ανάλυσε τη μείωση εσόδων και ετοίμασε σχέδιο ανάκαμψης.',
      noShowTitle: 'Τα no-show μειώνουν τη χωρητικότητα', noShowSummary: '{{count}} no-show αντιστοιχούν στο {{rate}}% των ραντεβού.', noShowRecommendation: 'Ελέγξτε τις ημέρες που επηρεάζονται και ετοιμάστε ενέργειες επιβεβαίωσης ή επαναπροσέγγισης πριν αλλάξετε πολιτική.', noShowPrompt: 'Ανάλυσε τα no-show και πρότεινε ασφαλείς ενέργειες.',
      retentionTitle: 'Πελάτες χρειάζονται επαναπροσέγγιση', retentionSummary: '{{count}} πελάτες βρίσκονται στο παράθυρο κινδύνου αδράνειας.', retentionRecommendation: 'Ελέγξτε τη συγκατάθεση και ετοιμάστε στοχευμένη πρόχειρη καμπάνια επιστροφής.', retentionPrompt: 'Ετοίμασε σχέδιο επαναπροσέγγισης για τους πελάτες σε κίνδυνο.',
      inventoryTitle: 'Το απόθεμα χρειάζεται προσοχή', inventorySummary: '{{low}} προϊόντα βρίσκονται στο ή κάτω από το ελάχιστο απόθεμα και {{out}} έχουν εξαντληθεί.', inventoryRecommendation: 'Ελέγξτε τα προϊόντα και τους προμηθευτές πριν γίνει παραγγελία.', inventoryPrompt: 'Ανάλυσε το χαμηλό απόθεμα και βάλε προτεραιότητα στις αναπαραγγελίες.',
      marketingTitle: 'Οι καμπάνιες δεν καταγράφουν μετατροπές', marketingSummary: 'Παραδόθηκαν {{delivered}} μηνύματα καμπάνιας χωρίς καταγεγραμμένη μετατροπή.', marketingRecommendation: 'Ελέγξτε την προσφορά, το κοινό και την καταγραφή μετατροπών πριν αυξήσετε τις αποστολές.', marketingPrompt: 'Ανάλυσε την απόδοση καμπανιών και ετοίμασε βελτιωμένο πρόχειρο.',
      capacityTitle: 'Η επόμενη εβδομάδα έχει διαθέσιμη χωρητικότητα', capacitySummary: 'Δεν υπάρχουν ενεργά ραντεβού για τις επόμενες επτά ημέρες.', capacityRecommendation: 'Επιβεβαιώστε το ημερολόγιο και ετοιμάστε πρόχειρη καμπάνια τελευταίας στιγμής όπου χρειάζεται.', capacityPrompt: 'Έλεγξε τη χωρητικότητα της επόμενης εβδομάδας και ετοίμασε ασφαλές σχέδιο.',
      stableTitle: 'Η απόδοση της επιχείρησης είναι σταθερή', stableSummary: 'Η τρέχουσα συγκεντρωτική βαθμολογία υγείας είναι {{score}}/100 και κανένα παρακολουθούμενο όριο δεν χρειάζεται επείγουσα ενέργεια.', stableRecommendation: 'Ελέγξτε την ενημέρωση και ζητήστε από το Velliqo ανάλυση της σημαντικότερης ενότητας.',
      promptBusiness: 'Εξήγησε πιο αναλυτικά τις σημερινές επιχειρηματικές προτεραιότητες.', promptRevenue: 'Ανάλυσε τις αλλαγές εσόδων και κέρδους.', promptSchedule: 'Βρες ευκαιρίες στο πρόγραμμα και τη χωρητικότητα.', promptCustomers: 'Βρες ευκαιρίες διατήρησης πελατών.',
    },
    de: {
      briefingTitle: 'Tägliches Manager-Briefing für {{business}}', briefingSummary: 'Gesundheitswert {{score}}/100. In den letzten 30 Tagen wurden {{appointments}} Termine und {{revenue}} {{currency}} vereinnahmte Umsätze erfasst. Velliqo hat {{alerts}} Prioritäten erkannt.',
      revenueDropTitle: 'Der Umsatz ist gesunken', revenueDropSummary: 'Der vereinnahmte Umsatz liegt {{value}}% unter dem vorherigen 30-Tage-Zeitraum.', revenueDropRecommendation: 'Prüfen Sie Tagesumsätze, Terminabschlüsse und Preise, bevor Sie Kampagnen oder Personal ändern.', revenueDropPrompt: 'Analysiere den Umsatzrückgang und erstelle einen Erholungsplan.',
      noShowTitle: 'Nichterscheinen reduziert die Kapazität', noShowSummary: '{{count}} Nichterscheinen entsprechen {{rate}}% der Termine.', noShowRecommendation: 'Prüfen Sie betroffene Tage und bereiten Sie Bestätigungs- oder Rückgewinnungsmaßnahmen vor.', noShowPrompt: 'Analysiere die Nichterscheinen und empfehle sichere Maßnahmen.',
      retentionTitle: 'Kunden benötigen Reaktivierung', retentionSummary: '{{count}} Kunden befinden sich im Risikofenster.', retentionRecommendation: 'Prüfen Sie Einwilligungen und bereiten Sie einen gezielten Rückgewinnungsentwurf vor.', retentionPrompt: 'Erstelle einen Reaktivierungsplan für gefährdete Kunden.',
      inventoryTitle: 'Der Bestand erfordert Aufmerksamkeit', inventorySummary: '{{low}} Produkte liegen am oder unter dem Mindestbestand, {{out}} sind ausverkauft.', inventoryRecommendation: 'Prüfen Sie Produkte und Lieferanten vor einer Bestellung.', inventoryPrompt: 'Analysiere den niedrigen Bestand und priorisiere Nachbestellungen.',
      marketingTitle: 'Kampagnen erfassen keine Conversions', marketingSummary: '{{delivered}} Kampagnennachrichten wurden ohne erfasste Conversion zugestellt.', marketingRecommendation: 'Prüfen Sie Angebot, Zielgruppe und Tracking vor höherem Versandvolumen.', marketingPrompt: 'Analysiere die Kampagnenleistung und erstelle einen verbesserten Entwurf.',
      capacityTitle: 'Nächste Woche ist Kapazität frei', capacitySummary: 'Für die nächsten sieben Tage sind keine aktiven Termine erfasst.', capacityRecommendation: 'Prüfen Sie den Kalender und bereiten Sie gegebenenfalls eine Last-Minute-Kampagne vor.', capacityPrompt: 'Prüfe die Kapazität der nächsten Woche und erstelle einen sicheren Plan.',
      stableTitle: 'Die Unternehmensleistung ist stabil', stableSummary: 'Der aktuelle Gesundheitswert beträgt {{score}}/100 und kein überwachter Schwellenwert erfordert dringende Aufmerksamkeit.', stableRecommendation: 'Prüfen Sie das Briefing und lassen Sie Velliqo den wichtigsten Bereich analysieren.',
      promptBusiness: 'Erkläre die heutigen Unternehmensprioritäten genauer.', promptRevenue: 'Analysiere Umsatz- und Gewinnveränderungen.', promptSchedule: 'Finde Termin- und Kapazitätschancen.', promptCustomers: 'Finde Chancen zur Kundenbindung.',
    },
    es: {
      briefingTitle: 'Informe diario de gestión de {{business}}', briefingSummary: 'Puntuación de salud {{score}}/100. En los últimos 30 días se registraron {{appointments}} citas y {{revenue}} {{currency}} de ingresos cobrados. Velliqo detectó {{alerts}} prioridades.',
      revenueDropTitle: 'Los ingresos han disminuido', revenueDropSummary: 'Los ingresos cobrados bajaron un {{value}}% frente al período anterior de 30 días.', revenueDropRecommendation: 'Revise ventas diarias, finalización de citas y precios antes de cambiar campañas o personal.', revenueDropPrompt: 'Analiza la caída de ingresos y prepara un plan de recuperación.',
      noShowTitle: 'Las ausencias reducen la capacidad', noShowSummary: '{{count}} ausencias representan el {{rate}}% de las citas.', noShowRecommendation: 'Revise los días afectados y prepare acciones de confirmación o recuperación.', noShowPrompt: 'Analiza las ausencias y recomienda acciones seguras.',
      retentionTitle: 'Clientes necesitan reactivación', retentionSummary: '{{count}} clientes están en la ventana de riesgo.', retentionRecommendation: 'Revise el consentimiento y prepare un borrador de campaña de recuperación.', retentionPrompt: 'Prepara un plan de reactivación para clientes en riesgo.',
      inventoryTitle: 'El inventario requiere atención', inventorySummary: '{{low}} productos están en o por debajo del mínimo y {{out}} están agotados.', inventoryRecommendation: 'Revise productos y proveedores antes de realizar pedidos.', inventoryPrompt: 'Analiza el inventario bajo y prioriza los pedidos.',
      marketingTitle: 'Las campañas no registran conversiones', marketingSummary: 'Se entregaron {{delivered}} mensajes sin una conversión registrada.', marketingRecommendation: 'Revise oferta, audiencia y seguimiento antes de aumentar el volumen.', marketingPrompt: 'Analiza el rendimiento de campañas y prepara un borrador mejorado.',
      capacityTitle: 'La próxima semana tiene capacidad disponible', capacitySummary: 'No hay citas activas registradas para los próximos siete días.', capacityRecommendation: 'Verifique el calendario y prepare una campaña de última hora si corresponde.', capacityPrompt: 'Revisa la capacidad de la próxima semana y prepara un plan seguro.',
      stableTitle: 'El rendimiento del negocio es estable', stableSummary: 'La puntuación agregada actual es {{score}}/100 y ningún umbral requiere atención urgente.', stableRecommendation: 'Revise el informe y pida a Velliqo que analice el área más importante.',
      promptBusiness: 'Explica con más detalle las prioridades de hoy.', promptRevenue: 'Analiza cambios en ingresos y beneficio.', promptSchedule: 'Encuentra oportunidades de agenda y capacidad.', promptCustomers: 'Encuentra oportunidades de retención.',
    },
    tr: {
      briefingTitle: '{{business}} günlük yönetici özeti', briefingSummary: 'Sağlık puanı {{score}}/100. Son 30 günde {{appointments}} randevu ve {{revenue}} {{currency}} tahsil edilmiş gelir kaydedildi. Velliqo {{alerts}} öncelik belirledi.',
      revenueDropTitle: 'Gelir azaldı', revenueDropSummary: 'Tahsil edilen gelir önceki 30 günlük döneme göre %{{value}} düştü.', revenueDropRecommendation: 'Kampanya veya personel değişikliğinden önce günlük satışları, tamamlanan randevuları ve fiyatları inceleyin.', revenueDropPrompt: 'Gelir düşüşünü analiz et ve toparlanma planı hazırla.',
      noShowTitle: 'Gelmemeler kapasiteyi azaltıyor', noShowSummary: '{{count}} gelmeme, randevuların %{{rate}} oranına karşılık geliyor.', noShowRecommendation: 'Etkilenen günleri inceleyin ve politika değişikliğinden önce doğrulama veya geri kazanım adımları hazırlayın.', noShowPrompt: 'Gelmeme oranını analiz et ve güvenli eylemler öner.',
      retentionTitle: 'Müşterilerin yeniden kazanılması gerekiyor', retentionSummary: '{{count}} müşteri risk penceresinde.', retentionRecommendation: 'Onayları kontrol edin ve hedefli bir geri kazanım kampanyası taslağı hazırlayın.', retentionPrompt: 'Risk altındaki müşteriler için yeniden kazanım planı hazırla.',
      inventoryTitle: 'Stok dikkat gerektiriyor', inventorySummary: '{{low}} ürün minimum stokta veya altında, {{out}} ürün tükenmiş.', inventoryRecommendation: 'Sipariş vermeden önce ürünleri ve tedarikçileri inceleyin.', inventoryPrompt: 'Düşük stoğu analiz et ve yeniden siparişleri önceliklendir.',
      marketingTitle: 'Kampanyalar dönüşüm kaydetmiyor', marketingSummary: '{{delivered}} kampanya mesajı dönüşüm kaydı olmadan teslim edildi.', marketingRecommendation: 'Gönderim hacmini artırmadan önce teklifi, hedef kitleyi ve takibi inceleyin.', marketingPrompt: 'Kampanya performansını analiz et ve geliştirilmiş taslak hazırla.',
      capacityTitle: 'Gelecek hafta boş kapasite var', capacitySummary: 'Önümüzdeki yedi gün için aktif randevu kaydı yok.', capacityRecommendation: 'Takvimi doğrulayın ve uygun olduğunda son dakika kampanyası taslağı hazırlayın.', capacityPrompt: 'Gelecek haftanın kapasitesini incele ve güvenli plan hazırla.',
      stableTitle: 'İşletme performansı istikrarlı', stableSummary: 'Mevcut toplam sağlık puanı {{score}}/100 ve izlenen eşiklerden hiçbiri acil dikkat gerektirmiyor.', stableRecommendation: 'Özeti inceleyin ve Velliqo’dan en önemli alanı analiz etmesini isteyin.',
      promptBusiness: 'Bugünün iş önceliklerini daha ayrıntılı açıkla.', promptRevenue: 'Gelir ve kâr değişikliklerini analiz et.', promptSchedule: 'Program ve kapasite fırsatlarını bul.', promptCustomers: 'Müşteri tutma fırsatlarını bul.',
    },
  };
  return all[language];
}

function extractResponseText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text;
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') return content.text;
    }
  }
  return '';
}

function estimateOpenAICost(model: string, inputTokens: number, outputTokens: number) {
  const normalized = model.toLowerCase();
  const inputPerMillion = normalized.includes('gpt-5-mini') ? 0.25 : 1.25;
  const outputPerMillion = normalized.includes('gpt-5-mini') ? 2 : 10;
  return round6((inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion);
}

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, item) => {
    if (item.type !== 'literal') result[item.type] = item.value;
    return result;
  }, {});
  const hour = Number(parts.hour === '24' ? '0' : parts.hour || 0);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute || 0),
  };
}

function safeTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return value;
  } catch {
    return 'UTC';
  }
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return Math.max(0, Math.min(1439, (Number.isFinite(hour) ? hour : 8) * 60 + (Number.isFinite(minute) ? minute : 0)));
}

function normalizeLanguage(value: unknown): Language {
  const language = String(value || 'en').slice(0, 2).toLowerCase();
  return ['en', 'el', 'de', 'es', 'tr'].includes(language) ? language as Language : 'en';
}

function secureEquals(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function template(value: string, variables: Record<string, unknown>) {
  return Object.entries(variables).reduce((result, [key, replacement]) => result.replaceAll(`{{${key}}}`, String(replacement)), value);
}

function sum(values: number[]) { return values.reduce((total, value) => total + Number(value || 0), 0); }
function round2(value: number) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
function round6(value: number) { return Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) / 1_000_000; }
function percent(numerator: number, denominator: number) { return denominator > 0 ? round2((numerator / denominator) * 100) : 0; }
function percentChange(current: number, previous: number) { return previous > 0 ? round2(((current - previous) / previous) * 100) : current > 0 ? 100 : 0; }
function addDaysIso(days: number) { return new Date(Date.now() + days * 86_400_000).toISOString(); }
function escapePostgrestValue(value: string) { return `"${value.replaceAll('"', '\\"')}"`; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ai-automation-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }); }
