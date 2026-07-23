import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import {
  Download,
  ExternalLink,
  FileText,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useFinanceIntelligence } from '@/hooks/useFinanceIntelligence';
import { supabase } from '@/db/supabase';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import FinanceOverview from '@/components/finance/FinanceOverview';
import type { FinanceExpense } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Payroll',
  'Utilities',
  'Inventory',
  'Marketing',
  'Software',
  'Insurance',
  'Maintenance',
  'Professional services',
  'Training',
  'Travel',
  'Other',
];

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'online', 'other'];

type ExpenseForm = {
  category: string;
  description: string;
  supplier: string;
  amount: string;
  taxAmount: string;
  date: string;
  receiptUrl: string;
  paymentMethod: string;
  status: 'paid' | 'pending' | 'cancelled';
};

const createEmptyExpense = (): ExpenseForm => ({
  category: 'Other',
  description: '',
  supplier: '',
  amount: '',
  taxAmount: '0',
  date: format(new Date(), 'yyyy-MM-dd'),
  receiptUrl: '',
  paymentMethod: 'card',
  status: 'paid',
});

export default function Finance() {
  const { activeBusiness } = useAuth();
  const businessId = activeBusiness?.id;
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [searchParams, setSearchParams] = useSearchParams();

  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [view, setView] = useState<'overview' | 'expenses'>('overview');
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinanceExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(createEmptyExpense);
  const [savingExpense, setSavingExpense] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceExpense['status']>('all');

  const { data, loading, error, refresh } = useFinanceIntelligence(
    businessId,
    dateRange.start,
    dateRange.end
  );

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openNewExpense();
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: data?.period.currency || 'EUR',
    }).format(value);

  const filteredExpenses = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (data?.recentExpenses ?? []).filter((expense) => {
      if (statusFilter !== 'all' && expense.status !== statusFilter) return false;
      if (!normalized) return true;
      return [expense.category, expense.description, expense.supplier, expense.paymentMethod]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized));
    });
  }, [data?.recentExpenses, search, statusFilter]);

  const applyPreset = (preset: 'week' | 'month' | 'previous_month' | '90_days') => {
    const now = new Date();
    if (preset === 'week') {
      setDateRange({
        start: format(startOfWeek(now), 'yyyy-MM-dd'),
        end: format(endOfWeek(now), 'yyyy-MM-dd'),
      });
      return;
    }
    if (preset === '90_days') {
      setDateRange({
        start: format(subDays(now, 89), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd'),
      });
      return;
    }
    const target = preset === 'previous_month' ? subMonths(now, 1) : now;
    setDateRange({
      start: format(startOfMonth(target), 'yyyy-MM-dd'),
      end: format(endOfMonth(target), 'yyyy-MM-dd'),
    });
  };

  function openNewExpense() {
    setEditingExpense(null);
    setExpenseForm(createEmptyExpense());
    setExpenseDialogOpen(true);
  }

  function openEditExpense(expense: FinanceExpense) {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category || 'Other',
      description: expense.description || '',
      supplier: expense.supplier || '',
      amount: String(expense.amount),
      taxAmount: String(expense.taxAmount || 0),
      date: expense.date,
      receiptUrl: expense.receiptUrl || '',
      paymentMethod: expense.paymentMethod || 'card',
      status: expense.status,
    });
    setExpenseDialogOpen(true);
  }

  const saveExpense = async () => {
    if (!businessId) return;

    const amount = Number(expenseForm.amount);
    const taxAmount = Number(expenseForm.taxAmount || 0);

    if (!expenseForm.category.trim() || !expenseForm.date || !Number.isFinite(amount) || amount <= 0) {
      toast.error(t('finance.errors.requiredExpenseFields'));
      return;
    }

    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      toast.error(t('finance.errors.invalidTax'));
      return;
    }

    setSavingExpense(true);

    const payload = {
      business_id: businessId,
      category: expenseForm.category.trim(),
      description: expenseForm.description.trim() || null,
      supplier: expenseForm.supplier.trim() || null,
      amount,
      tax_amount: taxAmount,
      date: expenseForm.date,
      receipt_url: expenseForm.receiptUrl.trim() || null,
      payment_method: expenseForm.paymentMethod || null,
      status: expenseForm.status,
      currency: 'EUR',
    };

    const result = editingExpense
      ? await (supabase as any)
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id)
          .eq('business_id', businessId)
      : await (supabase as any).from('expenses').insert(payload);

    setSavingExpense(false);

    if (result.error) {
      toast.error(result.error.message || t('finance.errors.saveFailed'));
      return;
    }

    toast.success(
      editingExpense ? t('finance.messages.expenseUpdated') : t('finance.messages.expenseCreated')
    );
    setExpenseDialogOpen(false);
    setEditingExpense(null);
    setExpenseForm(createEmptyExpense());
    await refresh();
  };

  const deleteExpense = async (expense: FinanceExpense) => {
    if (!businessId) return;
    if (!window.confirm(t('finance.confirmations.deleteExpense'))) return;

    const { error: deleteError } = await (supabase as any)
      .from('expenses')
      .delete()
      .eq('id', expense.id)
      .eq('business_id', businessId);

    if (deleteError) {
      toast.error(deleteError.message || t('finance.errors.deleteFailed'));
      return;
    }

    toast.success(t('finance.messages.expenseDeleted'));
    await refresh();
  };

  const exportFinanceCsv = () => {
    if (!data) return;

    const rows: Array<Array<string | number>> = [
      [t('finance.export.title')],
      [t('finance.export.business'), activeBusiness?.name || ''],
      [t('finance.export.period'), `${dateRange.start} — ${dateRange.end}`],
      [],
      [t('finance.export.metric'), t('finance.export.value')],
      [t('finance.metrics.collectedRevenue'), data.summary.collectedRevenue.toFixed(2)],
      [t('finance.metrics.netSales'), data.summary.netSales.toFixed(2)],
      [t('finance.metrics.grossProfit'), data.summary.grossProfit.toFixed(2)],
      [t('finance.metrics.paidExpenses'), data.summary.paidExpenses.toFixed(2)],
      [t('finance.metrics.operatingProfit'), data.summary.operatingProfit.toFixed(2)],
      [t('finance.metrics.taxCollected'), data.summary.taxCollected.toFixed(2)],
      [t('finance.metrics.tipsCollected'), data.summary.tipsCollected.toFixed(2)],
      [t('finance.metrics.costOfGoods'), data.summary.costOfGoods.toFixed(2)],
      [t('finance.metrics.grossMargin'), `${data.summary.grossMargin.toFixed(2)}%`],
      [],
      [
        t('finance.expenses.date'),
        t('finance.expenses.category'),
        t('finance.expenses.supplier'),
        t('finance.expenses.description'),
        t('finance.expenses.amount'),
        t('finance.expenses.tax'),
        t('finance.expenses.status'),
        t('finance.expenses.paymentMethod'),
      ],
      ...data.recentExpenses.map((expense) => [
        expense.date,
        expense.category,
        expense.supplier || '',
        expense.description || '',
        expense.amount.toFixed(2),
        expense.taxAmount.toFixed(2),
        expense.status,
        expense.paymentMethod || '',
      ]),
    ];

    const content = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `velliqo-finance-${dateRange.start}-${dateRange.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-page pb-12">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('finance.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('finance.title')}</h1>
          <p className="app-page-description">{t('finance.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('finance.actions.refresh')}
          </Button>
          <Button variant="outline" onClick={exportFinanceCsv} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            {t('finance.actions.export')}
          </Button>
          <Button onClick={openNewExpense}>
            <Plus className="mr-2 h-4 w-4" />
            {t('finance.actions.addExpense')}
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden rounded-3xl border-primary/10 shadow-card">
        <div className="h-1 bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400" />
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <DateField
              label={t('finance.filters.startDate')}
              value={dateRange.start}
              onChange={(start) => setDateRange((current) => ({ ...current, start }))}
            />
            <DateField
              label={t('finance.filters.endDate')}
              value={dateRange.end}
              onChange={(end) => setDateRange((current) => ({ ...current, end }))}
            />
            <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1 xl:justify-end">
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('week')}>
                {t('finance.filters.thisWeek')}
              </Button>
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('month')}>
                {t('finance.filters.thisMonth')}
              </Button>
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('previous_month')}>
                {t('finance.filters.previousMonth')}
              </Button>
              <Button className="shrink-0" variant="outline" onClick={() => applyPreset('90_days')}>
                {t('finance.filters.last90Days')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex w-full max-w-md rounded-2xl border bg-muted/35 p-1">
        {(['overview', 'expenses'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setView(item)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              view === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {item === 'overview' ? <WalletCards className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {t(`finance.views.${item}`)}
          </button>
        ))}
      </div>

      {error && (
        <Card className="rounded-3xl border-destructive/20 bg-destructive/5">
          <CardContent className="p-6">
            <h3 className="font-bold text-destructive">{t('finance.states.unavailableTitle')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t('finance.states.migrationRequired')}</p>
          </CardContent>
        </Card>
      )}

      {loading && !data ? (
        <div className="rounded-3xl border bg-card p-16 text-center shadow-card">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">{t('finance.states.loading')}</p>
        </div>
      ) : data && view === 'overview' ? (
        <FinanceOverview data={data} />
      ) : data ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">{t('finance.expenses.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('finance.expenses.description', { count: filteredExpenses.length })}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('finance.expenses.searchPlaceholder')}
                  className="pl-9"
                />
              </div>
              <label className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as any)}
                  className="h-10 rounded-md border border-input bg-background pl-9 pr-8 text-sm"
                  aria-label={t('finance.expenses.statusFilter')}
                >
                  <option value="all">{t('finance.expenses.allStatuses')}</option>
                  <option value="paid">{t('finance.statuses.paid')}</option>
                  <option value="pending">{t('finance.statuses.pending')}</option>
                  <option value="cancelled">{t('finance.statuses.cancelled')}</option>
                </select>
              </label>
            </div>
          </div>

          <ExpenseList
            expenses={filteredExpenses}
            money={money}
            locale={locale}
            onEdit={openEditExpense}
            onDelete={(expense) => void deleteExpense(expense)}
            t={t}
          />
        </section>
      ) : null}

      <Dialog open={expenseDialogOpen} onOpenChange={(open) => !savingExpense && setExpenseDialogOpen(open)}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? t('finance.dialog.editTitle') : t('finance.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('finance.dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2 sm:grid-cols-2">
            <FormField label={t('finance.expenses.category')}>
              <select
                value={expenseForm.category}
                onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`finance.categories.${toTranslationKey(category)}`, { defaultValue: category })}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={t('finance.expenses.date')}>
              <Input
                type="date"
                value={expenseForm.date}
                max={format(addDays(new Date(), 365), 'yyyy-MM-dd')}
                onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
              />
            </FormField>

            <FormField label={t('finance.expenses.amount')}>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
              />
            </FormField>

            <FormField label={t('finance.expenses.tax')}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.taxAmount}
                onChange={(event) => setExpenseForm((current) => ({ ...current, taxAmount: event.target.value }))}
                placeholder="0.00"
              />
            </FormField>

            <FormField label={t('finance.expenses.supplier')}>
              <Input
                value={expenseForm.supplier}
                onChange={(event) => setExpenseForm((current) => ({ ...current, supplier: event.target.value }))}
                placeholder={t('finance.expenses.supplierPlaceholder')}
              />
            </FormField>

            <FormField label={t('finance.expenses.paymentMethod')}>
              <select
                value={expenseForm.paymentMethod}
                onChange={(event) => setExpenseForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`finance.paymentMethods.${method}`, { defaultValue: method })}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={t('finance.expenses.status')}>
              <select
                value={expenseForm.status}
                onChange={(event) => setExpenseForm((current) => ({ ...current, status: event.target.value as ExpenseForm['status'] }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="paid">{t('finance.statuses.paid')}</option>
                <option value="pending">{t('finance.statuses.pending')}</option>
                <option value="cancelled">{t('finance.statuses.cancelled')}</option>
              </select>
            </FormField>

            <FormField label={t('finance.expenses.receiptUrl')}>
              <Input
                type="url"
                value={expenseForm.receiptUrl}
                onChange={(event) => setExpenseForm((current) => ({ ...current, receiptUrl: event.target.value }))}
                placeholder="https://"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label={t('finance.expenses.description')}>
                <Textarea
                  value={expenseForm.description}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder={t('finance.expenses.descriptionPlaceholder')}
                  rows={4}
                />
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialogOpen(false)} disabled={savingExpense}>
              {t('finance.actions.cancel')}
            </Button>
            <Button onClick={() => void saveExpense()} disabled={savingExpense}>
              {savingExpense ? t('finance.actions.saving') : t('finance.actions.saveExpense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ExpenseList({ expenses, money, locale, onEdit, onDelete, t }: any) {
  if (!expenses.length) {
    return (
      <Card className="rounded-3xl shadow-card">
        <CardContent className="p-14 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-bold">{t('finance.states.noExpensesTitle')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t('finance.states.noExpensesDescription')}</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(`${date}T00:00:00`)
    );

  return (
    <Card className="overflow-hidden rounded-3xl shadow-card">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">{t('finance.expenses.date')}</th>
              <th className="px-5 py-3 font-semibold">{t('finance.expenses.expense')}</th>
              <th className="px-5 py-3 font-semibold">{t('finance.expenses.supplier')}</th>
              <th className="px-5 py-3 font-semibold">{t('finance.expenses.status')}</th>
              <th className="px-5 py-3 text-right font-semibold">{t('finance.expenses.tax')}</th>
              <th className="px-5 py-3 text-right font-semibold">{t('finance.expenses.amount')}</th>
              <th className="px-5 py-3 text-right font-semibold">{t('finance.expenses.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.map((expense: FinanceExpense) => (
              <tr key={expense.id} className="hover:bg-muted/20">
                <td className="whitespace-nowrap px-5 py-4">{formatDate(expense.date)}</td>
                <td className="max-w-[300px] px-5 py-4">
                  <div className="font-semibold">{expense.category}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {expense.description || t('finance.common.noDescription')}
                  </div>
                </td>
                <td className="px-5 py-4 text-muted-foreground">{expense.supplier || '—'}</td>
                <td className="px-5 py-4"><ExpenseStatus status={expense.status} t={t} /></td>
                <td className="px-5 py-4 text-right">{money(expense.taxAmount)}</td>
                <td className="px-5 py-4 text-right font-bold">{money(expense.amount)}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    {expense.receiptUrl && (
                      <Button variant="ghost" size="icon" asChild title={t('finance.expenses.openReceipt')}>
                        <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onEdit(expense)} title={t('finance.actions.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(expense)} title={t('finance.actions.delete')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y lg:hidden">
        {expenses.map((expense: FinanceExpense) => (
          <article key={expense.id} className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{expense.category}</h3>
                  <ExpenseStatus status={expense.status} t={t} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(expense.date)}</p>
              </div>
              <strong className="shrink-0 text-lg">{money(expense.amount)}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoCell label={t('finance.expenses.supplier')} value={expense.supplier || '—'} />
              <InfoCell label={t('finance.expenses.tax')} value={money(expense.taxAmount)} />
            </div>
            {expense.description && <p className="text-sm text-muted-foreground">{expense.description}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              {expense.receiptUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />{t('finance.expenses.receipt')}
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onEdit(expense)}>
                <Pencil className="mr-2 h-4 w-4" />{t('finance.actions.edit')}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(expense)}>
                <Trash2 className="mr-2 h-4 w-4" />{t('finance.actions.delete')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

function ExpenseStatus({ status, t }: { status: FinanceExpense['status']; t: any }) {
  const classes = {
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <Badge variant="outline" className={classes[status]}>
      {t(`finance.statuses.${status}`)}
    </Badge>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/35 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-semibold">{value}</div>
    </div>
  );
}

function toTranslationKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
