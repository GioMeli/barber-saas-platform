import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      toast.error(t('services.messages.loadError'));
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
      toast.error(t('services.validation.required'));
      return;
    }

    const price = Number(formData.price);
    const duration = Number(formData.duration);

    if (!Number.isFinite(price) || price < 0) {
      toast.error(t('services.validation.price'));
      return;
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      toast.error(t('services.validation.duration'));
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
        toast.success(t('services.messages.updated'));
      } else {
        const { error } = await supabase.from('services').insert(payload);

        if (error) throw error;
        toast.success(t('services.messages.created'));
      }

      setIsDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || t('services.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: any) => {
    const confirmed = window.confirm(
      t('services.delete.confirm', { name: service.name })
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(t('services.messages.removed'));
      await fetchData();
    } catch (error: any) {
      toast.error(
        error.message ||
          t('services.messages.deleteBlocked')
      );
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('services.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('services.title')}</h1>
          <p className="app-page-description">
            {t('services.description')}
          </p>
        </div>

        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('services.actions.add')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title={t('services.summary.active.title')}
          value={activeCount}
          description={t('services.summary.active.description')}
          icon={<Scissors className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('services.summary.online.title')}
          value={onlineCount}
          description={t('services.summary.online.description')}
          icon={<Wifi className="h-5 w-5" />}
        />
        <SummaryCard
          title={t('services.summary.averagePrice.title')}
          value={`€${averagePrice.toFixed(2)}`}
          description={t('services.summary.averagePrice.description')}
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
                placeholder={t('services.search.placeholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 rounded-xl border bg-card px-3 text-sm"
            >
              <option value="all">{t('services.filters.allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="scrollbar-subtle flex gap-2 overflow-x-auto">
              {([
                ['all', t('services.filters.all')],
                ['active', t('services.filters.active')],
                ['online', t('services.filters.online')],
                ['inactive', t('services.filters.inactive')],
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
              {t('services.states.loading')}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Scissors className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-bold">{t('services.states.emptyTitle')}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {t('services.states.emptyDescription')}
              </p>
              <Button className="mt-5" onClick={() => handleOpenDialog()}>
                {t('services.actions.add')}
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
                        {service.service_categories?.name || t('services.labels.uncategorized')}
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
                    <span>{t('services.labels.durationMinutes', { count: service.duration })}</span>
                  </div>

                  <div className="text-lg font-bold">
                    €{Number(service.price).toFixed(2)}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={service.is_active ? 'default' : 'secondary'}
                    >
                      {service.is_active ? t('services.filters.active') : t('services.filters.inactive')}
                    </Badge>

                    {service.online_booking_enabled && (
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700"
                      >
                        {t('services.filters.online')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(service)}
                      aria-label={t('services.actions.edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(service)}
                      aria-label={t('services.actions.remove')}
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
              {editingId ? t('services.dialog.editTitle') : t('services.dialog.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-7 py-4">
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">{t('services.dialog.detailsTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('services.dialog.detailsDescription')}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="name">{t('services.fields.name')} *</Label>
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
                  <Label htmlFor="price">{t('services.fields.price')} *</Label>
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
                  <Label htmlFor="duration">{t('services.fields.duration')} *</Label>
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
                  <Label htmlFor="category">{t('services.fields.category')}</Label>
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
                    <option value="">{t('services.fields.noCategory')}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="description">{t('services.fields.description')}</Label>
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
                  <Label>{t('services.fields.activeStatus')}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('services.fields.activeHelp')}
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
                  <Label>{t('services.fields.onlineBooking')}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('services.fields.onlineHelp')}
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
              {t('common.cancel')}
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? t('common.saving') : t('services.actions.save')}
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
