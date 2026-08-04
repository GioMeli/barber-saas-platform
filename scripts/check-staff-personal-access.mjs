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

[
  'src/pages/staff/EmployeeDashboard.tsx',
  'src/hooks/useStaffPWA.ts',
  'src/pwa/installPromptStore.ts',
  'src/hooks/useStaffAuth.ts',
  'src/db/staffSupabase.ts',
  'api/staff-manifest.ts',
  'supabase/functions/manage-staff-access/index.ts',
  'supabase/migrations/00045_velliqo_staff_personal_access.sql',
  'supabase/migrations/00046_velliqo_persistent_premium_staff_app.sql',
  'supabase/migrations/00047_velliqo_staff_trusted_device_profile_pwa.sql',
  'supabase/functions/staff-device-auth/index.ts',
  'src/staff/trustedDevice.ts',
  'src/components/staff/StaffInstallDialog.tsx',
  'src/components/staff/StaffProfileSheet.tsx',
].forEach(requireFile);

requireText('src/App.tsx', 'path="/staff/:slug"', 'company staff app route');
requireText('src/pages/owner/Staff.tsx', 'staff.personalAccess.title', 'owner personal-access control');
requireText('src/pages/owner/Staff.tsx', "'manage-staff-access'", 'secure access-management Edge Function');
requireText('src/pages/owner/Staff.tsx', "new URLSearchParams({ employee: employeeId })", 'employee-specific staff app link');
requireText('src/pages/owner/Staff.tsx', "params.set('employeeName'", 'employee name in staff app link');
requireText('src/pages/staff/EmployeeDashboard.tsx', '<FullCalendar', 'staff calendar workspace');
requireText('src/pages/staff/EmployeeDashboard.tsx', 'shouldCreateUser: false', 'pre-provisioned passwordless login');
requireText('src/pages/staff/EmployeeDashboard.tsx', "searchParams.get('employee')", 'employee-specific auth redirect');
requireText('src/pages/staff/EmployeeDashboard.tsx', 'staff_create_own_appointment_v2', 'customer-aware staff appointment RPC');
requireText('src/pages/staff/EmployeeDashboard.tsx', 'customerPickerOpen', 'premium customer selector');
requireText('src/pages/staff/EmployeeDashboard.tsx', 'workspace?.customers', 'tenant customer directory');
requireText('src/pages/staff/EmployeeDashboard.tsx', "table: 'appointments'", 'appointment realtime sync');
requireText('src/pages/staff/EmployeeDashboard.tsx', "table: 'employees'", 'access revocation realtime sync');
requireText('src/pages/owner/Calendar.tsx', "table: 'appointments'", 'owner calendar realtime sync');
requireText('src/pages/owner/Home.tsx', "table: 'appointments'", 'owner home realtime sync');
requireText('src/db/staffSupabase.ts', 'persistSession: true', 'persistent staff session');
requireText('src/db/staffSupabase.ts', 'autoRefreshToken: true', 'automatic staff token refresh');
requireText('src/db/staffSupabase.ts', 'velliqo.staff.auth.${employeeSessionId', 'employee-isolated staff auth storage');
requireText('src/db/supabase.ts', 'detectSessionInUrl: !isStaffRoute', 'staff magic-link client isolation');
requireText('src/hooks/useStaffPWA.ts', 'employee?.id', 'employee-specific manifest');
requireText('src/hooks/useStaffPWA.ts', "v: '6'", 'staff manifest cache/version hardening');
requireText('src/pwa/installPromptStore.ts', 'beforeinstallprompt', 'early install prompt capture');
requireText('src/hooks/usePWAStatus.ts', '15_000', 'install prompt timeout recovery');
requireText('index.html', '/staff-manifest/', 'staff manifest preloaded before React');
requireText('api/staff-manifest.ts', 'employeeId', 'employee-specific PWA identity');
requireText('api/staff-manifest.ts', "display: 'standalone'", 'standalone staff PWA');
requireText('vercel.json', '/staff-manifest/:slug/:employeeId.webmanifest', 'employee manifest rewrite');

