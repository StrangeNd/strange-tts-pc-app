# P2.11C - CDP Drop Finalizer Report

## Bug observed

During live target overview capture, the server job could remain in `crawling` with `activeJob=true` after CDP became unavailable. The app only showed the expected partial/failed state after restart, because the running in-memory job was not finalized while the server stayed alive.

## Files changed

- `app/server.mjs`
- `scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `PHASE_2_11C_CDP_DROP_FINALIZER_REPORT.md`

## Finalizer behavior

- `/api/tiktokshop-crawler/db` now probes CDP for running jobs and finalizes the active job immediately when CDP is unavailable.
- Duplicate Seller Center / target capture requests also probe the existing job. If CDP is already unavailable, the job is finalized instead of staying blocked as a real active job.
- Promise-level Seller Center crawl errors normalized to `cdp_unavailable` use the same finalizer.
- Finalized jobs expose:
  - `status: partial`
  - `readiness: partial`
  - `failureReason: cdp_unavailable`
  - `partialReason: cdp_unavailable`
  - `retryable: true`
  - `activeJob: false`
- When no run artifact exists, the API/status metadata includes:
  - `outputDirMissing: true`
  - `targetInventory.classification: TARGET_CAPTURE_FAILED`
  - `targetInventory.reason: cdp_unavailable_before_artifact`
  - zero counts for endpoint/raw/normalized/export
- Recovery copy now uses:
  - `Close stale browser windows opened by the app, restart app if needed, Open/Attach seller profile again, then retry.`

## Smoke results

Passed:

- `node --check app/server.mjs`
- `node --check app/tiktokshop-crawler.mjs`
- `node --check public/app.js`
- `node --check scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `npm run ui:shell-smoke`
- `npm run crawler:contract-smoke`
- `npm run crawler:fixture-smoke`
- `npm run session:restore-gate-smoke`
- `npm run audit:log-redaction-smoke`
- `npm run crawler:auto-profile-smoke`

Note: two parallel npm smoke commands initially hit a transient Windows mapped-drive `UNKNOWN` read error on `Z:`. Rerunning the failed checks sequentially with `cmd /c pushd \\wsl.localhost\Ubuntu\home\strange\.openclaw\workspace\strange-tts-pc-app` passed.

## Safety confirmations

- No cookie/token/session values are read, printed, logged, returned, or shown.
- No raw response bodies are dumped.
- Cookie/session import/export behavior was not changed.
- No auto crawl or auto backfill was added.
- No Seller Center data was mapped into Shop Overview cards.
- GMVMax, `data/private`, `.env`, auth, license, payment, deployment, and database migrations were not touched.
- No commit was created.

## Known limitations

- The finalizer can only react when the server observes the running job again, such as through status refresh, duplicate target capture, or the crawl promise rejecting.
- Full live validation still requires a real authenticated TikTok Seller Center browser session.

## Commit status

No commit.
