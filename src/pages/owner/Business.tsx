import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_TO_LOCALE, normalizeLanguage } from '@/i18n/config';
import {
  Building2,
  CalendarDays,
  Edit,
  Megaphone,
  Plus,
  Trash2,
} from 'lucide-react';

type ClosureFilter = 'active' | 'upcoming' | 'past' | 'all';

const EMPTY_FORM = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  audience: 'registered_customers',
  create_announcement: true,
  is_active: true,
};

export default function Business() {
  const { t, i18n } = useTranslation();
  const locale = LANGUAGE_TO_LOCALE[normalizeLanguage(i18n.resolvedLanguage)];
  const { businessMemberships, user } = useAuth();
  const businessId = businessMemberships[0]?.business_id;
  const business = businessMemberships[0]?.businesses;

  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] =
    useState<ClosureFilter>('active');
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (businessId) void fetchClosures();
  }, [businessId]);

  const fetchClosures = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('business_closures')
        .select('*')
        .eq('business_id', businessId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setClosures(data ?? []);
    } catch (error: any) {
      toast.error(error.message || t('business.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const activeClosures = closures.filter(
    (closure) =>
      closure.is_active &&
      closure.start_date <= today &&
      closure.end_date >= today
  );

  const upcomingClosures = closures.filter(
    (closure) => closure.is_active && closure.start_date > today
  );

  const pastClosures = closures.filter(
    (closure) => closure.end_date < today
  );

  const filteredClosures = useMemo(() => {
    if (activeFilter === 'active') return activeClosures;
    if (activeFilter === 'upcoming') return upcomingClosures;
    if (activeFilter === 'past') return pastClosures;
    return closures;
  }, [
    closures,
    activeFilter,
    activeClosures.length,
    upcomingClosures.length,
    pastClosures.length,
  ]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (closure: any) => {
    setEditingId(closure.id);
    setForm({
      title: closure.title ?? '',
      description: closure.description ?? '',
      start_date: closure.start_date ?? '',
      end_date: closure.end_date ?? '',
      audience: closure.audience ?? 'registered_customers',
      create_announcement: Boolean(closure.linked_post_id),
      is_active: Boolean(closure.is_active),
    });
    setDialogOpen(true);
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      toast.error(t('business.validation.titleRequired'));
      return false;
    }

    if (!form.start_date || !form.end_date) {
      toast.error(t('business.validation.datesRequired'));
      return false;
    }

    if (form.end_date < form.start_date) {
      toast.error(t('business.validation.dateOrder'));
      return false;
    }

    return true;
  };

  const createOrUpdateAnnouncement = async (
    closureId: string,
    existingPostId?: string | null
  ) => {
    if (!form.create_announcement || !businessId) {
      if (existingPostId) {
        const { error } = await supabase
          .from('business_posts')
          .delete()
          .eq('id', existingPostId)
          .eq('business_id', businessId);

        if (error) throw error;
      }

      return null;
    }

    const audience =
      form.audience === 'both' ? 'public' : form.audience;

    const title = form.title.trim();
    const content = [
      form.description.trim(),
      t('business.announcement.closedRange', { start: formatBusinessDate(form.start_date, locale), end: formatBusinessDate(form.end_date, locale) }),
      t('business.announcement.bookingUnavailable'),
    ]
      .filter(Boolean)
      .join('\n\n');

    const payload = {
      business_id: businessId,
      author_user_id: user?.id ?? null,
      title,
      content,
      post_type: 'holiday_closure',
      audience,
      is_published: true,
      published_at: new Date().toISOString(),
      expires_at: endOfClosureDay(form.end_date),
      updated_at: new Date().toISOString(),
    };

    if (existingPostId) {
      const { error } = await supabase
        .from('business_posts')
        .update(payload)
        .eq('id', existingPostId)
        .eq('business_id', businessId);

      if (error) throw error;
      return existingPostId;
    }

    const { data, error } = await supabase
      .from('business_posts')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  };

  const handleSave = async () => {
    if (!validateForm() || !businessId) return;

    setSaving(true);

    try {
      let closureId = editingId;
      let existingPostId: string | null = null;

      if (editingId) {
        const existing = closures.find(
          (closure) => closure.id === editingId
        );
        existingPostId = existing?.linked_post_id ?? null;

        const { error } = await supabase
          .from('business_closures')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            start_date: form.start_date,
            end_date: form.end_date,
            audience: form.audience,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .eq('business_id', businessId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('business_closures')
          .insert({
            business_id: businessId,
            title: form.title.trim(),
            description: form.description.trim() || null,
            start_date: form.start_date,
            end_date: form.end_date,
            audience: form.audience,
            is_active: form.is_active,
            created_by: user?.id ?? null,
          })
          .select('id')
          .single();

        if (error) throw error;
        closureId = data.id;
      }

      if (!closureId) {
        throw new Error(t('business.messages.recordNotCreated'));
      }

      const linkedPostId = await createOrUpdateAnnouncement(
        closureId,
        existingPostId
      );

      const { error: linkError } = await supabase
        .from('business_closures')
        .update({
          linked_post_id: linkedPostId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', closureId)
        .eq('business_id', businessId);

      if (linkError) throw linkError;

      toast.success(
        editingId
          ? t('business.messages.updated')
          : t('business.messages.created')
      );

      setDialogOpen(false);
      await fetchClosures();
    } catch (error: any) {
      toast.error(error.message || t('business.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (closure: any) => {
    if (
      !window.confirm(
        t('business.delete.confirm', { title: closure.title })
      )
    ) {
      return;
    }

    try {
      if (closure.linked_post_id) {
        const { error: postError } = await supabase
          .from('business_posts')
          .delete()
          .eq('id', closure.linked_post_id)
          .eq('business_id', businessId);

        if (postError) throw postError;
      }

      const { error } = await supabase
        .from('business_closures')
        .delete()
        .eq('id', closure.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(t('business.messages.deleted'));
      await fetchClosures();
    } catch (error: any) {
      toast.error(error.message || t('business.messages.deleteFailed'));
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('business.eyebrow')}
          </div>
          <h1 className="app-page-title">{t('business.title')}</h1>
          <p className="app-page-description">
            {t('business.description', { business: business?.name || t('business.common.yourBusiness') })}
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('business.actions.addClosure')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title={t('business.summary.active.title')}
          value={activeClosures.length}
          icon={<Building2 className="h-5 w-5" />}
          description={t('business.summary.active.description')}
        />
        <SummaryCard
          title={t('business.summary.upcoming.title')}
          value={upcomingClosures.length}
          icon={<CalendarDays className="h-5 w-5" />}
          description={t('business.summary.upcoming.description')}
        />
        <SummaryCard
          title={t('business.summary.announcements.title')}
          value={
            closures.filter((closure) => closure.linked_post_id).length
          }
          icon={<Megaphone className="h-5 w-5" />}
          description={t('business.summary.announcements.description')}
        />
      </section>

      <Card className="overflow-hidden rounded-2xl shadow-card">
        <div className="border-b px-4 py-4 sm:px-6">
          <div className="scrollbar-subtle flex gap-2 overflow-x-auto">
            <FilterButton
              active={activeFilter === 'active'}
              label={t('business.filters.active')}
              count={activeClosures.length}
              onClick={() => setActiveFilter('active')}
            />
            <FilterButton
              active={activeFilter === 'upcoming'}
              label={t('business.filters.upcoming')}
              count={upcomingClosures.length}
              onClick={() => setActiveFilter('upcoming')}
            />
            <FilterButton
              active={activeFilter === 'past'}
              label={t('business.filters.past')}
              count={pastClosures.length}
              onClick={() => setActiveFilter('past')}
            />
            <FilterButton
              active={activeFilter === 'all'}
              label={t('business.filters.all')}
              count={closures.length}
              onClick={() => setActiveFilter('all')}
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              {t('business.states.loading')}
            </div>
          ) : filteredClosures.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-bold">
                {t('business.states.emptyTitle')}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {t('business.states.emptyDescription')}
              </p>
              <Button className="mt-5" onClick={openCreate}>
                {t('business.actions.addClosure')}
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredClosures.map((closure) => (
                <div
                  key={closure.id}
                  className="grid gap-4 px-5 py-5 transition hover:bg-muted/25 md:grid-cols-[minmax(0,1.4fr)_220px_170px_auto] md:items-center sm:px-6"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{closure.title}</h3>
                      <ClosureStatus closure={closure} today={today} />
                    </div>

                    {closure.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {closure.description}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-muted/30 p-3 text-sm">
                    <div className="font-semibold">
                      {formatBusinessDate(closure.start_date, locale)}
                    </div>
                    <div className="my-1 text-xs text-muted-foreground">
                      {t('business.common.until')}
                    </div>
                    <div className="font-semibold">
                      {formatBusinessDate(closure.end_date, locale)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">
                      {t(`business.audience.${closure.audience}`, { defaultValue: t('business.audience.registered_customers') })}
                    </Badge>
                    {closure.linked_post_id && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700"
                      >
                        {t('business.common.announcement')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(closure)}
                      aria-label={t('business.actions.edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(closure)}
                      aria-label={t('business.actions.delete')}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editingId ? t('business.dialog.editTitle') : t('business.dialog.addTitle')}
            </DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('business.dialog.description')}
            </p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>{t('business.fields.title')}</Label>
              <Input
                className="h-11 rounded-xl"
                placeholder={t('business.fields.titlePlaceholder')}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('business.fields.startDate')}</Label>
                <Input
                  type="date"
                  className="h-11 rounded-xl"
                  value={form.start_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      start_date: event.target.value,
                      end_date:
                        form.end_date &&
                        form.end_date < event.target.value
                          ? event.target.value
                          : form.end_date,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t('business.fields.endDate')}</Label>
                <Input
                  type="date"
                  min={form.start_date || undefined}
                  className="h-11 rounded-xl"
                  value={form.end_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      end_date: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('business.fields.description')}</Label>
              <Textarea
                rows={5}
                className="rounded-xl"
                placeholder={t('business.fields.descriptionPlaceholder')}
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('business.fields.audience')}</Label>
              <select
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                value={form.audience}
                onChange={(event) =>
                  setForm({
                    ...form,
                    audience: event.target.value,
                  })
                }
              >
                <option value="registered_customers">
                  {t('business.audience.registered_customers')}
                </option>
                <option value="public">{t('business.audience.public')}</option>
                <option value="both">{t('business.audience.both')}</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <Label>{t('business.fields.createAnnouncement')}</Label>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('business.fields.createAnnouncementHelp')}
                </p>
              </div>
              <Switch
                checked={form.create_announcement}
                onCheckedChange={(checked) =>
                  setForm({
                    ...form,
                    create_announcement: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <Label>{t('business.fields.active')}</Label>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('business.fields.activeHelp')}
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? t('common.saving') : t('business.actions.save')}
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
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
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

function FilterButton({
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
          : 'bg-background text-muted-foreground hover:border-primary/40'
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

function ClosureStatus({
  closure,
  today,
}: {
  closure: any;
  today: string;
}) {
  const { t } = useTranslation();
  if (!closure.is_active) {
    return <Badge variant="secondary">{t('business.status.inactive')}</Badge>;
  }

  if (
    closure.start_date <= today &&
    closure.end_date >= today
  ) {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        {t('business.status.closedNow')}
      </Badge>
    );
  }

  if (closure.start_date > today) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        {t('business.status.upcoming')}
      </Badge>
    );
  }

  return <Badge variant="secondary">{t('business.status.past')}</Badge>;
}

function formatBusinessDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function endOfClosureDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}
