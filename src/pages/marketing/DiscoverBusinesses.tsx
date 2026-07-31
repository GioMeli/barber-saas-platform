import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Compass, Loader2, MapPinned, SearchX, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DiscoverySearchBar } from '@/components/discovery/DiscoverySearchBar';
import { DiscoveryMap } from '@/components/discovery/DiscoveryMap';
import { BusinessResultCard } from '@/components/discovery/BusinessResultCard';
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  const selectedBusiness = sortedBusinesses.find((business) => business.id === selectedBusinessId) ?? null;
  const handleSelect = useCallback((business: DiscoveryBusiness) => setSelectedBusinessId(business.id), []);
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
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
              <div className="order-2 grid min-w-0 gap-4 xl:order-1">
                {sortedBusinesses.map((business) => <BusinessResultCard key={business.id} business={business} selected={business.id === selectedBusiness?.id} onSelect={() => handleSelect(business)} />)}
              </div>
              <div className="order-1 min-w-0 xl:order-2"><div className="xl:sticky xl:top-24 xl:h-[calc(100dvh-7.5rem)]"><DiscoveryMap businesses={sortedBusinesses} selectedBusinessId={selectedBusiness?.id ?? null} userLocation={filters.coordinates} onSelect={handleSelect} /></div></div>
            </div>
          )}
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
