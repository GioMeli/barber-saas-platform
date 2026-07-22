import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const failures = [];

const requiredFiles = [
  'src/components/layouts/OwnerDashboardLayout.tsx',
  'src/components/layouts/owner-shell/navigation.ts',
  'src/components/layouts/owner-shell/OwnerSidebar.tsx',
  'src/components/layouts/owner-shell/OwnerTopBar.tsx',
  'src/components/layouts/owner-shell/OwnerCommandPalette.tsx',
  'src/components/layouts/owner-shell/OwnerQuickAdd.tsx',
  'public/brand/velliqo-mark.png',
];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`Missing required file: ${file}`);
}

if (failures.length === 0) {
  const layout = read('src/components/layouts/OwnerDashboardLayout.tsx');
  const sidebar = read('src/components/layouts/owner-shell/OwnerSidebar.tsx');
  const topbar = read('src/components/layouts/owner-shell/OwnerTopBar.tsx');
  const navigation = read('src/components/layouts/owner-shell/navigation.ts');
  const app = read('src/App.tsx');
  const calendar = read('src/pages/owner/Calendar.tsx');
  const shellSources = [layout, sidebar, topbar, navigation].join('\n');

  const requiredChecks = [
    [sidebar.includes('grid grid-cols-2'), 'Sidebar is not configured as a two-column navigation grid.'],
    [layout.includes('side="left"'), 'Mobile sidebar drawer is not configured from the left.'],
    [topbar.includes('onOpenMobileMenu'), 'Mobile menu button wiring is missing.'],
    [topbar.includes('OwnerCommandPalette'), 'Global command palette is missing from the top bar.'],
    [topbar.includes('OwnerNotificationCenter'), 'Notification center is missing from the top bar.'],
    [navigation.includes("path: '/dashboard/ai'"), 'Velliqo AI navigation entry is missing.'],
    [app.includes('<Route path="ai" element={<AIHub />} />'), 'Velliqo AI route is missing.'],
    [app.includes('<Route path="settings" element={<Settings />} />'), 'Settings route is missing.'],
    [calendar.includes("searchParams.get('action')"), 'Quick appointment action is not connected to Calendar.'],
    [!shellSources.toLowerCase().includes('fresha'), 'Owner shell contains a Fresha brand reference.'],
  ];

  for (const [passed, message] of requiredChecks) {
    if (!passed) failures.push(message);
  }
}

const supportedLocales = ['en', 'el', 'de', 'es', 'tr'];
const requiredLocalePaths = [
  ['navigation', 'workspace_navigation'],
  ['navigation', 'search'],
  ['navigation', 'search_placeholder'],
  ['navigation', 'no_search_results'],
  ['navigation', 'modules'],
  ['navigation', 'quick_add'],
  ['navigation', 'open_menu'],
  ['navigation', 'open_ai'],
  ['navigation', 'quick_actions', 'appointment'],
  ['navigation', 'quick_actions', 'customer'],
  ['navigation', 'quick_actions', 'staff'],
  ['navigation', 'quick_actions', 'service'],
  ['navigation', 'quick_actions', 'post'],
];

for (const locale of supportedLocales) {
  const localePath = path.join(root, 'src', 'i18n', 'locales', `${locale}.json`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  } catch (error) {
    failures.push(`Invalid locale JSON (${locale}): ${error.message}`);
    continue;
  }

  for (const keyPath of requiredLocalePaths) {
    const value = keyPath.reduce((current, key) => current?.[key], data);
    if (typeof value !== 'string' || value.trim() === '') {
      failures.push(`Missing locale value (${locale}): ${keyPath.join('.')}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Owner shell validation failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Owner shell validation passed.');
console.log('Validated: two-column desktop/mobile navigation, top bar, routes, quick actions, Velliqo branding and 5-locale coverage.');
