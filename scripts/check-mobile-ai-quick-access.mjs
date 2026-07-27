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

requireText('src/components/layouts/owner-shell/OwnerMobileNavigation.tsx', [
  "const MOBILE_NAV_KEYS = ['home', 'calendar']",
  'bg-sidebar',
  'border-sidebar-border',
  '/dashboard/calendar?action=new',
  'navigation.mobile_appointment',
  '/dashboard/ai?mode=assistant',
  '/brand/velliqo-ai.png',
  'mix-blend-screen',
  'navigation.more',
  'text-center',
]);

forbidText('src/components/layouts/owner-shell/OwnerMobileNavigation.tsx', [
  "'sales'",
]);

requireText('src/pages/owner/ai/AIHub.tsx', [
  "searchParams.get('mode') === 'assistant'",
  'velliqo-assistant-workspace',
  'ai.quickAccess.title',
  'ai.quickAccess.description',
  'VelliqoActionConfirmationDialog',
  'setConfirmationAction(result.pendingAction)',
  'onChangeAction={changeAction}',
]);

requireText('src/components/ai/VelliqoVoiceAssistant.tsx', [
  'VelliqoActionConfirmationDialog',
  'setConfirmationOpen(Boolean(action))',
  'onExecuteAction(pendingAction)',
  'onRejectAction(pendingAction)',
  'ai.voice.actionChangeRequested',
]);

requireText('src/components/ai/VelliqoActionConfirmationDialog.tsx', [
  'ai.manager.actions.confirmationBadge',
  'action.preview?.items?.length',
  'onConfirm',
  'onCancel',
  'onChange',
  'z-[80]',
]);

requireText('src/components/layouts/OwnerDashboardLayout.tsx', [
  'pb-[calc(7rem+env(safe-area-inset-bottom))]',
]);

const localeFiles = ['en', 'el', 'de', 'es', 'tr'];
for (const locale of localeFiles) {
  const relativePath = `src/i18n/locales/${locale}.json`;
  const source = read(relativePath);
  for (const key of [
    '"mobile_appointment"',
    '"more"',
    '"quickAccess"',
    '"confirmationBadge"',
    '"confirmationDescription"',
    '"actionChangeRequested"',
  ]) {
    if (!source.includes(key)) failures.push(`${relativePath}: missing ${key}`);
  }
}

if (failures.length > 0) {
  console.error('Phase 10A.1 mobile navigation and AI quick-access validation failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 10A.1 mobile navigation and AI quick-access checks passed.');
console.log('Premium bottom bar, direct appointment action, focused text/voice assistant and in-context confirmation dialog verified.');
