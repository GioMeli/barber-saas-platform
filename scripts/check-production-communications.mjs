import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readUtf16 = (file) => fs.readFileSync(path.join(root, file)).toString('utf16le');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`Phase 13A production communications validation failed.\n- ${message}`);
    process.exit(1);
  }
};

const migration = read('supabase/migrations/00050_velliqo_production_communications.sql');
const shared = read('supabase/functions/_shared/communication.ts');
const appointmentWorker = read('supabase/functions/process_appointment_notifications/index.ts');
const reminderWorker = read('supabase/functions/process_reminder_jobs/index.ts');
const resendWebhook = read('supabase/functions/resend-marketing-webhook/index.ts');
const twilioWebhook = read('supabase/functions/twilio-marketing-webhook/index.ts');
const storefront = read('src/pages/owner/Storefront.tsx');
const marketing = read('src/pages/owner/Marketing.tsx');
const types = readUtf16('src/db/database.types.ts');
const envExample = read('supabase/functions/.env.example');

assert(migration.includes('transactional_email_enabled') && migration.includes('transactional_sms_enabled'), 'business communication entitlements are missing');
assert(migration.includes("check (channel in ('email', 'sms'))"), 'transactional queue is not channel-aware');
assert(migration.includes('notification_delivery_events'), 'transactional provider event audit table is missing');
assert(migration.includes('velliqo_communications_enabled'), 'global communications safety gate is missing');
assert(migration.includes('process-appointment-notifications') && migration.includes('process-appointment-reminders'), 'communication cron workers are missing');
assert(shared.includes('renderAppointmentEvent') && shared.includes('renderReminder'), 'shared professional templates are missing');
assert(['en', 'el', 'tr', 'de', 'es'].every((locale) => shared.includes(`${locale}: {`)), 'one or more supported communication locales are missing');
assert(shared.includes('sendResendEmail') && shared.includes('sendTwilioSms'), 'provider delivery helpers are missing');
assert(appointmentWorker.includes("job.channel === 'email'") && appointmentWorker.includes('sendTwilioSms'), 'transactional worker does not support both channels');
assert(reminderWorker.includes(".lte('available_at', now)") && reminderWorker.includes('sendTwilioSms'), 'reminder retry/SMS processing is incomplete');
assert(appointmentWorker.includes('Recovered stale processing lock') && reminderWorker.includes('Recovered stale processing lock'), 'stale queue recovery is missing');
assert(resendWebhook.includes('notification_delivery_events') && resendWebhook.includes("kind: 'transactional'"), 'Resend transactional callback handling is missing');
assert(twilioWebhook.includes('notification_delivery_events') && twilioWebhook.includes("kind: 'transactional'"), 'Twilio transactional callback handling is missing');
assert(marketing.includes('transactional_email_enabled') && marketing.includes('sms_reminders_enabled'), 'Marketing appointment communication controls are missing');
assert(marketing.includes('communication_reply_to_email') && marketing.includes('communication_locale'), 'Marketing tenant language/reply-to controls are missing');
assert(marketing.includes('marketing-appointment-communications'), 'Marketing appointment communication tour target is missing');
assert(!storefront.includes('checked={bookingForm.transactional_email_enabled}'), 'Storefront still duplicates communication automation controls');
assert(storefront.includes('/dashboard/marketing?tab=automations'), 'Storefront does not direct owners to the communication automation workspace');
assert(types.includes('transactional_email_enabled') && types.includes('communication_reply_to_email'), 'generated database types are not aligned');
assert(envExample.includes('NOTIFICATION_FUNCTION_SECRET') && envExample.includes('REMINDER_FUNCTION_SECRET'), 'communication worker secret documentation is missing');

console.log('Phase 13A production email/SMS communications validation passed.');
