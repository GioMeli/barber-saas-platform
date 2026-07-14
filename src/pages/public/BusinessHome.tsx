import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  CalendarDays,
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
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/hooks/useAuth';

type StoreContext = {
  business: any;
  openCustomerSignIn: () => void;
  openCustomerSignUp: () => void;
};

export default function BusinessHome() {
  const { business, openCustomerSignIn, openCustomerSignUp } =
    useOutletContext<StoreContext>();
  const { user } = useAuth();

  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) void fetchStorefrontData();
  }, [business?.id, user?.id]);

  const fetchStorefrontData = async () => {
    if (!business?.id) return;

    setLoading(true);

    const [
      servicesResult,
      staffResult,
      productsResult,
      postsResult,
      galleryResult,
    ] = await Promise.allSettled([
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
        .limit(6),

      supabase
        .from('business_gallery_images')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_public', true)
        .order('display_order')
        .limit(12),
    ]);

    if (servicesResult.status === 'fulfilled') {
      if (servicesResult.value.error) {
        console.error('Services query error:', servicesResult.value.error);
        setServices([]);
      } else {
        setServices(servicesResult.value.data ?? []);
      }
    } else {
      console.error('Services request failed:', servicesResult.reason);
      setServices([]);
    }

    if (staffResult.status === 'fulfilled') {
      if (staffResult.value.error) {
        console.error('Staff query error:', staffResult.value.error);
        setStaff([]);
      } else {
        setStaff(staffResult.value.data ?? []);
      }
    } else {
      console.error('Staff request failed:', staffResult.reason);
      setStaff([]);
    }

    if (productsResult.status === 'fulfilled') {
      if (productsResult.value.error) {
        console.error('Products query error:', productsResult.value.error);
        setProducts([]);
      } else {
        setProducts(productsResult.value.data ?? []);
      }
    } else {
      console.error('Products request failed:', productsResult.reason);
      setProducts([]);
    }

    if (postsResult.status === 'fulfilled') {
      if (postsResult.value.error) {
        console.error('Posts query error:', postsResult.value.error);
        setPosts([]);
      } else {
        setPosts(postsResult.value.data ?? []);
      }
    } else {
      console.error('Posts request failed:', postsResult.reason);
      setPosts([]);
    }

    if (galleryResult.status === 'fulfilled') {
      if (galleryResult.value.error) {
        console.error('Gallery query error:', galleryResult.value.error);
        setGallery([]);
      } else {
        setGallery(galleryResult.value.data ?? []);
      }
    } else {
      console.error('Gallery request failed:', galleryResult.reason);
      setGallery([]);
    }

    setLoading(false);
  };

  const directionsUrl = useMemo(() => {
    if (business.latitude && business.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`;
    }

    const address = [
      business.address_line_1,
      business.address_line_2,
      business.city,
      business.district,
      business.postal_code,
      business.country,
      business.address,
    ]
      .filter(Boolean)
      .join(', ');

    return address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      : null;
  }, [business]);

  const mapEmbedUrl =
    business.latitude && business.longitude
      ? `https://www.google.com/maps?q=${business.latitude},${business.longitude}&z=15&output=embed`
      : business.map_url || null;

  const coverImage =
    business.cover_image_url ||
    business.photos?.[0] ||
    gallery?.[0]?.image_url ||
    null;

  return (
    <div className="pb-24 md:pb-12">
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {coverImage && (
          <img
            src={coverImage}
            alt={business.name}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <div className="max-w-2xl">
            <Badge className="mb-5 bg-white/15 text-white hover:bg-white/20">
              Online booking available
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              {business.name}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
              {business.description ||
                'Discover our services, meet the team and book your next appointment online.'}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to={`/app/${business.slug}/book`}>
                  <CalendarDays className="mr-2 h-5 w-5" />
                  Book Appointment
                </Link>
              </Button>

              {directionsUrl && (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="bg-white/15 text-white hover:bg-white/25"
                >
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="mr-2 h-5 w-5" />
                    Get Directions
                  </a>
                </Button>
              )}
            </div>

            {!user && (
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/75">
                <span>Booking does not require an account.</span>
                <button
                  type="button"
                  className="font-medium text-white underline underline-offset-4"
                  onClick={openCustomerSignUp}
                >
                  Create one for history and updates
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        <section>
          <SectionHeading
            icon={<Scissors className="h-5 w-5" />}
            title="Services"
            description="Choose the services that fit your needs."
          />

          {loading ? (
            <LoadingGrid />
          ) : services.length === 0 ? (
            <EmptyState text="No public services are available yet." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <Card key={service.id} className="overflow-hidden">
                  {service.image_url && (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="h-44 w-full object-cover"
                    />
                  )}
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{service.name}</h3>
                      <span className="font-bold">
                        €{Number(service.price).toFixed(2)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {service.description || 'Professional salon service.'}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {service.duration} min
                      </span>
                      <Button asChild variant="link" className="h-auto p-0">
                        <Link to={`/app/${business.slug}/book`}>
                          Book <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeading
            icon={<UserRound className="h-5 w-5" />}
            title="Meet the Team"
            description="Choose the professional you prefer."
          />

          {staff.length === 0 ? (
            <EmptyState text="Team profiles will appear here soon." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {staff.map((member) => (
                <Card key={member.id} className="overflow-hidden">
                  {member.photo_url ? (
                    <img
                      src={member.photo_url}
                      alt={member.name}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-muted">
                      <UserRound className="h-14 w-14 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <h3 className="font-semibold">{member.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {member.bio || 'Professional team member.'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeading
            icon={<Package className="h-5 w-5" />}
            title="Products"
            description="Products available from this store."
          />

          {products.length === 0 ? (
            <EmptyState text="No public products have been added yet." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-muted">
                      <Package className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{product.name}</h3>
                      <span className="font-bold">
                        €{Number(product.price).toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {product.description || 'Available in store.'}
                    </p>
                    <Badge variant="secondary" className="mt-4">
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

        <section>
          <SectionHeading
            icon={<Megaphone className="h-5 w-5" />}
            title="Latest Updates"
            description="Announcements, holidays, offers and store news."
          />

          {posts.length === 0 ? (
            <EmptyState text="There are no published updates yet." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="h-44 w-full object-cover"
                    />
                  )}
                  <CardContent className="p-5">
                    <Badge variant="outline" className="mb-3 capitalize">
                      {String(post.post_type).replace(/_/g, ' ')}
                    </Badge>
                    <h3 className="text-lg font-semibold">{post.title}</h3>
                    <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">
                      {post.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeading
            icon={<ImageIcon className="h-5 w-5" />}
            title="Gallery"
            description="A look inside the store and recent work."
          />

          {gallery.length === 0 ? (
            <EmptyState text="The store gallery is currently empty." />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {gallery.map((image) => (
                <figure
                  key={image.id}
                  className="group overflow-hidden rounded-xl bg-muted"
                >
                  <img
                    src={image.image_url}
                    alt={image.alt_text || image.title || business.name}
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {(image.title || image.caption) && (
                    <figcaption className="p-3">
                      {image.title && (
                        <div className="text-sm font-medium">{image.title}</div>
                      )}
                      {image.caption && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {image.caption}
                        </div>
                      )}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <Card>
            <CardContent className="space-y-5 p-6">
              <SectionHeading
                icon={<MapPin className="h-5 w-5" />}
                title="Visit Us"
                description="Contact details and directions."
                compact
              />

              {business.address && (
                <ContactRow
                  icon={<MapPin className="h-5 w-5" />}
                  value={business.address}
                />
              )}
              {business.phone && (
                <ContactRow
                  icon={<Phone className="h-5 w-5" />}
                  value={
                    <a href={`tel:${business.phone}`} className="hover:underline">
                      {business.phone}
                    </a>
                  }
                />
              )}
              {business.email && (
                <ContactRow
                  icon={<Mail className="h-5 w-5" />}
                  value={
                    <a href={`mailto:${business.email}`} className="hover:underline">
                      {business.email}
                    </a>
                  }
                />
              )}

              {directionsUrl && (
                <Button asChild className="w-full">
                  <a href={directionsUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Directions
                  </a>
                </Button>
              )}

              {!user && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="font-medium">Already a customer?</div>
                  <p className="mt-1 text-muted-foreground">
                    Sign in to see your appointments and store updates.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={openCustomerSignIn}
                  >
                    Sign In
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {mapEmbedUrl ? (
            <div className="min-h-[360px] overflow-hidden rounded-xl border bg-muted">
              <iframe
                title={`${business.name} location`}
                src={mapEmbedUrl}
                className="h-full min-h-[360px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
              Map location has not been configured yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'mb-4' : 'mb-6'}>
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className={compact ? 'text-xl font-bold' : 'text-2xl font-bold'}>
          {title}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-64 animate-pulse rounded-xl bg-muted" />
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
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
