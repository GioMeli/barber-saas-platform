import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { ImageUploader } from '@/components/ui/image-uploader';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t } = useTranslation();
  const { businessMemberships } = useAuth();
  const businessId = businessMemberships[0]?.business_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [businessData, setBusinessData] = useState({
    name: '',
    slug: '',
    phone: '',
    email: '',
    address: '',
    description: '',
    logo_url: '',
    map_url: '',
    photos: [] as string[]
  });

  const [settingsData, setSettingsData] = useState({
    booking_interval: 30,
    min_booking_notice: 2,
    max_booking_period: 60,
    email_reminders_enabled: true,
    cancellation_policy: '',
    terms_conditions: ''
  });

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bizRes, settingsRes] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', businessId).single(),
        supabase.from('business_settings').select('*').eq('business_id', businessId).single()
      ]);

      if (bizRes.error) throw bizRes.error;
      
      setBusinessData({
        name: bizRes.data.name || '',
        slug: bizRes.data.slug || '',
        phone: bizRes.data.phone || '',
        email: bizRes.data.email || '',
        address: bizRes.data.address || '',
        description: bizRes.data.description || '',
        logo_url: bizRes.data.logo_url || '',
        map_url: bizRes.data.map_url || '',
        photos: bizRes.data.photos || []
      });

      if (settingsRes.data) {
        setSettingsData({
          booking_interval: settingsRes.data.booking_interval || 30,
          min_booking_notice: settingsRes.data.min_booking_notice || 2,
          max_booking_period: settingsRes.data.max_booking_period || 60,
          email_reminders_enabled: settingsRes.data.email_reminders_enabled ?? true,
          cancellation_policy: settingsRes.data.cancellation_policy || '',
          terms_conditions: settingsRes.data.terms_conditions || ''
        });
      }
      
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error(t('settings.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const [bizError, settingsError] = await Promise.all([
        supabase.from('businesses').update({
          name: businessData.name,
          slug: businessData.slug,
          phone: businessData.phone,
          email: businessData.email,
          address: businessData.address,
          description: businessData.description,
          logo_url: businessData.logo_url,
          map_url: businessData.map_url,
          photos: businessData.photos
        }).eq('id', businessId),
        
        supabase.from('business_settings').update({
          booking_interval: settingsData.booking_interval,
          min_booking_notice: settingsData.min_booking_notice,
          max_booking_period: settingsData.max_booking_period,
          email_reminders_enabled: settingsData.email_reminders_enabled,
          cancellation_policy: settingsData.cancellation_policy,
          terms_conditions: settingsData.terms_conditions
        }).eq('business_id', businessId)
      ]);

      if (bizError.error) throw bizError.error;
      if (settingsError.error) throw settingsError.error;

      toast.success(t('settings.messages.saved'));
    } catch (error: any) {
      toast.error(error.message || t('settings.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>{t('settings.states.loading')}</div>;

  return (
    <div className="app-page max-w-4xl pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h2>
        <p className="text-muted-foreground text-sm">{t('settings.description')}</p>
      </div>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle>{t('settings.businessProfile.title')}</CardTitle>
          <CardDescription>{t('settings.businessProfile.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="biz_name">{t('settings.fields.businessName')}</Label>
              <Input id="biz_name" value={businessData.name} onChange={(e) => setBusinessData({...businessData, name: e.target.value})} className="px-3" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="biz_slug">{t('settings.fields.bookingSlug')}</Label>
              <Input id="biz_slug" value={businessData.slug} onChange={(e) => setBusinessData({...businessData, slug: e.target.value})} className="px-3" />
              <p className="text-xs text-muted-foreground">/book/{businessData.slug}</p>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="biz_phone">{t('settings.fields.phone')}</Label>
              <Input id="biz_phone" value={businessData.phone} onChange={(e) => setBusinessData({...businessData, phone: e.target.value})} className="px-3" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="biz_email">{t('settings.fields.email')}</Label>
              <Input id="biz_email" type="email" value={businessData.email} onChange={(e) => setBusinessData({...businessData, email: e.target.value})} className="px-3" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="biz_address">{t('settings.fields.address')}</Label>
            <Input id="biz_address" value={businessData.address} onChange={(e) => setBusinessData({...businessData, address: e.target.value})} className="px-3" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="biz_desc">{t('settings.fields.description')}</Label>
            <Textarea id="biz_desc" value={businessData.description} onChange={(e) => setBusinessData({...businessData, description: e.target.value})} className="px-3" />
          </div>

          <div className="grid gap-2">
            <Label>{t('settings.fields.logo')}</Label>
            <ImageUploader 
              value={businessData.logo_url} 
              onChange={url => setBusinessData({...businessData, logo_url: url})} 
              folder={`businesses/${businessId}/logo`}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t('settings.fields.coverPhotos')}</Label>
            <div className="flex flex-wrap gap-4">
              {businessData.photos.map((photo, index) => (
                <div key={index} className="relative w-24 h-24 border rounded-md overflow-hidden bg-muted">
                  <img src={photo} alt={t('settings.fields.photoAlt', { index: index + 1 })} className="w-full h-full object-cover" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full"
                    aria-label={t('settings.actions.removePhoto')}
                    onClick={() => {
                      const newPhotos = [...businessData.photos];
                      newPhotos.splice(index, 1);
                      setBusinessData({...businessData, photos: newPhotos});
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="w-24 h-24">
                <ImageUploader 
                  value="" 
                  onChange={url => {
                    if (url) {
                      setBusinessData({...businessData, photos: [...businessData.photos, url]});
                    }
                  }} 
                  folder={`businesses/${businessId}/photos`}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('settings.fields.coverPhotosHelp')}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="biz_map">{t('settings.fields.mapUrl')}</Label>
            <Input id="biz_map" placeholder="https://www.google.com/maps/embed?..." value={businessData.map_url} onChange={(e) => setBusinessData({...businessData, map_url: e.target.value})} className="px-3" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle>{t('settings.bookingPreferences.title')}</CardTitle>
          <CardDescription>{t('settings.bookingPreferences.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="b_interval">{t('settings.bookingPreferences.interval')}</Label>
              <Input id="b_interval" type="number" value={settingsData.booking_interval} onChange={(e) => setSettingsData({...settingsData, booking_interval: parseInt(e.target.value)})} className="px-3" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b_min">{t('settings.bookingPreferences.minNotice')}</Label>
              <Input id="b_min" type="number" value={settingsData.min_booking_notice} onChange={(e) => setSettingsData({...settingsData, min_booking_notice: parseInt(e.target.value)})} className="px-3" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b_max">{t('settings.bookingPreferences.maxAdvance')}</Label>
              <Input id="b_max" type="number" value={settingsData.max_booking_period} onChange={(e) => setSettingsData({...settingsData, max_booking_period: parseInt(e.target.value)})} className="px-3" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="email_rem" 
              checked={settingsData.email_reminders_enabled}
              onChange={(e) => setSettingsData({...settingsData, email_reminders_enabled: e.target.checked})}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="email_rem" className="font-normal">{t('settings.bookingPreferences.emailReminders')}</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle>{t('settings.qr.title')}</CardTitle>
          <CardDescription>{t('settings.qr.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex flex-col items-center sm:flex-row sm:items-start sm:gap-6">
          <div className="bg-white p-4 rounded-lg border border-border shadow-sm inline-block">
            <QRCodeSVG value={`${window.location.origin}/app/${businessData.slug}`} size={160} />
          </div>
          <div className="space-y-4 text-center sm:text-left flex-1 mt-4 sm:mt-0">
            <div>
              <Label>{t('settings.qr.appLink')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={`${window.location.origin}/app/${businessData.slug}`} className="px-3 bg-muted/50" />
                <Button variant="secondary" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/app/${businessData.slug}`);
                  toast.success(t('settings.messages.linkCopied'));
                }}>{t('common.copy')}</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('settings.qr.help')}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('settings.actions.saveChanges')}
        </Button>
      </div>
    </div>
  );
}