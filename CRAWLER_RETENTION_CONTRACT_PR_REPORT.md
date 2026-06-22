# Crawler Retention Contract PR Report

Branch: `ai-agent/crawler-retention-contract`

Target: `main`

## Task Intake

- Type: spec slice / crawler storage policy
- Lane: normal with stronger validation
- Risk: medium, limited to crawler snapshot contract metadata and smoke proof
- Affected areas: `app/crawler-contract.mjs`, crawler contract smoke scripts, `docs/stories/`, `docs/TEST_MATRIX.md`
- Out of scope: deleting or pruning real crawler raw data, migrations, live TikTok crawling, new crawler selectors, cookie/session restore, cookie import/export behavior, auth, payment/billing, deployment, database schema changes, remote upload

## Why This Task

`SPEC.md` requires crawler raw snapshots to be local, scrubbed, separated from normalized metrics, and governed by a retention policy. The previous crawler contract explicitly left retention manual. This PR records a local-only 30-day raw snapshot review deadline in every crawler snapshot contract without deleting data automatically.

## Implementation Summary

- Added `DEFAULT_CRAWLER_RAW_RETENTION_DAYS`.
- Added `buildCrawlerRetentionPolicy()` with local-only retention metadata.
- Updated `buildCrawlerSnapshotContract()` to include the retention policy.
- Updated crawler contract policy smoke to verify the new retention metadata.
- Added `scripts/crawler-retention-contract-smoke.mjs` for default/custom/fallback retention checks.
- Added story `docs/stories/US-031-crawler-retention-contract.md`.
- Updated `docs/TEST_MATRIX.md` crawler evidence.

## Agent B Review

- Intake review: approved. The task records policy metadata only and does not delete, migrate, expose, or upload crawler data.
- Implementation review: approved. The retention contract is local-only, records a 30-day review deadline, keeps automatic pruning disabled, and preserves scrub/raw-normalized/missing-data policies.

## Validation Results

- `node --check app/crawler-contract.mjs`: passed
- `node --check scripts/crawler-contract-smoke.mjs`: passed
- `node --check scripts/crawler-contract-policy-smoke.mjs`: passed
- `node --check scripts/crawler-retention-contract-smoke.mjs`: passed
- `node scripts/crawler-contract-smoke.mjs`: passed
- `node scripts/crawler-contract-policy-smoke.mjs`: passed
- `node scripts/crawler-retention-contract-smoke.mjs`: passed
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing `exceljs`/`uuid` audit output is moderate severity only
- `scripts/agent-healthcheck.sh`: passed through WSL
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Live TikTok crawl is not run because it requires an authenticated local TikTok Shop profile.
- This PR does not remove any existing crawler raw snapshots.
- Future cleanup automation should be a separate task with explicit local operator controls.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
