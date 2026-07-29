import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read('src/App.tsx');
const demo = read('src/pages/marketing/Demo.tsx');
const workspace = read('src/components/demo/DemoWorkspace.tsx');
const training = read('src/pages/owner/TrainingPortal.tsx');
const navigation = read('src/components/layouts/owner-shell/navigation.ts');
const catalog = read('src/training/catalog.ts');
const progress = read('src/hooks/useTrainingProgress.ts');

assert(app.includes('path="/demo"'), 'Public /demo route is missing.');
assert(app.includes('path="training"'), 'Owner training route is missing.');
assert(navigation.includes("path: '/dashboard/training'"), 'Training Portal is missing from owner navigation.');
assert(demo.includes('Sample data only') || workspace.includes('Sample data only'), 'Demo safety disclosure is missing.');
assert(!demo.includes("@/db/supabase") && !workspace.includes("@/db/supabase"), 'Demo must not import Supabase.');
assert(!demo.includes('.from(') && !workspace.includes('.from('), 'Demo must not perform database queries.');
assert(workspace.includes('DEMO_SCENARIOS'), 'Demo scenarios are not connected.');
assert(workspace.includes('No supplier order will be placed automatically') || read('src/demo/sampleData.ts').includes('No supplier order will be placed automatically'), 'Low-risk demo boundary is missing.');
assert(training.includes('getTrainingPdfPath'), 'Training PDFs are not linked from the portal.');
assert(training.includes('useTrainingProgress'), 'Training progress is not connected.');
assert(progress.includes('window.localStorage'), 'Training progress must remain local-only.');
assert(catalog.includes("['en', 'el', 'de', 'es', 'tr']"), 'Five-language PDF fallback is missing.');

const slugs = [...catalog.matchAll(/\{ slug: '([^']+)'/g)].map((match) => match[1]);
const uniqueSlugs = [...new Set(slugs)];
assert(uniqueSlugs.length === 12, `Expected 12 training guides, found ${uniqueSlugs.length}.`);

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  for (const slug of uniqueSlugs) {
    const file = path.join(root, 'public', 'training', 'guides', locale, `${slug}.pdf`);
    assert(fs.existsSync(file), `Missing training PDF: ${locale}/${slug}.pdf`);
    const data = fs.readFileSync(file);
    assert(data.subarray(0, 4).toString() === '%PDF', `Invalid PDF header: ${locale}/${slug}.pdf`);
    assert(data.length > 20_000, `Training PDF appears incomplete: ${locale}/${slug}.pdf`);
  }
}

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const translations = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  assert(translations.navigation?.training, `Missing navigation.training in ${locale}.`);
  assert(translations.training?.title, `Missing training.title in ${locale}.`);
  for (const slug of uniqueSlugs) {
    assert(translations.training?.guides?.[slug]?.title, `Missing ${locale} title for ${slug}.`);
    assert(translations.training?.guides?.[slug]?.description, `Missing ${locale} description for ${slug}.`);
  }
}

console.log('Phase 10C Demo Mode and Training Portal checks passed.');
console.log('Public local-only demo, 12 owner guides, 60 localized PDFs and local progress tracking verified.');
