import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Mail,
  MapPin,
  Megaphone,
  Package,
  Phone,
  Scissors,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { IndustryConfig } from '@/config/industries';

type StoreContext = {
  business: any;
  industry: IndustryConfig;
  openCustomerSignIn: () => void;
  openCustomerSignUp: () => void;
};

const sectionLinks = [
  { id: 'services', label: 'Services' },
  { id: 'team', label: 'Team' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'products', label: 'Products' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'contact', label: 'Contact' },
];

export default function BusinessHome() {
  const { business, industry, openCustomerSignIn, openCustomerSignUp } =
    useOutletContext<StoreContext>();
  const { user } = useAuth();

  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(
    null
  );
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<any | null>(
    null
  );

  useEffect(() => {
    if (business?.id) void fetchStorefrontData();
  }, [business?.id, user?.id]);

  const fetchStorefrontData = async () => {
    if (!business?.id) return;
    setLoading(true);

    const results = await Promise.allSettled([
      supabase
        .from('services')
        .select('id, name, description, duration, price, image_url')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .eq('online_booking_enabled', true)
        .order('name'),
      supabase
        .from('employees')
        .select('id, name, bio, photo_url')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('products')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .eq('is_public', true)
        .order('name'),
      supabase
        .from('business_posts')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(8),
      supabase
        .from('business_gallery_images')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_public', true)
        .order('display_order')
        .limit(12),
      supabase
        .from('business_closures')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString().slice(0, 10))
        .order('start_date')
        .limit(3),
    ]);

    const [
      servicesResult,
      staffResult,
      productsResult,
      postsResult,
      galleryResult,
      closuresResult,
    ] = results;

    setServices(
      servicesResult.status === 'fulfilled' && !servicesResult.value.error
        ? servicesResult.value.data ?? []
        : []
    );
    setStaff(
      staffResult.status === 'fulfilled' && !staffResult.value.error
        ? staffResult.value.data ?? []
        : []
    );
    setProducts(
      productsResult.status === 'fulfilled' && !productsResult.value.error
        ? productsResult.value.data ?? []
        : []
    );
    setPosts(
      postsResult.status === 'fulfilled' && !postsResult.value.error
        ? postsResult.value.data ?? []
        : []
    );
    setGallery(
      galleryResult.status === 'fulfilled' && !galleryResult.value.error
        ? galleryResult.value.data ?? []
        : []
    );
    setClosures(
      closuresResult.status === 'fulfilled' && !closuresResult.value.error
        ? closuresResult.value.data ?? []
        : []
    );

    setLoading(false);
  };

  const fullAddress = useMemo(
    () =>
      [
        business.address_line_1,
        business.address_line_2,
        business.city,
        business.district,
        business.postal_code,
        business.country,
        business.address,
      ]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(', '),
    [business]
  );

  const directionsUrl = useMemo(() => {
    if (business.latitude && business.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`;
    }

    return fullAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          fullAddress
        )}`
      : null;
  }, [business.latitude, business.longitude, fullAddress]);

  const mapEmbedUrl =
    business.latitude && business.longitude
      ? `https://www.google.com/maps?q=${business.latitude},${business.longitude}&z=15&output=embed`
      : business.map_url || null;

  const today = new Date().toISOString().slice(0, 10);
  const activeClosure = closures.find(
    (closure) => closure.start_date <= today && closure.end_date >= today
  );
  const upcomingClosure = closures.find(
    (closure) => closure.start_date > today
  );
  const featuredClosure = activeClosure || upcomingClosure;

  const coverImage =
    business.cover_image_url ||
    business.photos?.[0] ||
    gallery?.[0]?.image_url ||
    null;

  const bookUrl = `/app/${business.slug}/book`;

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const shareStore = async () => {
    const shareData = {
      title: business.name,
      text: `Book an appointment with ${business.name}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // User cancelled the share dialog.
    }
  };

  return (
    <div className="pb-24 md:pb-0">
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {coverImage && (
          <img
            src={coverImage}
            alt={business.name}
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/35" />

        <div className="relative mx-auto grid min-h-[390px] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.25fr_0.75fr] lg:py-12">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Online booking
              </Badge>
              <Badge
                className={
                  activeClosure
                    ? 'bg-amber-400 text-zinc-950 hover:bg-amber-400'
                    : 'bg-emerald-400 text-zinc-950 hover:bg-emerald-400'
                }
              >
                {activeClosure ? 'Temporarily closed' : 'Accepting bookings'}
              </Badge>
            </div>

            <div className="mt-5 flex items-center gap-4">
              {business.logo_url && (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="h-16 w-16 rounded-2xl border border-white/20 object-cover shadow-xl"
                />
              )}
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                  {business.name}
                </h1>
                {(business.city || fullAddress) && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
                    <MapPin className="h-4 w-4" />
                    <span className="line-clamp-1">
                      {business.city || fullAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
              {business.description ||
                industry.labels.storefrontTagline}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-xl px-6">
                <Link to={bookUrl}>
                  <CalendarDays className="mr-2 h-5 w-5" />
                  {industry.labels.bookingCta}
                </Link>
              </Button>

              {directionsUrl && (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-12 rounded-xl border border-white/15 bg-white/10 px-5 text-white hover:bg-white/20"
                >
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="mr-2 h-4 w-4" />
                    Directions
                  </a>
                </Button>
              )}

              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-12 rounded-xl border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                onClick={() => void shareStore()}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>

            {!user && (
              <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/65">
                <span>Guest booking is available.</span>
                <button
                  type="button"
                  className="font-semibold text-white underline underline-offset-4"
                  onClick={openCustomerSignUp}
                >
                  Create an account
                </button>
                <span>for faster future bookings.</span>
              </div>
            )}
          </div>

          <div className="hidden lg:block">
            <div className="rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                Quick access
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <QuickAction
                  label="Services"
                  value={services.length}
                  onClick={() => scrollToSection('services')}
                />
                <QuickAction
                  label={industry.labels.professionals}
                  value={staff.length}
                  onClick={() => scrollToSection('team')}
                />
                <QuickAction
                  label="Announcements"
                  value={posts.length}
                  onClick={() => scrollToSection('announcements')}
                />
                <QuickAction
                  label="Gallery"
                  value={gallery.length}
                  onClick={() => scrollToSection('gallery')}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {featuredClosure && (
        <section className="border-b bg-amber-50">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <div className="font-semibold text-amber-950">
                    {featuredClosure.title}
                  </div>
                  <div className="mt-0.5 text-sm text-amber-800">
                    {formatClosureRange(
                      featuredClosure.start_date,
                      featuredClosure.end_date
                    )}
                    {featuredClosure.description
                      ? ` · ${featuredClosure.description}`
                      : ''}
                  </div>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={bookUrl}>Choose another date</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <nav className="sticky top-[72px] z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="scrollbar-subtle mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          <Button asChild size="sm" className="shrink-0 rounded-full">
            <Link to={bookUrl}>Book</Link>
          </Button>
          {sectionLinks.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0 rounded-full"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        <section id="services" className="scroll-mt-32">
          <CompactHeading
            icon={<Scissors className="h-5 w-5" />}
            title="Services"
            description={industry.labels.serviceSectionDescription}
          />

          {loading ? (
            <LoadingRows />
          ) : services.length === 0 ? (
            <EmptyState text="No public services are available yet." />
          ) : (
            <Card className="overflow-hidden rounded-2xl shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="grid gap-3 p-4 transition hover:bg-muted/30 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center"
                    >
                      {service.image_url ? (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Scissors className="h-5 w-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold">{service.name}</h3>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {service.duration} min
                          </span>
                        </div>
                        {service.description && (
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                            {service.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="text-lg font-bold">
                          €{Number(service.price).toFixed(2)}
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`${bookUrl}?service=${service.id}`}>
                            Book
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section id="team" className="scroll-mt-32">
          <CompactHeading
            icon={<UserRound className="h-5 w-5" />}
            title={industry.labels.teamSectionTitle}
            description={`Choose your preferred ${industry.labels.professional}.`}
          />

          {staff.length === 0 ? (
            <EmptyState text="Team profiles will appear here soon." />
          ) : (
            <div className="scrollbar-subtle flex snap-x gap-3 overflow-x-auto pb-2">
              {staff.map((member) => (
                <Card
                  key={member.id}
                  className="min-w-[250px] max-w-[280px] snap-start rounded-2xl shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold">
                          {member.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{member.name}</h3>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Professional team member
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                      {member.bio || 'Available for online appointments.'}
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                      <Link to={`${bookUrl}?staff=${member.id}`}>
                        Book with {member.name.split(' ')[0]}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section id="gallery" className="scroll-mt-32">
          <CompactHeading
            icon={<ImageIcon className="h-5 w-5" />}
            title="Gallery"
            description="Inside the store and recent work."
          />

          {gallery.length === 0 ? (
            <EmptyState text="The store gallery is currently empty." />
          ) : (
            <div className="scrollbar-subtle flex snap-x gap-3 overflow-x-auto pb-2">
              {gallery.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className="group relative min-w-[220px] max-w-[220px] snap-start overflow-hidden rounded-2xl border bg-muted text-left shadow-sm sm:min-w-[260px] sm:max-w-[260px]"
                  onClick={() => setSelectedGalleryImage(image)}
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || image.title || business.name}
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {(image.title || image.caption) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-10 text-white">
                      <div className="truncate text-sm font-semibold">
                        {image.title || image.caption}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section id="products" className="scroll-mt-32">
          <CompactHeading
            icon={<Package className="h-5 w-5" />}
            title="Products"
            description="Professional products available in store."
          />

          {products.length === 0 ? (
            <EmptyState text="No public products have been added yet." />
          ) : (
            <div className="scrollbar-subtle flex snap-x gap-3 overflow-x-auto pb-2">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="min-w-[210px] max-w-[210px] snap-start overflow-hidden rounded-2xl shadow-sm"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                      <Package className="h-9 w-9 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 font-bold">{product.name}</h3>
                      <span className="shrink-0 font-bold">
                        €{Number(product.price).toFixed(2)}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        Number(product.stock_quantity) > 0
                          ? 'mt-3 bg-emerald-100 text-emerald-700'
                          : 'mt-3'
                      }
                    >
                      {Number(product.stock_quantity) > 0
                        ? 'Available'
                        : 'Out of stock'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section id="announcements" className="scroll-mt-32">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/30"
            onClick={() => setAnnouncementsOpen((current) => !current)}
            aria-expanded={announcementsOpen}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Announcements</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {posts.length > 0
                    ? `${posts.length} published ${
                        posts.length === 1 ? 'update' : 'updates'
                      }`
                    : 'No published updates'}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform ${
                announcementsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {announcementsOpen && (
            <div className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-sm">
              {posts.length === 0 ? (
                <div className="p-7 text-center text-sm text-muted-foreground">
                  There are no published announcements yet.
                </div>
              ) : (
                <div className="divide-y">
                  {posts.map((post, index) => (
                    <button
                      key={post.id}
                      type="button"
                      className="grid w-full gap-3 p-4 text-left transition hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      onClick={() => setSelectedAnnouncement(post)}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {index === 0 && (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                              Latest
                            </Badge>
                          )}
                          <Badge variant="outline" className="capitalize">
                            {String(post.post_type || 'announcement').replace(
                              /_/g,
                              ' '
                            )}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatPostDate(
                              post.published_at || post.created_at
                            )}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate font-bold">{post.title}</h3>
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {post.content}
                        </p>
                      </div>
                      <span className="flex items-center text-sm font-semibold text-primary">
                        Read more
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section
          id="contact"
          className="scroll-mt-32 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <CompactHeading
                icon={<MapPin className="h-5 w-5" />}
                title="Visit & Contact"
                description="Everything you need before your visit."
                noMargin
              />

              <div className="mt-5 space-y-2">
                {fullAddress && (
                  <ContactRow
                    icon={<MapPin className="h-4 w-4" />}
                    value={fullAddress}
                  />
                )}
                {business.phone && (
                  <ContactRow
                    icon={<Phone className="h-4 w-4" />}
                    value={
                      <a href={`tel:${business.phone}`} className="hover:underline">
                        {business.phone}
                      </a>
                    }
                  />
                )}
                {business.email && (
                  <ContactRow
                    icon={<Mail className="h-4 w-4" />}
                    value={
                      <a
                        href={`mailto:${business.email}`}
                        className="hover:underline"
                      >
                        {business.email}
                      </a>
                    }
                  />
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {directionsUrl && (
                  <Button asChild className="rounded-xl">
                    <a href={directionsUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Directions
                    </a>
                  </Button>
                )}
                {!user && (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={openCustomerSignIn}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {mapEmbedUrl ? (
            <div className="min-h-[280px] overflow-hidden rounded-2xl border bg-muted shadow-sm">
              <iframe
                title={`${business.name} location`}
                src={mapEmbedUrl}
                className="h-full min-h-[280px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Map location has not been configured yet.
            </div>
          )}
        </section>
      </main>

      <footer className="border-t bg-muted/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.name}
                className="h-9 w-9 rounded-xl border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Scissors className="h-4 w-4" />
              </div>
            )}
            <div>
              <div className="text-sm font-bold">{business.name}</div>
              <div className="text-xs text-muted-foreground">
                Professional online booking
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link to={bookUrl} className="font-semibold text-primary">
              Book Appointment
            </Link>
            <span className="text-muted-foreground">Privacy</span>
            <span className="text-muted-foreground">Terms</span>
          </div>
        </div>
      </footer>

      <Dialog
        open={Boolean(selectedAnnouncement)}
        onOpenChange={(open) => !open && setSelectedAnnouncement(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {String(
                      selectedAnnouncement.post_type || 'announcement'
                    ).replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatPostDate(
                      selectedAnnouncement.published_at ||
                        selectedAnnouncement.created_at
                    )}
                  </span>
                </div>
                <DialogTitle className="pt-2 text-2xl">
                  {selectedAnnouncement.title}
                </DialogTitle>
              </DialogHeader>

              {selectedAnnouncement.cover_image_url && (
                <img
                  src={selectedAnnouncement.cover_image_url}
                  alt={selectedAnnouncement.title}
                  className="mt-3 max-h-[360px] w-full rounded-2xl object-cover"
                />
              )}

              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {selectedAnnouncement.content}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedGalleryImage)}
        onOpenChange={(open) => !open && setSelectedGalleryImage(null)}
      >
        <DialogContent className="max-w-4xl overflow-hidden rounded-3xl border-0 bg-black p-0 text-white">
          {selectedGalleryImage && (
            <div className="relative">
              <button
                type="button"
                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
                onClick={() => setSelectedGalleryImage(null)}
                aria-label="Close image"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={selectedGalleryImage.image_url}
                alt={
                  selectedGalleryImage.alt_text ||
                  selectedGalleryImage.title ||
                  business.name
                }
                className="max-h-[82vh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickAction({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left transition hover:bg-white/10"
      onClick={onClick}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-white/60">{label}</div>
    </button>
  );
}

function CompactHeading({
  icon,
  title,
  description,
  noMargin = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  noMargin?: boolean;
}) {
  return (
    <div className={noMargin ? '' : 'mb-4'}>
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

function ContactRow({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/35 p-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="text-sm leading-5">{value}</div>
    </div>
  );
}

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatClosureRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const startText = formatter.format(new Date(`${start}T00:00:00`));
  const endText = formatter.format(new Date(`${end}T00:00:00`));
  return start === end ? startText : `${startText} – ${endText}`;
}
