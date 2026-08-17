import React from 'react';
import { ArrowRight, Check, ChevronDown, CreditCard, ShieldCheck, Sparkles, Users, WandSparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BILLING_PLANS, BILLING_TRIAL_DAYS, formatPlanCurrency } from '@/billing/plans';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';

export default function Pricing() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const faqs = t('marketingSite.pages.pricing.faqs', { returnObjects: true }) as Array<{ q: string; a: string }>;
  const steps = t('marketingSite.pages.pricing.steps', { returnObjects: true }) as Array<{ title: string; text: string }>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950">
      <MarketingHeader active="pricing" />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(124,58,237,.20),transparent_31%),radial-gradient(circle_at_82%_4%,rgba(217,70,239,.12),transparent_26%)]" />
          <div className="relative mx-auto max-w-[1280px] px-4 pb-20 pt-20 text-center sm:px-6 lg:px-8 lg:pb-28 lg:pt-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700"><Sparkles className="h-4 w-4" />{t('marketingSite.pages.pricing.badge')}</div>
            <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">{t('marketingSite.pages.pricing.title')}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{t('marketingSite.pages.pricing.description', { days: BILLING_TRIAL_DAYS })}</p>
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" />{t('marketingSite.pages.pricing.vat')}</div>
          </div>
        </section>

        <section className="relative -mt-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-3">
            {BILLING_PLANS.map((plan) => {
              const planName = t(`marketingSite.pages.pricing.plans.${plan.id}.name`);
              return (
                <article key={plan.id} className={`relative overflow-hidden rounded-[2rem] border bg-white shadow-[0_24px_80px_rgba(15,23,42,.10)] ${plan.highlighted ? 'border-violet-400 ring-4 ring-violet-100' : 'border-slate-200'}`}>
                  {plan.highlighted && <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2 text-center text-xs font-extrabold uppercase tracking-[.16em] text-white">{t('marketingSite.pages.pricing.mostPopular')}</div>}
                  <div className="p-7 sm:p-8">
                    <div className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-extrabold">{planName}</h2><p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">{t(`marketingSite.pages.pricing.plans.${plan.id}.description`)}</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">{plan.id === 'standard' ? <Users className="h-5 w-5" /> : plan.id === 'pro' ? <Zap className="h-5 w-5" /> : <WandSparkles className="h-5 w-5" />}</div></div>
                    <div className="mt-6 flex items-end gap-2"><span className="text-5xl font-black tracking-[-.055em]">{formatPlanCurrency(plan.price, locale)}</span><span className="pb-1 text-sm font-semibold text-slate-500">{t('marketingSite.pages.pricing.perMonth')}</span></div>
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700"><Sparkles className="h-4 w-4" />{t('marketingSite.pages.pricing.trialLine', { days: BILLING_TRIAL_DAYS })}</div>
                    <div className="mt-7 space-y-3 text-sm">
                      <Feature text={t('marketingSite.pages.pricing.staff', { count: plan.staffLimit })} />
                      <Feature text={t(plan.staffAppInstall ? 'marketingSite.pages.pricing.personalApps' : 'marketingSite.pages.pricing.browserPortal')} />
                      <Feature text={t('marketingSite.pages.pricing.ai', { count: plan.aiRequestsMonthly.toLocaleString() })} />
                      <Feature text={t('marketingSite.pages.pricing.email', { count: plan.emailMonthly.toLocaleString() })} />
                      <Feature text={t('marketingSite.pages.pricing.sms', { count: plan.smsMonthly.toLocaleString() })} />
                      <Feature text={t(plan.advancedReports ? 'marketingSite.pages.pricing.advancedReports' : 'marketingSite.pages.pricing.coreReports')} />
                      <Feature text={t(plan.aiAutomations ? 'marketingSite.pages.pricing.aiAutomations' : 'marketingSite.pages.pricing.aiChat')} />
                    </div>
                    <Button asChild size="lg" className={`mt-8 h-12 w-full rounded-xl ${plan.highlighted ? 'bg-violet-600 hover:bg-violet-700' : ''}`} variant={plan.highlighted ? 'default' : 'outline'}><Link to={`/sign-up?plan=${plan.id}`}>{t('marketingSite.pages.pricing.start', { plan: planName })}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{t('marketingSite.pages.pricing.billingEyebrow')}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">{t('marketingSite.pages.pricing.billingTitle')}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">{t('marketingSite.pages.pricing.billingText')}</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-4">{steps.map((step, index) => <Step key={step.title} number={String(index + 1).padStart(2, '0')} title={step.title} text={step.text} />)}</div>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm leading-6 text-violet-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>{t('marketingSite.pages.pricing.fixedTitle')}</strong> {t('marketingSite.pages.pricing.fixedText')}</p></div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
              <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><CreditCard className="h-5 w-5" /></div><h2 className="mt-5 text-3xl font-extrabold tracking-tight">{t('marketingSite.pages.pricing.questionsTitle')}</h2><p className="mt-4 text-sm leading-6 text-slate-600">{t('marketingSite.pages.pricing.questionsText')}</p></div>
              <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">{faqs.map((faq, index) => <button key={faq.q} type="button" className="w-full border-b border-slate-200 bg-white p-5 text-left last:border-b-0 sm:p-6" onClick={() => setOpenFaq(openFaq === index ? null : index)}><div className="flex items-center justify-between gap-4"><span className="text-sm font-extrabold sm:text-base">{faq.q}</span><ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${openFaq === index ? 'rotate-180' : ''}`} /></div>{openFaq === index && <p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{faq.a}</p>}</button>)}</div>
            </div>
          </div>
        </section>

        <section className="bg-slate-950 text-white"><div className="mx-auto max-w-[1280px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20"><Sparkles className="mx-auto h-9 w-9 text-violet-300" /><h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t('marketingSite.pages.pricing.ctaTitle')}</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60">{t('marketingSite.pages.pricing.ctaText')}</p><Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/sign-up?plan=pro">{t('marketingSite.pages.pricing.ctaButton')}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Feature({ text }: { text: string }) { return <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" /></span><span>{text}</span></div>; }
function Step({ number, title, text }: { number: string; title: string; text: string }) { return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,23,42,.06)]"><div className="text-xs font-black tracking-[.18em] text-violet-400">{number}</div><h3 className="mt-4 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>; }
