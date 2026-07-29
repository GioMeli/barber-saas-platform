import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CreditCard,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';
import { VelliqoAICallout, VelliqoAIPreview } from '@/components/marketing/VelliqoAIPreview';

const productBenefits = [
  { icon: CalendarDays, title: 'Scheduling that stays clear', text: 'Daily, weekly and monthly views designed for real appointment operations.' },
  { icon: Users, title: 'Customers and teams together', text: 'Keep profiles, availability, history and daily responsibilities in one workspace.' },
  { icon: BarChart3, title: 'Reports that support decisions', text: 'Understand appointments, revenue, retention, services and team performance.' },
  { icon: Store, title: 'A premium online presence', text: 'Give customers a polished place to discover, trust and book your business.' },
];

const industries = ['Beauty & personal care', 'Health & wellness', 'Fitness', 'Pet services', 'Automotive', 'Home services', 'Professional services', 'Education', 'Creative services', 'Events'];

export default function IndustrySelection() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f7fb] text-slate-950">
      <MarketingHeader active="product" />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#0d0b18] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(124,58,237,.34),transparent_31%),radial-gradient(circle_at_88%_18%,rgba(217,70,239,.18),transparent_28%),linear-gradient(180deg,#0d0b18_0%,#111025_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-violet-950/20 to-transparent" />
          <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.75fr_1.25fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-extrabold text-violet-200"><Sparkles className="h-4 w-4" />Premium operations, powered by Velliqo AI</div>
              <h1 className="mt-7 text-4xl font-extrabold leading-[1.01] tracking-[-.06em] sm:text-5xl lg:text-[4.45rem]">The operating platform your service business can grow into.</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/60 sm:text-lg">Bring appointments, customers, staff, services, storefronts, payments, reporting and intelligent assistance into one coordinated Velliqo workspace.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">Start your workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/[.04] px-6 text-white hover:bg-white/[.08] hover:text-white"><Link to="/velliqo-ai"><PlayCircle className="mr-2 h-4 w-4" />See Velliqo AI</Link></Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/42"><TrustItem text="14-day free trial" dark /><TrustItem text="No card required" dark /><TrustItem text="Industry-aware setup" dark /></div>
            </div>
            <VelliqoAIPreview compact />
          </div>
        </section>

        <section className="overflow-hidden border-b border-slate-200 bg-white">
          <div className="flex min-w-max animate-[velliqo-marquee_30s_linear_infinite] items-center gap-3 px-4 py-4 motion-reduce:animate-none">
            {[...industries, ...industries].map((industry, index) => <div key={`${industry}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-600">{industry}</div>)}
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <TrustFeature icon={<ShieldCheck className="h-5 w-5" />} title="Tenant-isolated workspaces" text="Each business operates inside its own protected data boundary." />
            <TrustFeature icon={<Workflow className="h-5 w-5" />} title="One connected workflow" text="Information moves across scheduling, CRM, reporting and AI." />
            <TrustFeature icon={<Users className="h-5 w-5" />} title="Built for daily teams" text="Owners and professionals see the context needed for their work." />
            <TrustFeature icon={<CreditCard className="h-5 w-5" />} title="Ready for business growth" text="Subscriptions, sales and optional payment workflows fit the roadmap." />
          </div>
        </section>

        <section id="product" className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <SectionHeading eyebrow="One coordinated product" title="Move from scattered tools to one professional operating system." text="Velliqo connects the daily work of the owner, team and customer instead of forcing the business to manage separate systems." centered />
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {productBenefits.map(({ icon: Icon, title, text }) => <article key={title} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,.055)] transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_24px_75px_rgba(76,29,149,.12)]"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-extrabold tracking-tight">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </section>

        <section className="overflow-hidden border-y border-slate-200 bg-[#eeebff]">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-28">
            <ProductStage />
            <div className="max-w-xl">
              <div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">Built for every device</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">A calm owner workspace. A polished customer experience.</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">The product adapts from the front desk to a phone in the field, while customers receive a consistent booking experience that reflects the quality of the business.</p>
              <div className="mt-7 space-y-4"><FeatureLine title="Owner operations" text="Calendar, customers, team, services, sales, finance and AI in one navigation system." /><FeatureLine title="Customer journey" text="Discovery, service selection, professional selection, booking and account access." /><FeatureLine title="Responsive foundation" text="Mobile, tablet and desktop layouts designed around the task—not merely scaled down." /></div>
              <Button asChild size="lg" className="mt-8 h-12 rounded-xl bg-violet-600 px-6 hover:bg-violet-700"><Link to="/experience">Explore the full experience <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        </section>

        <VelliqoAICallout />

        <section className="bg-white">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">Business intelligence that stays practical</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Know what is happening—and what deserves attention next.</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">Reports combine operational metrics with daily context. Velliqo AI then helps the owner interpret patterns and prepare reviewable actions.</p>
              <div className="mt-7 space-y-4"><FeatureLine title="Revenue and appointment performance" text="Track trends without leaving the operational workspace." /><FeatureLine title="Customer retention signals" text="Identify regular customers who may be slipping outside their normal cycle." /><FeatureLine title="Staff and service visibility" text="Understand utilisation, demand and the shape of the working day." /></div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-[0_30px_95px_rgba(15,23,42,.18)] sm:p-3"><div className="flex h-7 items-center gap-1.5 px-3"><span className="h-2.5 w-2.5 rounded-full bg-rose-400"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div><img src="/marketing/product/reports-desktop.png" alt="Velliqo reporting workspace" className="w-full rounded-[1.35rem] border border-white/10" /></div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-gradient-to-br from-violet-700 to-fuchsia-600 text-white">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-white/55">Your next operating system</div><h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Create a premium experience for the business and every customer it serves.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70">Choose your business type and begin a guided setup prepared for your services, team and daily operations.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-violet-800 hover:bg-white/90"><Link to="/business-types">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/25 bg-white/[.06] px-6 text-white hover:bg-white/[.12] hover:text-white"><Link to="/pricing">View pricing</Link></Button></div></div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function ProductStage() {
  return <div className="relative mx-auto w-full max-w-[780px] pb-12 pt-3"><div className="absolute -left-8 top-16 h-44 w-44 rounded-full bg-violet-300/45 blur-3xl"/><div className="absolute -right-8 bottom-6 h-44 w-44 rounded-full bg-fuchsia-300/35 blur-3xl"/><div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-[0_35px_100px_rgba(76,29,149,.24)] sm:p-3"><div className="flex h-7 items-center gap-1.5 px-3"><span className="h-2.5 w-2.5 rounded-full bg-rose-400"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div><img src="/marketing/product/dashboard-desktop.png" alt="Velliqo owner dashboard" className="w-full rounded-[1.35rem] border border-white/10" /></div><div className="absolute -bottom-1 -left-1 hidden w-[32%] overflow-hidden rounded-[1.7rem] border-[7px] border-slate-950 bg-white shadow-[0_24px_70px_rgba(15,23,42,.28)] sm:block"><img src="/marketing/product/calendar-mobile.png" alt="Velliqo mobile calendar" className="w-full" /></div><div className="absolute -bottom-5 right-3 hidden w-[43%] overflow-hidden rounded-[1.5rem] border-[7px] border-slate-950 bg-white shadow-[0_24px_70px_rgba(15,23,42,.25)] lg:block"><img src="/marketing/product/today-schedule-desktop.png" alt="Velliqo daily schedule" className="w-full" /></div></div>;
}

function SectionHeading({ eyebrow, title, text, centered = false }: { eyebrow: string; title: string; text: string; centered?: boolean }) {
  return <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{text}</p></div>;
}
function TrustItem({ text, dark = false }: { text: string; dark?: boolean }) { return <span className={`inline-flex items-center gap-2 ${dark ? 'text-white/50' : 'text-slate-600'}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full ${dark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}><Check className="h-3 w-3" /></span>{text}</span>; }
function TrustFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-slate-200 bg-[#fbfaff] p-5"><div className="text-violet-600">{icon}</div><h3 className="mt-3 text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>; }
function FeatureLine({ title, text }: { title: string; text: string }) { return <div className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"><Check className="h-3.5 w-3.5" /></span><div><div className="text-sm font-extrabold text-slate-900">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>; }
