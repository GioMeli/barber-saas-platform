import React from 'react';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Globe2,
  Image,
  Layers3,
  Megaphone,
  Menu,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DesktopDevice, LaptopDevice, PhoneDevice, TabletDevice } from '@/components/marketing/DeviceFrame';
import { ApprovedArtwork } from '@/components/marketing/ApprovedArtwork';

const ownerCapabilities = [
  ['Calendar control', 'Plan appointments, delays and team availability from one operational view.'],
  ['Customer intelligence', 'Keep customer profiles, history and activity connected to the business.'],
  ['Business reporting', 'Follow revenue, bookings, completion rates and growth without manual spreadsheets.'],
  ['Content publishing', 'Publish announcements, activities, offers, products and gallery updates.'],
];

const staffCapabilities = [
  ['A focused personal workspace', 'Each authorised professional sees their own schedule, appointments and daily responsibilities without entering the owner administration area.'],
  ['Live owner synchronization', 'Changes remain connected to the same business data so the owner and staff are working from one operational truth.'],
  ['Secure staff access', 'Staff sign in with their approved email and trusted-device access remains controlled by the business owner.'],
  ['Personal Staff App on eligible plans', 'Plans that include Staff Apps let professionals install their workspace on desktop or mobile for faster daily access.'],
];

const customerCapabilities = [
  ['A permanent public page', 'Every workspace receives a polished public destination that can be shared with anyone.'],
  ['Services and online booking', 'Visitors can discover services, choose a professional and book from any device.'],
  ['News and announcements', 'Customers can follow offers, closures, events and important business updates.'],
  ['Products, team and gallery', 'Present products, professionals, photos and the personality of the business in one place.'],
];

