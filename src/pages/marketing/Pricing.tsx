import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  LockKeyhole,
  Menu,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const faqs = [
  {
    question: 'When does payment begin?',
    answer:
      'The first 14 days are free. No card is required to create your workspace. Billing begins only after you actively choose to continue with the paid plan and complete checkout.',
  },
  {
    question: 'Can I cancel at any time?',
    answer:
      'Yes. The launch plan is designed as a monthly subscription with no long-term contract. Cancellation stops future renewals while your existing paid period remains available until its end date.',
  },
  {
    question: 'Are there separate charges for each feature?',
    answer:
      'No. The Velliqo Complete plan is intentionally simple: the core platform is included in one monthly price instead of splitting essential tools into multiple add-ons.',
  },
  {
    question: 'Are payment processing fees included?',
    answer:
      'The subscription covers use of Velliqo. Any future card-payment processing fees for customer transactions will be displayed separately before that functionality is enabled.',
  },
  {
    question: 'Will the price change?',
    answer:
      '€19.99 is the planned introductory monthly price. Any future pricing change will be communicated clearly in advance and will never be applied without notice.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer:
      'Before launch, Velliqo will publish a clear retention and export policy. The goal is to give businesses enough time to export relevant records before permanent deletion.',
  },
];

const included = [
  { icon: CalendarDays, title: 'Appointments and calendar', text: 'Daily, weekly and monthly scheduling, availability and appointment management.' },
  { icon: Users, title: 'Staff and customers', text: 'Team profiles, customer records, history and business relationships in one place.' },
  { icon: Store, title: 'Online storefront', text: 'A professional public page where customers can discover and book services.' },
  { icon: BarChart3, title: 'Reports and insights', text: 'Revenue, appointments, completion rates, customers and service performance.' },
  { icon: FileText, title: 'Services and content', text: 'Services, products, gallery, posts and business information.' },
  { icon: ShieldCheck, title: 'Secure workspace', text: 'Business data separation, protected access and role-aware workspaces.' },
];

