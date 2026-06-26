# Phase 2.10B - Seller Center Source Inventory Report

## Starting branch/commit

- Branch: `ai-agent/seller-center-source-inventory`
- Commit: `fbbf705`
- Base check: `ai-agent/freshness-gap-transparency` is ancestor/current.
- Starting status: only `?? .agent-runs/` was present before report work.

## Scope and classification

- Intake type: maintenance request / audit report.
- Risk lane: tiny-to-normal, read-only crawler inventory plus one report file.
- App code changes: none.
- Helper scripts: none.
- Classification: `INVENTORY_METADATA_ONLY`.

Reason: the local workspace does not contain the requested Seller Center run `2026-06-25T15-21-30-403Z`, and the latest Seller Center pointer/run found in `data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/` has no captured raw files, no logs, no snapshot contract, and no normalized records. The available completed/usable metric source is the Compass cache, not a Seller Center completed run.

## Files changed

- `PHASE_2_10B_SELLER_CENTER_SOURCE_INVENTORY_REPORT.md`

No app code, route, crawler engine, cache, `data/`, `data/private`, GMVMax, auth, license, payment, deployment, or database migration files were changed.

## Safe inventory summary

Code inspection shows Seller Center deep crawl storage is intended to live under:

- `data/tiktokshop-crawler/shops/<shopId>/seller-center/<runId>/`
- `data/tiktokshop-crawler/shops/<shopId>/seller-center-latest.json`

Expected per-run files, when a crawl completes:

- `snapshot-contract.json`
- `crawl_report.json`
- `crawl_report.md`
- `logs/api-log.json`
- `logs/action-log.json`
- `raw/*`
- `raw/export-requests.json`
- `normalized/records.json`
- `normalized/records.csv`
- `data_dictionary.json`

The local workspace has one shop directory:

- `little-apricot-hawaii-fashion`

The requested run was not found:

- `2026-06-25T15-21-30-403Z`: not present under `data/tiktokshop-crawler`.

The latest Seller Center pointer found:

- File: `data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/seller-center-latest.json`
- Run ID: `2026-06-22T19-59-51-410Z`
- Status in pointer: `running`
- Output dir: `seller-center\2026-06-22T19-59-51-410Z`
- Summary in pointer: `apiEndpoints: 0`, `rawFiles: 0`, `normalizedRows: 0`, `exportRequests: 0`

All Seller Center run directories found are empty of files. They contain no `crawl_report.json`, no `snapshot-contract.json`, no logs, no raw payload files, and no normalized records.

## Latest Seller Center run metadata

| Field | Value |
| --- | --- |
| Shop | `little-apricot-hawaii-fashion` |
| Latest pointer run ID | `2026-06-22T19-59-51-410Z` |
| Requested run ID | `2026-06-25T15-21-30-403Z` |
| Requested run present | No |
| Latest completed Seller Center run present | No completed run found |
| Pointer status | `running` |
| Pointer startedAt | `2026-06-22T19:59:51.414Z` |
| Pointer date range | `2026-06-21 -> 2026-06-21` |
| Raw files | `0` |
| Normalized rows | `0` |
| API endpoints | `0` |
| Export requests | `0` |

Seller ID was only observed as metadata presence in the pointer path/reporting context. No cookie, token, authorization header, credential, raw response body, or session payload was printed into this report.

## Safe counts

### Seller Center latest pointer/run

| Count | Value |
| --- | ---: |
| Seller Center run directories | 20 |
| Requested `2026-06-25T15-21-30-403Z` directories | 0 |
| Completed Seller Center run reports | 0 |
| Snapshot contracts | 0 |
| Raw files in selected latest run | 0 |
| Normalized files in selected latest run | 0 |
| Log files in selected latest run | 0 |
| API log entries in selected latest run | 0 |
| Action log entries in selected latest run | 0 |
| Normalized rows in selected latest run | 0 |
| Data dictionary fields in selected latest run | 0 |
| Captured endpoint paths in selected latest run | 0 |
| Captured modules in selected latest run | 0 |

### Compass cache found locally