export default function Experience() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f7fc] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 text-white backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <VelliqoBrand light />
          <nav className="hidden items-center gap-8 text-sm font-semibold text-white/70 lg:flex">
            <a href="#owner" className="transition hover:text-white">Owner</a>
            <a href="#staff" className="transition hover:text-white">Staff Portal</a>
            <a href="#customer" className="transition hover:text-white">Customer</a>
            <a href="#public-page" className="transition hover:text-white">Public page</a>
            <Link to="/velliqo-ai" className="transition text-violet-200 hover:text-white">Velliqo AI</Link>
            <Link to="/why-velliqo" className="transition hover:text-white">Why Velliqo?</Link>
            <Link to="/pricing" className="transition hover:text-white">Pricing</Link>
            <Link to="/contact" className="transition hover:text-white">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden rounded-xl text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link to="/sign-in">Business login</Link>
            </Button>
            <Button asChild className="hidden rounded-xl bg-white px-5 text-slate-950 hover:bg-violet-50 sm:inline-flex">
              <Link to="/business-types">Start free</Link>
            </Button>
            <Button type="button" variant="ghost" size="icon" className="rounded-xl text-white lg:hidden" onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 bg-slate-950 px-4 py-4 lg:hidden">
            <div className="mx-auto grid max-w-[1440px] gap-2">
              {['owner', 'staff', 'customer', 'public-page'].map(item => (
                <a key={item} href={`#${item}`} className="rounded-xl px-3 py-2.5 text-sm font-semibold capitalize text-white/75 hover:bg-white/10" onClick={() => setMenuOpen(false)}>{item.replace('-', ' ')}</a>
              ))}
              <Link to="/velliqo-ai" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-violet-200 hover:bg-white/10">Velliqo AI</Link>
              <Link to="/contact" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10" onClick={() => setMenuOpen(false)}>Contact</Link>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="rounded-xl border-white/20 bg-transparent text-white"><Link to="/">Home</Link></Button>
                <Button asChild className="rounded-xl bg-white text-slate-950"><Link to="/business-types">Start free</Link></Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,.45),transparent_31%),radial-gradient(circle_at_82%_14%,rgba(217,70,239,.23),transparent_29%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,.18),transparent_37%)]" />
          <div className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative mx-auto max-w-[1440px] px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-32 lg:pt-28">
            <div className="mx-auto max-w-5xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-violet-100 shadow-2xl backdrop-blur-xl">
                <Sparkles className="h-4 w-4" /> One account. Three connected experiences.
              </div>
              <h1 className="mt-8 text-4xl font-extrabold leading-[.99] tracking-[-.058em] sm:text-6xl lg:text-[5.55rem]">
                Build the business behind the scenes.
                <span className="mt-2 block bg-gradient-to-r from-violet-300 via-fuchsia-200 to-sky-200 bg-clip-text text-transparent">Present it beautifully to the world.</span>
              </h1>
              <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-white/68 sm:text-xl">
                Creating a Velliqo workspace connects the owner workspace, a focused Staff Portal for authorised professionals and a customer-facing public page—designed to stay synchronized from day one.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-13 rounded-2xl bg-white px-7 text-slate-950 shadow-[0_16px_50px_rgba(255,255,255,.16)] hover:bg-violet-50">
                  <Link to="/business-types">Create your Velliqo workspace <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-13 rounded-2xl border-white/20 bg-white/5 px-7 text-white backdrop-blur hover:bg-white/10 hover:text-white">
                  <a href="#owner">See how it works</a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-3 text-xs font-semibold text-white/55">
                <TrustItem text="Public page created automatically" />
                <TrustItem text="Personal Staff Portal for authorised professionals" />
                <TrustItem text="Desktop, tablet and mobile ready" />
                <TrustItem text="No separate website builder required" />
              </div>
            </div>

            <div className="mx-auto mt-16 w-full max-w-6xl pb-8 lg:mt-20 lg:pb-20">
              <ApprovedArtwork src="/marketing/approved/velliqo-ai-two-devices-transparent.png" alt="Velliqo owner workspace and Velliqo AI across devices" loading="eager" className="max-w-[1040px]" />
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-1 border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <Proof icon={<Globe2 className="h-5 w-5" />} title="Instant public presence" text="A shareable customer page comes with every workspace." />
            <Proof icon={<Layers3 className="h-5 w-5" />} title="One connected system" text="Owner changes flow directly into the public experience." />
            <Proof icon={<Smartphone className="h-5 w-5" />} title="Every device supported" text="Designed for desktop, tablet and mobile use." />
            <Proof icon={<ShieldCheck className="h-5 w-5" />} title="Business-controlled" text="You decide what customers see and when it is published." />
          </div>
        </section>

        <section id="owner" className="relative overflow-hidden py-20 lg:py-32">
          <div className="absolute left-[-10%] top-[8%] h-[420px] w-[420px] rounded-full bg-violet-200/45 blur-3xl" />
          <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <SectionHeading number="01" eyebrow="Owner experience" title="Your private command centre for running the entire business." text="The owner side brings appointments, people, performance and publishing into one calm operational system. It is designed to reduce daily friction—not add another layer of administration." />

            <div className="mt-14 grid items-center gap-12 lg:grid-cols-[.82fr_1.18fr]">
              <div>
                <CapabilityList items={ownerCapabilities} tone="violet" />
                <Button asChild size="lg" className="mt-8 h-12 rounded-xl bg-violet-600 px-6 hover:bg-violet-700">
                  <Link to="/business-types">Build your owner workspace <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="relative pb-8 sm:pb-14">
                <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-200/70 to-sky-100/40 blur-2xl" />
                <ApprovedArtwork src="/marketing/approved/calendar-two-devices-transparent.png" alt="Velliqo owner calendar across desktop and mobile" className="relative z-10 max-w-[900px]" />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#0b1020] py-20 text-white lg:py-32">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <FeatureShowcase device="laptop" title="Know what is happening" text="Today’s schedule, customer activity and expected revenue stay visible at a glance." image="/marketing/screens/precision/dashboard-laptop.webp" icon={<BarChart3 className="h-5 w-5" />} />
              <FeatureShowcase device="tablet" title="Manage your people" text="Staff profiles and calendars live inside the same coordinated workspace." image="/marketing/screens/precision/staff-tablet.webp" icon={<Users className="h-5 w-5" />} />
              <FeatureShowcase device="desktop" title="Act on real data" text="Reports turn daily activity into clear indicators for better decisions." image="/marketing/screens/precision/reports-desktop.webp" icon={<CalendarDays className="h-5 w-5" />} />
            </div>
          </div>
        </section>

        <section id="staff" className="relative overflow-hidden border-b border-slate-200 bg-[#f4f1ff] py-20 lg:py-32">
          <div className="absolute right-[-10%] top-[8%] h-[440px] w-[440px] rounded-full bg-fuchsia-200/40 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.24em] text-violet-600">Personal Staff Portal</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">Give every professional the workspace they need—without giving them the owner dashboard.</h2>
              <p className="mt-6 text-base leading-8 text-slate-600">The Staff Portal is a dedicated daily workspace tied to one business and one authorised professional. Schedules, appointments and profile information stay synchronized with the owner while access remains business-controlled.</p>
              <CapabilityList items={staffCapabilities} tone="violet" compact />
              <div className="mt-7 rounded-2xl border border-violet-200 bg-white/80 p-4 text-sm leading-6 text-slate-600 shadow-sm"><span className="font-extrabold text-slate-950">Staff App availability:</span> downloadable personal Staff Apps are enabled only on subscription plans that include this capability. Browser access remains governed by the plan and staff permissions.</div>
            </div>
            <div className="relative">
              <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-200/60 to-white blur-2xl" />
              <ApprovedArtwork src="/marketing/approved/staff-page-two-devices-transparent.png" alt="Velliqo personal Staff Portal on mobile and desktop" className="relative z-10 max-w-[920px]" />
            </div>
          </div>
        </section>

        <section id="public-page" className="relative overflow-hidden bg-white py-20 lg:py-32">
          <div className="absolute right-[-12%] top-0 h-[520px] w-[520px] rounded-full bg-fuchsia-100/80 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
            <div className="relative pb-10">
              <ApprovedArtwork src="/marketing/approved/customer-page-two-devices-transparent.png" alt="Velliqo customer public page on mobile and desktop" className="max-w-[920px]" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.24em] text-fuchsia-600">Created automatically</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">Your business receives a public digital home from the moment it is created.</h2>
              <p className="mt-6 text-base leading-8 text-slate-600">No second project. No disconnected website builder. Your Velliqo public page uses the information you already manage in your workspace and turns it into a professional experience for customers and new visitors.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <MiniFeature icon={<Megaphone />} title="Announcements" />
                <MiniFeature icon={<Package />} title="Products" />
                <MiniFeature icon={<CalendarDays />} title="Services & booking" />
                <MiniFeature icon={<Users />} title="Professionals" />
                <MiniFeature icon={<Image />} title="Gallery" />
                <MiniFeature icon={<Store />} title="Business information" />
              </div>
            </div>
          </div>
        </section>

        <section id="customer" className="relative overflow-hidden bg-gradient-to-b from-violet-50 to-white py-20 lg:py-32">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <SectionHeading number="02" eyebrow="Customer experience" title="A confident journey from discovery to confirmed booking." text="Customers and new visitors can understand the business, follow its activity and complete a booking without learning a complicated system or downloading an app." centered />

            <div className="mt-14 grid gap-7 lg:grid-cols-[.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-violet-200/70 bg-white p-6 shadow-[0_24px_80px_rgba(76,29,149,.11)] sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Globe2 className="h-5 w-5" /></div>
                  <div><div className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">Public experience</div><h3 className="text-xl font-extrabold">Everything in one destination</h3></div>
                </div>
                <CapabilityList items={customerCapabilities} tone="fuchsia" compact />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <VisualCard image="/marketing/screens/precision/services-tablet.webp" title="Choose services clearly" label="Services" />
                <VisualCard image="/marketing/screens/precision/professionals-tablet.webp" title="Book the right professional" label="Team" />
              </div>
            </div>

            <div className="mt-20 grid items-center gap-14 lg:grid-cols-[.78fr_1.22fr]">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[.24em] text-violet-600">A living business presence</div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">Your public page keeps customers connected between appointments.</h2>
                <p className="mt-6 text-base leading-8 text-slate-600">Use announcements, gallery content, products and business updates to create a relationship that goes beyond a single booking. Every update is controlled from the owner workspace.</p>
                <div className="mt-8 space-y-3">
                  <FeatureLine icon={<BellRing />} text="Publish promotions, closures and important announcements." />
                  <FeatureLine icon={<Image />} text="Show results, spaces, products and recent activity." />
                  <FeatureLine icon={<CalendarDays />} text="Turn interest into a booking through a guided flow." />
                </div>
              </div>
              <div className="grid grid-cols-3 items-end justify-items-center gap-3 sm:gap-6">
                <div className="w-full max-w-[190px]"><PhoneDevice image="/marketing/screens/precision/posts-phone.webp" alt="Velliqo announcements mobile view" fit="fill" /></div>
                <div className="w-full max-w-[205px] sm:translate-y-4"><ApprovedArtwork src="/marketing/approved/website_extra_01_booking_mobile_transparent.webp" alt="Velliqo customer booking mobile view" /></div>
                <div className="w-full max-w-[190px]"><PhoneDevice image="/marketing/screens/precision/gallery-phone.webp" alt="Velliqo gallery mobile view" fit="fill" /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 lg:py-28">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 px-6 py-14 text-center text-white shadow-[0_35px_110px_rgba(15,23,42,.25)] sm:px-12 lg:py-20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_15%,rgba(124,58,237,.5),transparent_30%),radial-gradient(circle_at_85%_85%,rgba(217,70,239,.28),transparent_30%)]" />
              <div className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><Sparkles className="h-6 w-6" /></div>
                <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">One decision connects the owner, staff and customer experience.</h2>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65">Create the workspace that runs the business, give authorised professionals a focused Staff Portal and present a public experience customers can discover, trust and book.</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-12 rounded-xl bg-white px-7 text-slate-950 hover:bg-violet-50"><Link to="/business-types">Find your business type <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/20 bg-white/5 px-7 text-white hover:bg-white/10 hover:text-white"><Link to="/contact">Talk to Velliqo</Link></Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <VelliqoBrand />
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
            <Link to="/">Home</Link><Link to="/why-velliqo">Why Velliqo?</Link><Link to="/pricing">Pricing</Link><Link to="/business-types">Business types</Link><Link to="/contact">Contact</Link>
          </div>
          <div className="text-xs text-slate-400">© 2026 Velliqo</div>
        </div>
      </footer>
    </div>
  );
}

