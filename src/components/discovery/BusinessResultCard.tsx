import { ArrowRight, BadgeEuro, MapPin, Navigation, Star, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DiscoveryBusiness } from '@/discovery/types';
import { getIndustryConfig } from '@/config/industries';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface BusinessResultCardProps {
  business: DiscoveryBusiness;
  selected: boolean;
  onSelect: () => void;
}

function formatDistance(meters: number | null, locale: string): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export function BusinessResultCard({ business, selected, onSelect }: BusinessResultCardProps) {
  const { t, i18n } = useTranslation();
  const industry = getIndustryConfig(business.industry_key);
  const distance = formatDistance(business.distance_meters, i18n.language);
  const location = [business.city, business.district].filter(Boolean).join(', ') || business.address || business.country || t('discovery.results.online');
  const currency = business.currency || 'EUR';
  const fromPrice = business.price_from == null
    ? null
    : new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 2 }).format(business.price_from);

  return (
    <article
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={cn(
        'group overflow-hidden rounded-[1.6rem] border bg-white transition duration-300',
        selected
          ? 'border-violet-300 shadow-[0_22px_65px_rgba(91,33,182,.16)] ring-2 ring-violet-100'
          : 'border-slate-200 shadow-[0_14px_45px_rgba(15,23,42,.06)] hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_20px_60px_rgba(76,29,149,.11)]',
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 sm:h-36">
          {business.cover_image_url ? <img src={business.cover_image_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,.24),transparent_36%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,.18),transparent_32%)]" />}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/55 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.13em] text-violet-700 shadow-sm backdrop-blur">{industry.name}</div>
          {distance && <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[10px] font-extrabold text-slate-700 shadow-sm backdrop-blur"><Navigation className="h-3 w-3 text-blue-600" />{distance}</div>}
          <div className="absolute bottom-3 left-4 flex min-w-0 items-end gap-3">
            {business.logo_url ? <img src={business.logo_url} alt="" className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow-lg" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white bg-violet-600 text-white shadow-lg"><Store className="h-5 w-5" /></span>}
            <div className="min-w-0 pb-0.5 text-white"><h2 className="truncate text-lg font-extrabold tracking-tight">{business.name}</h2><div className="mt-0.5 flex items-center gap-1 text-xs text-white/80"><MapPin className="h-3 w-3" /><span className="truncate">{location}</span></div></div>
          </div>
        </div>
      </button>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {business.review_count > 0 ? <div className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{business.average_rating.toFixed(1)}<span className="text-xs font-semibold text-slate-400">({business.review_count})</span></div> : <div className="text-xs font-semibold text-slate-400">{t('discovery.results.newListing')}</div>}
            {fromPrice && <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600"><BadgeEuro className="h-3.5 w-3.5 text-emerald-600" />{t('discovery.results.fromPrice', { price: fromPrice })}</div>}
          </div>
        </div>

        {business.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{business.description}</p>}

        {business.service_names.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{business.service_names.slice(0, 4).map((service) => <span key={service} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">{service}</span>)}</div>}

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <button type="button" onClick={onSelect} className="text-xs font-extrabold text-violet-700 hover:text-violet-900">{t('discovery.results.showOnMap')}</button>
          <Link to={`/app/${business.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-violet-700">{t('discovery.results.viewBusiness')}<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
    </article>
  );
}
