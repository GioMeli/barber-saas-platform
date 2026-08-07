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
  const employeeId = String(request.query?.employeeId || '').trim();
  const employeeName = cleanEmployeeName(request.query?.employeeName);

  if (!/^[a-z0-9-]{2,120}$/i.test(slug)) return response.status(400).json({ error: 'Invalid business slug' });
  if (!/^[a-f0-9-]{32,40}$/i.test(employeeId)) return response.status(400).json({ error: 'Invalid staff identifier' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return response.status(503).json({ error: 'Manifest service is not configured' });

  const result = await fetch(`${supabaseUrl}/rest/v1/rpc/staff_manifest_meta`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_business_slug: slug, p_employee_id: employeeId }),
  });

  if (!result.ok) return response.status(502).json({ error: 'Unable to load staff manifest' });
  const business = await result.json();
  if (!business?.id) return response.status(404).json({ error: 'Staff app is unavailable' });

  const employeeParam = encodeURIComponent(employeeId);
  const employeeNameParam = encodeURIComponent(employeeName);

  // Standard includes browser Staff Portal access but intentionally does not
  // expose an installable PWA. Returning display=browser and no app icons keeps
  // the official Velliqo install experience limited to Pro and Premium.
  if (business.staff_app_install_enabled !== true) {
    const browserManifest = {
      id: `/staff/${business.slug}/browser/${employeeParam}`,
      name: `${employeeName} · ${business.name} Staff Portal`,
      short_name: `${employeeName.slice(0, 14)} Staff`,
      description: `${employeeName}'s secure Staff Portal for ${business.name}.`,
      start_url: `/staff/${business.slug}?employee=${employeeParam}&employeeName=${employeeNameParam}`,
      scope: `/staff/${business.slug}`,
      display: 'browser',
      theme_color: '#6d28d9',
      background_color: '#f8fafc',
      categories: ['business', 'productivity'],
    };
    response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    response.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    return response.status(200).send(JSON.stringify(browserManifest));
  }

  const fullName = `${employeeName} · ${business.name}`;
  const shortName = `${employeeName.slice(0, 14)} Staff`;
  const businessLogo = typeof business.logo_url === 'string' && /^https?:\/\//i.test(business.logo_url) ? business.logo_url : null;
  const storageBase = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/images`;
  const tenantIcon = (size: 192 | 512) => `${storageBase}/businesses/${encodeURIComponent(business.id)}/pwa/icon-${size}.png`;
  const iconVersion = encodeURIComponent(String(business.updated_at || business.logo_url || '10'));
  const tenant192 = `${tenantIcon(192)}?v=${iconVersion}`;
  const tenant512 = `${tenantIcon(512)}?v=${iconVersion}`;

  const appIcons = businessLogo
    ? [
        { src: tenant192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: tenant512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: businessLogo, sizes: 'any', purpose: 'any' },
        { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]
    : [
        { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ];
  const shortcutIcon = businessLogo ? tenant192 : '/icons/icon-192.png?v=2';

  const manifest = {
    id: `/staff/${business.slug}/app/${employeeParam}`,
    name: fullName,
    short_name: shortName,
    description: `${employeeName}'s personal appointment workspace for ${business.name}.`,
    start_url: `/staff/${business.slug}?source=pwa&employee=${employeeParam}&employeeName=${employeeNameParam}`,
    scope: `/staff/${business.slug}`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#6d28d9',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: appIcons,
    shortcuts: [
      { name: 'My schedule', url: `/staff/${business.slug}?employee=${employeeParam}&employeeName=${employeeNameParam}`, icons: [{ src: shortcutIcon, sizes: '192x192' }] },
      { name: 'New appointment', url: `/staff/${business.slug}?employee=${employeeParam}&employeeName=${employeeNameParam}&action=new`, icons: [{ src: shortcutIcon, sizes: '192x192' }] },
    ],
  };

  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  return response.status(200).send(JSON.stringify(manifest));
}
