import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Clock3, UserRound } from 'lucide-react';

type DailyStaffScheduleProps = {
  appointments: any[];
  staff: any[];
  availabilityBlocks?: AvailabilityBlock[];
  loading?: boolean;
  startHour?: number;
  endHour?: number;
  onAppointmentClick?: (appointment: any) => void;
};

type AvailabilityBlock = {
  id: string;
  employee_id: string;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  label?: string | null;
  type?: 'break' | 'vacation' | 'sick_leave' | 'training' | 'personal_block';
};

type ScheduleColumn = {
  id: string;
  name: string;
  photo_url?: string | null;
  role?: string | null;
  isUnassigned?: boolean;
};

type TimeSlot = {
  hour: number;
  minute: number;
  label: string;
  isHour: boolean;
};

const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 24;
const TIME_COLUMN_WIDTH = 84;
const STAFF_COLUMN_WIDTH = 180;

const STATUS_STYLES: Record<string, string> = {
  completed:
    'border-emerald-500/70 bg-emerald-100 text-emerald-950',
  confirmed:
    'border-teal-500/70 bg-teal-100 text-teal-950',
  pending:
    'border-sky-500/70 bg-sky-100 text-sky-950',
  in_progress:
    'border-blue-500/70 bg-blue-100 text-blue-950',
  no_show:
    'border-orange-500/70 bg-orange-100 text-orange-950',
  cancelled_by_business:
    'border-slate-400 bg-slate-200 text-slate-700 opacity-75',
  cancelled_by_customer:
    'border-slate-400 bg-slate-200 text-slate-700 opacity-75',
  default:
    'border-violet-500/70 bg-violet-100 text-violet-950',
};

