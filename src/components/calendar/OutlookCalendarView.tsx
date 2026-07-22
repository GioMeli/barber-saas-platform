import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
import allLocales from '@fullcalendar/core/locales-all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  Keyboard,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import './calendar-outlook.css';

export type CalendarView =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridThreeDay'
  | 'timeGridDay'
  | 'listDay';

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

const CALENDAR_VIEWS: CalendarView[] = [
  'timeGridDay',
  'timeGridThreeDay',
  'timeGridWeek',
  'dayGridMonth',
  'listDay',
];

const STORAGE_KEYS = {
  view: 'velliqo.calendar.view',
  weekends: 'velliqo.calendar.show-weekends',
  completed: 'velliqo.calendar.show-completed',
  cancelled: 'velliqo.calendar.show-cancelled',
  allDay: 'velliqo.calendar.show-all-day',
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
  const { t, i18n } = useTranslation();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [title, setTitle] = React.useState(t('calendar.title'));
  const [view, setView] = React.useState<CalendarView>(() => readInitialView());
  const [activeRange, setActiveRange] = React.useState({
    start: new Date(),
    end: addDays(new Date(), 7),
  });
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showWeekends, setShowWeekends] = React.useState(() =>
    readStoredBoolean(STORAGE_KEYS.weekends, true)
  );
  const [showCompleted, setShowCompleted] = React.useState(() =>
    readStoredBoolean(STORAGE_KEYS.completed, true)
  );
  const [showCancelled, setShowCancelled] = React.useState(() =>
    readStoredBoolean(STORAGE_KEYS.cancelled, true)
  );
  const [showAllDay, setShowAllDay] = React.useState(() =>
    readStoredBoolean(STORAGE_KEYS.allDay, true)
  );

  const api = React.useCallback(() => calendarRef.current?.getApi(), []);

  const changeView = React.useCallback((next: CalendarView) => {
    api()?.changeView(next);
    setView(next);
    writeStorage(STORAGE_KEYS.view, next);
  }, [api]);

  React.useEffect(() => {
    writeStorage(STORAGE_KEYS.weekends, String(showWeekends));
  }, [showWeekends]);

  React.useEffect(() => {
    writeStorage(STORAGE_KEYS.completed, String(showCompleted));
  }, [showCompleted]);

  React.useEffect(() => {
    writeStorage(STORAGE_KEYS.cancelled, String(showCancelled));
  }, [showCancelled]);

  React.useEffect(() => {
    writeStorage(STORAGE_KEYS.allDay, String(showAllDay));
  }, [showAllDay]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]'
        )
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'n') {
        event.preventDefault();
        onNewAppointment();
        return;
      }

      if (key === 't') {
        event.preventDefault();
        api()?.today();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        api()?.prev();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        api()?.next();
        return;
      }

      const shortcuts: Partial<Record<string, CalendarView>> = {
        '1': 'timeGridDay',
        '3': 'timeGridThreeDay',
        '7': 'timeGridWeek',
        m: 'dayGridMonth',
        a: 'listDay',
      };

      const nextView = shortcuts[key];
      if (nextView) {
        event.preventDefault();
        changeView(nextView);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [api, changeView, onNewAppointment]);

  const filteredAppointments = useMemo(() => {
    let visibleAppointments = appointments;

    if (selectedEmployeeFilter === 'unassigned') {
      visibleAppointments = visibleAppointments.filter(
        (appointment) => !appointment.employee_id
      );
    } else if (selectedEmployeeFilter !== 'all') {
      visibleAppointments = visibleAppointments.filter(
        (appointment) => appointment.employee_id === selectedEmployeeFilter
      );
    }

    if (!showCompleted) {
      visibleAppointments = visibleAppointments.filter(
        (appointment) => deriveStatus(appointment) !== 'completed'
      );
    }

    if (!showCancelled) {
      visibleAppointments = visibleAppointments.filter(
        (appointment) =>
          !['cancelled_by_business', 'cancelled_by_customer'].includes(
            deriveStatus(appointment)
          )
      );
    }

    const normalizedQuery = searchQuery.trim().toLocaleLowerCase(i18n.language);
    if (!normalizedQuery) return visibleAppointments;

    return visibleAppointments.filter((appointment) => {
      const serviceNames = appointment.appointment_services
        ?.map((row: any) => row.services?.name)
        .filter(Boolean)
        .join(' ');

      return [
        appointment.customers?.full_name,
        appointment.customers?.email,
        appointment.customers?.phone,
        appointment.employees?.name,
        appointment.booking_reference,
        serviceNames,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase(i18n.language).includes(normalizedQuery)
        );
    });
  }, [
    appointments,
    selectedEmployeeFilter,
    showCompleted,
    showCancelled,
    searchQuery,
    i18n.language,
  ]);

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

  const events = useMemo<EventInput[]>(() => {
    const appointmentEvents = filteredAppointments.map((appointment) => {
      const status = deriveStatus(appointment);
      const services =
        appointment.appointment_services
          ?.map((row: any) => row.services?.name)
          .filter(Boolean)
          .join(', ') || t('calendar.labels.appointment');

      return {
        id: appointment.id,
        title: `${appointment.customers?.full_name || t('calendar.labels.customer')} · ${services}`,
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
      title: `${t('calendar.labels.closed')} · ${closure.title}`,
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
          title: item.label || t('calendar.labels.break'),
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
    t,
  ]);

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
          <strong>{t('calendar.labels.closed')}</strong>
          <span className="truncate">
            {arg.event.extendedProps.closure.title}
          </span>
        </div>
      );
    }

    if (arg.event.extendedProps.kind === 'break') {
      return (
        <div className="salonos-break-event-content">
          <strong>
            {arg.event.extendedProps.breakItem.label ||
              t('calendar.labels.break')}
          </strong>
          <span>{arg.timeText}</span>
        </div>
      );
    }

    if (arg.event.extendedProps.kind !== 'appointment') return null;

    const customerName =
      arg.event.extendedProps.appointment.customers?.full_name ||
      t('calendar.labels.customer');

    return (
      <div className="salonos-event-content">
        <div className="salonos-event-time">{arg.timeText}</div>
        <div className="salonos-event-title">{customerName}</div>
      </div>
    );
  };

  const resetPreferences = () => {
    setSearchQuery('');
    onEmployeeFilterChange('all');
    setShowWeekends(true);
    setShowCompleted(true);
    setShowCancelled(true);
    setShowAllDay(true);
  };

  return (
    <div className="outlook-calendar-page">
      <header className="outlook-calendar-toolbar">
        <div className="outlook-calendar-nav">
          <Button variant="outline" size="sm" onClick={() => api()?.today()}>
            {t('calendar.actions.today')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => api()?.prev()}
            aria-label={t('calendar.actions.previousPeriod')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => api()?.next()}
            aria-label={t('calendar.actions.nextPeriod')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="outlook-calendar-title">{title}</div>
        </div>

        <div className="outlook-calendar-actions">
          <select
            value={selectedEmployeeFilter}
            onChange={(event) => onEmployeeFilterChange(event.target.value)}
            className="outlook-calendar-professional-select h-9 min-w-[175px] rounded-lg border bg-background px-3 text-sm"
            aria-label={t('calendar.filters.professional')}
          >
            <option value="all">{t('calendar.filters.allProfessionals')}</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
            <option value="unassigned">{t('calendar.labels.unassigned')}</option>
          </select>

          <div className="outlook-view-switcher">
            {CALENDAR_VIEWS.map((item) => (
              <button
                key={item}
                type="button"
                className={view === item ? 'active' : ''}
                onClick={() => changeView(item)}
              >
                {getViewIcon(item)}
                {t(`calendar.views.${item}`)}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            className="outlook-calendar-delay-button"
            onClick={onCreateDelay}
          >
            {t('calendar.delay.title')}
          </Button>

          <Button
            variant="outline"
            className="outlook-calendar-options-button"
            onClick={() => setPreferencesOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="outlook-calendar-options-label">
              {t('calendar.preferences.title')}
            </span>
          </Button>

          <Button
            className="outlook-calendar-new-button"
            onClick={() => onNewAppointment()}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('calendar.newAppointment.title')}
          </Button>
        </div>
      </header>

      <div className="outlook-calendar-mobile-views">
        {CALENDAR_VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            className={view === item ? 'active' : ''}
            onClick={() => changeView(item)}
          >
            {t(`calendar.views.${item}`)}
          </button>
        ))}
      </div>

      <div className="outlook-calendar-shell">
        {loading && (
          <div className="outlook-calendar-loading">{t('calendar.loading')}</div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locales={allLocales}
          locale={i18n.language}
          initialView={view}
          headerToolbar={false}
          height="100%"
          expandRows
          nowIndicator
          allDaySlot={showAllDay}
          weekends={showWeekends}
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
          moreLinkText={(count) => t('calendar.more', { count })}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
          views={{
            timeGridThreeDay: {
              type: 'timeGrid',
              duration: { days: 3 },
              dateIncrement: { days: 3 },
              dayHeaderFormat: {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              },
            },
            dayGridMonth: { dayMaxEventRows: 3, fixedWeekCount: false },
            timeGridWeek: {
              dayHeaderFormat: {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              },
            },
            timeGridDay: {
              dayHeaderFormat: {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              },
            },
          }}
        />
      </div>

      <button
        type="button"
        className="outlook-calendar-mobile-fab"
        onClick={() => onNewAppointment()}
        aria-label={t('calendar.newAppointment.title')}
      >
        <Plus className="h-5 w-5" />
      </button>

      <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pr-8">
            <SheetTitle>{t('calendar.preferences.title')}</SheetTitle>
            <SheetDescription>
              {t('calendar.preferences.description')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-7">
            <section className="space-y-3">
              <Label htmlFor="calendar-search">
                {t('calendar.preferences.searchAppointments')}
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="calendar-search"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('calendar.filters.searchPlaceholder')}
                />
              </div>
            </section>

            <section className="space-y-3">
              <Label>{t('calendar.filters.professional')}</Label>
              <select
                value={selectedEmployeeFilter}
                onChange={(event) => onEmployeeFilterChange(event.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="all">
                  {t('calendar.filters.allProfessionals')}
                </option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
                <option value="unassigned">
                  {t('calendar.labels.unassigned')}
                </option>
              </select>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('calendar.preferences.defaultView')}
              </div>
              <div className="calendar-preferences-view-grid">
                {CALENDAR_VIEWS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={view === item ? 'active' : ''}
                    onClick={() => changeView(item)}
                  >
                    {getViewIcon(item)}
                    <span>{t(`calendar.views.${item}`)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-1">
              <PreferenceToggle
                label={t('calendar.preferences.showWeekends')}
                description={t('calendar.preferences.showWeekendsDescription')}
                checked={showWeekends}
                onCheckedChange={setShowWeekends}
              />
              <PreferenceToggle
                label={t('calendar.preferences.showAllDay')}
                description={t('calendar.preferences.showAllDayDescription')}
                checked={showAllDay}
                onCheckedChange={setShowAllDay}
              />
              <PreferenceToggle
                label={t('calendar.preferences.showCompleted')}
                description={t('calendar.preferences.showCompletedDescription')}
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <PreferenceToggle
                label={t('calendar.preferences.showCancelled')}
                description={t('calendar.preferences.showCancelledDescription')}
                checked={showCancelled}
                onCheckedChange={setShowCancelled}
              />
            </section>

            <section className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Keyboard className="h-4 w-4 text-primary" />
                {t('calendar.preferences.shortcuts')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('calendar.preferences.shortcutsDescription')}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Shortcut keys="N" label={t('calendar.newAppointment.title')} />
                <Shortcut keys="T" label={t('calendar.actions.today')} />
                <Shortcut keys="← / →" label={t('calendar.preferences.navigate')} />
                <Shortcut keys="1 / 3 / 7" label={t('calendar.preferences.changeView')} />
                <Shortcut keys="M" label={t('calendar.views.dayGridMonth')} />
                <Shortcut keys="A" label={t('calendar.views.listDay')} />
              </div>
            </section>

            <Button
              variant="outline"
              className="w-full"
              onClick={resetPreferences}
            >
              <RotateCcw className="h-4 w-4" />
              {t('calendar.preferences.reset')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-1 py-3">
      <div>
        <div className="font-medium">{label}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
      <span className="truncate text-muted-foreground">{label}</span>
      <kbd className="shrink-0 rounded border bg-muted px-2 py-0.5 text-[11px] font-semibold">
        {keys}
      </kbd>
    </div>
  );
}

function getViewIcon(view: CalendarView) {
  if (view === 'dayGridMonth') return <LayoutGrid className="h-4 w-4" />;
  if (view === 'listDay') return <List className="h-4 w-4" />;
  if (view === 'timeGridDay') return <Clock3 className="h-4 w-4" />;
  if (view === 'timeGridThreeDay') return <Columns3 className="h-4 w-4" />;
  return <CalendarDays className="h-4 w-4" />;
}

function readInitialView(): CalendarView {
  if (typeof window === 'undefined') return 'timeGridWeek';

  const stored = window.localStorage.getItem(STORAGE_KEYS.view);
  if (stored && CALENDAR_VIEWS.includes(stored as CalendarView)) {
    return stored as CalendarView;
  }

  return window.innerWidth <= 760 ? 'timeGridDay' : 'timeGridWeek';
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
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
