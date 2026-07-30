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

  React.useEffect(() => {
    if (!business?.slug || !enabled) return;

    const manifest = ensureLink('store-pwa-manifest', 'manifest');
    manifest.href = `/store-manifest/${encodeURIComponent(business.slug)}.webmanifest`;

    const icon = ensureLink('store-apple-touch-icon', 'apple-touch-icon');
    icon.href = business.logo_url || '/brand/velliqo-ai.png';

    const titleMeta = ensureMeta('store-apple-title', 'apple-mobile-web-app-title');
    titleMeta.content = business.pwa_short_name || business.name;

    return () => {
      manifest.href = '/manifest.webmanifest';
      icon.href = '/brand/velliqo-ai.png';
      titleMeta.content = 'Velliqo';
    };
  }, [business?.slug, business?.name, business?.logo_url, business?.pwa_short_name, enabled]);

  return { ...status, enabled };
}