export default function DailyStaffSchedule({
  appointments,
  staff,
  availabilityBlocks = [],
  loading = false,
  startHour = 6,
  endHour = 22,
  onAppointmentClick,
}: DailyStaffScheduleProps) {
  const columns = useMemo<ScheduleColumn[]>(() => {
    const activeStaff = staff.map((member) => ({
      id: member.id,
      name: member.name,
      photo_url: member.photo_url,
      role: member.role ?? member.job_title ?? member.position ?? null,
    }));

    const hasUnassigned = appointments.some(
      (appointment) => !appointment.employee_id
    );

    return hasUnassigned
      ? [
          ...activeStaff,
          {
            id: 'unassigned',
            name: 'Unassigned',
            photo_url: null,
            role: 'Open column',
            isUnassigned: true,
          },
        ]
      : activeStaff;
  }, [appointments, staff]);

  const slots = useMemo<TimeSlot[]>(() => {
    const values: TimeSlot[] = [];

    for (let hour = startHour; hour < endHour; hour += 1) {
      for (const minute of [0, 15, 30, 45]) {
        values.push({
          hour,
          minute,
          label:
            minute === 0
              ? `${String(hour).padStart(2, '0')}:00`
              : String(minute).padStart(2, '0'),
          isHour: minute === 0,
        });
      }
    }

    return values;
  }, [startHour, endHour]);

  const totalMinutes = (endHour - startHour) * 60;
  const bodyHeight = slots.length * SLOT_HEIGHT;
  const minimumWidth =
    TIME_COLUMN_WIDTH + Math.max(columns.length, 1) * STAFF_COLUMN_WIDTH;

  if (loading) return <ScheduleLoading />;

  if (columns.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <UserRound className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-bold">No active professionals</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Add an employee to display the daily staff calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <div className="h-full min-h-0 overflow-auto bg-slate-50">
        <div className="relative" style={{ minWidth: minimumWidth }}>
          <div
            className="sticky top-0 z-40 grid border-b-2 border-slate-300 bg-white shadow-sm"
            style={{
              gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${columns.length}, minmax(${STAFF_COLUMN_WIDTH}px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-50 flex flex-col items-center justify-center border-r-2 border-slate-300 bg-white px-2 py-3">
              <Clock3 className="h-5 w-5 text-primary" />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Time
              </span>
            </div>

            {columns.map((column) => (
              <div
                key={column.id}
                className="flex min-w-0 flex-col items-center justify-center border-r border-slate-300 px-3 py-2.5 text-center last:border-r-0"
              >
                {column.photo_url ? (
                  <img
                    src={column.photo_url}
                    alt={column.name}
                    className="h-14 w-14 rounded-full border-2 border-white object-cover shadow ring-1 ring-slate-300"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-slate-500 shadow ring-1 ring-slate-300">
                    <UserRound className="h-6 w-6" />
                  </div>
                )}

                <div className="mt-1.5 max-w-full truncate text-sm font-bold">
                  {column.name}
                </div>
                <div className="max-w-full truncate text-[10px] text-muted-foreground">
                  {column.role || 'Professional'}
                </div>
              </div>
            ))}
          </div>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${columns.length}, minmax(${STAFF_COLUMN_WIDTH}px, 1fr))`,
              height: bodyHeight,
            }}
          >
            <div className="sticky left-0 z-30 border-r-2 border-slate-300 bg-white">
              {slots.map((slot) => (
                <div
                  key={`${slot.hour}-${slot.minute}`}
                  className={`relative flex items-start justify-end pr-2 ${
                    slot.isHour
                      ? 'border-t-2 border-slate-400'
                      : 'border-t border-slate-200'
                  }`}
                  style={{ height: SLOT_HEIGHT }}
                >
                  <span
                    className={`relative -top-2.5 bg-white px-1 ${
                      slot.isHour
                        ? 'text-xs font-extrabold text-slate-900'
                        : 'text-[10px] font-semibold text-slate-500'
                    }`}
                  >
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>

            {columns.map((column) => {
              const columnAppointments = appointments.filter((appointment) =>
                column.isUnassigned
                  ? !appointment.employee_id
                  : appointment.employee_id === column.id
              );

              const columnAvailabilityBlocks = column.isUnassigned
                ? []
                : availabilityBlocks.filter(
                    (item) => item.employee_id === column.id
                  );

              return (
                <div
                  key={column.id}
                  className="relative border-r border-slate-300 bg-slate-100/80 last:border-r-0"
                >
                  {slots.map((slot) => (
                    <div
                      key={`${column.id}-${slot.hour}-${slot.minute}`}
                      className={
                        slot.isHour
                          ? 'border-t-2 border-slate-400'
                          : 'border-t border-slate-200'
                      }
                      style={{ height: SLOT_HEIGHT }}
                    />
                  ))}

                  {columnAvailabilityBlocks.map((item) => {
                    const placement = getAvailabilityPlacement(
                      item,
                      startHour,
                      totalMinutes
                    );

                    if (!placement) return null;

                    const startText = String(item.start_time).slice(0, 5);
                    const endText = String(item.end_time).slice(0, 5);
                    const label = item.label?.trim() || 'Break';

                    return (
                      <div
                        key={`availability-${item.id}`}
                        className="pointer-events-none absolute left-1 right-1 z-[5] overflow-hidden rounded-sm border-l-4 border-y border-r border-slate-400 bg-[repeating-linear-gradient(-45deg,rgba(226,232,240,0.96),rgba(226,232,240,0.96)_8px,rgba(241,245,249,0.96)_8px,rgba(241,245,249,0.96)_16px)] px-2 py-1 text-left text-slate-700 shadow-sm"
                        style={{
                          top: placement.top,
                          height: placement.height,
                          minHeight: 22,
                        }}
                        title={`${label} · ${startText}–${endText}`}
                      >
                        <div className="truncate text-[11px] font-extrabold leading-tight">
                          {startText}–{endText}
                        </div>

                        {placement.height >= 38 && (
                          <div className="truncate text-[11px] font-bold leading-tight">
                            {label}
                          </div>
                        )}

                        {placement.height >= 56 && (
                          <div className="truncate text-[10px] leading-tight opacity-75">
                            Unavailable
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {columnAppointments.map((appointment) => {
                    const placement = getAppointmentPlacement(
                      appointment,
                      startHour,
                      totalMinutes
                    );

                    if (!placement) return null;

                    const serviceNames =
                      appointment.appointment_services
                        ?.map((row: any) => row.services?.name)
                        .filter(Boolean)
                        .join(', ') || 'Appointment';

                    const customerName =
                      appointment.customers?.full_name || 'Guest customer';

                    const status = String(appointment.status || 'default');
                    const statusClass =
                      STATUS_STYLES[status] || STATUS_STYLES.default;

                    const startText = format(
                      parseISO(appointment.start_time),
                      'HH:mm'
                    );
                    const endText = format(
                      getAppointmentEnd(appointment),
                      'HH:mm'
                    );

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => onAppointmentClick?.(appointment)}
                        className={`absolute left-1 right-1 z-10 overflow-hidden rounded-sm border-l-4 border-y border-r px-2 py-1 text-left shadow-sm transition hover:z-20 hover:brightness-95 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary ${statusClass}`}
                        style={{
                          top: placement.top,
                          height: placement.height,
                          minHeight: 22,
                        }}
                        title={`${startText}–${endText} · ${customerName} · ${serviceNames}`}
                      >
                        <div className="truncate text-[11px] font-extrabold leading-tight">
                          {startText}–{endText}
                        </div>

                        {placement.height >= 38 && (
                          <div className="truncate text-[11px] font-bold leading-tight">
                            {customerName}
                          </div>
                        )}

                        {placement.height >= 56 && (
                          <div className="truncate text-[10px] leading-tight opacity-80">
                            {serviceNames}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            <CurrentTimeLine startHour={startHour} endHour={endHour} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-white px-4 py-3 text-[11px] text-muted-foreground">
        <LegendDot className="bg-emerald-500" label="Completed" />
        <LegendDot className="bg-blue-500" label="In progress" />
        <LegendDot className="bg-teal-500" label="Confirmed" />
        <LegendDot className="bg-violet-500" label="Other" />
        <LegendDot className="bg-slate-400" label="Cancelled" />
        <LegendDot className="bg-slate-300 ring-1 ring-slate-400" label="Break" />
      </div>
    </div>
  );
}

function CurrentTimeLine({
  startHour,
  endHour,
}: {
  startHour: number;
  endHour: number;
}) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduleStart = startHour * 60;
  const scheduleEnd = endHour * 60;

  if (
    currentMinutes < scheduleStart ||
    currentMinutes > scheduleEnd
  ) {
    return null;
  }

  const top =
    ((currentMinutes - scheduleStart) / SLOT_MINUTES) * SLOT_HEIGHT;

  return (
    <div
      className="pointer-events-none absolute z-20 flex items-center"
      style={{
        left: TIME_COLUMN_WIDTH - 5,
        right: 0,
        top,
      }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-red-600 shadow" />
      <div className="h-0.5 flex-1 bg-red-600 shadow-sm" />
    </div>
  );
}

function getAvailabilityPlacement(
  item: AvailabilityBlock,
  startHour: number,
  totalMinutes: number
) {
  const [startHours, startMinutes] = String(item.start_time)
    .slice(0, 5)
    .split(':')
    .map(Number);

  const [endHours, endMinutes] = String(item.end_time)
    .slice(0, 5)
    .split(':')
    .map(Number);

  if (
    Number.isNaN(startHours) ||
    Number.isNaN(startMinutes) ||
    Number.isNaN(endHours) ||
    Number.isNaN(endMinutes)
  ) {
    return null;
  }

  const scheduleStart = startHour * 60;
  const blockStart = startHours * 60 + startMinutes;
  const blockEnd = endHours * 60 + endMinutes;

  const visibleStart = Math.max(blockStart, scheduleStart);
  const visibleEnd = Math.min(
    blockEnd > blockStart ? blockEnd : blockStart + 15,
    scheduleStart + totalMinutes
  );

  if (
    visibleEnd <= scheduleStart ||
    visibleStart >= scheduleStart + totalMinutes
  ) {
    return null;
  }

  return {
    top:
      ((visibleStart - scheduleStart) / SLOT_MINUTES) *
        SLOT_HEIGHT +
      1,
    height: Math.max(
      ((visibleEnd - visibleStart) / SLOT_MINUTES) *
        SLOT_HEIGHT -
        2,
      22
    ),
  };
}

function getAppointmentPlacement(
  appointment: any,
  startHour: number,
  totalMinutes: number
) {
  if (!appointment.start_time) return null;

  const start = parseISO(appointment.start_time);
  const end = getAppointmentEnd(appointment);
  const scheduleStart = startHour * 60;

  const appointmentStart =
    start.getHours() * 60 + start.getMinutes();
  const appointmentEnd =
    end.getHours() * 60 + end.getMinutes();

  const safeAppointmentEnd =
    appointmentEnd > appointmentStart
      ? appointmentEnd
      : appointmentStart + 30;

  const visibleStart = Math.max(
    appointmentStart,
    scheduleStart
  );
  const visibleEnd = Math.min(
    safeAppointmentEnd,
    scheduleStart + totalMinutes
  );

  if (
    visibleEnd <= scheduleStart ||
    visibleStart >= scheduleStart + totalMinutes
  ) {
    return null;
  }

  return {
    top:
      ((visibleStart - scheduleStart) / SLOT_MINUTES) *
        SLOT_HEIGHT +
      1,
    height: Math.max(
      ((visibleEnd - visibleStart) / SLOT_MINUTES) *
        SLOT_HEIGHT -
        2,
      22
    ),
  };
}

function getAppointmentEnd(appointment: any) {
  if (appointment.end_time) {
    return parseISO(appointment.end_time);
  }

  const start = parseISO(appointment.start_time);
  const duration = Number(
    appointment.total_duration || 30
  );

  return new Date(start.getTime() + duration * 60_000);
}

function LegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  );
}

function ScheduleLoading() {
  return (
    <div className="min-h-[620px] animate-pulse bg-slate-50 p-4">
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-20 rounded-lg bg-muted" />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((column) => (
          <div key={column} className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
              <div
                key={row}
                className="h-8 rounded bg-muted/70"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
