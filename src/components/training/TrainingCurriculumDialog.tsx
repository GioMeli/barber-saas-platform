import React from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Circle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrainingLessonVisual } from './TrainingLessonVisual';
import type { getLocalizedTrainingLesson } from '@/training/curriculum';
import { cn } from '@/lib/utils';

type LocalizedLesson = ReturnType<typeof getLocalizedTrainingLesson>;

export function TrainingCurriculumDialog({
  open,
  onOpenChange,
  title,
  description,
  lessons,
  completedLessonIds = [],
  onSetLessonComplete,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  lessons: LocalizedLesson[];
  completedLessonIds?: string[];
  onSetLessonComplete?: (lessonId: string, complete: boolean) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selected = lessons[selectedIndex] || lessons[0];
  const completedCount = lessons.filter((lesson) => completedLessonIds.includes(lesson.id)).length;
  const percent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  React.useEffect(() => {
    if (open) setSelectedIndex(0);
  }, [open, title]);

  if (!selected) return null;
  const selectedComplete = completedLessonIds.includes(selected.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[94dvh] w-[96vw] max-w-[1380px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-white px-5 py-4 pr-14 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black tracking-[-.025em] sm:text-2xl">{title}</DialogTitle>
              {description && <DialogDescription className="mt-1 max-w-3xl leading-6">{description}</DialogDescription>}
            </div>
            <div className="min-w-[230px] rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3">
              <div className="flex items-center justify-between text-xs font-bold text-violet-900">
                <span>{t('training.certification.courseProgress')}</span>
                <span>{completedCount}/{lessons.length} · {percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
                <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${percent}%` }} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 border-b bg-slate-50 lg:border-b-0 lg:border-r">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-3 sm:p-4">
                {lessons.map((lesson, index) => {
                  const completed = completedLessonIds.includes(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                        index === selectedIndex
                          ? 'border-violet-300 bg-white shadow-sm ring-2 ring-violet-100'
                          : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white',
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black',
                        completed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-500',
                      )}>
                        {completed ? <Check className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-black leading-5 text-slate-900">{lesson.title}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{lesson.page}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <ScrollArea className="min-h-0 bg-white">
            <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
              <TrainingLessonVisual
                visual={selected.visual}
                title={selected.title}
                checklist={selected.checklist}
                index={selectedIndex}
              />

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">
                      {t('training.certification.lesson')} {selectedIndex + 1} / {lessons.length}
                    </div>
                    <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-slate-950">{selected.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selected.objective}</p>
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant={selectedComplete ? 'outline' : 'default'}
                      className={cn('min-h-11 shrink-0 rounded-xl', selectedComplete && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}
                      onClick={() => void onSetLessonComplete?.(selected.id, !selectedComplete)}
                    >
                      {selectedComplete ? <Check className="mr-2 h-4 w-4" /> : <Circle className="mr-2 h-4 w-4" />}
                      {selectedComplete ? t('training.certification.completedLesson') : t('training.certification.markLessonComplete')}
                    </Button>
                  )}
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                  <h3 className="text-lg font-black text-slate-950">{t('training.certification.exactWorkflow')}</h3>
                  <ol className="mt-5 space-y-4">
                    {selected.steps.map((step, index) => (
                      <li key={`${step}-${index}`} className="flex gap-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">{index + 1}</span>
                        <div className="pt-1 text-sm font-semibold leading-6 text-slate-700">{step}</div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-5 rounded-2xl border border-violet-100 bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-[.15em] text-violet-700">{t('training.certification.checklist')}</div>
                    <ul className="mt-3 space-y-2">
                      {selected.checklist.map((item) => (
                        <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
                          <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center gap-2 text-sm font-black text-amber-950"><ShieldCheck className="h-5 w-5" />{t('training.certification.safetyCheck')}</div>
                    <p className="mt-3 text-sm leading-6 text-amber-900/80">{selected.tipText}</p>
                  </div>

                  {selected.route && !readOnly && (
                    <Button asChild variant="outline" className="h-auto min-h-12 w-full justify-between rounded-2xl border-violet-200 bg-violet-50/50 px-4 text-violet-800 hover:bg-violet-100">
                      <Link to={selected.route} onClick={() => onOpenChange(false)}>
                        {t('training.openWorkspace')}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </section>

              <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-12px_40px_rgba(15,23,42,.08)] backdrop-blur">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={selectedIndex === 0}
                  onClick={() => setSelectedIndex((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />{t('common.back')}
                </Button>
                <span className="hidden text-xs font-bold text-slate-500 sm:block">{selectedIndex + 1} / {lessons.length}</span>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={selectedIndex === lessons.length - 1}
                  onClick={() => setSelectedIndex((current) => Math.min(lessons.length - 1, current + 1))}
                >
                  {t('common.next')}<ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
