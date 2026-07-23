import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CalendarCheck2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Euro,
  FileText,
  History,
  Minus,
  Package,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Undo2,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react';

type WorkspaceTab = 'checkout' | 'transactions';
type CatalogTab = 'appointments' | 'services' | 'products' | 'custom';
type SaleStatusFilter = 'all' | 'completed' | 'voided';
type PaymentMethod =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'online'
  | 'gift_card'
  | 'other';

type CartItem = {
  key: string;
  item_type: 'service' | 'product' | 'custom';
  source_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  stock?: number;
  employee_id?: string | null;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'card',
  'bank_transfer',
  'online',
  'gift_card',
  'other',
];

const ACTIVE_APPOINTMENT_STATUSES = [
  'confirmed',
  'completed',
  'in_progress',
];

const EMPTY_CUSTOM_ITEM = {
  description: '',
  price: '',
};

export default function Sales() {
  const { t, i18n } = useTranslation();
  const { activeBusiness, businessMemberships } = useAuth();
  const businessId = activeBusiness?.id ?? businessMemberships[0]?.business_id;
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const [searchParams, setSearchParams] = useSearchParams();

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('checkout');
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('appointments');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [orderDiscount, setOrderDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [tipAmount, setTipAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  const [transactionSearch, setTransactionSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [voidingTransaction, setVoidingTransaction] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [customItem, setCustomItem] = useState(EMPTY_CUSTOM_ITEM);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      resetCheckout();
      setWorkspaceTab('checkout');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const appointmentStart = new Date();
      appointmentStart.setDate(appointmentStart.getDate() - 45);

      const [
        transactionsResult,
        appointmentsResult,
        servicesResult,
        productsResult,
        customersResult,
        employeesResult,
      ] = await Promise.all([
        (supabase as any)
          .from('sale_transactions')
          .select(
            '*, customers(id, full_name, email, phone), employees(id, name), sale_items(*), sale_payments(*)'
          )
          .eq('business_id', businessId)
          .order('completed_at', { ascending: false })
          .limit(300),
        supabase
          .from('appointments')
          .select(
            'id, booking_reference, start_time, status, payment_status, total_price, customer_id, employee_id, customers(id, full_name, email, phone), employees(id, name), appointment_services(id, price, duration, service_id, services(id, name, price))'
          )
          .eq('business_id', businessId)
          .in('status', ACTIVE_APPOINTMENT_STATUSES)
          .gte('start_time', appointmentStart.toISOString())
          .order('start_time', { ascending: false })
          .limit(200),
        supabase
          .from('services')
          .select('id, name, price, duration, image_url, category_id')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('products')
          .select(
            'id, name, sku, barcode, brand, category, image_url, selling_price, cost_price, current_stock, min_stock'
          )
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('customers')
          .select('id, full_name, email, phone')
          .eq('business_id', businessId)
          .order('full_name'),
        supabase
          .from('employees')
          .select('id, name, photo_url, is_active')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('name'),
      ]);

      const transactionTableMissing = Boolean(
        transactionsResult.error &&
          ['42P01', 'PGRST205'].includes(transactionsResult.error.code)
      );

      if (transactionsResult.error && !transactionTableMissing) {
        throw transactionsResult.error;
      }
      if (appointmentsResult.error) throw appointmentsResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (employeesResult.error) throw employeesResult.error;

      setMigrationMissing(transactionTableMissing);
      setTransactions(transactionsResult.data ?? []);
      setAppointments(appointmentsResult.data ?? []);
      setServices(servicesResult.data ?? []);
      setProducts(productsResult.data ?? []);
      setCustomers(customersResult.data ?? []);
      setEmployees(employeesResult.data ?? []);
    } catch (error: any) {
      console.error('Sales workspace loading error:', error);
      toast.error(error.message || t('sales.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const todayTransactions = useMemo(() => {
    const today = new Date();
    return transactions.filter((transaction) => {
      const completed = new Date(transaction.completed_at);
      return (
        completed.getFullYear() === today.getFullYear() &&
        completed.getMonth() === today.getMonth() &&
        completed.getDate() === today.getDate()
      );
    });
  }, [transactions]);

  const completedToday = useMemo(
    () => todayTransactions.filter((transaction) => transaction.status === 'completed'),
    [todayTransactions]
  );

  const todayRevenue = useMemo(
    () =>
      completedToday.reduce(
        (sum, transaction) => sum + Number(transaction.total_amount || 0),
        0
      ),
    [completedToday]
  );

  const averageTicket = completedToday.length
    ? todayRevenue / completedToday.length
    : 0;

  const unpaidAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => appointment.payment_status !== 'paid'
      ),
    [appointments]
  );

  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    if (!query) {
      if (catalogTab === 'appointments') return unpaidAppointments;
      if (catalogTab === 'services') return services;
      if (catalogTab === 'products') return products;
      return [];
    }

    if (catalogTab === 'appointments') {
      return unpaidAppointments.filter((appointment) =>
        [
          appointment.booking_reference,
          appointment.customers?.full_name,
          appointment.employees?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
    }

    if (catalogTab === 'services') {
      return services.filter((service) =>
        String(service.name || '').toLowerCase().includes(query)
      );
    }

    if (catalogTab === 'products') {
      return products.filter((product) =>
        [
          product.name,
          product.sku,
          product.barcode,
          product.brand,
          product.category,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      );
    }

    return [];
  }, [
    catalogSearch,
    catalogTab,
    unpaidAppointments,
    services,
    products,
  ]);

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesStatus =
        statusFilter === 'all' || transaction.status === statusFilter;
      const matchesSearch =
        !query ||
        [
          transaction.receipt_number,
          transaction.customers?.full_name,
          transaction.employees?.name,
          transaction.sale_payments?.[0]?.payment_method,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [transactions, transactionSearch, statusFilter]);

  const subtotal = useMemo(
    () =>
      roundCurrency(
        cart.reduce(
          (sum, item) => sum + item.quantity * item.unit_price,
          0
        )
      ),
    [cart]
  );

  const discount = Math.min(
    Math.max(Number(orderDiscount) || 0, 0),
    subtotal
  );
  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = roundCurrency(
    taxableAmount * Math.max(Number(taxRate) || 0, 0) / 100
  );
  const tip = Math.max(Number(tipAmount) || 0, 0);
  const total = roundCurrency(taxableAmount + tax + tip);

  const addService = (service: any) => {
    const key = `service:${service.id}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          key,
          item_type: 'service',
          source_id: service.id,
          description: service.name,
          quantity: 1,
          unit_price: Number(service.price || 0),
          unit_cost: 0,
          discount_amount: 0,
          employee_id: selectedEmployeeId || null,
        },
      ];
    });
  };

  const addProduct = (product: any) => {
    const stock = Number(product.current_stock || 0);
    if (stock <= 0) {
      toast.error(t('sales.messages.outOfStock'));
      return;
    }

    const key = `product:${product.id}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(t('sales.messages.stockLimit'));
          return current;
        }
        return current.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          key,
          item_type: 'product',
          source_id: product.id,
          description: product.name,
          quantity: 1,
          unit_price: Number(product.selling_price || 0),
          unit_cost: Number(product.cost_price || 0),
          discount_amount: 0,
          stock,
        },
      ];
    });
  };

  const addCustomItem = () => {
    const description = customItem.description.trim();
    const price = Number(customItem.price);

    if (!description || !Number.isFinite(price) || price < 0) {
      toast.error(t('sales.messages.customItemInvalid'));
      return;
    }

    setCart((current) => [
      ...current,
      {
        key: `custom:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        item_type: 'custom',
        source_id: null,
        description,
        quantity: 1,
        unit_price: price,
        unit_cost: 0,
        discount_amount: 0,
        employee_id: selectedEmployeeId || null,
      },
    ]);
    setCustomItem(EMPTY_CUSTOM_ITEM);
  };

  const addAppointment = (appointment: any) => {
    const appointmentItems: CartItem[] = (appointment.appointment_services ?? []).map(
      (appointmentService: any) => ({
        key: `appointment-service:${appointment.id}:${appointmentService.id}`,
        item_type: 'service',
        source_id: appointmentService.service_id,
        description:
          appointmentService.services?.name || t('sales.catalog.serviceFallback'),
        quantity: 1,
        unit_price: Number(appointmentService.price || 0),
        unit_cost: 0,
        discount_amount: 0,
        employee_id: appointment.employee_id || null,
      })
    );

    if (appointmentItems.length === 0) {
      appointmentItems.push({
        key: `appointment-custom:${appointment.id}`,
        item_type: 'custom',
        source_id: null,
        description: `${t('sales.catalog.appointment')} ${appointment.booking_reference}`,
        quantity: 1,
        unit_price: Number(appointment.total_price || 0),
        unit_cost: 0,
        discount_amount: 0,
        employee_id: appointment.employee_id || null,
      });
    }

    const appointmentSubtotal = roundCurrency(
      appointmentItems.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      )
    );
    const bookedTotal = Math.max(Number(appointment.total_price || 0), 0);
    const appointmentDiscount = roundCurrency(
      Math.max(appointmentSubtotal - bookedTotal, 0)
    );

    setCart(appointmentItems);
    setOrderDiscount(String(appointmentDiscount));
    setSelectedAppointmentId(appointment.id);
    setSelectedCustomerId(appointment.customer_id || '');
    setSelectedEmployeeId(appointment.employee_id || '');
    setCatalogTab('services');
    toast.success(t('sales.messages.appointmentAdded'));
  };

  const updateQuantity = (key: string, direction: 1 | -1) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.key !== key) return item;
          const nextQuantity = item.quantity + direction;
          if (item.stock != null && nextQuantity > item.stock) {
            toast.error(t('sales.messages.stockLimit'));
            return item;
          }
          return { ...item, quantity: Math.max(nextQuantity, 0) };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const resetCheckout = () => {
    setCart([]);
    setSelectedAppointmentId('');
    setSelectedCustomerId('');
    setSelectedEmployeeId('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setOrderDiscount('0');
    setTaxRate('0');
    setTipAmount('0');
    setNotes('');
    setCatalogSearch('');
    setCustomItem(EMPTY_CUSTOM_ITEM);
  };

  const completeCheckout = async () => {
    if (!businessId || cart.length === 0) {
      toast.error(t('sales.messages.emptyCart'));
      return;
    }

    if (migrationMissing) {
      toast.error(t('sales.messages.migrationRequired'));
      return;
    }

    if (total <= 0) {
      toast.error(t('sales.messages.totalInvalid'));
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'complete_business_sale',
        {
          p_business_id: businessId,
          p_customer_id: selectedCustomerId || null,
          p_appointment_id: selectedAppointmentId || null,
          p_employee_id: selectedEmployeeId || null,
          p_items: cart.map((item) => ({
            item_type: item.item_type,
            source_id: item.source_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount,
            tax_rate: Math.max(Number(taxRate) || 0, 0),
            employee_id: item.employee_id || selectedEmployeeId || null,
          })),
          p_payments: [
            {
              payment_method: paymentMethod,
              amount: total,
              reference: paymentReference.trim() || null,
            },
          ],
          p_order_discount_amount: discount,
          p_tip_amount: tip,
          p_notes: notes.trim() || null,
        }
      );

      if (error) throw error;

      toast.success(
        t('sales.messages.completed', {
          receipt: data?.receipt_number || '',
        })
      );
      resetCheckout();
      await fetchData();

      const completed = (await loadTransaction(data?.sale_id)) ?? data;
      if (completed) setSelectedTransaction(completed);
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || t('sales.messages.checkoutError'));
    } finally {
      setSaving(false);
    }
  };

  const loadTransaction = async (saleId: string | undefined) => {
    if (!saleId) return null;
    const { data, error } = await (supabase as any)
      .from('sale_transactions')
      .select(
        '*, customers(id, full_name, email, phone), employees(id, name), sale_items(*), sale_payments(*)'
      )
      .eq('id', saleId)
      .maybeSingle();
    if (error) return null;
    return data;
  };

  const confirmVoid = async () => {
    if (!voidingTransaction || !voidReason.trim()) {
      toast.error(t('sales.messages.voidReasonRequired'));
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc('void_business_sale', {
        p_sale_id: voidingTransaction.id,
        p_reason: voidReason.trim(),
      });
      if (error) throw error;

      toast.success(t('sales.messages.voided'));
      setVoidingTransaction(null);
      setVoidReason('');
      setSelectedTransaction(null);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('sales.messages.voidError'));
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = (transaction: any) => {
    const receiptWindow = window.open('', '_blank', 'width=520,height=760');
    if (!receiptWindow) {
      toast.error(t('sales.messages.popupBlocked'));
      return;
    }

    const items = (transaction.sale_items ?? [])
      .map(
        (item: any) => `
          <tr>
            <td>${escapeHtml(item.description)}</td>
            <td style="text-align:center">${Number(item.quantity)}</td>
            <td style="text-align:right">${formatCurrency(Number(item.line_total || 0), locale)}</td>
          </tr>`
      )
      .join('');

    receiptWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>${escapeHtml(transaction.receipt_number)}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; margin: 28px; color:#101828; }
            h1 { margin:0 0 4px; font-size:22px; }
            .muted { color:#667085; font-size:12px; }
            table { width:100%; border-collapse:collapse; margin-top:22px; }
            td,th { border-bottom:1px solid #e4e7ec; padding:9px 2px; font-size:13px; }
            .totals { margin-top:18px; margin-left:auto; width:72%; }
            .line { display:flex; justify-content:space-between; padding:5px 0; }
            .total { border-top:2px solid #101828; margin-top:6px; padding-top:10px; font-weight:700; }
            @media print { button { display:none; } body { margin:0; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(activeBusiness?.name || 'Velliqo')}</h1>
          <div class="muted">${escapeHtml(transaction.receipt_number)} · ${escapeHtml(formatDateTime(transaction.completed_at, locale))}</div>
          <div class="muted">${escapeHtml(transaction.customers?.full_name || t('sales.receipt.walkIn'))}</div>
          <table>
            <thead><tr><th style="text-align:left">${escapeHtml(t('sales.receipt.item'))}</th><th>${escapeHtml(t('sales.receipt.qty'))}</th><th style="text-align:right">${escapeHtml(t('sales.receipt.amount'))}</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
          <div class="totals">
            <div class="line"><span>${escapeHtml(t('sales.cart.subtotal'))}</span><span>${formatCurrency(Number(transaction.subtotal || 0), locale)}</span></div>
            <div class="line"><span>${escapeHtml(t('sales.cart.discount'))}</span><span>-${formatCurrency(Number(transaction.item_discount_amount || 0) + Number(transaction.order_discount_amount || 0), locale)}</span></div>
            <div class="line"><span>${escapeHtml(t('sales.cart.tax'))}</span><span>${formatCurrency(Number(transaction.tax_amount || 0), locale)}</span></div>
            <div class="line"><span>${escapeHtml(t('sales.cart.tip'))}</span><span>${formatCurrency(Number(transaction.tip_amount || 0), locale)}</span></div>
            <div class="line total"><span>${escapeHtml(t('sales.cart.total'))}</span><span>${formatCurrency(Number(transaction.total_amount || 0), locale)}</span></div>
          </div>
          <button onclick="window.print()" style="margin-top:24px;padding:10px 16px">${escapeHtml(t('sales.actions.print'))}</button>
        </body>
      </html>`);
    receiptWindow.document.close();
  };

  return (
    <div className="app-page pb-10">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('sales.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('sales.title')}</h1>
          <p className="app-page-description">{t('sales.description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('sales.actions.refresh')}
          </Button>
          <Button
            onClick={() => {
              resetCheckout();
              setWorkspaceTab('checkout');
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('sales.actions.newSale')}
          </Button>
        </div>
      </header>

      {migrationMissing && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="font-bold">{t('sales.migration.title')}</div>
          <div className="mt-1">{t('sales.migration.description')}</div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SalesMetric
          icon={Euro}
          label={t('sales.metrics.todayRevenue')}
          value={formatCurrency(todayRevenue, locale)}
          detail={t('sales.metrics.completedSales', { count: completedToday.length })}
        />
        <SalesMetric
          icon={ReceiptText}
          label={t('sales.metrics.todayTransactions')}
          value={String(todayTransactions.length)}
          detail={t('sales.metrics.voidedCount', {
            count: todayTransactions.filter((item) => item.status === 'voided').length,
          })}
        />
        <SalesMetric
          icon={CircleDollarSign}
          label={t('sales.metrics.averageTicket')}
          value={formatCurrency(averageTicket, locale)}
          detail={t('sales.metrics.completedOnly')}
        />
        <SalesMetric
          icon={CalendarCheck2}
          label={t('sales.metrics.unpaidAppointments')}
          value={String(unpaidAppointments.length)}
          detail={t('sales.metrics.readyForCheckout')}
          alert={unpaidAppointments.length > 0}
        />
      </section>

      <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 shadow-card">
        <WorkspaceTabButton
          active={workspaceTab === 'checkout'}
          onClick={() => setWorkspaceTab('checkout')}
          icon={ShoppingCart}
          label={t('sales.tabs.checkout')}
        />
        <WorkspaceTabButton
          active={workspaceTab === 'transactions'}
          onClick={() => setWorkspaceTab('transactions')}
          icon={History}
          label={t('sales.tabs.transactions')}
        />
      </div>

      {workspaceTab === 'checkout' ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <Card className="overflow-hidden rounded-2xl shadow-card">
            <CardHeader className="border-b bg-muted/25 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-xl">{t('sales.catalog.title')}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('sales.catalog.description')}
                  </p>
                </div>
                {catalogTab !== 'custom' && (
                  <div className="relative w-full lg:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder={t('sales.catalog.search')}
                      className="pl-9"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <CatalogTabButton
                  active={catalogTab === 'appointments'}
                  icon={CalendarCheck2}
                  label={t('sales.catalog.appointments')}
                  count={unpaidAppointments.length}
                  onClick={() => setCatalogTab('appointments')}
                />
                <CatalogTabButton
                  active={catalogTab === 'services'}
                  icon={Scissors}
                  label={t('sales.catalog.services')}
                  count={services.length}
                  onClick={() => setCatalogTab('services')}
                />
                <CatalogTabButton
                  active={catalogTab === 'products'}
                  icon={Package}
                  label={t('sales.catalog.products')}
                  count={products.length}
                  onClick={() => setCatalogTab('products')}
                />
                <CatalogTabButton
                  active={catalogTab === 'custom'}
                  icon={Plus}
                  label={t('sales.catalog.custom')}
                  onClick={() => setCatalogTab('custom')}
                />
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                  {t('sales.states.loading')}
                </div>
              ) : catalogTab === 'custom' ? (
                <CustomItemForm
                  item={customItem}
                  onChange={setCustomItem}
                  onAdd={addCustomItem}
                  t={t}
                />
              ) : filteredCatalog.length === 0 ? (
                <EmptyCatalog tab={catalogTab} t={t} />
              ) : catalogTab === 'appointments' ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredCatalog.map((appointment: any) => (
                    <AppointmentCatalogCard
                      key={appointment.id}
                      appointment={appointment}
                      locale={locale}
                      selected={selectedAppointmentId === appointment.id}
                      onAdd={() => addAppointment(appointment)}
                      t={t}
                    />
                  ))}
                </div>
              ) : catalogTab === 'services' ? (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredCatalog.map((service: any) => (
                    <CatalogItemCard
                      key={service.id}
                      title={service.name}
                      detail={t('sales.catalog.durationMinutes', {
                        minutes: service.duration,
                      })}
                      price={formatCurrency(Number(service.price || 0), locale)}
                      imageUrl={service.image_url}
                      icon={Scissors}
                      onAdd={() => addService(service)}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredCatalog.map((product: any) => (
                    <CatalogItemCard
                      key={product.id}
                      title={product.name}
                      detail={t('sales.catalog.stockAvailable', {
                        count: Number(product.current_stock || 0),
                      })}
                      price={formatCurrency(Number(product.selling_price || 0), locale)}
                      imageUrl={product.image_url}
                      icon={Package}
                      disabled={Number(product.current_stock || 0) <= 0}
                      warning={
                        Number(product.current_stock || 0) <=
                        Number(product.min_stock || 0)
                      }
                      onAdd={() => addProduct(product)}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl shadow-card xl:sticky xl:top-24">
            <CardHeader className="border-b bg-muted/25 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    {t('sales.cart.title')}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('sales.cart.items', { count: cart.length })}
                  </p>
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={resetCheckout}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('sales.actions.clear')}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-4 sm:p-5">
              {cart.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-5 text-center">
                  <ShoppingCart className="h-9 w-9 text-muted-foreground/45" />
                  <div className="mt-3 font-bold">{t('sales.cart.emptyTitle')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('sales.cart.emptyDescription')}
                  </div>
                </div>
              ) : (
                <div className="scrollbar-subtle max-h-[310px] space-y-2 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <CartLine
                      key={item.key}
                      item={item}
                      locale={locale}
                      t={t}
                      onDecrease={() => updateQuantity(item.key, -1)}
                      onIncrease={() => updateQuantity(item.key, 1)}
                      onRemove={() =>
                        setCart((current) =>
                          current.filter((currentItem) => currentItem.key !== item.key)
                        )
                      }
                    />
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <FieldSelect
                  label={t('sales.fields.customer')}
                  value={selectedCustomerId}
                  onChange={setSelectedCustomerId}
                  placeholder={t('sales.fields.walkIn')}
                  options={customers.map((customer) => ({
                    value: customer.id,
                    label: customer.full_name,
                  }))}
                />
                <FieldSelect
                  label={t('sales.fields.professional')}
                  value={selectedEmployeeId}
                  onChange={setSelectedEmployeeId}
                  placeholder={t('sales.fields.unassigned')}
                  options={employees.map((employee) => ({
                    value: employee.id,
                    label: employee.name,
                  }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <MoneyInput
                  label={t('sales.cart.discount')}
                  value={orderDiscount}
                  onChange={setOrderDiscount}
                  suffix="€"
                />
                <MoneyInput
                  label={t('sales.cart.taxRate')}
                  value={taxRate}
                  onChange={setTaxRate}
                  suffix="%"
                />
                <MoneyInput
                  label={t('sales.cart.tip')}
                  value={tipAmount}
                  onChange={setTipAmount}
                  suffix="€"
                />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <SummaryLine
                  label={t('sales.cart.subtotal')}
                  value={formatCurrency(subtotal, locale)}
                />
                <SummaryLine
                  label={t('sales.cart.discount')}
                  value={`-${formatCurrency(discount, locale)}`}
                />
                <SummaryLine
                  label={t('sales.cart.tax')}
                  value={formatCurrency(tax, locale)}
                />
                <SummaryLine
                  label={t('sales.cart.tip')}
                  value={formatCurrency(tip, locale)}
                />
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-lg font-extrabold">
                  <span>{t('sales.cart.total')}</span>
                  <span>{formatCurrency(total, locale)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <FieldSelect
                  label={t('sales.fields.paymentMethod')}
                  value={paymentMethod}
                  onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  options={PAYMENT_METHODS.map((method) => ({
                    value: method,
                    label: t(`sales.paymentMethods.${method}`),
                  }))}
                />
                <div>
                  <Label htmlFor="payment-reference">
                    {t('sales.fields.paymentReference')}
                  </Label>
                  <Input
                    id="payment-reference"
                    className="mt-1.5"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder={t('sales.fields.paymentReferencePlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="sale-notes">{t('sales.fields.notes')}</Label>
                  <Textarea
                    id="sale-notes"
                    className="mt-1.5 min-h-20"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={t('sales.fields.notesPlaceholder')}
                  />
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-xl text-base font-bold"
                disabled={saving || cart.length === 0 || total <= 0 || migrationMissing}
                onClick={() => void completeCheckout()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {saving
                  ? t('sales.actions.processing')
                  : t('sales.actions.completeSale', {
                      amount: formatCurrency(total, locale),
                    })}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-2xl shadow-card">
          <CardHeader className="border-b bg-muted/25 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">{t('sales.transactions.title')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('sales.transactions.description')}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={transactionSearch}
                    onChange={(event) => setTransactionSearch(event.target.value)}
                    placeholder={t('sales.transactions.search')}
                    className="pl-9"
                  />
                </div>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as SaleStatusFilter)
                  }
                >
                  <option value="all">{t('sales.status.all')}</option>
                  <option value="completed">{t('sales.status.completed')}</option>
                  <option value="voided">{t('sales.status.voided')}</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                {t('sales.states.loading')}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <ReceiptText className="h-10 w-10 text-muted-foreground/40" />
                <div className="mt-3 font-bold">{t('sales.states.noTransactions')}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t('sales.states.noTransactionsDescription')}
                </div>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">{t('sales.transactions.receipt')}</th>
                        <th className="px-5 py-3">{t('sales.transactions.date')}</th>
                        <th className="px-5 py-3">{t('sales.transactions.customer')}</th>
                        <th className="px-5 py-3">{t('sales.transactions.payment')}</th>
                        <th className="px-5 py-3">{t('sales.transactions.status')}</th>
                        <th className="px-5 py-3 text-right">{t('sales.transactions.total')}</th>
                        <th className="px-5 py-3 text-right">{t('sales.transactions.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredTransactions.map((transaction) => (
                        <TransactionRow
                          key={transaction.id}
                          transaction={transaction}
                          locale={locale}
                          t={t}
                          onOpen={() => setSelectedTransaction(transaction)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y md:hidden">
                  {filteredTransactions.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      locale={locale}
                      t={t}
                      onOpen={() => setSelectedTransaction(transaction)}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(selectedTransaction)}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          {selectedTransaction && (
            <ReceiptDetails
              transaction={selectedTransaction}
              locale={locale}
              t={t}
              onPrint={() => printReceipt(selectedTransaction)}
              onVoid={() => {
                setVoidingTransaction(selectedTransaction);
                setSelectedTransaction(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(voidingTransaction)}
        onOpenChange={(open) => {
          if (!open) {
            setVoidingTransaction(null);
            setVoidReason('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('sales.void.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {t('sales.void.warning', {
                receipt: voidingTransaction?.receipt_number,
              })}
            </div>
            <div>
              <Label htmlFor="void-reason">{t('sales.void.reason')}</Label>
              <Textarea
                id="void-reason"
                className="mt-1.5 min-h-24"
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder={t('sales.void.reasonPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidingTransaction(null);
                setVoidReason('');
              }}
            >
              {t('sales.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !voidReason.trim()}
              onClick={() => void confirmVoid()}
            >
              {saving ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              {t('sales.actions.voidSale')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SalesMetric({
  icon: Icon,
  label,
  value,
  detail,
  alert = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-card">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            alert ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function WorkspaceTabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition sm:flex-none ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CatalogTabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count != null && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

function CatalogItemCard({
  title,
  detail,
  price,
  imageUrl,
  icon: Icon,
  disabled = false,
  warning = false,
  onAdd,
  t,
}: {
  title: string;
  detail: string;
  price: string;
  imageUrl?: string | null;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  warning?: boolean;
  onAdd: () => void;
  t: any;
}) {
  return (
    <div className="group flex min-h-32 flex-col rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start gap-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-11 w-11 rounded-xl border object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-bold">{title}</div>
          <div
            className={`mt-1 text-xs ${
              warning ? 'font-semibold text-amber-700' : 'text-muted-foreground'
            }`}
          >
            {detail}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="font-extrabold">{price}</div>
        <Button size="sm" disabled={disabled} onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {disabled ? t('sales.actions.unavailable') : t('sales.actions.add')}
        </Button>
      </div>
    </div>
  );
}

function AppointmentCatalogCard({
  appointment,
  locale,
  selected,
  onAdd,
  t,
}: {
  appointment: any;
  locale: string;
  selected: boolean;
  onAdd: () => void;
  t: any;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-primary/35 hover:bg-primary/[0.03] ${
        selected ? 'border-primary bg-primary/[0.06]' : 'bg-card'
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarCheck2 className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-bold">
            {appointment.customers?.full_name || t('sales.receipt.walkIn')}
          </div>
          {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatDateTime(appointment.start_time, locale)} · {appointment.booking_reference}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {appointment.employees?.name || t('sales.fields.unassigned')}
        </div>
      </div>
      <div className="text-right">
        <div className="font-extrabold">
          {formatCurrency(Number(appointment.total_price || 0), locale)}
        </div>
        <ChevronRight className="ml-auto mt-2 h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

function CustomItemForm({ item, onChange, onAdd, t }: any) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-muted/15 p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileText className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{t('sales.custom.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('sales.custom.description')}
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="custom-description">{t('sales.custom.name')}</Label>
          <Input
            id="custom-description"
            className="mt-1.5"
            value={item.description}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder={t('sales.custom.namePlaceholder')}
          />
        </div>
        <div>
          <Label htmlFor="custom-price">{t('sales.custom.price')}</Label>
          <Input
            id="custom-price"
            type="number"
            min="0"
            step="0.01"
            className="mt-1.5"
            value={item.price}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                price: event.target.value,
              }))
            }
            placeholder="0.00"
          />
        </div>
        <Button className="w-full" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('sales.custom.add')}
        </Button>
      </div>
    </div>
  );
}

function EmptyCatalog({ tab, t }: { tab: CatalogTab; t: any }) {
  const Icon = tab === 'appointments' ? CalendarCheck2 : tab === 'services' ? Scissors : Package;
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <div className="mt-3 font-bold">{t(`sales.states.empty.${tab}.title`)}</div>
      <div className="mt-1 max-w-sm text-sm text-muted-foreground">
        {t(`sales.states.empty.${tab}.description`)}
      </div>
    </div>
  );
}

function CartLine({ item, locale, t, onDecrease, onIncrease, onRemove }: any) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {item.item_type === 'service' ? (
          <Scissors className="h-4 w-4" />
        ) : item.item_type === 'product' ? (
          <Package className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{item.description}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatCurrency(item.unit_price, locale)}
          {item.stock != null
            ? ` · ${t('sales.catalog.stockAvailable', { count: item.stock })}`
            : ''}
        </div>
      </div>
      <div className="flex items-center rounded-lg border">
        <button type="button" className="p-1.5" onClick={onDecrease}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-7 text-center text-xs font-bold">{item.quantity}</span>
        <button type="button" className="p-1.5" onClick={onIncrease}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="w-20 text-right text-sm font-extrabold">
        {formatCurrency(item.quantity * item.unit_price, locale)}
      </div>
      <button
        type="button"
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MoneyInput({ label, value, onChange, suffix }: any) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="relative mt-1.5">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-8"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function TransactionRow({ transaction, locale, t, onOpen }: any) {
  const method = transaction.sale_payments?.[0]?.payment_method || 'other';
  return (
    <tr className="transition hover:bg-muted/20">
      <td className="px-5 py-4 font-bold">{transaction.receipt_number}</td>
      <td className="px-5 py-4 text-muted-foreground">
        {formatDateTime(transaction.completed_at, locale)}
      </td>
      <td className="px-5 py-4">
        {transaction.customers?.full_name || t('sales.receipt.walkIn')}
      </td>
      <td className="px-5 py-4">{t(`sales.paymentMethods.${method}`)}</td>
      <td className="px-5 py-4">
        <SaleStatusBadge status={transaction.status} t={t} />
      </td>
      <td className="px-5 py-4 text-right font-extrabold">
        {formatCurrency(Number(transaction.total_amount || 0), locale)}
      </td>
      <td className="px-5 py-4 text-right">
        <Button variant="outline" size="sm" onClick={onOpen}>
          <ReceiptText className="mr-2 h-4 w-4" />
          {t('sales.actions.view')}
        </Button>
      </td>
    </tr>
  );
}

function TransactionCard({ transaction, locale, t, onOpen }: any) {
  return (
    <button type="button" onClick={onOpen} className="w-full p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold">{transaction.receipt_number}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(transaction.completed_at, locale)}
          </div>
        </div>
        <SaleStatusBadge status={transaction.status} t={t} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {transaction.customers?.full_name || t('sales.receipt.walkIn')}
        </div>
        <div className="text-lg font-extrabold">
          {formatCurrency(Number(transaction.total_amount || 0), locale)}
        </div>
      </div>
    </button>
  );
}

function SaleStatusBadge({ status, t }: { status: string; t: any }) {
  const variant = status === 'voided' ? 'destructive' : 'secondary';
  return (
    <Badge variant={variant as any}>
      {status === 'completed' && <Check className="mr-1 h-3 w-3" />}
      {status === 'voided' && <XCircle className="mr-1 h-3 w-3" />}
      {t(`sales.status.${status}`, { defaultValue: status })}
    </Badge>
  );
}

function ReceiptDetails({ transaction, locale, t, onPrint, onVoid }: any) {
  const payments = transaction.sale_payments ?? [];
  const items = transaction.sale_items ?? [];

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>{transaction.receipt_number}</DialogTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(transaction.completed_at, locale)}
            </div>
          </div>
        </div>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <ReceiptInfo
          icon={UserRound}
          label={t('sales.receipt.customer')}
          value={transaction.customers?.full_name || t('sales.receipt.walkIn')}
        />
        <ReceiptInfo
          icon={Scissors}
          label={t('sales.receipt.professional')}
          value={transaction.employees?.name || t('sales.fields.unassigned')}
        />
        <ReceiptInfo
          icon={WalletCards}
          label={t('sales.receipt.payment')}
          value={payments
            .map((payment: any) => t(`sales.paymentMethods.${payment.payment_method}`))
            .join(', ')}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_96px] gap-2 border-b bg-muted/30 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <div>{t('sales.receipt.item')}</div>
          <div className="text-center">{t('sales.receipt.qty')}</div>
          <div className="text-right">{t('sales.receipt.amount')}</div>
        </div>
        <div className="divide-y">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_64px_96px] gap-2 px-4 py-3 text-sm"
            >
              <div className="font-semibold">{item.description}</div>
              <div className="text-center text-muted-foreground">
                {Number(item.quantity)}
              </div>
              <div className="text-right font-bold">
                {formatCurrency(Number(item.line_total || 0), locale)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ml-auto w-full max-w-sm rounded-2xl bg-muted/25 p-4">
        <SummaryLine
          label={t('sales.cart.subtotal')}
          value={formatCurrency(Number(transaction.subtotal || 0), locale)}
        />
        <SummaryLine
          label={t('sales.cart.discount')}
          value={`-${formatCurrency(
            Number(transaction.item_discount_amount || 0) +
              Number(transaction.order_discount_amount || 0),
            locale
          )}`}
        />
        <SummaryLine
          label={t('sales.cart.tax')}
          value={formatCurrency(Number(transaction.tax_amount || 0), locale)}
        />
        <SummaryLine
          label={t('sales.cart.tip')}
          value={formatCurrency(Number(transaction.tip_amount || 0), locale)}
        />
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-lg font-extrabold">
          <span>{t('sales.cart.total')}</span>
          <span>{formatCurrency(Number(transaction.total_amount || 0), locale)}</span>
        </div>
      </div>

      {transaction.notes && (
        <div className="rounded-xl border bg-muted/15 p-4 text-sm">
          <div className="font-bold">{t('sales.fields.notes')}</div>
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {transaction.notes}
          </div>
        </div>
      )}

      {transaction.status === 'voided' && transaction.void_reason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-bold">{t('sales.void.voidedLabel')}</div>
          <div className="mt-1">{transaction.void_reason}</div>
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {transaction.status === 'completed' ? (
          <Button variant="destructive" onClick={onVoid}>
            <Undo2 className="mr-2 h-4 w-4" />
            {t('sales.actions.voidSale')}
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          {t('sales.actions.print')}
        </Button>
      </DialogFooter>
    </>
  );
}

function ReceiptInfo({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl border bg-muted/15 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value || '—'}</div>
    </div>
  );
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
