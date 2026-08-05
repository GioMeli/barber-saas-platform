import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requiredFiles = [
  'src/training/curriculum.ts',
  'src/training/quiz.ts',
  'src/hooks/useCertifiedTrainingProgress.ts',
  'src/components/training/TrainingCertificationLibrary.tsx',
  'src/components/training/TrainingCurriculumDialog.tsx',
  'src/components/training/TrainingQuizDialog.tsx',
  'src/components/training/TrainingCertificateCard.tsx',
  'src/components/training/StaffTrainingDialog.tsx',
  'src/lib/trainingCertificatePdf.ts',
  'supabase/migrations/00049_velliqo_training_certification.sql',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

if (!failures.length) {
  const curriculum = read('src/training/curriculum.ts');
  const ownerLessons = (curriculum.match(/audience: 'owner'/g) || []).length;
  const staffLessons = (curriculum.match(/audience: 'staff'/g) || []).length;
  if (ownerLessons < 35) failures.push(`owner curriculum too small (${ownerLessons})`);
  if (staffLessons < 12) failures.push(`staff curriculum too small (${staffLessons})`);

  const quiz = read('src/training/quiz.ts');
  if (!quiz.includes('length: 50')) failures.push('quiz is not fixed at 50 questions');
  if (!quiz.includes('calculateTrainingQuizScore')) failures.push('quiz scoring missing');

  const certificate = read('src/lib/trainingCertificatePdf.ts');
  if (!certificate.includes("application/pdf")) failures.push('PDF certificate generation missing');
  if (!certificate.includes('participantName')) failures.push('participant name missing from certificate');

  const ownerPortal = read('src/pages/owner/TrainingPortal.tsx');
  if (!ownerPortal.includes('TrainingCertificationLibrary')) failures.push('owner certification portal missing');

  const staffPortal = read('src/pages/staff/EmployeeDashboard.tsx');
  if (!staffPortal.includes('StaffTrainingDialog')) failures.push('staff training feature missing');

  const auth = read('src/hooks/useAuth.ts');
  if (!auth.includes('Background revalidation preserves open forms')) failures.push('owner form-preserving auth refresh missing');


  const workflow = read('.github/workflows/quality-gate.yml');
  if (!workflow.includes('npm run training-certification:check')) failures.push('CI does not run training-certification:check');

  const migration = read('supabase/migrations/00049_velliqo_training_certification.sql');
  for (const marker of ['training_certifications', "audience in ('owner', 'staff')", 'best_score >= 80', "cardinality(completed_lesson_ids) >= 37", "cardinality(completed_lesson_ids) >= 12", 'is_training_staff']) {
    if (!migration.includes(marker)) failures.push(`migration marker missing: ${marker}`);
  }
}

if (failures.length) {
  console.error('Phase 12F training certification validation failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 12F complete owner/staff training, 50-question assessment, certification PDF and form-preserving auth checks passed.');
