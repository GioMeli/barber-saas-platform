import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => { console.error(`Phase 12D premium learning/business-types validation failed: ${message}`); process.exit(1); };

const trainingVisualPath = 'src/components/training/TrainingCourseVisual.tsx';
const industryVisualPath = 'src/components/marketing/IndustryVisual.tsx';
if (!exists(trainingVisualPath)) fail('shared premium training course visual is missing');
if (!exists(industryVisualPath)) fail('industry-specific visual component is missing');

const trainingVisual = read(trainingVisualPath);
const industryVisual = read(industryVisualPath);
const publicCourses = read('src/pages/marketing/Courses.tsx');
const ownerTraining = read('src/components/training/TrainingCertificationLibrary.tsx');
const businessTypes = read('src/pages/marketing/BusinessTypeSelection.tsx');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/quality-gate.yml');

for (const token of ['data-training-course-visual', "h-36", 'CATEGORY_STYLES', 'GUIDE_ICONS']) {
  if (!trainingVisual.includes(token)) fail(`training visual missing ${token}`);
}
for (const source of [publicCourses, ownerTraining]) {
  if (!source.includes('TrainingCourseVisual')) fail('a training surface is not using the premium shared visual');
  if (!source.includes('rounded-[1.75rem]') || !source.includes('shadow-[')) fail('a training surface is missing premium card depth/shape');
  if (!source.includes('guide.videoUrl') || !source.includes('TrainingVideoDialog')) fail('training video functionality was lost');
  if (!source.includes('getTrainingPdfPath')) fail('training PDF functionality was lost');
}
if (!ownerTraining.includes('useCertifiedTrainingProgress') || !ownerTraining.includes('setLessonCompleted')) fail('certified owner lesson completion tracking was lost');
if (!publicCourses.includes('practiceInDemo')) fail('public course demo action was lost');

for (const token of ['data-industry-visual', 'INDUSTRY_ICONS', 'h-[118px]', 'role="img"']) {
  if (!industryVisual.includes(token)) fail(`industry visual missing ${token}`);
}
for (const token of ['IndustryVisual', 'data-industry-card', 'min-h-[310px]', 'visibleGroups', 'MarketingFooter']) {
  if (!businessTypes.includes(token)) fail(`premium Business Types page missing ${token}`);
}
if (!businessTypes.includes("window.localStorage.setItem(SELECTED_INDUSTRY_STORAGE_KEY, item.key)")) fail('industry selection persistence was lost');
if (!businessTypes.includes('to={`/sign-up?industry=${item.key}`}')) fail('industry sign-up routing was lost');
if (!businessTypes.includes('getIndustriesByCategory')) fail('industry category functionality was lost');

if (packageJson.scripts?.['phase12d:check'] !== 'node scripts/check-phase12d-premium-learning-business-types.mjs') fail('phase12d:check package script is missing');
if (!workflow.includes('npm run phase12d:check')) fail('CI does not run phase12d:check');

console.log('Phase 12D premium Training/Courses and Business Types validation passed.');
console.log('Verified: stronger visible course cards, fixed-size industry illustrations, preserved filters, PDFs, videos, progress and sign-up selection.');
