import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => { console.error(`Phase 12A validation failed: ${message}`); process.exit(1); };

const approved = [
  'public/marketing/approved/calendar-two-devices-transparent.png',
  'public/marketing/approved/customer-page-two-devices-transparent.png',
  'public/marketing/approved/staff-page-two-devices-transparent.png',
  'public/marketing/approved/velliqo-ai-two-devices-transparent.png',
  'public/marketing/approved/website_extra_01_booking_mobile_transparent.webp',
  'public/marketing/approved/website_extra_03_ai_laptop_transparent.webp',
];
for (const file of approved) if (!exists(file)) fail(`missing approved public artwork: ${file}`);

for (const file of approved.filter((item) => item.endsWith('.png'))) {
  const bytes = fs.readFileSync(path.join(root, file));
  if (bytes.subarray(1, 4).toString() !== 'PNG') fail(`invalid PNG: ${file}`);
  // PNG IHDR color type 6 = RGBA. Approved combined PNGs must retain alpha.
  if (bytes[25] !== 6) fail(`approved combined PNG is not RGBA/transparent: ${file}`);
}

const artwork = read('src/components/marketing/ApprovedArtwork.tsx');
const home = read('src/pages/marketing/IndustrySelection.tsx');
const why = read('src/pages/marketing/WhyVelliqo.tsx');
const experience = read('src/pages/marketing/Experience.tsx');
const aiPage = read('src/pages/marketing/VelliqoAI.tsx');
const chrome = read('src/components/marketing/MarketingChrome.tsx');
const catalog = read('src/training/catalog.ts');
const publicCourses = read('src/pages/marketing/Courses.tsx');
const ownerTraining = read('src/pages/owner/TrainingPortal.tsx');
const videoDialog = read('src/components/training/TrainingVideoDialog.tsx');

if (!artwork.includes('object-contain') || !artwork.includes('ApprovedArtwork')) fail('transparent approved-artwork renderer is incomplete');
for (const page of [home, why, experience, aiPage]) {
  if (!page.includes('/marketing/approved/')) fail('a core public product page is not using approved imagery');
}

for (const token of ['Personal Staff Portal', 'Staff Portal', 'staff-page-two-devices-transparent.png']) {
  if (!why.includes(token) && !experience.includes(token)) fail(`Staff Portal public story missing ${token}`);
}
if (!why.includes('What is the Staff Portal?')) fail('Why Velliqo FAQ does not explain the Staff Portal');
if (!experience.includes('id="staff"') || !experience.includes('downloadable personal Staff Apps')) fail('Experience does not explain the Staff Portal and plan-controlled Staff Apps');

if (!exists('public/brand/velliqo-logo-transparent.png')) fail('transparent full Velliqo logo is missing');
if (!chrome.includes('/brand/velliqo-mark.png')) fail('public marketing chrome does not use the transparent Velliqo mark');

for (const token of ['videoUrl?: string | null', 'videoProvider?: TrainingVideoProvider', 'videoPosterUrl?: string | null', 'detectTrainingVideoProvider', 'buildTrainingVideoEmbedUrl']) {
  if (!catalog.includes(token)) fail(`training video catalog architecture missing ${token}`);
}
for (const source of [publicCourses, ownerTraining]) {
  if (!source.includes('TrainingVideoDialog') || !source.includes('training.watchVideo') || !source.includes('guide.videoUrl')) fail('training course UI is not wired to optional video lessons');
}
if (!videoDialog.includes("provider === 'direct'") || !videoDialog.includes('<iframe') || !videoDialog.includes('VideoPlayer')) fail('training video player does not support direct and embedded providers');
if (!exists('docs/PHASE-12A-PUBLIC-VISUALS-BRANDING-TRAINING-VIDEO.md')) fail('Phase 12A implementation guide is missing');

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const translations = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  for (const key of ['watchVideo', 'videoAvailable', 'videoLesson', 'videoPlaybackHint', 'openVideoExternally']) {
    if (!translations.training?.[key]) fail(`missing ${locale} training.${key}`);
  }
}

console.log('Phase 12A public visuals, transparent branding, Staff Portal story and Training video architecture checks passed.');
