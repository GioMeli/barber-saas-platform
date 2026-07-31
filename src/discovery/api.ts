import { supabase } from '@/db/supabase';
import type {
  DiscoveryBusiness,
  DiscoveryBusinessSuggestion,
  DiscoveryFacets,
  DiscoveryFilters,
} from './types';

const EMPTY_FACETS: DiscoveryFacets = { locations: [], services: [] };

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBusiness(row: Record<string, unknown>): DiscoveryBusiness {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
    cover_image_url: typeof row.cover_image_url === 'string' ? row.cover_image_url : null,
    description: typeof row.description === 'string' ? row.description : null,
    address: typeof row.address === 'string' ? row.address : null,
    city: typeof row.city === 'string' ? row.city : null,
    district: typeof row.district === 'string' ? row.district : null,
    country: typeof row.country === 'string' ? row.country : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    industry_key: typeof row.industry_key === 'string' ? row.industry_key : 'appointment_service_business',
    latitude: row.latitude == null ? null : toNumber(row.latitude),
    longitude: row.longitude == null ? null : toNumber(row.longitude),
    average_rating: toNumber(row.average_rating),
    review_count: Math.max(0, Math.round(toNumber(row.review_count))),
    popularity_score: Math.max(0, Math.round(toNumber(row.popularity_score))),
    distance_meters: row.distance_meters == null ? null : toNumber(row.distance_meters),
    service_names: Array.isArray(row.service_names)
      ? row.service_names.filter((value): value is string => typeof value === 'string')
      : [],
    price_from: row.price_from == null ? null : toNumber(row.price_from),
  };
}

export async function fetchDiscoveryFacets(): Promise<DiscoveryFacets> {
  const { data, error } = await supabase.rpc('get_public_discovery_facets');
  if (error) throw error;
  if (!data || typeof data !== 'object') return EMPTY_FACETS;

  const value = data as Record<string, unknown>;
  return {
    locations: Array.isArray(value.locations)
      ? value.locations.filter((item): item is DiscoveryFacets['locations'][number] => Boolean(item && typeof item === 'object' && 'value' in item))
      : [],
    services: Array.isArray(value.services)
      ? value.services.filter((item): item is DiscoveryFacets['services'][number] => Boolean(item && typeof item === 'object' && 'value' in item))
      : [],
  };
}

export async function fetchBusinessSuggestions(query: string): Promise<DiscoveryBusinessSuggestion[]> {
  const { data, error } = await supabase.rpc('search_public_business_suggestions', {
    p_query: query.trim() || null,
    p_limit: 8,
  });
  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
    city: typeof row.city === 'string' ? row.city : null,
    district: typeof row.district === 'string' ? row.district : null,
    industry_key: typeof row.industry_key === 'string' ? row.industry_key : 'appointment_service_business',
    average_rating: toNumber(row.average_rating),
    review_count: Math.max(0, Math.round(toNumber(row.review_count))),
  }));
}

export async function searchPublicBusinesses(filters: DiscoveryFilters): Promise<DiscoveryBusiness[]> {
  const { data, error } = await supabase.rpc('search_public_businesses', {
    p_business_query: filters.business.trim() || null,
    p_location_query: filters.location.trim() || null,
    p_service_query: filters.service.trim() || null,
    p_latitude: filters.coordinates?.latitude ?? null,
    p_longitude: filters.coordinates?.longitude ?? null,
    p_limit: 120,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => normalizeBusiness(row));
}
