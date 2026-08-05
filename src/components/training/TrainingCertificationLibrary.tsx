import React from 'react';
import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  Download,
  FileText,
  GraduationCap,
  PlayCircle,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrainingCourseVisual } from './TrainingCourseVisual';
import { TrainingVideoDialog } from './TrainingVideoDialog';
import { TrainingCurriculumDialog } from './TrainingCurriculumDialog';
import { TrainingQuizDialog } from './TrainingQuizDialog';
import { TrainingCertificateCard } from './TrainingCertificateCard';
import { useCertifiedTrainingProgress } from '@/hooks/useCertifiedTrainingProgress';
import {
  getTrainingCompletionPercent,
  getTrainingLessons,
  getTrainingLessonsForGuide,
  type TrainingAudience,
} from '@/training/curriculum';
import { buildTrainingQuiz } from '@/training/quiz';
import {
  getTrainingPdfPath,
  TRAINING_CATEGORIES,
  TRAINING_GUIDES,
  type TrainingCategory,
  type TrainingGuide,
} from '@/training/catalog';
import { cn } from '@/lib/utils';

export function TrainingCertificationLibrary({
  audience,
  business,
  userId,
  employeeId,
  participantName,
  embedded = false,
}: {
  audience: TrainingAudience;
  business: { id?: string; name?: string } | null | undefined;
  userId?: string | null;
  employeeId?: string | null;
  participantName: string;
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<TrainingCategory | 'all'>('all');
  const [activeGuide, setActiveGuide] = React.useState<TrainingGuide | null>(null);
  const [activeVideo, setActiveVideo] = React.useState<TrainingGuide | null>(null);
  const [quizOpen, setQuizOpen] = React.useState(false);

  const {
    progress,
    loading,
    saving,
    setLessonCompleted,
    submitQuiz,
  } = useCertifiedTrainingProgress({
    audience,
    businessId: business?.id,
    userId,
    employeeId,
  });

  const allLessons = React.useMemo(() => getTrainingLessons(audience, i18n.language), [audience, i18n.language]);
  const applicableGuideSlugs = React.useMemo(() => new Set(allLessons.map((lesson) => lesson.guideSlug)), [allLessons]);
  const applicableGuides = React.useMemo(
    () => TRAINING_GUIDES.filter((guide) => applicableGuideSlugs.has(guide.slug)),
    [applicableGuideSlugs],
  );
  const filtered = React.useMemo(() => applicableGuides.filter((guide) => {
    const title = t(`training.guides.${guide.slug}.title`).toLowerCase();
    const description = t(`training.guides.${guide.slug}.description`).toLowerCase();
    const lessons = getTrainingLessonsForGuide(audience, guide.slug, i18n.language);
    const lessonText = lessons.map((lesson) => `${lesson.title} ${lesson.objective}`).join(' ').toLowerCase();
    const matchesQuery = !query.trim() || `${title} ${description} ${lessonText}`.includes(query.trim().toLowerCase());
    const matchesCategory = category === 'all' || guide.category === category;
    return matchesQuery && matchesCategory;
  }), [applicableGuides, audience, category, i18n.language, query, t]);

  const completionPercent = getTrainingCompletionPercent(progress.completedLessonIds, audience);
  const quiz = React.useMemo(() => buildTrainingQuiz(audience, i18n.language), [audience, i18n.language]);
  const activeLessons = activeGuide
    ? getTrainingLessonsForGuide(audience, activeGuide.slug, i18n.language)
    : [];

  const heroTitle = audience === 'owner' ? t('training.title') : t('training.certification.staffTrainingTitle');
  const heroDescription = audience === 'owner' ? t('training.certification.ownerTrainingDescription') : t('training.certification.staffTrainingDescription');

  return (
    <div className={cn('space-y-6', embedded ? 'pb-4' : 'app-page pb-10')}>
      <section className="overflow-hidden rounded-[2rem] border border-violet-200 bg-[radial-gradient(circle_at_top_right,_rgba(232,121,249,.25),_transparent_35%),linear-gradient(135deg,#2e1065_0%,#5b21b6_52%,#7c3aed_100%)] p-5 text-white shadow-[0_24px_80px_rgba(76,29,149,.22)] sm:p-7 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-100"><GraduationCap className="h-4 w-4" />{audience === 'owner' ? t('training.eyebrow') : t('training.certification.staffEyebrow')}</div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{heroTitle}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base">{heroDescription}</p>
            {audience === 'owner' && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 rounded-xl bg-white px-5 text-violet-800 hover:bg-violet-50"><a href={getTrainingPdfPath('getting-started', i18n.language)} target="_blank" rel="noreferrer"><BookOpenCheck className="mr-2 h-4 w-4" />{t('training.startGuide')}</a></Button>
                <Button asChild variant="outline" className="h-11 rounded-xl border-white/20 bg-white/[.06] px-5 text-white hover:bg-white/10 hover:text-white"><Link to="/dashboard/ai?mode=assistant"><PlayCircle className="mr-2 h-4 w-4" />{t('training.askAi')}</Link></Button>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-white/15 bg-black/15 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between"><span className="text-xs font-extrabold uppercase tracking-[.15em] text-white/50">{t('training.progress')}</span><span className="text-2xl font-extrabold">{completionPercent}%</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${completionPercent}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/60"><span>{t('training.certification.lessonsCompleted', { completed: progress.completedLessonIds.length, total: allLessons.length })}</span>{saving && <span>{t('training.certification.savingProgress')}</span>}</div>
          </div>
        </div>
      </section>

      <TrainingCertificateCard
        audience={audience}
        participantName={participantName}
        businessName={business?.name || 'Velliqo Business'}
        completionPercent={completionPercent}
        bestScore={progress.bestScore}
        passed={progress.passed}
        certificateNumber={progress.certificateNumber}
        certifiedAt={progress.certifiedAt}
        language={i18n.language}
        onStartQuiz={() => setQuizOpen(true)}
      />

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('training.searchPlaceholder')} className="h-11 rounded-xl pl-10" /></div>
          <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1">
            <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>{t('training.categories.all')}</FilterButton>
            {TRAINING_CATEGORIES.filter((item) => applicableGuides.some((guide) => guide.category === item)).map((item) => <FilterButton key={item} active={category === item} onClick={() => setCategory(item)}>{t(`training.categories.${item}`)}</FilterButton>)}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((guide, index) => {
          const lessons = getTrainingLessonsForGuide(audience, guide.slug, i18n.language);
          const completedCount = lessons.filter((lesson) => progress.completedLessonIds.includes(lesson.id)).length;
          const courseComplete = lessons.length > 0 && completedCount === lessons.length;
          const pdfPath = getTrainingPdfPath(guide.slug, i18n.language);
          const hasVideo = Boolean(guide.videoUrl);
          return (
            <article key={guide.slug} className={cn('group relative flex min-h-[450px] flex-col overflow-hidden rounded-[1.75rem] border bg-card p-3 shadow-[0_16px_48px_rgba(15,23,42,.08)] ring-1 ring-foreground/[.025] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(76,29,149,.14)]', courseComplete ? 'border-emerald-300 ring-emerald-200/80' : 'border-border hover:border-violet-300')}>
              <TrainingCourseVisual
                slug={guide.slug}
                category={guide.category}
                index={index}
                categoryLabel={t(`training.categories.${guide.category}`)}
                hasVideo={hasVideo}
                videoLabel={hasVideo ? t('training.videoAvailable') : t('training.videoComingSoonShort')}
                completed={courseComplete}
                completedLabel={t('training.completed')}
              />
              <div className="flex flex-1 flex-col px-2 pb-2 pt-4 sm:px-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={cn('inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold', courseComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-violet-100 bg-violet-50 text-violet-800')}>
                    {courseComplete && <Check className="h-4 w-4" />}{t('training.certification.lessonCount', { count: lessons.length })}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">{completedCount}/{lessons.length}</span>
                </div>
                <h2 className="text-xl font-extrabold tracking-[-.025em] transition group-hover:text-violet-700">{t(`training.guides.${guide.slug}.title`)}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{t(`training.guides.${guide.slug}.description`)}</p>
                <Button type="button" className="mt-5 w-full justify-between rounded-xl bg-violet-700 hover:bg-violet-800" onClick={() => setActiveGuide(guide)}>
                  <span className="inline-flex items-center"><GraduationCap className="mr-2 h-4 w-4" />{t('training.certification.openCourse')}</span><ArrowUpRight className="h-4 w-4" />
                </Button>
                {audience === 'owner' && (
                  <>
                    {hasVideo && <Button type="button" onClick={() => setActiveVideo(guide)} className="mt-2 w-full justify-center rounded-xl bg-slate-950 text-white shadow-sm hover:bg-slate-800"><PlayCircle className="mr-2 h-4 w-4" />{t('training.watchVideo')}</Button>}
                    <div className="mt-2 grid grid-cols-2 gap-2"><Button asChild variant="outline" className="rounded-xl"><a href={pdfPath} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />{t('training.openPdf')}</a></Button><Button asChild variant="outline" className="rounded-xl"><a href={pdfPath} download><Download className="mr-2 h-4 w-4" />{t('training.download')}</a></Button></div>
                    {guide.route && <Button asChild variant="ghost" className="mt-2 justify-between rounded-xl px-3"><Link to={guide.route}>{t('training.openWorkspace')}<ArrowUpRight className="h-4 w-4" /></Link></Button>}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!loading && filtered.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('training.noResults')}</div>}

      {activeGuide && (
        <TrainingCurriculumDialog
          open
          onOpenChange={(open) => { if (!open) setActiveGuide(null); }}
          title={t(`training.guides.${activeGuide.slug}.title`)}
          description={t(`training.guides.${activeGuide.slug}.description`)}
          lessons={activeLessons}
          completedLessonIds={progress.completedLessonIds}
          onSetLessonComplete={setLessonCompleted}
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

      <TrainingQuizDialog
        open={quizOpen}
        onOpenChange={setQuizOpen}
        questions={quiz}
        onSubmit={submitQuiz}
      />
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn('whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold transition', active ? 'border-violet-600 bg-violet-600 text-white' : 'border-border bg-background text-muted-foreground hover:text-foreground')}>{children}</button>;
}
