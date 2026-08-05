import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { staffSupabase } from '@/db/staffSupabase';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Camera, CheckCircle2, Loader2, Mail, ShieldCheck, Trash2, UserRound } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business: any;
  employee: any;
  onSaved: () => Promise<void> | void;
  onForgetDevice: () => Promise<void>;
};

export function StaffProfileSheet({ open, onOpenChange, business, employee, onSaved, onForgetDevice }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [name, setName] = React.useState(employee?.name || '');
  const [phone, setPhone] = React.useState(employee?.phone || '');
  const [bio, setBio] = React.useState(employee?.bio || '');
  const [photoUrl, setPhotoUrl] = React.useState(employee?.photo_url || '');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!employee) return;
    setName(employee.name || '');
    setPhone(employee.phone || '');
    setBio(employee.bio || '');
    setPhotoUrl(employee.photo_url || '');
  }, [employee?.id, employee?.name, employee?.phone, employee?.bio, employee?.photo_url]);

  const save = async () => {
    if (!name.trim()) {
      toast.error(t('staffPortal.profile.nameRequired'));
      return;
    }
    setSaving(true);
    const { error } = await staffSupabase.rpc('staff_update_own_profile', {
      p_business_slug: business.slug,
      p_name: name.trim(),
      p_phone: phone.trim() || null,
      p_bio: bio.trim() || null,
      p_photo_url: photoUrl || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || t('staffPortal.profile.saveFailed'));
      return;
    }
    toast.success(t('staffPortal.profile.saved'));
    await onSaved();
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('staffPortal.profile.imageTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('staffPortal.profile.imageSizeError'));
      return;
    }

    setUploading(true);
    try {
      const extension = (file.name.split('.').pop() || 'webp').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webp';
      const path = `${employee.id}/avatar-${Date.now()}.${extension}`;
      const { error } = await staffSupabase.storage.from('staff-avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = staffSupabase.storage.from('staff-avatars').getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      toast.success(t('staffPortal.profile.imageUploaded'));
    } catch (error: any) {
      console.error('Staff avatar upload failed', error);
      toast.error(error?.message || t('staffPortal.profile.imageUploadFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'safe-bottom max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] p-0' : 'w-full overflow-y-auto p-0 sm:max-w-xl'}>
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary px-6 py-7 text-white">
          <SheetHeader className="text-left">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                <UserRound className="mr-2 h-4 w-4" />{t('staffPortal.profile.badge')}
              </Badge>
              <div className="text-xs font-semibold text-slate-300">{business.name}</div>
            </div>
            <SheetTitle className="text-2xl font-black text-white">{t('staffPortal.profile.title')}</SheetTitle>
            <SheetDescription className="text-slate-300">{t('staffPortal.profile.description')}</SheetDescription>
          </SheetHeader>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4 rounded-2xl border bg-slate-50 p-4">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-2xl font-black text-white">
                {(name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-black">{name || t('staffPortal.profile.staffMember')}</div>
              <div className="mt-1 truncate text-sm text-muted-foreground">{employee.email}</div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                {t('staffPortal.profile.changePhoto')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('staffPortal.profile.name')}</Label>
              <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('staffPortal.profile.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={employee.email || ''} readOnly className="h-11 rounded-xl bg-slate-50 pl-10" />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{t('staffPortal.profile.emailDescription')}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('staffPortal.profile.phone')}</Label>
              <Input value={phone} maxLength={60} onChange={(event) => setPhone(event.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('staffPortal.profile.bio')}</Label>
              <Textarea value={bio} maxLength={1200} rows={5} onChange={(event) => setBio(event.target.value)} className="rounded-xl" />
              <div className="text-right text-xs text-muted-foreground">{bio.length}/1200</div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div><strong>{t('staffPortal.profile.syncTitle')}</strong><div className="mt-1 leading-6 text-emerald-800">{t('staffPortal.profile.syncDescription')}</div></div>
            </div>
          </div>

          <Button className="h-12 w-full rounded-xl font-bold" disabled={saving || uploading} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {saving ? t('staffPortal.profile.saving') : t('staffPortal.profile.save')}
          </Button>

          <div className="border-t pt-5">
            <div className="font-bold">{t('staffPortal.profile.deviceTitle')}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('staffPortal.profile.deviceDescription')}</p>
            <Button variant="destructive" className="mt-4 rounded-xl" onClick={() => void onForgetDevice()}>
              <Trash2 className="mr-2 h-4 w-4" />{t('staffPortal.profile.forgetDevice')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
