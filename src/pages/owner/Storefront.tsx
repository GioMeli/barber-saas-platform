import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/ui/image-uploader';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  ImageIcon,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
} from 'lucide-react';
import StoreQrShareCard from '@/components/storefront/StoreQrShareCard';

const EMPTY_FORM = {
  description: '', logo_url: '', cover_image_url: '', phone: '', email: '',
  address: '', address_line_1: '', address_line_2: '', city: '', district: '',
  postal_code: '', latitude: '', longitude: '',
};

type SectionKey = 'overview' | 'branding' | 'contact' | 'location' | 'sharing';

export default function Storefront() {
  const { activeBusiness } = useAuth();
  const businessId = activeBusiness?.id;
  const business = activeBusiness;
  const [form, setForm] = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');

  useEffect(() => {
    if (businessId) void loadBusiness();
  }, [businessId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(form) !== JSON.stringify(initialForm)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form, initialForm]);

  const loadBusiness = async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await supabase.from('businesses').select('*').eq('id', businessId).single();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const next = {
      description: data.description ?? '', logo_url: data.logo_url ?? '',
      cover_image_url: data.cover_image_url ?? '', phone: data.phone ?? '',
      email: data.email ?? '', address: data.address ?? '',
      address_line_1: data.address_line_1 ?? '', address_line_2: data.address_line_2 ?? '',
      city: data.city ?? '', district: data.district ?? '',
      postal_code: data.postal_code ?? '',
      latitude: data.latitude != null ? String(data.latitude) : '',
      longitude: data.longitude != null ? String(data.longitude) : '',
    };
    setForm(next);
    setInitialForm(next);
    setLoading(false);
  };

  const publicUrl = useMemo(
    () => business?.slug ? `${window.location.origin}/app/${business.slug}` : '',
    [business?.slug]
  );

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const completedFields = useMemo(() => {
    const important = [
      form.logo_url, form.cover_image_url, form.description, form.phone,
      form.email, form.address_line_1 || form.address, form.city,
    ];
    return important.filter((value) => String(value ?? '').trim()).length;
  }, [form]);
  const completion = Math.round((completedFields / 7) * 100);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const saveStorefront = async () => {
    if (!businessId) return;
    setSaving(true);

    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;
    if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) {
      toast.error('Latitude and longitude must be valid numbers');
      setSaving(false);
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Enter a valid public email address');
      setSaving(false);
      return;
    }

    const payload = {
      description: form.description.trim() || null,
      logo_url: form.logo_url || null,
      cover_image_url: form.cover_image_url || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      address_line_1: form.address_line_1.trim() || null,
      address_line_2: form.address_line_2.trim() || null,
      city: form.city.trim() || null,
      district: form.district.trim() || null,
      postal_code: form.postal_code.trim() || null,
      latitude,
      longitude,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('businesses').update(payload).eq('id', businessId);
    if (error) {
      toast.error(error.message);
    } else {
      setInitialForm(form);
      toast.success('Storefront updated successfully');
    }
    setSaving(false);
  };

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Public link copied');
  };

  const sections: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'branding', label: 'Branding', icon: <ImageIcon className="h-4 w-4" /> },
    { id: 'contact', label: 'Contact', icon: <Phone className="h-4 w-4" /> },
    { id: 'location', label: 'Location', icon: <MapPin className="h-4 w-4" /> },
    { id: 'sharing', label: 'Preview & sharing', icon: <Link2 className="h-4 w-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Loading storefront editor…</p></div>
      </div>
    );
  }

  return (
    <div className="app-page pb-28">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Public presence</div>
          <h1 className="app-page-title">Storefront Studio</h1>
          <p className="app-page-description">Build and maintain the public destination customers use to discover, trust and book your business.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void copyPublicLink()} disabled={!publicUrl}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
          <Button asChild variant="outline" disabled={!publicUrl}><a href={publicUrl || '#'} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open public page</a></Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden rounded-3xl border-primary/10 shadow-card">
          <div className="h-1 bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400" />
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><h2 className="text-lg font-extrabold">Storefront readiness</h2></div>
                <p className="mt-2 text-sm text-muted-foreground">Complete the essential information customers expect before booking.</p>
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
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Public URL</div>
            <div className="mt-3 break-all text-sm font-semibold">{publicUrl || 'Available after business creation'}</div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void copyPublicLink()} disabled={!publicUrl}><Copy className="mr-2 h-3.5 w-3.5" />Copy</Button>
              <Button size="sm" variant="secondary" asChild disabled={!publicUrl}><a href={publicUrl || '#'} target="_blank" rel="noreferrer"><Eye className="mr-2 h-3.5 w-3.5" />Preview</a></Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="scrollbar-subtle sticky top-16 z-20 flex gap-2 overflow-x-auto rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur md:top-0">
        {sections.map((section) => (
          <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeSection === section.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            {section.icon}{section.label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div>
                <div><h2 className="text-xl font-extrabold">{business?.name}</h2><p className="mt-1 text-sm text-muted-foreground">Your public business identity and customer destination.</p></div>
              </div>
              <div className="mt-6 space-y-3">
                <ChecklistLine label="Business logo" complete={Boolean(form.logo_url)} />
                <ChecklistLine label="Cover image" complete={Boolean(form.cover_image_url)} />
                <ChecklistLine label="Business description" complete={Boolean(form.description.trim())} />
                <ChecklistLine label="Phone and email" complete={Boolean(form.phone.trim() && form.email.trim())} />
                <ChecklistLine label="Address" complete={Boolean((form.address_line_1 || form.address).trim())} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl shadow-card">
            <div className="relative h-48 bg-gradient-to-br from-slate-900 to-violet-950">
              {form.cover_image_url && <img src={form.cover_image_url} alt="" className="h-full w-full object-cover opacity-75" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-5 left-5 flex items-center gap-3 text-white">
                {form.logo_url ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow-lg" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur">{business?.name?.charAt(0) || 'V'}</div>}
                <div><div className="text-lg font-extrabold">{business?.name}</div><div className="text-xs text-white/70">{form.city || 'Your location'}</div></div>
              </div>
            </div>
            <CardContent className="p-5"><p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{form.description || 'Add a clear business description to introduce your services and customer experience.'}</p></CardContent>
          </Card>
        </section>
      )}

      {activeSection === 'branding' && (
        <Card className="rounded-3xl shadow-card">
          <CardContent className="space-y-7 p-5 sm:p-7">
            <SectionHeader icon={<ImageIcon className="h-5 w-5" />} title="Branding and story" description="Create a recognisable, professional first impression." />
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Business logo" hint="Square image recommended."><ImageUploader value={form.logo_url} onChange={(value) => update('logo_url', value)} folder={`businesses/${businessId ?? 'unknown'}/logo`} /></Field>
              <Field label="Cover image" hint="Wide, high-quality image recommended."><ImageUploader value={form.cover_image_url} onChange={(value) => update('cover_image_url', value)} folder={`businesses/${businessId ?? 'unknown'}/cover`} /></Field>
            </div>
            <Field label="Store description" hint="Explain what makes the business valuable, trustworthy and different.">
              <Textarea rows={7} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe your business, expertise, services and customer experience." />
              <div className="mt-2 text-right text-xs text-muted-foreground">{form.description.length} characters</div>
            </Field>
          </CardContent>
        </Card>
      )}

      {activeSection === 'contact' && (
        <Card className="rounded-3xl shadow-card">
          <CardContent className="space-y-7 p-5 sm:p-7">
            <SectionHeader icon={<Phone className="h-5 w-5" />} title="Contact details" description="These details are visible to customers on the public page." />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Public phone" hint="Include country code where relevant."><Input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+357..." /></Field>
              <Field label="Public email" hint="Used for customer contact."><Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="hello@business.com" /></Field>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSection === 'location' && (
        <Card className="rounded-3xl shadow-card">
          <CardContent className="space-y-7 p-5 sm:p-7">
            <SectionHeader icon={<MapPin className="h-5 w-5" />} title="Location and directions" description="Add structured information for directions and map display." />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Display address" hint="The friendly address shown publicly." className="sm:col-span-2"><Input value={form.address} onChange={(event) => update('address', event.target.value)} /></Field>
              <Field label="Address line 1"><Input value={form.address_line_1} onChange={(event) => update('address_line_1', event.target.value)} /></Field>
              <Field label="Address line 2"><Input value={form.address_line_2} onChange={(event) => update('address_line_2', event.target.value)} /></Field>
              <Field label="City"><Input value={form.city} onChange={(event) => update('city', event.target.value)} /></Field>
              <Field label="District / region"><Input value={form.district} onChange={(event) => update('district', event.target.value)} /></Field>
              <Field label="Postal code"><Input value={form.postal_code} onChange={(event) => update('postal_code', event.target.value)} /></Field>
              <div />
              <Field label="Latitude" hint="Example: 35.1856"><Input value={form.latitude} onChange={(event) => update('latitude', event.target.value)} /></Field>
              <Field label="Longitude" hint="Example: 33.3823"><Input value={form.longitude} onChange={(event) => update('longitude', event.target.value)} /></Field>
            </div>
            {form.latitude && form.longitude && (
              <div className="overflow-hidden rounded-2xl border">
                <iframe title="Store location preview" src={`https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=15&output=embed`} className="h-80 w-full" loading="lazy" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'sharing' && (
        <div className="space-y-6">
          <Card className="rounded-3xl shadow-card">
            <CardContent className="p-5 sm:p-7">
              <SectionHeader icon={<Link2 className="h-5 w-5" />} title="Preview and sharing" description="Open, copy and distribute your permanent public business page." />
              <div className="mt-6 rounded-2xl border bg-muted/25 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Public link</div>
                <div className="mt-2 break-all font-semibold">{publicUrl}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void copyPublicLink()}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
                  <Button variant="outline" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open preview</a></Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <StoreQrShareCard publicUrl={publicUrl} businessName={business?.name || 'My Business'} />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-[0_-12px_30px_rgba(15,23,42,.08)] backdrop-blur md:left-[272px]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{isDirty ? 'You have unsaved storefront changes' : 'All storefront changes are saved'}</div>
            <div className="truncate text-xs text-muted-foreground">{activeSection === 'overview' ? 'Review your public readiness.' : `Editing ${sections.find((section) => section.id === activeSection)?.label}.`}</div>
          </div>
          <Button onClick={() => void saveStorefront()} disabled={saving || !isDirty} className="shrink-0">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Saving…' : 'Save changes'}
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

function ChecklistLine({ label, complete }: { label: string; complete: boolean }) {
  return <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-medium">{label}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{complete ? 'Complete' : 'Needs attention'}</span></div>;
}
