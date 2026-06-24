# Modify Repo Plan

Generated for Phase 0B audit on 2026-06-24. This file is a planning and
handoff artifact only. Do not treat it as approval to modify high-risk runtime
areas.

## Current Status

- Branch: `plan/modify-repo-phase-0`.
- Working tree before this plan: untracked `.agent-runs/` smoke baseline
  artifacts.
- Requested phase: audit repository and create modify plan. No app code changes.
- Product domain: local PC companion app for TikTok Shop operations. In this
  repo, `TTS` means TikTok Shop, not Text-To-Speech.
- GMVMax Dashboard is stable enough to protect. Do not touch unless a clear bug
  is reproduced.
- Shop overview is usable and should receive only light polish after real-data
  validation.
- `Phan tich KD` is the main UX/UI redesign target. It has useful data logic but
  the current surface is crowded and hard to reason about.
- `TikTok Crawler` is the main control-flow stabilization target. Next work
  should make session/cookie/profile status, crawl status, and data freshness
  explicit before broader crawler expansion.
- The next product phase must validate with real Windows local app profiles,
  encrypted cookies, active TikTok sessions, and real crawler data. Existing
  smoke pass is necessary but not sufficient.

Task classification from `docs/FEATURE_INTAKE.md`: maintenance/docs planning
slice, low risk for this file. Future crawler/session/cookie work is high-risk
or high-risk-boundary and needs explicit approval plus dedicated reports.

## Smoke Baseline Result

Source: `.agent-runs/phase-0-smoke/SMOKE_BASELINE_SUMMARY.md`.

Passed smoke logs in Phase 0 baseline:

- `prod-smoke.log`: `npm run prod:smoke` passed in unlicensed mode.
- `ui-shell-smoke.log`: `npm run ui:shell-smoke` passed; 23 shell IDs and 14
  click bindings.
- `gmv-max-smoke.log`: `npm run gmv:max-smoke` passed.
- `shop-health-score-smoke.log`: `npm run shop:health-score-smoke` passed.
- `business-spreadsheet-smoke.log`: `npm run business:spreadsheet-smoke`
  passed.
- `business-csv-missing-smoke.log`: `npm run business:csv-missing-smoke`
  passed.
- `business-legacy-xls-scope-smoke.log`: `npm run
  business:legacy-xls-scope-smoke` passed.
- `crawler-contract-smoke.log`: `npm run crawler:contract-smoke` passed.
- `crawler-contract-policy-smoke.log`: `npm run
  crawler:contract-policy-smoke` passed.
- `crawler-retention-contract-smoke.log`: `npm run
  crawler:retention-contract-smoke` passed.
- `crawler-fixture-smoke.log`: `npm run crawler:fixture-smoke` passed.
- `audit-log-redaction-smoke.log`: `npm run audit:log-redaction-smoke` passed.
- `session-restore-gate-smoke.log`: `npm run session:restore-gate-smoke`
  passed.
- `test-matrix-smoke.log`: `npm run test-matrix:smoke` passed; 17 rows, 17
  unique areas, 37 unique stories.

Failing smokes in this baseline:

- None found in the Phase 0 smoke summary.

Unknown or not proven by this baseline:

- Real TikTok login/session validity.
- Real Windows installed app profile availability.
- Real encrypted cookie import for current shops.
- Real Seller Center/Compass page access after TikTok login/captcha/permission
  prompts.
- Real fresh crawl with current cookies on 2026-06-24.
- Real-data UX correctness in `Phan tich KD`.
- Real-data dashboard/crawler consistency after repeated crawls.
- Performance on large crawler snapshots or large uploaded workbooks.

Important previous real-session evidence:

- `REAL_SELLER_CENTER_AUTO_PROFILE_CRAWL_PR_REPORT.md` records a previous
  Windows installed-app pass for `little-apricot-hawaii-fashion`, including
  encrypted cookie import, Compass months `2026-04`, `2026-05`, `2026-06`, GMV
  refresh, raw mapping rows, and leak-scan notes.
- That evidence is valuable but must be revalidated for the next phase because
  it depends on current local Windows profile state, current cookies, TikTok UI,
  and current session validity.

