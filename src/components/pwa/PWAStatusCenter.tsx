import type { ReactNode } from 'react';
import { CheckCircle2, Download, RefreshCw, Smartphone, Wifi, WifiOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePWAStatus } from '@/hooks/usePWAStatus';

export default function PWAStatusCenter() {
  const { t } = useTranslation();
  const { isOnline, isInstalled, canInstall, needsManualIOSInstall, updateAvailable, install, applyUpdate } = usePWAStatus();

  const Icon = !isOnline ? WifiOff : updateAvailable ? RefreshCw : canInstall ? Download : Smartphone;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`relative h-10 w-10 rounded-xl bg-card/80 shadow-sm ${canInstall || needsManualIOSInstall || updateAvailable || !isOnline ? 'inline-flex' : 'hidden sm:inline-flex'}`}
          aria-label={t('pwa.title')}
        >
          <Icon className="h-4 w-4" />
          {(!isOnline || updateAvailable) && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500" />
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[94vw] max-w-[420px] p-0 sm:max-w-[420px] [&>button]:hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="font-extrabold">{t('pwa.title')}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t('pwa.description')}</div>
          </div>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label={t('pwa.close')}>
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        <div className="space-y-4 p-5">
          <StatusRow
            icon={isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            title={isOnline ? t('pwa.online') : t('pwa.offline')}
            description={isOnline ? t('pwa.onlineDescription') : t('pwa.offlineDescription')}
            positive={isOnline}
          />

          <StatusRow
            icon={isInstalled ? <CheckCircle2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
            title={isInstalled ? t('pwa.installed') : t('pwa.browserMode')}
            description={isInstalled ? t('pwa.installedDescription') : t('pwa.browserModeDescription')}
            positive={isInstalled}
          />

          {canInstall && (
            <Button className="h-11 w-full rounded-xl" onClick={() => void install()}>
              <Download className="mr-2 h-4 w-4" />
              {t('pwa.install')}
            </Button>
          )}

          {updateAvailable && (
            <Button className="h-11 w-full rounded-xl" onClick={applyUpdate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('pwa.updateNow')}
            </Button>
          )}

          {needsManualIOSInstall && !canInstall && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100">
              {t('pwa.iosInstall')}
            </div>
          )}

          {!canInstall && !updateAvailable && !needsManualIOSInstall && (
            <div className="rounded-2xl border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
              {t('pwa.readyDescription')}
            </div>
          )}

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
            {t('pwa.privacyNote')}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatusRow({
  icon,
  title,
  description,
  positive,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  positive: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <div>
        <div className="font-bold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
