# Shop Business Metrics Dashboard PR Report

Branch: `ai-agent/shop-business-metrics-dashboard`

Target: `main`

## Task Intake

- Type: spec slice
- Lane: normal with targeted validation
- Risk: medium, limited to business metric calculation/display and fixture proof
- Affected areas: `app/business-analysis.mjs`, `public/app.js`, `public/styles.css`, `scripts/spreadsheet-smoke.mjs`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: live TikTok crawling, Ads payment browser automation, auth, sessions, cookies, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

SPEC.md requires business analysis to show Ads Spend as separate Ads Credit, Credit, Cash, and other visible account payment/spend fields, while keeping missing values visible instead of inventing zeros. This PR makes that split visible in the local business analysis dashboard and locks the calculation with a workbook smoke fixture.

## Implementation Summary

- Extended Ads Spend summary output with Cash, Credit, direct Ads credit, prorated Ads credit, total Ads credit, row counts, and availability metadata.
- Added warnings when uploaded Ads Actual rows cannot be matched to GMV Max or when matched rows lack spend component columns.
- Updated the business analysis UI to show Cash, Credit, Ads credit total, match status, and a component table with source/status/row proof.
- Added Ads Spend component rows to business plan CSV export.
- Expanded `scripts/spreadsheet-smoke.mjs` with Ads Actual and GMV Max workbook fixtures proving component totals and non-GMV row exclusion.
- Updated story and test matrix evidence.

## Validation Results

- `node --check app/business-analysis.mjs`: pass
- `node --check public/app.js`: pass
- `node --check scripts/spreadsheet-smoke.mjs`: pass
- `node scripts/spreadsheet-smoke.mjs`: pass
- `node scripts/smoke.mjs`: pass, production smoke in licensed mode
- `node scripts/security-scan.mjs`: pass
- `npm audit --audit-level=high`: pass; only moderate `uuid`/`exceljs` remains
- `git diff --check`: pass
- Added replacement-character diff check: pass
- Local API check against `http://127.0.0.1:48732/api/business/analyze`: pass; Ads Spend component contract returned expected fixture values
- Browser/UI QA on `http://127.0.0.1:48732/`: pass; Phan tich KD view opened, Ads credit ratio control visible, no console errors
- `./scripts/agent-healthcheck.sh`: pass

## Manual Validation Notes

- This PR does not crawl live TikTok Ads payment pages.
- The `Other visible payment/spend fields` row is intentionally missing until a supported uploaded column or normalized crawler metric exists.
- No cookies, tokens, credentials, browser profile data, or payment system behavior were read or modified.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