## Protected Areas

Do not touch without a reproduced bug or explicit human approval:

- GMVMax Dashboard stable flow:
  - `public/app.js`: `renderGmvMaxDashboardWorkspace`,
    `gmvMaxEntryUrl`, GMVMax profile-check actions.
  - `public/styles.css`: `.gmv-summary`, `.gmv-shop-grid`,
    `.gmv-shop-card`, `.gmv-card-actions`.
  - `scripts/gmv-max-dashboard-smoke.mjs`.
  - `GMV_MAX_SHOP_CARDS_PR_REPORT.md`.
- Routes and paths:
  - Do not rename `btnDashboard`, `btnBusinessAnalysis`,
    `btnGmvMaxDashboard`, `btnTikTokCrawler`, or other existing shell IDs.
  - Do not change `/api/business/shop-overview`,
    `/api/business/analyze`, `/api/tiktokshop-crawler/db`,
    `/api/tiktokshop-crawler/crawl`, `/api/shops/*` route paths.
- Session/cookie/secrets:
  - Do not commit `data/`, `data/private`, `data/shops`,
    `cookies.enc.json`, `cookies.json`, `.env`, tokens, session payloads, or
    runtime profiles.
  - Do not add plaintext cookie export.
  - Do not implement Authorized Local Session Restore in a mixed UI/crawler PR.
- License/auth/payment/deployment/database:
  - `app/license.mjs`, `app/auth.mjs`, release/deployment scripts, database or
    migration state, payment/billing/permissions behavior.
- Extension runtime:
  - `extension/` should remain a compatibility surface unless the task
    explicitly targets the bundled extension.
- Raw crawler data:
  - Do not delete, prune, upload, or migrate existing raw crawler captures
    unless a dedicated approved data-retention task says so.

## Editable Areas

Safe or preferred edit areas for the next phase, with scope limits:

- UX/UI copy and layout for `Phan tich KD` and `TikTok Crawler`:
  - `public/app.js`
  - `public/styles.css`
  - Keep `public/index.html` route/button IDs stable.
- Business-analysis presentation and missing-data clarity:
  - `public/app.js`
  - `app/business-analysis.mjs` only for bounded data-health/status changes,
    not formula rewrites without tests.
- Crawler status and real-data validation controls:
  - `public/app.js`
  - `app/server.mjs`
  - `app/tiktokshop-crawler.mjs`
  - `app/crawler-contract.mjs`
  - Treat session/cookie boundary as high risk.
- Smoke and validation scripts:
  - `scripts/*smoke.mjs`
  - `scripts/agent-healthcheck.sh`
  - Add real-data validation helpers that print metadata only.
- Documentation/handoff:
  - `docs/TEST_MATRIX.md`
  - `docs/stories/`
  - PR reports
  - `MODIFY_REPO_PLAN.md`

## File Map

### GMVMax Dashboard

- `public/index.html`: `btnGmvMaxDashboard` shell entry.
- `public/app.js`: `renderGmvMaxDashboardWorkspace`,
  `gmvMaxEntryUrl`, `data-gmv-profile-check`, `data-gmv-open-extension`,
  `bindClick('#btnGmvMaxDashboard', renderGmvMaxDashboardWorkspace)`.
- `public/styles.css`: GMV card/grid classes around `.gmv-*`.
- `scripts/gmv-max-dashboard-smoke.mjs`: static contract for GMVMax buttons,
  profile confirmation, loaded shop count, empty state, and no speech behavior.
- `docs/stories/US-012-gmv-max-shop-cards.md`,
  `GMV_MAX_SHOP_CARDS_PR_REPORT.md`.

Status: protected. Only fix if a real bug appears.

### Tong Quan Shop / Shop Overview

- `public/app.js`: `renderDashboardWorkspace`,
  dashboard range tabs, metric-source table, shop health section, realtime crawl
  button, dashboard links to crawler and business analysis.
- `app/server.mjs`: `GET /api/business/shop-overview`.
- `app/business-analysis.mjs`: `buildAllShopOverviewsFromCrawler`,
  `buildShopOverviewFromCrawler`, Compass DB selection, range/card builders,
  health center builders, raw Compass mapping rows.
