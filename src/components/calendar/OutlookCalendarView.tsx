import React, { useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, {
  DateClickArg,
} from '@fullcalendar/interaction';

import {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/core';
import { addDays, format, isAfter, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Plus } from 'lucide-react';
import './calendar-outlook.css';

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listDay';

type Props = {
  appointments: any[];
  closures: any[];
  breaks: any[];
  staff: any[];
  selectedEmployeeFilter: string;
  onEmployeeFilterChange: (value: string) => void;
  loading?: boolean;
  onNewAppointment: (date?: string, time?: string) => void;
  onAppointmentClick: (appointment: any) => void;
  onRangeChange: (start: Date, end: Date) => void;
  onAppointmentMove: (
    appointment: any,
    newStart: Date,
    newEnd: Date | null
  ) => Promise<boolean>;
  onAppointmentResize: (
    appointment: any,
    newStart: Date,
    newEnd: Date
  ) => Promise<boolean>;
  onCreateDelay: () => void;
};

const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: 'Month',
  timeGridWeek: 'Week',
  timeGridDay: 'Day',
  listDay: 'Daily Details',
};

export default function OutlookCalendarView({
  appointments,
  closures,
  breaks,
  staff,
  selectedEmployeeFilter,
  onEmployeeFilterChange,
  loading = false,
  onNewAppointment,
  onAppointmentClick,
  onRangeChange,
  onAppointmentMove,
  onAppointmentResize,
  onCreateDelay,
}: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [title, setTitle] = React.useState('Calendar');
  const [view, setView] = React.useState<CalendarView>('timeGridWeek');
  const [activeRange, setActiveRange] = React.useState({
    start: new Date(),
    end: addDays(new Date(), 7),
  });

  const filteredAppointments = useMemo(() => {
    if (selectedEmployeeFilter === 'all') return appointments;

    if (selectedEmployeeFilter === 'unassigned') {
      return appointments.filter((appointment) => !appointment.employee_id);
    }

    return appointments.filter(
      (appointment) => appointment.employee_id === selectedEmployeeFilter
    );
  }, [appointments, selectedEmployeeFilter]);

  const visibleBreaks = useMemo(() => {
    if (
      selectedEmployeeFilter === 'all' ||
      selectedEmployeeFilter === 'unassigned'
    ) {
      return [];
    }

    return breaks.filter(
      (item) => item.employee_id === selectedEmployeeFilter
    );
  }, [breaks, selectedEmployeeFilter]);

  const api = () => calendarRef.current?.getApi();

  const events = useMemo<EventInput[]>(() => {
    const appointmentEvents = filteredAppointments.map((appointment) => {
      const status = deriveStatus(appointment);
      const services =
        appointment.appointment_services
          ?.map((row: any) => row.services?.name)
          .filter(Boolean)
          .join(', ') || 'Appointment';

      return {
        id: appointment.id,
        title: `${appointment.customers?.full_name || 'Customer'} · ${services}`,
        start: appointment.start_time,
        end: appointment.end_time,
        classNames: ['salonos-event', `salonos-status-${status}`],
        extendedProps: {
          kind: 'appointment',
          appointment,
          status,
          services,
        },
      };
    });

    const closureBackgrounds = closures.map((closure) => ({
      id: `closure-bg-${closure.id}`,
      start: closure.start_date,
      end: addOneDayIso(closure.end_date),
      allDay: true,
      display: 'background',
      classNames: ['salonos-closure-background'],
      extendedProps: { kind: 'closure-background', closure },
    }));

    const closureLabels = closures.map((closure) => ({
      id: `closure-label-${closure.id}`,
      title: `Closed · ${closure.title}`,
      start: closure.start_date,
      end: addOneDayIso(closure.end_date),
      allDay: true,
      classNames: ['salonos-closure-label'],
      extendedProps: { kind: 'closure-label', closure },
    }));

    const breakEvents = visibleBreaks.flatMap((item) => {
      const dates: EventInput[] = [];

      for (
        let cursor = new Date(activeRange.start);
        cursor < activeRange.end;
        cursor = addDays(cursor, 1)
      ) {
        if (cursor.getDay() !== Number(item.day_of_week)) continue;

        const date = format(cursor, 'yyyy-MM-dd');

        dates.push({
          id: `break-${item.id}-${date}`,
          title: item.label || 'Break',
          start: `${date}T${String(item.start_time).slice(0, 8)}`,
          end: `${date}T${String(item.end_time).slice(0, 8)}`,
          editable: false,
          startEditable: false,
          durationEditable: false,
          classNames: ['salonos-break-event'],
          extendedProps: {
            kind: 'break',
            breakItem: item,
          },
        });
      }

      return dates;
    });

    return [
      ...appointmentEvents,
      ...breakEvents,
      ...closureBackgrounds,
      ...closureLabels,
    ];
  }, [
    filteredAppointments,
    closures,
    visibleBreaks,
    activeRange.start,
    activeRange.end,
  ]);

  const changeView = (next: CalendarView) => {
    api()?.changeView(next);
    setView(next);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(arg.view.type as CalendarView);
    setActiveRange({
      start: arg.start,
      end: arg.end,
    });
    onRangeChange(arg.start, arg.end);
  };

  const handleDateClick = (arg: DateClickArg) => {
    const date = arg.dateStr.slice(0, 10);
    const closure = closures.find(
      (item) => item.is_active && date >= item.start_date && date <= item.end_date
    );
    if (closure) return;
    onNewAppointment(date, arg.allDay ? '' : format(arg.date, 'HH:mm'));
  };

  const handleEventClick = (arg: EventClickArg) => {
    if (arg.event.extendedProps.kind === 'appointment') {
      onAppointmentClick(arg.event.extendedProps.appointment);
    }
  };


  const handleEventDrop = async (arg: any) => {
    const appointment = arg.event.extendedProps.appointment;
    if (!appointment || !arg.event.start) {
      arg.revert();
      return;
    }

    const accepted = await onAppointmentMove(
      appointment,
      arg.event.start,
      arg.event.end
    );

    if (!accepted) arg.revert();
  };

  const handleEventResize = async (arg: any) => {
    const appointment = arg.event.extendedProps.appointment;
    if (!appointment || !arg.event.start || !arg.event.end) {
      arg.revert();
      return;
    }

    const accepted = await onAppointmentResize(
      appointment,
      arg.event.start,
      arg.event.end
    );

    if (!accepted) arg.revert();
  };

  const renderEventContent = (arg: EventContentArg) => {
    if (arg.event.extendedProps.kind === 'closure-label') {
      return (
        <div className="salonos-closure-event-content">
          <strong>Closed</strong>
          <span className="truncate">
            {arg.event.extendedProps.closure.title}
          </span>
        </div>
      );
    }

    if (arg.event.extendedProps.kind === 'break') {
      return (
        <div className="salonos-break-event-content">
          <strong>{arg.event.extendedProps.breakItem.label || 'Break'}</strong>
          <span>{arg.timeText}</span>
        </div>
      );
    }

    if (arg.event.extendedProps.kind !== 'appointment') return null;

    const customerName =
      arg.event.extendedProps.appointment.customers?.full_name || 'Customer';

    return (
      <div className="salonos-event-content">
        <div className="salonos-event-time">
          {arg.timeText}
        </div>

        <div className="salonos-event-title">
          {customerName}
        </div>
      </div>
    );
  };

  return (
    <div className="outlook-calendar-page">
      <header className="outlook-calendar-toolbar">
        <div className="outlook-calendar-nav">
          <Button variant="outline" size="sm" onClick={() => api()?.today()}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => api()?.prev()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => api()?.next()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="outlook-calendar-title">{title}</div>
        </div>

        <div className="outlook-calendar-actions">
          <select
            value={selectedEmployeeFilter}
            onChange={(event) => onEmployeeFilterChange(event.target.value)}
            className="h-9 min-w-[175px] rounded-lg border bg-background px-3 text-sm"
          >
            <option value="all">All professionals</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>

          <div className="outlook-view-switcher">
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((item) => (
              <button
                key={item}
                type="button"
                className={view === item ? 'active' : ''}
                onClick={() => changeView(item)}
              >
                {item === 'dayGridMonth' && <LayoutGrid className="h-4 w-4" />}
                {item === 'listDay' && <List className="h-4 w-4" />}
                {VIEW_LABELS[item]}
              </button>
            ))}
          </div>

          <Button variant="outline" onClick={onCreateDelay}>
            Create Delay
          </Button>

          <Button onClick={() => onNewAppointment()}>
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </header>

      <div className="outlook-calendar-mobile-views">
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((item) => (
          <button
            key={item}
            type="button"
            className={view === item ? 'active' : ''}
            onClick={() => changeView(item)}
          >
            {VIEW_LABELS[item]}
          </button>
        ))}
      </div>

      <div className="outlook-calendar-shell">
        {loading && <div className="outlook-calendar-loading">Loading calendar...</div>}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          height="100%"
          expandRows
          nowIndicator
          allDaySlot
          firstDay={1}
          slotMinTime="07:00:00"
          slotMaxTime="21:30:00"
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          slotLabelInterval="00:30:00"
          scrollTime="08:00:00"
          events={events}
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={renderEventContent}
          editable
          eventStartEditable
          eventDurationEditable
          dayMaxEvents={3}
          moreLinkClick={(arg) => {
            api()?.changeView('listDay', arg.date);
            return 'listDay';
          }}
          moreLinkText={(count) => `+${count} more`}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
          views={{
            dayGridMonth: { dayMaxEventRows: 3, fixedWeekCount: false },
            timeGridWeek: {
              dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'short' },
            },
            timeGridDay: {
              dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' },
            },
          }}
        />
      </div>
    </div>
  );
}

function deriveStatus(appointment: any) {
  if (
    ['completed', 'cancelled_by_business', 'cancelled_by_customer', 'no_show'].includes(
      appointment.status
    )
  ) {
    return appointment.status;
  }

  const start = parseISO(appointment.start_time);
  const end = appointment.end_time
    ? parseISO(appointment.end_time)
    : new Date(start.getTime() + Number(appointment.total_duration || 30) * 60_000);

  return isAfter(new Date(), end) ? 'completed' : appointment.status || 'confirmed';
}

function addOneDayIso(value: string) {
  return format(addDays(new Date(`${value}T00:00:00`), 1), 'yyyy-MM-dd');
}
