import React from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BILLING_PLANS, BILLING_TRIAL_DAYS, formatPlanCurrency } from '@/billing/plans';

const faqs = [
  {
    question: 'How does the 14-day free trial work?',
    answer: 'Choose a plan, create your business and add billing details through Stripe. Your card is saved securely but you are not charged when the trial starts. Unless you cancel first, Stripe automatically charges the selected monthly plan after the 14-day trial.',
  },
  {
    question: 'Can I upgrade, downgrade or cancel?',
    answer: 'Yes. Billing controls let the business owner manage the payment method, invoices, subscription changes and cancellation. Normal monthly plans continue renewing until you cancel or change them.',
  },
  {
    question: 'What is different about Staff Apps?',
    answer: 'Standard includes the secure browser Staff Portal but not downloadable personal Staff Apps. Pro and Premium include installable Staff Apps for eligible team members.',
  },
  {
    question: 'Why are Velliqo AI and communications limited by plan?',
    answer: 'AI generation, email and SMS create real usage costs. Clear monthly allowances keep pricing predictable while giving larger businesses higher capacity on Pro and Premium.',
  },
  {
    question: 'How do special offer codes work?',
    answer: 'Some invitation or promotion codes can grant a selected plan for a fixed period such as six or twelve months, with an optional discount. Fixed-term offers are explicitly non-renewing and stop automatically at their stated end date.',
  },
  {
    question: 'Are payment processing fees for customer sales included?',
    answer: 'These prices cover the Velliqo SaaS subscription. If customer card-payment processing is enabled later, applicable payment processing fees are separate from the Velliqo subscription.',
  },
];

