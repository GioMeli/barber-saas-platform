import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BadgeEuro, Compass, Loader2, MapPin, MapPinned, Navigation, SearchX, SlidersHorizontal, Sparkles, Star, Store } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DiscoverySearchBar } from '@/components/discovery/DiscoverySearchBar';
import { DiscoveryMap } from '@/components/discovery/DiscoveryMap';
import { BusinessResultCard } from '@/components/discovery/BusinessResultCard';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getIndustryConfig } from '@/config/industries';
import { searchPublicBusinesses } from '@/discovery/api';
import type { DiscoveryBusiness, DiscoveryFilters, DiscoverySort } from '@/discovery/types';
import { buildDiscoveryUrl, readDiscoveryFilters } from '@/discovery/url';
import { useTranslation } from 'react-i18next';

export default function DiscoverBusinesses() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => readDiscoveryFilters(searchParams), [searchParams]);
  const [businesses, setBusinesses] = useState<DiscoveryBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [sort, setSort] = useState<DiscoverySort>('recommended');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    searchPublicBusinesses(filters)
      .then((data) => {
        if (cancelled) return;
        setBusinesses(data);
        setSelectedBusinessId(data[0]?.id ?? null);
      })
      .catch((loadError) => {
        console.error('Public discovery search failed:', loadError);
        if (!cancelled) {
          setBusinesses([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.business, filters.location, filters.service, filters.coordinates?.latitude, filters.coordinates?.longitude]);

  const sortedBusinesses = useMemo(() => {
    const next = [...businesses];
    if (sort === 'nearest') return next.sort((a, b) => (a.distance_meters ?? Number.POSITIVE_INFINITY) - (b.distance_meters ?? Number.POSITIVE_INFINITY));
    if (sort === 'rating') return next.sort((a, b) => b.average_rating - a.average_rating || b.review_count - a.review_count);
    if (sort === 'popular') return next.sort((a, b) => b.popularity_score - a.popularity_score || b.average_rating - a.average_rating);
    return next;
  }, [businesses, sort]);

  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) ?? null;
  const handleMapSelect = useCallback((business: DiscoveryBusiness) => {
    setSelectedBusinessId(business.id);
    setDetailsOpen(true);
  }, []);
  const handleCardSelect = useCallback((business: DiscoveryBusiness) => {
    setSelectedBusinessId(business.id);
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);
  const handleSearch = (nextFilters: DiscoveryFilters) => navigate(buildDiscoveryUrl(nextFilters));
  const hasSpecificSearch = Boolean(filters.business.trim() || filters.location.trim() || filters.coordinates);

  return (
    <div className="min-h-screen bg-[#f6f5fb] text-slate-950">
      <MarketingHeader active="discover" />
      <main>
        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_15%_10%,rgba(124,58,237,.14),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f5ff_100%)]">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="max-w-3xl"><div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-violet-700"><Sparkles className="h-4 w-4" />{t('discovery.page.eyebrow')}</div><h1 className="mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl lg:text-5xl">{t('discovery.page.title')}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{t('discovery.page.description')}</p></div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-extrabold text-violet-700 shadow-sm"><Compass className="h-4 w-4" />{hasSpecificSearch ? t('discovery.page.personalised') : t('discovery.page.popularFirst')}</div>
            </div>
            <DiscoverySearchBar initialFilters={filters} variant="page" onSearch={handleSearch} className="mt-7" />
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-xl font-extrabold tracking-tight">{loading ? t('discovery.results.searching') : t('discovery.results.count', { count: businesses.length })}</div><div className="mt-1 text-xs text-slate-500">{filters.service ? t('discovery.results.serviceContext', { service: filters.service }) : t('discovery.results.defaultContext')}</div></div>
            <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-400" /><Select value={sort} onValueChange={(value) => setSort(value as DiscoverySort)}><SelectTrigger className="w-[175px] rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recommended">{t('discovery.sort.recommended')}</SelectItem><SelectItem value="nearest" disabled={!filters.coordinates}>{t('discovery.sort.nearest')}</SelectItem><SelectItem value="rating">{t('discovery.sort.rating')}</SelectItem><SelectItem value="popular">{t('discovery.sort.popular')}</SelectItem></SelectContent></Select></div>
          </div>

          {loading ? (
            <div className="flex min-h-[520px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" /><p className="mt-3 text-sm font-semibold text-slate-500">{t('discovery.results.loading')}</p></div></div>
          ) : error ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-rose-200 bg-white p-8 text-center"><div><SearchX className="mx-auto h-9 w-9 text-rose-400" /><h2 className="mt-4 text-xl font-extrabold">{t('discovery.results.errorTitle')}</h2><p className="mt-2 max-w-lg text-sm text-slate-500">{t('discovery.results.errorDescription')}</p></div></div>
          ) : businesses.length === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-8 text-center"><div><MapPinned className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-4 text-xl font-extrabold">{t('discovery.results.emptyTitle')}</h2><p className="mt-2 max-w-lg text-sm text-slate-500">{t('discovery.results.emptyDescription')}</p></div></div>
          ) : (
            <div className="space-y-6 lg:space-y-8">
              <div ref={mapSectionRef} className="min-w-0">
                <div className="h-[300px] sm:h-[320px] lg:h-[320px] xl:h-[340px]">
                  <DiscoveryMap
                    businesses={sortedBusinesses}
                    selectedBusinessId={selectedBusiness?.id ?? null}
                    userLocation={filters.coordinates}
                    onSelect={handleMapSelect}
                  />
                </div>
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {sortedBusinesses.map((business) => (
                  <BusinessResultCard
                    key={business.id}
                    business={business}
                    compact
                    selected={business.id === selectedBusiness?.id}
                    onSelect={() => handleCardSelect(business)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent
          side="right"
          className="w-[94vw] max-w-[520px] border-l border-slate-200 bg-white p-0 sm:max-w-[520px] [&>button]:z-30 [&>button]:bg-white/90"
        >
          {selectedBusiness && (
            <DiscoveryBusinessDetails business={selectedBusiness} />
          )}
        </SheetContent>
      </Sheet>

      <MarketingFooter />
    </div>
  );
}


function DiscoveryBusinessDetails({ business }: { business: DiscoveryBusiness }) {
  const { t, i18n } = useTranslation();
  const industry = getIndustryConfig(business.industry_key);
  const location = [business.address, business.city, business.district, business.country].filter(Boolean).join(', ');
  const distance = business.distance_meters == null
    ? null
    : business.distance_meters < 1000
      ? `${Math.max(50, Math.round(business.distance_meters / 50) * 50)} m`
      : `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(business.distance_meters / 1000)} km`;
  const fromPrice = business.price_from == null
    ? null
    : new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: business.currency || 'EUR',
        maximumFractionDigits: 2,
      }).format(business.price_from);

  return (
    <div className="min-h-full bg-[#f8f7fc]">
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-violet-950 via-slate-950 to-fuchsia-950 sm:h-56">
        {business.cover_image_url ? (
          <img src={business.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(139,92,246,.45),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(217,70,239,.3),transparent_30%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent" />
        <div className="absolute inset-x-5 bottom-5 flex items-end gap-3 pr-12 sm:inset-x-6 sm:bottom-6">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" className="h-16 w-16 rounded-2xl border-2 border-white bg-white object-cover shadow-xl" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white bg-violet-600 text-white shadow-xl"><Store className="h-6 w-6" /></div>
          )}
          <div className="min-w-0 pb-1 text-white">
            <div className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-200">{industry.name}</div>
            <SheetTitle className="mt-1 truncate text-2xl font-extrabold tracking-tight text-white">{business.name}</SheetTitle>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <SheetHeader className="sr-only">
          <SheetTitle>{business.name}</SheetTitle>
          <SheetDescription>{t('discovery.details.panelDescription')}</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">{t('discovery.details.rating')}</div>
            {business.review_count > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-lg font-extrabold text-slate-950"><Star className="h-5 w-5 fill-amber-400 text-amber-400" />{business.average_rating.toFixed(1)}<span className="text-xs font-semibold text-slate-400">({business.review_count})</span></div>
            ) : (
              <div className="mt-2 text-sm font-bold text-slate-500">{t('discovery.results.newListing')}</div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">{t('discovery.details.startingPrice')}</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-extrabold text-slate-950"><BadgeEuro className="h-5 w-5 text-emerald-600" />{fromPrice || '—'}</div>
          </div>
        </div>

        {business.description && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-950">{t('discovery.details.about')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{business.description}</p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-950">{t('discovery.details.location')}</h3>
          <div className="mt-3 flex items-start gap-3 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-800">{location || t('discovery.results.online')}</div>
              {distance && <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700"><Navigation className="h-3.5 w-3.5" />{t('discovery.details.distanceAway', { distance })}</div>}
            </div>
          </div>
        </section>

        {business.service_names.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-950">{t('discovery.details.services')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {business.service_names.map((service) => (
                <span key={service} className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">{service}</span>
              ))}
            </div>
          </section>
        )}

        <Link
          to={`/app/${business.slug}`}
          className="sticky bottom-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-extrabold text-white shadow-[0_18px_45px_rgba(15,23,42,.24)] transition hover:bg-violet-700"
        >
          {t('discovery.map.viewBusiness')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
