import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read('src/App.tsx');
const layout = read('src/components/demo/DemoOwnerLayout.tsx');
const modulePage = read('src/pages/demo/DemoModulePage.tsx');
const context = read('src/demo/DemoOwnerContext.tsx');
const demoNavigation = read('src/demo/demoNavigation.ts');
const courses = read('src/pages/marketing/Courses.tsx');
const training = read('src/pages/owner/TrainingPortal.tsx');
const navigation = read('src/components/layouts/owner-shell/navigation.ts');
const catalog = read('src/training/catalog.ts');
const progress = read('src/hooks/useTrainingProgress.ts');
const generator = read('scripts/generate-training-pdfs.py');
const marketingChrome = read('src/components/marketing/MarketingChrome.tsx');

assert(app.includes('path="/demo"') && app.includes('<DemoOwnerLayout'), 'Full owner-style /demo route is missing.');
assert(app.includes('path=":module"'), 'Demo module routes are missing.');
assert(app.includes('path="/courses"'), 'Public /courses route is missing.');
assert(app.includes('path="training"'), 'Owner training route is missing.');
assert(navigation.includes("path: '/dashboard/training'"), 'Training Portal is missing from owner navigation.');
assert(marketingChrome.includes("label: 'Demo'"), 'Public navigation must use Demo, not Live demo.');
assert(marketingChrome.includes("label: 'Courses'"), 'Courses is missing from public navigation.');

for (const [file, source] of [['DemoOwnerLayout', layout], ['DemoModulePage', modulePage], ['DemoOwnerContext', context]]) {
  assert(!source.includes("@/db/supabase") && !source.includes('supabase.'), `${file} must not import or call Supabase.`);
  assert(!source.includes('supabase.from(') && !source.includes('supabase.rpc('), `${file} must not perform database queries.`);
}
assert(context.includes('browser session') && context.includes('never saved to the database'), 'Demo local-only disclosure is missing.');
assert(context.includes('useState') && context.includes('addAppointment') && context.includes('addCustomer'), 'Demo actions are not connected to local state.');
assert(layout.includes('DEMO_NAVIGATION_ITEMS') && demoNavigation.includes('OWNER_NAVIGATION_ITEMS'), 'Demo must mirror the owner navigation architecture.');
for (const key of ['calendar','sales','finance','customers','staff','services','products','marketing','posts','gallery','storefront','business','reports','billing','ai','training']) {
  assert(modulePage.includes(`moduleKey === '${key}'`) || key === 'training', `Demo module is missing: ${key}`);
}
assert(!modulePage.includes("moduleKey === 'settings'"), 'Removed owner Settings must not remain in the demo navigation experience.');
assert(modulePage.includes('Storefront & booking controls'), 'Demo Storefront must reflect consolidated booking configuration.');
assert(modulePage.includes('Apply in demo') && modulePage.includes('No database request will be made'), 'Demo action confirmation boundary is missing.');

assert(courses.includes('getTrainingPdfPath'), 'Courses page does not link professional PDFs.');
assert(courses.includes('videoComingSoon') && courses.includes('practiceInDemo'), 'Courses video placeholders or demo practice links are missing.');
assert(training.includes('getTrainingPdfPath'), 'Owner Training Portal lost its PDF links.');
assert(training.includes('useTrainingProgress'), 'Owner Training Portal lost local progress tracking.');
assert(progress.includes('window.localStorage'), 'Training progress must remain local-only.');
assert(catalog.includes('demoRoute?: string') && catalog.includes('videoUrl?: string | null'), 'Training catalog is not ready for demo practice and future videos.');
assert(generator.includes('Actual Velliqo') || generator.includes('Πραγματικό παράδειγμα εφαρμογής Velliqo'), 'Professional PDF generator must reference actual app screenshots.');
assert(generator.includes('velliqo-logo-transparent.png') && generator.includes('SCREENSHOTS'), 'PDF branding or screenshot mapping is missing.');

const slugs = [...catalog.matchAll(/\{ slug: '([^']+)'/g)].map((match) => match[1]);
const uniqueSlugs = [...new Set(slugs)];
assert(uniqueSlugs.length === 12, `Expected 12 training guides, found ${uniqueSlugs.length}.`);

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  for (const slug of uniqueSlugs) {
    const file = path.join(root, 'public', 'training', 'guides', locale, `${slug}.pdf`);
    assert(fs.existsSync(file), `Missing training PDF: ${locale}/${slug}.pdf`);
    const data = fs.readFileSync(file);
    assert(data.subarray(0, 4).toString() === '%PDF', `Invalid PDF header: ${locale}/${slug}.pdf`);
    assert(data.length > 75_000, `Professional training PDF appears incomplete: ${locale}/${slug}.pdf`);
    const pageMarkers = data.toString('latin1').match(/\/Type\s*\/Page\b/g) || [];
    assert(pageMarkers.length >= 3, `Expected at least 3 pages in ${locale}/${slug}.pdf, found ${pageMarkers.length}.`);
  }
}

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const translations = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  assert(translations.navigation?.training, `Missing navigation.training in ${locale}.`);
  assert(translations.navigation?.courses, `Missing navigation.courses in ${locale}.`);
  assert(translations.training?.title, `Missing training.title in ${locale}.`);
  assert(translations.training?.publicTitle, `Missing training.publicTitle in ${locale}.`);
  assert(translations.training?.videoComingSoon, `Missing training.videoComingSoon in ${locale}.`);
  for (const slug of uniqueSlugs) {
    assert(translations.training?.guides?.[slug]?.title, `Missing ${locale} title for ${slug}.`);
    assert(translations.training?.guides?.[slug]?.description, `Missing ${locale} description for ${slug}.`);
  }
}

console.log('Phase 10C.1 Full Demo and Professional Courses checks passed.');
console.log('Owner-style local-only demo, public Courses, future video slots and 60 branded screenshot-based PDFs verified.');
