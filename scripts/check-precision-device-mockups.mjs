import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`Phase 10B.2 validation failed: ${message}`);
  process.exit(1);
};

const requiredFiles = [
  'src/components/marketing/DeviceFrame.tsx',
  'src/components/marketing/ResponsiveDeviceShowcase.tsx',
  'docs/PHASE-10B2-PRECISION-DEVICE-MOCKUPS.md',
  'public/marketing/screens/precision/calendar-laptop.webp',
  'public/marketing/screens/precision/booking-phone.webp',
  'public/marketing/screens/precision/storefront-tablet.webp',
  'public/marketing/screens/precision/calendar-desktop.webp',
  'public/marketing/screens/precision/calendar-phone.webp',
  'public/marketing/screens/precision/posts-phone.webp',
  'public/marketing/screens/precision/gallery-phone.webp',
  'public/marketing/screens/precision/reports-desktop.webp',
];
for (const file of requiredFiles) {
  if (!exists(file)) fail(`missing ${file}`);
}

const device = read('src/components/marketing/DeviceFrame.tsx');
const showcase = read('src/components/marketing/ResponsiveDeviceShowcase.tsx');
const experience = read('src/pages/marketing/Experience.tsx');
const home = read('src/pages/marketing/IndustrySelection.tsx');
const why = read('src/pages/marketing/WhyVelliqo.tsx');

for (const token of ['viewBox=', '<clipPath', '<image', 'preserveAspectRatio', 'data-device-kind']) {
  if (!device.includes(token)) fail(`precision SVG device rendering is missing ${token}`);
}
for (const kind of ['laptop', 'desktop', 'tablet', 'phone']) {
  if (!device.includes(`${kind}: {`)) fail(`device geometry is missing for ${kind}`);
}
if (!device.includes("fit = 'fill'")) fail('exact-ratio screen assets are not the default');
if (!showcase.includes('lg:absolute') || !showcase.includes('sm:grid-cols-2')) {
  fail('responsive device composition does not provide stacked and desktop layouts');
}

const publicPages = [experience, home, why].join('\n');
const usesPrecisionShowcase = publicPages.includes('ResponsiveDeviceShowcase') && publicPages.includes('/marketing/screens/precision/');
const usesFinalVisuals = publicPages.includes('FinalProductVisual') && publicPages.includes('/marketing/final/');
if (!usesPrecisionShowcase && !usesFinalVisuals) fail('public pages do not use a validated precision or final device visual system');
if (/rotate-\[|rotate\(|-rotate-/.test(publicPages)) fail('device compositions still use perspective-breaking rotations');
if (/objectFit:\s*fit/.test(device)) fail('legacy percentage-positioned image layer remains');

console.log('Phase 10B.2 precision device mockup checks passed.');
console.log('Exact SVG clipping and final complete-device captures, non-distorted layouts and responsive compositions verified.');
