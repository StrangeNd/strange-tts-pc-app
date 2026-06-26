# Phase 2.10A - Freshness Gap Transparency Report

## Summary

Phase 2.10A adds safe freshness-gap metadata and UI transparency for the case where realtime Seller Center crawl has completed, but Shop Overview cards still use cached Compass/crawler data.

This phase does not backfill, does not auto crawl, and does not connect Seller Center completed run data into dashboard cards.

## Files Changed

- `app/server.mjs`
  - Added safe `freshnessGap` metadata under `dataSourceStatus`.
  - Detects when realtime crawl is completed but effective dashboard card source remains cached Compass/crawler.
- `public/app.js`
  - Added UI copy so Dashboard/Business Analysis does not imply cards are realtime-fresh when they are still cache-based.

## API Validation

Validated endpoint:

- `/api/business/shop-overview?shopId=little-apricot-hawaii-fashion`

Safe result:

- `ok`: true
- `runId`: `compass-2026-06`
- `sourceStatus`: `cached-crawler`
- `latestAttemptedStatus`: `completed`
- `latestAttemptedRunId`: `2026-06-25T15-21-30-403Z`
- `fallbackUsed`: false
- `freshnessGap.exists`: true
- `freshnessGap.reason`: `realtime_completed_but_cards_use_cached_compass`
- `effectiveCardRunId`: `compass-2026-06`
- `effectiveCardSource`: `cached-crawler`
- `severity`: `info`
- `cardCount`: 8
- `coverageCount`: 8

## UI Behavior

Dashboard/Data Source Status now explains:

- realtime crawl has completed
- dashboard cards may still use cached Compass/crawler run
- this is metadata-fresh, not necessarily dashboard-card fresh

Business Analysis source context also avoids implying KPI/card data is realtime-fresh when it is still based on cached overview/Compass data.

## Smoke Results

Passed:

- `node --check app/server.mjs`
- `node --check public/app.js`
- `npm run ui:shell-smoke`
- `npm run gmv:max-smoke`
- `npm run business:spreadsheet-smoke`
- `npm run business:legacy-xls-scope-smoke`
- `npm run crawler:contract-smoke`
- `npm run audit:log-redaction-smoke`

## Known Limitations

- This phase does not make Shop Overview cards fresh from Seller Center completed runs.
- This phase does not implement auto backfill or hidden auto crawl.
- It only clarifies metadata/UI so users do not confuse realtime crawl completion with dashboard-card freshness.

## Next Recommended Phase

Phase 2.10B or Phase 2.11 should decide whether to:

- implement a fresh Seller Center overview summary source, or
- keep Compass/cache as the primary card source but label it clearly.

## Confirmations

- No secret values logged or committed.
- No cookie/token/session value, authorization header, bearer token, msToken, x-bogus value, or session payload was read, printed, or stored.
- No GMVMax changes.
- No auto backfill or hidden auto crawl.
- No crawler engine rewrite.
- No route/API path change.
- No cookie/session import/export change.
- No `data/`, `data/private`, `.env`, auth, license, payment, deployment, or database migration changes.
