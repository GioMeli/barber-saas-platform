import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPinned } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DiscoveryBusiness, DiscoveryCoordinates } from '@/discovery/types';
import { useTranslation } from 'react-i18next';

interface DiscoveryMapProps {
  businesses: DiscoveryBusiness[];
  selectedBusinessId: string | null;
  userLocation: DiscoveryCoordinates | null;
  onSelect: (business: DiscoveryBusiness) => void;
}

export function DiscoveryMap({ businesses, selectedBusinessId, userLocation, onSelect }: DiscoveryMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mappableBusinesses = useMemo(
    () => businesses.filter(
      (business): business is DiscoveryBusiness & { latitude: number; longitude: number } =>
        typeof business.latitude === 'number' &&
        Number.isFinite(business.latitude) &&
        typeof business.longitude === 'number' &&
        Number.isFinite(business.longitude),
    ),
    [businesses],
  );

  const validUserLocation = useMemo(() => {
    if (!userLocation) return null;
    if (!Number.isFinite(userLocation.latitude) || !Number.isFinite(userLocation.longitude)) return null;
    return userLocation;
  }, [userLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let styleLoaded = false;
    const configuredStyle = String(import.meta.env.VITE_PUBLIC_MAP_STYLE_URL || '').trim();
    const styleUrl = configuredStyle.startsWith('https://')
      ? configuredStyle
      : 'https://tiles.openfreemap.org/styles/liberty';

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [33.3823, 35.1856],
        zoom: 8,
        attributionControl: true,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;

      const resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);

      const handleLoad = () => {
        styleLoaded = true;
        window.requestAnimationFrame(() => map.resize());
        if (!cancelled) {
          setLoadError(false);
          setMapReady(true);
        }
      };

      const handleError = (event: { error?: unknown }) => {
        console.error('Discovery map rendering error:', event.error ?? event);
        if (!styleLoaded && !cancelled) {
          setLoadError(true);
          setMapReady(false);
        }
      };

      map.on('load', handleLoad);
      map.on('error', handleError);

      const startupTimeout = window.setTimeout(() => {
        if (!styleLoaded && !cancelled) {
          console.error('Discovery map style did not finish loading within 12 seconds.');
          setLoadError(true);
          setMapReady(false);
        }
      }, 12_000);

      return () => {
        cancelled = true;
        window.clearTimeout(startupTimeout);
        resizeObserver.disconnect();
        map.off('load', handleLoad);
        map.off('error', handleError);
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        map.remove();
        mapRef.current = null;
        setMapReady(false);
      };
    } catch (error) {
      console.error('Discovery map failed to initialise:', error);
      setLoadError(true);
      setMapReady(false);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    for (const business of mappableBusinesses) {
      const markerElement = document.createElement('button');
      markerElement.type = 'button';
      markerElement.setAttribute('aria-label', business.name);
      markerElement.className = 'velliqo-discovery-marker';

      const markerBadge = document.createElement('span');
      if (business.logo_url) {
        const markerLogo = document.createElement('img');
        markerLogo.src = business.logo_url;
        markerLogo.alt = '';
        markerLogo.loading = 'lazy';
        markerLogo.referrerPolicy = 'no-referrer';
        markerBadge.appendChild(markerLogo);
      } else {
        markerBadge.textContent = 'V';
      }
      markerElement.appendChild(markerBadge);

      markerElement.addEventListener('click', () => {
        // The page owns the details drawer. Selection is keyed by the stable business id.
        onSelect(business);
      });

      const marker = new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([business.longitude, business.latitude])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([business.longitude, business.latitude]);
    }

    if (validUserLocation) {
      const userElement = document.createElement('div');
      userElement.className = 'velliqo-user-location-marker';
      userElement.title = t('discovery.map.yourLocation');
      const userMarker = new maplibregl.Marker({ element: userElement })
        .setLngLat([validUserLocation.longitude, validUserLocation.latitude])
        .addTo(map);
      markersRef.current.push(userMarker);
      bounds.extend([validUserLocation.longitude, validUserLocation.latitude]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 700 });
    } else {
      map.resize();
    }
  }, [mapReady, mappableBusinesses, onSelect, t, validUserLocation]);

  useEffect(() => {
    // Resolve the selected pin by stable business id, never by list index/order.
    const business = mappableBusinesses.find((item) => item.id === selectedBusinessId);
    const map = mapRef.current;
    if (!mapReady || !business || business.latitude == null || business.longitude == null || !map) return;

    map.flyTo({ center: [business.longitude, business.latitude], zoom: Math.max(map.getZoom(), 13), duration: 650 });
  }, [mapReady, mappableBusinesses, selectedBusinessId, t]);

  if (loadError) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-[1.75rem] bg-slate-100 p-8 text-center">
        <div>
          <MapPinned className="mx-auto h-9 w-9 text-slate-400" />
          <div className="mt-3 font-extrabold text-slate-900">{t('discovery.map.unavailable')}</div>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{t('discovery.map.unavailableDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[300px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-100 shadow-[0_24px_80px_rgba(15,23,42,.12)]">
      <div ref={containerRef} className="absolute inset-0" />
      {!mapReady && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      )}
      {validUserLocation && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-2 text-xs font-extrabold text-blue-700 shadow-lg backdrop-blur">
          <LocateFixed className="h-3.5 w-3.5" />
          {t('discovery.map.yourLocation')}
        </div>
      )}
      {mappableBusinesses.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/80 p-6 text-center backdrop-blur-sm">
          <div>
            <MapPinned className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 max-w-sm text-sm font-semibold text-slate-600">{t('discovery.map.noPins')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
