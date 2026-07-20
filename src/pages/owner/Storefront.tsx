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
import { Copy, ExternalLink, Eye, MapPin, Save } from 'lucide-react';
import StoreQrShareCard from '@/components/storefront/StoreQrShareCard';

const EMPTY_FORM = {
  description: '', logo_url: '', cover_image_url: '', phone: '', email: '',
  address: '', address_line_1: '', address_line_2: '', city: '', district: '',
  postal_code: '', latitude: '', longitude: '',
};

export default function Storefront() {
  const { businessMemberships } = useAuth();
  const membership = businessMemberships[0];
  const businessId = membership?.business_id;
  const business = membership?.businesses;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (businessId) void loadBusiness(); }, [businessId]);

  const loadBusiness = async () => {
    const { data, error } = await supabase.from('businesses').select('*').eq('id', businessId).single();
    if (error) { toast.error(error.message); return; }
    setForm({
      description: data.description ?? '', logo_url: data.logo_url ?? '',
      cover_image_url: data.cover_image_url ?? '', phone: data.phone ?? '',
      email: data.email ?? '', address: data.address ?? '',
      address_line_1: data.address_line_1 ?? '', address_line_2: data.address_line_2 ?? '',
      city: data.city ?? '', district: data.district ?? '',
      postal_code: data.postal_code ?? '',
      latitude: data.latitude != null ? String(data.latitude) : '',
      longitude: data.longitude != null ? String(data.longitude) : '',
    });
  };

  const publicUrl = useMemo(
    () => business?.slug ? `${window.location.origin}/app/${business.slug}` : '',
    [business?.slug]
  );

  const saveStorefront = async () => {
    if (!businessId) return;
    setSaving(true);
    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;
    if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) {
      toast.error('Latitude and longitude must be valid numbers'); setSaving(false); return;
    }

    const { error } = await supabase.from('businesses').update({
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
      latitude, longitude,
      updated_at: new Date().toISOString(),
    }).eq('id', businessId);

    if (error) toast.error(error.message); else toast.success('Storefront updated');
    setSaving(false);
  };

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Public link copied');
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Storefront</h1>
      <p className="text-sm text-muted-foreground">Control how customers see your business page.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void copyPublicLink()}><Copy className="mr-2 h-4 w-4" />Copy Link</Button>
        <Button asChild variant="outline"><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Preview</a></Button>
        <Button disabled={saving} onClick={() => void saveStorefront()}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}</Button>
      </div>
    </div>

    <Card><CardContent className="space-y-6 p-6">
      <div><h2 className="text-lg font-semibold">Branding</h2>
      <p className="text-sm text-muted-foreground">Add professional images and a public description.</p></div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2"><Label>Business Logo</Label>
          <ImageUploader value={form.logo_url} onChange={value => setForm(current => ({...current,logo_url:value}))}
            folder={`businesses/${businessId ?? 'unknown'}/logo`} /></div>
        <div className="space-y-2"><Label>Cover Image</Label>
          <ImageUploader value={form.cover_image_url} onChange={value => setForm(current => ({...current,cover_image_url:value}))}
            folder={`businesses/${businessId ?? 'unknown'}/cover`} /></div>
      </div>
      <div className="space-y-2"><Label>Store Description</Label><Textarea rows={5} value={form.description}
        onChange={e => setForm(current => ({...current,description:e.target.value}))}
        placeholder="Describe your salon, specialties and customer experience." /></div>
    </CardContent></Card>

    <Card><CardContent className="space-y-6 p-6">
      <div><h2 className="text-lg font-semibold">Contact Details</h2>
      <p className="text-sm text-muted-foreground">These details are visible on the public store page.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={form.phone}
          onChange={e => setForm(current => ({...current,phone:e.target.value}))} /></div>
        <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email}
          onChange={e => setForm(current => ({...current,email:e.target.value}))} /></div>
      </div>
    </CardContent></Card>

    <Card><CardContent className="space-y-6 p-6">
      <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />
        <div><h2 className="text-lg font-semibold">Location & Directions</h2>
        <p className="text-sm text-muted-foreground">Add a structured address and map coordinates.</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Display Address</Label><Input value={form.address}
          onChange={e => setForm(current => ({...current,address:e.target.value}))} /></div>
        <div className="space-y-2"><Label>Address Line 1</Label><Input value={form.address_line_1}
          onChange={e => setForm(current => ({...current,address_line_1:e.target.value}))} /></div>
        <div className="space-y-2"><Label>Address Line 2</Label><Input value={form.address_line_2}
          onChange={e => setForm(current => ({...current,address_line_2:e.target.value}))} /></div>
        <div className="space-y-2"><Label>City</Label><Input value={form.city}
          onChange={e => setForm(current => ({...current,city:e.target.value}))} /></div>
        <div className="space-y-2"><Label>District</Label><Input value={form.district}
          onChange={e => setForm(current => ({...current,district:e.target.value}))} /></div>
        <div className="space-y-2"><Label>Postal Code</Label><Input value={form.postal_code}
          onChange={e => setForm(current => ({...current,postal_code:e.target.value}))} /></div>
        <div />
        <div className="space-y-2"><Label>Latitude</Label><Input value={form.latitude}
          onChange={e => setForm(current => ({...current,latitude:e.target.value}))} placeholder="35.1856" /></div>
        <div className="space-y-2"><Label>Longitude</Label><Input value={form.longitude}
          onChange={e => setForm(current => ({...current,longitude:e.target.value}))} placeholder="33.3823" /></div>
      </div>
      {form.latitude && form.longitude && <div className="overflow-hidden rounded-xl border">
        <iframe title="Store location preview" src={`https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=15&output=embed`}
          className="h-80 w-full" loading="lazy" /></div>}
    </CardContent></Card>

    <StoreQrShareCard
      publicUrl={publicUrl}
      businessName={business?.name || 'My Business'}
    />
  </div>;
}
