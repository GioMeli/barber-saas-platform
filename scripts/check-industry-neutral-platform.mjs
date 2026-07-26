import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertContains(relativePath, expected, label) {
  const text = read(relativePath);
  if (!text.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)} in ${relativePath}`);
  }
}

function assertNotMatches(relativePath, pattern, label) {
  const text = read(relativePath);
  if (pattern.test(text)) {
    throw new Error(`${label}: forbidden pattern ${pattern} found in ${relativePath}`);
  }
}

const globallyScannedFiles = [
  'src/ai/context/buildAIContext.ts',
  'src/pages/auth/SignUp.tsx',
  'src/pages/public/PublicBooking.tsx',
  'src/pages/customer/CustomerPortal.tsx',
  'src/components/calendar/OutlookCalendarView.tsx',
  'src/components/calendar/calendar-outlook.css',
  'supabase/functions/velliqo-ai-manager/index.ts',
  'supabase/functions/process-ai-manager-automations/index.ts',
  'supabase/functions/process_appointment_notifications/index.ts',
  'supabase/functions/process_reminder_jobs/index.ts',
  'supabase/functions/process_marketing_deliveries/index.ts',
  'supabase/functions/create_subscription_checkout/index.ts',
  'supabase/functions/stripe_webhook/index.ts',
  'README.md',
  'docs/prd.md',
];

const forbiddenPatterns = [
  /salon or barbershop SaaS/i,
  /Barber Shop SaaS Platform/i,
  /PRODID:-\/\/Barber SaaS/i,
  /@barber-saas/i,
  /salonos-/i,
  /DEFAULT_INDUSTRY_KEY\s*:\s*IndustryKey\s*=\s*['"]hair_salon['"]/i,
  /industryKey:\s*input\.business\.industry_key\s*\?\?\s*['"]hair_salon['"]/i,
];

for (const relativePath of globallyScannedFiles) {
  for (const pattern of forbiddenPatterns) {
    assertNotMatches(relativePath, pattern, 'Industry-neutral validation failed');
  }
}

assertContains(
  'src/config/industries/industry.types.ts',
  "'appointment_service_business'",
  'Generic industry key is missing'
);
assertContains(
  'src/config/industries/industryRegistry.ts',
  "export const DEFAULT_INDUSTRY_KEY: IndustryKey = 'appointment_service_business';",
  'Frontend industry fallback is not neutral'
);
assertContains(
  'src/config/industries/industryRegistry.ts',
  'industry.launchEnabled && industry.category === category',
  'Hidden fallback industry must not appear in the public selector'
);
assertContains(
  'src/ai/context/buildAIContext.ts',
  "input.business.industry_key ?? 'appointment_service_business'",
  'AI context fallback is not neutral'
);
assertContains(
  'src/pages/auth/SignUp.tsx',
  ": 'appointment_service_business';",
  'Signup fallback is not neutral'
);
assertContains(
  'supabase/functions/velliqo-ai-manager/index.ts',
  "resolveIndustryContext(input.business?.industry_key)",
  'Conversational AI does not receive dynamic industry context'
);
assertContains(
  'supabase/functions/process-ai-manager-automations/index.ts',
  'resolveIndustryContext(input.business.industry_key)',
  'Daily briefings do not receive dynamic industry context'
);
assertContains(
  'src/pages/public/PublicBooking.tsx',
  'PRODID:-//Velliqo//Appointment//EN',
  'Public calendar export is not Velliqo-branded'
);
assertContains(
  'src/pages/customer/CustomerPortal.tsx',
  'PRODID:-//Velliqo//Customer Appointment//EN',
  'Customer calendar export is not Velliqo-branded'
);
assertContains(
  'supabase/migrations/00041_velliqo_industry_neutral_platform.sql',
  "alter column industry_key set default 'appointment_service_business'",
  'Database fallback migration is missing'
);
assertContains(
  'supabase/migrations/00041_velliqo_industry_neutral_platform.sql',
  "'appointment_service_business'",
  'Database industry constraint does not include the neutral fallback'
);
assertContains(
  'src/i18n/terminology/index.ts',
  'getIndustryConfig(industryKey)',
  'Terminology is not resolved from the industry registry'
);

const notificationFunctions = [
  'supabase/functions/process_appointment_notifications/index.ts',
  'supabase/functions/process_reminder_jobs/index.ts',
  'supabase/functions/process_marketing_deliveries/index.ts',
];
for (const relativePath of notificationFunctions) {
  assertNotMatches(
    relativePath,
    /\b(?:barber|barbershop|haircut|stylist|salon owner)\b/i,
    'Transactional communication contains a hard-coded sector term'
  );
}

console.log('Phase 9F industry-neutral platform checks passed.');
console.log('Neutral defaults, dynamic AI context, generic notifications, Velliqo calendar exports and repository identity verified.');
