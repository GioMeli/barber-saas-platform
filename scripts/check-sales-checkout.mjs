import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const requiredFiles = [
  'src/pages/owner/Sales.tsx',
  'supabase/migrations/00031_sales_checkout_foundation.sql',
  'src/components/layouts/owner-shell/navigation.ts',
  'src/components/layouts/owner-shell/OwnerQuickAdd.tsx',
  'src/App.tsx',
];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`Missing required file: ${file}`);
}

if (failures.length === 0) {
  const sales = read('src/pages/owner/Sales.tsx');
  const migration = read('supabase/migrations/00031_sales_checkout_foundation.sql');
  const navigation = read('src/components/layouts/owner-shell/navigation.ts');
  const quickAdd = read('src/components/layouts/owner-shell/OwnerQuickAdd.tsx');
  const app = read('src/App.tsx');

  const checks = [
    [app.includes("import Sales from './pages/owner/Sales';"), 'Sales page import is missing.'],
    [app.includes('<Route path="sales" element={<Sales />} />'), 'Sales route is missing.'],
    [navigation.includes("path: '/dashboard/sales'"), 'Sales navigation entry is missing.'],
    [quickAdd.includes("path: '/dashboard/sales?action=new'"), 'Quick Add sale action is missing.'],
    [sales.includes("rpc(\n        'complete_business_sale'"), 'Checkout RPC is not connected.'],
    [sales.includes("rpc('void_business_sale'"), 'Void RPC is not connected.'],
    [sales.includes("from('sale_transactions')"), 'Transaction history query is missing.'],
    [migration.includes('create table if not exists public.sale_transactions'), 'Sale transactions table is missing.'],
    [migration.includes('create table if not exists public.sale_items'), 'Sale items table is missing.'],
    [migration.includes('create table if not exists public.sale_payments'), 'Sale payments table is missing.'],
    [migration.includes('create or replace function public.complete_business_sale'), 'Atomic checkout function is missing.'],
    [migration.includes('create or replace function public.void_business_sale'), 'Atomic void function is missing.'],
    [migration.includes("'sale',"), 'Inventory sale movement is missing.'],
    [migration.includes("'return',"), 'Inventory restoration movement is missing.'],
    [migration.includes("set payment_status = 'paid'"), 'Appointment payment update is missing.'],
    [migration.includes("set payment_status = 'unpaid'"), 'Appointment payment rollback is missing.'],
    [migration.includes('The selected appointment has already been paid'), 'Duplicate appointment checkout protection is missing.'],
    [migration.includes('A selected item professional does not belong to this business'), 'Per-item professional validation is missing.'],
    [migration.includes('for update;'), 'Transactional row locking is missing.'],
    [(migration.match(/\$\$/g) ?? []).length % 2 === 0, 'SQL function delimiters are unbalanced.'],
    [!sales.toLowerCase().includes('fresha'), 'Sales workspace contains a Fresha reference.'],
  ];

  for (const [passed, message] of checks) {
    if (!passed) failures.push(message);
  }
}

const supportedLocales = ['en', 'el', 'de', 'es', 'tr'];
const requiredLocalePaths = [
  ['dashboard', 'sales'],
  ['navigation', 'quick_actions', 'sale'],
  ['sales', 'title'],
  ['sales', 'tabs', 'checkout'],
  ['sales', 'tabs', 'transactions'],
  ['sales', 'actions', 'completeSale'],
  ['sales', 'actions', 'voidSale'],
  ['sales', 'paymentMethods', 'cash'],
  ['sales', 'paymentMethods', 'card'],
  ['sales', 'messages', 'completed'],
  ['sales', 'messages', 'voided'],
];

for (const locale of supportedLocales) {
  const localePath = path.join(root, 'src', 'i18n', 'locales', `${locale}.json`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  } catch (error) {
    failures.push(`Invalid locale JSON (${locale}): ${error.message}`);
    continue;
  }

  for (const keyPath of requiredLocalePaths) {
    const value = keyPath.reduce((current, key) => current?.[key], data);
    if (typeof value !== 'string' || value.trim() === '') {
      failures.push(`Missing locale value (${locale}): ${keyPath.join('.')}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Sales checkout validation failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Sales checkout validation passed.');
console.log('Validated: route, navigation, Quick Add, atomic checkout/void RPCs, duplicate-payment protection, tenant validation, stock rollback, appointment payment status and 5-locale coverage.');
