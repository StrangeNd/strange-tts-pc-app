# Phase 2.11 - Targeted Seller Center Overview Capture Report

## Starting branch / commit

- Branch: `ai-agent/targeted-overview-capture`
- Starting commit: `f11a12a`

## Task intake

- Type: change request
- Lane: normal, medium-risk crawler/API/UI behavior
- Affected areas: Seller Center crawler, crawler route payload, TikTok Crawler workspace UI, crawler validation smokes
- Non-scope: no auto crawl, no backfill, no Shop Overview card mapping, no GMVMax changes, no cookie/session format changes
- Validation plan: syntax checks, safe fixture inventory smoke, requested crawler/UI/business/session smokes, agent healthcheck

## Files changed

- `app/server.mjs`
- `app/tiktokshop-crawler.mjs`
- `public/app.js`
- `package.json`
- `scripts/targeted-overview-inventory-smoke.mjs`
- `scripts/real-crawl-overview-smoke.mjs`
- `docs/TEST_MATRIX.md`
- `PHASE_2_11_TARGETED_OVERVIEW_CAPTURE_REPORT.md`

## Existing crawl option audit

`/api/tiktokshop-crawler/crawl` already accepted:

- `mode`
- `dateRange`
- `maxModules`
- `autoOpenProfile`
- `baseUrl`
- `cdpPort`
- `sellerId`
- `shopId`
- Compass `months`
- Seller Center crawler options including `configPath`, `dryRun`, `clickAllControls`, and `maxSafeControls`

Before this phase there was no explicit safe `target` option for a small Overview/Performance/Health source inventory. Seller Center full crawl used the configured module order, which starts with product and marketing modules, so `maxModules: 2` could miss overview/health/task source endpoints.

## Implementation added

- Added explicit Seller Center `target: "overview"` support for manual crawler requests.
- Added target module ordering for overview-relevant Seller Center pages:
  - homepage overview
  - growth performance
  - growth tasks / novice records
  - account health
  - shop score
  - Compass overview fallback
- Added safe target inventory metadata:
  - target
  - runId
  - endpoint count
  - raw file count
  - normalized record count
  - endpoint paths only, without query strings
  - metric/key hints only
  - core metric presence booleans
  - classification
- Added target inventory to Seller Center crawl reports and latest-run metadata when `target: "overview"` is used.
- Added a user-triggered TikTok Crawler UI button: `Target overview capture`.
- Added warning copy: `Chay capture nho de tim nguon metric Tong quan shop. Chua cap nhat Dashboard cards.`
- Added `scripts/targeted-overview-inventory-smoke.mjs` and npm script `crawler:target-overview-inventory-smoke`.
- Updated `scripts/real-crawl-overview-smoke.mjs` to avoid date-sensitive June 25/26 fixture rows now that the current date is June 26, 2026.

## Real targeted capture

No real targeted capture was run in this phase. Validation used sanitized local fixtures only.

Reason: the task said not to run a new real crawl unless explicitly safe and user-triggered in local runtime. This implementation adds the user-triggered path but does not perform a live authenticated crawl by itself.

Suggested manual payload:

```json
{
  "mode": "seller-center",
  "target": "overview",
  "shopId": "little-apricot-hawaii-fashion",
  "sellerId": "7494478078863902049",
  "autoOpenProfile": true,
  "dateRange": "yesterday",
  "maxModules": 2
}
```

## Safe runtime inventory summary

No new runtime artifact was produced.

Latest provided runtime artifact from Phase 2.10C remains:

- Run ID: `2026-06-25T15-21-30-403Z`
- Raw files: 10
- Normalized rows: 7
- API log entries: 10
- Core overview metric keys: not found

## Endpoint path summary

No new live endpoint paths were captured in this phase.

Previously observed endpoint families from Phase 2.10C:

- `seller/home_task/get`
- `product/actions/list`
- `product/local/products/list`
- config endpoints

No query parameters, cookies, tokens, or raw response bodies are included in this report.

## Core metric presence

| Metric | Present in latest provided runtime artifact |
| --- | ---: |
| GMV | no |
| Orders | no |
| Visitors | no |
| Impressions | no |
| Refunds | no |
| Conversion rate | no |
| AOV | no |
| Shop score | no |
| Violations | no |
| Tasks | partial endpoint family only; no mapped core task metrics |

## Result classification

`TARGET_CAPTURE_NO_CORE_METRICS`

This classification is for the latest provided runtime artifact, because no new real targeted capture was run. The new fixture smoke proves the inventory logic can classify a sanitized overview fixture as `TARGET_CAPTURE_READY` when core overview metric hints are present.

## Validation

Passed:

- `node --check app/server.mjs`
- `node --check app/tiktokshop-crawler.mjs`
- `node --check app/crawler-contract.mjs`
- `node --check public/app.js`
- `node --check scripts/targeted-overview-inventory-smoke.mjs`
- `npm run crawler:target-overview-inventory-smoke`
- `npm run ui:shell-smoke`
- `npm run gmv:max-smoke`
- `npm run crawler:contract-smoke`
- `npm run crawler:fixture-smoke`
- `npm run session:restore-gate-smoke`
- `npm run audit:log-redaction-smoke`
- `npm run business:spreadsheet-smoke`
- `npm run business:legacy-xls-scope-smoke`
- `npm run crawler:real-overview-smoke`
- `bash scripts/agent-healthcheck.sh`

Notes:

- Direct `npm run ...` from the Windows UNC path fails because `cmd.exe` cannot use UNC as cwd. Validation used `scripts/agent-wsl-run.ps1`.
- Direct `scripts/agent-healthcheck.sh` failed with permission denied because the script is not executable in this checkout. Validation used `bash scripts/agent-healthcheck.sh`.
- Healthcheck reports 2 moderate npm audit findings during install check; this phase did not change dependencies or audit policy.

## Recommended next phase

P2.12 should run the new manual targeted overview capture in the authenticated local runtime and, if `TARGET_CAPTURE_READY` or useful `TARGET_CAPTURE_PARTIAL` inventory appears, plan parser/mapping for Seller Center Overview sources.

Do not map Shop Overview dashboard cards until P2.12 has a captured source inventory with enough core metrics.

## Confirmations

- No auto crawl added.
- No auto backfill added.
- No Shop Overview mapping added.
- No GMVMax changes made.
- No cookie/token/session secret values read, printed, logged, exposed, or committed.
- No raw response bodies included in this report.
- No runtime data, raw files, API logs, screenshots, cookies, or private paths committed.
