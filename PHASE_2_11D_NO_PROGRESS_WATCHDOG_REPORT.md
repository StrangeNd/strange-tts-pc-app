# P2.11D No-Progress Watchdog Report

## Bug Observed

Live target overview capture could accept a Seller Center server job and remain
`crawling` for 10+ minutes with `activeJob=true`, `cdpStatus.reachable=true`,
no `failureReason`, no `targetInventory`, empty `latestRun.summary`, and no
expected run directory under:

```text
data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/seller-center/<runId>
```

The API could also report `outputDirMissing=false` even when the expected run
folder was missing.

## Files Changed

- `app/server.mjs`
- `app/tiktokshop-crawler.mjs`
- `scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `PHASE_2_11D_NO_PROGRESS_WATCHDOG_REPORT.md`

## Watchdog Behavior

- Seller Center jobs now allocate a server run id before background capture
  begins.
- The server writes a safe early Seller Center latest marker at job acceptance:
  `mode=seller-center`, optional `target=overview`, `status=crawling`,
  `startedAt`, `updatedAt`, relative `outputDir`, and zero summary counts.
- No cookies, tokens, raw response bodies, credentials, or session values are
  written to the marker or no-progress audit payload.
- `/api/tiktokshop-crawler/db` now checks active Seller Center overview jobs for
  no-progress timeout when CDP is reachable or unknown.
- Timed-out no-progress jobs are finalized as:
  `status=partial`, `readiness=partial`, `activeJob=false`,
  `failureReason=no_progress_timeout`, `partialReason=no_progress_timeout`,
  `retryable=true`.
- The safe next action is:

```text
No progress was detected. Close stale browser windows if needed, Open/Attach seller profile again, verify session, then retry.
```

- Duplicate target overview capture requests finalize a stale no-progress active
  job first, then continue into the normal retry path instead of blocking
  forever on `activeJob=true`.

## outputDirMissing Fix

- Status refresh now inspects the exact expected Seller Center run folder for the
  active/latest run id.
- `outputDirMissing=true` means the expected run folder does not exist.
- `outputDirMissing=false` is preserved when the expected run folder exists,
  including the smoke fixture with artifact counts.
- Missing-folder no-progress finalization reports zero endpoint/raw/normalized/
  export counts and:
  `targetInventory.classification=TARGET_CAPTURE_FAILED`,
  `targetInventory.reason=no_progress_before_artifact`.

## Smoke Results

Run with `cmd /c "pushd <repo> && ..."` because Windows `cmd.exe` cannot use the
WSL UNC path as its current directory.

- `node --check app/server.mjs` passed.
- `node --check app/tiktokshop-crawler.mjs` passed.
- `node --check public/app.js` passed.
- `npm run ui:shell-smoke` passed.
- `npm run crawler:contract-smoke` passed.
- `npm run crawler:fixture-smoke` passed.
- `npm run session:restore-gate-smoke` passed.
- `npm run audit:log-redaction-smoke` passed.
- `npm run crawler:auto-profile-smoke` passed.

Additional harness check:

- `scripts/agent-healthcheck.sh` was run through
  `wsl.exe -d Ubuntu --cd /home/strange/.openclaw/workspace/strange-tts-pc-app bash scripts/agent-healthcheck.sh`.
- It passed install, production smoke, UI shell, audit redaction, crawler
  contract/policy/retention/fixture, auto-profile, session restore, and other
  harness smokes before failing on the existing extra `crawler:real-overview-smoke`
  assertion: `today should stay missing when TikTok ready_time has no today row`.
- This patch did not touch the business overview code exercised by that failing
  smoke.

## Safety Confirmations

- Did not auto crawl.
- Did not auto backfill.
- Did not map Seller Center data into Shop Overview cards.
- Did not change cookie/session import or export behavior.
- Did not touch GMVMax, `data/private`, `.env`, auth, license, payment,
  deployment, or database migration logic.
- Did not dump raw response bodies.
- Did not commit.

## Known Limitations

- The watchdog is process-local because active crawler jobs are held in memory.
  If the app process exits, only safe latest-run metadata remains for later
  status display.
- The default timeout is several minutes; tests cover the finalizer contract
  without waiting for production timeout duration.

## No Commit

No git commit was created.
