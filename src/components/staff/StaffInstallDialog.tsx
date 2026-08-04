import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Download, MonitorSmartphone, Share2, Smartphone } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  employeeName: string;
  canPromptInstall: boolean;
  isInstalled: boolean;
  needsManualIOSInstall: boolean;
  onInstall: () => Promise<boolean>;
};

export function StaffInstallDialog({
  open,
  onOpenChange,
  businessName,
  employeeName,
  canPromptInstall,
  isInstalled,
  needsManualIOSInstall,
  onInstall,
}: Props) {
  const { t } = useTranslation();
  const [prompting, setPrompting] = React.useState(false);
  const [promptFailed, setPromptFailed] = React.useState(false);

  React.useEffect(() => {
    if (open) setPromptFailed(false);
  }, [open]);

  const handleInstall = async () => {
    setPrompting(true);
    setPromptFailed(false);
    try {
      const installed = await onInstall();
      if (installed) onOpenChange(false);
      else setPromptFailed(true);
    } finally {
      setPrompting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary px-6 py-7 text-white">
          <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
            <MonitorSmartphone className="mr-2 h-4 w-4" />
            {t('staffPortal.install.personalBadge')}
          </Badge>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="text-2xl font-black text-white">
              {t('staffPortal.install.dialogTitle', { name: employeeName })}
            </DialogTitle>
          </DialogHeader>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {t('staffPortal.install.dialogDescription', { business: businessName })}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {isInstalled ? (
            <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <div className="font-bold">{t('staffPortal.install.installed')}</div>
                <div className="mt-1 text-sm text-emerald-800">{t('staffPortal.install.installedDescription')}</div>
              </div>
            </div>
          ) : canPromptInstall && !promptFailed ? (
            <>
              <div className="rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {t('staffPortal.install.nativePromptDescription')}
              </div>
              <Button className="h-12 w-full rounded-xl font-bold" disabled={prompting} onClick={() => void handleInstall()}>
                <Download className="mr-2 h-4 w-4" />
                {prompting ? t('staffPortal.install.installing') : t('staffPortal.install.action')}
              </Button>
            </>
          ) : needsManualIOSInstall ? (
            <div className="space-y-3">
              <InstallStep icon={<Share2 className="h-4 w-4" />} number="1" text={t('staffPortal.install.iosStepOne')} />
              <InstallStep icon={<Smartphone className="h-4 w-4" />} number="2" text={t('staffPortal.install.iosStepTwo')} />
              <InstallStep icon={<CheckCircle2 className="h-4 w-4" />} number="3" text={t('staffPortal.install.iosStepThree')} />
            </div>
          ) : (
            <div className="space-y-3">
              <InstallStep icon={<MonitorSmartphone className="h-4 w-4" />} number="1" text={t('staffPortal.install.desktopStepOne')} />
              <InstallStep icon={<Download className="h-4 w-4" />} number="2" text={t('staffPortal.install.desktopStepTwo')} />
              <InstallStep icon={<CheckCircle2 className="h-4 w-4" />} number="3" text={t('staffPortal.install.desktopStepThree')} />
              <p className="pt-1 text-xs leading-5 text-muted-foreground">{t('staffPortal.install.productionNote')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstallStep({ icon, number, text }: { icon: React.ReactNode; number: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{number}</div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{icon}</div>
      <p className="text-sm font-medium leading-5 text-slate-700">{text}</p>
    </div>
  );
}
