import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, isAfter, parseISO } from 'date-fns';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Phone,
  PlayCircle,
  UserCheck,
  UserRound,
  UserX,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export type OwnerAppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_business'
  | 'no_show';

type Props = {
  appointment: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: (id: string) => void;
  onStatusChange: (id: string, status: OwnerAppointmentStatus) => Promise<boolean>;
};

export function OwnerAppointmentDetailsSheet({
  appointment,
  open,
  onOpenChange,
  onCancel,
  onStatusChange,
}: Props) {
  const { t, i18n } = useTranslation();
  if (!appointment) return null;

  const start = parseISO(appointment.start_time);
  const end = appointment.end_time
    ? parseISO(appointment.end_time)
    : new Date(start.getTime() + Number(appointment.total_duration || 30) * 60_000);

  const derivedStatus = getDerivedStatus(appointment);
  const services =
    appointment.appointment_services
      ?.map((row: any) => row.services?.name)
      .filter(Boolean)
      .join(', ') || t('calendar.labels.appointment');

  const isCancelled = ['cancelled_by_business', 'cancelled_by_customer'].includes(
    appointment.status
  );
  const reference = appointment.booking_reference ? `#${appointment.booking_reference}` : '';

  const copyReference = async () => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      toast.success(t('calendar.messages.referenceCopied'));
    } catch {
      toast.error(t('calendar.errors.copyReference'));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg lg:max-w-xl">
        <div className="flex min-h-full flex-col">
          <SheetHeader className="sticky top-0 z-20 border-b bg-background/95 px-5 py-5 pr-12 text-left backdrop-blur sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {t('calendar.details.title')}
                </div>
                <SheetTitle className="mt-2 truncate text-2xl">
                  {appointment.customers?.full_name || t('calendar.labels.customer')}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  {reference || t('calendar.labels.noReference')}
                </SheetDescription>
              </div>
              <StatusBadge status={derivedStatus} />
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-5 px-5 py-5 sm:px-6">
            <div className="rounded-2xl border bg-muted/20 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail
                  icon={<CalendarDays className="h-4 w-4" />}
                  label={t('calendar.labels.date')}
                  value={new Intl.DateTimeFormat(i18n.language, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).format(start)}
                />
                <Detail
                  icon={<Clock3 className="h-4 w-4" />}
                  label={t('calendar.labels.time')}
                  value={`${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`}
                />
                <Detail
                  icon={<UserRound className="h-4 w-4" />}
                  label={t('calendar.labels.professional')}
                  value={appointment.employees?.name || t('calendar.labels.unassigned')}
                />
                <Detail
                  icon={<FileText className="h-4 w-4" />}
                  label={t('calendar.labels.services')}
                  value={services}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ContactDetail
                icon={<Phone className="h-4 w-4" />}
                label={t('calendar.labels.phone')}
                value={appointment.customers?.phone || t('calendar.labels.notProvided')}
              />
              <ContactDetail
                icon={<Mail className="h-4 w-4" />}
                label={t('calendar.labels.email')}
                value={appointment.customers?.email || t('calendar.labels.notProvided')}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {appointment.customers?.phone && (
                <Button asChild variant="outline" className="justify-start">
                  <a href={`tel:${appointment.customers.phone}`}>
                    <Phone className="h-4 w-4" />
                    {t('calendar.actions.callCustomer')}
                  </a>
                </Button>
              )}
              {appointment.customers?.email && (
                <Button asChild variant="outline" className="justify-start">
                  <a href={`mailto:${appointment.customers.email}`}>
                    <Mail className="h-4 w-4" />
                    {t('calendar.actions.emailCustomer')}
                  </a>
                </Button>
              )}
              {appointment.customer_id && (
                <Button asChild variant="outline" className="justify-start">
                  <Link to={`/dashboard/customers/${appointment.customer_id}`} onClick={() => onOpenChange(false)}>
                    <UserRound className="h-4 w-4" />
                    {t('calendar.actions.openCustomer')}
                  </Link>
                </Button>
              )}
              {reference && (
                <Button variant="outline" className="justify-start" onClick={() => void copyReference()}>
                  <FileText className="h-4 w-4" />
                  {t('calendar.actions.copyReference')}
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">{t('calendar.labels.bookingReference')}</div>
                <div className="mt-1 font-semibold">{reference || '—'}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">{t('calendar.labels.total')}</div>
                <div className="mt-1 text-xl font-bold">€{Number(appointment.total_price || 0).toFixed(2)}</div>
              </div>
            </div>

            {appointment.notes && (
              <div className="rounded-xl border p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('calendar.labels.notes')}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{appointment.notes}</p>
              </div>
            )}
          </div>

          {!isCancelled && appointment.status !== 'completed' && (
            <div className="sticky bottom-0 z-10 grid gap-2 border-t bg-background/95 px-5 py-4 backdrop-blur sm:grid-cols-2 sm:px-6">
              {appointment.status !== 'arrived' && appointment.status !== 'in_progress' && (
                <Button variant="outline" onClick={() => void onStatusChange(appointment.id, 'arrived')}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  {t('calendar.actions.checkIn')}
                </Button>
              )}
              {appointment.status !== 'in_progress' && (
                <Button variant="outline" onClick={() => void onStatusChange(appointment.id, 'in_progress')}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {t('calendar.actions.startService')}
                </Button>
              )}
              <Button onClick={() => void onStatusChange(appointment.id, 'completed')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t('calendar.actions.markCompleted')}
              </Button>
              <Button
                variant="outline"
                className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-700"
                onClick={() => void onStatusChange(appointment.id, 'no_show')}
              >
                <UserX className="mr-2 h-4 w-4" />
                {t('calendar.actions.noShow')}
              </Button>
              <Button
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:col-span-2"
                onClick={() => void onCancel(appointment.id)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t('calendar.actions.cancelAppointment')}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const label = t(`calendar.status.${status}`, { defaultValue: status.replace(/_/g, ' ') });
  if (status === 'completed') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t('calendar.status.completed')}</Badge>;
  if (status === 'cancelled_by_business' || status === 'cancelled_by_customer') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{label}</Badge>;
  if (status === 'no_show') return <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">{t('calendar.status.no_show')}</Badge>;
  if (status === 'arrived') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{t('calendar.status.arrived')}</Badge>;
  if (status === 'in_progress') return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{t('calendar.status.in_progress')}</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{label}</Badge>;
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ContactDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-xl border p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 break-words font-semibold">{value}</div>
      </div>
    </div>
  );
}

function getDerivedStatus(appointment: any) {
  if (['completed', 'cancelled_by_business', 'cancelled_by_customer', 'no_show', 'arrived', 'in_progress'].includes(appointment.status)) {
    return appointment.status;
  }
  const start = parseISO(appointment.start_time);
  const end = appointment.end_time
    ? parseISO(appointment.end_time)
    : new Date(start.getTime() + Number(appointment.total_duration || 30) * 60_000);
  return isAfter(new Date(), end) ? 'completed' : appointment.status || 'confirmed';
}
