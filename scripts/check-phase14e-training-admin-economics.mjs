import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const catalog = read('src/training/catalog.ts');
const library = read('src/components/training/TrainingCertificationLibrary.tsx');
const curriculum = read('src/components/training/TrainingCurriculumDialog.tsx');
const videoLibraryDialog = read('src/components/training/TrainingVideoLibraryDialog.tsx');
const courses = read('src/pages/marketing/Courses.tsx');
const admin = read('src/pages/admin/PlatformAdmin.tsx');
const migration = read('supabase/migrations/00054_velliqo_training_video_financial_intelligence.sql');

const videoFiles = [
  'Calendar-Newappointment.mp4','Createaccountguide.mp4','CreateProducts.mp4','Createservices.mp4',
  'Customerbookappointment.mp4','CustomerHistory.mp4','Designcustomerpage.mp4','Discovershopfrommap.mp4',
  'Editstaff.mp4','Homepage.mp4','Marketingpage.mp4','Postpage.mp4','Reportspage.mp4',
  'Staffpersonalpage.mp4','Trainingportal.mp4','Velliqo AI.mp4',
];

const checks = [
  ['training public bucket resolver', catalog.includes('/storage/v1/object/public/training-videos/')],
  ['all 16 finished videos registered', videoFiles.every((file) => catalog.includes(file))],
  ['course video playlists', courses.includes('TrainingVideoLibraryDialog') && courses.includes("getTrainingVideosForGuide(guide.slug, 'public')")],
  ['owner and staff video playlists', library.includes('TrainingVideoLibraryDialog') && library.includes("audience === 'staff' ? 'staff' : 'owner'")],
  ['feature-level videos inside curriculum', curriculum.includes('getTrainingVideoForLesson') && curriculum.includes('relatedFeatureVideo')],
  ['desktop video library fits viewport without unnecessary scrolling', videoLibraryDialog.includes('lg:h-[96dvh]') && videoLibraryDialog.includes('lg:max-w-[860px]') && videoLibraryDialog.includes('lg:hidden')],
  ['admin economics tab', admin.includes('value="economics"') && admin.includes('Velliqo economics & AI cost intelligence')],
  ['platform economics CSV', admin.includes('exportPlatformEconomics')],
  ['owner profitability CSV', admin.includes('exportFinancialOwners')],
  ['AI cost ledger CSV', admin.includes('exportAiLedger')],
  ['financial summary RPC', migration.includes('platform_admin_financial_summary')],
  ['owner financial RPC', migration.includes('platform_admin_financial_owner_rows')],
  ['AI ledger RPC', migration.includes('platform_admin_ai_usage_rows')],
  ['actual paid invoice revenue', migration.includes("billing_invoices") && migration.includes("status = 'paid'")],
  ['recorded AI cost', migration.includes('ai_usage_events') && migration.includes('estimated_cost')],
  ['configured provider costs', migration.includes('email_unit_cost_eur') && migration.includes('sms_unit_cost_eur') && migration.includes('payment_fee_percent')],
];

const failed = checks.filter(([, pass]) => !pass);
for (const [name, pass] of checks) console.log(`${pass ? '✓' : '✗'} ${name}`);
if (failed.length) {
  console.error(`Phase 14E validation failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Phase 14E training video and admin economics validation passed (${checks.length} checks).`);
