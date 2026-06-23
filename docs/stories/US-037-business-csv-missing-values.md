# US-037 - Business CSV Missing Values

## Story

As a TikTok Shop operator,
I want exported business-plan CSV files to preserve unavailable metrics as missing,
so that a downloaded plan does not turn absent Ads Spend, refund/cancel, content, affiliate, or KPI inputs into fake zero values.

## Acceptance Criteria

- Business plan CSV export writes `missing` for unavailable KPI, Ads Spend, refund/cancel, content, affiliate, and break-even ROI values.
- Explicit source-provided zero values still export as `0` or the correct zero-formatted rate/decimal.
- Backend calculation rules remain unchanged; this story only hardens browser-side CSV presentation.
- No auth, session, cookie, payment/billing, deployment, database migration, or production behavior changes.

## Validation

- `node --check public/app.js`
- `node --check scripts/business-csv-missing-smoke.mjs`
- `node scripts/business-csv-missing-smoke.mjs`
- `node scripts/ads-spend-missing-smoke.mjs`
- `node scripts/spreadsheet-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
