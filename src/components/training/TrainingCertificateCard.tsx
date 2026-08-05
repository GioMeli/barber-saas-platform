import { Award, Download, LockKeyhole, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { TrainingAudience } from '@/training/curriculum';
import { downloadTrainingCertificatePdf } from '@/lib/trainingCertificatePdf';
import { toast } from 'sonner';

export function TrainingCertificateCard({
  audience,
  participantName,
  businessName,
  completionPercent,
  bestScore,
  passed,
  certificateNumber,
  certifiedAt,
  language,
  onStartQuiz,
}: {
  audience: TrainingAudience;
  participantName: string;
  businessName: string;
  completionPercent: number;
  bestScore: number | null;
  passed: boolean;
  certificateNumber: string | null;
  certifiedAt: string | null;
  language?: string | null;
  onStartQuiz: () => void;
}) {
  const { t } = useTranslation();
  const trainingComplete = completionPercent === 100;

  const download = async () => {
    if (!passed || !certificateNumber || !certifiedAt) return;
    try {
      await downloadTrainingCertificatePdf({
        participantName,
        businessName,
        audience,
        score: bestScore ?? 80,
        certificateNumber,
        certifiedAt,
        language,
      });
    } catch (error) {
      console.error(error);
      toast.error(t('training.certification.certificateFailed'));
    }
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-violet-200 bg-[radial-gradient(circle_at_top_right,_rgba(216,180,254,.32),_transparent_34%),linear-gradient(135deg,#16072d_0%,#35106a_52%,#6d28d9_100%)] p-5 text-white shadow-[0_24px_80px_rgba(76,29,149,.24)] sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-100">
            <Trophy className="h-4 w-4" />{t('training.certification.title')}
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-[-.035em] sm:text-3xl">{passed ? t('training.certification.certificateReady') : t('training.certification.unlockTitle')}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">{passed ? t('training.certification.certificateReadyDescription', { name: participantName }) : t('training.certification.unlockDescription')}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric label={t('training.certification.trainingCompletion')} value={`${completionPercent}%`} complete={trainingComplete} />
            <Metric label={t('training.certification.assessment')} value="50" complete={Boolean(bestScore)} />
            <Metric label={t('training.certification.bestScore')} value={bestScore === null ? '—' : `${bestScore}%`} complete={passed} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/15 bg-black/20 p-5 backdrop-blur">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-violet-100"><Award className="h-8 w-8" /></div>
          {passed ? (
            <>
              <div className="mt-4 text-lg font-black">{participantName}</div>
              <div className="mt-1 text-xs text-white/50">{certificateNumber}</div>
              <Button type="button" className="mt-5 w-full rounded-xl bg-white text-violet-900 hover:bg-violet-50" onClick={() => void download()}>
                <Download className="mr-2 h-4 w-4" />{t('training.certification.downloadCertificate')}
              </Button>
            </>
          ) : trainingComplete ? (
            <>
              <div className="mt-4 font-black">{t('training.certification.quizUnlocked')}</div>
              <p className="mt-2 text-xs leading-5 text-white/55">{t('training.certification.passRequirement')}</p>
              <Button type="button" className="mt-5 w-full rounded-xl bg-white text-violet-900 hover:bg-violet-50" onClick={onStartQuiz}>
                <Award className="mr-2 h-4 w-4" />{t('training.certification.startQuiz')}
              </Button>
            </>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-2 font-black"><LockKeyhole className="h-4 w-4" />{t('training.certification.quizLocked')}</div>
              <p className="mt-2 text-xs leading-5 text-white/55">{t('training.certification.completeAllLessons')}</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-300" style={{ width: `${completionPercent}%` }} /></div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, complete }: { label: string; value: string; complete: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
      <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-white/45">{label}</div>
      <div className="mt-2 flex items-center justify-between gap-2"><span className="text-2xl font-black">{value}</span><span className={`h-2.5 w-2.5 rounded-full ${complete ? 'bg-emerald-300' : 'bg-white/25'}`} /></div>
    </div>
  );
}
