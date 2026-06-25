# Phase 2.7B - CDP Retry Flow UI Report

## Files Changed

- `public/app.js`
  - Added a clearer CDP recovery box with Vietnamese operator copy.
  - Added Dashboard CTAs for opening TikTok Crawler and refreshing status.
  - Added TikTok Crawler CTAs for refreshing status and manually retrying Seller Center crawl.
  - Reused the existing `/api/tiktokshop-crawler/crawl` route only when the user clicks retry.
- `public/styles.css`
  - Added compact layout styling for CDP recovery action buttons.

## UI Behavior Added

When `failureReason === "cdp_unavailable"` or `cdpStatus.reachable === false`, the UI shows:

- `Mất kết nối browser/CDP`
- `App không kết nối được browser đang dùng để crawl.`
- `Đóng browser cũ, restart app, mở lại profile rồi retry crawl.`
- Recovery steps from API when present, mapped to simple Vietnamese labels.

Dashboard Data Source Status shows:

- `Mở TikTok Crawler để retry`
- `Refresh trạng thái`

TikTok Crawler workspace shows:

- `Retry Seller Center crawl`
- `Refresh trạng thái`

## Button / Action Behavior

- `Refresh trạng thái`
  - Dashboard: rerenders Dashboard status.
  - TikTok Crawler: rerenders TikTok Crawler workspace/status.
- `Mở TikTok Crawler để retry`
  - Switches the current workspace to TikTok Crawler.
- `Retry Seller Center crawl`
  - Calls the existing `/api/tiktokshop-crawler/crawl` route only after user click.
  - Uses `mode: "seller-center"`.
  - Disables the clicked button while running.
  - Shows retry progress in the output panel.
  - Refreshes TikTok Crawler status after completion/failure.

No Dashboard auto crawl/backfill was added.

## Smoke Results

Passed:

- `node --check public/app.js`
- `node --check app/server.mjs`
- `npm run ui:shell-smoke`
- `npm run gmv:max-smoke`
- `npm run crawler:contract-smoke`
- `npm run crawler:fixture-smoke`
- `npm run session:restore-gate-smoke`
- `npm run audit:log-redaction-smoke`
- `npm run business:spreadsheet-smoke`
- `npm run business:legacy-xls-scope-smoke`

Expected/non-blocking:

- `node --check public/styles.css || true` returns Node `ERR_UNKNOWN_FILE_EXTENSION` for `.css`, as expected for this command shape.

## Real Local Validation

Runtime path:

- `C:\Users\Stephen Strange\StrangeTTS-PC-App`

Actions performed:

- Copied changed `public/app.js` and `public/styles.css` to the Windows local runtime.
- Restarted app with `npm run restart` from the Windows local runtime.
- Called `http://127.0.0.1:48731/api/tiktokshop-crawler/db`.
- Confirmed safe metadata:
  - `crawlerStatus: "partial"`
  - `failureReason: "cdp_unavailable"`
  - `retryable: true`
  - `activeJob: false`
  - `staleRun: true`
  - `cdpStatus.reachable: false`
  - `cdpStatus.reason: "cdp_unavailable"`
- Opened UI at `http://127.0.0.1:48731`.
- Confirmed Dashboard renders CDP recovery panel and CTAs.
- Clicked Dashboard CTA to open TikTok Crawler.
- Confirmed TikTok Crawler renders CDP recovery panel, `Retry Seller Center crawl`, and `Refresh trạng thái`.
- Clicked TikTok Crawler refresh CTA and confirmed it rerenders without crashing.

Evidence screenshot outside repo:

- `/home/strange/.cache/codex-ui-check/phase-2-7b-dashboard-full.png`

## Known Limitations

- Did not click `Retry Seller Center crawl` against a live authenticated browser because that would start a real crawl. The code path is bound to the existing route and only triggers on explicit user click.
- Did not validate a successful CDP-recovered real crawl in this phase.

## Confirmations

- No auto realtime crawl or backfill.
- No crawler engine rewrite.
- No route/path/API endpoint change.
- No cookie/session import/export change.
- No cookie/token/session/private profile path exposed.
- No raw response logging added.
- No GMVMax dashboard change.
- No changes to `data/`, `data/private`, `.env`, auth, license, payment, billing, deployment, or database migration code.
- No commit made.