- `app/tiktokshop-crawler.mjs`: writes Compass DB and Seller Center latest data
  used by overview.
- `docs/stories/US-002-shop-overview-operations-dashboard.md`,
  `SHOP_OVERVIEW_OPERATIONS_DASHBOARD_PR_REPORT.md`,
  `REAL_SELLER_CENTER_AUTO_PROFILE_CRAWL_PR_REPORT.md`.

Status: mostly OK. Polish lightly after real-data verification.

### Phan Tich KD / Business Analysis

- `public/index.html`: `btnBusinessAnalysis`.
- `public/app.js`: `renderBusinessAnalysisWorkspace`,
  `buildBusinessPayload`, `renderBusinessResult`,
  `renderBusinessDataContext`, `renderAdsSpendComponents`,
  `renderRefundCancelBreakdown`, CSV export helpers.
- `app/server.mjs`: `POST /api/business/analyze`.
- `app/business-analysis.mjs`: upload ingest, CSV/TSV/TXT/XLSX parsing,
  order/refund/cancel summary, GMVMax ads spend matching, content/livestream,
  affiliate, product catalog, metrics, rules, and plan generation.
- `scripts/spreadsheet-smoke.mjs`,
  `scripts/business-csv-missing-smoke.mjs`,
  `scripts/ads-spend-missing-smoke.mjs`,
  `scripts/legacy-xls-scope-smoke.mjs`.
- Reports/stories:
  - `SHOP_BUSINESS_METRICS_DASHBOARD_PR_REPORT.md`
  - `REFUND_CANCEL_BUSINESS_METRICS_PR_REPORT.md`
  - `CONTENT_AFFILIATE_PERFORMANCE_PR_REPORT.md`
  - `BUSINESS_SPREADSHEET_HEALTHCHECK_SMOKE_PR_REPORT.md`
  - `BUSINESS_CSV_MISSING_VALUES_PR_REPORT.md`
  - `ADS_SPEND_MISSING_SMOKE_PR_REPORT.md`
  - `docs/stories/US-006-shop-business-metrics-dashboard.md`
  - `docs/stories/US-007-refund-cancel-business-metrics.md`
  - `docs/stories/US-009-content-affiliate-performance-metrics.md`

Status: editable priority. Redesign UX/data-health flow before deeper formulas.

### TikTokCrawler

- `public/index.html`: `btnTikTokCrawler`.
- `public/app.js`: `renderTikTokCrawlerWorkspace`,
  `renderTikTokCrawlerWorkspaceLegacy`, `renderCrawlerRows`,
  `renderCrawlerBusinessInsight`, `autoOpenProfile` checkbox, crawl submit.
- `app/server.mjs`: `prepareCrawlerBrowser`,
  `GET /api/tiktokshop-crawler/db`, `POST /api/tiktokshop-crawler/crawl`,
  background job path for deep crawls, audit start/done/error events.
- `app/tiktokshop-crawler.mjs`: Compass CDP queries, Seller Center deep crawl,
  raw/normalized/log writes, UI snapshots, action log, API log, database load.
- `app/crawler-contract.mjs`: scrubbers, snapshot contract, retention policy,
  missing metric helper.
- `scripts/crawl-tiktokshop-compass.mjs`,
  `scripts/tiktok-crawler-auto-profile-smoke.mjs`,
  `scripts/real-crawl-overview-smoke.mjs`,
  `scripts/crawler-contract-smoke.mjs`,
  `scripts/crawler-contract-policy-smoke.mjs`,
  `scripts/crawler-retention-contract-smoke.mjs`,
  `scripts/crawler-fixture-smoke.mjs`.
- Reports/stories:
  - `CRAWLER_DATA_STATUS_CLARITY_PR_REPORT.md`
  - `CRAWLER_SNAPSHOT_CONTRACT_PR_REPORT.md`
  - `CRAWLER_FIXTURE_SMOKE_PR_REPORT.md`
  - `CRAWLER_RETENTION_CONTRACT_PR_REPORT.md`
  - `REAL_SELLER_CENTER_AUTO_PROFILE_CRAWL_PR_REPORT.md`
  - `docs/stories/US-005-crawler-snapshot-contract.md`
  - `docs/stories/US-039-real-seller-center-auto-profile-crawl.md`

