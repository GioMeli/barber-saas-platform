import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Headphones,
  Menu,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'support@yourdomain.com';

const solutions = [
  {
    key: 'hair_salon',
    eyebrow: 'Hair & Barber',
    title: 'Built for exceptional hair businesses.',
    description:
      'Run appointments, team schedules, services, customers and your branded booking experience from one polished workspace.',
    image:
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Modern professional hair salon interior',
    highlights: ['Hair salons', 'Barber shops', 'Independent professionals'],
    cta: 'Start with Hair & Barber',
  },
  {
    key: 'beauty_studio',
    eyebrow: 'Beauty & Aesthetics',
    title: 'A complete platform for modern beauty studios.',
    description:
      'Create a premium customer journey for beauty, nails, wellness and aesthetic services while keeping operations organised.',
    image:
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Professional beauty and skincare treatment',
    highlights: ['Beauty studios', 'Nail salons', 'Aesthetic services'],
    cta: 'Start with Beauty',
  },
];

export default function IndustrySelection() {
  const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    'Help choosing the right business setup'
  )}&body=${encodeURIComponent(
    'Hello,\n\nI am interested in the platform and would like help choosing the right setup for my business.\n\nBusiness type:\nBusiness name:\nCountry:\nQuestions:\n\nThank you.'
  )}`;

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/brand/barber-saas-logo.jpg"
              alt="Platform logo"
              className="h-10 w-10 rounded-xl object-cover shadow-sm"
            />
            <div>
              <div className="text-sm font-extrabold tracking-tight">BusinessOS</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                Beauty business platform
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#solutions" className="transition hover:text-slate-950">Solutions</a>
            <a href="#platform" className="transition hover:text-slate-950">Platform</a>
            <a href="#support" className="transition hover:text-slate-950">Support</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-xl sm:inline-flex">
              <Link to="/sign-in">Business login</Link>
            </Button>
            <Button asChild className="rounded-xl px-5">
              <a href="#solutions">Start free</a>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(236,72,153,0.10),transparent_28%),radial-gradient(circle_at_85%_5%,rgba(234,179,8,0.12),transparent_26%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                <Sparkles className="h-4 w-4 text-pink-500" />
                One platform. Configured for your business.
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
                Run your business.
                <span className="block text-slate-400">Not your paperwork.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Appointments, staff, customers, services, products, reports and a branded online storefront—managed from one secure workspace.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 rounded-xl px-6">
                  <a href="#solutions">Choose your solution <ArrowRight className="ml-2 h-4 w-4" /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6">
                  <Link to="/sign-in">Business login</Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
                <TrustItem text="14-day free trial" />
                <TrustItem text="No card required" />
                <TrustItem text="Secure multi-tenant platform" />
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
                <img
                  src="https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&w=1400&q=85"
                  alt="Premium beauty business workspace"
                  className="h-[420px] w-full rounded-[1.45rem] object-cover opacity-90"
                />
                <div className="absolute inset-x-8 bottom-7 rounded-2xl border border-white/15 bg-black/55 p-4 text-white backdrop-blur-xl">
                  <div className="grid grid-cols-3 gap-3">
                    <HeroMetric icon={<CalendarDays className="h-4 w-4" />} value="24/7" label="Online booking" />
                    <HeroMetric icon={<Users className="h-4 w-4" />} value="One" label="Team workspace" />
                    <HeroMetric icon={<BarChart3 className="h-4 w-4" />} value="Live" label="Business insights" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-pink-500">Solutions</div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Choose the setup that matches your business.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600 md:text-right">
              Every solution uses the same powerful platform, automatically configured with the right branding, terminology and starting services.
            </p>
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {solutions.map((solution) => (
              <article key={solution.key} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-44 overflow-hidden">
                  <img src={solution.image} alt={solution.imageAlt} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                    {solution.eyebrow}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-extrabold leading-tight tracking-tight">{solution.title}</h3>
                  <p className="mt-3 min-h-[66px] text-sm leading-6 text-slate-600">{solution.description}</p>
                  <div className="mt-4 space-y-2">
                    {solution.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100"><Check className="h-3 w-3" /></span>
                        {highlight}
                      </div>
                    ))}
                  </div>
                  <Button asChild className="mt-5 h-11 w-full rounded-xl">
                    <Link to={`/sign-up?industry=${solution.key}`}>{solution.cta}<ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </article>
            ))}

            <article id="support" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative h-44 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85"
                  alt="Professional business support consultation"
                  className="h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
                  <Headphones className="h-4 w-4" /> Personal support
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-extrabold tracking-tight">Not sure which setup fits?</h3>
                <p className="mt-3 min-h-[66px] text-sm leading-6 text-white/65">
                  Tell us how your business operates and we will help you choose the right starting configuration.
                </p>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs leading-5 text-white/70">
                  The button creates a reviewable email draft. Nothing is sent automatically.
                </div>
                <Button asChild variant="secondary" className="mt-5 h-11 w-full rounded-xl bg-white text-slate-950 hover:bg-white/90">
                  <a href={supportHref}>Contact support <ArrowRight className="ml-2 h-4 w-4" /></a>
                </Button>
              </div>
            </article>
          </div>
        </section>

        <section id="platform" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PlatformFeature icon={<CalendarDays className="h-5 w-5" />} title="Smart scheduling" text="Real availability, staff calendars and online booking." />
              <PlatformFeature icon={<Store className="h-5 w-5" />} title="Branded storefront" text="A polished public page with bookings, gallery and updates." />
              <PlatformFeature icon={<BarChart3 className="h-5 w-5" />} title="Business reporting" text="Clear revenue, customer, service and staff performance." />
              <PlatformFeature icon={<ShieldCheck className="h-5 w-5" />} title="Secure by design" text="Each business remains isolated inside the multi-tenant platform." />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <div className="font-extrabold">BusinessOS</div>
            <div className="mt-1 text-xs text-white/45">The operating platform for modern beauty businesses.</div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/60">
            <a href="#solutions" className="hover:text-white">Solutions</a>
            <a href="#platform" className="hover:text-white">Features</a>
            <a href={supportHref} className="hover:text-white">Support</a>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
          <div className="text-xs text-white/40">© 2026 BusinessOS</div>
        </div>
      </footer>
    </div>
  );
}

function TrustItem({ text }: { text: string }) {
  return <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" />{text}</span>;
}

function HeroMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div><div className="flex items-center gap-2 text-sm font-bold">{icon}{value}</div><div className="mt-1 text-[10px] text-white/55">{label}</div></div>;
}

function PlatformFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#fafbfc] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">{icon}</div>
      <h3 className="mt-4 font-extrabold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
