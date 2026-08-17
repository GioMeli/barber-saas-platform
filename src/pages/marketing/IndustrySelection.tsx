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
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';
import { VelliqoAICallout, VelliqoAIPreview } from '@/components/marketing/VelliqoAIPreview';
import { DesktopDevice } from '@/components/marketing/DeviceFrame';
import { ApprovedArtwork } from '@/components/marketing/ApprovedArtwork';
import { DiscoverySearchBar } from '@/components/discovery/DiscoverySearchBar';

type CopyCard = { title: string; text: string };

const benefitIcons = [CalendarDays, Users, BarChart3, Store];
const trustIcons = [ShieldCheck, Workflow, Users, CreditCard];

export default function IndustrySelection() {
  const { t } = useTranslation();
  const copy = t('marketingSite.pages.product', { returnObjects: true }) as any;
  const benefits = (copy.benefits || []) as CopyCard[];
  const industries = (copy.industries || []) as string[];
  const trustFeatures = (copy.trustFeatures || []) as CopyCard[];
  const deviceLines = (copy.deviceLines || []) as CopyCard[];
  const intelLines = (copy.intelLines || []) as CopyCard[];
  const trust = (copy.trust || []) as string[];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f7fb] text-slate-950">
      <MarketingHeader active="product" />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#0d0b18] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(124,58,237,.34),transparent_31%),radial-gradient(circle_at_88%_18%,rgba(217,70,239,.18),transparent_28%),linear-gradient(180deg,#0d0b18_0%,#111025_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-violet-950/20 to-transparent" />
          <div className="relative mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="mb-10 lg:mb-12">
              <div className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-violet-200/75">{t('discovery.search.homeEyebrow')}</div>
              <DiscoverySearchBar variant="hero" />
            </div>
            <div className="grid items-center gap-12 lg:grid-cols-[.75fr_1.25fr]">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-extrabold text-violet-200"><Sparkles className="h-4 w-4" />{copy.badge}</div>
                <h1 className="mt-7 text-4xl font-extrabold leading-[1.01] tracking-[-.06em] sm:text-5xl lg:text-[4.45rem]">{copy.title}</h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-white/60 sm:text-lg">{copy.text}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">{copy.start}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/[.04] px-6 text-white hover:bg-white/[.08] hover:text-white"><Link to="/velliqo-ai"><PlayCircle className="mr-2 h-4 w-4" />{copy.seeAi}</Link></Button>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/42">{trust.map((item) => <TrustItem key={item} text={item} dark />)}</div>
              </div>
              <VelliqoAIPreview compact />
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-b border-slate-200 bg-white">
          <div className="flex min-w-max animate-[velliqo-marquee_30s_linear_infinite] items-center gap-3 px-4 py-4 motion-reduce:animate-none">
            {[...industries, ...industries].map((industry, index) => <div key={`${industry}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-600">{industry}</div>)}
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {trustFeatures.map((item, index) => { const Icon = trustIcons[index] || ShieldCheck; return <TrustFeature key={item.title} icon={<Icon className="h-5 w-5" />} title={item.title} text={item.text} />; })}
          </div>
        </section>

        <section id="product" className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <SectionHeading eyebrow={copy.productEyebrow} title={copy.productTitle} text={copy.productText} centered />
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map((item, index) => { const Icon = benefitIcons[index] || Sparkles; return <article key={item.title} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_55px_rgba(15,23,42,.055)] transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_24px_75px_rgba(76,29,149,.12)]"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-extrabold tracking-tight">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>; })}
          </div>
        </section>

        <section className="overflow-hidden border-y border-slate-200 bg-[#eeebff]">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-28">
            <ProductStage alt={copy.calendarAlt} />
            <div className="max-w-xl">
              <div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{copy.deviceEyebrow}</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">{copy.deviceTitle}</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">{copy.deviceText}</p>
              <div className="mt-7 space-y-4">{deviceLines.map((item) => <FeatureLine key={item.title} title={item.title} text={item.text} />)}</div>
              <Button asChild size="lg" className="mt-8 h-12 rounded-xl bg-violet-600 px-6 hover:bg-violet-700"><Link to="/experience">{copy.explore}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        </section>

        <VelliqoAICallout />

        <section className="bg-white">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{copy.intelEyebrow}</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{copy.intelTitle}</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">{copy.intelText}</p>
              <div className="mt-7 space-y-4">{intelLines.map((item) => <FeatureLine key={item.title} title={item.title} text={item.text} />)}</div>
            </div>
            <div className="relative mx-auto w-full max-w-[720px] rounded-[2rem] bg-gradient-to-br from-violet-100 to-white p-5 shadow-[0_30px_95px_rgba(15,23,42,.12)]"><DesktopDevice image="/marketing/screens/precision/reports-desktop.webp" alt={copy.reportsAlt} fit="fill" /></div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-gradient-to-br from-violet-700 to-fuchsia-600 text-white">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-white/55">{copy.ctaEyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.ctaTitle}</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70">{copy.ctaText}</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-violet-800 hover:bg-white/90"><Link to="/business-types">{copy.ctaStart}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/25 bg-white/[.06] px-6 text-white hover:bg-white/[.12] hover:text-white"><Link to="/pricing">{copy.ctaPricing}</Link></Button></div></div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function ProductStage({ alt }: { alt: string }) { return <div className="relative mx-auto w-full max-w-[820px] py-4 lg:pb-16"><ApprovedArtwork src="/marketing/approved/calendar-two-devices-transparent.png" alt={alt} loading="eager" className="max-w-[800px]" /></div>; }
function SectionHeading({ eyebrow, title, text, centered = false }: { eyebrow: string; title: string; text: string; centered?: boolean }) { return <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{text}</p></div>; }
function TrustItem({ text, dark = false }: { text: string; dark?: boolean }) { return <span className={`inline-flex items-center gap-2 ${dark ? 'text-white/50' : 'text-slate-600'}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full ${dark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}><Check className="h-3 w-3" /></span>{text}</span>; }
function TrustFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-slate-200 bg-[#fbfaff] p-5"><div className="text-violet-600">{icon}</div><h3 className="mt-3 text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>; }
function FeatureLine({ title, text }: { title: string; text: string }) { return <div className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"><Check className="h-3.5 w-3.5" /></span><div><div className="text-sm font-extrabold text-slate-900">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>; }
