# US-030 - Shop Profile Metadata

## Story

As a TikTok Shop operator,
I want each shop profile to keep its key entry URLs, account IDs, login note, and health/status metadata,
so that I can confirm the correct shop/profile before opening shop-specific work.

## Acceptance Criteria

- Shop creation accepts and stores avatar URL, login note, Seller ID, Ads account ID, Seller Center URL, Seller Ads URL, Compass URL, GMV Max URL, shop health status, and product score status.
- The selected shop context and local backup payload preserve shop/profile metadata without storing or exposing cookies.
- The Seller Ads setup UI lets the operator enter the metadata before creating a shop.
- The shop/profile confirmation card shows the metadata before opening Seller Ads.
- Stored Seller Ads and GMV Max entry URLs are preferred when present, with generated fallback URLs preserved.
- Creating a shop still routes to the profile confirmation flow before opening Seller Ads.

## Validation

- `node --check app/shop-library.mjs`
- `node --check public/app.js`
- `node --check scripts/shop-profile-metadata-smoke.mjs`
- `node scripts/shop-profile-metadata-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
