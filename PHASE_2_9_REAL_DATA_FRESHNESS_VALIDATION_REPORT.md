# Phase 2.9 - Real-data Freshness Validation Report

## Starting Branch / Commit

- Branch: `ai-agent/real-data-freshness-validation`
- Starting commit: `4ce0f00 test: validate real crawl cdp recovery`
- Starting working tree: clean except `?? .agent-runs/`

## Files Changed

- No app code changed.
- Added this validation report only.

## Baseline Crawler Status Safe Metadata

Runtime: `C:\Users\Stephen Strange\StrangeTTS-PC-App`

`/api/tiktokshop-crawler/db` safe metadata:

- `ok`: `true`
- `status`: `completed`
- `readiness`: `completed`
- `selectedShop.id`: `little-apricot-hawaii-fashion`
- `selectedShop.name`: `Little Apricot Hawaii Fashion`
- `selectedShop.sellerId`: `7494478078863902049`
- `profileName`: `shop-7494478078863902049`
- `failureReason`: `null`
- `retryable`: `false`
- `activeJob`: `false`
- `staleRun`: `false`
- `cdpStatus.reason`: `cdp_not_checked`
- `cdpStatus.reachable`: `null`

The Phase 2.8 retry-completed state is preserved. No stale `cdp_unavailable` status is present.

## Shop Overview Safe Metadata

Endpoint:

- `/api/business/shop-overview?shopId=little-apricot-hawaii-fashion`

Safe metadata:

- `ok`: `true`
- `runId`: `compass-2026-06`
- `sourceStatus`: `cached-crawler`
- `updatedAt`: `2026-06-24T15:36:52.319Z`
- `lastCrawlAt`: `2026-06-24T15:36:52.319Z`
- `rangeLabel`: `2026-06-01 -> 2026-06-30`
- `cards count`: `8`
- `available cards`: `6`
- `missing current count`: `2`
- `missing compare count`: not exposed directly by API for this range

Missing current cards:

- `orders`
- `visitors`

`dataSourceStatus`:

- `effectiveSource`: `cached-crawler`
- `realtimeStatus`: `completed`
- `latestAttemptedStatus`: `completed`
- `latestAttemptedRunId`: `2026-06-25T15-21-30-403Z`
- `latestAttemptedFailureReason`: empty
- `fallbackUsed`: `false`
- `retryable`: `false`
- `nextAction`: `Use cached crawler data or run a fresh crawl when newer data is needed.`

Interpretation:

Seller Center retry completed and is reflected in `dataSourceStatus`, but the effective dashboard cards still use the cached Compass/crawler run `compass-2026-06`. This is expected for the current implementation because no fresh Shop Overview mapping/backfill is linked from the Seller Center run into Compass dashboard cards.

## Business Analysis Safe Metadata

Endpoint:

- `POST /api/business/analyze`

Payload used:

- `shopId`: `little-apricot-hawaii-fashion`
- `crawlerShopId`: `little-apricot-hawaii-fashion`
- `sellerId`: `7494478078863902049`
- `files`: empty array
- no uploaded file content
- no cookie/session/token data

Safe metadata:

- `ok`: `true`
- `shopOverviewRunId`: `compass-2026-06`
- `cardCount`: `8`
- `coverageCount`: not exposed directly by API
- `warningsCount`: `1`
- warning type: offline price cache notice

`dataSourceStatus`:

- `effectiveSource`: `cached-crawler`
- `realtimeStatus`: `completed`
- `latestAttemptedStatus`: `completed`
- `latestAttemptedRunId`: `2026-06-25T15-21-30-403Z`
- `latestAttemptedFailureReason`: empty
- `fallbackUsed`: `false`
- `retryable`: `false`
- `nextAction`: `Use cached crawler data or run a fresh crawl when newer data is needed.`

Interpretation:

Business Analysis passes through the completed realtime status and no longer reports stale CDP/fallback state. With no uploaded files, KPI/business output remains limited, but data-source metadata is correct and transparent.

## Result Classification

`PASS_METADATA_ONLY`

Reason:

- Shop Overview and Business Analysis reflect the latest Seller Center run as `completed`.
- `fallbackUsed` is `false`.
- `latestAttemptedFailureReason` is empty.
- No stale `cdp_unavailable`, staleRun, or fallback recovery state remains.
- Effective dashboard cards still come from cached Compass/crawler run `compass-2026-06`, not from the fresh Seller Center run.

This passes metadata transparency but does not prove fresh dashboard-card data from the completed Seller Center run.

## UI Validation Result

Checked local UI at `http://127.0.0.1:48731`.

Dashboard:

- Data Source Status rendered.
- Cached crawler/source state rendered.
- Completed realtime status visible.
- CDP recovery panel was not rendered after successful retry.

Business Analysis:

- Workspace opened without crash.
- Upload/data-health flow rendered.
- Crawler data context/source state text rendered.
- No obvious `undefined`, `null`, stack trace, or UI crash in the visible main area.

## Smoke Results

No code changed, so the minimal required smoke set was run.

Passed:

- `npm run ui:shell-smoke`
- `npm run crawler:contract-smoke`
- `npm run audit:log-redaction-smoke`

## Known Limitations

- Phase 2.9 did not run a new crawl or backfill.
- Shop Overview cards are still sourced from cached Compass data.
- Seller Center completion is reflected as metadata, but not yet linked to a fresh Shop Overview card source.
- Business Analysis was validated with no uploaded files; it proves source-state passthrough, not full KPI calculation with new uploads.

## Next Recommended Phase

- Phase 2.10: decide whether Seller Center completed runs should update a fresh overview source summary, or whether UI should explicitly label Seller Center completion as metadata-only when dashboard cards remain Compass cached.
- Add a small fixture or smoke for `dataSourceStatus` passthrough in Business Analysis so this does not regress.

## Confirmations

- No secret values logged or committed.
- No cookie/token/session value, authorization header, bearer token, msToken, x-bogus value, or session payload was read, printed, or stored in this report.
- No GMVMax changes.
- No auto backfill or hidden auto crawl added.
- No crawler engine rewrite.
- No route/API path change.
- No cookie/session import/export change.
- No `data/`, `data/private`, `.env`, auth, license, payment, deployment, or database migration changes.
- No commit made.
