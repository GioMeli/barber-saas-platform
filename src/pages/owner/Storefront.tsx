import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImageUploader } from '@/components/ui/image-uploader';
import { ensureBusinessPwaIcons } from '@/pwa/businessIconAssets';
import { toast } from 'sonner';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Save,
  Sparkles,
  Globe2,
  Search,
  Share2,
} from 'lucide-react';
import StoreQrShareCard from '@/components/storefront/StoreQrShareCard';
import { useTranslation } from 'react-i18next';

const EMPTY_FORM = {
  name: '', slug: '', description: '', logo_url: '', cover_image_url: '', phone: '', email: '', pwa_enabled: true, pwa_short_name: '', discovery_enabled: true,
  address: '', address_line_1: '', address_line_2: '', city: '', district: '', map_url: '',
  postal_code: '', latitude: '', longitude: '',
};

const EMPTY_BOOKING = {
  booking_interval: 30,
  min_booking_notice: 2,
  max_booking_period: 60,
  email_reminders_enabled: true,
  cancellation_policy: '',
  terms_conditions: '',
};

const EMPTY_PRESENCE = {
  seo_title: '', seo_description: '', instagram_url: '', facebook_url: '',
  tiktok_url: '', website_url: '', booking_cta_label: '',
  show_team: true, show_products: true, show_gallery: true, show_reviews: true,
};

type SectionKey = 'overview' | 'branding' | 'contact' | 'location' | 'booking' | 'online' | 'sharing';

