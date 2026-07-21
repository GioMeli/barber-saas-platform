import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  HeartHandshake,
  Layers3,
  LockKeyhole,
  Menu,
  MessageCircleQuestion,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const questions = [
  ['Is Velliqo only for salons?', 'No. Velliqo is being built for appointment-based and service businesses across beauty, wellness, fitness, professional services, education, pets, automotive and other industries. The setup adapts terminology and starter modules to the selected business type.'],
  ['Will it be difficult for my staff to learn?', 'The product is designed around familiar daily workflows: calendar, customers, services and clear actions. Guided onboarding, contextual empty states and the planned Velliqo Academy will reduce training time.'],
  ['Can customers book without downloading an app?', 'Yes. Each business receives a public web experience where customers can view business information and book online from desktop, tablet or mobile.'],
  ['Can I keep walk-ins and phone bookings?', 'Yes. Owners and authorised staff can create appointments directly from the dashboard, so online booking does not replace the way your business already serves customers.'],
  ['Does it work for more than one staff member?', 'Yes. The platform supports team schedules, staff availability, customer assignment and business-level visibility. More granular permissions are part of the production-readiness roadmap.'],
  ['What protects my business data?', 'Velliqo uses a multi-tenant architecture where business records are separated. Before public launch, the platform will complete a dedicated RLS, permissions and production security audit.'],
  ['Can I leave if the platform is not right for me?', 'The planned subscription is monthly and cancellable. Before paid launch, Velliqo will publish clear data export and retention rules so businesses understand their options.'],
  ['Will Velliqo keep improving?', 'Yes. The goal is one evolving platform. Product improvements to the included core experience are planned to be delivered without forcing customers to buy basic capabilities again as separate products.'],
];

