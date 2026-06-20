# US-012 - GMV Max Shop Cards

## Story

As a TikTok Shop operator,
I want a GMV Max workspace that shows loaded shops and the metadata needed for GMV Max work,
so that I can choose the right shop/profile before opening related dashboards or loading GMV Max files.

## Acceptance Criteria

- The app shell has a GMV Max entry.
- The GMV Max workspace shows loaded shop count, selected profile, and shop cards.
- Each shop card shows profile ID, Seller ID, Ads account ID, local session confirmation status, and a derived GMV Max entry URL.
- Missing Seller ID or Ads account ID is visibly marked missing instead of invented.
- Actions reuse existing profile-check and extension-dashboard flows.
- No live crawl, cookie/session restore, cookie export, auth, payment, deployment, or database behavior is added.

## Validation

- `node --check public/app.js`
- `node --check scripts/gmv-max-dashboard-smoke.mjs`
- `node scripts/gmv-max-dashboard-smoke.mjs`
- `npm run ui:shell-smoke`
- `scripts/agent-healthcheck.sh`