Status: editable priority, but session/cookie use is high-risk-boundary.

### Session / Cookies / Profiles

- `app/shop-library.mjs`: shop catalog, cookie parsing/import, encrypted cookie
  path, public shop metadata, Seller Ads URL builder.
- `app/crypto-store.mjs`: AES-256-GCM local JSON encryption,
  `data/private/app-secret.key`.
- `app/chrome-launcher.mjs`: runtime paths, profile paths, Chrome/Edge launch,
  extension sync, `launchChromeWithCookies`.
- `app/server.mjs`: `/api/shops/create`,
  `/api/shops/import-cookies`, `/api/shops/open-seller-ads`,
  runtime open/fetch endpoints, audit metadata.
- `public/app.js`: create shop, import cookies UI, shop quick select,
  `renderShopSessionSafety`, `SHOP_SESSION_STATUSES`, local confirmation
  metadata.
- `docs/PC_APP_USER_GUIDE.md`, `README.md`,
  `docs/decisions/ADR-004-authorized-local-session-restore-gate.md`.
- Smoke/reports:
  - `scripts/shop-profile-metadata-smoke.mjs`
  - `scripts/shop-session-safety-smoke.mjs`
  - `scripts/session-restore-gate-smoke.mjs`
  - `SHOP_PROFILE_SESSION_SAFETY_PR_REPORT.md`
  - `SHOP_PROFILE_METADATA_PR_REPORT.md`
  - `SESSION_RESTORE_GATE_SMOKE_PR_REPORT.md`

Status: high-risk. Observe and validate only unless explicit approval covers the
exact change.

### Smoke Tests

- `package.json`: npm scripts for start/app/desktop/build/prod smoke, UI,
  crawler, business, shop, session, video, cloud, audit, security.
- `scripts/agent-healthcheck.sh`: aggregate default checks.
- `.agent-runs/phase-0-smoke/`: current Phase 0 smoke logs.
- `docs/TEST_MATRIX.md`: canonical proof map.
- `scripts/test-matrix-smoke.mjs`: test-matrix integrity guard.

Status: editable. Add targeted real-data validation without leaking secrets.

### Logging / Error Handling

- `app/audit-log.mjs`: recursive redaction, safe cookie metadata only, writes
  `data/logs/audit.ndjson`.
- `app/server.mjs`: `appendAudit` calls for license/admin/browser/shop/runtime/
  video/business/crawler events; route catch returns `{ ok:false, error }`.
- `app/tiktokshop-crawler.mjs`: API/action logs, module errors, crawl reports,
  scrubbed raw writes.
- `public/app.js`: `setOutput`, API error rendering, per-workspace catch
  blocks.
- `scripts/audit-log-redaction-smoke.mjs`.
- Reports:
  - `AUDIT_LOG_REDACTION_SMOKE_PR_REPORT.md`
  - `AUDIT_LOG_HEALTHCHECK_SMOKE_PR_REPORT.md`

Status: editable for metadata clarity, not raw sensitive data.

### Documentation / Agent Handoff

- `SPEC.md`: product authority and risk rules.
- `AGENTS.md`: repo agent instructions.
- `agents/guardrails.md`, `agents/risk-policy.md`.
- `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`,
  `docs/PRODUCT_CONTRACT.md`, `docs/product/PRODUCT_CONTRACT.md`,
  `docs/TEST_MATRIX.md`.
- `docs/stories/`: behavior packets.
- `docs/templates/pr-report.md`, `BUG_REPORT.md`, `FINAL_AGENT_RUN_REPORT.md`
  when present.
- PR reports at repo root.

Status: editable. Update when behavior, risk gates, or validation proof changes.

## Phase 0

Goal: preserve current working baseline and create an exact map before edits.

Completed in this plan:

- Read `SPEC.md`, guardrails, risk policy, feature intake, product contract,
  architecture, and test matrix.
- Read `package.json` scripts.
- Read `.agent-runs/phase-0-smoke/SMOKE_BASELINE_SUMMARY.md`.
- Mapped current smoke pass/unknown areas.
- Mapped core files for GMVMax, shop overview, business analysis, crawler,
  session/cookies, smoke tests, logging, and docs/handoff.

