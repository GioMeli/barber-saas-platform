# Phase 12E — Training videos and Staff multi-device OTP

## A. Adding a training video to a course

The Training Portal and public Courses page read their video configuration from:

```text
src/training/catalog.ts
```

Each record in `TRAINING_GUIDES` is one course. The current course slugs are:

| Category | Course slug |
| --- | --- |
| Setup | `getting-started` |
| Setup | `business-storefront` |
| Operations | `services-pricing` |
| Operations | `staff-availability` |
| Operations | `calendar-appointments` |
| Operations | `customers-profiles` |
| Growth | `products-sales` |
| Growth | `marketing-content` |
| Intelligence | `reports-finance` |
| Intelligence | `velliqo-ai` |
| Intelligence | `automations-security` |
| Account | `billing-subscription` |

### Recommended video preparation

1. Record the lesson in 16:9.
2. Export as MP4 using H.264 video and AAC audio, ideally at 1080p.
3. Use a stable file name matching the course slug, for example:
   `calendar-appointments.mp4`.
4. Optionally create a 16:9 WebP or JPG poster such as:
   `calendar-appointments-poster.webp`.
5. Upload the files to a permanent public CDN/storage URL. Do not use an expiring signed URL in `catalog.ts`, because both the public Courses page and Owner Training Portal need a URL that remains valid.

### Direct MP4/WebM example

Find the course record and replace `videoUrl: null`:

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

### YouTube example

```ts
videoUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
videoProvider: 'youtube',
videoPosterUrl: null,
```

The application embeds YouTube through the privacy-enhanced `youtube-nocookie.com` player.

### Vimeo example

```ts
videoUrl: 'https://vimeo.com/VIDEO_ID',
videoProvider: 'vimeo',
videoPosterUrl: null,
```

### Final verification

Run:

```powershell
npm run phase12:check
npm run demo-training:check
npm run typecheck
npm run build
```

Then verify both locations:

```text
/courses
Owner → Training
```

A configured course automatically changes from “Video soon” to “Watch video”. No component editing is required.

## B. Staff access on multiple devices

Staff access is attached to the approved Supabase Auth user and employee/business authorization, not to one physical device.

The resulting flow is:

1. The employee opens the personal Staff App link on any phone, tablet or computer.
2. The employee enters the email approved by the owner.
3. Velliqo validates the business, employee, active status, personal-access permission and exact Auth account through `staff-email-auth`.
4. If the current device already has an active or trusted session, access is restored.
5. Otherwise Supabase sends a six-digit email OTP.
6. The employee enters the OTP in the Staff App.
7. Velliqo verifies the OTP and repeats the employee/business authorization check.
8. That device receives its own persistent session and can be registered as trusted without invalidating sessions on other devices.
9. Signing out from one Staff App uses local-session sign-out, so the employee is not automatically disconnected from every other device.

The owner can still disable or revoke staff access centrally. Workspace RPCs and RLS continue to validate the active employee/business relationship on every protected action.

## Hosted Supabase configuration required

The hosted Supabase **Magic Link** email template determines whether `signInWithOtp` sends a clickable link or a numeric OTP.

In Supabase Dashboard:

1. Open **Authentication**.
2. Open **Email Templates**.
3. Select **Magic Link**.
4. Set the subject to `Your Velliqo sign-in code`.
5. Replace the body with the contents of:
   `supabase/templates/staff-email-otp.html`.
6. Confirm that the body contains exactly `{{ .Token }}`.
7. Save the template.

Do not replace `{{ .Token }}` with `{{ .ConfirmationURL }}`, because that changes the flow back to a magic link.

The local Supabase configuration already references this template through `supabase/config.toml`.
