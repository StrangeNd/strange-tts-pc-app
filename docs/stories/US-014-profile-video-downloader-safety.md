# US-014 - Profile Video Downloader Safety

## Story

As a TikTok Shop operator,
I want the video downloader to show the selected shop/profile and require an authorization confirmation,
so that I only download videos that the current shop/profile is allowed to view.

## Acceptance Criteria

- The downloader workspace shows selected shop/profile context before download.
- The downloader shows last local session confirmation when a shop/profile is selected.
- The downloader offers a profile-check action that reuses the existing shop/session safety flow.
- The downloader requires the operator to confirm the selected shop/profile can already view the video.
- The downloader warns against DRM, private content, access-control bypass, and cross-profile use.
- The backend download engine is not changed in this slice.
- No cookie/session restore, cookie import/export, auth, payment/billing, deployment, database migration, or private session handling is added.

## Validation

- `node --check public/app.js`
- `node --check scripts/video-downloader-safety-smoke.mjs`
- `node scripts/video-downloader-safety-smoke.mjs`
- `npm run video:safety-smoke`
- `node scripts/ui-shell-smoke.mjs`
- `scripts/agent-healthcheck.sh`
- Browser UI QA
