import React from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MessageSquareText,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEMO_SCENARIOS } from '@/demo/sampleData';
import { cn } from '@/lib/utils';

type DemoTab = 'overview' | 'calendar' | 'customers' | 'ai';

const tabs: Array<{ key: DemoTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'ai', label: 'Velliqo AI', icon: Sparkles },
];

export default function DemoWorkspace() {
  const [scenarioIndex, setScenarioIndex] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<DemoTab>('overview');
  const [extraAppointment, setExtraAppointment] = React.useState(false);
  const [aiAsked, setAiAsked] = React.useState(false);
  const scenario = DEMO_SCENARIOS[scenarioIndex];

  const reset = () => {
    setExtraAppointment(false);
    setAiAsked(false);
    setActiveTab('overview');
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d0b18] shadow-[0_40px_120px_rgba(15,23,42,.28)]">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[.035] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><ShieldCheck className="h-4 w-4" /></span>
          <div><div className="text-xs font-extrabold uppercase tracking-[.18em] text-emerald-300">Safe interactive demo</div><p className="text-xs text-white/48">Sample data only. Nothing is saved or sent.</p></div>
        </div>
        <Button type="button" variant="ghost" className="h-9 justify-start rounded-xl text-white/65 hover:bg-white/10 hover:text-white sm:justify-center" onClick={reset}><RefreshCw className="mr-2 h-4 w-4" />Reset demo</Button>
      </div>

      <div className="grid min-h-[680px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#11101d] p-4 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-3">
            <img src="/brand/velliqo-mark.png" alt="Velliqo" className="h-10 w-10 rounded-xl" />
            <div className="min-w-0"><div className="truncate text-sm font-extrabold">{scenario.businessName}</div><div className="truncate text-[11px] text-white/45">{scenario.industry}</div></div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setActiveTab(key)} className={cn('flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-xs font-bold transition', activeTab === key ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/25' : 'text-white/55 hover:bg-white/[.06] hover:text-white')}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/35">Switch industry</div>
            <div className="grid gap-2">
              {DEMO_SCENARIOS.map((item, index) => (
                <button key={item.key} type="button" onClick={() => { setScenarioIndex(index); reset(); }} className={cn('rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition', index === scenarioIndex ? 'border-violet-400/40 bg-violet-400/10 text-violet-200' : 'border-white/[.07] text-white/45 hover:border-white/15 hover:text-white/75')}>
                  {item.industry}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 bg-[#f7f7fc] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-violet-600">Interactive owner workspace</div><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{scenario.businessName}</h2></div>
            <Button type="button" className="rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={() => { setExtraAppointment(true); setActiveTab('calendar'); }}><Plus className="mr-2 h-4 w-4" />Add demo appointment</Button>
          </div>

          {activeTab === 'overview' && <Overview scenario={scenario} extraAppointment={extraAppointment} />}
          {activeTab === 'calendar' && <CalendarView scenario={scenario} extraAppointment={extraAppointment} />}
          {activeTab === 'customers' && <CustomersView scenario={scenario} />}
          {activeTab === 'ai' && <AIView scenario={scenario} asked={aiAsked} onAsk={() => setAiAsked(true)} />}
        </section>
      </div>
    </div>
  );
}

function Overview({ scenario, extraAppointment }: { scenario: (typeof DEMO_SCENARIOS)[number]; extraAppointment: boolean }) {
  const metrics = [
    { label: "Today's appointments", value: scenario.metrics.appointments + (extraAppointment ? 1 : 0), icon: CalendarDays },
    { label: 'Expected revenue', value: `${scenario.currency}${scenario.metrics.revenue + (extraAppointment ? 55 : 0)}`, icon: CircleDollarSign },
    { label: 'Active customers', value: scenario.metrics.customers, icon: Users },
    { label: 'Team utilisation', value: `${scenario.metrics.utilisation}%`, icon: BarChart3 },
  ];
  return <div className="mt-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{label}</span><Icon className="h-4 w-4 text-violet-600" /></div><div className="mt-3 text-2xl font-extrabold text-slate-950">{value}</div></article>)}</div><div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><CalendarView scenario={scenario} extraAppointment={extraAppointment} compact /><AIRecommendation scenario={scenario} /></div></div>;
}

function CalendarView({ scenario, extraAppointment, compact = false }: { scenario: (typeof DEMO_SCENARIOS)[number]; extraAppointment: boolean; compact?: boolean }) {
  const rows = extraAppointment ? [...scenario.appointments, { time: '17:00', customer: 'Demo customer', service: scenario.services[0].name, professional: 'Available team member', status: 'confirmed' as const }] : scenario.appointments;
  return <div className={cn(compact ? '' : 'mt-6', 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm')}><div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-slate-950">Today&apos;s schedule</h3><p className="text-xs text-slate-500">Local sample appointments</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">Live preview</span></div><div className="mt-4 grid gap-2">{rows.map((appointment) => <div key={`${appointment.time}-${appointment.customer}`} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 sm:grid-cols-[64px_minmax(0,1fr)_auto]"><div className="text-xs font-extrabold text-slate-900">{appointment.time}</div><div className="min-w-0"><div className="truncate text-xs font-extrabold text-slate-900">{appointment.customer}</div><div className="truncate text-[11px] text-slate-500">{appointment.service} · {appointment.professional}</div></div><span className={cn('hidden rounded-full px-2 py-1 text-[10px] font-bold sm:inline-flex', appointment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700')}>{appointment.status}</span></div>)}</div></div>;
}

function CustomersView({ scenario }: { scenario: (typeof DEMO_SCENARIOS)[number] }) {
  return <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4"><h3 className="text-sm font-extrabold">Customer intelligence</h3><p className="text-xs text-slate-500">Sample profiles and lifetime value</p></div><div className="divide-y divide-slate-100">{scenario.customers.map((customer) => <div key={customer.name} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto] sm:items-center"><div><div className="text-sm font-extrabold">{customer.name}</div><div className="text-xs text-slate-500">Last visit: {customer.lastVisit}</div></div><div className="text-xs text-slate-500"><span className="font-extrabold text-slate-900">{customer.visits}</span> visits</div><div className="text-xs text-slate-500"><span className="font-extrabold text-slate-900">{scenario.currency}{customer.value}</span> value</div><ChevronRight className="hidden h-4 w-4 text-slate-400 sm:block" /></div>)}</div></div>;
}

