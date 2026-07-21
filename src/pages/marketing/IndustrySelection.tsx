import React from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Menu,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'support@yourdomain.com';

const productBenefits = [
  {
    icon: CalendarDays,
    title: 'Scheduling that stays clear',
    text: 'Daily, weekly and monthly views built for real service operations.',
  },
  {
    icon: Users,
    title: 'Customers and teams together',
    text: 'Keep profiles, staff availability and service history in one workspace.',
  },
  {
    icon: BarChart3,
    title: 'Reports you can act on',
    text: 'Understand revenue, appointments, customer growth and performance.',
  },
  {
    icon: Store,
    title: 'A branded online presence',
    text: 'Give customers a polished place to discover and book your services.',
  },
];

export default function IndustrySelection() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Velliqo product enquiry')}`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <VelliqoBrand />

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#product" className="transition hover:text-slate-950">Product</a>
            <Link to="/experience" className="transition hover:text-slate-950">Experience</Link>
            <Link to="/why-velliqo" className="transition hover:text-slate-950">Why Velliqo?</Link>
            <Link to="/pricing" className="transition hover:text-slate-950">Pricing</Link>
            <a href="#trust" className="transition hover:text-slate-950">Security</a>
            <a href={supportHref} className="transition hover:text-slate-950">Support</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-xl sm:inline-flex">
              <Link to="/sign-in">Business login</Link>
            </Button>
            <Button asChild className="hidden rounded-xl bg-violet-600 px-5 hover:bg-violet-700 sm:inline-flex">
              <Link to="/business-types">Start free</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl lg:hidden"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t bg-white px-4 py-4 lg:hidden">
            <div className="mx-auto grid max-w-[1440px] gap-2">
              {['product', 'trust'].map((item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold capitalize text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
              <div className="grid gap-2">
                <Link to="/experience" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Experience</Link>
                <Link to="/why-velliqo" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Why Velliqo?</Link>
                <Link to="/pricing" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Pricing</Link>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="rounded-xl"><Link to="/sign-in">Login</Link></Button>
                <Button asChild className="rounded-xl bg-violet-600 hover:bg-violet-700"><Link to="/business-types">Start free</Link></Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(124,58,237,0.16),transparent_29%),radial-gradient(circle_at_88%_8%,rgba(217,70,239,0.13),transparent_26%)]" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-violet-50/70 to-transparent" />

          <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.91fr_1.09fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                One premium workspace for service businesses
              </div>
              <h1 className="mt-7 text-4xl font-extrabold leading-[1.01] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-[4.35rem]">
                Run every part of your business with confidence.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Velliqo brings bookings, staff, customers, services, storefronts and reporting into one coordinated platform—designed to look professional from the first click.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-xl bg-violet-600 px-6 hover:bg-violet-700">
                  <Link to="/business-types">Find your business type <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl bg-white px-6">
                  <Link to="/experience"><PlayCircle className="mr-2 h-4 w-4" />Explore the experience</Link>
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
                <TrustItem text="14-day free trial" />
                <TrustItem text="No card required" />
                <TrustItem text="Cancel anytime" />
              </div>
            </div>

            <HeroProductComposition />
          </div>
        </section>

        <section id="trust" className="border-b border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <TrustFeature icon={<ShieldCheck className="h-5 w-5" />} title="Secure workspaces" text="Business data is separated by design." />
            <TrustFeature icon={<Check className="h-5 w-5" />} title="Guided onboarding" text="Start with a setup suited to your business." />
            <TrustFeature icon={<Users className="h-5 w-5" />} title="Built for teams" text="Coordinate owners, staff and customers." />
            <TrustFeature icon={<BarChart3 className="h-5 w-5" />} title="Operational clarity" text="See what is happening without guesswork." />
          </div>
        </section>

        <section id="product" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="The Velliqo product"
            title="A coordinated system—not a collection of disconnected tools."
            text="Every screen is designed to work together, so the information your team enters once becomes useful across scheduling, CRM and reporting."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {productBenefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,.06)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="experience" className="overflow-hidden border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading
              eyebrow="Responsive by design"
              title="Professional on desktop. Practical on tablet. Clear on mobile."
              text="Your team can move from the front desk to the treatment room or the road without losing the context of the working day."
              centered
            />
            <ResponsiveShowcase />
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-[0_25px_80px_rgba(15,23,42,.12)]">
                <img src="/marketing/product/reports-desktop.png" alt="Velliqo reporting dashboard" className="w-full rounded-[1.55rem]" />
              </div>
            </div>
            <div className="order-1 lg:order-2 lg:pl-10">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-600">Business intelligence</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Make decisions from real operating data.</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">Track revenue, appointment volume, completion rates and customer growth without building spreadsheets after closing time.</p>
              <div className="mt-7 space-y-4">
                <FeatureLine title="Flexible reporting periods" text="Review the week, month or any custom period." />
                <FeatureLine title="Practical performance metrics" text="See the numbers that influence staffing and growth." />
                <FeatureLine title="Export-ready information" text="Prepare business data for further review when needed." />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f2efff]">
          <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8 lg:py-24">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-600">A guided first experience</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Your workspace starts with the right structure.</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">Choose your business type first. Velliqo then prepares relevant terminology, starter services and modules before you create the workspace.</p>
              <Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-violet-600 px-6 hover:bg-violet-700">
                <Link to="/business-types">Find your business type <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-violet-200 bg-white p-3 shadow-[0_30px_90px_rgba(76,29,149,.16)]">
              <img src="/marketing/product/onboarding-services.png" alt="Velliqo guided service setup" className="w-full rounded-[1.45rem]" />
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:py-24">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-600">Straightforward pricing</div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Start with the complete platform.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">No complicated feature maze during your trial. Explore how Velliqo fits your operation before committing.</p>

            <div className="mx-auto mt-10 max-w-lg rounded-[2rem] border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-7 text-left shadow-[0_28px_80px_rgba(76,29,149,.14)] sm:p-9">
              <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-bold text-violet-700">Velliqo complete</div><div className="mt-1 text-xs text-slate-500">Introductory subscription</div></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">14 days free</span></div>
              <div className="mt-6 text-5xl font-extrabold tracking-tight">€19.99<span className="text-base font-semibold text-slate-500"> / month</span></div>
              <div className="mt-6 space-y-3">
                {['Scheduling and appointments', 'Customers and staff', 'Reports and insights', 'Online business presence', 'Future product improvements'].map((item) => <TrustItem key={item} text={item} />)}
              </div>
              <Button asChild className="mt-7 h-12 w-full rounded-xl bg-violet-600 hover:bg-violet-700"><Link to="/business-types">Start free</Link></Button>
              <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">Commercial limits and final launch terms will be clearly confirmed before payment.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto max-w-[1440px] px-4 py-16 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Build a calmer, more professional operation.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60">Select your business type and begin a guided Velliqo setup.</p>
            <Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">Find your business type <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <VelliqoBrand dark />
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/55">
            <a href="#product" className="hover:text-white">Product</a>
            <Link to="/business-types" className="hover:text-white">Business types</Link>
            <Link to="/why-velliqo" className="hover:text-white">Why Velliqo?</Link>
            <Link to="/pricing" className="hover:text-white">Pricing</Link>
            <a href={supportHref} className="hover:text-white">Support</a>
          </div>
          <div className="text-xs text-white/40">© 2026 Velliqo</div>
        </div>
      </footer>
    </div>
  );
}

