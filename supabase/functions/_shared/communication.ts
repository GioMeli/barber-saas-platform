export type CommunicationLocale = 'en' | 'el' | 'tr' | 'de' | 'es';

export type AppointmentEventType =
  | 'booking_confirmation'
  | 'owner_new_booking'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'owner_appointment_rescheduled';

export type ReminderType = '24_hour' | '2_hour';

export type AppointmentCommunicationContext = {
  businessName: string;
  businessEmail?: string | null;
  replyToEmail?: string | null;
  logoUrl?: string | null;
  customerName: string;
  professionalName: string;
  dateText: string;
  timeText: string;
  services: string[];
  totalPrice: number;
  currency?: string | null;
  bookingReference: string;
  address: string;
  phone?: string | null;
  storeUrl: string;
};

export type RenderedCommunication = {
  subject: string;
  text: string;
  html: string;
  sms: string;
};

type Copy = {
  labels: {
    date: string;
    time: string;
    professional: string;
    services: string;
    total: string;
    reference: string;
    viewStore: string;
    appointmentService: string;
    transactionalFooter: string;
  };
  events: Record<AppointmentEventType, {
    eyebrow: string;
    heading: string;
    intro: (ctx: AppointmentCommunicationContext) => string;
    subject: (ctx: AppointmentCommunicationContext) => string;
    action: string;
    sms: (ctx: AppointmentCommunicationContext) => string;
    danger?: boolean;
  }>;
  reminders: Record<ReminderType, {
    eyebrow: string;
    heading: string;
    intro: (ctx: AppointmentCommunicationContext) => string;
    subject: (ctx: AppointmentCommunicationContext) => string;
    sms: (ctx: AppointmentCommunicationContext) => string;
  }>;
};

