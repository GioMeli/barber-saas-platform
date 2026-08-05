import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const failures = [];

function fail(message) { failures.push(message); }
function read(relative) { return fs.readFileSync(path.join(root, relative)); }
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function assertTransparentPng(relative) {
  const buffer = read(relative);
  if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return fail(`${relative} is not a PNG`);
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = -1;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4;
    const type = buffer.toString('ascii', offset, offset + 4); offset += 4;
    const data = buffer.subarray(offset, offset + length); offset += length + 4;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || colorType !== 6) return fail(`${relative} must be an 8-bit RGBA PNG`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  let pos = 0, previous = Buffer.alloc(stride), hasTransparent = false, hasOpaque = false;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const scan = Buffer.from(raw.subarray(pos, pos + stride)); pos += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? scan[x - bpp] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= bpp ? previous[x - bpp] : 0;
      if (filter === 1) scan[x] = (scan[x] + left) & 255;
      else if (filter === 2) scan[x] = (scan[x] + up) & 255;
      else if (filter === 3) scan[x] = (scan[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) scan[x] = (scan[x] + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) return fail(`${relative} uses unsupported PNG filter ${filter}`);
    }
    for (let x = 3; x < stride; x += 4) {
      if (scan[x] === 0) hasTransparent = true;
      if (scan[x] === 255) hasOpaque = true;
    }
    previous = scan;
  }
  if (!hasTransparent || !hasOpaque) fail(`${relative} must contain both transparent background and visible artwork`);
}

for (const file of [
  'public/brand/velliqo-mark.png',
  'public/icons/favicon-32.png',
  'public/icons/favicon-48.png',
  'public/icons/apple-touch-icon.png',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
]) assertTransparentPng(file);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
if ((manifest.icons ?? []).some((icon) => icon.purpose === 'maskable')) fail('generic Velliqo manifest must not request an opaque maskable plate');
if (!(manifest.icons ?? []).some((icon) => icon.sizes === '192x192' && icon.purpose === 'any')) fail('generic manifest missing transparent 192x192 any icon');
if (!(manifest.icons ?? []).some((icon) => icon.sizes === '512x512' && icon.purpose === 'any')) fail('generic manifest missing transparent 512x512 any icon');

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const marker of ['/icons/favicon-32.png?v=2', '/icons/icon-192.png?v=2', '/icons/apple-touch-icon.png?v=2']) {
  if (!index.includes(marker)) fail(`index.html missing transparent brand asset ${marker}`);
}
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
if (!sw.includes('velliqo-pwa-v2-transparent-brand')) fail('service-worker cache version was not bumped for transparent branding');

for (const file of [
  'src/components/layouts/owner-shell/OwnerSidebar.tsx',
  'src/components/marketing/MarketingChrome.tsx',
  'src/pages/auth/SignIn.tsx',
  'src/pages/auth/SignUp.tsx',
  'src/components/demo/DemoOwnerLayout.tsx',
]) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const positions = [...text.matchAll(/\/brand\/velliqo-mark\.png/g)].map((match) => match.index ?? 0);
  for (const position of positions) {
    const nearby = text.slice(position, position + 260);
    if (/border border-white|shadow-lg|bg-(?:black|slate|sidebar)/.test(nearby)) fail(`${file} still places the Velliqo mark on an application-owned visual plate`);
  }
}

if (failures.length) {
  console.error('Transparent Velliqo branding validation failed:');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log('Phase 12B transparent Velliqo branding validation passed.');
