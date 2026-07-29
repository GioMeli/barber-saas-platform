import React from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Mic,
  PackageSearch,
  Sparkles,
  UsersRound,
  WandSparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type Scenario = {
  id: string;
  label: string;
  industry: string;
  prompt: string;
  response: string;
  actionTitle: string;
  actionDetail: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'schedule',
    label: 'Schedule',
    industry: 'Physiotherapy',
    prompt: 'Find tomorrow’s gaps and suggest the best way to fill them.',
    response: 'I found two useful openings: 11:30–12:15 and 16:00–17:00. The afternoon gap matches three returning customers who usually book follow-up sessions.',
    actionTitle: 'Prepare reactivation outreach',
    actionDetail: 'Create a draft for 3 suitable customers. Nothing will be sent without approval.',
    icon: CalendarClock,
  },
  {
    id: 'customers',
    label: 'Customers',
    industry: 'Pet grooming',
    prompt: 'Which regular customers have not returned in the last 90 days?',
    response: 'Seven regular customers are now outside their normal visit cycle. Four previously booked every 6–8 weeks and have consented to marketing messages.',
    actionTitle: 'Create customer segment',
    actionDetail: 'Prepare a reactivation audience and campaign draft for the 4 eligible customers.',
    icon: UsersRound,
  },
  {
    id: 'stock',
    label: 'Inventory',
    industry: 'Car detailing',
    prompt: 'What should I restock before the weekend?',
    response: 'Three products are below their minimum level. Interior cleaner is the highest priority based on the next five booked services.',
    actionTitle: 'Prepare restock checklist',
    actionDetail: 'Add the three products and suggested quantities to a reviewable checklist.',
    icon: PackageSearch,
  },
];

export function VelliqoAIPreview({ compact = false }: { compact?: boolean }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const active = SCENARIOS[activeIndex];

  React.useEffect(() => {
    if (paused || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % SCENARIOS.length), 6200);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#11101d] text-white shadow-[0_36px_110px_rgba(13,8,30,.48)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,.30),transparent_34%),radial-gradient(circle_at_90%_90%,rgba(236,72,153,.18),transparent_32%)]" />
      <div className="relative border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-2xl bg-violet-500/25 blur-md" />
              <img src="/brand/velliqo-ai.png" alt="Velliqo AI" className="relative h-11 w-11 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-extrabold"><span>Velliqo AI</span><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" /></div>
              <div className="truncate text-xs text-white/45">Manager workspace · {active.industry}</div>
            </div>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-200 sm:block">Live product preview</div>
        </div>
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[150px_minmax(0,1fr)]">
        <div className="hidden border-r border-white/10 bg-black/10 p-3 lg:block">
          <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Ask by area</div>
          <div className="space-y-1.5">
            {SCENARIOS.map((scenario, index) => {
              const Icon = scenario.icon;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition ${index === activeIndex ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/30' : 'text-white/50 hover:bg-white/[.06] hover:text-white'}`}
                >
                  <Icon className="h-4 w-4" />
                  {scenario.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`min-w-0 p-4 sm:p-5 ${compact ? 'lg:min-h-[415px]' : 'lg:min-h-[520px]'}`}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {SCENARIOS.map((scenario, index) => (
              <button key={scenario.id} type="button" onClick={() => setActiveIndex(index)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${index === activeIndex ? 'bg-violet-500 text-white' : 'bg-white/[.06] text-white/55'}`}>{scenario.label}</button>
            ))}
          </div>

          <div key={active.id} className="velliqo-ai-scene space-y-4">
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-violet-500 px-4 py-3 text-sm font-semibold leading-6 shadow-xl shadow-violet-950/30 sm:max-w-[78%]">
              {active.prompt}
            </div>

            <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[.065] px-4 py-4 backdrop-blur sm:max-w-[88%]">
              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-violet-200"><Sparkles className="h-4 w-4" />Velliqo AI</div>
              <p className="text-sm leading-6 text-white/72">{active.response}</p>
            </div>

            <div className="max-w-[96%] rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 p-4 shadow-[0_20px_70px_rgba(76,29,149,.2)]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/20 text-violet-200"><WandSparkles className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold">{active.actionTitle}</div>
                  <p className="mt-1 text-xs leading-5 text-white/55">{active.actionDetail}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-4 text-xs font-bold text-white/65"><X className="h-3.5 w-3.5" />Not now</button>
                <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-extrabold text-slate-950"><Check className="h-3.5 w-3.5" />Review draft</button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-2">
            <div className="min-w-0 flex-1 px-2 text-xs text-white/35 sm:text-sm">Ask about your day, customers, schedule or stock…</div>
            <button type="button" aria-label="Speak to Velliqo AI" className="velliqo-mic-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white"><Mic className="h-4 w-4" /></button>
            <button type="button" aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-950"><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VelliqoAICallout() {
  return (
    <section id="velliqo-ai" className="relative overflow-hidden bg-[#0d0b18] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(124,58,237,.24),transparent_34%),radial-gradient(circle_at_92%_70%,rgba(217,70,239,.15),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:px-8 lg:py-28">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-extrabold text-violet-200"><Sparkles className="h-4 w-4" />AI built into daily operations</div>
          <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-[-.045em] sm:text-4xl lg:text-5xl">Ask. Review. Act—without leaving your workspace.</h2>
          <p className="mt-5 text-base leading-7 text-white/60">Velliqo AI works with the current business context, recognises permissions and prepares reviewable actions. Owners can speak or type while confirmations remain visible and controlled.</p>
          <div className="mt-7 space-y-3">
            {['Daily briefings based on real workspace data', 'Voice and text conversations in the same assistant', 'Reviewable confirmations before protected actions', 'Industry-aware language for service businesses'].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-semibold text-white/75"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>{item}</div>)}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/velliqo-ai">Explore Velliqo AI <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/[.04] px-6 text-white hover:bg-white/[.08] hover:text-white"><Link to="/business-types">Start your workspace</Link></Button>
          </div>
        </div>
        <VelliqoAIPreview compact />
      </div>
    </section>
  );
}