export default function Storefront() {
  const { activeBusiness, refreshAuthData } = useAuth();
  const { t } = useTranslation();
  const businessId = activeBusiness?.id;
  const business = activeBusiness;
  const [form, setForm] = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [presenceForm, setPresenceForm] = useState(EMPTY_PRESENCE);
  const [initialPresenceForm, setInitialPresenceForm] = useState(EMPTY_PRESENCE);
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING);
  const [initialBookingForm, setInitialBookingForm] = useState(EMPTY_BOOKING);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');

  useEffect(() => {
    if (businessId) void loadBusiness();
  }, [businessId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(form) !== JSON.stringify(initialForm) || JSON.stringify(presenceForm) !== JSON.stringify(initialPresenceForm) || JSON.stringify(bookingForm) !== JSON.stringify(initialBookingForm)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form, initialForm, presenceForm, initialPresenceForm, bookingForm, initialBookingForm]);

  const loadBusiness = async () => {
    if (!businessId) return;
    setLoading(true);
    const [businessResult, presenceResult, bookingResult] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', businessId).single(),
      supabase.from('business_online_presence').select('*').eq('business_id', businessId).maybeSingle(),
      supabase.from('business_settings').select('*').eq('business_id', businessId).maybeSingle(),
    ]);
    if (businessResult.error) {
      console.error('Storefront load error:', businessResult.error);
      toast.error(t('storefront.owner.messages.loadError'));
      setLoading(false);
      return;
    }
    const data = businessResult.data;
    const next = {
      name: data.name ?? '', slug: data.slug ?? '', description: data.description ?? '', logo_url: data.logo_url ?? '',
      cover_image_url: data.cover_image_url ?? '', phone: data.phone ?? '',
      email: data.email ?? '', pwa_enabled: data.pwa_enabled !== false, pwa_short_name: data.pwa_short_name ?? '', discovery_enabled: data.discovery_enabled !== false, address: data.address ?? '',
      address_line_1: data.address_line_1 ?? '', address_line_2: data.address_line_2 ?? '',
      city: data.city ?? '', district: data.district ?? '', map_url: data.map_url ?? '',
      postal_code: data.postal_code ?? '',
      latitude: data.latitude != null ? String(data.latitude) : '',
      longitude: data.longitude != null ? String(data.longitude) : '',
    };
    const presence = presenceResult.data ? {
      seo_title: presenceResult.data.seo_title ?? '',
      seo_description: presenceResult.data.seo_description ?? '',
      instagram_url: presenceResult.data.instagram_url ?? '',
      facebook_url: presenceResult.data.facebook_url ?? '',
      tiktok_url: presenceResult.data.tiktok_url ?? '',
      website_url: presenceResult.data.website_url ?? '',
      booking_cta_label: presenceResult.data.booking_cta_label ?? '',
      show_team: presenceResult.data.show_team !== false,
      show_products: presenceResult.data.show_products !== false,
      show_gallery: presenceResult.data.show_gallery !== false,
      show_reviews: presenceResult.data.show_reviews !== false,
    } : { ...EMPTY_PRESENCE };
    const booking = bookingResult.data ? {
      booking_interval: Number(bookingResult.data.booking_interval ?? 30),
      min_booking_notice: Number(bookingResult.data.min_booking_notice ?? 2),
      max_booking_period: Number(bookingResult.data.max_booking_period ?? 60),
      email_reminders_enabled: bookingResult.data.email_reminders_enabled !== false,
      cancellation_policy: bookingResult.data.cancellation_policy ?? '',
      terms_conditions: bookingResult.data.terms_conditions ?? '',
    } : { ...EMPTY_BOOKING };
    setForm(next);
    setInitialForm(next);
    setPresenceForm(presence);
    setInitialPresenceForm(presence);
    setBookingForm(booking);
    setInitialBookingForm(booking);
    if (next.logo_url) {
      void ensureBusinessPwaIcons(businessId, next.logo_url).catch((error) => console.error('Storefront PWA icon backfill failed', error));
    }
    setLoading(false);
  };

  const publicUrl = useMemo(
    () => form.slug ? `${window.location.origin}/app/${form.slug}` : '',
    [form.slug]
  );

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || JSON.stringify(presenceForm) !== JSON.stringify(initialPresenceForm) || JSON.stringify(bookingForm) !== JSON.stringify(initialBookingForm);
  const completedFields = useMemo(() => {
    const important = [
      form.logo_url, form.cover_image_url, form.description, form.phone,
      form.email, form.address_line_1 || form.address, form.city,
    ];
    return important.filter((value) => String(value ?? '').trim()).length;
  }, [form]);
  const completion = Math.round((completedFields / 7) * 100);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updatePresence = <K extends keyof typeof presenceForm>(key: K, value: (typeof presenceForm)[K]) =>
    setPresenceForm((current) => ({ ...current, [key]: value }));
  const updateBooking = <K extends keyof typeof bookingForm>(key: K, value: (typeof bookingForm)[K]) =>
    setBookingForm((current) => ({ ...current, [key]: value }));

  const saveStorefront = async () => {
    if (!businessId) return;
    setSaving(true);

    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;
    if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) {
      toast.error(t('storefront.owner.validation.coordinates'));
      setSaving(false);
      return;
    }
    if (!form.name.trim()) {
      toast.error(t('settings.fields.businessName'));
      setSaving(false);
      return;
    }
    const normalizedSlug = form.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      toast.error(t('storefront.owner.validation.slug'));
      setSaving(false);
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error(t('storefront.owner.validation.email'));
      setSaving(false);
      return;
    }

    if (bookingForm.booking_interval < 5 || bookingForm.min_booking_notice < 0 || bookingForm.max_booking_period < 1) {
      toast.error(t('storefront.owner.validation.bookingRules'));
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: normalizedSlug,
      description: form.description.trim() || null,
      logo_url: form.logo_url || null,
      cover_image_url: form.cover_image_url || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      pwa_enabled: form.pwa_enabled,
      pwa_short_name: form.pwa_short_name.trim() || null,
      discovery_enabled: form.discovery_enabled,
      address: form.address.trim() || null,
      address_line_1: form.address_line_1.trim() || null,
      address_line_2: form.address_line_2.trim() || null,
      city: form.city.trim() || null,
      district: form.district.trim() || null,
      map_url: form.map_url.trim() || null,
      postal_code: form.postal_code.trim() || null,
      latitude,
      longitude,
      updated_at: new Date().toISOString(),
    };

    const [businessResult, presenceResult, bookingResult] = await Promise.all([
      supabase.from('businesses').update(payload).eq('id', businessId),
      supabase.from('business_online_presence').upsert({
        business_id: businessId,
        seo_title: presenceForm.seo_title.trim() || null,
        seo_description: presenceForm.seo_description.trim() || null,
        instagram_url: presenceForm.instagram_url.trim() || null,
        facebook_url: presenceForm.facebook_url.trim() || null,
        tiktok_url: presenceForm.tiktok_url.trim() || null,
        website_url: presenceForm.website_url.trim() || null,
        booking_cta_label: presenceForm.booking_cta_label.trim() || null,
        show_team: presenceForm.show_team,
        show_products: presenceForm.show_products,
        show_gallery: presenceForm.show_gallery,
        show_reviews: presenceForm.show_reviews,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id' }),
      supabase.from('business_settings').upsert({
        business_id: businessId,
        booking_interval: Math.round(bookingForm.booking_interval),
        min_booking_notice: Math.round(bookingForm.min_booking_notice),
        max_booking_period: Math.round(bookingForm.max_booking_period),
        email_reminders_enabled: bookingForm.email_reminders_enabled,
        cancellation_policy: bookingForm.cancellation_policy.trim() || null,
        terms_conditions: bookingForm.terms_conditions.trim() || null,
      }, { onConflict: 'business_id' }),
    ]);
    if (businessResult.error || presenceResult.error || bookingResult.error) {
      console.error('Storefront save error:', businessResult.error || presenceResult.error || bookingResult.error);
      toast.error(t('storefront.owner.messages.saveError'));
    } else {
      const normalizedForm = { ...form, name: form.name.trim(), slug: normalizedSlug };
      setForm(normalizedForm);
      setInitialForm(normalizedForm);
      setInitialPresenceForm(presenceForm);
      setInitialBookingForm(bookingForm);
      if (normalizedForm.logo_url) {
        try {
          await ensureBusinessPwaIcons(businessId, normalizedForm.logo_url);
        } catch (iconError) {
          console.error('Unable to prepare tenant PWA icons after storefront save', iconError);
          toast.error(t('storefront.owner.messages.iconSyncError'));
        }
      }
      await refreshAuthData();
      toast.success(t('storefront.owner.messages.updated'));
    }
    setSaving(false);
  };

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success(t('storefront.owner.messages.linkCopied'));
  };

  const sections: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: t('storefront.owner.sections.overview'), icon: <Sparkles className="h-4 w-4" /> },
    { id: 'branding', label: t('storefront.owner.sections.branding'), icon: <ImageIcon className="h-4 w-4" /> },
    { id: 'contact', label: t('storefront.owner.sections.contact'), icon: <Phone className="h-4 w-4" /> },
    { id: 'location', label: t('storefront.owner.sections.location'), icon: <MapPin className="h-4 w-4" /> },
    { id: 'booking', label: t('settings.bookingPreferences.title'), icon: <CalendarClock className="h-4 w-4" /> },
    { id: 'online', label: t('storefront.owner.sections.online'), icon: <Globe2 className="h-4 w-4" /> },
    { id: 'sharing', label: t('storefront.owner.sections.sharing'), icon: <Link2 className="h-4 w-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">{t('storefront.owner.status.loading')}</p></div>
      </div>
    );
  }

  return (
    <div className="app-page pb-48 lg:pb-28">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('storefront.owner.eyebrow')}</div>
          <h1 className="app-page-title">{t('storefront.owner.title')}</h1>
          <p className="app-page-description">{t('storefront.owner.description')}</p>
        </div>
        <div className="app-page-actions">
          <Button variant="outline" onClick={() => void copyPublicLink()} disabled={!publicUrl}><Copy className="mr-2 h-4 w-4" />{t('storefront.owner.actions.copyLink')}</Button>
          <Button asChild variant="outline" disabled={!publicUrl}><a href={publicUrl || '#'} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t('storefront.owner.actions.openPublicPage')}</a></Button>
        </div>
      </header>

      <section data-tour="storefront-readiness" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden rounded-3xl border-primary/10 shadow-card">
          <div className="h-1 bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400" />
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-extrabold">{t('storefront.owner.readiness.title')}</h2></div>
                <p className="mt-2 text-sm text-muted-foreground">{t('storefront.owner.readiness.description')}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 80 80" className="-rotate-90 h-full w-full">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={201.06} strokeDashoffset={201.06 - (completion / 100) * 201.06} className="text-primary" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{completion}%</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-slate-950 text-white shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">{t('storefront.owner.readiness.publicUrl')}</div>
            <div className="mt-3 break-all text-sm font-semibold">{publicUrl || t('storefront.owner.readiness.availableAfterCreation')}</div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void copyPublicLink()} disabled={!publicUrl}><Copy className="mr-2 h-3.5 w-3.5" />{t('storefront.owner.actions.copy')}</Button>
              <Button size="sm" variant="secondary" asChild disabled={!publicUrl}><a href={publicUrl || '#'} target="_blank" rel="noreferrer"><Eye className="mr-2 h-3.5 w-3.5" />{t('storefront.owner.actions.preview')}</a></Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <div data-tour="storefront-sections" className="scrollbar-subtle sticky-owner-tabs flex gap-2 overflow-x-auto rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        {sections.map((section) => (
          <button key={section.id} data-tour={`storefront-section-${section.id}`} type="button" onClick={() => setActiveSection(section.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeSection === section.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            {section.icon}{section.label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <section data-tour="storefront-overview" className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div>
                <div><h2 className="text-xl font-extrabold">{form.name || business?.name}</h2><p className="mt-1 text-sm text-muted-foreground">{t('storefront.owner.readiness.identityDescription')}</p></div>
              </div>
              <div className="mt-6 space-y-3">
                <ChecklistLine label={t('storefront.owner.readiness.businessLogo')} complete={Boolean(form.logo_url)} />
                <ChecklistLine label={t('storefront.owner.readiness.coverImage')} complete={Boolean(form.cover_image_url)} />
                <ChecklistLine label={t('storefront.owner.readiness.businessDescription')} complete={Boolean(form.description.trim())} />
                <ChecklistLine label={t('storefront.owner.readiness.phoneAndEmail')} complete={Boolean(form.phone.trim() && form.email.trim())} />
                <ChecklistLine label={t('storefront.owner.readiness.address')} complete={Boolean((form.address_line_1 || form.address).trim())} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl shadow-card">
            <div className="relative h-48 bg-gradient-to-br from-slate-900 to-violet-950">
              {form.cover_image_url && <img src={form.cover_image_url} alt="" className="h-full w-full object-cover opacity-75" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-5 left-5 flex items-center gap-3 text-white">
                {form.logo_url ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow-lg" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur">{business?.name?.charAt(0) || 'V'}</div>}
                <div><div className="text-lg font-extrabold">{form.name || business?.name}</div><div className="text-xs text-white/70">{form.city || t('storefront.owner.readiness.yourLocation')}</div></div>
              </div>
            </div>
            <CardContent className="p-5"><p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{form.description || t('storefront.owner.readiness.descriptionFallback')}</p></CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card lg:col-span-2">
            <CardContent className="space-y-6 p-5 sm:p-7">
              <SectionHeader icon={<Building2 className="h-5 w-5" />} title={t('settings.businessProfile.title')} description={t('settings.businessProfile.description')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('settings.fields.businessName')}><Input value={form.name} onChange={(event) => update('name', event.target.value)} /></Field>
                <Field label={t('settings.fields.bookingSlug')} hint={`/app/${form.slug || 'your-business'}`}><Input value={form.slug} onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))} /></Field>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {activeSection === 'branding' && (
        <Card data-tour="storefront-branding" className="rounded-3xl shadow-card">
          <CardContent className="space-y-7 p-5 sm:p-7">
            <SectionHeader icon={<ImageIcon className="h-5 w-5" />} title={t('storefront.owner.branding.title')} description={t('storefront.owner.branding.description')} />
            <div className="grid gap-6 md:grid-cols-2">
              <Field label={t('storefront.owner.branding.businessLogo')} hint={t('storefront.owner.branding.businessLogoHint')}><ImageUploader value={form.logo_url} onChange={(value) => update('logo_url', value)} folder={`businesses/${businessId ?? 'unknown'}/logo`} pwaIconBusinessId={businessId} /></Field>
              <Field label={t('storefront.owner.branding.coverImage')} hint={t('storefront.owner.branding.coverImageHint')}><ImageUploader value={form.cover_image_url} onChange={(value) => update('cover_image_url', value)} folder={`businesses/${businessId ?? 'unknown'}/cover`} /></Field>
            </div>
            <Field label={t('storefront.owner.branding.storeDescription')} hint={t('storefront.owner.branding.storeDescriptionHint')}>
              <Textarea rows={7} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder={t('storefront.owner.branding.descriptionPlaceholder')} />
              <div className="mt-2 text-right text-xs text-muted-foreground">{t('storefront.owner.branding.characterCount', { count: form.description.length })}</div>
            </Field>
            <div className="grid gap-5 rounded-2xl border bg-muted/15 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <Label>{t('storefront.owner.pwa.title')}</Label>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('storefront.owner.pwa.description')}</p>
              </div>
              <Switch checked={form.pwa_enabled} onCheckedChange={(value) => update('pwa_enabled', value)} />
              <Field label={t('storefront.owner.pwa.shortName')} hint={t('storefront.owner.pwa.shortNameHint')} className="md:col-span-2">
                <Input maxLength={30} value={form.pwa_short_name} onChange={(event) => update('pwa_short_name', event.target.value)} placeholder={form.name || business?.name || 'Velliqo'} />
              </Field>
              <div className="rounded-xl bg-background p-4 text-xs leading-5 text-muted-foreground md:col-span-2">
                {t('storefront.owner.pwa.logoHint')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'contact' && (
        <Card data-tour="storefront-contact" className="rounded-3xl shadow-card">
          <CardContent className="space-y-7 p-5 sm:p-7">
            <SectionHeader icon={<Phone className="h-5 w-5" />} title={t('storefront.owner.contact.title')} description={t('storefront.owner.contact.description')} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('storefront.owner.contact.publicPhone')} hint={t('storefront.owner.contact.phoneHint')}><Input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+357..." /></Field>
              <Field label={t('storefront.owner.contact.publicEmail')} hint={t('storefront.owner.contact.emailHint')}><Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="hello@business.com" /></Field>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'location' && (
        <Card data-tour="storefront-location" className="rounded-3xl shadow-card">
          <CardContent className="space-y-7 p-5 sm:p-7">
            <SectionHeader icon={<MapPin className="h-5 w-5" />} title={t('storefront.owner.location.title')} description={t('storefront.owner.location.description')} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('storefront.owner.location.displayAddress')} hint={t('storefront.owner.location.displayAddressHint')} className="sm:col-span-2"><Input value={form.address} onChange={(event) => update('address', event.target.value)} /></Field>
              <Field label={t('storefront.owner.location.addressLine1')}><Input value={form.address_line_1} onChange={(event) => update('address_line_1', event.target.value)} /></Field>
              <Field label={t('storefront.owner.location.addressLine2')}><Input value={form.address_line_2} onChange={(event) => update('address_line_2', event.target.value)} /></Field>
              <Field label={t('storefront.owner.location.city')}><Input value={form.city} onChange={(event) => update('city', event.target.value)} /></Field>
              <Field label={t('storefront.owner.location.district')}><Input value={form.district} onChange={(event) => update('district', event.target.value)} /></Field>
              <Field label={t('storefront.owner.location.postalCode')}><Input value={form.postal_code} onChange={(event) => update('postal_code', event.target.value)} /></Field>
              <div />
              <Field label={t('storefront.owner.location.latitude')} hint={t('storefront.owner.location.coordinateHint', { value: '35.1856' })}><Input value={form.latitude} onChange={(event) => update('latitude', event.target.value)} /></Field>
              <Field label={t('storefront.owner.location.longitude')} hint={t('storefront.owner.location.coordinateHint', { value: '33.3823' })}><Input value={form.longitude} onChange={(event) => update('longitude', event.target.value)} /></Field>
              <Field label={t('settings.fields.mapUrl')} hint={t('storefront.owner.location.mapUrlHint')} className="sm:col-span-2"><Input type="url" value={form.map_url} onChange={(event) => update('map_url', event.target.value)} placeholder="https://www.google.com/maps/embed?..." /></Field>
            </div>
            {(form.latitude && form.longitude) || form.map_url ? (
              <div className="overflow-hidden rounded-2xl border">
                <iframe title={t('storefront.owner.location.mapTitle')} src={form.latitude && form.longitude ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=15&output=embed` : form.map_url} className="h-80 w-full" loading="lazy" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}


      {activeSection === 'booking' && (
        <div data-tour="storefront-booking" className="space-y-6">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="space-y-7 p-5 sm:p-7">
              <SectionHeader icon={<CalendarClock className="h-5 w-5" />} title={t('settings.bookingPreferences.title')} description={t('settings.bookingPreferences.description')} />
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={t('settings.bookingPreferences.interval')}><Input type="number" min="5" step="5" value={bookingForm.booking_interval} onChange={(event) => updateBooking('booking_interval', Number(event.target.value))} /></Field>
                <Field label={t('settings.bookingPreferences.minNotice')}><Input type="number" min="0" step="1" value={bookingForm.min_booking_notice} onChange={(event) => updateBooking('min_booking_notice', Number(event.target.value))} /></Field>
                <Field label={t('settings.bookingPreferences.maxAdvance')}><Input type="number" min="1" step="1" value={bookingForm.max_booking_period} onChange={(event) => updateBooking('max_booking_period', Number(event.target.value))} /></Field>
              </div>
              <VisibilityToggle label={t('settings.bookingPreferences.emailReminders')} description={t('settings.bookingPreferences.emailRemindersHint')} checked={bookingForm.email_reminders_enabled} onChange={(checked) => updateBooking('email_reminders_enabled', checked)} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card">
            <CardContent className="space-y-6 p-5 sm:p-7">
              <SectionHeader icon={<Globe2 className="h-5 w-5" />} title={t('settings.bookingPreferences.customerPolicies')} description={t('settings.bookingPreferences.customerPoliciesDescription')} />
              <Field label={t('settings.bookingPreferences.cancellationPolicy')}><Textarea rows={5} value={bookingForm.cancellation_policy} onChange={(event) => updateBooking('cancellation_policy', event.target.value)} /></Field>
              <Field label={t('settings.bookingPreferences.termsConditions')}><Textarea rows={7} value={bookingForm.terms_conditions} onChange={(event) => updateBooking('terms_conditions', event.target.value)} /></Field>
            </CardContent>
          </Card>
        </div>
      )}


      {activeSection === 'online' && (
        <div data-tour="storefront-online" className="space-y-6">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="space-y-7 p-5 sm:p-7">
              <SectionHeader icon={<Search className="h-5 w-5" />} title={t('storefront.owner.online.title')} description={t('storefront.owner.online.description')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('storefront.owner.online.seoTitle')} hint={t('storefront.owner.online.seoTitleHint')} className="sm:col-span-2"><Input value={presenceForm.seo_title} onChange={(event) => updatePresence('seo_title', event.target.value)} placeholder={form.name || business?.name || ''} /></Field>
                <Field label={t('storefront.owner.online.seoDescription')} hint={t('storefront.owner.online.seoDescriptionHint')} className="sm:col-span-2"><Textarea rows={4} value={presenceForm.seo_description} onChange={(event) => updatePresence('seo_description', event.target.value)} /></Field>
                <Field label={t('storefront.owner.online.bookingCta')} hint={t('storefront.owner.online.bookingCtaHint')} className="sm:col-span-2"><Input value={presenceForm.booking_cta_label} onChange={(event) => updatePresence('booking_cta_label', event.target.value)} placeholder={t('storefront.public.actions.bookAppointment')} /></Field>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card">
            <CardContent className="space-y-7 p-5 sm:p-7">
              <SectionHeader icon={<Share2 className="h-5 w-5" />} title={t('storefront.owner.online.socialTitle')} description={t('storefront.owner.online.socialDescription')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Instagram"><Input type="url" value={presenceForm.instagram_url} onChange={(event) => updatePresence('instagram_url', event.target.value)} placeholder="https://instagram.com/..." /></Field>
                <Field label="Facebook"><Input type="url" value={presenceForm.facebook_url} onChange={(event) => updatePresence('facebook_url', event.target.value)} placeholder="https://facebook.com/..." /></Field>
                <Field label="TikTok"><Input type="url" value={presenceForm.tiktok_url} onChange={(event) => updatePresence('tiktok_url', event.target.value)} placeholder="https://tiktok.com/@..." /></Field>
                <Field label={t('storefront.owner.online.website')}><Input type="url" value={presenceForm.website_url} onChange={(event) => updatePresence('website_url', event.target.value)} placeholder="https://..." /></Field>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card">
            <CardContent className="space-y-5 p-5 sm:p-7">
              <SectionHeader icon={<Eye className="h-5 w-5" />} title={t('storefront.owner.online.visibilityTitle')} description={t('storefront.owner.online.visibilityDescription')} />
              <VisibilityToggle label={t('storefront.owner.online.showTeam')} checked={presenceForm.show_team} onChange={(checked) => updatePresence('show_team', checked)} />
              <VisibilityToggle label={t('storefront.owner.online.showProducts')} checked={presenceForm.show_products} onChange={(checked) => updatePresence('show_products', checked)} />
              <VisibilityToggle label={t('storefront.owner.online.showGallery')} checked={presenceForm.show_gallery} onChange={(checked) => updatePresence('show_gallery', checked)} />
              <VisibilityToggle label={t('storefront.owner.online.showReviews')} checked={presenceForm.show_reviews} onChange={(checked) => updatePresence('show_reviews', checked)} />
              <VisibilityToggle label={t('storefront.owner.online.discoveryListing')} description={t('storefront.owner.online.discoveryListingHint')} checked={form.discovery_enabled} onChange={(checked) => update('discovery_enabled', checked)} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'sharing' && (
        <div data-tour="storefront-sharing" className="space-y-6">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-5 sm:p-7">
              <SectionHeader icon={<Link2 className="h-5 w-5" />} title={t('storefront.owner.sharing.title')} description={t('storefront.owner.sharing.description')} />
              <div className="mt-6 rounded-2xl border bg-muted/25 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('storefront.owner.sharing.publicLink')}</div>
                <div className="mt-2 break-all font-semibold">{publicUrl}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void copyPublicLink()}><Copy className="mr-2 h-4 w-4" />{t('storefront.owner.actions.copyLink')}</Button>
                  <Button variant="outline" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t('storefront.owner.actions.openPreview')}</a></Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <StoreQrShareCard publicUrl={publicUrl} businessName={form.name || business?.name || t('storefront.owner.sharing.defaultBusinessName')} />
        </div>
      )}

      <div data-tour="storefront-save" className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 p-3 shadow-[0_-12px_30px_rgba(15,23,42,.08)] backdrop-blur lg:bottom-0 lg:left-[264px]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{isDirty ? t('storefront.owner.status.unsaved') : t('storefront.owner.status.saved')}</div>
            <div className="truncate text-xs text-muted-foreground">{activeSection === 'overview' ? t('storefront.owner.status.reviewReadiness') : t('storefront.owner.status.editing', { section: sections.find((section) => section.id === activeSection)?.label })}</div>
          </div>
          <Button onClick={() => void saveStorefront()} disabled={saving || !isDirty} className="shrink-0">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? t('storefront.owner.status.saving') : t('storefront.owner.actions.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div><h2 className="text-lg font-extrabold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><div><Label className="font-semibold">{label}</Label>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>{children}</div>;
}


function VisibilityToggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border p-4"><div><span className="text-sm font-semibold">{label}</span>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div><Switch checked={checked} onCheckedChange={onChange} /></div>;
}

function ChecklistLine({ label, complete }: { label: string; complete: boolean }) {
  const { t } = useTranslation();
  return <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-medium">{label}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{complete ? t('storefront.owner.readiness.complete') : t('storefront.owner.readiness.needsAttention')}</span></div>;
}
