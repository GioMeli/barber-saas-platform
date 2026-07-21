import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Edit,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';

type ProfileTab = 'records' | 'history';
type RecordType =
  | 'formula'
  | 'general_note'
  | 'allergy'
  | 'preferred_style'
  | 'product'
  | 'consultation'
  | 'before_after'
  | 'other';

const EMPTY_RECORD = {
  type: 'general_note' as RecordType,
  title: '',
  content: '',
  formula: '',
};

export default function CustomerProfile() {
  const { t, i18n } = useTranslation();
  const { customerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [activeTab, setActiveTab] = useState<ProfileTab>(
    searchParams.get('tab') === 'history' ? 'history' : 'records'
  );
  const [customer, setCustomer] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId && customerId) void fetchProfile();
  }, [businessId, customerId]);

  const fetchProfile = async () => {
    if (!businessId || !customerId) return;

    setLoading(true);

    try {
      const [customerResult, recordsResult, appointmentsResult] =
        await Promise.all([
          supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .eq('business_id', businessId)
            .single(),
          supabase
            .from('customer_records')
            .select(
              '*, customer_record_images(id, storage_path, caption, created_at)'
            )
            .eq('customer_id', customerId)
            .eq('business_id', businessId)
            .order('created_at', { ascending: false }),
          supabase
            .from('appointments')
            .select(
              '*, employees(name), appointment_services(services(name))'
            )
            .eq('customer_id', customerId)
            .eq('business_id', businessId)
            .order('start_time', { ascending: false }),
        ]);

      if (customerResult.error) throw customerResult.error;
      if (recordsResult.error) throw recordsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      setCustomer(customerResult.data);
      setRecords(recordsResult.data ?? []);
      setAppointments(appointmentsResult.data ?? []);
    } catch (error: any) {
      toast.error(error.message || t('customerProfile.toasts.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const completed = appointments.filter(
      (appointment) => appointment.status === 'completed'
    );

    return {
      visits: completed.length,
      totalSpend: completed.reduce(
        (sum, appointment) =>
          sum + Number(appointment.total_price || 0),
        0
      ),
      cancellations: appointments.filter((appointment) =>
        ['cancelled_by_business', 'cancelled_by_customer'].includes(
          appointment.status
        )
      ).length,
      noShows: appointments.filter(
        (appointment) => appointment.status === 'no_show'
      ).length,
    };
  }, [appointments]);

  const switchTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const openRecordDialog = (record?: any) => {
    if (record) {
      setEditingRecord(record);
      setRecordForm({
        type: record.type,
        title: record.title || '',
        content: record.content || '',
        formula: record.formula_data?.formula || '',
      });
    } else {
      setEditingRecord(null);
      setRecordForm(EMPTY_RECORD);
    }

    setImageFile(null);
    setRecordDialogOpen(true);
  };

  const saveRecord = async () => {
    if (!businessId || !customerId || !recordForm.title.trim()) {
      toast.error(t('customerProfile.validation.titleRequired'));
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        business_id: businessId,
        customer_id: customerId,
        created_by: user?.id ?? null,
        type: recordForm.type,
        title: recordForm.title.trim(),
        content: recordForm.content.trim() || null,
        formula_data:
          recordForm.type === 'formula'
            ? { formula: recordForm.formula.trim() }
            : {},
        updated_at: new Date().toISOString(),
      };

      let recordId = editingRecord?.id;

      if (editingRecord) {
        const { error } = await supabase
          .from('customer_records')
          .update(payload)
          .eq('id', editingRecord.id)
          .eq('business_id', businessId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('customer_records')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;
        recordId = data.id;
      }

      if (imageFile && recordId) {
        const extension = imageFile.name.split('.').pop() || 'jpg';
        const storagePath = `${businessId}/${customerId}/${recordId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('customer-records')
          .upload(storagePath, imageFile);

        if (uploadError) throw uploadError;

        const { error: imageError } = await supabase
          .from('customer_record_images')
          .insert({
            customer_record_id: recordId,
            business_id: businessId,
            storage_path: storagePath,
            caption: recordForm.title.trim(),
          });

        if (imageError) throw imageError;
      }

      toast.success(editingRecord ? t('customerProfile.toasts.recordUpdated') : t('customerProfile.toasts.recordCreated'));
      setRecordDialogOpen(false);
      await fetchProfile();
    } catch (error: any) {
      toast.error(error.message || t('customerProfile.toasts.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: any) => {
    if (!window.confirm(t('customerProfile.confirmDeleteRecord'))) return;

    try {
      const imagePaths = (record.customer_record_images ?? [])
        .map((image: any) => image.storage_path)
        .filter(Boolean);

      if (imagePaths.length > 0) {
        await supabase.storage.from('customer-records').remove(imagePaths);
      }

      const { error } = await supabase
        .from('customer_records')
        .delete()
        .eq('id', record.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(t('customerProfile.toasts.recordDeleted'));
      await fetchProfile();
    } catch (error: any) {
      toast.error(error.message || t('customerProfile.toasts.deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="app-page">
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          {t('customerProfile.states.loading')}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="app-page">
        <div className="rounded-2xl border bg-card p-12 text-center">
          {t('customerProfile.states.notFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="app-page-header">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-3">
            <Link to="/dashboard/customers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('customerProfile.back')}
            </Link>
          </Button>

          <div className="flex items-center gap-4">
            <CustomerAvatar name={customer.full_name} large />
            <div>
              <h1 className="app-page-title">{customer.full_name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={customer.user_id ? 'default' : 'secondary'}>
                  {customer.user_id ? t('customers.types.registered') : t('customers.types.guest')}
                </Badge>
                {customer.email && (
                  <span className="text-sm text-muted-foreground">
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <Button onClick={() => openRecordDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('customerProfile.actions.newRecord')}
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('customerProfile.stats.completedVisits')} value={String(totals.visits)} />
        <StatCard
          label={t('customerProfile.stats.totalSpend')}
          value={`€${totals.totalSpend.toFixed(2)}`}
        />
        <StatCard label={t('customerProfile.stats.cancellations')} value={String(totals.cancellations)} />
        <StatCard label={t('customerProfile.stats.noShows')} value={String(totals.noShows)} />
      </section>

      <Card className="rounded-2xl shadow-card">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <ContactItem
            icon={<Mail className="h-4 w-4" />}
            label={t('customers.form.email')}
            value={customer.email || t('customers.noEmail')}
          />
          <ContactItem
            icon={<Phone className="h-4 w-4" />}
            label={t('customers.form.phone')}
            value={customer.phone || t('customers.noPhone')}
          />
          <ContactItem
            icon={<UserRound className="h-4 w-4" />}
            label={t('customerProfile.customerNotes')}
            value={customer.notes || t('customerProfile.noCustomerNotes')}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2 rounded-2xl border bg-card p-2 shadow-card">
        <TabButton
          active={activeTab === 'records'}
          label={t('customerProfile.tabs.records', { count: records.length })}
          onClick={() => switchTab('records')}
        />
        <TabButton
          active={activeTab === 'history'}
          label={t('customerProfile.tabs.history', { count: appointments.length })}
          onClick={() => switchTab('history')}
        />
      </div>

      {activeTab === 'records' ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {records.length === 0 ? (
            <Card className="col-span-2 lg:col-span-4">
              <CardContent className="p-12 text-center">
                <Camera className="mx-auto h-9 w-9 text-muted-foreground/50" />
                <h3 className="mt-4 font-bold">{t('customerProfile.states.noRecords')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('customerProfile.states.noRecordsDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                onEdit={() => openRecordDialog(record)}
                onDelete={() => void deleteRecord(record)}
              />
            ))
          )}
        </section>
      ) : (
        <VisitHistory appointments={appointments} />
      )}

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? t('customerProfile.dialog.editTitle') : t('customerProfile.dialog.newTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label>{t('customerProfile.form.recordType')}</Label>
              <select
                className="h-11 rounded-xl border bg-background px-3 text-sm"
                value={recordForm.type}
                onChange={(event) =>
                  setRecordForm({
                    ...recordForm,
                    type: event.target.value as RecordType,
                  })
                }
              >
                <option value="formula">{t('customerProfile.recordTypes.formula')}</option>
                <option value="general_note">{t('customerProfile.recordTypes.generalNote')}</option>
                <option value="allergy">{t('customerProfile.recordTypes.allergy')}</option>
                <option value="preferred_style">{t('customerProfile.recordTypes.preferredStyle')}</option>
                <option value="product">{t('customerProfile.recordTypes.product')}</option>
                <option value="consultation">{t('customerProfile.recordTypes.consultation')}</option>
                <option value="before_after">{t('customerProfile.recordTypes.beforeAfter')}</option>
                <option value="other">{t('customerProfile.recordTypes.other')}</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>{t('customerProfile.form.title')} *</Label>
              <Input
                value={recordForm.title}
                onChange={(event) =>
                  setRecordForm({
                    ...recordForm,
                    title: event.target.value,
                  })
                }
              />
            </div>

            {recordForm.type === 'formula' && (
              <div className="grid gap-2">
                <Label>{t('customerProfile.form.formula')}</Label>
                <Input
                  value={recordForm.formula}
                  onChange={(event) =>
                    setRecordForm({
                      ...recordForm,
                      formula: event.target.value,
                    })
                  }
                  placeholder={t('customerProfile.form.formulaPlaceholder')}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>{t('customerProfile.form.notes')}</Label>
              <Textarea
                rows={6}
                value={recordForm.content}
                onChange={(event) =>
                  setRecordForm({
                    ...recordForm,
                    content: event.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('customerProfile.form.photo')}</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setRecordDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={saving} onClick={() => void saveRecord()}>
              {saving ? t('common.saving') : t('customerProfile.actions.saveRecord')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecordCard({ record, onEdit, onDelete }: any) {
  const { t, i18n } = useTranslation();
  const images = record.customer_record_images ?? [];

  return (
    <Card className="overflow-hidden rounded-2xl shadow-card">
      {images.length > 0 && (
        <RecordImage storagePath={images[0].storage_path} alt={record.title} />
      )}

      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="secondary">{t(`customerProfile.recordTypes.${recordTypeKey(record.type)}`)}</Badge>
            <CardTitle className="mt-2 line-clamp-2 text-sm leading-5">
              {record.title}
            </CardTitle>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        {record.formula_data?.formula && (
          <div className="truncate rounded-lg border bg-muted/35 p-2.5 text-xs font-semibold">
            {record.formula_data.formula}
          </div>
        )}

        {record.content && (
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
            {record.content}
          </p>
        )}

        <div className="mt-3 truncate text-[10px] text-muted-foreground">
          {formatDateTime(record.created_at, i18n.language)}
        </div>
      </CardContent>
    </Card>
  );
}

function RecordImage({
  storagePath,
  alt,
}: {
  storagePath: string;
  alt: string;
}) {
  const { data } = supabase.storage
    .from('customer-records')
    .getPublicUrl(storagePath);

  return (
    <img
      src={data.publicUrl}
      alt={alt}
      className="h-28 w-full object-cover sm:h-32 lg:h-36"
    />
  );
}

function VisitHistory({ appointments }: { appointments: any[] }) {
  const { t, i18n } = useTranslation();
  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <h3 className="mt-4 font-bold">{t('customerProfile.states.noHistory')}</h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl shadow-card">
      <div className="divide-y">
        {appointments.map((appointment) => {
          const services =
            appointment.appointment_services
              ?.map((row: any) => row.services?.name)
              .filter(Boolean)
              .join(', ') || t('customerProfile.appointment');

          return (
            <div
              key={appointment.id}
              className="grid gap-4 px-5 py-5 md:grid-cols-[180px_1fr_auto]"
            >
              <div>
                <div className="font-bold">
                  {formatDate(appointment.start_time, i18n.language)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatTimeRange(
                    appointment.start_time,
                    appointment.end_time,
                    i18n.language
                  )}
                </div>
              </div>

              <div>
                <div className="font-semibold">{services}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {appointment.employees?.name || t('customerProfile.unassignedProfessional')}
                </div>
              </div>

              <div className="text-left md:text-right">
                <div className="font-bold">
                  €{Number(appointment.total_price || 0).toFixed(2)}
                </div>
                <Badge className="mt-2" variant="secondary">
                  {t(`calendar.status.${appointment.status || 'confirmed'}`, { defaultValue: String(appointment.status || 'confirmed').replace(/_/g, ' ') })}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CustomerAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = String(name || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary ${
        large ? 'h-16 w-16 text-xl' : 'h-11 w-11'
      }`}
    >
      {initials || 'C'}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}

function ContactItem({ icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  );
}

function recordTypeKey(value: string) {
  const map: Record<string, string> = { formula: 'formula', general_note: 'generalNote', allergy: 'allergy', preferred_style: 'preferredStyle', product: 'product', consultation: 'consultation', before_after: 'beforeAfter', other: 'other' };
  return map[value] || 'other';
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTimeRange(start: string, end: string | null | undefined, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return end
    ? `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`
    : formatter.format(new Date(start));
}
