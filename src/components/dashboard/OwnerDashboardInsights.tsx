import React from 'react';
import { AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  unreadNotifications: number;
  activeAppointments: any[];
  staff: any[];
  staffBreaks: any[];
};

export function TodaysAlerts({
  unreadNotifications,
  activeAppointments,
  staff,
  staffBreaks,
}: Props) {
  const unassigned = activeAppointments.filter((item) => !item.employee_id);
  const cancelled = activeAppointments.filter((item) =>
    ['cancelled_by_business', 'cancelled_by_customer'].includes(item.status)
  );
  const staffWithoutBreak = Math.max(staff.length - staffBreaks.length, 0);
  const hasAlerts =
    unreadNotifications > 0 ||
    unassigned.length > 0 ||
    cancelled.length > 0 ||
    staffWithoutBreak > 0;

  return (
    <Card className="rounded-2xl border-amber-200 bg-amber-50/40 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="section-heading">Today’s Alerts</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Operational items that need your attention today.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {!hasAlerts && (
            <AlertItem
              title="No alerts today"
              detail="Your appointments, staffing and notifications look healthy."
              tone="success"
            />
          )}

          {unreadNotifications > 0 && (
            <AlertItem
              title={`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`}
              detail="Open the bell to review new appointments and customers."
              tone="info"
            />
          )}

          {unassigned.length > 0 && (
            <AlertItem
              title={`${unassigned.length} unassigned appointment${unassigned.length === 1 ? '' : 's'}`}
              detail="Assign a professional before the appointment begins."
              tone="warning"
            />
          )}

          {cancelled.length > 0 && (
            <AlertItem
              title={`${cancelled.length} cancellation${cancelled.length === 1 ? '' : 's'} today`}
              detail="Review the calendar and refill the available time."
              tone="danger"
            />
          )}

          {staffWithoutBreak > 0 && (
            <AlertItem
              title={`${staffWithoutBreak} professional${staffWithoutBreak === 1 ? '' : 's'} without a break`}
              detail="Review today’s staff schedule and working pattern."
              tone="warning"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BusinessHealth({
  activeAppointments,
  staff,
}: Pick<Props, 'activeAppointments' | 'staff'>) {
  const valid = activeAppointments.filter(
    (item) =>
      !['cancelled_by_business', 'cancelled_by_customer', 'no_show', 'rescheduled'].includes(
        item.status
      )
  );
  const completed = valid.filter((item) => item.status === 'completed');
  const cancelled = activeAppointments.filter((item) =>
    ['cancelled_by_business', 'cancelled_by_customer'].includes(item.status)
  );
  const unassigned = valid.filter((item) => !item.employee_id);
  const scheduledMinutes = valid.reduce(
    (sum, item) => sum + Number(item.total_duration || 30),
    0
  );
  const availableMinutes = Math.max(staff.length * 8 * 60, 1);
  const occupancy = Math.min(
    Math.round((scheduledMinutes / availableMinutes) * 100),
    100
  );
  const completion = valid.length
    ? Math.round((completed.length / valid.length) * 100)
    : 0;
  const cancellation = activeAppointments.length
    ? Math.round((cancelled.length / activeAppointments.length) * 100)
    : 0;

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="section-heading">Business health</CardTitle>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <HealthMetric label="Occupancy" value={`${occupancy}%`} progress={occupancy} />
        <HealthMetric label="Completion rate" value={`${completion}%`} progress={completion} />

        <div className="grid grid-cols-2 gap-3 pt-1">
          <HealthStat label="Cancellations" value={`${cancellation}%`} />
          <HealthStat label="Unassigned" value={String(unassigned.length)} />
        </div>
      </CardContent>
    </Card>
  );
}

function AlertItem({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
}) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="text-sm font-bold">{title}</div>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );
}

function HealthStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
