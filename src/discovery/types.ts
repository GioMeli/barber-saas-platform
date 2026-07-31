export type DiscoveryFacetKind = 'service' | 'category' | 'industry';

export interface DiscoveryFacetOption {
  value: string;
  label: string;
  kind?: DiscoveryFacetKind;
}

export interface DiscoveryFacets {
  locations: DiscoveryFacetOption[];
  services: DiscoveryFacetOption[];
}

export interface DiscoveryBusinessSuggestion {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  district: string | null;
  industry_key: string;
  average_rating: number;
  review_count: number;
}

export interface DiscoveryBusiness {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  currency: string | null;
  industry_key: string;
  latitude: number | null;
  longitude: number | null;
  average_rating: number;
  review_count: number;
  popularity_score: number;
  distance_meters: number | null;
  service_names: string[];
  price_from: number | null;
}

export interface DiscoveryCoordinates {
  latitude: number;
  longitude: number;
}

export interface DiscoveryFilters {
  business: string;
  location: string;
  service: string;
  coordinates: DiscoveryCoordinates | null;
  selectedBusinessSlug?: string | null;
}

export type DiscoverySort = 'recommended' | 'nearest' | 'rating' | 'popular';
