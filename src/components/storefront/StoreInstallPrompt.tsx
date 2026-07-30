import React from 'react';
import { Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePWAStatus } from '@/hooks/usePWAStatus';

type Props = {
  business: {
    slug: string;
    name: string;
    logo_url?: string | null;
    pwa_enabled?: boolean | null;
    pwa_short_name?: string | null;
  };
};

export function StoreInstallPrompt({ business }: Props) {
  const { t } = useTranslation();
  const status = usePWAStatus();
  const pwa = { ...status, enabled: business.pwa_enabled !== false };
  const [instructionsOpen, setInstructionsOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return sessionStorage.getItem(`store-install-dismissed:${business.slug}`) === '1';
    } catch {
      return false;
    }
  });

  if (!pwa.enabled || pwa.isInstalled || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`store-install-dismissed:${business.slug}`, '1');
    } catch {
      // Storage can be unavailable in strict browser modes.
    }
  };

  const handleInstall = async () => {
    if (pwa.canInstall) {
      await pwa.install();
      return;
    }
    setInstructionsOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden rounded-3xl border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-background shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            {business.logo_url ? (
              <img src={business.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl border bg-background object-cover shadow-sm" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Smartphone className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {t('storefront.public.install.eyebrow')}
              </div>
              <h2 className="mt-1 text-lg font-bold">
                {t('storefront.public.install.title', { business: business.name })}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t('storefront.public.install.description')}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" className="h-11 rounded-xl" onClick={() => void handleInstall()}>
              <Download className="mr-2 h-4 w-4" />
              {pwa.canInstall ? t('storefront.public.install.action') : t('storefront.public.install.instructions')}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={t('common.close')} onClick={dismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('storefront.public.install.dialogTitle', { business: business.name })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Instruction icon={<Share className="h-5 w-5" />} number="1" text={t('storefront.public.install.iosStep1')} />
            <Instruction icon={<MoreVertical className="h-5 w-5" />} number="2" text={t('storefront.public.install.iosStep2')} />
            <Instruction icon={<Download className="h-5 w-5" />} number="3" text={t('storefront.public.install.iosStep3')} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Instruction({ icon, number, text }: { icon: React.ReactNode; number: string; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-muted/20 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0 text-sm leading-6"><span className="mr-2 font-bold">{number}.</span>{text}</div>
    </div>
  );
}
