import React from 'react';
import { ArrowLeft, ArrowRight, Check, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { INDUSTRY_CATEGORIES, getIndustriesByCategory } from '@/config/industries';
import type { IndustryCategoryKey } from '@/config/industries/industry.types';

const CATEGORY_STYLES: Record<IndustryCategoryKey, { shell: string; badge: string; card: string }> = {
  beauty_personal_care: { shell: 'border-rose-200 bg-rose-50/70', badge: 'bg-rose-100 text-rose-700', card: 'hover:border-rose-300 hover:shadow-rose-100/80' },
  health_wellness: { shell: 'border-sky-200 bg-sky-50/70', badge: 'bg-sky-100 text-sky-700', card: 'hover:border-sky-300 hover:shadow-sky-100/80' },
  fitness: { shell: 'border-orange-200 bg-orange-50/70', badge: 'bg-orange-100 text-orange-700', card: 'hover:border-orange-300 hover:shadow-orange-100/80' },
  pet_services: { shell: 'border-emerald-200 bg-emerald-50/70', badge: 'bg-emerald-100 text-emerald-700', card: 'hover:border-emerald-300 hover:shadow-emerald-100/80' },
  automotive: { shell: 'border-slate-300 bg-slate-100/75', badge: 'bg-slate-200 text-slate-700', card: 'hover:border-slate-400 hover:shadow-slate-200/80' },
  home_services: { shell: 'border-cyan-200 bg-cyan-50/70', badge: 'bg-cyan-100 text-cyan-700', card: 'hover:border-cyan-300 hover:shadow-cyan-100/80' },
  professional_services: { shell: 'border-indigo-200 bg-indigo-50/70', badge: 'bg-indigo-100 text-indigo-700', card: 'hover:border-indigo-300 hover:shadow-indigo-100/80' },
  education: { shell: 'border-amber-200 bg-amber-50/70', badge: 'bg-amber-100 text-amber-700', card: 'hover:border-amber-300 hover:shadow-amber-100/80' },
  creative_services: { shell: 'border-fuchsia-200 bg-fuchsia-50/70', badge: 'bg-fuchsia-100 text-fuchsia-700', card: 'hover:border-fuchsia-300 hover:shadow-fuchsia-100/80' },
  events: { shell: 'border-violet-200 bg-violet-50/70', badge: 'bg-violet-100 text-violet-700', card: 'hover:border-violet-300 hover:shadow-violet-100/80' },
};

const SELECTED_INDUSTRY_STORAGE_KEY = 'velliqo.selectedIndustry';

export default function BusinessTypeSelection() {
  const [query, setQuery] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-[#f6f3ff] text-slate-950">
      <header className="border-b border-violet-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand/velliqo-logo.png" alt="Velliqo logo" className="h-11 w-11 rounded-xl object-contain" />
            <div><div className="font-extrabold">Velliqo</div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Book. Manage. Grow.</div></div>
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Back to website</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-violet-200 bg-gradient-to-br from-[#3f1677] via-[#5b21b6] to-[#7c3aed] text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_15%_20%,white_0,transparent_24%),radial-gradient(circle_at_85%_10%,#c4b5fd_0,transparent_26%)]" />
          <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:py-20">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-200">Workspace configuration</div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">Find your business type.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-violet-100">Choose the closest match. Velliqo will prepare relevant terminology, starter services and recommended modules before registration.</p>
            <div className="mx-auto mt-8 max-w-2xl rounded-[1.75rem] border border-white/20 bg-white/12 p-3 shadow-2xl backdrop-blur-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-500" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search e.g. dentist, barber, trainer..." className="h-14 rounded-2xl border-white bg-white pl-12 text-base text-slate-950 shadow-lg placeholder:text-slate-400" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-semibold text-violet-100"><TrustItem text="No card required"/><TrustItem text="Guided setup"/><TrustItem text="Change settings later"/></div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="space-y-8">
            {INDUSTRY_CATEGORIES.map((category) => {
              const industries = getIndustriesByCategory(category.key).filter((item) => !normalizedQuery || `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery));
              if (!industries.length) return null;
              const style = CATEGORY_STYLES[category.key];
              return (
                <section key={category.key} className={`rounded-[2rem] border p-4 shadow-sm sm:p-6 ${style.shell}`}>
                  <div className="mb-5 flex items-center gap-3 border-b border-black/5 pb-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${style.badge}`}>{category.icon}</div>
                    <div><h2 className="text-xl font-extrabold tracking-tight">{category.name}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{category.description}</p></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {industries.map((item) => (
                      <Link key={item.key} to={`/sign-up?industry=${item.key}`} onClick={() => window.localStorage.setItem(SELECTED_INDUSTRY_STORAGE_KEY, item.key)} className={`group flex min-h-[190px] flex-col rounded-3xl border border-white/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-xl ${style.card}`}>
                        <div className="flex items-start justify-between gap-4"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${style.badge}`}>{item.icon}</span><ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600" /></div>
                        <h3 className="mt-5 text-base font-extrabold">{item.name}</h3><p className="mt-2 flex-1 text-xs leading-5 text-slate-500">{item.description}</p><div className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.17em] text-violet-600">Select and continue</div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-12 flex items-start gap-3 rounded-3xl border border-violet-200 bg-white p-5 text-violet-950 shadow-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="text-sm font-bold">Cannot find an exact match?</div><p className="mt-1 text-xs leading-5 text-violet-900/70">Choose the closest service business. You will be able to rename services, categories and team terminology during setup.</p></div></div>
        </section>
      </main>
    </div>
  );
}

function TrustItem({ text }: { text: string }) {
  return <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" />{text}</span>;
}
