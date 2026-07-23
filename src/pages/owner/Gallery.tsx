import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageUploader } from '@/components/ui/image-uploader';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Edit, Eye, EyeOff, Image as ImageIcon, Plus, Search, Trash2 } from 'lucide-react';

const EMPTY_IMAGE = {
  image_url: '', title: '', caption: '', alt_text: '', display_order: 0, is_public: true,
};

export default function Gallery() {
  const { t } = useTranslation();
  const { activeBusiness, user } = useAuth();
  const businessId = activeBusiness?.id;
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [form, setForm] = useState(EMPTY_IMAGE);

  useEffect(() => { if (businessId) void fetchImages(); }, [businessId]);

  const fetchImages = async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await supabase.from('business_gallery_images').select('*')
      .eq('business_id', businessId).order('display_order').order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setImages(data ?? []);
    setLoading(false);
  };

  const filteredImages = useMemo(() => images.filter((image) => {
    const matchesQuery = !query.trim() || [image.title, image.caption, image.alt_text]
      .filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());
    const matchesVisibility = visibility === 'all' || (visibility === 'public' ? image.is_public : !image.is_public);
    return matchesQuery && matchesVisibility;
  }), [images, query, visibility]);

  const publicCount = images.filter((image) => image.is_public).length;
  const privateCount = images.length - publicCount;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_IMAGE, display_order: images.length });
    setDialogOpen(true);
  };

  const openEdit = (image: any) => {
    setEditingId(image.id);
    setForm({
      image_url: image.image_url ?? '', title: image.title ?? '',
      caption: image.caption ?? '', alt_text: image.alt_text ?? '',
      display_order: Number(image.display_order ?? 0), is_public: Boolean(image.is_public),
    });
    setDialogOpen(true);
  };

  const saveImage = async () => {
    if (!businessId || !form.image_url) { toast.error(t('gallery.validation.imageRequired')); return; }
    setSaving(true);
    const payload = {
      business_id: businessId, image_url: form.image_url,
      title: form.title.trim() || null, caption: form.caption.trim() || null,
      alt_text: form.alt_text.trim() || null, display_order: Number(form.display_order || 0),
      is_public: form.is_public, created_by: user?.id ?? null,
    };
    const result = editingId
      ? await supabase.from('business_gallery_images').update(payload).eq('id', editingId).eq('business_id', businessId)
      : await supabase.from('business_gallery_images').insert(payload);
    if (result.error) toast.error(result.error.message);
    else { toast.success(editingId ? t('gallery.messages.updated') : t('gallery.messages.added')); setDialogOpen(false); await fetchImages(); }
    setSaving(false);
  };

  const deleteImage = async (image: any) => {
    if (!window.confirm(t('gallery.delete.confirm'))) return;
    const { error } = await supabase.from('business_gallery_images').delete()
      .eq('id', image.id).eq('business_id', businessId);
    if (error) toast.error(error.message); else { toast.success(t('gallery.messages.removed')); await fetchImages(); }
  };

  const toggleVisibility = async (image: any) => {
    const { error } = await supabase.from('business_gallery_images')
      .update({ is_public: !image.is_public })
      .eq('id', image.id).eq('business_id', businessId);
    if (error) toast.error(error.message); else { toast.success(image.is_public ? t('gallery.messages.hidden') : t('gallery.messages.published')); await fetchImages(); }
  };

  const moveImage = async (image: any, direction: -1 | 1) => {
    if (!businessId) return;
    const ordered = [...images].sort((a, b) => Number(a.display_order) - Number(b.display_order));
    const index = ordered.findIndex((item) => item.id === image.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const target = ordered[targetIndex];
    const currentOrder = Number(image.display_order ?? index);
    const targetOrder = Number(target.display_order ?? targetIndex);

    const [first, second] = await Promise.all([
      supabase.from('business_gallery_images').update({ display_order: targetOrder }).eq('id', image.id).eq('business_id', businessId),
      supabase.from('business_gallery_images').update({ display_order: currentOrder }).eq('id', target.id).eq('business_id', businessId),
    ]);
    if (first.error || second.error) toast.error((first.error || second.error)?.message);
    else await fetchImages();
  };

  return (
    <div className="app-page pb-12">
      <header className="app-page-header">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('gallery.eyebrow')}</div><h1 className="app-page-title">{t('gallery.title')}</h1><p className="app-page-description">{t('gallery.description')}</p></div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t('gallery.actions.add')}</Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Summary label={t('gallery.summary.total')} value={images.length} icon={<ImageIcon className="h-5 w-5" />} />
        <Summary label={t('gallery.summary.public')} value={publicCount} icon={<Eye className="h-5 w-5" />} />
        <Summary label={t('gallery.summary.private')} value={privateCount} icon={<EyeOff className="h-5 w-5" />} />
      </section>

      <Card className="mt-6 rounded-3xl shadow-card">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('gallery.searchPlaceholder')} /></div>
            <div className="flex gap-2">
              {(['all', 'public', 'private'] as const).map((item) => <Button key={item} size="sm" variant={visibility === item ? 'default' : 'outline'} onClick={() => setVisibility(item)}>{t(`gallery.filters.${item}`)}</Button>)}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? <div className="py-12 text-center text-muted-foreground">{t('gallery.status.loading')}</div>
      : filteredImages.length === 0 ? <Card className="mt-6 rounded-3xl"><CardContent className="flex flex-col items-center p-12 text-center"><ImageIcon className="h-12 w-12 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">{images.length ? t('gallery.empty.filteredTitle') : t('gallery.empty.title')}</h2><p className="mt-2 text-sm text-muted-foreground">{images.length ? t('gallery.empty.filteredDescription') : t('gallery.empty.description')}</p>{!images.length && <Button className="mt-5" onClick={openCreate}>{t('gallery.actions.addFirst')}</Button>}</CardContent></Card>
      : <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{filteredImages.map((image) => {
        const orderedIndex = images.findIndex((item) => item.id === image.id);
        return <Card key={image.id} className="group overflow-hidden rounded-3xl shadow-card">
          <div className="relative"><img src={image.image_url} alt={image.alt_text || image.title || t('gallery.imageFallback')} className="aspect-square w-full object-cover" /><Badge className="absolute left-3 top-3" variant={image.is_public ? 'default' : 'secondary'}>{image.is_public ? t('gallery.visibility.public') : t('gallery.visibility.private')}</Badge></div>
          <CardContent className="p-4"><div className="truncate font-semibold">{image.title || t('gallery.untitled')}</div>{image.caption && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{image.caption}</p>}<div className="mt-4 flex items-center justify-between border-t pt-3"><div className="flex gap-1"><Button variant="ghost" size="icon" disabled={orderedIndex <= 0} onClick={() => void moveImage(image, -1)} aria-label={t('gallery.actions.moveUp')}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" disabled={orderedIndex >= images.length - 1} onClick={() => void moveImage(image, 1)} aria-label={t('gallery.actions.moveDown')}><ArrowDown className="h-4 w-4" /></Button></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => void toggleVisibility(image)} aria-label={t('gallery.actions.toggleVisibility')}>{image.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" onClick={() => openEdit(image)} aria-label={t('common.edit')}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void deleteImage(image)} aria-label={t('common.delete')}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></CardContent>
        </Card>;
      })}</div>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>{editingId ? t('gallery.dialog.edit') : t('gallery.dialog.add')}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2"><Label>{t('gallery.fields.image')} *</Label><ImageUploader value={form.image_url} onChange={(value) => setForm((current) => ({ ...current, image_url: value }))} folder={`gallery/${businessId ?? 'unknown'}/${editingId ?? 'new'}`} /></div>
            <div className="space-y-2"><Label>{t('gallery.fields.title')}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>{t('gallery.fields.caption')}</Label><Textarea rows={3} value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} /></div>
            <div className="space-y-2"><Label>{t('gallery.fields.altText')}</Label><Input value={form.alt_text} onChange={(event) => setForm((current) => ({ ...current, alt_text: event.target.value }))} placeholder={t('gallery.fields.altPlaceholder')} /></div>
            <div className="space-y-2"><Label>{t('gallery.fields.order')}</Label><Input type="number" min="0" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: Number(event.target.value) }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border p-4"><div><Label>{t('gallery.fields.public')}</Label><p className="mt-1 text-sm text-muted-foreground">{t('gallery.fields.publicDescription')}</p></div><Switch checked={form.is_public} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_public: checked }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button><Button disabled={saving} onClick={() => void saveImage()}>{saving ? t('common.saving') : t('gallery.actions.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card className="rounded-3xl shadow-card"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div><div className="mt-4 text-2xl font-extrabold">{value}</div><div className="mt-1 text-sm font-semibold">{label}</div></CardContent></Card>;
}
