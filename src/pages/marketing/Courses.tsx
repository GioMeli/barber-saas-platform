import React from 'react';
import { ArrowRight, BookOpenCheck, Download, FileText, GraduationCap, PlayCircle, Search, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';
import { TrainingCourseVisual } from '@/components/training/TrainingCourseVisual';
import { TrainingVideoDialog } from '@/components/training/TrainingVideoDialog';
import { TrainingCurriculumDialog } from '@/components/training/TrainingCurriculumDialog';
import { getTrainingLessonsForGuide } from '@/training/curriculum';
import {
  getTrainingPdfPath,
  TRAINING_CATEGORIES,
  TRAINING_GUIDES,
  type TrainingCategory,
  type TrainingGuide,
} from '@/training/catalog';
import { cn } from '@/lib/utils';

export default function Courses({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<TrainingCategory | 'all'>('all');
  const [activeVideo, setActiveVideo] = React.useState<TrainingGuide | null>(null);
  const [activeGuide, setActiveGuide] = React.useState<TrainingGuide | null>(null);

  const filtered = React.useMemo(() => TRAINING_GUIDES.filter((guide) => {
    const title = t(`training.guides.${guide.slug}.title`).toLowerCase();
    const description = t(`training.guides.${guide.slug}.description`).toLowerCase();
    return (!query.trim() || `${title} ${description}`.includes(query.trim().toLowerCase())) && (category === 'all' || guide.category === category);
  }), [category, query, t]);

  const availableVideoCount = TRAINING_GUIDES.filter((guide) => Boolean(guide.videoUrl)).length;

  const content = (
    <div className={cn('mx-auto w-full max-w-[1440px]', embedded ? 'space-y-6' : 'px-4 py-14 sm:px-6 lg:px-8 lg:py-20')}>
      <section className={cn('overflow-hidden rounded-[2rem] border border-violet-200 bg-[radial-gradient(circle_at_top_right,_rgba(232,121,249,.24),_transparent_36%),linear-gradient(135deg,#2e1065_0%,#5b21b6_52%,#7c3aed_100%)] p-5 text-white shadow-[0_24px_80px_rgba(76,29,149,.2)] sm:p-8', embedded && 'rounded-2xl')}>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-100"><GraduationCap className="h-4 w-4" />{t('training.publicEyebrow')}</div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em] sm:text-5xl">{t('training.publicTitle')}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base">{t('training.publicDescription')}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-xl bg-white px-5 text-violet-800 hover:bg-violet-50"><a href={getTrainingPdfPath('getting-started', i18n.language)} target="_blank" rel="noreferrer"><BookOpenCheck className="mr-2 h-4 w-4" />{t('training.startGuide')}</a></Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-white/[.06] px-5 text-white hover:bg-white/10 hover:text-white"><Link to="/demo"><PlayCircle className="mr-2 h-4 w-4" />{t('training.openDemo')}</Link></Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-black/15 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Video className="h-5 w-5" /></span><div><div className="font-extrabold">{t('training.videoLibrary')}</div><p className="mt-1 text-xs leading-5 text-white/55">{t('training.videoLibraryDescription')}</p></div></div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[.05] p-3 text-xs text-white/65">{availableVideoCount > 0 ? t('training.videoLibraryAvailable', { count: availableVideoCount }) : t('training.videoComingSoon')}</div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('training.searchPlaceholder')} className="h-11 rounded-xl pl-10" /></div>
          <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1"><Filter active={category === 'all'} onClick={() => setCategory('all')}>{t('training.categories.all')}</Filter>{TRAINING_CATEGORIES.map((item) => <Filter key={item} active={category === item} onClick={() => setCategory(item)}>{t(`training.categories.${item}`)}</Filter>)}</div>
        </div>
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((guide, index) => {
          const pdfPath = getTrainingPdfPath(guide.slug, i18n.language);
          const demoPath = guide.demoRoute || guide.route?.replace('/dashboard', '/demo') || '/demo';
          const hasVideo = Boolean(guide.videoUrl);
          const lessons = getTrainingLessonsForGuide('owner', guide.slug, i18n.language);
          return (
            <article key={guide.slug} className="group relative flex min-h-[430px] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white p-3 shadow-[0_18px_55px_rgba(15,23,42,.09)] ring-1 ring-slate-950/[.025] transition duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_26px_70px_rgba(76,29,149,.16)]">
              <TrainingCourseVisual
                slug={guide.slug}
                category={guide.category}
                index={index}
                categoryLabel={t(`training.categories.${guide.category}`)}
                hasVideo={hasVideo}
                videoLabel={hasVideo ? t('training.videoAvailable') : t('training.videoComingSoonShort')}
              />
              <div className="flex flex-1 flex-col px-2 pb-2 pt-5 sm:px-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.15em] text-violet-700">{t('training.certification.lessonCount', { count: lessons.length })}</span>
                  <span className="text-xs font-bold text-slate-500">{t('training.minutes', { count: guide.estimatedMinutes })}</span>
                </div>
                <h2 className="text-xl font-extrabold tracking-[-.025em] text-slate-950 transition group-hover:text-violet-800">{t(`training.guides.${guide.slug}.title`)}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{t(`training.guides.${guide.slug}.description`)}</p>
                <Button type="button" onClick={() => setActiveGuide(guide)} className="mt-5 w-full justify-between rounded-xl bg-violet-700 text-white shadow-sm hover:bg-violet-800"><span className="inline-flex items-center"><GraduationCap className="mr-2 h-4 w-4" />{t('training.certification.viewCurriculum')}</span><ArrowRight className="h-4 w-4" /></Button>
                {hasVideo && <Button type="button" onClick={() => setActiveVideo(guide)} className="mt-2 w-full justify-between rounded-xl bg-slate-950 text-white shadow-sm hover:bg-slate-800"><span className="inline-flex items-center"><PlayCircle className="mr-2 h-4 w-4" />{t('training.watchVideo')}</span><ArrowRight className="h-4 w-4" /></Button>}
                <div className="mt-2 grid grid-cols-2 gap-2"><Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50"><a href={pdfPath} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{t('training.openPdf')}</a></Button><Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50"><a href={pdfPath} download><Download className="mr-2 h-4 w-4" />{t('training.download')}</a></Button></div>
                <Button asChild className="mt-2 justify-between rounded-xl bg-violet-600 shadow-sm hover:bg-violet-700"><Link to={demoPath}>{t('training.practiceInDemo')}<ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            </article>
          );
        })}
      </section>
      {filtered.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t('training.noResults')}</div>}


      {activeGuide && (
        <TrainingCurriculumDialog
          open
          onOpenChange={(open) => { if (!open) setActiveGuide(null); }}
          title={t(`training.guides.${activeGuide.slug}.title`)}
          description={t(`training.guides.${activeGuide.slug}.description`)}
          lessons={getTrainingLessonsForGuide('owner', activeGuide.slug, i18n.language)}
          readOnly
        />
      )}

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

  if (embedded) return content;
  return <div className="min-h-screen bg-[#f7f7fc] text-slate-950"><MarketingHeader active="courses" /><main>{content}</main><MarketingFooter /></div>;
}

function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn('whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition', active ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-950')}>{children}</button>; }
