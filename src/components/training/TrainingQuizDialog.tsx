import React from 'react';
import { Award, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { calculateTrainingQuizScore, type TrainingQuizQuestion } from '@/training/quiz';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 5;

export function TrainingQuizDialog({
  open,
  onOpenChange,
  questions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: TrainingQuizQuestion[];
  onSubmit: (score: number) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [page, setPage] = React.useState(0);
  const [score, setScore] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAnswers({});
      setPage(0);
      setScore(null);
      setSubmitting(false);
    }
  }, [open]);

  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const pageQuestions = questions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const submit = async () => {
    if (!allAnswered) return;
    const nextScore = calculateTrainingQuizScore(questions, answers);
    setSubmitting(true);
    await onSubmit(nextScore);
    setSubmitting(false);
    setScore(nextScore);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[94dvh] w-[96vw] max-w-5xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-slate-950 to-violet-950 px-5 py-5 pr-14 text-white sm:px-7">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><Award className="h-6 w-6" /></span>
            <div>
              <DialogTitle className="text-xl font-black text-white sm:text-2xl">{t('training.certification.quizTitle')}</DialogTitle>
              <DialogDescription className="mt-1 max-w-3xl text-white/60">{t('training.certification.quizDescription')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          {score === null ? (
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600">
                  <span>{t('training.certification.quizProgress', { answered: answeredCount, total: questions.length })}</span>
                  <span>{t('training.certification.quizPage', { current: page + 1, total: totalPages })}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-violet-600 transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
              </div>

              {pageQuestions.map((question, questionIndex) => {
                const globalIndex = page * PAGE_SIZE + questionIndex;
                return (
                  <section key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-800">{globalIndex + 1}</span>
                      <h3 className="pt-1 text-base font-black leading-6 text-slate-950 sm:text-lg">{question.prompt}</h3>
                    </div>
                    <div className="mt-5 grid gap-2">
                      {question.options.map((option, optionIndex) => {
                        const selected = answers[question.id] === optionIndex;
                        return (
                          <button
                            key={`${question.id}-${optionIndex}`}
                            type="button"
                            onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                            className={cn(
                              'flex min-h-12 items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold leading-6 transition',
                              selected
                                ? 'border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-100'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/40',
                            )}
                          >
                            <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-black', selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 text-slate-500')}>
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span>{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {!allAnswered && page === totalPages - 1 && (
                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{t('training.certification.answerAll', { remaining: questions.length - answeredCount })}</span>
                </div>
              )}

              <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-12px_40px_rgba(15,23,42,.08)] backdrop-blur">
                <Button type="button" variant="outline" className="rounded-xl" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                  <ChevronLeft className="mr-2 h-4 w-4" />{t('common.back')}
                </Button>
                {page < totalPages - 1 ? (
                  <Button type="button" className="rounded-xl" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}>
                    {t('common.next')}<ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={!allAnswered || submitting} onClick={() => void submit()}>
                    {submitting ? t('training.certification.scoring') : t('training.certification.submitQuiz')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl py-10 text-center">
              <div className={cn('mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] shadow-xl', score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                {score >= 80 ? <CheckCircle2 className="h-12 w-12" /> : <RotateCcw className="h-12 w-12" />}
              </div>
              <div className="mt-7 text-sm font-black uppercase tracking-[.18em] text-violet-600">{t('training.certification.finalScore')}</div>
              <div className="mt-2 text-7xl font-black tracking-[-.08em] text-slate-950">{score}%</div>
              <h3 className="mt-5 text-2xl font-black text-slate-950">{score >= 80 ? t('training.certification.passedTitle') : t('training.certification.retryTitle')}</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">{score >= 80 ? t('training.certification.passedDescription') : t('training.certification.retryDescription')}</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
                {score < 80 && <Button type="button" className="rounded-xl" onClick={() => { setAnswers({}); setPage(0); setScore(null); }}>{t('training.certification.retryQuiz')}</Button>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