Phase 0 remaining checklist:

- Run `scripts/agent-healthcheck.sh` before any future approval PR.
- Confirm real Windows local app folder is current with this repo before
  real-data tests.
- Confirm no `.agent-runs`, `data/`, cookies, tokens, or runtime profiles are
  accidentally staged.

## Phase 1

Goal: real-data validation and UX clarity without route changes.

Recommended branch: `ai-agent/business-crawler-data-health-flow`.

Scope:

- Redesign `Phan tich KD` into an operator-first flow:
  - data sources and freshness
  - upload inputs
  - crawler-derived metrics
  - warnings/missing metrics
  - KPI/result sections
  - next actions
- Redesign `TikTok Crawler` status surface:
  - selected shop/profile
  - cookie storage metadata only
  - session confirmation status
  - auto-open profile status
  - crawl mode
  - current job status
  - latest crawl output
  - stale/missing/failed data reasons
- Add a real-data validation checklist/report template that records only safe
  metadata.
- Do not change API route paths.
- Do not rewrite business formulas or crawler engine unless a bug blocks UX
  validation.

Proof:

- Existing smoke baseline stays green.
- Browser/local app QA on Windows local folder.
- Real profile validation with current shop session, metadata only.
- Leak scan on output/log/report strings for cookie/token/session patterns.

## Phase 2

Goal: stabilize crawler/session/cookies control flow for real operation.

Recommended branch: `ai-agent/crawler-session-status-control`.

Scope:

- Improve crawler status model and UI state transitions:
  - idle
  - profile opening
  - waiting for login/session
  - crawling
  - partial success
  - failed auth/session
  - failed selector/API
  - saved normalized data
- Add safe backend response fields for crawl readiness and failure reason.
- Add no-secret audit metadata for crawl start/done/error.
- Add real-data validation script or documented command that uses current
  selected profile and records safe metadata only.
- Preserve existing `autoOpenProfile` behavior and manual CDP fallback.

Hard limits:

- No new cookie import/export format.
- No session restore implementation.
- No plaintext cookie/session logging.
- No route/path changes.

## Phase 3

Goal: targeted business/crawler improvements after real-data status is trusted.

Scope candidates:

- Add missing business-analysis source adapters only after UX/data-health flow
  shows exactly what users need.
- Add Ads payment/spend real-source proof if current authorized session can view
  it, with explicit no-secret logging.
- Improve large-file and large-crawler-output performance.
- Add scheduled local daily crawl only after manual crawl status is reliable and
  operator controls are clear.
- Expand docs/stories/test matrix for each accepted behavior.

Non-scope:

- Full app rewrite.
- New auth/payment/cloud backend.
- GMVMax redesign.
- Authorized Local Session Restore unless a separate approved PR is created.

## A. UX/UI

Priority:

1. `Phan tich KD`: redesign as a data-health driven workflow, not a single long
   result dump.
2. `TikTok Crawler`: make crawl/session/data state visible before more features.
3. `Tong quan Shop`: polish only after real-data validation; keep current layout
   and route.
4. GMVMax: protect.

UX acceptance:

- User can tell which shop/profile is selected before any crawl or analysis.
- User can tell whether numbers come from uploaded files, cached crawler data,
  fresh crawler data, or computed formulas.
- Missing metrics are visible and actionable.
- Crawl and analysis errors have user-facing reason labels.
- No in-app text asks the user to expose cookies/tokens/secrets.

## B. Frontend

Likely files:

- `public/app.js`
- `public/styles.css`
- `public/index.html` only if adding UI containers while preserving IDs.

Rules:

- Keep shell button IDs stable.
- Keep existing route/API paths stable.
- Do not nest card-heavy redesigns. Use clear sections, dense tables, status
  bands, and predictable controls.
- Add targeted UI smoke assertions when changing bound IDs or critical text.

## C. Backend / Data Logic

Likely files:

- `app/business-analysis.mjs`
- `app/server.mjs`
- `app/tiktokshop-crawler.mjs`
- `app/crawler-contract.mjs`

