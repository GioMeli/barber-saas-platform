import { ArrowRight, Check, PlayCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import DemoWorkspace from '@/components/demo/DemoWorkspace';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';

export default function Demo() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f7fc] text-slate-950">
      <MarketingHeader active="demo" />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,.16),_transparent_38%),linear-gradient(180deg,#ffffff_0%,#f4f1ff_100%)]">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-violet-700 shadow-sm"><PlayCircle className="h-4 w-4" />Interactive product demo</div>
              <h1 className="mt-6 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl lg:text-6xl">Explore Velliqo before creating an account.</h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Switch between appointment-based businesses, inspect the owner workspace and try safe local actions. The demo contains sample data only and never touches a live business.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-xl bg-violet-600 px-6 hover:bg-violet-700"><a href="#workspace">Open demo workspace <ArrowRight className="ml-2 h-4 w-4" /></a></Button><Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6"><Link to="/business-types">Start free</Link></Button></div>
              <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />No login required</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />No saved data</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Multi-industry scenarios</span></div>
            </div>
          </div>
        </section>

        <section id="workspace" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <DemoWorkspace />
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[1200px] gap-5 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
            <TrustItem title="Safe by design" text="The demo has no Supabase connection and cannot read or write owner data." />
            <TrustItem title="Representative workflows" text="Calendar, customers and Velliqo AI demonstrate how the real platform is organised." />
            <TrustItem title="Clear next step" text="Create a workspace only when you are ready to configure your real business." />
          </div>
        </section>

        <section className="bg-[#0d0b18] text-white"><div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20"><ShieldCheck className="mx-auto h-8 w-8 text-emerald-300" /><h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to build your real workspace?</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/60">Choose the business type that best matches your operation. Velliqo will prepare an industry-neutral setup for services, appointments, customers and team members.</p><Button asChild size="lg" className="mt-7 h-12 rounded-xl bg-white px-6 text-violet-800 hover:bg-violet-50"><Link to="/business-types">Create a workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function TrustItem({ title, text }: { title: string; text: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><h3 className="mt-4 text-base font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>;
}