function AIRecommendation({ scenario }: { scenario: (typeof DEMO_SCENARIOS)[number] }) {
  return <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-700 to-fuchsia-600 p-5 text-white shadow-lg"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-white/60"><Sparkles className="h-4 w-4" />Velliqo AI</div><h3 className="mt-4 text-xl font-extrabold">A recommendation ready for review</h3><p className="mt-3 text-sm leading-6 text-white/72">{scenario.aiResponse}</p></div>;
}

function AIView({ scenario, asked, onAsk }: { scenario: (typeof DEMO_SCENARIOS)[number]; asked: boolean; onAsk: () => void }) {
  return <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><img src="/brand/velliqo-ai.png" alt="Velliqo AI" className="h-10 w-10 object-contain" /><div><div className="text-sm font-extrabold">Velliqo AI conversation</div><div className="text-xs text-slate-500">Text, voice and reviewable actions</div></div></div><div className="mt-4 space-y-3"><div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm text-white">{scenario.aiPrompt}</div>{asked && <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-violet-50 px-4 py-3 text-sm leading-6 text-slate-700">{scenario.aiResponse}</div>}</div><Button type="button" className="mt-5 rounded-xl bg-violet-600 hover:bg-violet-700" onClick={onAsk} disabled={asked}><MessageSquareText className="mr-2 h-4 w-4" />{asked ? 'Demo response generated' : 'Send sample request'}</Button></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950"><CheckCircle2 className="h-5 w-5" /></div><h3 className="mt-4 text-base font-extrabold">Protected actions stay reviewable</h3><p className="mt-2 text-sm leading-6 text-slate-600">Campaigns, appointment changes and other important actions require confirmation. This demo never writes to a database.</p><div className="mt-4 flex items-center gap-2 text-xs font-bold text-amber-800"><Clock3 className="h-4 w-4" />Confirmation happens in context</div></div></div>;
}