Rules:

- Preserve missing data as missing/null/unavailable.
- Add formulas only with fixture proof.
- Keep raw snapshots separate from normalized metrics.
- Keep crawler-derived API responses scrubbed.
- Do not change route paths or public payload shapes without updating stories,
  test matrix, and reports.

## D. Crawler / Session / Cookies

Likely files:

- `app/server.mjs`
- `app/tiktokshop-crawler.mjs`
- `app/shop-library.mjs`
- `app/chrome-launcher.mjs`
- `app/crypto-store.mjs`
- `public/app.js`

Rules:

- Treat as high-risk-boundary.
- Use current managed profile/cookie launcher only with explicit user-approved
  local profiles.
- Log only metadata such as shop ID, profile name, cookie count, debug port,
  run ID, status, and timestamps.
- Never print cookie values, token values, authorization headers, private
  session payloads, machine IDs, license keys, or `.env` values.
- No Authorized Local Session Restore implementation in the same phase as UI
  polish or crawler status.

## E. Test / Smoke / Real-Data Validation

Keep existing smoke:

- `npm run prod:smoke`
- `npm run ui:shell-smoke`
- `npm run gmv:max-smoke`
- `npm run business:spreadsheet-smoke`
- `npm run business:csv-missing-smoke`
- `npm run business:legacy-xls-scope-smoke`
- `npm run crawler:contract-smoke`
- `npm run crawler:contract-policy-smoke`
- `npm run crawler:retention-contract-smoke`
- `npm run crawler:fixture-smoke`
- `npm run audit:log-redaction-smoke`
- `npm run session:restore-gate-smoke`
- `npm run test-matrix:smoke`
- `scripts/agent-healthcheck.sh`

Real-data validation checklist for next phase:

- Run from Windows local production folder, not WSL UNC.
- Select the intended shop/profile in UI.
- Confirm encrypted cookie metadata exists; do not print cookie values.
- Open Seller Center/Compass using selected profile.
- Confirm visible TikTok shop/account matches intended shop.
- Run current-month Compass crawl with `autoOpenProfile`.
- Record safe metadata only:
  - shop ID/name
  - profile name
  - cookie count
  - crawl mode
  - run ID
  - month/range
  - ready date
  - rows captured
  - normalized metric availability
  - missing metrics
  - error reason if failed
- Verify `/api/business/shop-overview` uses the latest intended run.
- Verify `Phan tich KD` can distinguish uploaded-file metrics from crawler
  metrics.
- Scan output JSON/log/report for sensitive patterns:
  `cookie=`, `sessionid`, `authorization`, `bearer`, `msToken`, `x-bogus`,
  `token`, `credential`, `app-secret`, `.env`.
- Confirm no `data/`, cookies, profiles, logs, or raw crawler captures are
  staged for commit.

## F. Performance

Known performance risk areas:

- `app/business-analysis.mjs`: large XLSX/CSV ingestion and multiple summary
  passes.
- `public/app.js`: rendering large tables and full business results at once.
- `app/tiktokshop-crawler.mjs`: Compass daily loop timeout, Seller Center deep
  crawl module loops, raw snapshot size.
- `data/tiktokshop-crawler/`: raw/log retention and large local files.

Phase 1 performance target:

- Do not optimize prematurely. First add UI segmentation and data-health views.
- For large result tables, render top rows plus counts before adding full export
  views.
- Record observed real-data timings in PR report.

## G. Logging / Error Handling

Current foundation:

- `app/audit-log.mjs` redacts sensitive keys and preserves safe cookie metadata.
- `scripts/audit-log-redaction-smoke.mjs` passed in baseline.
- Crawler raw/API/action logs are scrubbed through crawler contract helpers.

Next improvements:

- Normalize crawler failure reasons for UI:
  - not logged in
  - wrong shop suspected
  - captcha/verification needed
  - no Seller Center/Compass tab
  - CDP unavailable
  - API response changed
  - partial capture
- Show safe error IDs or run IDs in UI so reports can reference them without
  exposing raw details.
- Add leak-scan step to real-data validation report.

## H. Documentation / Agent Handoff

Update docs when behavior changes:

