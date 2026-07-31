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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

function popupHtml(business: DiscoveryBusiness, viewLabel: string): string {
  const location = [business.city, business.district].filter(Boolean).join(', ');
  const description = business.description?.trim() || location || '';
  const rating = business.review_count > 0
    ? `<div style="margin-top:8px;font-size:12px;font-weight:800;color:#b45309">★ ${business.average_rating.toFixed(1)} <span style="color:#64748b;font-weight:600">(${business.review_count})</span></div>`
    : '';
  return `<div style="min-width:230px;max-width:290px;font-family:Inter,ui-sans-serif,system-ui,sans-serif">
    <div style="display:flex;align-items:center;gap:10px">
      ${business.logo_url ? `<img src="${escapeHtml(business.logo_url)}" alt="" style="width:42px;height:42px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0" />` : '<div style="width:42px;height:42px;border-radius:12px;background:#ede9fe;color:#6d28d9;display:flex;align-items:center;justify-content:center;font-weight:900">V</div>'}
      <div style="min-width:0"><div style="font-size:15px;font-weight:900;color:#0f172a">${escapeHtml(business.name)}</div>${location ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(location)}</div>` : ''}</div>
    </div>
    ${description ? `<p style="font-size:12px;line-height:1.55;color:#475569;margin:10px 0 0">${escapeHtml(description.slice(0, 160))}${description.length > 160 ? '…' : ''}</p>` : ''}
    ${rating}
    <a href="/app/${encodeURIComponent(business.slug)}" style="display:block;margin-top:12px;padding:10px 12px;border-radius:11px;background:#7c3aed;color:white;text-align:center;text-decoration:none;font-size:12px;font-weight:900">${escapeHtml(viewLabel)}</a>
  </div>`;
}

export function DiscoveryMap({ businesses, selectedBusinessId, userLocation, onSelect }: DiscoveryMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mappableBusinesses = useMemo(
    () => businesses.filter(
      (business): business is DiscoveryBusiness & { latitude: number; longitude: number } =>
        business.latitude != null && business.longitude != null,
    ),
    [businesses],
  );

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
        popupRef.current?.remove();
        popupRef.current = null;
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
    popupRef.current?.remove();
    popupRef.current = null;

    const bounds = new maplibregl.LngLatBounds();
    for (const business of mappableBusinesses) {
      const markerElement = document.createElement('button');
      markerElement.type = 'button';
      markerElement.setAttribute('aria-label', business.name);
      markerElement.className = 'velliqo-discovery-marker';
      markerElement.innerHTML = `<span>${business.logo_url ? `<img src="${escapeHtml(business.logo_url)}" alt="" />` : 'V'}</span>`;
      markerElement.addEventListener('click', () => {
        onSelect(business);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ offset: 28, closeButton: true, maxWidth: '320px' })
          .setLngLat([business.longitude, business.latitude])
          .setHTML(popupHtml(business, t('discovery.map.viewBusiness')))
          .addTo(map);
      });

      const marker = new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([business.longitude, business.latitude])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([business.longitude, business.latitude]);
    }

    if (userLocation) {
      const userElement = document.createElement('div');
      userElement.className = 'velliqo-user-location-marker';
      userElement.title = t('discovery.map.yourLocation');
      const userMarker = new maplibregl.Marker({ element: userElement })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
      markersRef.current.push(userMarker);
      bounds.extend([userLocation.longitude, userLocation.latitude]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 700 });
    } else {
      map.resize();
    }
  }, [mapReady, mappableBusinesses, onSelect, t, userLocation]);

  useEffect(() => {
    const business = businesses.find((item) => item.id === selectedBusinessId);
    const map = mapRef.current;
    if (!mapReady || !business || business.latitude == null || business.longitude == null || !map) return;

    map.flyTo({ center: [business.longitude, business.latitude], zoom: Math.max(map.getZoom(), 13), duration: 650 });
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ offset: 28, closeButton: true, maxWidth: '320px' })
      .setLngLat([business.longitude, business.latitude])
      .setHTML(popupHtml(business, t('discovery.map.viewBusiness')))
      .addTo(map);
  }, [businesses, mapReady, selectedBusinessId, t]);

  if (loadError) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-[1.75rem] bg-slate-100 p-8 text-center">
        <div>
          <MapPinned className="mx-auto h-9 w-9 text-slate-400" />
          <div className="mt-3 font-extrabold text-slate-900">{t('discovery.map.unavailable')}</div>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{t('discovery.map.unavailableDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-100 shadow-[0_24px_80px_rgba(15,23,42,.12)]">
      <div ref={containerRef} className="absolute inset-0" />
      {!mapReady && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      )}
      {userLocation && (
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