export default function Pricing() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950">
      <MarketingHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(124,58,237,.20),transparent_31%),radial-gradient(circle_at_82%_4%,rgba(217,70,239,.12),transparent_26%)]" />
          <div className="relative mx-auto max-w-[1280px] px-4 pb-20 pt-20 text-center sm:px-6 lg:px-8 lg:pb-28 lg:pt-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700"><Sparkles className="h-4 w-4" />Plans built around real operating capacity</div>
            <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">Choose the Velliqo capacity that fits your business.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">All plans start with a {BILLING_TRIAL_DAYS}-day free trial. Billing details are added securely up front, then your selected monthly plan renews automatically unless you change or cancel it.</p>
          </div>
        </section>

        <section className="relative -mt-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-3">
            {BILLING_PLANS.map((plan) => (
              <article key={plan.id} className={`relative overflow-hidden rounded-[2rem] border bg-white shadow-[0_24px_80px_rgba(15,23,42,.10)] ${plan.highlighted ? 'border-violet-400 ring-4 ring-violet-100' : 'border-slate-200'}`}>
                {plan.highlighted && <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2 text-center text-xs font-extrabold uppercase tracking-[.16em] text-white">Most popular</div>}
                <div className="p-7 sm:p-8">
                  <div className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-extrabold">{plan.name}</h2><p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">{plan.description}</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">{plan.id === 'standard' ? <Users className="h-5 w-5" /> : plan.id === 'pro' ? <Zap className="h-5 w-5" /> : <WandSparkles className="h-5 w-5" />}</div></div>
                  <div className="mt-6 flex items-end gap-2"><span className="text-5xl font-black tracking-[-.055em]">{formatPlanCurrency(plan.price)}</span><span className="pb-1 text-sm font-semibold text-slate-500">/ month</span></div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700"><Sparkles className="h-4 w-4" />{BILLING_TRIAL_DAYS} days free · billing details added before trial</div>
                  <div className="mt-7 space-y-3 text-sm">
                    <Feature text={`Up to ${plan.staffLimit} staff members`} />
                    <Feature text={plan.staffAppInstall ? 'Personal downloadable Staff Apps' : 'Secure browser Staff Portal'} />
                    <Feature text={`${plan.aiRequestsMonthly.toLocaleString()} Velliqo AI requests / month`} />
                    <Feature text={`${plan.emailMonthly.toLocaleString()} email communications / month`} />
                    <Feature text={`${plan.smsMonthly.toLocaleString()} SMS communications / month`} />
                    <Feature text={plan.advancedReports ? 'Advanced reporting and intelligence' : 'Core business reports'} />
                    <Feature text={plan.aiAutomations ? 'AI operational automations' : 'AI chat with controlled monthly allowance'} />
                  </div>
                  <Button asChild size="lg" className={`mt-8 h-12 w-full rounded-xl ${plan.highlighted ? 'bg-violet-600 hover:bg-violet-700' : ''}`} variant={plan.highlighted ? 'default' : 'outline'}><Link to={`/sign-up?plan=${plan.id}`}>Start {plan.name} free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">How billing works</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">No surprise activation after signup.</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">The payment method is collected through Stripe before the trial is activated, so the business knows exactly which plan will start after day 14.</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            <Step number="01" title="Choose your plan" text="Select Standard, Pro or Premium while creating the business account." />
            <Step number="02" title="Add billing details" text="Stripe securely stores the payment method. Velliqo never stores raw card details." />
            <Step number="03" title="Use 14 days free" text="The selected plan and its feature limits are active during the trial with no subscription charge." />
            <Step number="04" title="Continue automatically" text="After the trial, the selected plan renews monthly unless you cancel, upgrade or downgrade." />
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm leading-6 text-violet-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Fixed-term offers are different:</strong> a Velliqo offer code can define a six- or twelve-month plan term. Those subscriptions are scheduled to stop automatically and do not silently become an ongoing monthly subscription after the stated offer period.</p></div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
              <div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><CreditCard className="h-5 w-5" /></div><h2 className="mt-5 text-3xl font-extrabold tracking-tight">Billing questions</h2><p className="mt-4 text-sm leading-6 text-slate-600">The owner always retains direct billing controls, invoice access and clear visibility of renewal behaviour.</p></div>
              <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
                {faqs.map((faq, index) => <button key={faq.question} type="button" className="w-full border-b border-slate-200 bg-white p-5 text-left last:border-b-0 sm:p-6" onClick={() => setOpenFaq(openFaq === index ? null : index)}><div className="flex items-center justify-between gap-4"><span className="text-sm font-extrabold sm:text-base">{faq.question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${openFaq === index ? 'rotate-180' : ''}`} /></div>{openFaq === index && <p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{faq.answer}</p>}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-950 text-white"><div className="mx-auto max-w-[1280px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20"><Sparkles className="mx-auto h-9 w-9 text-violet-300" /><h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Choose your plan, set up the business and activate your 14-day trial.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60">Your billing method is handled securely by Stripe and the plan can be managed later from the Owner Billing workspace.</p><Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/sign-up?plan=pro">Start with Pro <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Feature({ text }: { text: string }) { return <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" /></span><span>{text}</span></div>; }
function Step({ number, title, text }: { number: string; title: string; text: string }) { return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,23,42,.06)]"><div className="text-xs font-black tracking-[.18em] text-violet-400">{number}</div><h3 className="mt-4 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>; }
function MarketingHeader({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>> }) { return <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex"><Link to="/">Product</Link><Link to="/velliqo-ai">Velliqo AI</Link><Link to="/why-velliqo">Why Velliqo?</Link><Link to="/pricing" className="text-violet-700">Pricing</Link><Link to="/business-types">Business types</Link><Link to="/contact">Contact</Link></nav><div className="flex items-center gap-2"><Button asChild variant="ghost" className="hidden rounded-xl sm:inline-flex"><Link to="/sign-in">Business login</Link></Button><Button asChild className="hidden rounded-xl bg-violet-600 px-5 hover:bg-violet-700 sm:inline-flex"><Link to="/sign-up?plan=pro">Start free</Link></Button><Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button></div></div>{menuOpen && <div className="border-t bg-white p-4 lg:hidden"><div className="grid gap-2"><Link to="/" className="rounded-xl px-3 py-2 text-sm font-semibold">Product</Link><Link to="/velliqo-ai" className="rounded-xl px-3 py-2 text-sm font-semibold">Velliqo AI</Link><Link to="/why-velliqo" className="rounded-xl px-3 py-2 text-sm font-semibold">Why Velliqo?</Link><Link to="/pricing" className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">Pricing</Link><Link to="/business-types" className="rounded-xl px-3 py-2 text-sm font-semibold">Business types</Link></div></div>}</header>; }
function Brand() { return <Link to="/" className="flex items-center gap-3"><img src="/brand/velliqo-mark-transparent-v2.png" alt="Velliqo" className="h-10 w-10 object-contain" /><div><div className="text-sm font-extrabold tracking-tight">Velliqo</div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Book. Manage. Grow.</div></div></Link>; }
function MarketingFooter() { return <footer className="border-t border-white/10 bg-slate-950 text-white"><div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><Brand /><div className="flex flex-wrap gap-5 text-xs font-semibold text-white/55"><Link to="/why-velliqo">Why Velliqo?</Link><Link to="/pricing">Pricing</Link><Link to="/business-types">Business types</Link><Link to="/contact">Contact</Link></div><div className="text-xs text-white/40">© 2026 Velliqo</div></div></footer>; }
