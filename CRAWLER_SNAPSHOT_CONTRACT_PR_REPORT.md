# Crawler Snapshot Contract PR Report

Branch: `ai-agent/crawler-snapshot-contract`

Target: `main`

## Task intake

- Type: spec slice
- Lane: normal with stronger validation
- Risk: medium, limited to crawler output contract and local fixture proof
- Affected areas: `app/crawler-contract.mjs`, `app/tiktokshop-crawler.mjs`, `scripts/crawler-contract-smoke.mjs`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: live TikTok crawling, new crawler selectors, automatic scheduling, deletion/retention cleanup, existing raw data migration, cookie/session restore, cookie import/export changes, auth, payment, billing, license enforcement, deployment, database migrations, secrets, remote upload

## Why this task

SPEC.md requires crawler output to separate raw snapshots from normalized metrics, scrub sensitive data, preserve missing data, and document validation limits when authenticated profiles are unavailable. This PR adds that contract and a local smoke proof without running live TikTok crawling.

## Implementation summary

- Added `app/crawler-contract.mjs` with snapshot contract generation, crawler payload scrubbing, URL/text sanitization, and normalized metric helper.
- Scrubbed Seller Center raw API responses, request post data, API logs, action logs, export request logs, and UI snapshots before writing.
- Added `snapshot-contract.json` for Seller Center crawl runs.
- Added Compass snapshot contract metadata and scrubbed Compass raw response files.
- Added `scripts/crawler-contract-smoke.mjs` to verify fake cookie/token/auth/session/device secrets are removed while metric values remain usable.
- Updated story and test matrix evidence.

## Validation results

- `node --check app/crawler-contract.mjs`: pass
- `node --check app/tiktokshop-crawler.mjs`: pass
- `node --check app/server.mjs`: pass
- `node --check scripts/crawler-contract-smoke.mjs`: pass
- `node --check scripts/smoke.mjs`: pass
- `node scripts/crawler-contract-smoke.mjs`: pass
- `node scripts/smoke.mjs`: pass, production smoke in licensed mode
- `node scripts/security-scan.mjs`: pass
- `npm audit --audit-level=high`: pass; only moderate `uuid`/`exceljs` remains
- `git diff --check`: pass
- Added replacement/mojibake characters in diff: none found
- `./scripts/agent-healthcheck.sh`: pass, production smoke in unlicensed mode

## Manual validation notes

- Live TikTok crawl was not run because it requires an authenticated local TikTok Shop profile.
- This PR does not delete, prune, migrate, or upload existing crawler raw data.
- Retention policy is recorded as manual only.
- Secret-scrubbing proof uses synthetic fixture values only; no real cookies/tokens/credentials were read or printed.

## PR checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
