import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const assertIncludes = (file, values) => {
  const source = read(file);
  for (const value of values) {
    if (!source.includes(value)) {
      throw new Error(`${file} is missing customer UX safeguard: ${value}`);
    }
  }
};

assertIncludes('src/pages/public/PublicAppLayout.tsx', [
  'skipToContent',
  'id="public-main-content"',
  'mobileNavigation',
  'MobilePublicNavItem',
  'business.online_presence?.show_reviews',
]);

assertIncludes('src/pages/public/BusinessHome.tsx', [
  'sticky top-16',
  'sm:top-[72px]',
  'scroll-mt-28 sm:scroll-mt-32',
  'w-full rounded-xl px-6 sm:w-auto',
]);

assertIncludes('src/pages/public/PublicBooking.tsx', [
  "aria-current={active ? 'step' : undefined}",
  'publicBooking.states.noServices',
  'publicBooking.actions.backToStore',
  'handleMobilePrimaryAction',
  'mobilePrimaryDisabled',
  'autoComplete="name"',
  'autoComplete="tel"',
  'autoComplete="email"',
]);

assertIncludes('src/pages/customer/CustomerPortal.tsx', [
  'role="tablist"',
  'customerPortal.tabs.label',
  'role="tab"',
  'aria-selected={active}',
  'autoComplete="name"',
  'autoComplete="tel"',
  'autoComplete="email"',
  "t('customerPortal.actions.bookAppointment')",
]);

assertIncludes('src/pages/public/CustomerReviews.tsx', [
  'max-h-[92dvh]',
  'sticky bottom-0',
]);

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const source = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  if (!source.storefront?.public?.accessibility?.skipToContent) {
    throw new Error(`${locale}: missing public accessibility.skipToContent`);
  }
  if (!source.storefront?.public?.accessibility?.mobileNavigation) {
    throw new Error(`${locale}: missing public accessibility.mobileNavigation`);
  }
  if (!source.publicBooking?.states?.noServices) {
    throw new Error(`${locale}: missing publicBooking.states.noServices`);
  }
  if (!source.publicBooking?.actions?.backToStore) {
    throw new Error(`${locale}: missing publicBooking.actions.backToStore`);
  }
  if (!source.customerPortal?.tabs?.label) {
    throw new Error(`${locale}: missing customerPortal.tabs.label`);
  }
}

console.log('Phase 11E customer storefront and booking UX validation passed.');
console.log('Mobile navigation, booking actions, customer account tabs, accessibility and responsive dialogs verified.');
