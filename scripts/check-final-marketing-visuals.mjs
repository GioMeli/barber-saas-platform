import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`Final marketing visuals check failed: ${message}`);
  process.exit(1);
};

const assets = [
  'public/marketing/final/ai-mobile.png',
  'public/marketing/final/ai-laptop.png',
  'public/marketing/final/home-mobile.png',
  'public/marketing/final/calendar-mobile.png',
  'public/marketing/final/calendar-desktop.png',
  'public/marketing/final/home-laptop.png',
  'public/marketing/final/home-desktop.png',
  'public/marketing/final/storefront-responsive.png',
];

for (const asset of assets) {
  const fullPath = path.join(root, asset);
  if (!fs.existsSync(fullPath)) fail(`missing asset ${asset}`);
  if (fs.statSync(fullPath).size < 10_000) fail(`asset ${asset} is unexpectedly small`);
}

const component = read('src/components/marketing/FinalProductVisuals.tsx');
for (const token of ['FinalProductVisual', 'FinalProductPair', 'FinalProductGallery', 'object-contain', 'loading={priority']) {
  if (!component.includes(token)) fail(`FinalProductVisuals.tsx is missing ${token}`);
}

const pageRequirements = {
  'src/pages/marketing/IndustrySelection.tsx': [
    '/marketing/final/home-laptop.png',
    '/marketing/final/home-mobile.png',
    '/marketing/final/storefront-responsive.png',
    '/marketing/final/home-desktop.png',
  ],
  'src/pages/marketing/Experience.tsx': [
    '/marketing/final/home-laptop.png',
    '/marketing/final/home-mobile.png',
    '/marketing/final/calendar-desktop.png',
    '/marketing/final/calendar-mobile.png',
    '/marketing/final/ai-laptop.png',
    '/marketing/final/storefront-responsive.png',
  ],
  'src/pages/marketing/VelliqoAI.tsx': [
    '/marketing/final/ai-laptop.png',
    '/marketing/final/ai-mobile.png',
  ],
  'src/pages/marketing/WhyVelliqo.tsx': [
    '/marketing/final/home-laptop.png',
    '/marketing/final/home-mobile.png',
    '/marketing/final/calendar-desktop.png',
  ],
  'src/pages/marketing/Pricing.tsx': [
    '/marketing/final/home-laptop.png',
    '/marketing/final/home-mobile.png',
  ],
};

for (const [file, references] of Object.entries(pageRequirements)) {
  const source = read(file);
  for (const reference of references) {
    if (!source.includes(reference)) fail(`${file} is missing ${reference}`);
  }
}

for (const file of ['src/pages/marketing/IndustrySelection.tsx', 'src/pages/marketing/Experience.tsx', 'src/pages/marketing/VelliqoAI.tsx']) {
  const source = read(file);
  if (source.includes('<ResponsiveDeviceShowcase')) fail(`${file} still uses the superseded composite device showcase`);
}

console.log('Phase 10B.3 final public marketing visuals checks passed.');
console.log('Eight final device captures, responsive direct rendering and public-page placement verified.');