const COPIES: Record<CommunicationLocale, Copy> = {
  en: {
    labels: {
      date: 'Date', time: 'Time', professional: 'Professional', services: 'Services',
      total: 'Total', reference: 'Booking reference', viewStore: 'View business page',
      appointmentService: 'Appointment service',
      transactionalFooter: 'This operational message was sent for an existing appointment.',
    },
    events: {
      booking_confirmation: {
        eyebrow: 'Booking confirmed', heading: 'Your appointment is confirmed',
        intro: (c) => `Hello ${c.customerName}, your appointment at ${c.businessName} has been booked successfully.`,
        subject: (c) => `${c.businessName}: booking confirmation`, action: 'View booking details',
        sms: (c) => `${c.businessName}: appointment confirmed for ${c.dateText} at ${c.timeText}. Ref ${c.bookingReference}.`,
      },
      owner_new_booking: {
        eyebrow: 'New appointment', heading: 'A new appointment was booked',
        intro: (c) => `${c.customerName} created a new appointment at ${c.businessName}.`,
        subject: (c) => `${c.businessName}: new appointment from ${c.customerName}`, action: 'Open business page',
        sms: (c) => `${c.businessName}: new appointment from ${c.customerName} on ${c.dateText} at ${c.timeText}.`,
      },
      appointment_cancelled: {
        eyebrow: 'Appointment cancelled', heading: 'Your appointment has been cancelled',
        intro: (c) => `Your appointment at ${c.businessName} is no longer active.`,
        subject: (c) => `${c.businessName}: appointment cancelled`, action: 'Book another appointment', danger: true,
        sms: (c) => `${c.businessName}: your appointment on ${c.dateText} at ${c.timeText} was cancelled. Ref ${c.bookingReference}.`,
      },
      appointment_rescheduled: {
        eyebrow: 'Appointment updated', heading: 'Your appointment details changed',
        intro: (c) => `Your appointment at ${c.businessName} has been updated. Please review the new date and time.`,
        subject: (c) => `${c.businessName}: appointment updated`, action: 'View updated details',
        sms: (c) => `${c.businessName}: appointment updated to ${c.dateText} at ${c.timeText}. Ref ${c.bookingReference}.`,
      },
      owner_appointment_rescheduled: {
        eyebrow: 'Appointment updated', heading: 'An appointment was rescheduled',
        intro: (c) => `${c.customerName}'s appointment details have changed.`,
        subject: (c) => `${c.businessName}: appointment rescheduled`, action: 'Open business page',
        sms: (c) => `${c.businessName}: ${c.customerName}'s appointment moved to ${c.dateText} at ${c.timeText}.`,
      },
    },
    reminders: {
      '24_hour': {
        eyebrow: 'Appointment reminder', heading: 'Your appointment is tomorrow',
        intro: (c) => `Hello ${c.customerName}, this is a reminder for your appointment at ${c.businessName}.`,
        subject: (c) => `${c.businessName}: appointment reminder for tomorrow`,
        sms: (c) => `${c.businessName}: reminder for ${c.dateText} at ${c.timeText}. Ref ${c.bookingReference}.`,
      },
      '2_hour': {
        eyebrow: 'Appointment reminder', heading: 'Your appointment is in about 2 hours',
        intro: (c) => `Hello ${c.customerName}, your appointment at ${c.businessName} is coming up soon.`,
        subject: (c) => `${c.businessName}: appointment reminder in 2 hours`,
        sms: (c) => `${c.businessName}: your appointment is at ${c.timeText} today. Ref ${c.bookingReference}.`,
      },
    },
  },
  el: {
    labels: {
      date: 'Ημερομηνία', time: 'Ώρα', professional: 'Επαγγελματίας', services: 'Υπηρεσίες',
      total: 'Σύνολο', reference: 'Κωδικός κράτησης', viewStore: 'Προβολή σελίδας επιχείρησης',
      appointmentService: 'Υπηρεσία ραντεβού',
      transactionalFooter: 'Αυτό το λειτουργικό μήνυμα στάλθηκε για υπάρχον ραντεβού.',
    },
    events: {
      booking_confirmation: {
        eyebrow: 'Επιβεβαιωμένη κράτηση', heading: 'Το ραντεβού σας επιβεβαιώθηκε',
        intro: (c) => `Γεια σας ${c.customerName}, το ραντεβού σας στην επιχείρηση ${c.businessName} καταχωρίστηκε με επιτυχία.`,
        subject: (c) => `${c.businessName}: επιβεβαίωση κράτησης`, action: 'Προβολή στοιχείων κράτησης',
        sms: (c) => `${c.businessName}: επιβεβαιώθηκε ραντεβού ${c.dateText}, ${c.timeText}. Κωδικός ${c.bookingReference}.`,
      },
      owner_new_booking: {
        eyebrow: 'Νέο ραντεβού', heading: 'Δημιουργήθηκε νέο ραντεβού',
        intro: (c) => `Ο/Η ${c.customerName} δημιούργησε νέο ραντεβού στην επιχείρηση ${c.businessName}.`,
        subject: (c) => `${c.businessName}: νέο ραντεβού από ${c.customerName}`, action: 'Άνοιγμα σελίδας επιχείρησης',
        sms: (c) => `${c.businessName}: νέο ραντεβού από ${c.customerName}, ${c.dateText} ${c.timeText}.`,
      },
      appointment_cancelled: {
        eyebrow: 'Ακύρωση ραντεβού', heading: 'Το ραντεβού σας ακυρώθηκε',
        intro: (c) => `Το ραντεβού σας στην επιχείρηση ${c.businessName} δεν είναι πλέον ενεργό.`,
        subject: (c) => `${c.businessName}: ακύρωση ραντεβού`, action: 'Νέα κράτηση', danger: true,
        sms: (c) => `${c.businessName}: ακυρώθηκε το ραντεβού ${c.dateText}, ${c.timeText}. Κωδικός ${c.bookingReference}.`,
      },
      appointment_rescheduled: {
        eyebrow: 'Ενημέρωση ραντεβού', heading: 'Τα στοιχεία του ραντεβού άλλαξαν',
        intro: (c) => `Το ραντεβού σας στην επιχείρηση ${c.businessName} ενημερώθηκε. Ελέγξτε τη νέα ημερομηνία και ώρα.`,
        subject: (c) => `${c.businessName}: ενημέρωση ραντεβού`, action: 'Προβολή νέων στοιχείων',
        sms: (c) => `${c.businessName}: νέο ραντεβού ${c.dateText}, ${c.timeText}. Κωδικός ${c.bookingReference}.`,
      },
      owner_appointment_rescheduled: {
        eyebrow: 'Ενημέρωση ραντεβού', heading: 'Ένα ραντεβού μετακινήθηκε',
        intro: (c) => `Τα στοιχεία του ραντεβού του/της ${c.customerName} άλλαξαν.`,
        subject: (c) => `${c.businessName}: αλλαγή ραντεβού`, action: 'Άνοιγμα σελίδας επιχείρησης',
        sms: (c) => `${c.businessName}: το ραντεβού του/της ${c.customerName} μετακινήθηκε στις ${c.dateText} ${c.timeText}.`,
      },
    },
    reminders: {
      '24_hour': {
        eyebrow: 'Υπενθύμιση ραντεβού', heading: 'Το ραντεβού σας είναι αύριο',
        intro: (c) => `Γεια σας ${c.customerName}, σας υπενθυμίζουμε το ραντεβού σας στην επιχείρηση ${c.businessName}.`,
        subject: (c) => `${c.businessName}: υπενθύμιση αυριανού ραντεβού`,
        sms: (c) => `${c.businessName}: υπενθύμιση για ${c.dateText}, ${c.timeText}. Κωδικός ${c.bookingReference}.`,
      },
      '2_hour': {
        eyebrow: 'Υπενθύμιση ραντεβού', heading: 'Το ραντεβού σας είναι σε περίπου 2 ώρες',
        intro: (c) => `Γεια σας ${c.customerName}, το ραντεβού σας στην επιχείρηση ${c.businessName} πλησιάζει.`,
        subject: (c) => `${c.businessName}: υπενθύμιση ραντεβού σε 2 ώρες`,
        sms: (c) => `${c.businessName}: το ραντεβού σας είναι σήμερα στις ${c.timeText}. Κωδικός ${c.bookingReference}.`,
      },
    },
  },
  tr: {
    labels: {
      date: 'Tarih', time: 'Saat', professional: 'Uzman', services: 'Hizmetler', total: 'Toplam',
      reference: 'Rezervasyon kodu', viewStore: 'İşletme sayfasını görüntüle', appointmentService: 'Randevu hizmeti',
      transactionalFooter: 'Bu operasyonel mesaj mevcut bir randevu için gönderildi.',
    },
    events: {
      booking_confirmation: { eyebrow: 'Rezervasyon onaylandı', heading: 'Randevunuz onaylandı', intro: (c) => `Merhaba ${c.customerName}, ${c.businessName} randevunuz başarıyla oluşturuldu.`, subject: (c) => `${c.businessName}: rezervasyon onayı`, action: 'Rezervasyonu görüntüle', sms: (c) => `${c.businessName}: ${c.dateText} ${c.timeText} randevunuz onaylandı. Kod ${c.bookingReference}.` },
      owner_new_booking: { eyebrow: 'Yeni randevu', heading: 'Yeni bir randevu oluşturuldu', intro: (c) => `${c.customerName}, ${c.businessName} için yeni bir randevu oluşturdu.`, subject: (c) => `${c.businessName}: ${c.customerName} tarafından yeni randevu`, action: 'İşletme sayfasını aç', sms: (c) => `${c.businessName}: ${c.customerName} için ${c.dateText} ${c.timeText} yeni randevu.` },
      appointment_cancelled: { eyebrow: 'Randevu iptal edildi', heading: 'Randevunuz iptal edildi', intro: (c) => `${c.businessName} randevunuz artık aktif değil.`, subject: (c) => `${c.businessName}: randevu iptal edildi`, action: 'Yeni randevu al', danger: true, sms: (c) => `${c.businessName}: ${c.dateText} ${c.timeText} randevunuz iptal edildi. Kod ${c.bookingReference}.` },
      appointment_rescheduled: { eyebrow: 'Randevu güncellendi', heading: 'Randevu bilgileriniz değişti', intro: (c) => `${c.businessName} randevunuz güncellendi. Yeni tarih ve saati kontrol edin.`, subject: (c) => `${c.businessName}: randevu güncellendi`, action: 'Yeni bilgileri görüntüle', sms: (c) => `${c.businessName}: randevunuz ${c.dateText} ${c.timeText} olarak güncellendi. Kod ${c.bookingReference}.` },
      owner_appointment_rescheduled: { eyebrow: 'Randevu güncellendi', heading: 'Bir randevu yeniden planlandı', intro: (c) => `${c.customerName} randevusunun bilgileri değişti.`, subject: (c) => `${c.businessName}: randevu yeniden planlandı`, action: 'İşletme sayfasını aç', sms: (c) => `${c.businessName}: ${c.customerName} randevusu ${c.dateText} ${c.timeText} olarak değişti.` },
    },
    reminders: {
      '24_hour': { eyebrow: 'Randevu hatırlatması', heading: 'Randevunuz yarın', intro: (c) => `Merhaba ${c.customerName}, ${c.businessName} randevunuzu hatırlatıyoruz.`, subject: (c) => `${c.businessName}: yarınki randevu hatırlatması`, sms: (c) => `${c.businessName}: ${c.dateText} ${c.timeText} randevu hatırlatması. Kod ${c.bookingReference}.` },
      '2_hour': { eyebrow: 'Randevu hatırlatması', heading: 'Randevunuz yaklaşık 2 saat içinde', intro: (c) => `Merhaba ${c.customerName}, ${c.businessName} randevunuz yaklaşıyor.`, subject: (c) => `${c.businessName}: 2 saat içinde randevu`, sms: (c) => `${c.businessName}: randevunuz bugün ${c.timeText}. Kod ${c.bookingReference}.` },
    },
  },
  de: {
    labels: {
      date: 'Datum', time: 'Uhrzeit', professional: 'Mitarbeiter', services: 'Leistungen', total: 'Gesamt',
      reference: 'Buchungsreferenz', viewStore: 'Unternehmensseite ansehen', appointmentService: 'Terminleistung',
      transactionalFooter: 'Diese operative Nachricht wurde für einen bestehenden Termin gesendet.',
    },
    events: {
      booking_confirmation: { eyebrow: 'Buchung bestätigt', heading: 'Ihr Termin ist bestätigt', intro: (c) => `Hallo ${c.customerName}, Ihr Termin bei ${c.businessName} wurde erfolgreich gebucht.`, subject: (c) => `${c.businessName}: Buchungsbestätigung`, action: 'Buchungsdetails ansehen', sms: (c) => `${c.businessName}: Termin am ${c.dateText} um ${c.timeText} bestätigt. Ref ${c.bookingReference}.` },
      owner_new_booking: { eyebrow: 'Neuer Termin', heading: 'Ein neuer Termin wurde gebucht', intro: (c) => `${c.customerName} hat einen neuen Termin bei ${c.businessName} gebucht.`, subject: (c) => `${c.businessName}: neuer Termin von ${c.customerName}`, action: 'Unternehmensseite öffnen', sms: (c) => `${c.businessName}: neuer Termin von ${c.customerName} am ${c.dateText} um ${c.timeText}.` },
      appointment_cancelled: { eyebrow: 'Termin storniert', heading: 'Ihr Termin wurde storniert', intro: (c) => `Ihr Termin bei ${c.businessName} ist nicht mehr aktiv.`, subject: (c) => `${c.businessName}: Termin storniert`, action: 'Neuen Termin buchen', danger: true, sms: (c) => `${c.businessName}: Termin am ${c.dateText} um ${c.timeText} storniert. Ref ${c.bookingReference}.` },
      appointment_rescheduled: { eyebrow: 'Termin aktualisiert', heading: 'Ihre Termindaten wurden geändert', intro: (c) => `Ihr Termin bei ${c.businessName} wurde aktualisiert. Bitte prüfen Sie Datum und Uhrzeit.`, subject: (c) => `${c.businessName}: Termin aktualisiert`, action: 'Neue Details ansehen', sms: (c) => `${c.businessName}: Termin auf ${c.dateText} um ${c.timeText} verschoben. Ref ${c.bookingReference}.` },
      owner_appointment_rescheduled: { eyebrow: 'Termin aktualisiert', heading: 'Ein Termin wurde verschoben', intro: (c) => `Die Termindaten von ${c.customerName} wurden geändert.`, subject: (c) => `${c.businessName}: Termin verschoben`, action: 'Unternehmensseite öffnen', sms: (c) => `${c.businessName}: Termin von ${c.customerName} auf ${c.dateText} um ${c.timeText} verschoben.` },
    },
    reminders: {
      '24_hour': { eyebrow: 'Terminerinnerung', heading: 'Ihr Termin ist morgen', intro: (c) => `Hallo ${c.customerName}, dies ist eine Erinnerung an Ihren Termin bei ${c.businessName}.`, subject: (c) => `${c.businessName}: Terminerinnerung für morgen`, sms: (c) => `${c.businessName}: Erinnerung für ${c.dateText} um ${c.timeText}. Ref ${c.bookingReference}.` },
      '2_hour': { eyebrow: 'Terminerinnerung', heading: 'Ihr Termin ist in etwa 2 Stunden', intro: (c) => `Hallo ${c.customerName}, Ihr Termin bei ${c.businessName} beginnt bald.`, subject: (c) => `${c.businessName}: Terminerinnerung in 2 Stunden`, sms: (c) => `${c.businessName}: Ihr Termin ist heute um ${c.timeText}. Ref ${c.bookingReference}.` },
    },
  },
  es: {
    labels: {
      date: 'Fecha', time: 'Hora', professional: 'Profesional', services: 'Servicios', total: 'Total',
      reference: 'Referencia de reserva', viewStore: 'Ver página del negocio', appointmentService: 'Servicio de cita',
      transactionalFooter: 'Este mensaje operativo se envió por una cita existente.',
    },
    events: {
      booking_confirmation: { eyebrow: 'Reserva confirmada', heading: 'Tu cita está confirmada', intro: (c) => `Hola ${c.customerName}, tu cita en ${c.businessName} se ha reservado correctamente.`, subject: (c) => `${c.businessName}: confirmación de reserva`, action: 'Ver detalles de la reserva', sms: (c) => `${c.businessName}: cita confirmada para ${c.dateText} a las ${c.timeText}. Ref ${c.bookingReference}.` },
      owner_new_booking: { eyebrow: 'Nueva cita', heading: 'Se ha reservado una nueva cita', intro: (c) => `${c.customerName} creó una nueva cita en ${c.businessName}.`, subject: (c) => `${c.businessName}: nueva cita de ${c.customerName}`, action: 'Abrir página del negocio', sms: (c) => `${c.businessName}: nueva cita de ${c.customerName}, ${c.dateText} ${c.timeText}.` },
      appointment_cancelled: { eyebrow: 'Cita cancelada', heading: 'Tu cita ha sido cancelada', intro: (c) => `Tu cita en ${c.businessName} ya no está activa.`, subject: (c) => `${c.businessName}: cita cancelada`, action: 'Reservar otra cita', danger: true, sms: (c) => `${c.businessName}: cita del ${c.dateText} a las ${c.timeText} cancelada. Ref ${c.bookingReference}.` },
      appointment_rescheduled: { eyebrow: 'Cita actualizada', heading: 'Los datos de tu cita cambiaron', intro: (c) => `Tu cita en ${c.businessName} se ha actualizado. Revisa la nueva fecha y hora.`, subject: (c) => `${c.businessName}: cita actualizada`, action: 'Ver nuevos detalles', sms: (c) => `${c.businessName}: cita actualizada al ${c.dateText} a las ${c.timeText}. Ref ${c.bookingReference}.` },
      owner_appointment_rescheduled: { eyebrow: 'Cita actualizada', heading: 'Se reprogramó una cita', intro: (c) => `Los datos de la cita de ${c.customerName} han cambiado.`, subject: (c) => `${c.businessName}: cita reprogramada`, action: 'Abrir página del negocio', sms: (c) => `${c.businessName}: cita de ${c.customerName} movida al ${c.dateText} a las ${c.timeText}.` },
    },
    reminders: {
      '24_hour': { eyebrow: 'Recordatorio de cita', heading: 'Tu cita es mañana', intro: (c) => `Hola ${c.customerName}, te recordamos tu cita en ${c.businessName}.`, subject: (c) => `${c.businessName}: recordatorio para mañana`, sms: (c) => `${c.businessName}: recordatorio para ${c.dateText} a las ${c.timeText}. Ref ${c.bookingReference}.` },
      '2_hour': { eyebrow: 'Recordatorio de cita', heading: 'Tu cita es dentro de unas 2 horas', intro: (c) => `Hola ${c.customerName}, tu cita en ${c.businessName} será pronto.`, subject: (c) => `${c.businessName}: recordatorio en 2 horas`, sms: (c) => `${c.businessName}: tu cita es hoy a las ${c.timeText}. Ref ${c.bookingReference}.` },
    },
  },
};

