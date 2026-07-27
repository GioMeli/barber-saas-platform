import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(relativePath, snippets) {
  const source = read(relativePath);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${relativePath}: missing ${JSON.stringify(snippet)}`);
    }
  }
}

function forbidText(relativePath, snippets) {
  const source = read(relativePath);
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      failures.push(`${relativePath}: forbidden ${JSON.stringify(snippet)}`);
    }
  }
}

requireText('src/components/layouts/OwnerDashboardLayout.tsx', [
  'lg:block',
  'lg:pl-[264px]',
  'OwnerMobileNavigation',
  'pb-[calc(6.25rem+env(safe-area-inset-bottom))]',
]);

requireText('src/components/layouts/owner-shell/OwnerMobileNavigation.tsx', [
  "const MOBILE_NAV_KEYS = ['home', 'calendar', 'sales', 'ai']",
  'grid-cols-5',
  'safe-bottom fixed',
  'onOpenMenu',
]);

requireText('src/components/layouts/owner-shell/OwnerTopBar.tsx', [
  'lg:hidden',
  'bg-violet-600',
  'to="/dashboard/ai"',
  'hidden md:block',
]);

requireText('src/index.css', [
  'overflow-x: hidden',
  '.app-page > * { min-width: 0; }',
  '.app-page-actions',
  '.responsive-toolbar',
  '.responsive-tabs',
  '@media (max-width: 639px)',
]);

requireText('src/components/ui/dialog.tsx', [
  'max-h-[calc(100dvh-1rem)]',
  'w-[calc(100%-1rem)]',
  'overflow-y-auto',
]);

requireText('src/components/ui/sheet.tsx', [
  'max-h-[100dvh]',
  'w-[92vw]',
  'overflow-y-auto',
]);

requireText('src/components/ui/table.tsx', [
  'overscroll-x-contain',
  'overflow-x-auto',
  'whitespace-nowrap',
]);

requireText('src/components/ui/tabs.tsx', [
  'max-w-full',
  'overflow-x-auto',
  'shrink-0',
]);

requireText('src/pages/public/PublicAppLayout.tsx', [
  'min-h-[calc(100dvh-4rem)]',
  'pb-20 md:pb-0',
  'safe-bottom max-h-[calc(100dvh-4rem)]',
]);

requireText('src/pages/public/PublicBooking.tsx', [
  'pb-[calc(7.5rem+env(safe-area-inset-bottom))]',
  'snap-x',
  'safe-bottom fixed',
]);

requireText('src/pages/customer/CustomerPortal.tsx', [
  'mobile-stack-actions',
  'mt-6 grid sm:flex sm:justify-end',
]);

requireText('src/pages/owner/ai/AIHub.tsx', [
  'h-[min(52dvh,430px)]',
  'mobile-stack-actions',
  'grid gap-2 sm:flex sm:flex-wrap',
]);

requireText('src/components/calendar/calendar-outlook.css', [
  '@media (max-width: 1023px)',
  'height: calc(100dvh - 156px)',
  'height: calc(100dvh - 148px)',
]);

forbidText('src/pages/public/PublicAppLayout.tsx', ['<Scissors']);
forbidText('src/pages/public/PublicBooking.tsx', ['<Scissors']);

const ownerPages = [
  'Home',
  'Sales',
  'Finance',
  'Customers',
  'Staff',
  'Services',
  'Products',
  'Marketing',
  'Posts',
  'Gallery',
  'Storefront',
  'Business',
  'Reports',
  'Billing',
  'Settings',
];

for (const page of ownerPages) {
  const relativePath = `src/pages/owner/${page}.tsx`;
  if (!read(relativePath).includes('app-page')) {
    failures.push(`${relativePath}: owner page must use the shared app-page responsive container`);
  }
}

const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else if (/\.(tsx?|css)$/.test(entry.name)) sourceFiles.push(absolute);
  }
}
collect(path.join(root, 'src'));

for (const absolute of sourceFiles) {
  const source = fs.readFileSync(absolute, 'utf8');
  const relative = path.relative(root, absolute);
  if (/\bw-screen\b|100vw|overflow-x-visible/.test(source)) {
    failures.push(`${relative}: viewport-width/visible-overflow utility can create horizontal scrolling`);
  }
}

if (failures.length > 0) {
  console.error('Phase 10A responsive UI validation failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 10A responsive UI checks passed.');
console.log('Owner shell, mobile navigation, dialogs, sheets, tables, tabs, calendar, AI chat and customer booking safeguards verified.');