function VelliqoBrand({ light = false }: { light?: boolean }) {
  return <Link to="/" className="flex items-center gap-3"><img src="/brand/velliqo-mark.png" alt="Velliqo" className="h-10 w-10 object-contain" /><div><div className={`font-extrabold ${light ? 'text-white' : 'text-slate-950'}`}>Velliqo</div><div className={`text-[10px] font-bold uppercase tracking-[.16em] ${light ? 'text-white/45' : 'text-slate-400'}`}>Book. Manage. Grow.</div></div></Link>;
}
function TrustItem({ text }: { text: string }) { return <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />{text}</span>; }
function Proof({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">{icon}</div><div><div className="text-sm font-extrabold">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function SectionHeading({ number, eyebrow, title, text, centered = false }: { number: string; eyebrow: string; title: string; text: string; centered?: boolean }) { return <div className={centered ? 'mx-auto max-w-4xl text-center' : 'max-w-4xl'}><div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}><span className="text-xs font-black text-violet-300">{number}</span><span className="text-xs font-extrabold uppercase tracking-[.24em] text-violet-600">{eyebrow}</span></div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">{title}</h2><p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{text}</p></div>; }
function CapabilityList({ items, tone, compact = false }: { items: string[][]; tone: 'violet' | 'fuchsia'; compact?: boolean }) { return <div className={`${compact ? 'mt-7' : ''} space-y-5`}>{items.map(([title,text],i)=><div key={title} className="flex gap-4"><div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${tone==='violet'?'bg-violet-100 text-violet-700':'bg-fuchsia-100 text-fuchsia-700'}`}>{i+1}</div><div><h3 className="font-extrabold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>)}</div>; }
function FeatureShowcase({ title, text, image, icon, device }: { title: string; text: string; image: string; icon: React.ReactNode; device: 'laptop' | 'desktop' | 'tablet' }) {
  const visual = device === 'desktop'
    ? <DesktopDevice image={image} alt={title} fit="fill" className="mx-auto max-w-[360px]" />
    : device === 'tablet'
      ? <TabletDevice image={image} alt={title} fit="fill" className="mx-auto max-w-[410px]" />
      : <LaptopDevice image={image} alt={title} fit="fill" className="mx-auto max-w-[430px]" />;

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.055] p-4 backdrop-blur">
      <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-[1.45rem] bg-gradient-to-br from-white/[.06] to-violet-500/[.08] p-3">
        {visual}
      </div>
      <div className="p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">{icon}</div>
        <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
      </div>
    </article>
  );
}

function MiniFeature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-slate-800 transition duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-[0_14px_38px_rgba(124,58,237,.10)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <span className="text-sm font-extrabold">{title}</span>
    </div>
  );
}


function FeatureLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' }) : icon}
      </div>
      <p className="pt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
function PublicBenefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">{icon}</div><h3 className="mt-4 font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>; }
function VisualCard({ image, title, label }: { image: string; title: string; label: string }) {
  return (
    <article className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,.08)]">
      <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-violet-50 to-slate-50 p-4">
        <TabletDevice image={image} alt={title} fit="fill" className="mx-auto max-w-[430px] transition duration-700 group-hover:scale-[1.015]" />
      </div>
      <div className="p-4"><span className="text-[10px] font-extrabold uppercase tracking-[.2em] text-violet-600">{label}</span><h3 className="mt-2 text-lg font-extrabold">{title}</h3></div>
    </article>
  );
}

