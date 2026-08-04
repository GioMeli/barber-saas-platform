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
  'src/components/ai/OwnerAIAssistantDrawer.tsx',
  'src/components/tour/OwnerProductTour.tsx',
  'supabase/migrations/00048_velliqo_owner_product_tour.sql',
  'src/pages/owner/Storefront.tsx',
  'src/pages/owner/Settings.tsx',
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
  const storefront = read('src/pages/owner/Storefront.tsx');
  const legacySettings = read('src/pages/owner/Settings.tsx');
  const aiDrawer = read('src/components/ai/OwnerAIAssistantDrawer.tsx');
  const productTour = read('src/components/tour/OwnerProductTour.tsx');
  const tourMigration = read('supabase/migrations/00048_velliqo_owner_product_tour.sql');
  const shellSources = [layout, sidebar, topbar, navigation].join('\n');

  const requiredChecks = [
    [sidebar.includes('grid grid-cols-2'), 'Sidebar is not configured as a two-column navigation grid.'],
    [layout.includes('side="left"'), 'Mobile sidebar drawer is not configured from the left.'],
    [topbar.includes('onOpenMobileMenu'), 'Mobile menu button wiring is missing.'],
    [topbar.includes('OwnerCommandPalette'), 'Global command palette is missing from the top bar.'],
    [topbar.includes('OwnerNotificationCenter'), 'Notification center is missing from the top bar.'],
    [topbar.includes('data-tour="desktop-ai"') && topbar.includes('onOpenAI'), 'Desktop Velliqo AI drawer trigger is missing.'],
    [topbar.includes('BookOpenCheck') && topbar.includes('ownerExperience.tour.button'), 'Book icon + Tour trigger is missing.'],
    [layout.includes('OwnerAIAssistantDrawer') && layout.includes('OwnerProductTour'), 'Owner AI drawer or guided tour is not mounted in the shared layout.'],
    [aiDrawer.includes('VelliqoVoiceAssistant') && aiDrawer.includes('VelliqoActionConfirmationDialog'), 'Desktop AI drawer must share voice and protected action confirmations.'],
    [aiDrawer.includes('page: location.pathname'), 'Desktop AI drawer must provide current-page context to Velliqo AI.'],
    [productTour.includes('const TOUR_STEPS') && productTour.includes('navigate(step.route)'), 'Guided tour must cover owner modules across routes.'],
    [productTour.includes('step.action') && productTour.includes('opensOverlay'), 'Guided tour must demonstrate tabs and creation forms safely.'],
    [productTour.includes('CHAPTERS') && productTour.includes('chapterProgress'), 'Guided tour must support detailed page chapters and section navigation.'],
    [productTour.includes("from('owner_tour_progress')"), 'Guided tour progress persistence is missing.'],
    [tourMigration.includes('create table if not exists public.owner_tour_progress'), 'Owner tour progress migration is missing.'],
    [tourMigration.includes('public.has_business_access(business_id)'), 'Owner tour progress RLS must enforce business access.'],
    [navigation.includes("path: '/dashboard/ai'"), 'Velliqo AI navigation entry is missing.'],
    [app.includes('<Route path="ai" element={<AIHub />} />'), 'Velliqo AI route is missing.'],
    [app.includes('<Route path="settings" element={<Navigate to="/dashboard/storefront" replace />} />'), 'Legacy Settings route must redirect to Storefront.'],
    [!navigation.includes("path: '/dashboard/settings'"), 'Duplicate Settings navigation entry must be removed.'],
    [storefront.includes("from('business_settings')"), 'Storefront must own booking settings persistence.'],
    [storefront.includes('booking_interval'), 'Storefront booking preferences are missing.'],
    [storefront.includes('map_url'), 'Storefront map configuration is missing.'],
    [legacySettings.includes('<Navigate to="/dashboard/storefront" replace />'), 'Legacy Settings component must redirect to Storefront.'],
    [!legacySettings.includes("from('business_settings')"), 'Legacy Settings must not remain a second persistence source.'],
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

const ownerExperienceLocales = ['en', 'el', 'de', 'es', 'tr', 'ar', 'hi', 'ru'];
const ownerExperiencePaths = [
  ['ownerExperience', 'aiDrawer', 'title'],
  ['ownerExperience', 'aiDrawer', 'description'],
  ['ownerExperience', 'tour', 'button'],
  ['ownerExperience', 'tour', 'title'],
  ['ownerExperience', 'tour', 'features', 'calendar'],
  ['ownerExperience', 'tour', 'features', 'storefront'],
  ['ownerExperience', 'tour', 'features', 'training'],
];

for (const locale of ownerExperienceLocales) {
  const localePath = path.join(root, 'src', 'i18n', 'locales', `${locale}.json`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  } catch (error) {
    failures.push(`Invalid owner-experience locale JSON (${locale}): ${error.message}`);
    continue;
  }

  for (const keyPath of ownerExperiencePaths) {
    const value = keyPath.reduce((current, key) => current?.[key], data);
    if (typeof value !== 'string' || value.trim() === '') {
      failures.push(`Missing owner-experience locale value (${locale}): ${keyPath.join('.')}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Owner shell validation failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Owner shell validation passed.');
console.log('Validated: owner navigation, desktop AI drawer, guided product tour, Storefront consolidation, routes, quick actions, Velliqo branding and 8-locale coverage.');