const delivery = [
  {
    phase: 'Available in the platform foundation',
    status: 'Current',
    tone: 'emerald',
    items: ['Business onboarding', 'Calendar and appointments', 'Staff and customer management', 'Services', 'Reports', 'Products and inventory', 'Posts, gallery and storefront'],
  },
  {
    phase: 'Completed before public paid launch',
    status: 'Launch commitment',
    tone: 'violet',
    items: ['Production Stripe checkout', 'Subscription management portal', 'Trial and billing controls', 'Transactional email delivery', 'Security and RLS audit', 'Monitoring and production deployment', 'Legal and privacy documentation'],
  },
  {
    phase: 'Planned product evolution',
    status: 'Roadmap',
    tone: 'slate',
    items: ['Velliqo Academy', 'Advanced notifications', 'Progressive Web App experience', 'Additional industry modules', 'AI-assisted support and workflows', 'Expanded analytics and automation'],
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(124,58,237,.18),transparent_30%),radial-gradient(circle_at_87%_5%,rgba(217,70,239,.12),transparent_27%)]" />
          <div className="relative mx-auto max-w-[1280px] px-4 pb-16 pt-20 text-center sm:px-6 lg:px-8 lg:pb-24 lg:pt-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700">
              <Sparkles className="h-4 w-4" /> Clear pricing. No feature maze.
            </div>
            <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              One complete plan for running your service business.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Start free, understand the whole platform and decide with confidence. Velliqo is being designed around one transparent subscription instead of essential features hidden behind upgrades.
            </p>
          </div>
        </section>

        <section className="relative -mt-8 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1180px] overflow-hidden rounded-[2rem] border border-violet-200 bg-white shadow-[0_32px_100px_rgba(76,29,149,.16)] lg:grid-cols-[.95fr_1.05fr]">
            <div className="bg-gradient-to-br from-violet-700 via-violet-650 to-fuchsia-600 p-7 text-white sm:p-10 lg:p-12">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-extrabold uppercase tracking-[0.18em] text-white/70">Velliqo Complete</div>
                  <div className="mt-2 text-sm text-white/65">Introductory monthly subscription</div>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">14 days free</span>
              </div>
              <div className="mt-9 flex items-end gap-2">
                <span className="text-6xl font-extrabold tracking-[-0.06em]">€19.99</span>
                <span className="pb-2 text-sm font-semibold text-white/70">/ month</span>
              </div>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/72">No card required for the trial. Continue only after reviewing the platform and actively choosing the paid subscription.</p>
              <Button asChild size="lg" className="mt-8 h-12 w-full rounded-xl bg-white text-violet-800 hover:bg-white/90">
                <Link to="/business-types">Start your free trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <div className="mt-5 grid gap-3 text-xs font-semibold text-white/75 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <MiniTrust text="No setup fee" />
                <MiniTrust text="Cancel anytime" />
                <MiniTrust text="One clear plan" />
              </div>
            </div>

            <div className="p-7 sm:p-10 lg:p-12">
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-violet-600">Included in your subscription</div>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">The operational essentials remain together.</h2>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {included.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Icon className="h-4 w-4" /></div>
                    <h3 className="mt-3 text-sm font-extrabold">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <SectionTitle eyebrow="How payment works" title="A predictable journey from trial to subscription." text="The commercial flow is intentionally simple and designed to avoid surprise charges." />
          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            <PaymentStep number="01" icon={<Zap className="h-5 w-5" />} title="Create your workspace" text="Choose your business type and create your account without entering payment details." />
            <PaymentStep number="02" icon={<CalendarDays className="h-5 w-5" />} title="Use the 14-day trial" text="Configure services, test scheduling and understand the workflow with your team." />
            <PaymentStep number="03" icon={<CreditCard className="h-5 w-5" />} title="Choose to continue" text="Complete secure checkout only when you decide that Velliqo fits your business." />
            <PaymentStep number="04" icon={<ReceiptText className="h-5 w-5" />} title="Manage billing openly" text="View the subscription, invoices and cancellation controls from the billing area." />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionTitle eyebrow="Product delivery" title="What the plan contains—from foundation to launch." text="We separate current capabilities, launch commitments and future roadmap items so customers always know what is available." />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {delivery.map((group) => <DeliveryCard key={group.phase} {...group} />)}
            </div>
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" />
              <p><strong>Transparent launch policy:</strong> paid subscriptions will not be publicly activated until checkout, billing controls, email delivery, security review and legal documentation are production-ready.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-28">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><LockKeyhole className="h-5 w-5" /></div>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">Questions before subscribing?</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">These are the practical questions a business should be able to answer before committing to software.</p>
            <Button asChild variant="outline" className="mt-6 h-11 rounded-xl"><Link to="/why-velliqo">Explore Why Velliqo</Link></Button>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,.07)]">
            {faqs.map((faq, index) => (
              <button key={faq.question} type="button" className="w-full border-b border-slate-200 p-5 text-left last:border-b-0 sm:p-6" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-extrabold sm:text-base">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${openFaq === index ? 'rotate-180' : ''}`} />
                </div>
                {openFaq === index && <p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{faq.answer}</p>}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
            <BadgeCheck className="mx-auto h-10 w-10 text-violet-300" />
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Try the complete experience before making a payment decision.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60">Choose your business type and begin a guided setup. No card is required for the trial.</p>
            <Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function MarketingHeader({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  return <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex"><Link to="/" className="hover:text-slate-950">Product</Link><Link to="/why-velliqo" className="hover:text-slate-950">Why Velliqo?</Link><Link to="/pricing" className="text-violet-700">Pricing</Link><Link to="/business-types" className="hover:text-slate-950">Business types</Link></nav><div className="flex items-center gap-2"><Button asChild variant="ghost" className="hidden rounded-xl sm:inline-flex"><Link to="/sign-in">Business login</Link></Button><Button asChild className="hidden rounded-xl bg-violet-600 px-5 hover:bg-violet-700 sm:inline-flex"><Link to="/business-types">Start free</Link></Button><Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setMenuOpen((v) => !v)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button></div></div>{menuOpen && <div className="border-t bg-white p-4 lg:hidden"><div className="grid gap-2"><Link to="/" className="rounded-xl px-3 py-2 text-sm font-semibold">Product</Link><Link to="/why-velliqo" className="rounded-xl px-3 py-2 text-sm font-semibold">Why Velliqo?</Link><Link to="/pricing" className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">Pricing</Link><Link to="/business-types" className="rounded-xl px-3 py-2 text-sm font-semibold">Business types</Link></div></div>}</header>;
}

function Brand() { return <Link to="/" className="flex items-center gap-3"><img src="/brand/velliqo-logo.png" alt="Velliqo" className="h-10 w-10 rounded-xl object-contain" /><div><div className="text-sm font-extrabold tracking-tight">Velliqo</div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Book. Manage. Grow.</div></div></Link>; }
function MarketingFooter() { return <footer className="border-t border-white/10 bg-slate-950 text-white"><div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><Brand /><div className="flex flex-wrap gap-5 text-xs font-semibold text-white/55"><Link to="/why-velliqo" className="hover:text-white">Why Velliqo?</Link><Link to="/pricing" className="hover:text-white">Pricing</Link><Link to="/business-types" className="hover:text-white">Business types</Link><Link to="/sign-in" className="hover:text-white">Login</Link></div><div className="text-xs text-white/40">© 2026 Velliqo</div></div></footer>; }
function MiniTrust({ text }: { text: string }) { return <span className="flex items-center gap-2"><Check className="h-4 w-4 text-violet-200" />{text}</span>; }
function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">{text}</p></div>; }
function PaymentStep({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) { return <article className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,23,42,.06)]"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">{icon}</div><span className="text-xs font-extrabold tracking-[.18em] text-slate-300">{number}</span></div><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>; }
function DeliveryCard({ phase, status, tone, items }: { phase: string; status: string; tone: string; items: string[] }) { const styles: Record<string,string> = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700', violet: 'border-violet-200 bg-violet-50 text-violet-700', slate: 'border-slate-200 bg-slate-100 text-slate-700' }; return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.14em] ${styles[tone]}`}>{status}</span><h3 className="mt-5 text-lg font-extrabold leading-tight">{phase}</h3><div className="mt-5 space-y-3">{items.map((item) => <div key={item} className="flex items-start gap-2.5 text-sm leading-5 text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />{item}</div>)}</div></article>; }
