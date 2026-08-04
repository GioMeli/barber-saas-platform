import { supabase } from '@/db/supabase';

const ICON_SIZES = [192, 512] as const;
const ICON_CACHE_PREFIX = 'velliqo:pwa-business-icons:';

export function businessPwaIconStoragePath(businessId: string, size: 192 | 512) {
  return `businesses/${businessId}/pwa/icon-${size}.png`;
}

export function businessPwaIconPublicUrl(businessId: string, size: 192 | 512, version?: string | null) {
  const url = supabase.storage.from('images').getPublicUrl(businessPwaIconStoragePath(businessId, size)).data.publicUrl;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to decode business logo'));
      image.src = objectUrl;
    });
  } finally {
    // The image has already decoded by the time the promise resolves.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

async function createSquareIcon(blob: Blob, size: 192 | 512): Promise<Blob> {
  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  context.clearRect(0, 0, size, size);

  // Keep a safe margin around rectangular logos so launchers do not clip branding.
  const padding = Math.round(size * 0.1);
  const available = size - padding * 2;
  const scale = Math.min(available / image.naturalWidth, available / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, x, y, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((output) => {
      if (output) resolve(output);
      else reject(new Error('Unable to create PWA icon'));
    }, 'image/png');
  });
}

export async function syncBusinessPwaIconsFromBlob(
  businessId: string,
  source: Blob,
  logoSignature?: string
) {
  if (!businessId || !source.size) return;

  await Promise.all(
    ICON_SIZES.map(async (size) => {
      const icon = await createSquareIcon(source, size);
      const { error } = await supabase.storage
        .from('images')
        .upload(businessPwaIconStoragePath(businessId, size), icon, {
          cacheControl: '3600',
          contentType: 'image/png',
          upsert: true,
        });
      if (error) throw error;
    })
  );

  if (logoSignature) {
    try {
      window.localStorage.setItem(`${ICON_CACHE_PREFIX}${businessId}`, logoSignature);
    } catch {
      // Storage is only an optimisation; failure must not block icon generation.
    }
  }
}

export async function ensureBusinessPwaIcons(businessId: string, logoUrl?: string | null) {
  const normalizedLogo = String(logoUrl || '').trim();
  if (!businessId || !normalizedLogo) return;

  try {
    if (window.localStorage.getItem(`${ICON_CACHE_PREFIX}${businessId}`) === normalizedLogo) {
      const { data, error } = await supabase.storage
        .from('images')
        .list(`businesses/${businessId}/pwa`, { limit: 10 });
      const names = new Set((data || []).map((item) => item.name));
      if (!error && names.has('icon-192.png') && names.has('icon-512.png')) return;
    }
  } catch {
    // The cache is only an optimisation. Missing assets are regenerated below.
  }

  const response = await fetch(normalizedLogo, { cache: 'no-store', mode: 'cors' });
  if (!response.ok) throw new Error(`Unable to fetch business logo (${response.status})`);
  const blob = await response.blob();
  await syncBusinessPwaIconsFromBlob(businessId, blob, normalizedLogo);
}
