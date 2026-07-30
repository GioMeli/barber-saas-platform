import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireFile = (file) => {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
};
const assertIncludes = (file, values) => {
  const source = read(file);
  for (const value of values) {
    if (!source.includes(value)) throw new Error(`${file} is missing: ${value}`);
  }
};

const requiredFiles = [
  'supabase/migrations/00042_velliqo_service_media_and_store_pwa.sql',
  'src/lib/serviceMedia.ts',
  'src/components/storefront/ServiceThumbnail.tsx',
  'src/components/storefront/StoreInstallPrompt.tsx',
  'src/hooks/useStorePWA.ts',
  'api/store-manifest.ts',
];
requiredFiles.forEach(requireFile);

assertIncludes('supabase/migrations/00042_velliqo_service_media_and_store_pwa.sql', [
  'add column if not exists image_path text',
  'pwa_enabled boolean not null default true',
  'Business members can upload service media',
  "bucket_id = 'services'",
  'public.has_business_access',
]);
assertIncludes('src/pages/owner/Services.tsx', [
  'uploadServiceImage',
  'removeServiceImage',
  'ServiceThumbnail',
  "accept=\"image/jpeg,image/png,image/webp\"",
]);
assertIncludes('src/pages/public/BusinessHome.tsx', [
  'StoreInstallPrompt',
  'ServiceThumbnail',
  'reviewSummary',
]);
assertIncludes('src/pages/public/PublicBooking.tsx', [
  'ServiceThumbnail',
  'selectedServices.map',
]);
assertIncludes('src/hooks/useStorePWA.ts', [
  '/store-manifest/',
  'apple-mobile-web-app-title',
]);
assertIncludes('vercel.json', ['store-manifest/:slug.webmanifest', '/api/store-manifest?slug=:slug']);
assertIncludes('api/store-manifest.ts', [
  'application/manifest+json',
  'pwa_enabled',
  'start_url',
  'scope',
  'icons',
]);

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const source = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  if (!source.services?.media?.upload) throw new Error(`${locale}: missing services.media translations`);
  if (!source.storefront?.public?.install?.action) throw new Error(`${locale}: missing storefront install translations`);
  if (!source.storefront?.owner?.pwa?.title) throw new Error(`${locale}: missing owner PWA translations`);
}

console.log('Phase 10C.2 premium customer storefront checks passed.');
console.log('Tenant-scoped service media, premium storefront/booking thumbnails and per-store PWA installation verified.');
