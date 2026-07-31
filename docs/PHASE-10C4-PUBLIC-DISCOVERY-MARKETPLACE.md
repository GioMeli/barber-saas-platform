# Phase 10C.4 — Public Discovery Marketplace

## Scope

- Premium marketplace search above the public product hero.
- Search by location, service/category or business name.
- Direct business-name suggestions.
- `/discover` map-and-list results experience.
- Map pins, business popups and customer-page links.
- Optional browser geolocation with a distinct user marker.
- Verified review aggregates, service-price context and direct business-name suggestions.
- Popularity ordering based on a privacy-safe 90-day booking score. When a service or category is selected, the score is calculated from matching appointment services.
- Owner opt-out control through `Storefront → Online presence`.

## Map stack

The discovery page loads a version-pinned MapLibre GL JS 5.24 runtime only when the map is needed and uses OpenFreeMap's Liberty style by default. If the map runtime or style is unavailable, the business list remains usable. The style URL can be overridden with:

```env
VITE_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

Geolocation is requested only after the visitor chooses **Use my current location**. It requires HTTPS in production or localhost during development.

## Database

Migration `00044_velliqo_public_discovery_marketplace.sql`:

- enables PostGIS,
- maintains a tenant-owned geography point derived from the existing latitude/longitude fields,
- adds a GiST index,
- adds `discovery_enabled`,
- exposes security-definer public discovery RPCs containing only public storefront fields and aggregates.

## Deployment

```bash
npm run discovery:check
npm run typecheck
npm run build
npx supabase db push
```

No Edge Function deployment is required.

## Owner requirements

For a storefront to appear as a map pin, the owner must:

1. Keep the business active and marketplace discovery enabled.
2. Provide accurate latitude and longitude in `Storefront → Location`.
3. Keep at least one active online-bookable service for service/category matching.

Businesses without coordinates can still appear in the results list, but they are not rendered as map pins.
