import type { DiscoveryFilters } from './types';

export function buildDiscoveryUrl(filters: DiscoveryFilters): string {
  const params = new URLSearchParams();
  if (filters.business.trim()) params.set('business', filters.business.trim());
  if (filters.location.trim()) params.set('location', filters.location.trim());
  if (filters.service.trim()) params.set('service', filters.service.trim());
  if (filters.coordinates) {
    params.set('lat', String(filters.coordinates.latitude));
    params.set('lng', String(filters.coordinates.longitude));
    params.set('near', '1');
  }
  const query = params.toString();
  return query ? `/discover?${query}` : '/discover';
}

export function readDiscoveryFilters(params: URLSearchParams): DiscoveryFilters {
  const latitudeParam = params.get('lat');
  const longitudeParam = params.get('lng');
  const latitude = latitudeParam == null ? Number.NaN : Number(latitudeParam);
  const longitude = longitudeParam == null ? Number.NaN : Number(longitudeParam);
  const hasCoordinates =
    latitudeParam != null
    && longitudeParam != null
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;

  return {
    business: params.get('business') ?? '',
    location: params.get('location') ?? '',
    service: params.get('service') ?? '',
    coordinates: hasCoordinates ? { latitude, longitude } : null,
    selectedBusinessSlug: null,
  };
}
