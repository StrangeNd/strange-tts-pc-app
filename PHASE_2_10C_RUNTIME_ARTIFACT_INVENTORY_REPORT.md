# Phase 2.10C - Runtime Seller Center Artifact Inventory Report

## Summary

Phase 2.10C reconciles the mismatch found in Phase 2.10B.

Phase 2.10B audited the WSL repo workspace and did not find the Seller Center completed run artifact. This phase checked the Windows local runtime data folder used by the actual PC app.

Result: the runtime artifact exists, but it does not contain enough Shop Overview core metrics to safely power fresh dashboard cards.

## Runtime Location Checked

Windows runtime app:

- `C:\Users\Stephen Strange\StrangeTTS-PC-App`

WSL path:

- `/mnt/c/Users/Stephen Strange/StrangeTTS-PC-App`

Runtime crawler data:

- `/mnt/c/Users/Stephen Strange/StrangeTTS-PC-App/data/tiktokshop-crawler`

## Latest Runtime Seller Center Pointer

Safe metadata from:

- `data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/seller-center-latest.json`

Observed:

- `runId`: `2026-06-25T15-21-30-403Z`
- `outputDir`: `seller-center\2026-06-25T15-21-30-403Z`
- `summary.apiEndpoints`: 7
- `summary.rawFiles`: 10
- `summary.normalizedRows`: 7
- `summary.exportRequests`: 0

## Runtime Artifact Inventory

Run directory:

- `data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/seller-center/2026-06-25T15-21-30-403Z`

Safe file counts:

- all files: 19
- raw files: 12
- normalized files: 2
- log files: 2
- normalized records: 7
- API log entries: 10
- action log entries: 7
- export requests: 0

Expected artifact files found:

- `crawl_report.json`
- `crawl_report.md`
- `data_dictionary.json`
- `logs/action-log.json`
- `logs/api-log.json`
- `normalized/records.json`
- `normalized/records.csv`
- `raw/export-requests.json`
- `raw/products-ui-snapshot.json`
- `snapshot-contract.json`

## Captured Endpoint Paths

Safe endpoint path inventory:

- `https://seller-vn.tiktok.com/api/v1/arch/config_center_gw/mget_config_by_app_name`
- `https://seller-vn.tiktok.com/api/v1/seller/home_task/get`
- `https://seller-vn.tiktok.com/api/v1/arch/config_center_gw/get_config`
- `https://seller-vn.tiktok.com/api/v1/product/actions/list`
- `https://seller-vn.tiktok.com/api/v1/product/local/products/list`

## Normalized Record Shape

First normalized record keys indicate task/product-card style data, including:

- `source`
- `sourcePath`
- `card_id`
- `card_status`
- `card_title`
- `card_value`
- `subtitle`
- `cta_text`
- `cta_url`
- `urgent_list.*`
- `is_active`
- `priority`
- `action`
- `extra`
- `sub_card_name`

## Core Shop Overview Metric Check

No normalized key hits were found for:

- GMV
- orders
- visitors
- impressions
- refunds
- conversion
- AOV
- score
- violation
- negative review
- cancel
- dispatch
- reply

## Classification

`INVENTORY_PARTIAL`

More specific:

`INVENTORY_RUNTIME_FOUND_BUT_OVERVIEW_NOT_READY`

Reason:

- The completed runtime Seller Center artifact exists.
- It contains raw/log/normalized files.
- However, the captured endpoints and normalized records do not contain Shop Overview core metrics.
- The artifact appears to come from a small-scope retry crawl, not a full overview/performance/health crawl.

## Interpretation

Phase 2.8 successfully proved:

- CDP recovery works.
- Seller Center crawl can be accepted.
- Crawl can complete.
- Runtime artifact can be persisted.

It did not prove:

- GMV/orders/visitors overview metrics were captured.
- health/score/violation/task metrics were captured.
- Seller Center completed run can replace Compass cache for Shop Overview cards.

## Mapping Decision

Do not connect this Seller Center run to Shop Overview cards yet.

Current artifact can support runtime artifact existence and small-scope crawler persistence validation, but it cannot safely power dashboard overview KPIs.

## Recommended Next Phase

Phase 2.11 should be:

`Targeted Seller Center Overview Capture`

Goal:

- Run an explicit, user-triggered small crawl aimed at overview/performance/health endpoints.
- Capture safe inventory for endpoints expected to provide:
  - GMV
  - orders
  - visitors
  - impressions
  - refunds
  - conversion rate
  - AOV
  - shop score
  - violations
  - task counts
- Do not auto backfill.
- Do not connect to Shop Overview cards until endpoint evidence and parser tests exist.

Expected target endpoints or modules to verify:

- Seller Center homepage/stats or overview stats endpoint
- growth center performance list
- violation overview
- task config
- novice/record task endpoint
- Compass overview endpoint if Seller Center overview stats are unavailable

## Confirmations

- No new crawl was run in this phase.
- No auto backfill was run.
- No Seller Center data was connected into Shop Overview cards.
- No raw response bodies were dumped into this report.
- No cookie/token/session/authorization/credential values were read into the report, logged, or committed.
- No screenshots/logs with secrets were committed.
- No GMVMax changes were made.
- No `data/`, `data/private`, `.env`, auth, license, payment, deployment, or database migration files were modified.
