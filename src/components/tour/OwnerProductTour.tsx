import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpenCheck, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/db/supabase';
import { OWNER_NAVIGATION_ITEMS } from '@/components/layouts/owner-shell/navigation';

const TOUR_KEY = 'owner-full-v1';

type OwnerTourStep = {
  key: string;
  route: string;
  selector: string;
  titleKey: string;
  descriptionKey: string;
};

const HEADER_STEPS: OwnerTourStep[] = [
  {
    key: 'welcome',
    route: '/dashboard',
    selector: '[data-tour="owner-workspace"]',
    titleKey: 'ownerExperience.tour.steps.welcome.title',
    descriptionKey: 'ownerExperience.tour.steps.welcome.description',
  },
  {
    key: 'quickAdd',
    route: '/dashboard',
    selector: '[data-tour="quick-add"]',
    titleKey: 'ownerExperience.tour.steps.quickAdd.title',
    descriptionKey: 'ownerExperience.tour.steps.quickAdd.description',
  },
  {
    key: 'notifications',
    route: '/dashboard',
    selector: '[data-tour="notifications"]',
    titleKey: 'ownerExperience.tour.steps.notifications.title',
    descriptionKey: 'ownerExperience.tour.steps.notifications.description',
  },
  {
    key: 'aiAssistant',
    route: '/dashboard',
    selector: '[data-tour="desktop-ai"]',
    titleKey: 'ownerExperience.tour.steps.aiAssistant.title',
    descriptionKey: 'ownerExperience.tour.steps.aiAssistant.description',
  },
  {
    key: 'language',
    route: '/dashboard',
    selector: '[data-tour="language"]',
    titleKey: 'ownerExperience.tour.steps.language.title',
    descriptionKey: 'ownerExperience.tour.steps.language.description',
  },
];

const FEATURE_STEPS: OwnerTourStep[] = OWNER_NAVIGATION_ITEMS.map((item) => ({
  key: item.key,
  route: item.path,
  selector: `[data-tour-page="${item.key}"]`,
  titleKey: item.labelKey,
  descriptionKey: `ownerExperience.tour.features.${item.key}`,
}));

const TOUR_STEPS = [...HEADER_STEPS, ...FEATURE_STEPS];

