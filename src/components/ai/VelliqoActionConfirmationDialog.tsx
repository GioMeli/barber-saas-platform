import {
  CalendarDays,
  CheckCircle2,
  FilePenLine,
  Loader2,
  Megaphone,
  Pencil,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VelliqoAIActionRequest, VelliqoAIActionType } from '@/ai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function VelliqoActionConfirmationDialog({
  open,
  action,
  busy,
  onOpenChange,
  onConfirm,
  onCancel,
  onChange,
}: {
  open: boolean;
  action: VelliqoAIActionRequest | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onChange?: () => void;
}) {
  const { t } = useTranslation();

  if (!action) return null;

  const ActionIcon = actionIcon(action.action_type);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="z-[80] gap-0 overflow-hidden border-violet-200 p-0 shadow-[0_30px_90px_rgba(30,18,70,.35)] sm:max-w-xl">
        <DialogHeader className="border-b bg-gradient-to-br from-violet-50 via-background to-amber-50 px-5 py-5 pr-14 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,.28)]">
              <ActionIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-violet-200 bg-white/75 text-violet-800 hover:bg-white/75">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {t('ai.manager.actions.confirmationBadge')}
                </Badge>
                <Badge variant="outline" className="bg-white/70">
                  {t('ai.voice.risk', { value: action.risk_level })}
                </Badge>
              </div>
              <DialogTitle className="mt-3 text-xl font-extrabold leading-tight">
                {action.title || t(`ai.manager.actions.types.${action.action_type}`)}
              </DialogTitle>
              <DialogDescription className="mt-2 leading-6">
                {action.summary || t('ai.manager.actions.confirmationDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[52dvh] overflow-y-auto px-5 py-5 sm:px-6">
          {action.preview?.items?.length ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {action.preview.items.map((item) => (
                <div key={`${item.label}-${item.value}`} className="min-w-0 rounded-2xl border bg-muted/20 p-3.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {action.preview?.warning ? (
            <div className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              {action.preview.warning}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-950">
            {t('ai.manager.actions.reviewNotice')} {t('ai.manager.actions.expiresSoon')}
          </div>
        </div>

        <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            <XCircle className="mr-2 h-4 w-4" />
            {t('ai.manager.actions.cancel')}
          </Button>
          {onChange ? (
            <Button type="button" variant="outline" onClick={onChange} disabled={busy}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('ai.manager.actions.change')}
            </Button>
          ) : null}
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {busy ? t('ai.manager.actions.executing') : t('ai.manager.actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function actionIcon(actionType: VelliqoAIActionType) {
  if (actionType === 'create_customer') return UserPlus;
  if (
    actionType === 'create_appointment'
    || actionType === 'reschedule_appointment'
    || actionType === 'cancel_appointment'
  ) return CalendarDays;
  if (actionType === 'create_campaign_draft') return Megaphone;
  if (actionType === 'create_post_draft') return FilePenLine;
  return ShieldCheck;
}
