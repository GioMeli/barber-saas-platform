import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import type { FinanceIntelligence } from '@/types/finance';

const EMPTY_FINANCE: FinanceIntelligence = {
  period: { startDate: '', endDate: '', currency: 'EUR' },
  summary: {
    transactionCount: 0,
    grossSales: 0,
    discounts: 0,
    netSales: 0,
    taxCollected: 0,
    tipsCollected: 0,
    collectedRevenue: 0,
    costOfGoods: 0,
    grossProfit: 0,
    paidExpenses: 0,
    pendingExpenses: 0,
    operatingProfit: 0,
    averageTicket: 0,
    grossMargin: 0,
    voidedTotal: 0,
  },
  paymentMethods: [],
  dailyPerformance: [],
  itemMix: [],
  topServices: [],
  topProducts: [],
  staffPerformance: [],
  expenseCategories: [],
  recentExpenses: [],
};

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeFinance(value: any): FinanceIntelligence {
  if (!value || typeof value !== 'object') return EMPTY_FINANCE;

  const summary = value.summary ?? {};
  const mapNumbers = <T extends Record<string, any>>(rows: T[] | undefined, keys: string[]) =>
    (Array.isArray(rows) ? rows : []).map((row) => {
      const result = { ...row } as Record<string, any>;
      keys.forEach((key) => {
        result[key] = toNumber(result[key]);
      });
      return result as T;
    });

  return {
    period: {
      startDate: String(value.period?.startDate ?? ''),
      endDate: String(value.period?.endDate ?? ''),
      currency: String(value.period?.currency ?? 'EUR'),
    },
    summary: {
      transactionCount: toNumber(summary.transactionCount),
      grossSales: toNumber(summary.grossSales),
      discounts: toNumber(summary.discounts),
      netSales: toNumber(summary.netSales),
      taxCollected: toNumber(summary.taxCollected),
      tipsCollected: toNumber(summary.tipsCollected),
      collectedRevenue: toNumber(summary.collectedRevenue),
      costOfGoods: toNumber(summary.costOfGoods),
      grossProfit: toNumber(summary.grossProfit),
      paidExpenses: toNumber(summary.paidExpenses),
      pendingExpenses: toNumber(summary.pendingExpenses),
      operatingProfit: toNumber(summary.operatingProfit),
      averageTicket: toNumber(summary.averageTicket),
      grossMargin: toNumber(summary.grossMargin),
      voidedTotal: toNumber(summary.voidedTotal),
    },
    paymentMethods: mapNumbers(value.paymentMethods, ['total', 'transactions']),
    dailyPerformance: mapNumbers(value.dailyPerformance, [
      'revenue',
      'transactions',
      'expenses',
      'profit',
    ]),
    itemMix: mapNumbers(value.itemMix, ['total', 'quantity']),
    topServices: mapNumbers(value.topServices, ['quantity', 'revenue', 'cost', 'profit']),
    topProducts: mapNumbers(value.topProducts, ['quantity', 'revenue', 'cost', 'profit']),
    staffPerformance: mapNumbers(value.staffPerformance, ['transactions', 'items', 'revenue']),
    expenseCategories: mapNumbers(value.expenseCategories, ['total', 'count']),
    recentExpenses: mapNumbers(value.recentExpenses, ['amount', 'taxAmount']),
  };
}

export function useFinanceIntelligence(
  businessId: string | undefined,
  startDate: string,
  endDate: string
) {
  const [data, setData] = useState<FinanceIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!businessId || !startDate || !endDate) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: result, error: queryError } = await (supabase as any).rpc(
      'get_finance_intelligence',
      {
        p_business_id: businessId,
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (queryError) {
      setError(queryError.message || 'Failed to load finance intelligence');
      setData(null);
    } else {
      setData(normalizeFinance(result));
    }

    setLoading(false);
  }, [businessId, startDate, endDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
