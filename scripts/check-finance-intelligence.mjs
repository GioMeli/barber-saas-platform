import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/pages/owner/Finance.tsx', [
    'useFinanceIntelligence',
    "from('expenses')",
    'FinanceOverview',
    'action',
    'exportFinanceCsv',
  ]],
  ['src/hooks/useFinanceIntelligence.ts', [
    'get_finance_intelligence',
    'normalizeFinance',
  ]],
  ['src/components/finance/FinanceOverview.tsx', [
    'collectedRevenue',
    'operatingProfit',
    'dailyPerformance',
    'paymentMethods',
  ]],
  ['src/App.tsx', ['path="finance"', '<Finance />']],
  ['src/components/layouts/owner-shell/navigation.ts', [
    "key: 'finance'",
    "path: '/dashboard/finance'",
  ]],
  ['src/components/layouts/owner-shell/OwnerQuickAdd.tsx', [
    "key: 'expense'",
    "/dashboard/finance?action=new",
  ]],
  ['src/pages/owner/Reports.tsx', [
    "| 'finance'",
    "activeTab === 'finance'",
    'FinanceOverview',
  ]],
  ['supabase/migrations/00032_finance_intelligence.sql', [
    'get_finance_intelligence',
    'Business members can manage expenses',
    'public.has_business_access',
    'sale_transactions',
    'sale_items',
    'sale_payments',
    'operatingProfit',
  ]],
];

let failed = false;
for (const [relative, needles] of checks) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    console.error(`FAIL missing ${relative}`);
    failed = true;
    continue;
  }
  const source = fs.readFileSync(absolute, 'utf8');
  for (const needle of needles) {
    if (!source.includes(needle)) {
      console.error(`FAIL ${relative} missing: ${needle}`);
      failed = true;
    }
  }
}

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const file = path.join(root, `src/i18n/locales/${locale}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const required = [
    json.dashboard?.finance,
    json.navigation?.quick_actions?.expense,
    json.reports?.tabs?.finance,
    json.finance?.title,
    json.finance?.metrics?.operatingProfit,
    json.finance?.expenses?.title,
  ];
  if (required.some((value) => typeof value !== 'string' || !value.trim())) {
    console.error(`FAIL incomplete finance translations in ${locale}.json`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('PASS Velliqo Finance & Reports Intelligence checks');
