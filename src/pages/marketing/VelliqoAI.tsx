import { ArrowRight, AudioLines, BrainCircuit, Check, LockKeyhole, MessageSquareText, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';
import { VelliqoAIPreview } from '@/components/marketing/VelliqoAIPreview';

const capabilities = [
  { icon: BrainCircuit, title: 'Understands the active business', text: 'Answers are grounded in the current workspace, selected industry and enabled modules.' },
  { icon: MessageSquareText, title: 'Text conversations', text: 'Owners can ask operational questions in natural language without navigating through multiple reports.' },
  { icon: AudioLines, title: 'Voice conversations', text: 'Speak from mobile or desktop, interrupt spoken responses and continue in the same context.' },
  { icon: WandSparkles, title: 'Reviewable actions', text: 'Prepare appointment, customer, campaign, post and operational actions through the shared Action Engine.' },
  { icon: ShieldCheck, title: 'Permission-aware', text: 'The assistant uses the same tenant boundaries, role permissions and confirmations as the rest of Velliqo.' },
  { icon: LockKeyhole, title: 'Owner-controlled autonomy', text: 'Recommendations, drafts and low-risk automations remain configurable and auditable.' },
];

export default function VelliqoAI() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d0b18] text-white">
      <MarketingHeader active="ai" dark />
      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(124,58,237,.31),transparent_32%),radial-gradient(circle_at_88%_24%,rgba(217,70,239,.18),transparent_28%),linear-gradient(180deg,#0d0b18_0%,#100d21_100%)]" />
          <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.72fr_1.28fr] lg:px-8 lg:py-24">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-extrabold text-violet-200"><Sparkles className="h-4 w-4" />The intelligent layer inside Velliqo</div>
              <h1 className="mt-7 text-4xl font-extrabold leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-6xl">An AI manager that works where your business runs.</h1>
              <p className="mt-6 text-base leading-7 text-white/60 sm:text-lg">Ask about the day, identify opportunities, prepare protected actions and continue by voice or text—without leaving the operational workspace.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-slate-950 hover:bg-white/90"><Link to="/business-types">Start with Velliqo AI <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/[.04] px-6 text-white hover:bg-white/[.08] hover:text-white"><Link to="/experience">See the full platform</Link></Button></div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold text-white/45">{['Tenant-isolated data', 'Visible confirmations', 'Industry-aware language'].map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" />{item}</span>)}</div>
            </div>
            <VelliqoAIPreview />
          </div>
        </section>

        <section className="bg-white text-slate-950">
          <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-600">Designed for real operations</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">AI should reduce steps—not add another dashboard.</h2><p className="mt-4 text-base leading-7 text-slate-600">Velliqo AI is embedded into the same business context, permissions and action system used by the owner workspace.</p></div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-slate-200 bg-[#fbfaff] p-6 shadow-[0_18px_60px_rgba(76,29,149,.07)]"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/10 bg-[#100d21]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(124,58,237,.11),transparent)]" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div><div className="text-xs font-extrabold uppercase tracking-[.22em] text-violet-300">Control stays visible</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">A request becomes a clear, reviewable action.</h2><p className="mt-5 text-base leading-7 text-white/55">When an action requires approval, Velliqo shows what will happen before execution. Voice and chat remain open while the confirmation appears above the conversation.</p></div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[.055] p-5 shadow-[0_28px_80px_rgba(0,0,0,.24)]"><div className="flex items-center gap-3"><img src="/brand/velliqo-ai.png" alt="" className="h-11 w-11 object-contain" /><div><div className="text-sm font-extrabold">Appointment request ready</div><div className="text-xs text-white/45">Review before creating</div></div></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-white/65">Create a 45-minute appointment for Maria on Friday at 14:30 with Alex for the selected service.</div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="h-11 rounded-xl border border-white/10 bg-white/[.04] text-sm font-bold text-white/65">Change</button><button type="button" className="h-11 rounded-xl bg-white text-sm font-extrabold text-slate-950">Confirm appointment</button></div></div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-violet-700 to-fuchsia-600">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20"><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Put Velliqo AI at the centre of your working day.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70">Choose your business type and create a workspace prepared for the way your team delivers services.</p><Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-violet-800 hover:bg-white/90"><Link to="/business-types">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
