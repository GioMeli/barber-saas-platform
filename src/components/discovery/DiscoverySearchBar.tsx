import React, { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, ChevronDown, LocateFixed, MapPin, Search, Star, Store, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchBusinessSuggestions, fetchDiscoveryFacets } from '@/discovery/api';
import type { DiscoveryBusinessSuggestion, DiscoveryFacets, DiscoveryFilters } from '@/discovery/types';
import { buildDiscoveryUrl } from '@/discovery/url';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface DiscoverySearchBarProps {
  initialFilters?: DiscoveryFilters;
  variant?: 'hero' | 'page';
  onSearch?: (filters: DiscoveryFilters) => void;
  className?: string;
}

const EMPTY_FILTERS: DiscoveryFilters = {
  business: '',
  location: '',
  service: '',
  coordinates: null,
  selectedBusinessSlug: null,
};

export function DiscoverySearchBar({
  initialFilters = EMPTY_FILTERS,
  variant = 'hero',
  onSearch,
  className,
}: DiscoverySearchBarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [filters, setFilters] = useState<DiscoveryFilters>(initialFilters);
  const [facets, setFacets] = useState<DiscoveryFacets>({ locations: [], services: [] });
  const [businessSuggestions, setBusinessSuggestions] = useState<DiscoveryBusinessSuggestion[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters.business, initialFilters.location, initialFilters.service, initialFilters.coordinates?.latitude, initialFilters.coordinates?.longitude]);

  useEffect(() => {
    let cancelled = false;
    fetchDiscoveryFacets()
      .then((data) => {
        if (!cancelled) setFacets(data);
      })
      .catch((error) => console.warn('Discovery facets unavailable:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = filters.business.trim();
    if (query.length < 2) {
      setBusinessSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchBusinessSuggestions(query)
        .then((data) => {
          if (!cancelled) setBusinessSuggestions(data);
        })
        .catch((error) => console.warn('Business suggestions unavailable:', error));
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters.business]);

  const visibleLocations = useMemo(() => facets.locations.slice(0, 120), [facets.locations]);
  const visibleServices = useMemo(() => facets.services.slice(0, 180), [facets.services]);

  const update = <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t('discovery.search.locationUnsupported'));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFilters((current) => ({
          ...current,
          location: t('discovery.search.currentLocation'),
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }));
        setLocationOpen(false);
        setLocating(false);
      },
      () => {
        toast.error(t('discovery.search.locationDenied'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (filters.selectedBusinessSlug) {
      navigate(`/app/${filters.selectedBusinessSlug}`);
      return;
    }
    if (onSearch) {
      onSearch(filters);
    } else {
      navigate(buildDiscoveryUrl(filters));
    }
  };

  const compact = variant === 'page';

  return (
    <form
      onSubmit={submit}
      className={cn(
        'relative z-20 rounded-[1.6rem] border border-white/15 bg-white p-2 shadow-[0_26px_80px_rgba(4,3,16,.34)]',
        compact ? 'border-slate-200 shadow-[0_18px_55px_rgba(15,23,42,.1)]' : '',
        className,
      )}
    >
      <div className="grid gap-2 lg:grid-cols-[1fr_1fr_1.15fr_auto]">
        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl px-4 text-left transition hover:bg-slate-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><MapPin className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{t('discovery.search.locationLabel')}</span>
                <span className={cn('block truncate text-sm font-bold', filters.location ? 'text-slate-900' : 'text-slate-400')}>{filters.location || t('discovery.search.locationPlaceholder')}</span>
              </span>
              {filters.location ? <X className="h-4 w-4 text-slate-400" onClick={(event) => { event.stopPropagation(); setFilters((current) => ({ ...current, location: '', coordinates: null })); }} /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,360px)] rounded-2xl p-0 shadow-2xl">
            <Command>
              <CommandInput placeholder={t('discovery.search.locationSearchPlaceholder')} />
              <CommandList>
                <CommandItem value="current-location" onSelect={useCurrentLocation} className="m-1 rounded-xl py-3">
                  <LocateFixed className="h-4 w-4 text-violet-600" />
                  <div><div className="font-bold">{locating ? t('discovery.search.locating') : t('discovery.search.useCurrentLocation')}</div><div className="text-xs text-muted-foreground">{t('discovery.search.useCurrentLocationHint')}</div></div>
                </CommandItem>
                <CommandEmpty>{t('discovery.search.noLocations')}</CommandEmpty>
                {visibleLocations.map((option) => (
                  <CommandItem key={option.value} value={option.value} onSelect={() => { setFilters((current) => ({ ...current, location: option.value, coordinates: null })); setLocationOpen(false); }} className="m-1 rounded-xl py-2.5">
                    <MapPin className="h-4 w-4 text-slate-400" />{option.label}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover open={serviceOpen} onOpenChange={setServiceOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl px-4 text-left transition hover:bg-slate-50 lg:border-l lg:border-slate-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><BriefcaseBusiness className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{t('discovery.search.serviceLabel')}</span>
                <span className={cn('block truncate text-sm font-bold', filters.service ? 'text-slate-900' : 'text-slate-400')}>{filters.service || t('discovery.search.servicePlaceholder')}</span>
              </span>
              {filters.service ? <X className="h-4 w-4 text-slate-400" onClick={(event) => { event.stopPropagation(); update('service', ''); }} /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,380px)] rounded-2xl p-0 shadow-2xl">
            <Command>
              <CommandInput placeholder={t('discovery.search.serviceSearchPlaceholder')} />
              <CommandList>
                <CommandEmpty>{t('discovery.search.noServices')}</CommandEmpty>
                {visibleServices.map((option) => (
                  <CommandItem key={`${option.kind ?? 'service'}-${option.value}`} value={option.value} onSelect={() => { update('service', option.value); setServiceOpen(false); }} className="m-1 rounded-xl py-2.5">
                    <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                    <span className="flex-1">{option.label}</span>
                    {option.kind && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t(`discovery.search.kind.${option.kind}`)}</span>}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover open={businessOpen} onOpenChange={setBusinessOpen}>
          <PopoverTrigger asChild>
            <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl px-4 transition hover:bg-slate-50 lg:border-l lg:border-slate-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Store className="h-4 w-4" /></span>
              <label className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{t('discovery.search.businessLabel')}</span>
                <input
                  value={filters.business}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, business: event.target.value, selectedBusinessSlug: null }));
                    setBusinessOpen(true);
                  }}
                  onFocus={() => setBusinessOpen(true)}
                  placeholder={t('discovery.search.businessPlaceholder')}
                  className="block w-full bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              {filters.business && <button type="button" aria-label={t('discovery.search.clearBusiness')} onClick={() => setFilters((current) => ({ ...current, business: '', selectedBusinessSlug: null }))}><X className="h-4 w-4 text-slate-400" /></button>}
            </div>
          </PopoverTrigger>
          <PopoverContent align="start" onOpenAutoFocus={(event) => event.preventDefault()} className="w-[min(92vw,410px)] rounded-2xl p-2 shadow-2xl">
            {filters.business.trim().length < 2 ? (
              <div className="px-3 py-5 text-sm text-slate-500">{t('discovery.search.businessTypeHint')}</div>
            ) : businessSuggestions.length === 0 ? (
              <div className="px-3 py-5 text-sm text-slate-500">{t('discovery.search.noBusinesses')}</div>
            ) : (
              <div className="grid gap-1">
                {businessSuggestions.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => {
                      setFilters((current) => ({ ...current, business: business.name, selectedBusinessSlug: business.slug }));
                      setBusinessOpen(false);
                      navigate(`/app/${business.slug}`);
                    }}
                    className="flex items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50"
                  >
                    {business.logo_url ? <img src={business.logo_url} alt="" className="h-10 w-10 rounded-xl border object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Store className="h-4 w-4" /></span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-slate-900">{business.name}</span><span className="block truncate text-xs text-slate-500">{[business.city, business.district].filter(Boolean).join(', ') || t('discovery.search.onlineBusiness')}</span></span>
                    {business.review_count > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Star className="h-3.5 w-3.5 fill-current" />{business.average_rating.toFixed(1)}</span>}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button type="submit" size="lg" className="h-14 rounded-2xl bg-violet-600 px-6 font-extrabold text-white shadow-[0_14px_35px_rgba(124,58,237,.3)] hover:bg-violet-500">
          <Search className="mr-2 h-4 w-4" />{t('discovery.search.submit')}
        </Button>
      </div>
    </form>
  );
}
