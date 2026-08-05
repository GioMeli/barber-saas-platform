# Phase 12A — Public visuals, Velliqo branding and Training video architecture

## Scope

This phase intentionally preserves the existing public-page information architecture. It replaces selected product visuals with the approved Velliqo device artwork, uses the transparent Velliqo mark in UI branding, adds Staff Portal product messaging to **Why Velliqo?** and **Experience**, and makes every Training course capable of playing a real video lesson.

## Approved public artwork

Approved assets live in:

`public/marketing/approved/`

The four supplied combined PNG compositions were converted to real alpha-transparent PNGs. The visible white canvas was removed while the device hardware, screens and shadows were retained. Supplied transparent WebP assets are stored unchanged.

Public pages render these assets with `ApprovedArtwork`, which uses `object-contain` and never adds another device frame or image background.

## Velliqo branding

Use `/brand/velliqo-mark.png` for compact UI branding. It is the same Velliqo symbol with a transparent background and is suitable for headers, authentication and application chrome.

`/brand/velliqo-logo-transparent.png` is the full Velliqo lock-up with its dark canvas removed. Keep it for layouts that need the complete mark + Velliqo word + Book. Manage. Grow. lock-up.

The original `/brand/velliqo-logo.png` is retained for compatibility with previously generated training documents and historical assets.

## Staff Portal public positioning

The Experience page now treats Velliqo as three connected experiences:

1. Owner workspace
2. Personal Staff Portal
3. Customer/public experience

The Staff Portal section explains personal schedules, live owner synchronization, secure staff email access and plan-controlled downloadable Staff Apps. Why Velliqo? includes the same concept in the adoption story and FAQ.

## Training video architecture

Each item in `src/training/catalog.ts` supports:

- `videoUrl`
- `videoProvider`: `direct`, `youtube` or `vimeo`
- `videoPosterUrl` for direct video files

The application auto-detects YouTube and Vimeo when `videoProvider` is omitted. All other URLs use the direct HTML/video-react player.

### Recommended production workflow

Do **not** commit large MP4 files to GitHub or Vercel.

For Velliqo-owned course videos, the recommended flow is:

1. Export the training video as MP4/H.264, ideally 1080p.
2. Upload the file to a CDN-backed location such as a dedicated public Supabase Storage bucket or a video platform.
3. Copy the public/CDN URL.
4. Open `src/training/catalog.ts`.
5. Add the URL to the matching course.
6. Optionally add a 16:9 poster image URL.
7. Run the training and production validators before deployment.

Direct-file example:

```ts
{
  slug: 'calendar-appointments',
  category: 'operations',
  estimatedMinutes: 12,
  route: '/dashboard/calendar',
  demoRoute: '/demo/calendar',
  videoUrl: 'https://cdn.example.com/velliqo-training/calendar-appointments.mp4',
  videoProvider: 'direct',
  videoPosterUrl: 'https://cdn.example.com/velliqo-training/calendar-appointments-poster.webp',
}
```

YouTube example:

```ts
videoUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
videoProvider: 'youtube',
```

Vimeo example:

```ts
videoUrl: 'https://vimeo.com/VIDEO_ID',
videoProvider: 'vimeo',
```

As soon as `videoUrl` is non-null, both the public Courses page and the Owner Training Portal replace “Video soon” with a **Watch video** action and open the lesson in the built-in modal player. No page redesign is required.
