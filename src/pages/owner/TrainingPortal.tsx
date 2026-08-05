import React from 'react';
import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  Download,
  FileText,
  GraduationCap,
  PlayCircle,
  RotateCcw,
  Search,
  Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrainingVideoDialog } from '@/components/training/TrainingVideoDialog';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import {
  getTrainingPdfPath,
  TRAINING_CATEGORIES,
  TRAINING_GUIDES,
  type TrainingCategory,
  type TrainingGuide,
} from '@/training/catalog';
import { cn } from '@/lib/utils';

export default function TrainingPortal() {
  const { t, i18n } = useTranslation();
  const { activeBusiness } = useAuth();
  const { completed, toggle, reset } = useTrainingProgress(activeBusiness?.id);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<TrainingCategory | 'all'>('all');
  const [activeVideo, setActiveVideo] = React.useState<TrainingGuide | null>(null);

  const filtered = React.useMemo(() => TRAINING_GUIDES.filter((guide) => {
    const title = t(`training.guides.${guide.slug}.title`).toLowerCase();
    const description = t(`training.guides.${guide.slug}.description`).toLowerCase();
    const matchesQuery = !query.trim() || `${title} ${description}`.includes(query.trim().toLowerCase());
    const matchesCategory = category === 'all' || guide.category === category;
    return matchesQuery && matchesCategory;
  }), [category, query, t]);

  const completionPercent = Math.round((completed.length / TRAINING_GUIDES.length) * 100);

  return (
    <div className="app-page pb-10">
      <section data-tour="training-overview" className="overflow-hidden rounded-[2rem] border border-violet-200 bg-[radial-gradient(circle_at_top_right,_rgba(232,121,249,.25),_transparent_35%),linear-gradient(135deg,#2e1065_0%,#5b21b6_52%,#7c3aed_100%)] p-5 text-white shadow-[0_24px_80px_rgba(76,29,149,.22)] sm:p-7 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-100"><GraduationCap className="h-4 w-4" />{t('training.eyebrow')}</div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{t('training.title')}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">{t('training.description')}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button asChild className="h-11 rounded-xl bg-white px-5 text-violet-800 hover:bg-violet-50"><a href={getTrainingPdfPath('getting-started', i18n.language)} target="_blank" rel="noreferrer"><BookOpenCheck className="mr-2 h-4 w-4" />{t('training.startGuide')}</a></Button><Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-white/[.06] px-5 text-white hover:bg-white/10 hover:text-white"><Link to="/dashboard/ai?mode=assistant"><PlayCircle className="mr-2 h-4 w-4" />{t('training.askAi')}</Link></Button></div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-black/15 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-extrabold uppercase tracking-[.15em] text-white/50">{t('training.progress')}</span><span className="text-2xl font-extrabold">{completionPercent}%</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${completionPercent}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/60"><span>{t('training.completedCount', { completed: completed.length, total: TRAINING_GUIDES.length })}</span>{completed.length > 0 && <button type="button" className="inline-flex items-center gap-1 font-bold text-white/75 hover:text-white" onClick={reset}><RotateCcw className="h-3.5 w-3.5" />{t('training.reset')}</button>}</div>
          </div>
        </div>
      </section>

      <section data-tour="training-filters" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('training.searchPlaceholder')} className="h-11 rounded-xl pl-10" /></div>
          <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1">
            <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>{t('training.categories.all')}</FilterButton>
            {TRAINING_CATEGORIES.map((item) => <FilterButton key={item} active={category === item} onClick={() => setCategory(item)}>{t(`training.categories.${item}`)}</FilterButton>)}
          </div>
        </div>
      </section>

      <section data-tour="training-courses" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((guide, index) => {
          const isComplete = completed.includes(guide.slug);
          const pdfPath = getTrainingPdfPath(guide.slug, i18n.language);
          const hasVideo = Boolean(guide.videoUrl);
          return (
            <article key={guide.slug} className={cn('flex min-h-[330px] flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg', isComplete ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-border')}>
              <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><FileText className="h-5 w-5" /></div><button type="button" onClick={() => toggle(guide.slug)} className={cn('inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition', isComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-background text-muted-foreground hover:text-foreground')}><span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', isComplete ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-current')}>{isComplete && <Check className="h-3 w-3" />}</span>{isComplete ? t('training.completed') : t('training.markComplete')}</button></div>
              <div className="mt-5 text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-600">{String(index + 1).padStart(2, '0')} · {t(`training.categories.${guide.category}`)}</div>
              <h2 className="mt-2 text-lg font-extrabold tracking-tight">{t(`training.guides.${guide.slug}.title`)}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{t(`training.guides.${guide.slug}.description`)}</p>
              <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{t('training.minutes', { count: guide.estimatedMinutes })}</span><span className={cn('inline-flex items-center gap-1', hasVideo && 'font-bold text-emerald-700')}><Video className="h-3.5 w-3.5" />{hasVideo ? t('training.videoAvailable') : t('training.videoComingSoonShort')}</span></div>
              {hasVideo && <Button type="button" onClick={() => setActiveVideo(guide)} className="mt-4 w-full justify-center rounded-xl bg-slate-950 text-white hover:bg-slate-800"><PlayCircle className="mr-2 h-4 w-4" />{t('training.watchVideo')}</Button>}
              <div className={cn('grid grid-cols-2 gap-2', hasVideo ? 'mt-2' : 'mt-4')}><Button asChild variant="outline" className="rounded-xl"><a href={pdfPath} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{t('training.openPdf')}</a></Button><Button asChild variant="outline" className="rounded-xl"><a href={pdfPath} download><Download className="mr-2 h-4 w-4" />{t('training.download')}</a></Button></div>
              {guide.route && <Button asChild variant="ghost" className="mt-2 justify-between rounded-xl px-3"><Link to={guide.route}>{t('training.openWorkspace')}<ArrowUpRight className="h-4 w-4" /></Link></Button>}
            </article>
          );
        })}
      </section>

      {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('training.noResults')}</div>}

      {activeVideo && (
        <TrainingVideoDialog
          open
          onOpenChange={(open) => { if (!open) setActiveVideo(null); }}
          title={t(`training.guides.${activeVideo.slug}.title`)}
          description={t(`training.guides.${activeVideo.slug}.description`)}
          videoUrl={activeVideo.videoUrl}
          videoProvider={activeVideo.videoProvider}
          posterUrl={activeVideo.videoPosterUrl}
        />
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn('whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition', active ? 'border-violet-600 bg-violet-600 text-white' : 'border-border bg-background text-muted-foreground hover:text-foreground')}>{children}</button>;
}
