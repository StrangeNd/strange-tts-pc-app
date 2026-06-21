# Ads Spend Missing Smoke PR Report

Branch: `ai-agent/ads-spend-missing-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: normal validation-only change
- Risk: medium-low, limited to synthetic business-analysis validation
- Affected areas: `scripts/ads-spend-missing-smoke.mjs`, `docs/stories/`, PR report
- Out of scope: business-analysis engine changes, UI changes, crawler selectors, live TikTok crawling, Ads payment page automation, auth, payment/billing, deployment, database migrations, cookie/session restore, secrets, user data deletion/export/retention

## Why This Task

`SPEC.md` requires Ads Spend to distinguish Cash, Credit, Ads credit, and other visible spend fields, and to show missing values instead of inventing metrics. Existing spreadsheet smoke covers available Ads Spend components. This PR adds the missing-source case: a GMV Max campaign is matched, but Cash/Credit/Ads credit columns are absent.

## Implementation Summary

- Added `scripts/ads-spend-missing-smoke.mjs`.
- Built synthetic Orders, GMV Max, and Ads actual workbooks in memory.
- Verified matched GMV Max rows without spend columns are counted but marked unavailable.
- Verified Cash, Credit, direct Ads credit, prorated Ads credit, and other visible spend field components remain present with unavailable metadata.
- Verified business analysis emits a missing Ads Spend warning and does not invent non-zero spend.
- Added story `docs/stories/US-027-ads-spend-missing-smoke.md`.

## Agent B Review

- Intake review: approved. The task adds fixture proof for an accepted business metric behavior without changing runtime logic.
- Implementation review: approved. The smoke covers the Ads Spend missing-source path and keeps the change validation-only.

## Validation Results

- `node --check app/business-analysis.mjs`: pass
- `node --check scripts/ads-spend-missing-smoke.mjs`: pass
- `node scripts/ads-spend-missing-smoke.mjs`: pass
- `node scripts/security-scan.mjs`: pass
- `npm audit --audit-level=high`: pass; existing moderate `uuid` via `exceljs` remains
- `scripts/agent-healthcheck.sh`: pass via WSL
- `git diff --check`: pass
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- This is a synthetic fixture smoke only; no live TikTok Ads page crawl was run.
- No cookies, tokens, credentials, browser profiles, active TikTok sessions, or private session material are read, written, restored, exported, or inspected.
- `docs/TEST_MATRIX.md` is intentionally left untouched in this PR to avoid overlapping with currently open validation PRs.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