| Field | Value |
| --- | --- |
| File | `data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/compass-overview-db.json` |
| DB updatedAt | `2026-06-10T14:29:56.767Z` |
| Months present | `2026-04`, `2026-05` |
| Latest local month | `2026-05` |
| Latest month crawledAt | `2026-06-10T14:29:56.731Z` |
| Latest month readyTime | `2026-06-09` |
| Latest aggregate rows | 1 |
| Latest daily rows | 31 |
| Latest raw files referenced | `raw\2026-05-aggregate.json`, `raw\2026-05-daily.json` |
| Metric IDs present | `4024`, `4029`, `4033`, `4037`, `4042`, `4045`, `7816`, `7821`, `7822`, `7973`, `7974` |

Note: the task handoff mentions `compass-2026-06`, but the local workspace evidence on this branch shows latest Compass cache as `compass-2026-05`.

## Available metric/source table

| Shop Overview metric | Seller Center completed run | Seller Center latest local metadata | Compass cache | Notes |
| --- | --- | --- | --- | --- |
| GMV | Not found | No raw/normalized data | Available from Compass metric `4024` | Compass-only in this workspace. |
| Orders | Not found | No raw/normalized data | Not available | Seller Center `homepage/stats` would be expected, but no captured endpoint exists. |
| Visitors | Not found | No raw/normalized data | Not available | Seller Center `homepage/stats` would be expected, but no captured endpoint exists. |
| Impressions | Not found | No raw/normalized data | Not available | No Seller Center normalized field or endpoint captured. |
| Refunds | Not found | No raw/normalized data | Not available | No Seller Center normalized field or endpoint captured. |
| Conversion rate | Not found | No raw/normalized data | Not directly available | Would be computed from orders and visitors; inputs missing. |
| AOV | Not found | No raw/normalized data | Not safely available | Needs GMV and orders; orders missing. |
| Shop score | Not found | No raw/normalized data | Not available | Expected from Seller Center health/growth endpoints; none captured. |
| Violations | Not found | No raw/normalized data | Not available | Expected from `/seller/growth_center/violation/overview/get`; none captured. |
| Task counts | Not found | No raw/normalized data | Not available | Expected from task/novice endpoints; none captured. |
| Content Video GMV | Not found | No raw/normalized data | Available | Compass metric `4037`. |
| Product Card GMV | Not found | No raw/normalized data | Available | Compass metric `4033`. |
| Live GMV | Not found | No raw/normalized data | Available | Compass metric `4029`. |
| Affiliate/Seller GMV split | Not found | No raw/normalized data | Available | Compass metrics `7821`, `7822`, plus related affiliate breakdown IDs. |

## Missing metric/source table

| Missing item | Blocking evidence | Needed source/mapping |
| --- | --- | --- |
| Seller Center completed run `2026-06-25T15-21-30-403Z` | No matching directory found under `data/tiktokshop-crawler`. | Locate/import the completed run artifact or rerun later only with explicit user action. |
| Completed Seller Center report | All local Seller Center run dirs have zero files and no `crawl_report.json`. | A completed `crawlSellerCenterDeep` output. |
| Raw file inventory | Latest local run has `rawFiles: 0`; run directory contains no files. | Captured and scrubbed raw API/UI snapshot files. |
| Normalized rows | Latest local run has `normalizedRows: 0`; no `normalized/records.json`. | Normalizer output from captured Seller Center responses. |
| Modules/endpoints captured | Latest local run has `apiEndpoints: 0`; no `logs/api-log.json`. | `logs/api-log.json` from a successful deep crawl. |
| Overview endpoint mapping | No `/seller_center/homepage/stats` endpoint in any available run. | Captured endpoint plus parser mapping for `gmv`, `orders_cnt`, `visitors_cnt`, impression/refund-like fields. |
| Health/score mapping | No growth center performance or violation endpoints in available run. | Captured `/seller/growth_center/performance/list` and `/seller/growth_center/violation/overview/get`. |
| Task mapping | No task/novice endpoints in available run. | Captured `/seller/tasks/config/get` and `/seller/growth_center/novice/record/get`. |
| Fresh cards from Seller Center | No completed Seller Center normalized overview metrics. | Implement only after a real completed run with endpoint evidence is present. |

