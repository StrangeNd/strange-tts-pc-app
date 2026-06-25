# Phase 2.6D Data Source Status Report

## Summary

Phase 2.6D adds safe `dataSourceStatus` metadata to Shop Overview and Business Analysis so the UI can explain whether the visible data comes from cached crawler data, realtime attempt, partial data, or missing data.

No route path was changed. No crawler engine rewrite was done. No cookie/session import/export format was changed.

## Files changed

- `app/server.mjs`
  - Added safe `dataSourceStatus` builder for business-facing crawler/cache state.
  - Added `dataSourceStatus` to each `/api/business/shop-overview` overview item.
  - Added `dataSourceStatus` to `/api/business/analyze` result and enriched `shopOverview`.
  - Added stale realtime run guard for Seller Center runs that still say `running` after the server has restarted and no active job exists.
- `public/app.js`
  - Added Dashboard `Data source status` panel near Metric Coverage.
  - Added compact source/fallback fields to Business Analysis data context.
  - Added labels for `cached-crawler`, `partial`, and `failed`.

## Before / After Behavior

Before:

- Shop Overview could show `sourceStatus: cached-crawler`, but did not explain the latest realtime attempt.
- A stale or partial Seller Center attempt could exist while Compass cache was displayed, but the UI did not say fallback cache was being used.
- Business Analysis showed crawler cache context but did not expose fallback/realtime attempt metadata.

After:

- Shop Overview includes `dataSourceStatus`.
- Business Analysis includes `dataSourceStatus` when it uses Shop Overview/crawler cache.
- When cached Compass data is displayed and latest Seller Center realtime attempt is partial/failed, API/UI show:
  - effective source remains `cached-crawler`
  - realtime attempt exists
  - latest attempted status/reason
  - fallback cache used
  - retryable/next action metadata

## API Sample Safe Metadata

Local validation command was run from:

`C:\Users\Stephen Strange\StrangeTTS-PC-App`

Safe sample from `/api/business/shop-overview?shopId=little-apricot-hawaii-fashion`:

```json
{
  "runId": "compass-2026-06",
  "sourceStatus": "cached-crawler",
  "dataSourceStatus": {
    "effectiveSource": "cached-crawler",
    "requestedRange": "",
    "effectiveRange": "2026-06-01 -> 2026-06-30",
    "cacheRunId": "compass-2026-06",
    "cacheUpdatedAt": "2026-06-24T15:36:52.319Z",
    "latestAttemptedRunId": "2026-06-24T16-59-26-388Z",
    "latestAttemptedStatus": "partial",
    "latestAttemptedMode": "seller-center",
    "latestAttemptedSource": "seller-center-latest",
    "latestAttemptedUpdatedAt": "2026-06-24T16:59:26.388Z",
    "latestAttemptedFailureReason": "cdp_unavailable",
    "latestAttemptedPartialReason": "Job dang chay truoc do da bi dung hoac mat ket noi browser/CDP.",
    "latestSuccessfulRunId": "compass-2026-06",
    "latestSuccessfulUpdatedAt": "2026-06-24T15:36:52.319Z",
    "realtimeAttempted": true,
    "realtimeStatus": "partial",
    "fallbackUsed": true,
    "fallbackReason": "realtime_partial_using_cached_crawler",
    "retryable": true,
    "nextAction": "Close stale browser/CDP sessions, reopen the selected profile, then retry Seller Center or Compass crawl."
  },
  "cardCount": 8,
  "coverageCount": 8
}
```

Safe sample from `/api/business/analyze` with no uploaded files:

- `ok`: true
- `runId`: `compass-2026-06`
- `effectiveSource`: `cached-crawler`
- `latestAttemptedStatus`: `partial`
- `latestAttemptedFailureReason`: `cdp_unavailable`
- `fallbackUsed`: true
- `cardCount`: 8
- `coverageCount`: 8

## UI Behavior

- Dashboard now shows a `Data source status` panel near Metric Coverage.
- The panel shows:
  - data being viewed
  - cache run
  - cache updated timestamp
  - latest realtime status
  - failure reason
  - fallback cache yes/no
  - next action
- Business Analysis data context now shows:
  - active source state
  - fallback cache yes/no
  - next action when available

## Smoke Results

- PASS: `node --check app/server.mjs`
- PASS: `node --check app/business-analysis.mjs`
- PASS: `node --check app/crawler-contract.mjs`
- PASS: `node --check public/app.js`
- PASS: `npm run ui:shell-smoke`
- PASS: `npm run gmv:max-smoke`
- PASS: `npm run business:spreadsheet-smoke`
- PASS: `npm run business:legacy-xls-scope-smoke`
- PASS: `npm run crawler:contract-smoke`
- PASS: `npm run crawler:fixture-smoke`
- PASS: `npm run session:restore-gate-smoke`
- PASS: `npm run audit:log-redaction-smoke`

NPM smoke scripts were run from the WSL repo path to avoid the Windows UNC current-directory issue.

## Real Local Validation

Files copied to Windows local runtime:

- `app/server.mjs`
- `public/app.js`

Restart command:

```powershell
Set-Location -LiteralPath "C:\Users\Stephen Strange\StrangeTTS-PC-App"
npm run stop
npm run app
```

Restart result:

- App health: OK
- App: `Strange TTS PC App`
- Local URL: `http://127.0.0.1:48731`

Validation result:

- `/api/business/shop-overview?shopId=little-apricot-hawaii-fashion` includes `dataSourceStatus`.
- The active view uses cached Compass run `compass-2026-06`.
- Latest attempted Seller Center run is marked `partial`.
- Failure reason is normalized to `cdp_unavailable`.
- Fallback cache is explicitly marked as used.
- Metric Coverage remains present: 8 cards, 8 coverage entries.
- `/api/business/analyze` also returns matching `dataSourceStatus`.

## Leak Scan Result

Targeted scan:

- API metadata sample: 0 sensitive-pattern matches.
- Local log files scanned: 17.
- Local log files with sensitive-pattern matches: 0.

The report and validation output record metadata only. No secret values were copied into this report.

## Known Limitations

- This phase does not implement auto realtime crawl or backfill.
- This phase does not resolve the underlying `cdp_unavailable` realtime partial run.
- `dataSourceStatus` currently describes the effective source and latest attempt; it does not trigger a new crawl.
- UI browser visual inspection was not separately screenshot-verified in this pass; API and static UI smoke validated wiring.

## Confirmations

- GMVMax Dashboard was not modified.
- No route path was changed.
- No crawler engine rewrite was done.
- No cookie/session import/export format was changed.
- No Authorized Local Session Restore was implemented.
- No auth/license/payment/deployment/database migration files were modified.
- No cookie/token/session secret was logged or committed.

