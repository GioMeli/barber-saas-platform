import fs from 'node:fs';

const checks = [
  ['src/components/layouts/OwnerDashboardLayout.tsx', 'id="owner-main-content"', 'Owner main landmark must expose the skip-link target'],
  ['src/components/layouts/OwnerDashboardLayout.tsx', 'ownerExperience.accessibility.skipToContent', 'Owner shell must provide a keyboard skip link'],
  ['src/components/layouts/OwnerDashboardLayout.tsx', 'aria-live="polite"', 'Owner shell must announce route changes'],
  ['src/components/training/TrainingCertificationLibrary.tsx', "embedded ? 'pb-4' : 'app-page pb-10'", 'Training must use the shared Owner responsive page container'],
  ['src/pages/owner/Storefront.tsx', 'sticky-owner-tabs', 'Storefront sticky navigation must respect the Owner top bar'],
  ['src/pages/owner/Reports.tsx', 'sticky-owner-tabs', 'Reports sticky navigation must respect the Owner top bar'],
  ['src/pages/owner/Storefront.tsx', 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]', 'Storefront save bar must sit above mobile Owner navigation'],
  ['src/pages/owner/Storefront.tsx', 'lg:left-[264px]', 'Storefront save bar must align with the desktop Owner sidebar only when the sidebar exists'],
  ['src/pages/owner/Customers.tsx', 'responsive-tabs', 'Customer workspace tabs must remain usable in narrow layouts'],
  ['src/pages/owner/Products.tsx', 'responsive-tabs', 'Product workspace tabs must remain usable in narrow layouts'],
  ['src/pages/owner/Home.tsx', 'className="app-page-actions"', 'Home header actions must use the shared responsive action group'],
  ['src/pages/owner/Finance.tsx', 'className="app-page-actions"', 'Finance header actions must use the shared responsive action group'],
  ['src/pages/owner/Reports.tsx', 'className="app-page-actions"', 'Reports header actions must use the shared responsive action group'],
  ['src/pages/owner/Customers.tsx', 'owner-dialog-footer', 'Customer form must keep primary actions reachable while scrolling'],
  ['src/pages/owner/Services.tsx', 'owner-dialog-footer', 'Service form must keep primary actions reachable while scrolling'],
  ['src/pages/owner/Products.tsx', 'owner-dialog-footer', 'Product form must keep primary actions reachable while scrolling'],
  ['src/pages/owner/Staff.tsx', 'sticky bottom-0 border-t', 'Staff form must keep primary actions reachable while scrolling'],
  ['src/pages/owner/Calendar.tsx', 'sticky bottom-0 border-t', 'Appointment form must keep primary actions reachable while scrolling'],
];

const errors = [];
for (const [file, needle, message] of checks) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(needle)) errors.push(`${file}: ${message}`);
}

const css = fs.readFileSync('src/index.css', 'utf8');
for (const cls of ['.sticky-owner-tabs', '.owner-form-dialog', '.owner-dialog-footer']) {
  if (!css.includes(cls)) errors.push(`src/index.css: missing ${cls}`);
}

if (errors.length) {
  console.error('Phase 11C Owner UX consistency validation failed.');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Phase 11C Owner UX consistency validation passed.');
console.log('Validated responsive actions, accessible navigation, sticky workspace tabs, and reachable form actions.');
