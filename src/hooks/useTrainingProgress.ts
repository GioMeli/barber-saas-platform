import React from 'react';

export function useTrainingProgress(businessId?: string | null) {
  const storageKey = React.useMemo(() => `velliqo:training-progress:${businessId || 'owner'}`, [businessId]);
  const [completed, setCompleted] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setCompleted(raw ? JSON.parse(raw) : []);
    } catch {
      setCompleted([]);
    }
  }, [storageKey]);

  const toggle = React.useCallback((slug: string) => {
    setCompleted((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Training progress is optional and must never block the portal.
      }
      return next;
    });
  }, [storageKey]);

  const reset = React.useCallback(() => {
    setCompleted([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
  }, [storageKey]);

  return { completed, toggle, reset };
}
