import React from 'react';
import { ArrowLeft, ArrowRight, Check, LayoutGrid, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { IndustryVisual } from '@/components/marketing/IndustryVisual';
import { MarketingFooter } from '@/components/marketing/MarketingChrome';
import { INDUSTRY_CATEGORIES, getIndustriesByCategory } from '@/config/industries';
import type { IndustryCategoryKey } from '@/config/industries/industry.types';

const CATEGORY_STYLES: Record<IndustryCategoryKey, {
  shell: string;
  badge: string;
  card: string;
  line: string;
  count: string;
}> = {
  beauty_personal_care: { shell: 'border-rose-200/80 bg-gradient-to-br from-white via-rose-50/70 to-fuchsia-50/70', badge: 'bg-rose-100 text-rose-700 ring-rose-200', card: 'hover:border-rose-300 hover:shadow-rose-200/45', line: 'from-rose-500 to-fuchsia-500', count: 'border-rose-200 bg-rose-50 text-rose-700' },
  health_wellness: { shell: 'border-sky-200/80 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/70', badge: 'bg-sky-100 text-sky-700 ring-sky-200', card: 'hover:border-sky-300 hover:shadow-sky-200/45', line: 'from-sky-500 to-cyan-500', count: 'border-sky-200 bg-sky-50 text-sky-700' },
  fitness: { shell: 'border-orange-200/80 bg-gradient-to-br from-white via-orange-50/70 to-amber-50/70', badge: 'bg-orange-100 text-orange-700 ring-orange-200', card: 'hover:border-orange-300 hover:shadow-orange-200/45', line: 'from-orange-500 to-amber-500', count: 'border-orange-200 bg-orange-50 text-orange-700' },
  pet_services: { shell: 'border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-teal-50/70', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200', card: 'hover:border-emerald-300 hover:shadow-emerald-200/45', line: 'from-emerald-500 to-teal-500', count: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  automotive: { shell: 'border-slate-300/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/80', badge: 'bg-slate-200 text-slate-700 ring-slate-300', card: 'hover:border-slate-400 hover:shadow-slate-300/45', line: 'from-slate-700 to-slate-500', count: 'border-slate-300 bg-slate-100 text-slate-700' },
  home_services: { shell: 'border-cyan-200/80 bg-gradient-to-br from-white via-cyan-50/70 to-sky-50/70', badge: 'bg-cyan-100 text-cyan-800 ring-cyan-200', card: 'hover:border-cyan-300 hover:shadow-cyan-200/45', line: 'from-cyan-600 to-sky-500', count: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
  professional_services: { shell: 'border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/70', badge: 'bg-indigo-100 text-indigo-700 ring-indigo-200', card: 'hover:border-indigo-300 hover:shadow-indigo-200/45', line: 'from-indigo-600 to-violet-500', count: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  education: { shell: 'border-amber-200/80 bg-gradient-to-br from-white via-amber-50/70 to-yellow-50/70', badge: 'bg-amber-100 text-amber-800 ring-amber-200', card: 'hover:border-amber-300 hover:shadow-amber-200/45', line: 'from-amber-500 to-yellow-500', count: 'border-amber-200 bg-amber-50 text-amber-800' },
  creative_services: { shell: 'border-fuchsia-200/80 bg-gradient-to-br from-white via-fuchsia-50/70 to-purple-50/70', badge: 'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200', card: 'hover:border-fuchsia-300 hover:shadow-fuchsia-200/45', line: 'from-fuchsia-600 to-purple-500', count: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' },
  events: { shell: 'border-violet-200/80 bg-gradient-to-br from-white via-violet-50/70 to-fuchsia-50/70', badge: 'bg-violet-100 text-violet-700 ring-violet-200', card: 'hover:border-violet-300 hover:shadow-violet-200/45', line: 'from-violet-600 to-fuchsia-500', count: 'border-violet-200 bg-violet-50 text-violet-700' },
};

const SELECTED_INDUSTRY_STORAGE_KEY = 'velliqo.selectedIndustry';

export default function BusinessTypeSelection() {
  const [query, setQuery] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const visibleGroups = React.useMemo(() => INDUSTRY_CATEGORIES.map((category) => ({
    category,
    industries: getIndustriesByCategory(category.key).filter((item) => !normalizedQuery || `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery)),
  })).filter((group) => group.industries.length > 0), [normalizedQuery]);

  const visibleCount = visibleGroups.reduce((total, group) => total + group.industries.length, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.08),transparent_30%),linear-gradient(180deg,#faf9ff_0%,#f7f7fc_42%,#ffffff_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-violet-200/70 bg-white/88 shadow-[0_8px_30px_rgba(15,23,42,.04)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/brand/velliqo-mark-transparent-v2.png" alt="Velliqo logo" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0"><div className="font-extrabold">Velliqo</div><div className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Book. Manage. Grow.</div></div>
          </Link>
          <div className="flex items-center gap-4"><Link to="/contact" className="hidden text-sm font-semibold text-slate-600 hover:text-slate-950 sm:inline-flex">Contact</Link><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back to website</span><span className="sm:hidden">Back</span></Link></div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-violet-200 bg-[radial-gradient(circle_at_12%_18%,rgba(196,181,253,.35),transparent_24%),radial-gradient(circle_at_88%_8%,rgba(232,121,249,.24),transparent_25%),linear-gradient(135deg,#241044_0%,#4c1d95_48%,#7c3aed_100%)] text-white">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:py-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-violet-100 backdrop-blur"><Sparkles className="h-4 w-4" />Workspace configuration</div>
            <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl lg:text-6xl">Find the workspace built around your business.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-violet-100/85 sm:text-lg">Choose the closest match. Velliqo prepares relevant terminology, starter services and recommended modules before registration.</p>

            <div className="mx-auto mt-9 max-w-3xl rounded-[2rem] border border-white/20 bg-white/12 p-3 shadow-[0_28px_85px_rgba(15,23,42,.35)] backdrop-blur-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-500" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search e.g. dentist, consultant, trainer..." className="h-14 rounded-2xl border-white bg-white pl-12 text-base text-slate-950 shadow-lg placeholder:text-slate-400" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs font-semibold text-violet-100"><TrustItem text="Secure Stripe billing"/><TrustItem text="Guided setup"/><TrustItem text="Change settings later"/></div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-8 flex flex-col gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,.06)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><LayoutGrid className="h-5 w-5" /></span><div><div className="font-extrabold">Explore business types</div><p className="mt-1 text-xs text-slate-500">{visibleCount} tailored workspaces match your search.</p></div></div>
            <div className="scrollbar-subtle flex max-w-full gap-2 overflow-x-auto pb-1 sm:max-w-[65%]">
              {visibleGroups.map(({ category }) => <a key={category.key} href={`#${category.key}`} className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800">{category.icon} {category.name}</a>)}
            </div>
          </div>

          <div className="space-y-10">
            {visibleGroups.map(({ category, industries }) => {
              const style = CATEGORY_STYLES[category.key];
              return (
                <section id={category.key} key={category.key} className={`scroll-mt-28 overflow-hidden rounded-[2.25rem] border p-4 shadow-[0_18px_60px_rgba(15,23,42,.07)] sm:p-6 lg:p-7 ${style.shell}`}>
                  <div className={`mb-6 h-1.5 w-full rounded-full bg-gradient-to-r ${style.line}`} />
                  <div className="mb-6 flex flex-col gap-4 border-b border-black/[.06] pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] text-2xl shadow-sm ring-1 ${style.badge}`}>{category.icon}</div>
                      <div><h2 className="text-2xl font-extrabold tracking-[-.03em]">{category.name}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{category.description}</p></div>
                    </div>
                    <span className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] ${style.count}`}>{industries.length} business types</span>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {industries.map((item) => (
                      <Link
                        key={item.key}
                        to={`/sign-up?industry=${item.key}`}
                        onClick={() => window.localStorage.setItem(SELECTED_INDUSTRY_STORAGE_KEY, item.key)}
                        data-industry-card={item.key}
                        className={`group flex min-h-[310px] flex-col overflow-hidden rounded-[1.75rem] border border-white/90 bg-white shadow-[0_14px_38px_rgba(15,23,42,.08)] ring-1 ring-slate-950/[.025] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(15,23,42,.15)] ${style.card}`}
                      >
                        <IndustryVisual industryKey={item.key} category={item.category} emoji={item.icon} name={item.shortName} />
                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-extrabold uppercase tracking-[.17em] text-violet-600">Tailored workspace</div><h3 className="mt-2 text-lg font-extrabold tracking-[-.02em] text-slate-950">{item.name}</h3></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition group-hover:border-violet-200 group-hover:bg-violet-600 group-hover:text-white"><ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span></div>
                          <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{item.description}</p>
                          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-violet-700">Select and continue</span><span className="text-xs font-semibold text-slate-400">Guided setup</span></div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {visibleGroups.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-violet-300 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Search className="h-6 w-6" /></div>
              <h2 className="mt-4 text-xl font-extrabold">No business type found</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Try a broader term or choose the closest service business. You can customize terminology, services and modules during setup.</p>
              <button type="button" onClick={() => setQuery('')} className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Clear search</button>
            </div>
          )}

          <div className="mt-12 flex items-start gap-3 rounded-[1.75rem] border border-violet-200 bg-white p-6 text-violet-950 shadow-[0_16px_45px_rgba(76,29,149,.08)]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><div><div className="text-sm font-bold">Cannot find an exact match?</div><p className="mt-1 text-xs leading-5 text-violet-900/70">Choose the closest service business. You will be able to rename services, categories and team terminology during setup.</p></div></div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function TrustItem({ text }: { text: string }) {
  return <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" />{text}</span>;
}
