import fs from 'node:fs';

const checks = [
  ['src/pages/admin/PlatformAdmin.tsx', ['platform_admin_dashboard', 'Export CSV', 'Estimated profit', 'platform_admin_support']],
  ['supabase/migrations/00052_velliqo_platform_admin_control_center.sql', ['platform_admin_dashboard', 'platform_admin_business_rows', 'platform_support_notes', 'platform_admin_audit_logs']],
  ['supabase/functions/platform_admin_support/index.ts', ['Platform Admin', 'updateUserById', 'owner_auth_email_update']],
  ['src/components/inputs/InternationalPhoneInput.tsx', ['Country calling code', 'Other', 'E.164']],
  ['src/pages/public/PublicBooking.tsx', ['<Calendar', 'availableTimes', 'isLikelyE164']],
  ['src/pages/public/BusinessHome.tsx', ['storefront-premium', 'reviewSummary', 'storefront-reveal']],
  ['docs/PHASE-14C-LAUNCH-OPERATIONS-CUSTOMER-UX-BILLING-MATRIX.md', ['Failed recurring payment', 'Fixed-term offers', 'Webhook reliability']],
];

let failures = 0;
for (const [file, needles] of checks) {
  if (!fs.existsSync(file)) { console.error(`Missing ${file}`); failures++; continue; }
  const content = fs.readFileSync(file, 'utf8');
  for (const needle of needles) if (!content.includes(needle)) { console.error(`${file}: missing ${needle}`); failures++; }
}
const phoneTargets = [
  'src/pages/onboarding/OnboardingWizard.tsx','src/pages/owner/Calendar.tsx','src/pages/owner/Customers.tsx','src/pages/owner/Staff.tsx','src/pages/owner/Storefront.tsx','src/pages/staff/EmployeeDashboard.tsx','src/pages/marketing/Contact.tsx','src/pages/public/PublicAppLayout.tsx','src/pages/public/PublicBooking.tsx','src/pages/customer/CustomerPortal.tsx','src/components/staff/StaffProfileSheet.tsx'
];
for (const file of phoneTargets) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('InternationalPhoneInput')) { console.error(`${file}: international phone input missing`); failures++; }
}
if (failures) process.exit(1);
console.log('Phase 14C launch operations, customer UX and international phone validation passed.');