function VelliqoBrand({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="Velliqo home">
      <img src="/brand/velliqo-logo.png" alt="Velliqo logo" className="h-11 w-11 rounded-xl object-contain" />
      <div>
        <div className={`text-base font-extrabold tracking-tight ${dark ? 'text-white' : 'text-slate-950'}`}>Velliqo</div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-violet-300' : 'text-violet-600'}`}>Book. Manage. Grow.</div>
      </div>
    </Link>
  );
}

function TrustItem({ text }: { text: string }) {
  return <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3 w-3" /></span>{text}</div>;
}

function TrustFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"><div className="text-violet-300">{icon}</div><h3 className="mt-3 text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-white/50">{text}</p></div>;
}

function SectionHeading({ eyebrow, title, text, centered = false }: { eyebrow: string; title: string; text: string; centered?: boolean }) {
  return <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-600">{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{text}</p></div>;
}

function HeroProductComposition() {
  return (
    <div className="relative mx-auto w-full max-w-[760px] pb-8 pt-3 lg:pb-12">
      <div className="absolute -left-8 top-20 hidden h-40 w-40 rounded-full bg-violet-300/30 blur-3xl sm:block" />
      <div className="absolute -right-8 bottom-10 hidden h-44 w-44 rounded-full bg-fuchsia-300/30 blur-3xl sm:block" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 p-2 shadow-[0_35px_100px_rgba(76,29,149,.24)] sm:rounded-[2.25rem] sm:p-3">
        <div className="flex h-7 items-center gap-1.5 px-3"><span className="h-2.5 w-2.5 rounded-full bg-rose-400"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div>
        <img src="/marketing/product/dashboard-desktop.png" alt="Velliqo dashboard on desktop" className="w-full rounded-[1.2rem] border border-white/10" />
      </div>
      <div className="absolute -bottom-1 -left-2 hidden w-[44%] overflow-hidden rounded-[1.6rem] border-[7px] border-slate-950 bg-white shadow-[0_22px_60px_rgba(15,23,42,.25)] md:block">
        <img src="/marketing/product/calendar-mobile.png" alt="Velliqo calendar on mobile" className="w-full" />
      </div>
      <div className="absolute -bottom-5 right-4 hidden w-[48%] overflow-hidden rounded-[1.5rem] border-[7px] border-slate-950 bg-white shadow-[0_22px_60px_rgba(15,23,42,.22)] xl:block">
        <img src="/marketing/product/reports-desktop.png" alt="Velliqo reports preview" className="w-full" />
      </div>
    </div>
  );
}