export function normalizeCommunicationLocale(value: unknown): CommunicationLocale {
  const candidate = String(value || '').toLowerCase().split(/[-_]/)[0];
  return candidate === 'el' || candidate === 'tr' || candidate === 'de' || candidate === 'es'
    ? candidate
    : 'en';
}

export function formatAppointmentDateTime(
  startTime: string,
  timezone: string,
  locale: CommunicationLocale,
): { dateText: string; timeText: string } {
  const date = new Date(startTime);
  const localeTag = locale === 'el' ? 'el-GR' : locale === 'tr' ? 'tr-TR' : locale === 'de' ? 'de-DE' : locale === 'es' ? 'es-ES' : 'en-GB';
  return {
    dateText: new Intl.DateTimeFormat(localeTag, {
      timeZone: timezone || 'UTC', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }).format(date),
    timeText: new Intl.DateTimeFormat(localeTag, {
      timeZone: timezone || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date),
  };
}

export function renderAppointmentEvent(
  eventType: AppointmentEventType,
  context: AppointmentCommunicationContext,
  locale: CommunicationLocale,
): RenderedCommunication {
  const copy = COPIES[locale] || COPIES.en;
  const event = copy.events[eventType];
  return buildCommunication({
    context,
    labels: copy.labels,
    eyebrow: event.eyebrow,
    heading: event.heading,
    intro: event.intro(context),
    subject: event.subject(context),
    actionLabel: event.action,
    sms: event.sms(context),
    danger: event.danger,
  });
}

export function renderReminder(
  reminderType: ReminderType,
  context: AppointmentCommunicationContext,
  locale: CommunicationLocale,
): RenderedCommunication {
  const copy = COPIES[locale] || COPIES.en;
  const reminder = copy.reminders[reminderType];
  return buildCommunication({
    context,
    labels: copy.labels,
    eyebrow: reminder.eyebrow,
    heading: reminder.heading,
    intro: reminder.intro(context),
    subject: reminder.subject(context),
    actionLabel: copy.labels.viewStore,
    sms: reminder.sms(context),
  });
}

function buildCommunication(input: {
  context: AppointmentCommunicationContext;
  labels: Copy['labels'];
  eyebrow: string;
  heading: string;
  intro: string;
  subject: string;
  actionLabel: string;
  sms: string;
  danger?: boolean;
}): RenderedCommunication {
  const { context: c, labels } = input;
  const accent = input.danger ? '#dc2626' : '#7c3aed';
  const currency = (c.currency || 'EUR').toUpperCase();
  const formattedTotal = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(c.totalPrice || 0);
  const serviceRows = c.services.length
    ? c.services.map((service) => `<div style="padding:8px 0;border-bottom:1px solid #ececf2;">${escapeHtml(service)}</div>`).join('')
    : `<div style="padding:8px 0;color:#6b7280;">${escapeHtml(labels.appointmentService)}</div>`;
  const logo = c.logoUrl
    ? `<img src="${escapeHtml(c.logoUrl)}" alt="${escapeHtml(c.businessName)}" width="58" height="58" style="display:block;width:58px;height:58px;border-radius:16px;object-fit:cover;margin-bottom:18px;">`
    : '';
  const action = c.storeUrl
    ? `<a href="${escapeHtml(c.storeUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 20px;border-radius:11px;font-weight:700;">${escapeHtml(input.actionLabel)}</a>`
    : '';
  const text = [
    input.heading,
    input.intro,
    `${labels.date}: ${c.dateText}.`,
    `${labels.time}: ${c.timeText}.`,
    `${labels.professional}: ${c.professionalName}.`,
    c.services.length ? `${labels.services}: ${c.services.join(', ')}.` : '',
    `${labels.reference}: ${c.bookingReference}.`,
    c.address ? c.address : '',
    c.phone ? c.phone : '',
  ].filter(Boolean).join(' ');
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f4f5f8;font-family:Inter,Arial,sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;padding:32px 14px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(17,24,39,.08);">
      <div style="background:linear-gradient(135deg,#0f1024 0%,#221647 60%,#4c1d95 100%);padding:30px;color:#fff;">
        ${logo}
        <div style="font-size:12px;color:#c4b5fd;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;">${escapeHtml(input.eyebrow)}</div>
        <h1 style="margin:10px 0 0;font-size:29px;line-height:1.22;">${escapeHtml(input.heading)}</h1>
      </div>
      <div style="padding:30px;">
        <p style="margin:0 0 22px;line-height:1.75;color:#374151;">${escapeHtml(input.intro)}</p>
        <div style="background:#fafafa;border:1px solid #ececf2;border-radius:16px;padding:20px;margin-bottom:24px;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(labels.date)}</div>
          <div style="font-weight:800;margin-top:5px;">${escapeHtml(c.dateText)}</div>
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-top:16px;">${escapeHtml(labels.time)}</div>
          <div style="font-size:26px;font-weight:900;margin-top:5px;color:${accent};">${escapeHtml(c.timeText)}</div>
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-top:16px;">${escapeHtml(labels.professional)}</div>
          <div style="font-weight:800;margin-top:5px;">${escapeHtml(c.professionalName)}</div>
        </div>
        <h2 style="font-size:16px;margin:0 0 8px;">${escapeHtml(labels.services)}</h2>
        <div style="margin-bottom:20px;">${serviceRows}</div>
        <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid #ececf2;padding-top:17px;margin-bottom:22px;">
          <span style="color:#6b7280;">${escapeHtml(labels.total)}</span>
          <strong>${escapeHtml(formattedTotal)}</strong>
        </div>
        <p style="font-size:13px;color:#6b7280;line-height:1.7;">
          ${escapeHtml(labels.reference)}: <strong>${escapeHtml(c.bookingReference)}</strong><br>
          ${c.address ? `${escapeHtml(c.address)}<br>` : ''}
          ${c.phone ? escapeHtml(c.phone) : ''}
        </p>
        ${action}
      </div>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:11px;line-height:1.55;margin:17px 0 0;">${escapeHtml(labels.transactionalFooter)} Powered by Velliqo.</p>
  </div>
</body>
</html>`;
  return { subject: input.subject, text, html, sms: trimSms(input.sms, c.storeUrl) };
}

export function resolveTenantFrom(globalFrom: string, businessName: string): string {
  const value = String(globalFrom || '').trim();
  const match = value.match(/<([^>]+)>/);
  const email = (match?.[1] || value).trim();
  if (!email.includes('@')) return value;
  const safeName = String(businessName || 'Velliqo').replace(/[<>\r\n"]/g, '').trim().slice(0, 70);
  return `${safeName || 'Velliqo'} via Velliqo <${email}>`;
}

export function normalizePhone(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D/g, '')}`
    : raw.replace(/\D/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : '';
}

export function retryAt(attempt: number): string {
  const minutes = Math.min(60, Math.max(1, 2 ** Math.max(0, attempt - 1)));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  idempotencyKey: string;
}): Promise<string> {
  if (!input.apiKey || !input.from) throw codedError('email_provider_not_configured', 'Resend email delivery is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo || undefined,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw codedError('email_delivery_failed', `Resend ${response.status}: ${String(body?.message || JSON.stringify(body)).slice(0, 1800)}`);
  return String(body?.id || '');
}

export async function sendTwilioSms(input: {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  fromNumber?: string;
  to: string;
  body: string;
  statusCallbackUrl?: string;
}): Promise<string> {
  if (!input.accountSid || !input.authToken || (!input.messagingServiceSid && !input.fromNumber)) {
    throw codedError('sms_provider_not_configured', 'Twilio SMS delivery is not configured');
  }
  const form = new URLSearchParams({ To: input.to, Body: input.body.slice(0, 1500) });
  if (input.messagingServiceSid) form.set('MessagingServiceSid', input.messagingServiceSid);
  else if (input.fromNumber) form.set('From', input.fromNumber);
  if (input.statusCallbackUrl) form.set('StatusCallback', input.statusCallbackUrl);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${input.accountSid}:${input.authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw codedError('sms_delivery_failed', `Twilio ${response.status}: ${String(body?.message || JSON.stringify(body)).slice(0, 1800)}`);
  return String(body?.sid || '');
}

export function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as any).code || 'delivery_error') : 'delivery_error';
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function codedError(code: string, message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function trimSms(message: string, storeUrl: string): string {
  const suffix = storeUrl ? ` ${storeUrl}` : '';
  return `${message}${suffix}`.replace(/\s+/g, ' ').trim().slice(0, 1500);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
