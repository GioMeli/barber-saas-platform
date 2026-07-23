import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const requireFile = (relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) failures.push(`Missing ${relative}`);
  return full;
};

const manifestPath = requireFile('public/manifest.webmanifest');
const swPath = requireFile('public/sw.js');
requireFile('public/offline.html');
requireFile('public/icons/icon-192.png');
requireFile('public/icons/icon-192-maskable.png');
requireFile('public/icons/icon-512.png');
requireFile('public/icons/icon-512-maskable.png');
requireFile('src/pwa/registerServiceWorker.ts');
requireFile('src/hooks/usePWAStatus.ts');
requireFile('src/components/pwa/PWAStatusCenter.tsx');
requireFile('src/components/pwa/ConnectivityBanner.tsx');
requireFile('.github/workflows/quality-gate.yml');

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
    if (!manifest[key]) failures.push(`Manifest missing ${key}`);
  }
  const sizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
  if (!sizes.has('192x192')) failures.push('Manifest missing 192x192 icon');
  if (!sizes.has('512x512')) failures.push('Manifest missing 512x512 icon');
  if (!(manifest.icons ?? []).some((icon) => icon.purpose === 'maskable')) failures.push('Manifest missing maskable icon');
}

if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  for (const marker of ['SKIP_WAITING', 'offline.html', "request.mode === 'navigate'", 'url.origin !== self.location.origin']) {
    if (!sw.includes(marker)) failures.push(`Service worker missing ${marker}`);
  }
  if (sw.includes('supabase.co')) failures.push('Service worker must not cache Supabase responses');
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!index.includes('rel="manifest"')) failures.push('index.html does not link the manifest');
if (!index.includes('theme-color')) failures.push('index.html missing theme color');

const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
if (!main.includes('registerVelliqoServiceWorker')) failures.push('main.tsx does not register service worker');

const layout = fs.readFileSync(path.join(root, 'src/components/layouts/OwnerDashboardLayout.tsx'), 'utf8');
if (!layout.includes('ConnectivityBanner')) failures.push('Owner layout missing connectivity banner');

const topbar = fs.readFileSync(path.join(root, 'src/components/layouts/owner-shell/OwnerTopBar.tsx'), 'utf8');
if (!topbar.includes('PWAStatusCenter')) failures.push('Owner top bar missing PWA status center');

if (failures.length) {
  console.error('Production readiness validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production readiness validation passed.');