function ResponsiveShowcase() {
  return (
    <div className="relative mx-auto mt-14 min-h-[490px] max-w-6xl sm:min-h-[650px] lg:min-h-[720px]">
      <div className="absolute left-1/2 top-0 w-[96%] -translate-x-1/2 overflow-hidden rounded-[1.6rem] border-[8px] border-slate-950 bg-slate-950 shadow-[0_35px_100px_rgba(15,23,42,.22)] sm:rounded-[2.1rem] sm:border-[11px] lg:w-[82%]">
        <div className="flex h-7 items-center justify-center"><span className="h-1.5 w-16 rounded-full bg-white/20" /></div>
        <img src="/marketing/product/calendar-workspace.png" alt="Velliqo calendar desktop layout" className="w-full rounded-b-[1rem]" />
      </div>

      <div className="absolute bottom-0 left-0 hidden w-[50%] overflow-hidden rounded-[1.7rem] border-[9px] border-slate-900 bg-white shadow-[0_28px_80px_rgba(15,23,42,.24)] md:block lg:left-[1%] lg:w-[46%]">
        <div className="flex h-6 items-center justify-center bg-slate-900"><span className="h-1 w-10 rounded-full bg-white/30" /></div>
        <img src="/marketing/product/today-schedule-desktop.png" alt="Velliqo schedule tablet layout" className="w-full" />
      </div>

      <div className="absolute bottom-0 right-[5%] w-[31%] min-w-[128px] overflow-hidden rounded-[2rem] border-[8px] border-slate-950 bg-white shadow-[0_28px_80px_rgba(15,23,42,.28)] sm:w-[26%] lg:right-[8%] lg:w-[22%]">
        <div className="flex h-6 items-center justify-center bg-slate-950"><span className="h-1 w-9 rounded-full bg-white/30" /></div>
        <img src="/marketing/product/calendar-mobile.png" alt="Velliqo mobile calendar layout" className="w-full" />
      </div>
    </div>
  );
}

function FeatureLine({ title, text }: { title: string; text: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"><Check className="h-3.5 w-3.5" /></span><div><div className="text-sm font-bold text-slate-900">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>;
}
