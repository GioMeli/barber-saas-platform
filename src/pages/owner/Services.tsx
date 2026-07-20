import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Clock3,
  Edit,
  Euro,
  Plus,
  Scissors,
  Search,
  Trash2,
  Wifi,
} from 'lucide-react';

type ServiceFilter = 'all' | 'active' | 'inactive' | 'online';

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  duration: '30',
  category_id: '',
  is_active: true,
  online_booking_enabled: true,
};

export default function Services() {
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ServiceFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    if (businessId) void fetchData();
  }, [businessId]);

  const fetchData = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        supabase
          .from('services')
          .select('*, service_categories(name)')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabase
          .from('service_categories')
          .select('*')
          .eq('business_id', businessId)
          .order('name'),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setServices(servicesRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !query ||
        [service.name, service.description, service.service_categories?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        activeFilter === 'all' ||
        (activeFilter === 'active' && service.is_active) ||
        (activeFilter === 'inactive' && !service.is_active) ||
        (activeFilter === 'online' && service.online_booking_enabled);

      const matchesCategory =
        selectedCategory === 'all' ||
        String(service.category_id || '') === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [services, searchQuery, activeFilter, selectedCategory]);

  const activeCount = services.filter((service) => service.is_active).length;
  const onlineCount = services.filter(
    (service) => service.online_booking_enabled
  ).length;
  const averagePrice = services.length
    ? services.reduce(
        (total, service) => total + Number(service.price || 0),
        0
      ) / services.length
    : 0;

  const handleOpenDialog = (service?: any) => {
    if (service) {
      setEditingId(service.id);
      setFormData({
        name: service.name ?? '',
        description: service.description ?? '',
        price: String(service.price ?? ''),
        duration: String(service.duration ?? 30),
        category_id: service.category_id ?? '',
        is_active: Boolean(service.is_active),
        online_booking_enabled: Boolean(service.online_booking_enabled),
      });
    } else {
      setEditingId(null);
      setFormData({
        ...EMPTY_FORM,
        category_id: categories[0]?.id ?? '',
      });
    }

    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId) return;

    if (
      !formData.name.trim() ||
      !formData.price ||
      !formData.duration
    ) {
      toast.error('Please fill all required fields');
      return;
    }

    const price = Number(formData.price);
    const duration = Number(formData.duration);

    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid service price');
      return;
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      toast.error('Enter a valid duration in minutes');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        business_id: businessId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price,
        duration,
        category_id: formData.category_id || null,
        is_active: formData.is_active,
        online_booking_enabled: formData.online_booking_enabled,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', editingId)
          .eq('business_id', businessId);

        if (error) throw error;
        toast.success('Service updated');
      } else {
        const { error } = await supabase.from('services').insert(payload);

        if (error) throw error;
        toast.success('Service created');
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: any) => {
    const confirmed = window.confirm(
      `Remove "${service.name}"? Existing appointment history may prevent permanent deletion.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Service removed');
      await fetchData();
    } catch (error: any) {
      toast.error(
        error.message ||
          'This service cannot be removed because appointment history exists'
      );
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Service catalogue
          </div>
          <h1 className="app-page-title">Services</h1>
          <p className="app-page-description">
            Manage pricing, duration, categories and online booking visibility.
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Active Services"
          value={activeCount}
          description="Available to your team"
          icon={<Scissors className="h-5 w-5" />}
        />
        <SummaryCard
          title="Online Booking"
          value={onlineCount}
          description="Visible to customers"
          icon={<Wifi className="h-5 w-5" />}
        />
        <SummaryCard
          title="Average Price"
          value={`€${averagePrice.toFixed(2)}`}
          description="Across all services"
          icon={<Euro className="h-5 w-5" />}
        />
      </section>

      <Card className="overflow-hidden rounded-2xl shadow-card">
        <div className="border-b px-4 py-4 sm:px-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl pl-9"
                placeholder="Search services or categories"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 rounded-xl border bg-card px-3 text-sm"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="scrollbar-subtle flex gap-2 overflow-x-auto">
              {([
                ['all', 'All'],
                ['active', 'Active'],
                ['online', 'Online'],
                ['inactive', 'Inactive'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveFilter(value)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    activeFilter === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              Loading services...
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Scissors className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-bold">No services found</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Adjust the filters or create a new service.
              </p>
              <Button className="mt-5" onClick={() => handleOpenDialog()}>
                Add Service
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="grid gap-4 px-5 py-5 transition hover:bg-muted/30 md:grid-cols-[minmax(0,1.4fr)_150px_130px_160px_auto] md:items-center sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{service.name}</h3>
                      <Badge variant="outline">
                        {service.service_categories?.name || 'Uncategorized'}
                      </Badge>
                    </div>

                    {service.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    <span>{service.duration} minutes</span>
                  </div>

                  <div className="text-lg font-bold">
                    €{Number(service.price).toFixed(2)}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={service.is_active ? 'default' : 'secondary'}
                    >
                      {service.is_active ? 'Active' : 'Inactive'}
                    </Badge>

                    {service.online_booking_enabled && (
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700"
                      >
                        Online
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(service)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(service)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Service' : 'Add New Service'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-7 py-4">
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Service Details</h3>
                <p className="text-sm text-muted-foreground">
                  Define the service customers will see in the price list.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="name">Service Name *</Label>
                  <Input
                    id="name"
                    className="h-11 rounded-xl"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData({ ...formData, name: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="price">Price (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-11 rounded-xl"
                    value={formData.price}
                    onChange={(event) =>
                      setFormData({ ...formData, price: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="5"
                    step="5"
                    className="h-11 rounded-xl"
                    value={formData.duration}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        duration: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    value={formData.category_id}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        category_id: event.target.value,
                      })
                    }
                  >
                    <option value="">No Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    className="rounded-xl"
                    value={formData.description}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        description: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-6">
              <div className="flex items-center justify-between rounded-2xl border p-4">
                <div>
                  <Label>Active Status</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Active services can be assigned to staff.
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl border p-4">
                <div>
                  <Label>Online Booking</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Show this service in the customer booking flow.
                  </p>
                </div>
                <Switch
                  checked={formData.online_booking_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      online_booking_enabled: checked,
                    })
                  }
                />
              </div>
            </section>
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
              {saving ? 'Saving...' : 'Save Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string | number;
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
