# Phase 1 Business/Crawler Data Health Report

Branch: `ai-agent/business-crawler-data-health-flow`

## Scope

- Frontend/status rearrangement only.
- Improved `Phan tich KD` UX around data-health flow.
- Improved `TikTok Crawler` UX around selected shop/profile, safe metadata,
  current state, latest run, and failure/partial reason.

## Files Changed

- `public/app.js`
  - Added frontend-only helper renderers for data-health bands, warning panels,
    next actions, and crawler state cards.
  - Added safe selected-shop metadata display from existing public shop metadata:
    cookie count, cookie storage status, cookie updated timestamp, login note.
  - Reworked `Phan tich KD` input view into upload data and calculation-setting
    steps.
  - Reworked `Phan tich KD` result view into basic health, missing/warning,
    KPI, next action, and advanced detail areas.
  - Reworked active `TikTok Crawler` view into selected shop/profile, safe
    cookie/session metadata, current crawler state, latest run, failure reason,
    basic controls, basic Compass metrics, and advanced technical detail.
- `public/styles.css`
  - Added styles for data-health bands, flow steps, warning panels, advanced
    detail grids, crawler state cards, crawler status panels, and failure
    reason panels.

## Protected Areas

- GMVMax Dashboard was not modified.
- API route paths and endpoint names were not changed.
- Shell button IDs were not changed.
- No backend crawler engine changes were made.
- No session restore, cookie import/export format, auth, license, payment,
  billing, deployment, database, migration, or extension changes were made.

## Smoke Results

Passed:

- `node --check public/app.js`
- `node scripts/ui-shell-smoke.mjs`
- `node scripts/spreadsheet-smoke.mjs`
- `npm run crawler:fixture-smoke` via WSL repo path
- `npm run gmv:max-smoke` via WSL repo path
- `git diff --check -- public/app.js public/styles.css`

Environment note:

- Direct `npm run ...` from the Windows PowerShell UNC working directory failed
  for multiple scripts because `cmd.exe` does not support UNC current
  directories and defaulted to `C:\Windows`.
- The same underlying smoke scripts passed when run directly with `node` from
  the UNC workspace or through WSL where available.
- Two long-running WSL npm sessions for UI/business smoke hit WSL service
  connection errors, so those two were re-run directly with `node` and passed.

## Real-Data Validation

Not validated in this phase.

Remaining manual checks:

- Run the Windows local installed app folder, not the WSL UNC repo.
- Select the intended shop/profile.
- Confirm the visible TikTok account matches the selected shop.
- Run a current-month Compass crawl with `autoOpenProfile`.
- Verify the refreshed overview and `Phan tich KD` show uploaded, crawler,
  missing, and computed states correctly.
- Leak-scan outputs/reports for cookie/token/session/authorization patterns.

## Secret Safety

- No cookies, tokens, credentials, authorization headers, session payloads,
  machine IDs, license keys, `.env` values, or private runtime data were added
  to code or reports.
- The crawler UI displays only existing safe metadata such as cookie count,
  storage status, and timestamp.
- `.agent-runs/` remains untracked and was not modified by this implementation.

## Notes

- This phase intentionally did not change KPI formulas or crawler collection
  behavior.
- The next phase should validate this UX with real shop data and then decide
  whether backend status fields are needed.
