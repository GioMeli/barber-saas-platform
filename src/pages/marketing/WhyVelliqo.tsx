import React from 'react';
import { ArrowRight, BarChart3, ChevronDown, Clock3, HeartHandshake, Layers3, LockKeyhole, MonitorSmartphone, ShieldCheck, Sparkles, Store, Users, WandSparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ApprovedArtwork } from '@/components/marketing/ApprovedArtwork';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';

const reasonIcons = [Layers3, Users, Store, BarChart3, LockKeyhole, HeartHandshake];
const trustIcons = [Clock3, MonitorSmartphone, ShieldCheck, WandSparkles];

export default function WhyVelliqo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState<number | null>(0);
  const trusts = t('marketingSite.pages.why.trust', { returnObjects: true }) as Array<{title:string;text:string}>;
  const reasons = t('marketingSite.pages.why.reasons', { returnObjects: true }) as Array<{title:string;text:string}>;
  const adoptLines = t('marketingSite.pages.why.adoptLines', { returnObjects: true }) as Array<{title:string;text:string}>;
  const faqs = t('marketingSite.pages.why.faqs', { returnObjects: true }) as Array<{q:string;a:string}>;
  const values = t('marketingSite.pages.why.values', { returnObjects: true }) as Array<{title:string;text:string}>;

  return <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950">
    <MarketingHeader active="why" />
    <main>
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(124,58,237,.35),transparent_31%),radial-gradient(circle_at_88%_10%,rgba(217,70,239,.24),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-[1340px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-28">
          <div><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80"><Sparkles className="h-4 w-4 text-violet-300" />{t('marketingSite.pages.why.heroBadge')}</div><h1 className="mt-7 text-4xl font-extrabold leading-[1.02] tracking-[-.05em] sm:text-5xl lg:text-6xl">{t('marketingSite.pages.why.heroTitle')}</h1><p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg">{t('marketingSite.pages.why.heroText')}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">{t('marketingSite.pages.why.start')}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"><Link to="/pricing">{t('marketingSite.pages.why.pricing')}</Link></Button></div></div>
          <div className="relative"><div className="rounded-[2rem] border border-white/10 bg-white/[.05] p-5 shadow-[0_35px_100px_rgba(0,0,0,.35)] backdrop-blur"><ApprovedArtwork src="/marketing/approved/calendar-two-devices-transparent.png" alt="Velliqo" loading="eager" className="max-w-[760px]" /></div><div className="absolute -bottom-5 -left-3 hidden max-w-[280px] rounded-2xl border border-white/15 bg-slate-900/90 p-4 shadow-xl backdrop-blur sm:block"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200"><HeartHandshake className="h-5 w-5" /></div><div><div className="text-sm font-extrabold">{t('marketingSite.pages.why.artTitle')}</div><div className="mt-1 text-xs text-white/50">{t('marketingSite.pages.why.artText')}</div></div></div></div></div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white"><div className="mx-auto grid max-w-[1340px] gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">{trusts.map((item,i)=>{const Icon=trustIcons[i]||Sparkles;return <TrustMetric key={item.title} icon={<Icon className="h-5 w-5" />} {...item}/>})}</div></section>

      <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28"><Title eyebrow={t('marketingSite.pages.why.diffEyebrow')} title={t('marketingSite.pages.why.diffTitle')} text={t('marketingSite.pages.why.diffText')} /><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{reasons.map((item,i)=>{const Icon=reasonIcons[i]||Sparkles; return <Reason key={item.title} icon={<Icon className="h-5 w-5" />} {...item}/>})}</div></section>

      <section className="border-y border-slate-200 bg-[#f0edff]"><div className="mx-auto grid max-w-[1280px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28"><div className="rounded-[2rem] border border-violet-200 bg-white p-5 shadow-[0_28px_90px_rgba(76,29,149,.15)]"><ApprovedArtwork src="/marketing/approved/staff-page-two-devices-transparent.png" alt="Velliqo Staff Portal" className="max-w-[820px]" /></div><div><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{t('marketingSite.pages.why.adoptEyebrow')}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">{t('marketingSite.pages.why.adoptTitle')}</h2><p className="mt-5 text-base leading-7 text-slate-600">{t('marketingSite.pages.why.adoptText')}</p><div className="mt-7 space-y-4">{adoptLines.map((item)=><Line key={item.title} {...item}/>)}</div></div></div></section>

      <section className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28"><Title eyebrow={t('marketingSite.pages.why.faqEyebrow')} title={t('marketingSite.pages.why.faqTitle')} text={t('marketingSite.pages.why.faqText')} /><div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{faqs.map((faq,index)=><button key={faq.q} type="button" className="w-full border-b border-slate-200 p-5 text-left last:border-b-0 sm:p-6" onClick={()=>setOpen(open===index?null:index)}><div className="flex items-center justify-between gap-4"><span className="font-extrabold">{faq.q}</span><ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open===index?'rotate-180':''}`} /></div>{open===index&&<p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{faq.a}</p>}</button>)}</div></section>

      <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-20 sm:px-6 md:grid-cols-3 lg:px-8">{values.map((item)=><article key={item.title} className="rounded-3xl border border-slate-200 bg-[#fafaff] p-6"><ShieldCheck className="h-6 w-6 text-violet-600"/><h3 className="mt-4 text-lg font-extrabold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></article>)}</div></section>

      <section className="bg-slate-950 text-white"><div className="mx-auto max-w-[1180px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20"><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('marketingSite.pages.why.ctaTitle')}</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70">{t('marketingSite.pages.why.ctaText')}</p><Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">{t('marketingSite.pages.why.ctaButton')}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></section>
    </main><MarketingFooter />
  </div>;
}

function TrustMetric({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</div><div className="mt-4 font-extrabold">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>}
function Title({eyebrow,title,text}:{eyebrow:string;title:string;text:string}){return <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">{text}</p></div>}
function Reason({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_14px_45px_rgba(15,23,42,.055)]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</div><h3 className="mt-4 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>}
function Line({title,text}:{title:string;text:string}){return <div className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500"/><div><div className="text-sm font-extrabold">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>}
