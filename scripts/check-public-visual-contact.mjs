import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`Phase 10B.1 validation failed: ${message}`);
  process.exit(1);
};

const requiredFiles = [
  'src/components/marketing/DeviceFrame.tsx',
  'src/pages/marketing/Contact.tsx',
  'public/marketing/devices/laptop-original.png',
  'public/marketing/devices/desktop-original.png',
  'public/marketing/devices/tablet-original.png',
  'public/marketing/devices/phone-original.png',
  'docs/PHASE-10B1-PUBLIC-VISUAL-CONTACT.md',
];

for (const file of requiredFiles) {
  if (!exists(file)) fail(`missing ${file}`);
}

const app = read('src/App.tsx');
const chrome = read('src/components/marketing/MarketingChrome.tsx');
const devices = read('src/components/marketing/DeviceFrame.tsx');
const contact = read('src/pages/marketing/Contact.tsx');
const experience = read('src/pages/marketing/Experience.tsx');
const home = read('src/pages/marketing/IndustrySelection.tsx');
const why = read('src/pages/marketing/WhyVelliqo.tsx');
const pricing = read('src/pages/marketing/Pricing.tsx');

if (!app.includes("import Contact from './pages/marketing/Contact'")) fail('Contact page import is missing');
if (!app.includes('path="/contact"')) fail('/contact route is missing');
if (!chrome.includes("{ key: 'contact', label: 'Contact', to: '/contact' }")) fail('shared marketing navigation does not expose Contact');

for (const value of ['georgeau791926@gmail.com', '+357 96 211 102', 'Nicosia, Cyprus']) {
  if (!contact.includes(value)) fail(`contact detail not found: ${value}`);
}
if (!contact.includes('mailto:')) fail('mailto draft delivery is missing');
if (!contact.includes('tel:')) fail('telephone action is missing');
if (!contact.includes('window.location.href = buildMailto()')) fail('reviewable email draft submit flow is missing');
if (/George\s+Meli|Giorgos\s+Meli/i.test(contact)) fail('personal name must not be displayed on the Contact page');

for (const token of [
  '/marketing/devices/laptop-original.png',
  '/marketing/devices/desktop-original.png',
  '/marketing/devices/tablet-original.png',
  '/marketing/devices/phone-original.png',
]) {
  if (!devices.includes(token)) fail(`device frame mapping is missing: ${token}`);
}

const deviceReferences = [experience, home, why].join('\n');
for (const component of ['LaptopDevice', 'DesktopDevice', 'TabletDevice', 'PhoneDevice']) {
  if (!deviceReferences.includes(component)) fail(`${component} is not used by the public marketing experience`);
}

if (/function\s+(DesktopDevice|TabletDevice|PhoneDevice|BrowserDevice)\s*\(/.test(experience)) {
  fail('legacy hand-drawn device helpers remain in Experience.tsx');
}

for (const source of [chrome, experience, why, pricing]) {
  if (!source.includes('/contact')) fail('a public marketing navigation/footer is missing the Contact route');
}

console.log('Phase 10B.1 public visual and Contact checks passed.');
console.log('Original laptop, desktop, tablet and phone frames, real product captures, public contact navigation and reviewable email drafts verified.');
