import fs from 'node:fs';

const checks = [
  ['src/pages/staff/EmployeeDashboard.tsx', 'id="staff-main"', 'Staff workspace must expose a stable main landmark'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'staffPortal.accessibility.skipToWorkspace', 'Staff workspace must provide a keyboard skip link'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'md:hidden" aria-label={t(\'staffPortal.mobileNav.label\')}', 'Staff app must expose the compact mobile bottom navigation'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'hidden items-center gap-2 md:flex', 'Desktop-only header actions must not overcrowd the mobile header'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'headerToolbar={false}', 'Staff calendar must use the responsive Velliqo toolbar rather than the overflowing FullCalendar toolbar'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'staff-calendar-shell', 'Staff calendar must use the dedicated responsive visual shell'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'CalendarViewButton', 'Staff calendar must expose touch-friendly Day, Week and List controls'],
  ['src/pages/staff/EmployeeDashboard.tsx', "side={isMobile ? 'bottom' : 'right'}", 'Appointment details must become a mobile bottom sheet'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'grid-rows-[auto_minmax(0,1fr)_auto]', 'Appointment creation must keep header, scroll body and actions independently reachable'],
  ['src/pages/staff/EmployeeDashboard.tsx', 'safe-bottom border-t bg-white p-4', 'Appointment creation actions must remain above the mobile safe area'],
  ['src/components/staff/StaffProfileSheet.tsx', "side={isMobile ? 'bottom' : 'right'}", 'Staff profile must use a bottom sheet on mobile and side sheet on desktop'],
  ['src/components/staff/StaffProfileSheet.tsx', 'max-h-[92dvh]', 'Staff profile sheet must remain usable on short mobile viewports'],
];

const errors = [];
for (const [file, needle, message] of checks) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(needle)) errors.push(`${file}: ${message}`);
}

const css = fs.readFileSync('src/index.css', 'utf8');
for (const needle of [
  '.staff-calendar-shell .fc',
  '.staff-event-confirmed',
  '.staff-event-in_progress',
  '@media (max-width: 767px)',
]) {
  if (!css.includes(needle)) errors.push(`src/index.css: missing staff UX style ${needle}`);
}

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const source = fs.readFileSync(`src/i18n/locales/${locale}.json`, 'utf8');
  for (const needle of ['"mobileNav"', '"scheduleTitle"', '"skipToWorkspace"']) {
    if (!source.includes(needle)) errors.push(`src/i18n/locales/${locale}.json: missing ${needle}`);
  }
}

if (errors.length) {
  console.error('Phase 11D Staff UX consistency validation failed.');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Phase 11D Staff UX consistency validation passed.');
console.log('Validated mobile navigation, responsive calendar controls, mobile sheets, safe form actions and staff accessibility.');
