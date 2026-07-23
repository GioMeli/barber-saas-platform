import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BadgeEuro,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Percent,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import type { FinanceIntelligence } from '@/types/finance';

type Props = {
  data: FinanceIntelligence;
  compact?: boolean;
};

export default function FinanceOverview({ data, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const currency = data.period.currency || 'EUR';
  const summary = data.summary;

  const money = (value: number, digits = 2) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
    }).format(new Date(`${value}T00:00:00`));

  const primaryMetrics = [
    {
      label: t('finance.metrics.collectedRevenue'),
      value: money(summary.collectedRevenue),
      detail: t('finance.metrics.transactionsDetail', {
        count: summary.transactionCount,
      }),
      icon: WalletCards,
      tone: 'primary',
    },
    {
      label: t('finance.metrics.netSales'),
      value: money(summary.netSales),
      detail: t('finance.metrics.discountsDetail', {
        value: money(summary.discounts),
      }),
      icon: BadgeEuro,
      tone: 'violet',
    },
    {
      label: t('finance.metrics.grossProfit'),
      value: money(summary.grossProfit),
      detail: t('finance.metrics.marginDetail', {
        value: summary.grossMargin.toFixed(1),
      }),
      icon: TrendingUp,
      tone: summary.grossProfit >= 0 ? 'emerald' : 'rose',
    },
    {
      label: t('finance.metrics.operatingProfit'),
      value: money(summary.operatingProfit),
      detail: t('finance.metrics.expensesDetail', {
        value: money(summary.paidExpenses),
      }),
      icon: summary.operatingProfit >= 0 ? TrendingUp : TrendingDown,
      tone: summary.operatingProfit >= 0 ? 'emerald' : 'rose',
    },
  ];

  const secondaryMetrics = [
    {
      label: t('finance.metrics.averageTicket'),
      value: money(summary.averageTicket),
      icon: CircleDollarSign,
    },
    {
      label: t('finance.metrics.costOfGoods'),
      value: money(summary.costOfGoods),
      icon: ReceiptText,
    },
    {
      label: t('finance.metrics.taxCollected'),
      value: money(summary.taxCollected),
      icon: Percent,
    },
    {
      label: t('finance.metrics.pendingExpenses'),
      value: money(summary.pendingExpenses),
      icon: Banknote,
    },
  ];

  const highestExpense = data.expenseCategories[0];
  const leadingPayment = data.paymentMethods[0];
  const positiveProfit = summary.operatingProfit >= 0;

  return (
    <div className={compact ? 'space-y-5' : 'space-y-6'}>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryMetrics.map((metric) => (
          <FinanceMetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryMetrics.map((metric) => (
          <Card key={metric.label} className="rounded-2xl shadow-card">
            <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.label}
                </p>
                <div className="mt-2 text-xl font-extrabold tracking-tight">{metric.value}</div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <metric.icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden rounded-3xl border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-card">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t('finance.insights.label')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t('finance.insights.transactionBased')}
                </span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight">
                {positiveProfit
                  ? t('finance.insights.positiveTitle')
                  : t('finance.insights.negativeTitle')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {positiveProfit
                  ? t('finance.insights.positiveDescription', {
                      profit: money(summary.operatingProfit),
                      margin: summary.grossMargin.toFixed(1),
                    })
                  : t('finance.insights.negativeDescription', {
                      profit: money(Math.abs(summary.operatingProfit)),
                    })}
              </p>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:min-w-[430px]">
              <InsightTile
                label={t('finance.insights.largestExpense')}
                value={highestExpense?.category || t('finance.common.noData')}
                detail={highestExpense ? money(highestExpense.total) : '—'}
              />
              <InsightTile
                label={t('finance.insights.leadingPayment')}
                value={
                  leadingPayment
                    ? t(`finance.paymentMethods.${leadingPayment.paymentMethod}`, {
                        defaultValue: leadingPayment.paymentMethod,
                      })
                    : t('finance.common.noData')
                }
                detail={leadingPayment ? money(leadingPayment.total) : '—'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <ChartCard
          title={t('finance.charts.performanceTitle')}
          description={t('finance.charts.performanceDescription')}
        >
          {data.dailyPerformance.length ? (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyPerformance} margin={{ left: 4, right: 12, top: 12 }}>
                  <defs>
                    <linearGradient id="financeRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dateLabel}
                    minTickGap={28}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickFormatter={(value: any) => money(Number(value), 0)} width={72} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(label: any) => dateLabel(String(label))}
                    formatter={(value: any, name: any) => [
                      money(Number(value)),
                      name === 'revenue'
                        ? t('finance.charts.revenue')
                        : name === 'expenses'
                          ? t('finance.charts.expenses')
                          : t('finance.charts.profit'),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#financeRevenueFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="hsl(142 71% 38%)"
                    strokeWidth={2}
                    fill="transparent"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="hsl(0 72% 51%)"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text={t('finance.states.noTransactionData')} />
          )}
        </ChartCard>

        <ChartCard
          title={t('finance.charts.paymentTitle')}
          description={t('finance.charts.paymentDescription')}
        >
          {data.paymentMethods.length ? (
            <div className="space-y-4">
              {data.paymentMethods.map((row) => {
                const max = Math.max(...data.paymentMethods.map((item) => item.total), 1);
                return (
                  <div key={row.paymentMethod}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <CreditCard className="h-4 w-4 text-primary" />
                        {t(`finance.paymentMethods.${row.paymentMethod}`, {
                          defaultValue: row.paymentMethod,
                        })}
                      </span>
                      <span className="text-right">
                        <strong>{money(row.total)}</strong>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('finance.common.transactionsShort', { count: row.transactions })}
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400"
                        style={{ width: `${Math.max((row.total / max) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text={t('finance.states.noPaymentData')} />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title={t('finance.charts.itemMixTitle')}
          description={t('finance.charts.itemMixDescription')}
        >
          {data.itemMix.length ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.itemMix} layout="vertical" margin={{ left: 22, right: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                  <XAxis type="number" tickFormatter={(value: any) => money(Number(value), 0)} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="itemType"
                    tickFormatter={(value) =>
                      t(`finance.itemTypes.${value}`, { defaultValue: String(value) })
                    }
                    width={86}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: any) => [money(Number(value)), t('finance.charts.revenue')]}
                    labelFormatter={(value: any) =>
                      t(`finance.itemTypes.${value}`, { defaultValue: String(value) })
                    }
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text={t('finance.states.noItemData')} />
          )}
        </ChartCard>

        <ChartCard
          title={t('finance.charts.expenseCategoryTitle')}
          description={t('finance.charts.expenseCategoryDescription')}
        >
          {data.expenseCategories.length ? (
            <div className="space-y-4">
              {data.expenseCategories.map((row) => {
                const max = Math.max(...data.expenseCategories.map((item) => item.total), 1);
                return (
                  <div key={row.category}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold">{row.category}</span>
                      <span>
                        <strong>{money(row.total)}</strong>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('finance.common.entriesShort', { count: row.count })}
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-300"
                        style={{ width: `${Math.max((row.total / max) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text={t('finance.states.noExpenseData')} />
          )}
        </ChartCard>
      </section>

      {!compact && (
        <section className="grid gap-5 xl:grid-cols-3">
          <RankedCard
            title={t('finance.rankings.services')}
            rows={data.topServices.map((row) => ({
              label: row.name,
              value: money(row.revenue),
              detail: t('finance.common.quantityShort', { value: row.quantity }),
            }))}
            empty={t('finance.states.noServiceSales')}
          />
          <RankedCard
            title={t('finance.rankings.products')}
            rows={data.topProducts.map((row) => ({
              label: row.name,
              value: money(row.revenue),
              detail: t('finance.common.profitShort', { value: money(row.profit) }),
            }))}
            empty={t('finance.states.noProductSales')}
          />
          <RankedCard
            title={t('finance.rankings.staff')}
            rows={data.staffPerformance.map((row) => ({
              label: row.name,
              value: money(row.revenue),
              detail: t('finance.common.transactionsShort', { count: row.transactions }),
            }))}
            empty={t('finance.states.noStaffSales')}
          />
        </section>
      )}
    </div>
  );
}

function FinanceMetricCard({ label, value, detail, icon: Icon, tone }: any) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/15',
    violet: 'bg-violet-500/10 text-violet-700 border-violet-500/15',
    emerald: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/15',
    rose: 'bg-rose-500/10 text-rose-700 border-rose-500/15',
  };

  return (
    <Card className="relative overflow-hidden rounded-3xl shadow-card">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/[0.07] blur-2xl" />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
          </div>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[tone] ?? toneClasses.primary}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="mt-2 truncate font-bold">{value}</div>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-3xl shadow-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RankedCard({ title, rows, empty }: { title: string; rows: Array<{ label: string; value: string; detail: string }>; empty: string }) {
  return (
    <Card className="rounded-3xl shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="space-y-4">
            {rows.slice(0, 6).map((row, index) => (
              <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{row.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{row.detail}</div>
                </div>
                <strong className="shrink-0">{row.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text={empty} />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>;
}
