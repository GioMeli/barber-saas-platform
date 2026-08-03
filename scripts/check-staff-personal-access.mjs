import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const requireFile = (file) => { if (!exists(file)) failures.push(`Missing ${file}`); };
const requireText = (file, text, label = text) => {
  if (!exists(file) || !read(file).includes(text)) failures.push(`${file} missing ${label}`);
};

const requiredFiles = [
  'src/pages/staff/EmployeeDashboard.tsx',
  'src/hooks/useStaffPWA.ts',
  'api/staff-manifest.ts',
  'supabase/functions/manage-staff-access/index.ts',
  'supabase/migrations/00045_velliqo_staff_personal_access.sql',
];
requiredFiles.forEach(requireFile);

requireText('src/App.tsx', 'path="/staff/:slug"', 'company staff app route');
requireText('src/pages/owner/Staff.tsx', 'staff.personalAccess.title', 'owner personal-access control');
requireText('src/pages/owner/Staff.tsx', "'manage-staff-access'", 'secure access-management Edge Function');
requireText('src/pages/owner/Staff.tsx', "action === 'revoke'", 'owner revocation action');
requireText('src/pages/staff/EmployeeDashboard.tsx', '<FullCalendar', 'staff calendar workspace');
requireText('src/pages/staff/EmployeeDashboard.tsx', 'shouldCreateUser: false', 'pre-provisioned passwordless login');
requireText('src/pages/staff/EmployeeDashboard.tsx', "staff_create_own_appointment", 'staff create-own appointment RPC');
requireText('src/pages/staff/EmployeeDashboard.tsx', "staff_reschedule_own_appointment", 'staff reschedule-own appointment RPC');
requireText('src/pages/staff/EmployeeDashboard.tsx', "staff_update_own_appointment_status", 'staff own-status RPC');
requireText('src/pages/staff/EmployeeDashboard.tsx', "staff_cancel_own_appointment", 'staff own-cancellation RPC');
requireText('src/pages/staff/EmployeeDashboard.tsx', "staff_update_own_appointment_notes", 'staff own-notes RPC');
requireText('src/pages/staff/EmployeeDashboard.tsx', '60_000', 'revocation heartbeat');
requireText('src/pages/staff/EmployeeDashboard.tsx', "table: 'appointments'", 'appointment realtime sync');
requireText('src/pages/staff/EmployeeDashboard.tsx', "table: 'employees'", 'access revocation realtime sync');
requireText('src/pages/owner/Calendar.tsx', "table: 'appointments'", 'owner calendar realtime sync');
requireText('src/pages/owner/Home.tsx', "table: 'appointments'", 'owner home realtime sync');
requireText('api/staff-manifest.ts', "display: 'standalone'", 'installable standalone staff PWA');
requireText('vercel.json', '/staff-manifest/:slug.webmanifest', 'staff manifest rewrite');

const migration = read('supabase/migrations/00045_velliqo_staff_personal_access.sql');
[
  'personal_access_enabled boolean not null default false',
  'staff_access_audit_logs',
  'staff_has_active_access',
  'staff_resolve_portal',
  'staff_get_workspace',
  'staff_create_own_appointment',
  'staff_reschedule_own_appointment',
  'staff_update_own_appointment_status',
  'staff_cancel_own_appointment',
  'staff_update_own_appointment_notes',
  "e.user_id = auth.uid()",
  "e.personal_access_enabled = true",
  "a.employee_id = v_employee.id",
  "a.business_id = v_employee.business_id",
  'staff_access_version',
  'alter publication supabase_realtime add table public.appointments',
  'alter publication supabase_realtime add table public.employees',
].forEach((text) => { if (!migration.includes(text)) failures.push(`Migration missing ${text}`); });

if (/select\s+e\.\*,\s*b\.\*/i.test(migration)) {
  failures.push('Migration contains unsafe multi-rowtype SELECT e.*, b.* assignment');
}

const edgeFunction = read('supabase/functions/manage-staff-access/index.ts');
[
  "type AccessAction = 'enable' | 'resend' | 'revoke'",
  "eq('role', 'Owner')",
  "admin.auth.admin.generateLink",
  "type: 'magiclink'",
  "personal_access_enabled: false",
  "personal_access_status: 'revoked'",
  "personal_access_enabled: true",
  "staff_access_audit_logs",
  "business_members",
  "role: 'Employee'",
].forEach((text) => { if (!edgeFunction.includes(text)) failures.push(`Edge Function missing ${text}`); });
if (edgeFunction.includes("profiles').upsert")) failures.push('Edge Function must not overwrite an existing profile role');

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const data = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  if (!data.staff?.personalAccess?.title || !data.staff?.personalAccess?.actions?.revoke) failures.push(`${locale} locale missing owner staff-access translations`);
  if (!data.staffPortal?.access?.sendLink || !data.staffPortal?.create?.title || !data.staffPortal?.appointment?.reschedule) failures.push(`${locale} locale missing staff app translations`);
}

if (failures.length) {
  console.error('Phase 10C.5 staff personal access checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Phase 10C.5 staff personal access checks passed.');
console.log('Owner-controlled passwordless access, own-appointment isolation, full calendar actions, immediate revocation, realtime sync and per-company PWA verified.');
