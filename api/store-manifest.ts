const FALLBACK_ICON = '/icons/icon-192.png?v=2';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(request.query?.slug || '').trim();
  if (!/^[a-z0-9-]{2,120}$/i.test(slug)) {
    return response.status(400).json({ error: 'Invalid store slug' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return response.status(503).json({ error: 'Manifest service is not configured' });
  }

  const query = new URLSearchParams({
    select: 'id,name,slug,logo_url,updated_at,pwa_enabled,pwa_short_name,status',
    slug: `eq.${slug}`,
    status: 'eq.active',
    limit: '1',
  });

  const result = await fetch(`${supabaseUrl}/rest/v1/businesses?${query.toString()}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });

  if (!result.ok) return response.status(502).json({ error: 'Unable to load store manifest' });
  const rows = await result.json();
  const business = rows?.[0];
  if (!business || business.pwa_enabled === false) {
    return response.status(404).json({ error: 'Store app is unavailable' });
  }

  const hasBusinessLogo = typeof business.logo_url === 'string' && /^https?:\/\//i.test(business.logo_url);
  const storageBase = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/images`;
  const iconVersion = encodeURIComponent(String(business.updated_at || business.logo_url || '4'));
  const tenant192 = `${storageBase}/businesses/${encodeURIComponent(business.id)}/pwa/icon-192.png?v=${iconVersion}`;
  const tenant512 = `${storageBase}/businesses/${encodeURIComponent(business.id)}/pwa/icon-512.png?v=${iconVersion}`;
  const icon = hasBusinessLogo ? tenant192 : FALLBACK_ICON;
  const shortName = String(business.pwa_short_name || business.name).slice(0, 30);
  const manifest = {
    id: `/app/${business.slug}`,
    name: business.name,
    short_name: shortName,
    description: `Book appointments and access ${business.name}.`,
    start_url: `/app/${business.slug}?source=pwa`,
    scope: `/app/${business.slug}`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    prefer_related_applications: false,
    icons: hasBusinessLogo
      ? [
          { src: tenant192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: tenant512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: business.logo_url, sizes: 'any', purpose: 'any' },
          { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ]
      : [
          { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
    shortcuts: [
      { name: 'Book appointment', url: `/app/${business.slug}/book`, icons: [{ src: icon, sizes: '192x192' }] },
      { name: 'My appointments', url: `/app/${business.slug}/account`, icons: [{ src: icon, sizes: '192x192' }] },
    ],
  };

  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  return response.status(200).send(JSON.stringify(manifest));
}