export default function WhyVelliqo() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950">
      <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(124,58,237,.35),transparent_31%),radial-gradient(circle_at_88%_10%,rgba(217,70,239,.24),transparent_28%)]" />
          <div className="absolute inset-0 opacity-[.05] [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="relative mx-auto grid max-w-[1340px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80"><Sparkles className="h-4 w-4 text-violet-300" /> Why businesses choose Velliqo</div>
              <h1 className="mt-7 text-4xl font-extrabold leading-[1.02] tracking-[-.05em] sm:text-5xl lg:text-6xl">Less operational noise. More confidence in every working day.</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg">Velliqo is designed to replace fragmented tools and manual coordination with one coherent business workspace—without making your team adapt to complicated software.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"><Link to="/pricing">See pricing</Link></Button></div>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-[0_35px_100px_rgba(0,0,0,.35)] backdrop-blur"><img src="/marketing/product/dashboard-desktop.png" alt="Velliqo business dashboard" className="w-full rounded-[1.45rem]" /></div>
              <div className="absolute -bottom-5 -left-3 hidden max-w-[260px] rounded-2xl border border-white/15 bg-slate-900/90 p-4 shadow-xl backdrop-blur sm:block"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200"><HeartHandshake className="h-5 w-5" /></div><div><div className="text-sm font-extrabold">Built around real operations</div><div className="mt-1 text-xs text-white/50">Not software for software’s sake.</div></div></div></div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1340px] gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <TrustMetric icon={<Clock3 className="h-5 w-5" />} title="Save coordination time" text="Keep daily work in one shared system." />
            <TrustMetric icon={<MonitorSmartphone className="h-5 w-5" />} title="Work across devices" text="Desktop depth with mobile clarity." />
            <TrustMetric icon={<ShieldCheck className="h-5 w-5" />} title="Trust the workspace" text="Clear access and separated business data." />
            <TrustMetric icon={<WandSparkles className="h-5 w-5" />} title="Start with guidance" text="Configuration follows your business type." />
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <Title eyebrow="The difference" title="Designed as one operating experience." text="Velliqo does not aim to add another isolated booking tool. It connects the customer journey with the work your team performs behind the scenes." />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Reason icon={<Layers3 className="h-5 w-5" />} title="One source of truth" text="Appointments, customers, services, staff and reports use the same operational information." />
            <Reason icon={<Users className="h-5 w-5" />} title="Built for the full team" text="Owners gain visibility while professionals keep a clear view of the working day." />
            <Reason icon={<Store className="h-5 w-5" />} title="Customer-facing quality" text="Your booking experience should reflect the professionalism of your real business." />
            <Reason icon={<BarChart3 className="h-5 w-5" />} title="Useful business intelligence" text="Reports focus on decisions, not decorative charts disconnected from daily activity." />
            <Reason icon={<LockKeyhole className="h-5 w-5" />} title="Security before scale" text="Production launch is tied to permissions, RLS, billing and security readiness." />
            <Reason icon={<HeartHandshake className="h-5 w-5" />} title="Transparent product relationship" text="Clear pricing, visible roadmap status and no claim that unfinished features are already available." />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f0edff]">
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div className="overflow-hidden rounded-[2rem] border border-violet-200 bg-white p-3 shadow-[0_28px_90px_rgba(76,29,149,.15)]"><img src="/marketing/product/calendar-workspace.png" alt="Velliqo calendar workspace" className="w-full rounded-[1.45rem]" /></div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">Built for adoption</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">Premium should feel easier—not more complicated.</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">A high-quality platform earns trust through clarity. Velliqo uses consistent navigation, familiar scheduling patterns, guided setup and responsive layouts so the product feels deliberate on every device.</p>
              <div className="mt-7 space-y-4"><Line title="Clear daily priorities" text="The dashboard surfaces what requires attention now." /><Line title="Consistent terminology" text="Labels adapt to the selected business without changing the core experience." /><Line title="Progressive depth" text="New users can begin simply while advanced capabilities remain available when needed." /></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <Title eyebrow="Questions answered" title="What a careful business owner should ask." text="Trust starts when practical concerns are answered directly, before registration or payment." />
          <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_65px_rgba(15,23,42,.07)]">
            {questions.map(([question, answer], index) => <button key={question} type="button" className="w-full border-b border-slate-200 p-5 text-left last:border-0 sm:p-6" onClick={() => setOpen(open === index ? null : index)}><div className="flex items-center justify-between gap-5"><span className="text-sm font-extrabold sm:text-base">{question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open === index ? 'rotate-180' : ''}`} /></div>{open === index && <p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{answer}</p>}</button>)}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-20 sm:px-6 md:grid-cols-3 lg:px-8">
            <Promise icon={<MessageCircleQuestion className="h-5 w-5" />} title="Honest answers" text="Unreleased capabilities are labelled as roadmap items rather than presented as finished." />
            <Promise icon={<ShieldCheck className="h-5 w-5" />} title="Responsible launch" text="Paid launch depends on security, billing, monitoring and legal readiness." />
            <Promise icon={<HeartHandshake className="h-5 w-5" />} title="Long-term product quality" text="The platform is being built for maintainability, consistency and real customer support." />
          </div>
        </section>

        <section className="bg-gradient-to-br from-violet-700 to-fuchsia-600 text-white">
          <div className="mx-auto max-w-[1180px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">See whether Velliqo fits the way your business works.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70">Choose your business type and begin the guided setup without entering payment details.</p>
            <Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-violet-800 hover:bg-white/90"><Link to="/business-types">Find your business type <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>> }) { return <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex"><Link to="/" className="hover:text-slate-950">Product</Link><Link to="/why-velliqo" className="text-violet-700">Why Velliqo?</Link><Link to="/pricing" className="hover:text-slate-950">Pricing</Link><Link to="/business-types" className="hover:text-slate-950">Business types</Link></nav><div className="flex items-center gap-2"><Button asChild variant="ghost" className="hidden rounded-xl sm:inline-flex"><Link to="/sign-in">Business login</Link></Button><Button asChild className="hidden rounded-xl bg-violet-600 px-5 hover:bg-violet-700 sm:inline-flex"><Link to="/business-types">Start free</Link></Button><Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setMenuOpen((v) => !v)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button></div></div>{menuOpen && <div className="border-t bg-white p-4 lg:hidden"><div className="grid gap-2"><Link to="/" className="rounded-xl px-3 py-2 text-sm font-semibold">Product</Link><Link to="/why-velliqo" className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">Why Velliqo?</Link><Link to="/pricing" className="rounded-xl px-3 py-2 text-sm font-semibold">Pricing</Link><Link to="/business-types" className="rounded-xl px-3 py-2 text-sm font-semibold">Business types</Link></div></div>}</header>; }
function Brand() { return <Link to="/" className="flex items-center gap-3"><img src="/brand/velliqo-logo.png" alt="Velliqo" className="h-10 w-10 rounded-xl object-contain" /><div><div className="text-sm font-extrabold tracking-tight">Velliqo</div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Book. Manage. Grow.</div></div></Link>; }
function Footer() { return <footer className="border-t border-white/10 bg-slate-950 text-white"><div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><Brand /><div className="flex flex-wrap gap-5 text-xs font-semibold text-white/55"><Link to="/why-velliqo" className="hover:text-white">Why Velliqo?</Link><Link to="/pricing" className="hover:text-white">Pricing</Link><Link to="/business-types" className="hover:text-white">Business types</Link><Link to="/sign-in" className="hover:text-white">Login</Link></div><div className="text-xs text-white/40">© 2026 Velliqo</div></div></footer>; }
function TrustMetric({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">{icon}</div><div><div className="text-sm font-extrabold">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{text}</div></div></div>; }
function Title({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">{text}</p></div>; }
function Reason({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,.055)]"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">{icon}</div><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>; }
function Line({ title, text }: { title: string; text: string }) { return <div className="flex items-start gap-3"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"><Check className="h-3 w-3" /></span><div><div className="text-sm font-extrabold">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>; }
function Promise({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">{icon}</div><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>; }
