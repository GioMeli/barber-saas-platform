import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, CalendarDays, ChevronRight, Lightbulb, MessageSquareText, Settings, Sparkles, Target, Users } from 'lucide-react';
import { AI_AGENT_REGISTRY } from '@/ai';

export default function AIHub() {
  const { t } = useTranslation();
  const { activeBusiness, profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || t('ai.ownerFallback');
  const cards = [
    { icon: <Lightbulb className="h-5 w-5" />, title: t('ai.cards.insights'), description: t('ai.cards.insightsDescription'), status: t('ai.foundationReady') },
    { icon: <BarChart3 className="h-5 w-5" />, title: t('ai.cards.businessHealth'), description: t('ai.cards.businessHealthDescription'), status: t('ai.nextSprint') },
    { icon: <Users className="h-5 w-5" />, title: t('ai.cards.customerIntelligence'), description: t('ai.cards.customerIntelligenceDescription'), status: t('ai.nextSprint') },
    { icon: <CalendarDays className="h-5 w-5" />, title: t('ai.cards.scheduling'), description: t('ai.cards.schedulingDescription'), status: t('ai.nextSprint') },
  ];
  return <div className="app-page pb-12">
    <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[#111027] p-6 text-white shadow-2xl sm:p-8 lg:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(245,158,11,.16),transparent_30%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_300px] lg:items-center">
        <div>
          <Badge className="border-violet-300/25 bg-violet-400/10 text-violet-100 hover:bg-violet-400/10"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Velliqo AI</Badge>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{t('ai.welcome', { name: firstName })}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">{t('ai.introduction', { business: activeBusiness?.name || t('ai.yourBusiness') })}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="bg-white text-slate-950 hover:bg-white/90" disabled><MessageSquareText className="mr-2 h-4 w-4" />{t('ai.askVelliqo')}</Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link to="/dashboard/ai/settings"><Settings className="mr-2 h-4 w-4" />{t('ai.settings')}</Link></Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[260px]"><img src="/brand/velliqo-ai.png" alt="Velliqo AI" className="w-full rounded-[2rem] shadow-[0_25px_70px_rgba(124,58,237,.35)]" /></div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <Card key={card.title} className="rounded-3xl shadow-card"><CardContent className="p-5"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{card.icon}</div><h2 className="mt-4 font-extrabold">{card.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p><div className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-primary">{card.status}</div></CardContent></Card>)}
    </section>

    <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="rounded-3xl shadow-card"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{t('ai.platform')}</div><h2 className="mt-2 text-xl font-extrabold">{t('ai.specialists')}</h2></div><Target className="h-5 w-5 text-primary" /></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{Object.values(AI_AGENT_REGISTRY).map((agent) => <div key={agent.key} className="rounded-2xl border bg-muted/20 p-4"><div className="font-bold">{t(agent.nameKey)}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(agent.descriptionKey)}</p></div>)}</div></CardContent></Card>
      <Card className="rounded-3xl shadow-card"><CardContent className="p-6"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></div><h2 className="mt-4 text-xl font-extrabold">{t('ai.foundationTitle')}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t('ai.foundationDescription')}</p><Link to="/dashboard/ai/settings" className="mt-6 flex items-center justify-between rounded-2xl border p-4 font-semibold hover:bg-muted/30"><span>{t('ai.reviewSettings')}</span><ChevronRight className="h-4 w-4" /></Link></CardContent></Card>
    </section>
  </div>;
}
