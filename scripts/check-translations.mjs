import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const localeDir = path.join(root, 'src', 'i18n', 'locales');
const supportedLanguages = ['en', 'el', 'de', 'es', 'tr'];

function flatten(value, prefix = '', result = new Map()) {
  for (const [key, entry] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      flatten(entry, next, result);
    } else {
      result.set(next, entry);
    }
  }
  return result;
}

function collectSourceFiles(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) collectSourceFiles(fullPath, result);
    else if (/\.(?:ts|tsx)$/.test(item.name)) result.push(fullPath);
  }
  return result;
}

const localeMaps = new Map();
for (const language of supportedLanguages) {
  const file = path.join(localeDir, `${language}.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  localeMaps.set(language, flatten(parsed));
}

const reference = localeMaps.get('en');
let failed = false;

for (const language of supportedLanguages) {
  const current = localeMaps.get(language);
  const missing = [...reference.keys()].filter((key) => !current.has(key));
  const extra = [...current.keys()].filter((key) => !reference.has(key));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${language.toUpperCase()} locale mismatch:`);
    if (missing.length) console.error(`  Missing (${missing.length}):`, missing.join(', '));
    if (extra.length) console.error(`  Extra (${extra.length}):`, extra.join(', '));
  }
}

const usedKeys = new Set();
const dynamicCalls = [];
const callPattern = /\bt\(\s*(['"])([^'"\n]+)\1/g;

for (const file of collectSourceFiles(path.join(root, 'src'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(callPattern)) {
    const key = match[2];
    // Ignore non-i18n false positives such as database `.select('...')` by
    // requiring a dotted key or a known top-level key.
    if (key.includes('.') || reference.has(key)) usedKeys.add(key);
  }

  const probableDynamic = source.match(/\bt\(\s*(?!['"])/g);
  if (probableDynamic?.length) dynamicCalls.push(path.relative(root, file));
}

const missingUsedKeys = [...usedKeys].filter((key) => !reference.has(key));
if (missingUsedKeys.length) {
  failed = true;
  console.error(`\nTranslation keys used in source but missing from en.json (${missingUsedKeys.length}):`);
  for (const key of missingUsedKeys.sort()) console.error(`  - ${key}`);
}

for (const [language, entries] of localeMaps) {
  const empty = [...entries.entries()].filter(([, value]) => typeof value !== 'string' || value.trim() === '');
  if (empty.length) {
    failed = true;
    console.error(`\n${language.toUpperCase()} has empty or non-string values (${empty.length}):`);
    for (const [key] of empty) console.error(`  - ${key}`);
  }
}

if (dynamicCalls.length) {
  console.log(`\nNote: dynamic t(...) calls found in ${dynamicCalls.length} file(s); these require review but are not treated as errors.`);
}

if (failed) process.exit(1);

console.log(`Translations valid: ${reference.size} keys across ${supportedLanguages.length} supported languages.`);
console.log(`Static source references checked: ${usedKeys.size}.`);
