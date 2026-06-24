# Phase 2 Crawler/session status control report

## Summary

Phase 2 added a safe crawler status contract for real-operation readiness. The app now exposes normalized crawler/session metadata on existing crawler responses and binds the TikTok Crawler UI to that contract.

No route/path/API endpoint was changed. No cookie import/export format was changed. Authorized Local Session Restore was not implemented.

## Files changed

- `app/crawler-contract.mjs`
  - Added crawler failure reason enum.
  - Added `normalizeCrawlerFailureReason`.
  - Added `buildCrawlerStatusContract`.
  - Allowed only safe cookie/session metadata fields through scrubber: `cookieCount`, `cookieStorage`, `cookieStorageStatus`, `cookieUpdatedAt`, `sessionHint`.
- `app/server.mjs`
  - Added safe `crawlerStatus` metadata to existing `/api/tiktokshop-crawler/db` response.
  - Added safe `crawlerStatus` metadata to existing `/api/tiktokshop-crawler/crawl` responses.
  - Normalized async Seller Center crawl failure audit data to `failureReason` instead of raw error text.
- `public/app.js`
  - Bound TikTok Crawler Phase 1 UI cards to backend `crawlerStatus`.
  - Added friendly labels for normalized failure reasons.
  - Kept fallback behavior for older response shapes.
- `scripts/crawler-contract-smoke.mjs`
  - Added assertions for status contract fields and no secret leakage.

## Status fields added/standardized

- `status`
- `readiness`
- `selectedShop`
- `profileName`
- `cookieStorageStatus`
- `cookieCount`
- `cookieUpdatedAt`
- `sessionHint`
- `latestRun`
- `failureReason`
- `partialReason`
- `missingMetrics`
- `retryable`
- `runId`
- `updatedAt`

## Failure reasons standardized

- `not_logged_in`
- `cookie_missing`
- `cookie_expired`
- `wrong_shop_suspected`
- `captcha_or_verification_needed`
- `seller_center_unavailable`
- `compass_unavailable`
- `cdp_unavailable`
- `api_response_changed`
- `selector_changed`
- `network_error`
- `parse_error`
- `partial_capture`
- `unknown`

## Smoke result

Direct `npm run ...` from the UNC PowerShell cwd failed because `cmd.exe` cannot use UNC paths and defaulted to `C:\Windows`. The same npm scripts were rerun from the WSL repo path.

- PASS: `node --check public/app.js`
- PASS: `node --check app/server.mjs`
- PASS: `node --check app/tiktokshop-crawler.mjs`
- PASS: `node --check app/crawler-contract.mjs`
- PASS: `npm run crawler:contract-smoke`
- PASS: `npm run crawler:contract-policy-smoke`
- PASS: `npm run crawler:retention-contract-smoke`
- PASS: `npm run crawler:fixture-smoke`
- PASS: `npm run session:restore-gate-smoke`
- PASS: `npm run audit:log-redaction-smoke`
- PASS: `npm run ui:shell-smoke`
- PASS: `npm run gmv:max-smoke`

`git diff --check` passed. `bash scripts/agent-healthcheck.sh` was also run because the file was not executable directly. The healthcheck passed the crawler/session, UI shell, audit redaction, and GMVMax checks, but the overall healthcheck exited non-zero on `business:legacy-xls-scope-smoke` with `business file helper copy should not mention legacy .xls`. That failure is outside the Phase 2 crawler/session scope and was not modified here.

## Real-data validation

Not done in this phase. Phase 2 did not run against live TikTok Shop cookies/session or real Seller Center/Compass data.

Next real-data checklist:

- Confirm selected shop/profile metadata matches the intended live shop.
- Confirm `cookieStorageStatus`, `cookieCount`, and `cookieUpdatedAt` update without exposing values.
- Run Seller Center crawl with a valid local logged-in browser profile.
- Verify `status` moves through `crawling` to `completed`, `partial`, or `failed`.
- Verify `failureReason` maps correctly for need-login, expired cookie, wrong shop, captcha/verification, CDP unavailable, network error, and selector/API changes.
- Verify no cookie/token/session/private path appears in UI, response body, audit log, console output, or report.

## Protected confirmations

- Route/path/API endpoint: unchanged.
- Cookie/session import/export format: unchanged.
- Authorized Local Session Restore: not implemented.
- GMVMax Dashboard: not modified.
- `extension/`: not modified.
- `app/license.mjs`: not modified.
- `app/auth.mjs`: not modified.
- Payment/billing/deployment/database migration: not modified.
- Cookie/token/session secret: not logged or committed.