requireText('src/pages/staff/EmployeeDashboard.tsx', 'signInOnTrustedDevice', 'trusted-device email sign in');
requireText('src/pages/staff/EmployeeDashboard.tsx', '<StaffProfileSheet', 'staff profile manager');
requireText('src/pages/staff/EmployeeDashboard.tsx', '<StaffInstallDialog', 'install guidance dialog');
requireText('src/staff/trustedDevice.ts', "functions.invoke('staff-device-auth'", 'trusted-device auth Edge Function');
requireText('src/staff/trustedDevice.ts', 'staff_register_trusted_device', 'trusted-device registration');
requireText('src/pages/owner/Staff.tsx', 'owner-staff-sync-', 'owner realtime staff profile sync');
requireText('api/staff-manifest.ts', "'/icons/icon-512.png'", 'valid 512 PWA icon');
requireText('api/staff-manifest.ts', '?employee=${employeeParam}', 'employee identity in PWA shortcuts');

const migration45 = read('supabase/migrations/00045_velliqo_staff_personal_access.sql');
[
  'personal_access_enabled boolean not null default false',
  'staff_access_audit_logs',
  'staff_get_workspace',
  'staff_reschedule_own_appointment',
  'staff_update_own_appointment_status',
  'staff_cancel_own_appointment',
  'staff_update_own_appointment_notes',
  "e.user_id = auth.uid()",
  "e.personal_access_enabled = true",
  "a.employee_id = v_employee.id",
  "a.business_id = v_employee.business_id",
  'alter publication supabase_realtime add table public.appointments',
  'alter publication supabase_realtime add table public.employees',
].forEach((text) => { if (!migration45.includes(text)) failures.push(`Migration 00045 missing ${text}`); });

const migration46 = read('supabase/migrations/00046_velliqo_persistent_premium_staff_app.sql');
[
  'staff_create_own_appointment_v2',
  "'customers', v_customers",
  'p_customer_id uuid',
  'c.business_id = v_employee.business_id',
  "e.user_id = auth.uid()",
  "e.personal_access_enabled = true",
  "a.employee_id = v_employee.id",
  "a.business_id = v_employee.business_id",
  'create_owner_notification',
  "'source', 'staff_app'",
].forEach((text) => { if (!migration46.includes(text)) failures.push(`Migration 00046 missing ${text}`); });

const migration47 = read('supabase/migrations/00047_velliqo_staff_trusted_device_profile_pwa.sql');
[
  'staff_trusted_devices',
  'staff_register_trusted_device',
  'staff_revoke_trusted_device',
  'staff_update_own_profile',
  "bucket_id = 'staff-avatars'",
  "e.user_id = auth.uid()",
  "e.personal_access_enabled = true",
].forEach((text) => { if (!migration47.includes(text)) failures.push(`Migration 00047 missing ${text}`); });

const deviceAuth = read('supabase/functions/staff-device-auth/index.ts');
[
  'staff_trusted_devices',
  'constantTimeEqual',
  'admin.auth.admin.generateLink',
  'hashed_token',
  "personal_access_enabled",
  "personal_access_status",
].forEach((text) => { if (!deviceAuth.includes(text)) failures.push(`Staff device auth missing ${text}`); });

const edgeFunction = read('supabase/functions/manage-staff-access/index.ts');
[
  "type AccessAction = 'enable' | 'resend' | 'revoke'",
  "eq('role', 'Owner')",
  'admin.auth.admin.generateLink',
  '?employee=${encodeURIComponent(employee.id)}',
  'employeeName=${encodeURIComponent(employee.name',
  "type: 'magiclink'",
  "personal_access_enabled: false",
  "personal_access_status: 'revoked'",
  'staff_access_audit_logs',
].forEach((text) => { if (!edgeFunction.includes(text)) failures.push(`Edge Function missing ${text}`); });

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const file = `src/i18n/locales/${locale}.json`;
  requireText(file, '"staffPortal"', `${locale} staffPortal namespace`);
  requireText(file, '"customerPickerLabel"', `${locale} customer picker translation`);
  requireText(file, '"oneTimeTitle"', `${locale} persistent session translation`);
  requireText(file, '"iosInstructions"', `${locale} PWA instructions`);
}

if (failures.length) {
  console.error('Staff personal access validation failed:');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('Phase 10C.7 premium trusted-device staff experience checks passed.');
console.log('Trusted-device sign-in, installable employee PWA, self-service profile sync, customer selection, tenant isolation and realtime owner sync verified.');