## Mapping gap preventing Shop Overview fresh cards

The immediate blocker is not only a code mapping gap; it is a source inventory gap in this workspace:

1. The requested completed Seller Center run is absent locally.
2. The latest Seller Center pointer is stale/incomplete-looking: `status: running`, `summary.rawFiles: 0`, `summary.normalizedRows: 0`.
3. The selected latest run directory contains only empty subdirectories (`logs`, `normalized`, `raw`) and no files.
4. There is no `logs/api-log.json`, so no safe endpoint path inventory exists for Seller Center.
5. There is no `normalized/records.json`, so no normalized Seller Center overview metric rows exist.
6. Shop Overview sorting still prefers a valid cached Compass overview when present; Compass has GMV breakdown metrics but lacks core Seller Center cards such as orders, visitors, refunds, health, violations, and tasks.
7. The Seller Center builder code can construct placeholder/zero-like cards from empty stats when `ok:false`; those should not be treated as real inventory evidence.

Therefore Shop Overview cannot safely switch from cached Compass to Seller Center completed run data in this local state.

## Audit answers

1. Latest Seller Center run storage:
   `data/tiktokshop-crawler/shops/little-apricot-hawaii-fashion/seller-center/2026-06-22T19-59-51-410Z`, pointed to by `seller-center-latest.json`.

2. Files/records for `2026-06-25T15-21-30-403Z` or latest completed run:
   `2026-06-25T15-21-30-403Z` was not found. No latest completed Seller Center run was found. The latest pointer run has zero files in its run tree.

3. Safe counts:
   raw files `0`; normalized rows `0`; modules/endpoints captured `0`; metric keys available from Seller Center `0`. Compass cache has 11 metric IDs and 31 latest-month daily rows for local month `2026-05`.

4. Shop Overview core metrics present:
   Seller Center completed run: none present. Compass cache: GMV and GMV breakdown only; no orders, visitors, impressions, refunds, conversion rate, AOV, shop score, violations, or task counts.

5. Direct Seller Center vs Compass cache:
   Direct Seller Center completed run data is not available in this workspace. GMV-related metrics are only from Compass cache.

6. Mapping gap:
   The code expects Seller Center endpoints such as `/seller_center/homepage/stats`, growth center performance/violation endpoints, and task endpoints, but the local inventory has no completed run logs/raw/normalized records from which to map them.

7. Safest next implementation plan:
   Do not wire Shop Overview cards to Seller Center yet. First reconcile or provide the missing completed run artifact, then run a read-only inventory against that artifact, then add fixture-backed parser tests before changing overview source selection.

## Recommended next phase

Recommended classification-dependent next phase:

`Phase 2.10C - Seller Center completed-run artifact reconciliation`

Suggested plan:

1. Reconcile the handoff mismatch: confirm where `2026-06-25T15-21-30-403Z` is stored, or whether it exists outside this workspace.
2. If the artifact is provided locally, inventory only safe metadata first: file names, sizes, endpoint paths, report summary, normalized row count, data dictionary paths.
3. Confirm whether `/seller_center/homepage/stats`, growth center performance, violation overview, task config, and novice record endpoints exist.
4. Create sanitized fixtures from non-secret structures only if parser coverage is needed.
5. Only after source proof exists, implement a small parser/mapping layer for available Seller Center metrics.
6. Add tests that assert missing metrics remain missing and that no raw body/secrets appear in logs or reports.
7. Then update Shop Overview source selection so Seller Center fresh overview can outrank Compass cache when it has enough normalized core cards.

## Confirmations

- No new crawl was run.
- No auto backfill was run.
- No Seller Center data was connected into Shop Overview cards.
- No crawler engine rewrite was made.
- No route/API path changes were made.
- No raw response bodies were dumped into this report.
- No cookie/token/session/authorization/credential values were read into the report, logged, or committed.
- No screenshots/logs with secrets were committed.
- No GMVMax changes were made.
- No `data/`, `data/private`, `.env`, auth, license, payment, deployment, or database migration files were modified.
- No formatter was run across the repo.
- No commit was made.

