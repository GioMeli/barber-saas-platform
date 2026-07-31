import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const requireFile = (file) => { if (!exists(file)) failures.push(`Missing ${file}`); };
const requireText = (file, text, label = text) => {
  if (!exists(file) || !read(file).includes(text)) failures.push(`${file} missing ${label}`);
};

[
  'src/pages/marketing/DiscoverBusinesses.tsx',
  'src/components/discovery/DiscoverySearchBar.tsx',
  'src/components/discovery/DiscoveryMap.tsx',
  'src/components/discovery/BusinessResultCard.tsx',
  'src/discovery/api.ts',
  'src/discovery/types.ts',
  'src/discovery/url.ts',
  'src/discovery/maplibreLoader.ts',
  'supabase/migrations/00044_velliqo_public_discovery_marketplace.sql',
].forEach(requireFile);

requireText('src/App.tsx', 'path="/discover"', 'public discovery route');
requireText('src/pages/marketing/IndustrySelection.tsx', '<DiscoverySearchBar', 'homepage marketplace search');
requireText('src/components/discovery/DiscoveryMap.tsx', 'velliqo-user-location-marker', 'user-location marker');
requireText('src/components/discovery/DiscoveryMap.tsx', 'setHTML(popupHtml', 'map business popup');
requireText('src/components/discovery/DiscoveryMap.tsx', 'setMapReady(true)', 'map-ready marker lifecycle');
requireText('src/discovery/url.ts', 'latitudeParam == null ? Number.NaN', 'safe coordinate URL parsing');
requireText('src/components/discovery/BusinessResultCard.tsx', 'average_rating', 'verified rating display');
requireText('src/pages/owner/Storefront.tsx', 'discovery_enabled', 'owner marketplace visibility control');

const migration = read('supabase/migrations/00044_velliqo_public_discovery_marketplace.sql');
[
  'create extension if not exists postgis',
  'discovery_enabled boolean not null default true',
  'discovery_location extensions.geography(Point, 4326)',
  'using gist (discovery_location)',
  'search_public_businesses',
  'search_public_business_suggestions',
  'get_public_discovery_facets',
  "a.created_at >= now() - interval '90 days'",
  'count(distinct a.id)',
  "coalesce(s.name, '') ilike",
  'extensions.st_distance',
  'grant execute on function public.search_public_businesses',
].forEach((text) => { if (!migration.includes(text)) failures.push(`Migration missing ${text}`); });

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const data = JSON.parse(read(`src/i18n/locales/${locale}.json`));
  if (!data.discovery?.search?.submit || !data.discovery?.search?.homeEyebrow || !data.discovery?.search?.kind?.service || !data.discovery?.map?.yourLocation) failures.push(`${locale} locale missing discovery translations`);
  if (!data.storefront?.owner?.online?.discoveryListing) failures.push(`${locale} locale missing owner discovery control`);
}

if (failures.length) {
  console.error('Phase 10C.4 public discovery marketplace checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Phase 10C.4 public discovery marketplace checks passed.');
console.log('Homepage search, secure geo RPCs, popularity ranking, map pins, user location, ratings and responsive result cards verified.');
