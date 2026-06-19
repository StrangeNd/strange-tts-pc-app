# Content Affiliate Performance PR Report

Branch: `ai-agent/content-affiliate-performance-metrics`

Target: `main`

## Task Intake

- Type: spec slice
- Lane: normal with targeted validation
- Risk: medium, limited to uploaded-file business metric parsing/display and fixture proof
- Affected areas: `app/business-analysis.mjs`, `public/app.js`, `scripts/spreadsheet-smoke.mjs`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: live TikTok crawling, browser automation selectors, existing revenue/cost/plan formula changes, auth, sessions, cookies, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

SPEC.md lists livestream performance, video performance, and product affiliate performance as core business metrics. Main already had partial video/creator totals, but did not classify livestream files or expose product affiliate performance clearly. This PR adds missing-data-safe content and affiliate performance summaries from uploaded files.

## Implementation Summary

- Added `livestream` as a supported business file type and classifier target.
- Extended content summarization for livestream sessions, including GMV, orders, views, duration, rows, and top sessions.
- Extended affiliate summarization with a `performance` contract for GMV, orders, commission, rows, source status, and top products/creators while preserving sample/shipping cost behavior.
- Updated Phan tich KD to show video, livestream, creator, and product affiliate totals plus top content/affiliate tables.
- Expanded spreadsheet smoke fixtures to prove video, livestream, and product affiliate metrics.
- Updated story and test matrix evidence.

## Validation Results

- Passed: `node --check app/business-analysis.mjs`
- Passed: `node --check public/app.js`
- Passed: `node --check scripts/spreadsheet-smoke.mjs`
- Passed: `node scripts/spreadsheet-smoke.mjs`
- Passed: `node scripts/smoke.mjs`
- Passed: `node scripts/security-scan.mjs`
- Passed: `npm audit --audit-level=high`
  - Existing moderate `uuid`/`exceljs` advisory remains below the high gate.
- Passed: `git diff --check`
- Passed: replacement-character diff check
- Passed: local API workbook check at `http://127.0.0.1:48739/api/business/analyze`
  - Confirmed `videoGmv=40000`, `livestreamGmv=90000`, `affiliateGmv=70000`, `affiliateCommission=7000`.
- Passed: in-app browser QA at `http://127.0.0.1:48739/`
  - Opened `Phan tich chi so kinh doanh`, confirmed file inputs and submit action render, console error count `0`.
- Passed: `./scripts/agent-healthcheck.sh`

## Manual Validation Notes

- This PR does not crawl live TikTok data.
- Existing revenue, cost, refund/cancel, and plan formulas are intentionally unchanged.
- No cookies, tokens, credentials, browser profile data, payment system behavior, or user data deletion/export/retention were read or modified.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
