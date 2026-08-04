import React from 'react';
import { usePWAStatus } from '@/hooks/usePWAStatus';

type StoreBusiness = {
  slug: string;
  name: string;
  logo_url?: string | null;
  pwa_enabled?: boolean | null;
  pwa_short_name?: string | null;
};

function ensureLink(id: string, rel: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.id = id;
  return link;
}

function ensureMeta(id: string, name: string) {
  let meta = document.getElementById(id) as HTMLMetaElement | null;
  if (!meta) meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.id = id;
  return meta;
}

export function useStorePWA(business: StoreBusiness | null | undefined) {
  const status = usePWAStatus();
  const enabled = Boolean(business?.slug && business.pwa_enabled !== false);

  React.useLayoutEffect(() => {
    if (!business?.slug || !enabled) return;

    const manifest = ensureLink('app-manifest', 'manifest');
    const nextManifestHref = `/store-manifest/${encodeURIComponent(business.slug)}.webmanifest?v=2`;
    if (manifest.getAttribute('href') !== nextManifestHref) manifest.href = nextManifestHref;

    const icon = ensureLink('app-apple-touch-icon', 'apple-touch-icon');
    icon.href = business.logo_url || '/icons/icon-192.png';

    const titleMeta = ensureMeta('app-apple-title', 'apple-mobile-web-app-title');
    titleMeta.content = business.pwa_short_name || business.name;

    return () => {
      queueMicrotask(() => {
        if (window.location.pathname.startsWith(`/app/${business.slug}`)) return;
        manifest.href = '/manifest.webmanifest';
        icon.href = '/icons/icon-192.png';
        titleMeta.content = 'Velliqo';
      });
    };
  }, [business?.slug, business?.name, business?.logo_url, business?.pwa_short_name, enabled]);

  return { ...status, enabled };
}