type OwnerProductTourProps = {
  open: boolean;
  businessId?: string | null;
  userId?: string | null;
  onOpenChange: (open: boolean) => void;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export default function OwnerProductTour({
  open,
  businessId,
  userId,
  onOpenChange,
}: OwnerProductTourProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<TargetRect | null>(null);
  const [loadingProgress, setLoadingProgress] = React.useState(false);
  const step = TOUR_STEPS[currentIndex];

  const persistProgress = React.useCallback(async (patch: {
    current_step?: number;
    completed_at?: string | null;
    skipped_at?: string | null;
  }) => {
    if (!businessId || !userId) return;
    const { error } = await supabase
      .from('owner_tour_progress')
      .upsert({
        user_id: userId,
        business_id: businessId,
        tour_key: TOUR_KEY,
        current_step: patch.current_step ?? currentIndex,
        completed_at: patch.completed_at ?? null,
        skipped_at: patch.skipped_at ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,business_id,tour_key' });

    if (error) console.warn('Unable to save owner tour progress', error);
  }, [businessId, currentIndex, userId]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      if (!businessId || !userId) {
        setCurrentIndex(0);
        return;
      }

      setLoadingProgress(true);
      const { data, error } = await supabase
        .from('owner_tour_progress')
        .select('current_step, completed_at, skipped_at')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .eq('tour_key', TOUR_KEY)
        .maybeSingle();

      if (cancelled) return;
      if (error) console.warn('Unable to load owner tour progress', error);

      const savedStep = Number(data?.current_step || 0);
      const resumeStep = !data?.completed_at && !data?.skipped_at && savedStep < TOUR_STEPS.length
        ? savedStep
        : 0;
      setCurrentIndex(resumeStep);
      setLoadingProgress(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, open, userId]);

  React.useEffect(() => {
    if (!open || !step || loadingProgress) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    let frame = 0;
    let attempts = 0;
    const resolveTarget = () => {
      const target = document.querySelector(step.selector) as HTMLElement | null;
      if (!target) {
        attempts += 1;
        if (attempts < 30) frame = window.requestAnimationFrame(resolveTarget);
        else setTargetRect(null);
        return;
      }

      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: attempts === 0 ? 'smooth' : 'auto' });
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      });
    };

    const timer = window.setTimeout(resolveTarget, 260);
    const update = () => {
      const target = document.querySelector(step.selector) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      });
    };

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [loadingProgress, location.pathname, navigate, open, step]);

  React.useEffect(() => {
    if (!open || loadingProgress) return;
    void persistProgress({ current_step: currentIndex });
  }, [currentIndex, loadingProgress, open, persistProgress]);

  if (!open || !step) return null;

  const isLast = currentIndex === TOUR_STEPS.length - 1;
  const progress = ((currentIndex + 1) / TOUR_STEPS.length) * 100;
  const tooltipStyle = getTooltipStyle(targetRect);

  const finish = async () => {
    await persistProgress({
      current_step: TOUR_STEPS.length - 1,
      completed_at: new Date().toISOString(),
      skipped_at: null,
    });
    onOpenChange(false);
  };

  const skip = async () => {
    await persistProgress({
      current_step: currentIndex,
      completed_at: null,
      skipped_at: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-[90] hidden lg:block" role="dialog" aria-modal="true" aria-label={t('ownerExperience.tour.title')}>
      {targetRect ? (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-violet-300 bg-transparent shadow-[0_0_0_9999px_rgba(7,9,24,.76),0_0_0_6px_rgba(139,92,246,.18),0_20px_70px_rgba(0,0,0,.35)] transition-all duration-300"
          style={{
            top: Math.max(8, targetRect.top - 6),
            left: Math.max(8, targetRect.left - 6),
            width: Math.max(44, targetRect.width + 12),
            height: Math.max(44, targetRect.height + 12),
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-slate-950/76" />
      )}

      <section
        className="fixed w-[390px] max-w-[calc(100%-2rem)] overflow-hidden rounded-[1.6rem] border border-violet-200/60 bg-background shadow-[0_28px_90px_rgba(0,0,0,.42)]"
        style={tooltipStyle}
      >
        <div className="relative overflow-hidden bg-[#111027] px-5 py-4 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,.4),transparent_48%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-violet-200">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">
                  {t('ownerExperience.tour.title')}
                </div>
                <div className="mt-0.5 text-sm font-bold text-white/88">
                  {t('ownerExperience.tour.stepCounter', { current: currentIndex + 1, total: TOUR_STEPS.length })}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => void skip()}
              aria-label={t('ownerExperience.tour.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="relative mt-4 h-1.5 bg-white/12" />
        </div>

        <div className="p-5">
          <h2 className="text-xl font-extrabold tracking-tight">{t(step.titleKey)}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(step.descriptionKey)}</p>

          {!targetRect ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {t('ownerExperience.tour.targetUnavailable')}
            </p>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('ownerExperience.tour.back')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentIndex(0);
                  void persistProgress({ current_step: 0, completed_at: null, skipped_at: null });
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('ownerExperience.tour.restart')}
              </Button>
            </div>

            {isLast ? (
              <Button type="button" size="sm" onClick={() => void finish()}>
                {t('ownerExperience.tour.finish')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setCurrentIndex((value) => Math.min(TOUR_STEPS.length - 1, value + 1))}
              >
                {t('ownerExperience.tour.next')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>

          <button
            type="button"
            className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => void skip()}
          >
            {t('ownerExperience.tour.skip')}
          </button>
        </div>
      </section>
    </div>
  );
}

function getTooltipStyle(rect: TargetRect | null): React.CSSProperties {
  const margin = 18;
  const width = 390;
  const estimatedHeight = 360;

  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin);
  let top = rect.bottom + 18;

  if (top + estimatedHeight > viewportHeight - margin) {
    top = rect.top - estimatedHeight - 18;
  }

  if (top < margin || rect.width > viewportWidth * 0.65 || rect.height > viewportHeight * 0.55) {
    top = viewportHeight - estimatedHeight - margin;
    left = viewportWidth - width - margin;
  }

  return { left, top: Math.max(margin, top) };
}
