# Shop Health Customer Service Dependency PR Report

Branch: `ai-agent/shop-health-customer-service-dependency`

Target: `main`

## Task Intake

- Type: change request / spec slice
- Lane: normal, bounded product calculation/display fix
- Risk: medium-low, limited to Shop Health dependency matching and existing smoke coverage
- Affected areas: `app/business-analysis.mjs`, `scripts/shop-health-score-smoke.mjs`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: crawler selector/API discovery, cookie/session restore, auth, payment/billing, deployment, database migrations, secrets, real crawler profile access, user data deletion/export/retention

## Why This Task

`SPEC.md` says Customer Service has no complete formula and should display component metrics only, including the 12-hour response rate in 30 days. The GitLab-side commit fixed a useful edge case where crawler data can provide that metric under a label-derived card rather than the expected `reply12hRate30d` key. This PR keeps that useful fix and excludes the temporary GitLab Duo handoff document from the product branch.

## Agent B Intake Review

- Approved. The change is scoped to missing-dependency fidelity for existing Shop Health behavior and does not touch high-risk session, cookie, auth, billing, deployment, or production areas.

## Implementation Summary

- Added a label-based fallback helper for Shop Health cards.
- Used the fallback to map the Customer Service `12-hour response rate in 30 days` dependency when the expected key is absent.
- Extended `scripts/shop-health-score-smoke.mjs` to assert the Customer Service dependency value is preserved from crawler data.
- Updated `docs/TEST_MATRIX.md` evidence for the Shop health / score row.

## Agent B Implementation Review

- Approved after validation. The change preserves the 12-hour response dependency from crawler data without inventing a Customer Service score.

## Validation Results

- `node --check app/business-analysis.mjs`: passed
- `node --check scripts/shop-health-score-smoke.mjs`: passed
- `node scripts/shop-health-score-smoke.mjs`: passed
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing moderate `exceljs`/`uuid` advisory remains below high threshold
- `scripts/agent-healthcheck.sh` through WSL: passed
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Browser UI QA is not required because this PR preserves existing UI behavior and tightens mapped dependency data covered by the Shop Health smoke.
- No authenticated TikTok profile, real crawler output, cookies, browser profiles, `.env` values, or production data are read.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
