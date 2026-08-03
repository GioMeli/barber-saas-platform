import React from 'react';
import { usePWAStatus } from '@/hooks/usePWAStatus';

type StaffBusiness = {
  slug: string;
  name: string;
  logo_url?: string | null;
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

export function useStaffPWA(business: StaffBusiness | null | undefined) {
  const status = usePWAStatus();
  const enabled = Boolean(business?.slug);

  React.useEffect(() => {
    if (!business?.slug) return;

    const manifest = ensureLink('staff-pwa-manifest', 'manifest');
    manifest.href = `/staff-manifest/${encodeURIComponent(business.slug)}.webmanifest`;

    const icon = ensureLink('staff-apple-touch-icon', 'apple-touch-icon');
    icon.href = business.logo_url || '/brand/velliqo-ai.png';

    const titleMeta = ensureMeta('staff-apple-title', 'apple-mobile-web-app-title');
    titleMeta.content = `${business.name} Staff`;

    return () => {
      manifest.href = '/manifest.webmanifest';
      icon.href = '/brand/velliqo-ai.png';
      titleMeta.content = 'Velliqo';
    };
  }, [business?.slug, business?.name, business?.logo_url]);

  return { ...status, enabled };
}
