import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`Premium marketing check failed: ${message}`); process.exit(1); };

const app = read('src/App.tsx');
const landing = read('src/pages/marketing/IndustrySelection.tsx');
const aiPage = read('src/pages/marketing/VelliqoAI.tsx');
const preview = read('src/components/marketing/VelliqoAIPreview.tsx');
const chrome = read('src/components/marketing/MarketingChrome.tsx');
const css = read('src/index.css');
const workflow = read('.github/workflows/quality-gate.yml');
const en = JSON.parse(read('src/i18n/locales/en.json'));

if (!app.includes('path="/velliqo-ai"') || !app.includes('<VelliqoAI />')) fail('the public Velliqo AI route is missing');
if (!landing.includes('<VelliqoAIPreview compact />') || !landing.includes('<VelliqoAICallout />')) fail('the landing page must make Velliqo AI visible in the hero and product story');
const landingCopy = JSON.stringify(en.marketingSite?.pages?.product || {});
if (!/appointment-based|service business/i.test(landingCopy)) fail('translated landing copy must remain industry-neutral');
if (!preview.includes('prefers-reduced-motion: reduce')) fail('AI preview rotation must respect reduced-motion preferences');
const aiPreviewCopy = JSON.stringify(en.marketingSite?.aiPreview || {});
if (!/without approval|approval/i.test(aiPreviewCopy) || !/Review draft/i.test(aiPreviewCopy)) fail('the translated AI preview must show reviewable, non-deceptive actions');
if (!preview.includes('/brand/velliqo-ai.png')) fail('the official Velliqo AI mark is not used');
if (!chrome.includes("key: 'ai'") || !chrome.includes("labelKey: 'marketingSite.chrome.ai'") || !chrome.includes("to: '/velliqo-ai'")) fail('Velliqo AI is not a first-class translated marketing navigation item');
if (!aiPage.includes('marketingSite.pages.ai.trust') || !Array.isArray(en.marketingSite?.pages?.ai?.trust) || en.marketingSite.pages.ai.trust.length < 2) fail('AI trust boundaries are not explained through translated copy');
if (!css.includes('@keyframes velliqo-ai-enter') || !css.includes('@keyframes velliqo-marquee')) fail('premium motion foundation is missing');
if (!workflow.includes('npm run premium-marketing:check')) fail('CI does not validate the premium marketing experience');

const combined = [landing, aiPage, preview, chrome].join('\n');
for (const forbidden of ['salon or barbershop SaaS', 'Barber SaaS', '@barber-saas']) {
  if (combined.includes(forbidden)) fail(`industry-exclusive marketing reference remains: ${forbidden}`);
}

console.log('Phase 10B premium marketing experience checks passed.');
console.log('Validated: premium public landing, first-class Velliqo AI route, interactive motion preview, reviewable AI actions, responsive navigation and industry-neutral messaging.');
