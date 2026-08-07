import React from 'react';
import { usePWAStatus } from '@/hooks/usePWAStatus';
import { businessPwaIconPublicUrl } from '@/pwa/businessIconAssets';

type StaffBusiness = {
  id?: string | null;
  slug: string;
  name: string;
  logo_url?: string | null;
};

type StaffEmployee = {
  id: string;
  name: string;
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

function staffManifestHref(business: StaffBusiness, employee: StaffEmployee) {
  const query = new URLSearchParams({
    employeeName: employee.name || 'Staff',
    v: '10',
  });
  return `/staff-manifest/${encodeURIComponent(business.slug)}/${encodeURIComponent(employee.id)}.webmanifest?${query.toString()}`;
}

export function useStaffPWA(
  business: StaffBusiness | null | undefined,
  employee?: StaffEmployee | null,
  installAllowed = true
) {
  const status = usePWAStatus();
  const enabled = Boolean(installAllowed && business?.slug && employee?.id);

  React.useLayoutEffect(() => {
    if (!installAllowed || !business?.slug || !employee?.id) return;

    const manifest = ensureLink('app-manifest', 'manifest');
    const nextManifestHref = staffManifestHref(business, employee);
    if (manifest.getAttribute('href') !== nextManifestHref) manifest.href = nextManifestHref;

    const icon = ensureLink('app-apple-touch-icon', 'apple-touch-icon');
    icon.href = business.logo_url && business.id ? businessPwaIconPublicUrl(business.id, 192, business.logo_url) : business.logo_url || '/icons/apple-touch-icon.png?v=2';

    const titleMeta = ensureMeta('app-apple-title', 'apple-mobile-web-app-title');
    titleMeta.content = `${employee.name} · ${business.name}`;

    const previousTitle = document.title;
    document.title = `${employee.name} · ${business.name} Staff`;

    return () => {
      // React runs effect cleanup both on unmount and before dependency updates.
      // Only restore the generic manifest after navigation away from this staff route;
      // transiently switching to the generic manifest invalidates Chromium's deferred
      // install prompt and was the root cause of the installer getting stuck.
      queueMicrotask(() => {
        if (window.location.pathname.startsWith(`/staff/${business.slug}`)) return;
        manifest.href = '/manifest.webmanifest?v=2';
        icon.href = '/icons/apple-touch-icon.png?v=2';
        titleMeta.content = 'Velliqo';
      });
      document.title = previousTitle;
    };
  }, [installAllowed, business?.id, business?.slug, business?.name, business?.logo_url, employee?.id, employee?.name]);

  return { ...status, enabled };
}
