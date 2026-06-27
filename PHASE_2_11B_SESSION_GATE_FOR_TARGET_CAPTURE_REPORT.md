# P2.11B - Session Gate For Target Capture Report

## Bug observed

The previous target overview capture path could start a crawler action that opened a fresh browser/profile before checking whether the selected TikTok Shop profile was already attached and logged in. When the opened page landed on login/signup, pressing capture again could repeat the fresh browser/session behavior instead of reusing the opened profile.

## Files changed

- `app/server.mjs`
- `app/tiktokshop-crawler.mjs`
- `public/app.js`
- `public/styles.css`
- `scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `PHASE_2_11B_SESSION_GATE_FOR_TARGET_CAPTURE_REPORT.md`

## New flow

1. Dashboard now shows three separate controls:
   - `Open/Attach seller profile`
   - `Refresh/Verify session`
   - `Target overview capture`
2. `Open/Attach seller profile` is the only target-capture action that may open a browser. If an in-memory CDP target for the selected shop is reachable, the server attaches/reuses it.
3. `Refresh/Verify session` checks CDP and classifies only safe page state:
   - `seller_center`
   - `login`
   - `signup`
   - `unknown`
4. `Target overview capture` stays disabled/blocked until `sessionReady === true`.
5. If target capture sees login/signup/not-ready state, it does not crawl and does not open another browser. It returns safe metadata with:
   - `failureReason: not_logged_in` or `cookie_missing`
   - `retryable: true`
   - `nextAction: Login in the opened profile, then click Refresh/Verify session.`
6. If an active job is already running, target capture is blocked with safe `activeJob` metadata.

## UI copy added

- `Chưa xác thực session`
- `Đăng nhập trong browser app đã mở, sau đó bấm Refresh/Verify session`
- `Không mở browser mới khi session chưa sẵn sàng`
- `Target overview capture chỉ chạy sau khi session/profile đã sẵn sàng`

## Safety confirmations

- No cookie/token/session values are read, printed, logged, returned, or shown.
- Target readiness responses expose only safe metadata: `sessionReady`, `currentPageKind`, `selectedShop`, `profileName`, `cdpStatus`, `activeJob`, `failureReason`, and `nextAction`.
- No cookie/session import/export behavior was changed.
- No auto crawl, auto backfill, GMVMax, private data, `.env`, auth/license/payment/deployment/database migration, or Seller Center to Shop Overview card mapping was changed.
- Crawler engine rewrite was avoided; only page-kind classification and target-capture preflight gates were added.

## Smoke results

Initial direct `npm run ...` calls from the UNC cwd failed because Windows `cmd.exe` defaulted to `C:\Windows`. Reran npm smokes with `cmd /c pushd \\wsl.localhost\Ubuntu\home\strange\.openclaw\workspace\strange-tts-pc-app && ...`.

Passed:

- `node --check app/server.mjs`
- `node --check app/tiktokshop-crawler.mjs`
- `node --check public/app.js`
- `npm run ui:shell-smoke`
- `npm run gmv:max-smoke`
- `npm run crawler:contract-smoke`
- `npm run crawler:fixture-smoke`
- `npm run session:restore-gate-smoke`
- `npm run audit:log-redaction-smoke`
- `npm run business:spreadsheet-smoke`
- `npm run business:legacy-xls-scope-smoke`
- `npm run crawler:auto-profile-smoke`

Harness note:

- `scripts/agent-healthcheck.sh` was attempted through `bash`, but this machine resolves `bash.exe` to WSL and WSL reported `/bin/bash` missing. No product smoke was skipped from the requested list.

## Known limitations

- Browser attach state is held in the current server process memory. After app/server restart, the user should click `Open/Attach seller profile` again before verifying.
- Full authenticated TikTok Seller Center behavior still requires a real local logged-in profile and remains manual QA.
- `docs/TEST_MATRIX.md` was not edited because this task provided an explicit allowed-files list that did not include docs.

## Commit status

No commit was created.
