import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowRight,
  BookOpenText,
  Edit,
  History,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';

type CustomerFilter = 'registered' | 'guest' | 'all';
type MainTab = 'customers' | 'records' | 'history';

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  notes: '',
};

export default function Customers() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] =
    useState<CustomerFilter>('all');
  const [activeTab, setActiveTab] = useState<MainTab>('customers');
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [visitSpend, setVisitSpend] = useState<Record<string, number>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [customersResult, recordsResult, visitsResult] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('customer_records')
          .select('customer_id')
          .eq('business_id', businessId),
        supabase
          .from('appointments')
          .select('customer_id, total_price, status')
          .eq('business_id', businessId),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (recordsResult.error) throw recordsResult.error;
      if (visitsResult.error) throw visitsResult.error;

      setCustomers(customersResult.data ?? []);

      const nextRecordCounts: Record<string, number> = {};
      for (const row of recordsResult.data ?? []) {
        if (!row.customer_id) continue;
        nextRecordCounts[row.customer_id] =
          (nextRecordCounts[row.customer_id] || 0) + 1;
      }

      const nextVisitCounts: Record<string, number> = {};
      const nextVisitSpend: Record<string, number> = {};
      for (const row of visitsResult.data ?? []) {
        if (!row.customer_id) continue;
        if (
          ['cancelled_by_business', 'cancelled_by_customer'].includes(
            row.status
          )
        ) {
          continue;
        }

        nextVisitCounts[row.customer_id] =
          (nextVisitCounts[row.customer_id] || 0) + 1;
        nextVisitSpend[row.customer_id] =
          (nextVisitSpend[row.customer_id] || 0) +
          Number(row.total_price || 0);
      }

      setRecordCounts(nextRecordCounts);
      setVisitCounts(nextVisitCounts);
      setVisitSpend(nextVisitSpend);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const registeredCount = useMemo(
    () => customers.filter((customer) => Boolean(customer.user_id)).length,
    [customers]
  );

  const guestCount = customers.length - registeredCount;

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      const isRegistered = Boolean(customer.user_id);

      const matchesType =
        activeFilter === 'all' ||
        (activeFilter === 'registered' && isRegistered) ||
        (activeFilter === 'guest' && !isRegistered);

      if (!matchesType) return false;
      if (!normalizedSearch) return true;

      return [customer.full_name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch)
        );
    });
  }, [customers, activeFilter, searchQuery]);

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingId(customer.id);
      setFormData({
        full_name: customer.full_name ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        notes: customer.notes ?? '',
      });
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }

    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !formData.full_name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        business_id: businessId,
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase() || null,
        phone: formData.phone.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingId)
          .eq('business_id', businessId);

        if (error) throw error;
        toast.success('Customer updated');
      } else {
        const { error } = await supabase.from('customers').insert(payload);

        if (error) throw error;
        toast.success('Customer added');
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: any) => {
    const isRegistered = Boolean(customer.user_id);

    const confirmed = window.confirm(
      isRegistered
        ? 'Remove this customer profile from the store? Their authentication account will not be deleted.'
        : 'Remove this guest customer? Existing appointment history may prevent deletion.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Customer removed');
      await fetchData();
    } catch (error: any) {
      toast.error(
        error.message ||
          'This customer cannot be removed because appointment history exists'
      );
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Customer management
          </div>
          <h1 className="app-page-title">Customers</h1>
          <p className="app-page-description">
            Manage registered customer accounts separately from guest booking
            contacts.
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Registered Customers"
          value={registeredCount}
          description="Customers with an account"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <SummaryCard
          title="Guest Contacts"
          value={guestCount}
          description="Customers who booked as guests"
          icon={<UserRound className="h-5 w-5" />}
        />
        <SummaryCard
          title="Total Customers"
          value={customers.length}
          description="All customer records"
          icon={<Users className="h-5 w-5" />}
        />
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-card">
        <MainTabButton
          active={activeTab === 'customers'}
          label="Customers"
          icon={<Users className="h-4 w-4" />}
          onClick={() => setActiveTab('customers')}
        />
        <MainTabButton
          active={activeTab === 'records'}
          label="Customer Records"
          icon={<BookOpenText className="h-4 w-4" />}
          onClick={() => setActiveTab('records')}
        />
        <MainTabButton
          active={activeTab === 'history'}
          label="Visit History"
          icon={<History className="h-4 w-4" />}
          onClick={() => setActiveTab('history')}
        />
      </div>

      {activeTab !== 'customers' ? (
        <Card className="overflow-hidden rounded-2xl shadow-card">
          <div className="border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {activeTab === 'records'
                    ? 'Customer Records'
                    : 'Visit History'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeTab === 'records'
                    ? 'Open a customer to manage formulas, notes and photos.'
                    : 'Open a customer to review previous appointments.'}
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search by name, email or phone"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Loading customers...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No customers found.
              </div>
            ) : (
              <div className="divide-y">
                {filteredCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    to={`/dashboard/customers/${customer.id}?tab=${activeTab}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-muted/35"
                  >
                    <CustomerAvatar name={customer.full_name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold">
                          {customer.full_name}
                        </div>
                        <CustomerTypeBadge
                          registered={Boolean(customer.user_id)}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {customer.email || customer.phone || 'No contact details'}
                      </div>
                    </div>

                    <div className="hidden text-right sm:block">
                      <div className="text-2xl font-bold">
                        {activeTab === 'records'
                          ? recordCounts[customer.id] || 0
                          : visitCounts[customer.id] || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {activeTab === 'records'
                          ? 'records'
                          : `visits · €${Number(
                              visitSpend[customer.id] || 0
                            ).toFixed(2)}`}
                      </div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card className="overflow-hidden rounded-2xl shadow-card">
        <div className="border-b px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="scrollbar-subtle flex gap-2 overflow-x-auto pb-1">
              <FilterTab
                active={activeFilter === 'registered'}
                label="Registered"
                count={registeredCount}
                onClick={() => setActiveFilter('registered')}
              />
              <FilterTab
                active={activeFilter === 'guest'}
                label="Guests"
                count={guestCount}
                onClick={() => setActiveFilter('guest')}
              />
              <FilterTab
                active={activeFilter === 'all'}
                label="All"
                count={customers.length}
                onClick={() => setActiveFilter('all')}
              />
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl pl-9"
                placeholder="Search by name, email or phone"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/35">
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact Details</TableHead>
                  <TableHead>Customer Type</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Loading customers...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-40 text-center text-muted-foreground"
                    >
                      No customers found in this category.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <CustomerAvatar name={customer.full_name} />
                          <div>
                            <div className="font-semibold">
                              {customer.full_name}
                            </div>
                            {customer.notes && (
                              <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                                {customer.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1.5 text-sm">
                          <ContactLine
                            icon={<Mail className="h-3.5 w-3.5" />}
                            value={customer.email || 'No email'}
                          />
                          <ContactLine
                            icon={<Phone className="h-3.5 w-3.5" />}
                            value={customer.phone || 'No phone'}
                          />
                        </div>
                      </TableCell>

                      <TableCell>
                        <CustomerTypeBadge
                          registered={Boolean(customer.user_id)}
                        />
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatCustomerDate(customer.created_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit customer"
                          onClick={() => handleOpenDialog(customer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remove customer"
                          onClick={() => void handleDelete(customer)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y md:hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Loading customers...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No customers found in this category.
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div key={customer.id} className="space-y-4 p-5">
                  <div className="flex items-start gap-3">
                    <CustomerAvatar name={customer.full_name} />

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {customer.full_name}
                      </div>
                      <div className="mt-2">
                        <CustomerTypeBadge
                          registered={Boolean(customer.user_id)}
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(customer)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl bg-muted/30 p-4 text-sm">
                    <ContactLine
                      icon={<Mail className="h-4 w-4" />}
                      value={customer.email || 'No email'}
                    />
                    <ContactLine
                      icon={<Phone className="h-4 w-4" />}
                      value={customer.phone || 'No phone'}
                    />
                    <div className="text-xs text-muted-foreground">
                      Added {formatCustomerDate(customer.created_at)}
                    </div>
                  </div>

                  {customer.notes && (
                    <div className="text-sm leading-6 text-muted-foreground">
                      {customer.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Customer' : 'Add Customer'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                className="h-11 rounded-xl"
                value={formData.full_name}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    full_name: event.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="h-11 rounded-xl"
                value={formData.email}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    email: event.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                className="h-11 rounded-xl"
                value={formData.phone}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    phone: event.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                className="rounded-xl"
                value={formData.notes}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    notes: event.target.value,
                  })
                }
              />
            </div>

            {!editingId && (
              <div className="rounded-xl border border-dashed bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
                Customers created manually by the owner are stored as guest
                contacts. A customer becomes registered only after creating and
                linking an authentication account.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving...' : 'Save Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MainTabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          <div className="mt-3 text-3xl font-bold">{value}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {description}
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
          active ? 'bg-black/10' : 'bg-muted'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials = String(name || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
      {initials || 'C'}
    </div>
  );
}

function CustomerTypeBadge({ registered }: { registered: boolean }) {
  return registered ? (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
      Registered
    </Badge>
  ) : (
    <Badge variant="secondary">Guest</Badge>
  );
}

function ContactLine({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function formatCustomerDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
