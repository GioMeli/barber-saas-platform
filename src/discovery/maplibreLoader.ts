const MAPLIBRE_VERSION = '5.24.0';
const SCRIPT_ID = 'velliqo-maplibre-script';
const STYLE_ID = 'velliqo-maplibre-style';

let loadPromise: Promise<MapLibreNamespace> | null = null;

export interface MapLibreNamespace {
  Map: new (options: Record<string, unknown>) => any;
  Marker: new (options?: Record<string, unknown>) => any;
  Popup: new (options?: Record<string, unknown>) => any;
  NavigationControl: new (options?: Record<string, unknown>) => any;
  LngLatBounds: new () => any;
}

declare global {
  interface Window {
    maplibregl?: MapLibreNamespace;
  }
}

export function ensureMapLibreLoaded(): Promise<MapLibreNamespace> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<MapLibreNamespace>((resolve, reject) => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('link');
      style.id = STYLE_ID;
      style.rel = 'stylesheet';
      style.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
      document.head.appendChild(style);
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error('MapLibre failed to initialise')), { once: true });
      existing.addEventListener('error', () => reject(new Error('MapLibre failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
    script.async = true;
    script.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error('MapLibre failed to initialise'));
    script.onerror = () => reject(new Error('MapLibre failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
