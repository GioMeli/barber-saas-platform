import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/db/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageUploader } from '@/components/ui/image-uploader';
import { toast } from 'sonner';
import { Edit, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

const EMPTY_IMAGE = {
  image_url: '', title: '', caption: '', alt_text: '', display_order: 0, is_public: true,
};

export default function Gallery() {
  const { businessMemberships, user } = useAuth();
  const businessId = businessMemberships[0]?.business_id;
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    if (!businessId || !form.image_url) { toast.error('Upload an image first'); return; }
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
    else { toast.success(editingId ? 'Image updated' : 'Image added'); setDialogOpen(false); await fetchImages(); }
    setSaving(false);
  };

  const deleteImage = async (image: any) => {
    if (!window.confirm('Remove this image from the gallery?')) return;
    const { error } = await supabase.from('business_gallery_images').delete()
      .eq('id', image.id).eq('business_id', businessId);
    if (error) toast.error(error.message); else { toast.success('Image removed'); await fetchImages(); }
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Gallery</h1>
      <p className="text-sm text-muted-foreground">Add store photos, recent work and product images.</p></div>
      <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Image</Button>
    </div>

    {loading ? <div className="py-12 text-center text-muted-foreground">Loading...</div>
    : images.length === 0 ? <Card><CardContent className="flex flex-col items-center p-12 text-center">
      <ImageIcon className="h-12 w-12 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">Gallery is empty</h2>
      <Button className="mt-5" onClick={openCreate}>Add First Image</Button>
    </CardContent></Card>
    : <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{images.map(image =>
      <Card key={image.id} className="overflow-hidden">
        <img src={image.image_url} alt={image.alt_text || image.title || 'Gallery image'} className="aspect-square w-full object-cover" />
        <CardContent className="p-4">
          <div className="font-medium">{image.title || 'Untitled image'}</div>
          <div className="mt-1 text-xs text-muted-foreground">{image.is_public ? 'Public' : 'Private'} · Order {image.display_order}</div>
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" size="icon" onClick={() => openEdit(image)}><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => void deleteImage(image)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent>
      </Card>)}</div>}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? 'Edit Image' : 'Add Image'}</DialogTitle></DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2"><Label>Image *</Label><ImageUploader value={form.image_url}
            onChange={value => setForm(current => ({...current,image_url:value}))}
            folder={`gallery/${businessId ?? 'unknown'}/${editingId ?? 'new'}`} /></div>
          <div className="space-y-2"><Label>Title</Label><Input value={form.title}
            onChange={e => setForm(current => ({...current,title:e.target.value}))} /></div>
          <div className="space-y-2"><Label>Caption</Label><Textarea rows={3} value={form.caption}
            onChange={e => setForm(current => ({...current,caption:e.target.value}))} /></div>
          <div className="space-y-2"><Label>Alternative Text</Label><Input value={form.alt_text}
            onChange={e => setForm(current => ({...current,alt_text:e.target.value}))}
            placeholder="Describe the image for accessibility" /></div>
          <div className="space-y-2"><Label>Display Order</Label><Input type="number" min="0" value={form.display_order}
            onChange={e => setForm(current => ({...current,display_order:Number(e.target.value)}))} /></div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div><Label>Public Image</Label><p className="text-sm text-muted-foreground">Public images appear on the storefront.</p></div>
            <Switch checked={form.is_public} onCheckedChange={checked => setForm(current => ({...current,is_public:checked}))} />
          </div>
        </div>
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void saveImage()}>{saving ? 'Saving...' : 'Save Image'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
