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
import { ImageUploader } from '@/components/ui/image-uploader';
import { toast } from 'sonner';
import {
  CalendarClock,
  Edit,
  Eye,
  EyeOff,
  Globe2,
  Image as ImageIcon,
  Lock,
  Megaphone,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

type PostFilter = 'all' | 'published' | 'draft' | 'scheduled';

const EMPTY_POST = {
  title: '',
  content: '',
  post_type: 'announcement',
  audience: 'public',
  cover_image_url: '',
  is_published: false,
  published_at: '',
  expires_at: '',
};

export default function Posts() {
  const { businessMemberships, user, profile } = useAuth();
  const businessId = businessMemberships[0]?.business_id;
  const business = businessMemberships[0]?.businesses;

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PostFilter>('all');
  const [form, setForm] = useState(EMPTY_POST);

  useEffect(() => {
    if (businessId) void fetchPosts();
  }, [businessId]);

  const fetchPosts = async () => {
    if (!businessId) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('business_posts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data ?? []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = useMemo(() => {
    const now = Date.now();

    return posts.filter((post) => {
      const publishTime = post.published_at
        ? new Date(post.published_at).getTime()
        : null;

      if (filter === 'published') {
        return post.is_published && (!publishTime || publishTime <= now);
      }

      if (filter === 'draft') return !post.is_published;

      if (filter === 'scheduled') {
        return post.is_published && publishTime && publishTime > now;
      }

      return true;
    });
  }, [posts, filter]);

  const publishedCount = posts.filter((post) => post.is_published).length;
  const draftCount = posts.length - publishedCount;
  const scheduledCount = posts.filter(
    (post) =>
      post.is_published &&
      post.published_at &&
      new Date(post.published_at).getTime() > Date.now()
  ).length;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_POST);
    setDialogOpen(true);
  };

  const openEdit = (post: any) => {
    setEditingId(post.id);
    setForm({
      title: post.title ?? '',
      content: post.content ?? '',
      post_type: post.post_type ?? 'announcement',
      audience: post.audience ?? 'public',
      cover_image_url: post.cover_image_url ?? '',
      is_published: Boolean(post.is_published),
      published_at: post.published_at
        ? String(post.published_at).slice(0, 16)
        : '',
      expires_at: post.expires_at
        ? String(post.expires_at).slice(0, 16)
        : '',
    });
    setDialogOpen(true);
  };

  const savePost = async () => {
    if (!businessId || !form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        business_id: businessId,
        author_user_id: user?.id ?? null,
        title: form.title.trim(),
        content: form.content.trim(),
        post_type: form.post_type,
        audience: form.audience,
        cover_image_url: form.cover_image_url || null,
        is_published: form.is_published,
        published_at: form.is_published
          ? form.published_at || new Date().toISOString()
          : null,
        expires_at: form.expires_at || null,
        updated_at: new Date().toISOString(),
      };

      const result = editingId
        ? await supabase
            .from('business_posts')
            .update(payload)
            .eq('id', editingId)
            .eq('business_id', businessId)
        : await supabase.from('business_posts').insert(payload);

      if (result.error) throw result.error;

      toast.success(editingId ? 'Post updated' : 'Post created');
      setDialogOpen(false);
      await fetchPosts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (post: any) => {
    try {
      const nextPublished = !post.is_published;

      const { error } = await supabase
        .from('business_posts')
        .update({
          is_published: nextPublished,
          published_at: nextPublished
            ? post.published_at || new Date().toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(nextPublished ? 'Post published' : 'Post moved to drafts');
      await fetchPosts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update post');
    }
  };

  const deletePost = async (post: any) => {
    if (!window.confirm('Delete this post permanently?')) return;

    try {
      const { error } = await supabase
        .from('business_posts')
        .delete()
        .eq('id', post.id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Post deleted');
      await fetchPosts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete post');
    }
  };

  const businessInitial = business?.name?.charAt(0)?.toUpperCase() || 'B';

  return (
    <div className="app-page pb-10">
      <header className="app-page-header">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Customer communication
          </div>
          <h1 className="app-page-title">Posts</h1>
          <p className="app-page-description">
            Publish professional updates, offers, closures and store news in a
            familiar social-feed format.
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Post
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Published"
          value={publishedCount}
          icon={<Eye className="h-5 w-5" />}
        />
        <SummaryCard
          title="Drafts"
          value={draftCount}
          icon={<Edit className="h-5 w-5" />}
        />
        <SummaryCard
          title="Scheduled"
          value={scheduledCount}
          icon={<CalendarClock className="h-5 w-5" />}
        />
      </section>

      <section className="space-y-5">
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <button
                type="button"
                onClick={openCreate}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border bg-muted/25 p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                  {businessInitial}
                </div>

                <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Share an update with your customers...
                </div>

                <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {([
                  ['all', 'All'],
                  ['published', 'Published'],
                  ['draft', 'Drafts'],
                  ['scheduled', 'Scheduled'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      filter === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            {loading ? (
              <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">
                Loading posts...
              </div>
            ) : filteredPosts.length === 0 ? (
              <Card className="rounded-2xl shadow-card">
                <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-10 text-center">
                  <Megaphone className="h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-bold">No posts in this category</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a post or choose another filter.
                  </p>
                  <Button className="mt-5" onClick={openCreate}>
                    Create Post
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredPosts.map((post) => (
                  <article
                    key={post.id}
                    className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    {post.cover_image_url && (
                      <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                        />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                          {businessInitial}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">
                            {business?.name || 'Your Business'}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>
                              {formatPostDate(
                                post.published_at || post.created_at
                              )}
                            </span>
                            <span>·</span>
                            {post.audience === 'public' ? (
                              <span className="flex items-center gap-1">
                                <Globe2 className="h-3 w-3" />
                                Public
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Registered
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge
                          variant={post.is_published ? 'default' : 'secondary'}
                          className="shrink-0"
                        >
                          {post.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="outline" className="capitalize">
                          {String(post.post_type).replace(/_/g, ' ')}
                        </Badge>

                        {post.expires_at && (
                          <Badge variant="secondary">
                            Expires {formatPostDate(post.expires_at)}
                          </Badge>
                        )}
                      </div>

                      <h2 className="mt-4 line-clamp-2 text-lg font-bold leading-6">
                        {post.title}
                      </h2>

                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-foreground/75">
                        {post.content}
                      </p>

                      <div className="mt-auto grid grid-cols-3 gap-1 border-t pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-w-0 px-2"
                          onClick={() => void togglePublished(post)}
                        >
                          {post.is_published ? (
                            <EyeOff className="mr-1.5 h-4 w-4 shrink-0" />
                          ) : (
                            <Eye className="mr-1.5 h-4 w-4 shrink-0" />
                          )}
                          <span className="truncate">
                            {post.is_published ? 'Unpublish' : 'Publish'}
                          </span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-w-0 px-2"
                          onClick={() => openEdit(post)}
                        >
                          <Edit className="mr-1.5 h-4 w-4 shrink-0" />
                          <span className="truncate">Edit</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-w-0 px-2 text-destructive hover:text-destructive"
                          onClick={() => void deletePost(post)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4 shrink-0" />
                          <span className="truncate">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="hidden xl:block">
            <Card className="sticky top-6 rounded-2xl shadow-card">
              <CardContent className="p-5">
                <h3 className="font-bold">Publishing Guide</h3>

                <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                  <GuideLine
                    icon={<Globe2 className="h-4 w-4" />}
                    title="Public"
                    text="Visible to every storefront visitor."
                  />
                  <GuideLine
                    icon={<Lock className="h-4 w-4" />}
                    title="Registered customers"
                    text="Visible only inside customer accounts."
                  />
                  <GuideLine
                    icon={<CalendarClock className="h-4 w-4" />}
                    title="Schedule & expiry"
                    text="Control when a post appears and when it stops showing."
                  />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[94vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="border-b px-5 py-5 sm:px-7">
            <DialogTitle className="text-2xl">
              {editingId ? 'Edit Post' : 'Create Post'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Compose the post exactly as customers will see it.
            </p>
          </DialogHeader>

          <div className="space-y-6 px-5 py-6 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                {businessInitial}
              </div>
              <div>
                <div className="font-semibold">
                  {business?.name || profile?.full_name || 'Your Business'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Post author
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                className="h-12 rounded-xl text-base font-semibold"
                placeholder="Add a clear headline"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Post content *</Label>
              <Textarea
                rows={9}
                className="rounded-xl text-base leading-7"
                placeholder="What would you like to share?"
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Photo</Label>
              <ImageUploader
                value={form.cover_image_url}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    cover_image_url: value,
                  }))
                }
                folder={`posts/${businessId ?? 'unknown'}/${editingId ?? 'new'}`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Post type</Label>
                <select
                  className="h-11 rounded-xl border bg-background px-3 text-sm"
                  value={form.post_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      post_type: event.target.value,
                    }))
                  }
                >
                  <option value="announcement">Announcement</option>
                  <option value="holiday_closure">Holiday Closure</option>
                  <option value="promotion">Promotion</option>
                  <option value="price_update">Price Update</option>
                  <option value="new_product">New Product</option>
                  <option value="new_team_member">New Team Member</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Audience</Label>
                <select
                  className="h-11 rounded-xl border bg-background px-3 text-sm"
                  value={form.audience}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      audience: event.target.value,
                    }))
                  }
                >
                  <option value="public">Public</option>
                  <option value="registered_customers">
                    Registered Customers
                  </option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Publish date</Label>
                <Input
                  type="datetime-local"
                  className="h-11 rounded-xl"
                  value={form.published_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      published_at: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Expiry date</Label>
                <Input
                  type="datetime-local"
                  className="h-11 rounded-xl"
                  value={form.expires_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expires_at: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <Label>Publish</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Turn this off to keep the post as a draft.
                </p>
              </div>
              <Switch
                checked={form.is_published}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    is_published: checked,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 border-t bg-background px-5 py-4 sm:px-7">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void savePost()}>
              {saving
                ? 'Saving...'
                : form.is_published
                  ? 'Publish Post'
                  : 'Save Draft'}
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
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

function GuideLine({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <div className="font-semibold text-foreground">{title}</div>
        <div className="mt-1 leading-6">{text}</div>
      </div>
    </div>
  );
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
