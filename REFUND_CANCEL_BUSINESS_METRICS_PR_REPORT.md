# Refund Cancel Business Metrics PR Report

Branch: `ai-agent/refund-cancel-business-metrics`

Target: `main`

## Task Intake

- Type: spec slice
- Lane: normal with targeted validation
- Risk: medium, limited to business metric parsing/display and fixture proof
- Affected areas: `app/business-analysis.mjs`, `public/app.js`, `scripts/spreadsheet-smoke.mjs`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: live TikTok crawling, new browser automation selectors, existing revenue formula changes, auth, sessions, cookies, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

SPEC.md lists Refund/cancel and SKU performance as core business metrics. Main branch already showed orders and top SKU revenue/cost, but did not expose refund/cancel impact from uploaded order files. This PR adds a missing-data-safe refund/cancel summary and SKU-level indicators without changing existing revenue or planning formulas.

## Implementation Summary

- Added refund/cancel source detection for order status, refund amount, and cancel amount columns.
- Added `orders.refundCancel` summary with availability, affected orders, rates, amounts, source metadata, and status breakdown.
- Added refund/cancel KPIs to the business summary contract.
- Updated Phan tich KD UI with a refund/cancel KPI card, detail panel, status breakdown table, and SKU-level refund/cancel/net revenue columns.
- Expanded spreadsheet smoke fixtures to prove refund/cancel count, amount, rate, and SKU net revenue estimate.
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
- Local API check against `http://127.0.0.1:48735/api/business/analyze`: pass; refund/cancel affected orders, amount, SKU net revenue estimate, and rebased Ads Spend total matched fixture values
- Browser/UI QA on `http://127.0.0.1:48733/`: pass; Phan tich KD view opened, file inputs visible, no console errors
- `./scripts/agent-healthcheck.sh`: pass

## Manual Validation Notes

- This PR does not crawl live TikTok data.
- Existing revenue, cost, and plan calculations are intentionally left unchanged; refund/cancel is exposed as a separate impact metric.
- No cookies, tokens, credentials, browser profile data, payment system behavior, or user data deletion/export/retention were read or modified.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
