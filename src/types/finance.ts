export type FinanceSummary = {
  transactionCount: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  taxCollected: number;
  tipsCollected: number;
  collectedRevenue: number;
  costOfGoods: number;
  grossProfit: number;
  paidExpenses: number;
  pendingExpenses: number;
  operatingProfit: number;
  averageTicket: number;
  grossMargin: number;
  voidedTotal: number;
};

export type FinancePaymentMethod = {
  paymentMethod: string;
  total: number;
  transactions: number;
};

export type FinanceDailyPerformance = {
  date: string;
  revenue: number;
  transactions: number;
  expenses: number;
  profit: number;
};

export type FinanceItemMix = {
  itemType: 'service' | 'product' | 'custom' | string;
  total: number;
  quantity: number;
};

export type FinanceRankedItem = {
  id: string | null;
  name: string;
  quantity: number;
  revenue: number;
  cost?: number;
  profit: number;
};

export type FinanceStaffPerformance = {
  id: string | null;
  name: string;
  transactions: number;
  items: number;
  revenue: number;
};

export type FinanceExpenseCategory = {
  category: string;
  total: number;
  count: number;
};

export type FinanceExpense = {
  id: string;
  category: string;
  description: string | null;
  supplier: string | null;
  amount: number;
  taxAmount: number;
  date: string;
  receiptUrl: string | null;
  paymentMethod: string | null;
  status: 'paid' | 'pending' | 'cancelled';
  currency: string;
  createdAt: string;
};

export type FinanceIntelligence = {
  period: {
    startDate: string;
    endDate: string;
    currency: string;
  };
  summary: FinanceSummary;
  paymentMethods: FinancePaymentMethod[];
  dailyPerformance: FinanceDailyPerformance[];
  itemMix: FinanceItemMix[];
  topServices: FinanceRankedItem[];
  topProducts: FinanceRankedItem[];
  staffPerformance: FinanceStaffPerformance[];
  expenseCategories: FinanceExpenseCategory[];
  recentExpenses: FinanceExpense[];
};
