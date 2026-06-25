# Phase 2.8 - Real Crawl Recovery Validation Report

## Starting Branch / Commit

- Branch: `ai-agent/real-crawl-recovery-validation`
- Starting commit: `fd789a7 ui: add cdp retry flow`
- Starting working tree: clean except `?? .agent-runs/`

## Files Changed

- No app code changed.
- Added this validation report only.

## Baseline Crawler Status Safe Metadata

Baseline runtime: `C:\Users\Stephen Strange\StrangeTTS-PC-App`

Initial `/api/tiktokshop-crawler/db` safe metadata:

- `ok`: `true`
- `status`: `partial`
- `readiness`: `partial`
- `selectedShop.id`: `little-apricot-hawaii-fashion`
- `selectedShop.name`: `Little Apricot Hawaii Fashion`
- `selectedShop.sellerId`: `7494478078863902049`
- `profileName`: `shop-7494478078863902049`
- `failureReason`: `cdp_unavailable`
- `retryable`: `true`
- `activeJob`: `false`
- `staleRun`: `true`
- `cdpStatus.reachable`: `false`
- `cdpStatus.reason`: `cdp_unavailable`
- `nextAction`: `Close stale browser/CDP sessions, restart app, then retry Seller Center crawl.`

## Recovery Steps Performed

1. Confirmed local server was not running.
2. Started app through Windows local runtime:
   - `npm run stop`
   - `npm run app`
3. Confirmed local app opened at `http://127.0.0.1:48731`.
4. Opened app UI and confirmed Dashboard Data Source Status recovery UI:
   - Recovery title present.
   - `Mở TikTok Crawler để retry` CTA present.
   - `Refresh trạng thái` CTA present.
5. Opened TikTok Crawler workspace from Dashboard CTA.
6. Confirmed TikTok Crawler recovery UI:
   - Recovery title present.
   - `Retry Seller Center crawl` CTA present.
   - `Refresh trạng thái` CTA present.
   - Friendly copy present.
7. Clicked TikTok Crawler `Refresh trạng thái`; UI rerendered without crashing.

No secret-bearing screenshot or log was committed. UI screenshot evidence was kept outside the repo cache only.

## Retry Action

Retry was performed with the existing route equivalent to the UI button:

- Route: `POST /api/tiktokshop-crawler/crawl`
- Mode: `seller-center`
- Shop: `little-apricot-hawaii-fashion`
- Seller ID: `7494478078863902049`
- `autoOpenProfile`: `true`
- `dateRange`: `yesterday`
- `maxModules`: `1`

This was a small-scope real retry validation, not a full crawl.

Safe retry response:

- HTTP status: `202`
- `ok`: `true`
- `accepted`: `true`
- `status`: `running`
- `readiness`: `crawling`
- `runId`: `2026-06-25T15-21-30-400Z`
- `cdpStatus.reachable`: `true`
- `cdpStatus.reason`: `cdp_reachable`
- `latestRun.mode`: `seller-center`
- `latestRun.source`: `server-job`
- `latestRun.status`: `crawling`

Polling result:

- Poll 1: `status: crawling`, `cdpStatus.reachable: true`
- Poll 2: `status: completed`, `failureReason: null`, `activeJob: false`, `staleRun: false`

## Result Classification

`PASS_FULL`

Reason:

- CDP became reachable during retry.
- Retry crawl was accepted.
- Status moved from `partial/cdp_unavailable` to `crawling`.
- Status then moved to `completed`.
- New Seller Center run metadata was recorded.

## Final `/api/tiktokshop-crawler/db` Safe Metadata

- `ok`: `true`
- `status`: `completed`
- `readiness`: `completed`
- `selectedShop.id`: `little-apricot-hawaii-fashion`
- `selectedShop.name`: `Little Apricot Hawaii Fashion`
- `selectedShop.sellerId`: `7494478078863902049`
- `profileName`: `shop-7494478078863902049`
- `failureReason`: `null`
- `partialReason`: empty
- `retryable`: `false`
- `activeJob`: `false`
- `staleRun`: `false`
- `runId`: `2026-06-25T15-21-30-403Z`
- `latestRun.mode`: `seller-center`
- `latestRun.source`: `server-job`
- `latestRun.status`: `completed`
- `latestRun.updatedAt`: `2026-06-25T15:21:40.304Z`
- `cdpStatus.reason`: `cdp_not_checked`
- `cdpStatus.activeJob`: `false`
- `cdpStatus.staleRun`: `false`

## Shop Overview / Data Source Status Final State

Final `/api/business/shop-overview?shopId=little-apricot-hawaii-fashion` safe metadata:

- `ok`: `true`
- `overviewOk`: `true`
- `effectiveSource`: `cached-crawler`
- `realtimeStatus`: `completed`
- `latestAttemptedStatus`: `completed`
- `latestAttemptedFailureReason`: empty
- `latestAttemptedRunId`: `2026-06-25T15-21-30-403Z`
- `fallbackUsed`: `false`
- `retryable`: `false`
- `nextAction`: `Use cached crawler data or run a fresh crawl when newer data is needed.`

## Smoke Results

No code changed, so the minimal required smoke set was run.

Passed:

- `npm run ui:shell-smoke`
- `npm run crawler:contract-smoke`
- `npm run audit:log-redaction-smoke`

## Known Limitations

- Retry validation used `maxModules: 1`, not a full Seller Center crawl.
- No new crawler engine behavior was validated beyond CDP recovery, job acceptance, state transition, and completion metadata.
- Account/shop visual confirmation was limited to safe app metadata and selected profile naming; no cookie/session values were inspected.

## Next Recommended Phase

- Phase 2.9: small real-data freshness validation for Shop Overview and Business Analysis after successful Seller Center retry.
- Keep scope small and continue using safe metadata only.

## Confirmations

- No secret values logged or committed.
- No cookie/token/session value, authorization header, bearer token, msToken, x-bogus value, or session payload was read, printed, or stored in this report.
- No GMVMax changes.
- No auto backfill or hidden auto crawl added.
- No crawler engine rewrite.
- No route/path/API path change.
- No cookie/session import/export format change.
- No `data/`, `data/private`, `.env`, auth, license, payment, deployment, or database migration changes.
- No commit made.
