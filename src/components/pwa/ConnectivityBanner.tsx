import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePWAStatus } from '@/hooks/usePWAStatus';

export default function ConnectivityBanner() {
  const { t } = useTranslation();
  const { isOnline } = usePWAStatus();

  if (isOnline) return null;

  return (
    <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-semibold sm:text-sm">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>{t('pwa.offlineBanner')}</span>
      </div>
    </div>
  );
}
