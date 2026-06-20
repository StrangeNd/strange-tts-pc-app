# GMV Max Shop Cards PR Report

Branch: `ai-agent/gmv-max-shop-cards`

Target: `main`

## Task Intake

- Type: spec slice
- Lane: normal
- Risk: low to medium; scoped to UI/read-only shop metadata and smoke/docs proof
- Affected areas: `public/index.html`, `public/app.js`, `public/styles.css`, `scripts/`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: live TikTok crawling, cookie/session restore, cookie import/export, auth, payment/billing, deployment, database migration, production infrastructure, and user data deletion/export/retention

## Test Matrix Mapping

| Changed flow or behavior | Matrix row | Required proof | Evidence in this PR |
| --- | --- | --- | --- |
| GMV Max workspace shows loaded shop cards and metadata readiness | GMV Max dashboard | UI shell smoke, GMV Max dashboard smoke, syntax, healthcheck, browser UI QA | `scripts/gmv-max-dashboard-smoke.mjs`; this report |

## Implementation Summary

- Added a `GMV Max` shell entry with a dedicated workspace.
- Added read-only GMV Max shop cards using existing local shop metadata.
- Cards show profile ID, Seller ID, Ads account ID, local session confirmation status, and a derived GMV Max entry URL.
- Added actions that reuse the existing profile-check and extension-dashboard flows; extension open is gated behind `Correct shop` confirmation.
- Added `scripts/gmv-max-dashboard-smoke.mjs`, `npm run gmv:max-smoke`, and healthcheck integration.
- Updated the test matrix and story evidence.

## Validation Results

- Passed: `node --check public/app.js`
- Passed: `node --check scripts/gmv-max-dashboard-smoke.mjs`
- Passed: `npm run gmv:max-smoke`
- Passed: `npm run ui:shell-smoke`
- Passed: `node scripts/smoke.mjs`
- Passed: `node scripts/security-scan.mjs`
- Passed: `npm audit --audit-level=high`
  - Existing moderate `uuid`/`exceljs` advisory remains below the high gate.
- Passed: scoped `git diff --check`
- Passed: replacement-character diff check
- Passed: `scripts/agent-healthcheck.sh`
- Passed: Edge CDP browser UI QA on `http://127.0.0.1:48757/`

## Manual Validation Notes

- The in-app browser connector was unavailable during final validation because the Node REPL browser bridge returned missing sandbox metadata, so final browser QA used Microsoft Edge CDP against a temporary local server on port `48757`.
- Confirmed the `GMV Max` menu entry appears, opens the `GMV Max dashboard` workspace, shows loaded-shop readiness counters, shows the no-shop empty state for the current local data set, and reports no console errors.
- Current local data had no loaded shops, so runtime QA covered the empty state; committed smoke covers the shop-card renderer contract and required selectors/actions.

## Risk Review

- No Text-To-Speech/audio behavior added.
- No secrets, cookies, tokens, credentials, machine IDs, license keys, or `.env` values exposed.
- No auth, payment/billing, deployment, database migration, permissions, or user data deletion/export/retention behavior changed.
- Missing Seller ID and Ads account metadata remain visible as missing.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
