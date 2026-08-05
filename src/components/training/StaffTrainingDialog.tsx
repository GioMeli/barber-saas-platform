import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrainingCertificationLibrary } from './TrainingCertificationLibrary';
import { useTranslation } from 'react-i18next';

export function StaffTrainingDialog({
  open,
  onOpenChange,
  business,
  employee,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: any;
  employee: any;
  userId?: string | null;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[96dvh] w-[98vw] max-w-[1500px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-white px-5 py-4 pr-14 sm:px-7">
          <DialogTitle className="text-xl font-black tracking-[-.025em]">{t('training.certification.staffTrainingTitle')}</DialogTitle>
          <DialogDescription>{t('training.certification.staffTrainingDialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto bg-slate-50 p-3 sm:p-5 lg:p-6">
          <TrainingCertificationLibrary
            audience="staff"
            business={business}
            userId={userId}
            employeeId={employee?.id}
            participantName={employee?.name || t('staffPortal.access.staffFallbackName')}
            embedded
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
