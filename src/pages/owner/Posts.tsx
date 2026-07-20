import React, { useEffect, useState } from 'react';
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
import { Edit, Eye, EyeOff, Megaphone, Plus, Trash2 } from 'lucide-react';

const EMPTY_POST = {
  title: '', content: '', post_type: 'announcement', audience: 'public',
  cover_image_url: '', is_published: false, published_at: '', expires_at: '',
};

export default function Posts() {
  const { businessMemberships, user } = useAuth();
  const businessId = businessMemberships[0]?.business_id;
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_POST);

  useEffect(() => { if (businessId) void fetchPosts(); }, [businessId]);

  const fetchPosts = async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await supabase.from('business_posts').select('*')
      .eq('business_id', businessId).order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setPosts(data ?? []);
    setLoading(false);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_POST); setDialogOpen(true); };
  const openEdit = (post: any) => {
    setEditingId(post.id);
    setForm({
      title: post.title ?? '', content: post.content ?? '',
      post_type: post.post_type ?? 'announcement', audience: post.audience ?? 'public',
      cover_image_url: post.cover_image_url ?? '', is_published: Boolean(post.is_published),
      published_at: post.published_at ? String(post.published_at).slice(0,16) : '',
      expires_at: post.expires_at ? String(post.expires_at).slice(0,16) : '',
    });
    setDialogOpen(true);
  };

  const savePost = async () => {
    if (!businessId || !form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required'); return;
    }
    setSaving(true);
    const payload = {
      business_id: businessId, author_user_id: user?.id ?? null,
      title: form.title.trim(), content: form.content.trim(),
      post_type: form.post_type, audience: form.audience,
      cover_image_url: form.cover_image_url || null,
      is_published: form.is_published,
      published_at: form.is_published ? (form.published_at || new Date().toISOString()) : null,
      expires_at: form.expires_at || null, updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from('business_posts').update(payload).eq('id', editingId).eq('business_id', businessId)
      : await supabase.from('business_posts').insert(payload);
    if (result.error) toast.error(result.error.message);
    else { toast.success(editingId ? 'Post updated' : 'Post created'); setDialogOpen(false); await fetchPosts(); }
    setSaving(false);
  };

  const togglePublished = async (post: any) => {
    const next = !post.is_published;
    const { error } = await supabase.from('business_posts').update({
      is_published: next,
      published_at: next ? (post.published_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', post.id).eq('business_id', businessId);
    if (error) toast.error(error.message); else { toast.success(next ? 'Post published' : 'Post unpublished'); await fetchPosts(); }
  };

  const deletePost = async (post: any) => {
    if (!window.confirm('Delete this post permanently?')) return;
    const { error } = await supabase.from('business_posts').delete()
      .eq('id', post.id).eq('business_id', businessId);
    if (error) toast.error(error.message); else { toast.success('Post deleted'); await fetchPosts(); }
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Posts & Announcements</h1>
      <p className="text-sm text-muted-foreground">Publish offers, closures, price updates and store news.</p></div>
      <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New Post</Button>
    </div>

    {loading ? <div className="py-12 text-center text-muted-foreground">Loading...</div>
    : posts.length === 0 ? <Card><CardContent className="flex flex-col items-center p-12 text-center">
        <Megaphone className="h-12 w-12 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">No posts yet</h2>
        <Button className="mt-5" onClick={openCreate}>Create Post</Button>
      </CardContent></Card>
    : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{posts.map(post =>
      <Card key={post.id} className="overflow-hidden">
        {post.cover_image_url && <img src={post.cover_image_url} alt={post.title} className="h-44 w-full object-cover" />}
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant={post.is_published ? 'default' : 'secondary'}>{post.is_published ? 'Published' : 'Draft'}</Badge>
            <Badge variant="outline" className="capitalize">{String(post.post_type).replace(/_/g,' ')}</Badge>
            <Badge variant="outline" className="capitalize">{String(post.audience).replace(/_/g,' ')}</Badge>
          </div>
          <div><h2 className="text-lg font-semibold">{post.title}</h2>
          <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{post.content}</p></div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" size="icon" onClick={() => void togglePublished(post)}>
              {post.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(post)}><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => void deletePost(post)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent>
      </Card>)}</div>}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editingId ? 'Edit Post' : 'New Post'}</DialogTitle></DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2"><Label>Cover Image</Label>
            <ImageUploader value={form.cover_image_url}
              onChange={value => setForm(current => ({...current, cover_image_url:value}))}
              folder={`posts/${businessId ?? 'unknown'}/${editingId ?? 'new'}`} />
          </div>
          <div className="space-y-2"><Label>Title *</Label><Input value={form.title}
            onChange={e => setForm(current => ({...current,title:e.target.value}))} /></div>
          <div className="space-y-2"><Label>Content *</Label><Textarea rows={7} value={form.content}
            onChange={e => setForm(current => ({...current,content:e.target.value}))} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Post Type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.post_type} onChange={e => setForm(current => ({...current,post_type:e.target.value}))}>
              <option value="announcement">Announcement</option><option value="holiday_closure">Holiday Closure</option>
              <option value="promotion">Promotion</option><option value="price_update">Price Update</option>
              <option value="new_product">New Product</option><option value="new_team_member">New Team Member</option>
              <option value="general">General</option></select></div>
            <div className="space-y-2"><Label>Audience</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.audience} onChange={e => setForm(current => ({...current,audience:e.target.value}))}>
              <option value="public">Public</option><option value="registered_customers">Registered Customers</option>
            </select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Publish Date</Label><Input type="datetime-local" value={form.published_at}
              onChange={e => setForm(current => ({...current,published_at:e.target.value}))} /></div>
            <div className="space-y-2"><Label>Expiry Date</Label><Input type="datetime-local" value={form.expires_at}
              onChange={e => setForm(current => ({...current,expires_at:e.target.value}))} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div><Label>Publish Now</Label><p className="text-sm text-muted-foreground">Published posts appear on the storefront.</p></div>
            <Switch checked={form.is_published} onCheckedChange={checked => setForm(current => ({...current,is_published:checked}))} />
          </div>
        </div>
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void savePost()}>{saving ? 'Saving...' : 'Save Post'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
