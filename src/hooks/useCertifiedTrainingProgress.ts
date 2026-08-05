import React from 'react';
import { supabase } from '@/db/supabase';
import { staffSupabase } from '@/db/staffSupabase';
import type { TrainingAudience } from '@/training/curriculum';

export type CertifiedTrainingProgress = {
  completedLessonIds: string[];
  latestScore: number | null;
  bestScore: number | null;
  quizAttempts: number;
  passed: boolean;
  certificateNumber: string | null;
  certifiedAt: string | null;
};

const EMPTY_PROGRESS: CertifiedTrainingProgress = {
  completedLessonIds: [],
  latestScore: null,
  bestScore: null,
  quizAttempts: 0,
  passed: false,
  certificateNumber: null,
  certifiedAt: null,
};

function makeCertificateNumber(audience: TrainingAudience) {
  const prefix = audience === 'owner' ? 'OWN' : 'STF';
  const year = new Date().getFullYear();
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `VEL-${prefix}-${year}-${random}`;
}

export function useCertifiedTrainingProgress({
  audience,
  businessId,
  userId,
  employeeId,
}: {
  audience: TrainingAudience;
  businessId?: string | null;
  userId?: string | null;
  employeeId?: string | null;
}) {
  const client = audience === 'staff' ? staffSupabase : supabase;
  const storageKey = React.useMemo(
    () => `velliqo:certified-training:${audience}:${businessId || 'unknown'}:${userId || 'anonymous'}`,
    [audience, businessId, userId],
  );
  const [progress, setProgress] = React.useState<CertifiedTrainingProgress>(EMPTY_PROGRESS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const cached = window.localStorage.getItem(storageKey);
        if (cached && active) setProgress({ ...EMPTY_PROGRESS, ...JSON.parse(cached) });
      } catch {
        // Local cache is an optional resilience layer.
      }

      if (!businessId || !userId) {
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await client
        .from('training_certifications')
        .select('completed_lesson_ids,latest_score,best_score,quiz_attempts,passed,certificate_number,certified_at')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .eq('audience', audience)
        .maybeSingle();

      if (!active) return;
      if (!error && data) {
        const next: CertifiedTrainingProgress = {
          completedLessonIds: Array.isArray(data.completed_lesson_ids) ? data.completed_lesson_ids : [],
          latestScore: data.latest_score ?? null,
          bestScore: data.best_score ?? null,
          quizAttempts: data.quiz_attempts ?? 0,
          passed: Boolean(data.passed),
          certificateNumber: data.certificate_number ?? null,
          certifiedAt: data.certified_at ?? null,
        };
        setProgress(next);
        try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      }
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [audience, businessId, client, storageKey, userId]);

  const persist = React.useCallback(async (next: CertifiedTrainingProgress) => {
    setProgress(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }

    if (!businessId || !userId) return;
    setSaving(true);
    const payload = {
      business_id: businessId,
      user_id: userId,
      employee_id: audience === 'staff' ? employeeId || null : null,
      audience,
      completed_lesson_ids: next.completedLessonIds,
      latest_score: next.latestScore,
      best_score: next.bestScore,
      quiz_attempts: next.quizAttempts,
      passed: next.passed,
      certificate_number: next.certificateNumber,
      certified_at: next.certifiedAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from('training_certifications')
      .upsert(payload, { onConflict: 'business_id,user_id,audience' });
    if (error) console.error('Training progress save failed', error);
    setSaving(false);
  }, [audience, businessId, client, employeeId, storageKey, userId]);

  const setLessonCompleted = React.useCallback((lessonId: string, complete = true) => {
    const exists = progress.completedLessonIds.includes(lessonId);
    const completedLessonIds = complete
      ? (exists ? progress.completedLessonIds : [...progress.completedLessonIds, lessonId])
      : progress.completedLessonIds.filter((id) => id !== lessonId);
    return persist({ ...progress, completedLessonIds });
  }, [persist, progress]);

  const markLessonsCompleted = React.useCallback((lessonIds: string[]) => {
    const completedLessonIds = Array.from(new Set([...progress.completedLessonIds, ...lessonIds]));
    return persist({ ...progress, completedLessonIds });
  }, [persist, progress]);

  const submitQuiz = React.useCallback(async (score: number) => {
    const passedNow = score >= 80;
    const passed = progress.passed || passedNow;
    const certificateNumber = passed
      ? progress.certificateNumber || makeCertificateNumber(audience)
      : null;
    const certifiedAt = passed
      ? progress.certifiedAt || new Date().toISOString()
      : null;
    const next: CertifiedTrainingProgress = {
      ...progress,
      latestScore: score,
      bestScore: Math.max(progress.bestScore ?? 0, score),
      quizAttempts: progress.quizAttempts + 1,
      passed,
      certificateNumber,
      certifiedAt,
    };
    await persist(next);
    return next;
  }, [audience, persist, progress]);

  const resetLessons = React.useCallback(() => persist({ ...progress, completedLessonIds: [] }), [persist, progress]);

  return {
    progress,
    loading,
    saving,
    setLessonCompleted,
    markLessonsCompleted,
    submitQuiz,
    resetLessons,
  };
}
