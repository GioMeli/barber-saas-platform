function cleanEmployeeName(value: unknown) {
  return String(value || 'Staff')
    .replace(/[<>\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 60) || 'Staff';
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(request.query?.slug || '').trim();
  const employeeId = String(request.query?.employeeId || 'staff').trim();
  const employeeName = cleanEmployeeName(request.query?.employeeName);

  if (!/^[a-z0-9-]{2,120}$/i.test(slug)) {
    return response.status(400).json({ error: 'Invalid business slug' });
  }
  if (!/^[a-z0-9-]{2,120}$/i.test(employeeId)) {
    return response.status(400).json({ error: 'Invalid staff identifier' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return response.status(503).json({ error: 'Manifest service is not configured' });
  }

  const query = new URLSearchParams({
    select: 'name,slug,logo_url,status',
    slug: `eq.${slug}`,
    status: 'eq.active',
    limit: '1',
  });

  const result = await fetch(`${supabaseUrl}/rest/v1/businesses?${query.toString()}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });

  if (!result.ok) return response.status(502).json({ error: 'Unable to load staff manifest' });
  const rows = await result.json();
  const business = rows?.[0];
  if (!business) return response.status(404).json({ error: 'Staff app is unavailable' });

  const fullName = `${employeeName} · ${business.name}`;
  const shortName = `${employeeName.slice(0, 14)} Staff`;
  const employeeParam = encodeURIComponent(employeeId);
  const manifest = {
    id: `/staff/${business.slug}/app/${employeeParam}`,
    name: fullName,
    short_name: shortName,
    description: `${employeeName}'s personal appointment workspace for ${business.name}.`,
    start_url: `/staff/${business.slug}?source=pwa&employee=${employeeParam}`,
    scope: `/staff/${business.slug}`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#6d28d9',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'My schedule', url: `/staff/${business.slug}?employee=${employeeParam}`, icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'New appointment', url: `/staff/${business.slug}?employee=${employeeParam}&action=new`, icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };

  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600');
  return response.status(200).send(JSON.stringify(manifest));
}
