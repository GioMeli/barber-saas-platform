import { ArrowRight, BarChart3, CalendarDays, Check, Globe2, ShieldCheck, Smartphone, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ApprovedArtwork } from '@/components/marketing/ApprovedArtwork';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';

const ownerIcons = [CalendarDays, Users, BarChart3, Sparkles];
const commonIcons = [Smartphone, Sparkles, ShieldCheck, Globe2];

export default function Experience() {
  const { t } = useTranslation();
  const trust = t('marketingSite.pages.experience.trust', { returnObjects: true }) as string[];
  return <div className="min-h-screen overflow-x-hidden bg-[#f7f8fc] text-slate-950">
    <MarketingHeader active="experience" dark />
    <main>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(124,58,237,.38),transparent_30%),radial-gradient(circle_at_82%_4%,rgba(217,70,239,.23),transparent_28%)]" />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-20 pt-20 text-center sm:px-6 lg:px-8 lg:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-xs font-extrabold text-violet-200"><Sparkles className="h-4 w-4" />{t('marketingSite.pages.experience.badge')}</div>
          <h1 className="mx-auto mt-7 max-w-5xl text-4xl font-extrabold leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-7xl">{t('marketingSite.pages.experience.title')}</h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-white/68 sm:text-xl">{t('marketingSite.pages.experience.text')}</p>
          <div className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">{trust.map((item)=><div key={item} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.055] p-4 text-left text-sm font-semibold text-white/70"><Check className="h-4 w-4 shrink-0 text-emerald-300" />{item}</div>)}</div>
          <div className="mx-auto mt-16 w-full max-w-6xl pb-8 lg:mt-20 lg:pb-20"><ApprovedArtwork src="/marketing/approved/owner-ai-two-devices-transparent.png" alt="Velliqo" loading="eager" className="max-w-[1120px]" /></div>
        </div>
      </section>

      <ExperienceSection theme="light" eyebrow={t('marketingSite.pages.experience.ownerEyebrow')} title={t('marketingSite.pages.experience.ownerTitle')} text={t('marketingSite.pages.experience.ownerText')} image="/marketing/approved/calendar-two-devices-transparent.png" cards={t('marketingSite.pages.experience.ownerCards',{returnObjects:true}) as CardCopy[]} icons={ownerIcons} />
      <ExperienceSection theme="dark" eyebrow={t('marketingSite.pages.experience.staffEyebrow')} title={t('marketingSite.pages.experience.staffTitle')} text={t('marketingSite.pages.experience.staffText')} image="/marketing/approved/staff-page-two-devices-transparent.png" cards={t('marketingSite.pages.experience.staffCards',{returnObjects:true}) as CardCopy[]} icons={commonIcons} />
      <ExperienceSection theme="light" eyebrow={t('marketingSite.pages.experience.customerEyebrow')} title={t('marketingSite.pages.experience.customerTitle')} text={t('marketingSite.pages.experience.customerText')} image="/marketing/approved/customer-page-two-devices-transparent.png" cards={t('marketingSite.pages.experience.customerCards',{returnObjects:true}) as CardCopy[]} icons={commonIcons} reverse />
      <ExperienceSection theme="soft" eyebrow={t('marketingSite.pages.experience.publicEyebrow')} title={t('marketingSite.pages.experience.publicTitle')} text={t('marketingSite.pages.experience.publicText')} image="/marketing/approved/customer-booking-two-devices-transparent.png" cards={t('marketingSite.pages.experience.publicCards',{returnObjects:true}) as CardCopy[]} icons={commonIcons} />

      <section className="bg-slate-950 text-white"><div className="mx-auto max-w-[1180px] px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20"><Sparkles className="mx-auto h-10 w-10 text-violet-300"/><h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold tracking-[-.045em] sm:text-5xl">{t('marketingSite.pages.experience.ctaTitle')}</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65">{t('marketingSite.pages.experience.ctaText')}</p><Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">{t('marketingSite.pages.experience.cta')}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div></section>
    </main><MarketingFooter />
  </div>;
}

type CardCopy={title:string;text:string};
function ExperienceSection({theme,eyebrow,title,text,image,cards,icons,reverse=false}:{theme:'light'|'dark'|'soft';eyebrow:string;title:string;text:string;image:string;cards:CardCopy[];icons:any[];reverse?:boolean}){
  const dark=theme==='dark';
  return <section className={dark?'bg-[#0b1020] py-20 text-white lg:py-28':theme==='soft'?'border-y border-violet-100 bg-violet-50/65 py-20 lg:py-28':'bg-white py-20 lg:py-28'}><div className="mx-auto max-w-[1340px] px-4 sm:px-6 lg:px-8"><div className={`grid items-center gap-12 lg:grid-cols-2 ${reverse?'lg:[&>*:first-child]:order-2':''}`}><div><div className={`text-xs font-extrabold uppercase tracking-[.2em] ${dark?'text-violet-300':'text-violet-600'}`}>{eyebrow}</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl lg:text-5xl">{title}</h2><p className={`mt-5 max-w-xl text-base leading-7 ${dark?'text-white/60':'text-slate-600'}`}>{text}</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{cards.map((card,i)=>{const Icon=icons[i]||Sparkles;return <article key={card.title} className={`rounded-2xl border p-5 ${dark?'border-white/10 bg-white/[.055]':'border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,.05)]'}`}><Icon className={`h-5 w-5 ${dark?'text-violet-300':'text-violet-600'}`}/><h3 className="mt-4 font-extrabold">{card.title}</h3><p className={`mt-2 text-sm leading-6 ${dark?'text-white/55':'text-slate-600'}`}>{card.text}</p></article>})}</div></div><div className={`rounded-[2rem] border p-5 ${dark?'border-white/10 bg-white/[.04]':'border-violet-100 bg-white shadow-[0_28px_90px_rgba(76,29,149,.10)]'}`}><ApprovedArtwork src={image} alt="Velliqo" className="max-w-[760px]"/></div></div></div></section>
}
