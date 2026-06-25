# Phase 2.7A - CDP Retry Readiness Report

## Scope

Phase 2.7A improves TikTokCrawler readiness and recovery metadata for `cdp_unavailable` cases before a realtime Seller Center or Compass crawl starts. The change is limited to safe status metadata and UI recovery guidance.

## Files Changed

- `app/server.mjs`
  - Added safe CDP preflight metadata and recovery steps.
  - Added preflight checks before Seller Center and Compass crawls.
  - Added stale running-run normalization metadata.
  - Added `cdpStatus`, `activeJob`, `staleRun`, `recoverySteps`, and `nextAction` to existing safe crawler status responses.
- `public/app.js`
  - Added browser/CDP recovery panel for TikTok Crawler current state.
  - Added browser/CDP recovery panel for Dashboard Data Source Status.
  - Bound UI to top-level `cdpStatus` from `/api/tiktokshop-crawler/db`.
- `public/styles.css`
  - Added a small warning style for the CDP recovery panel.
- `docs/TEST_MATRIX.md`
  - Added this report as crawler evidence.

## CDP Preflight / Recovery Metadata Added

Safe response metadata can now include:

- `cdpStatus.reachable`
- `cdpStatus.checkedAt`
- `cdpStatus.reason`
- `cdpStatus.retryable`
- `cdpStatus.recoverySteps`
- `cdpStatus.nextAction`
- `cdpStatus.activeJob`
- `cdpStatus.staleRun`

When CDP is unavailable before crawl start, the server returns:

- `failureReason: "cdp_unavailable"`
- `retryable: true`
- `accepted: false`
- safe recovery steps:
  - Close stale browser windows opened by the app.
  - Restart the PC app.
  - Open the selected TikTok Shop profile again.
  - Retry Seller Center crawl.

No cookie value, token, authorization header, session payload, private profile path, or `.env` value is returned.

## Stale Running Job Handling

If the latest Seller Center run says `running` but there is no active in-memory job after app restart, the server normalizes it to:

- `status: "incomplete"` in `sellerCenter`
- `crawlerStatus.status: "partial"`
- `failureReason: "cdp_unavailable"`
- `retryable: true`
- `staleRun: true`

This prevents a stale persisted run from displaying as forever-running.

## UI Behavior

TikTok Crawler and Dashboard Data Source Status now show a recovery box when:

- `failureReason === "cdp_unavailable"`
- `latestAttemptedFailureReason === "cdp_unavailable"`
- `cdpStatus.reason === "cdp_unavailable"`
- `cdpStatus.reachable === false`

User-facing copy:

- `Mat ket noi browser/CDP`
- `Dong cua so browser cu, restart app, mo lai profile, roi retry crawl.`

The UI does not show stack traces or sensitive session details.

## Smoke Results

Passed:

- `node --check app/server.mjs`
- `node --check app/tiktokshop-crawler.mjs`
- `node --check app/crawler-contract.mjs`
- `node --check public/app.js`
- `npm run crawler:contract-smoke`
- `npm run crawler:fixture-smoke`
- `npm run session:restore-gate-smoke`
- `npm run audit:log-redaction-smoke`
- `npm run ui:shell-smoke`
- `npm run gmv:max-smoke`
- `npm run business:spreadsheet-smoke`
- `npm run business:legacy-xls-scope-smoke`

## Known Limitations

- Real authenticated Seller Center/Compass crawl was not run in this phase.
- CDP preflight checks only local DevTools `/json` reachability and page target availability. It does not prove the TikTok account is logged in or that the selected browser page is the correct shop.
- Existing crawler collection logic and selector behavior were intentionally not rewritten.

## Confirmations

- No crawler engine rewrite.
- No GMVMax Dashboard change.
- No route/path/API endpoint change.
- No cookie import/export format change.
- No Authorized Local Session Restore implementation.
- No cookie/token/session secret logged or committed.
- No data/private, runtime profile, auth, license, payment, billing, deployment, or database migration changes.