- `docs/TEST_MATRIX.md`
- Relevant `docs/stories/US-*.md`
- PR report at repo root
- `BUG_REPORT.md` if Agent B rejects or blocks

Next handoff should include:

- Exact branch.
- Changed files.
- Smoke results.
- Real-data validation result.
- What was not validated because local profile/session was unavailable.
- Any high-risk approval context.
- No-secret confirmation.

## Risk

Main risks:

- Cross-shop profile/cookie/session mixing.
- Treating missing data as zero.
- Over-trusting smoke/fixture tests without real active sessions.
- TikTok UI/API drift breaking crawler selectors or Compass API calls.
- Leaking cookies/tokens/session/private browser state in logs, reports, UI, or
  screenshots.
- Breaking stable GMVMax dashboard while redesigning adjacent screens.
- Route/path churn breaking existing scripts and operator muscle memory.
- Large raw crawler outputs causing slow UI or noisy reports.

Risk controls:

- Keep GMVMax protected.
- Keep routes and shell IDs stable.
- Separate UX/data-health work from high-risk session restore.
- Add real-data checklist before claiming crawler/business readiness.
- Use audit/log redaction and leak scans.
- Keep changes small and phase-scoped.

## Acceptance Criteria

For this Phase 0B plan:

- `MODIFY_REPO_PLAN.md` exists.
- No app code was changed.
- File/khu vuc related to GMVMax, shop overview, business analysis,
  TikTokCrawler, session/cookies, smoke, logging, and handoff are mapped.
- Smoke pass/fail/unknown is recorded.
- Protected areas and editable areas are explicit.
- Phase 0, Phase 1, Phase 2, Phase 3 are defined.
- Sections A through H are included.
- Risk and acceptance criteria are included.
- Next-phase small tasks for Codex/Cursor are included.

For the next implementation phase:

- Existing smoke stays green.
- Real-data validation checklist is completed or explicitly marked blocked.
- No cookies/tokens/session secrets are committed, printed, or copied into
  reports.
- No route/path changes.
- No full app rewrite.
- GMVMax untouched unless a clear bug is reproduced.

## Small Tasks For Codex / Cursor In Next Phase

Recommended order:

1. Create branch `ai-agent/business-crawler-data-health-flow`.
2. Add a Phase 1 PR report/intake before coding:
   - scope: `Phan tich KD` UX/data-health and TikTokCrawler status clarity
   - non-scope: GMVMax, route changes, session restore, cookie export/import
     changes, auth/payment/deployment/database
   - risk: normal plus high-risk-boundary validation for real profile use
3. Make a UI wire map for `Phan tich KD`:
   - source status band
   - upload section
   - crawler data section
   - warning/missing metric panel
   - KPI groups
   - export/plan actions
4. Make a UI wire map for `TikTok Crawler`:
   - selected shop/profile card
   - safe cookie/session metadata
   - crawl mode controls
   - current job state
   - latest run summary
   - failure reason panel
5. Implement only frontend/status rearrangement first in `public/app.js` and
   `public/styles.css`.
6. Add or update static UI smoke only for new critical labels/states.
7. Run:
   - `node --check public/app.js`
   - `npm run ui:shell-smoke`
   - `npm run business:spreadsheet-smoke`
   - `npm run crawler:fixture-smoke`
   - `scripts/agent-healthcheck.sh`
8. Run Windows local real-data validation:
   - selected profile opens intended shop
   - current-month Compass crawl works or records clear blocked reason
   - overview refresh reads latest intended run
   - Phan tich KD shows crawler/uploaded/missing source states clearly
9. Add leak scan evidence to PR report.
10. Update `docs/TEST_MATRIX.md` and a story only if behavior/proof changed.

Absolute do-not-touch list for next phase:

- Do not modify `extension/` unless a dedicated extension task exists.
- Do not modify `app/license.mjs`, `app/auth.mjs`, release/deployment scripts,
  database/migration state, or payment/billing/permissions areas.
- Do not commit or inspect raw cookie/session secret values.
- Do not implement Authorized Local Session Restore.
- Do not rename routes, shell IDs, or existing API endpoints.
- Do not redesign GMVMax.
