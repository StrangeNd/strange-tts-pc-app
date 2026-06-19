# US-007: Refund And Cancel Business Metrics

## User Outcome

As a TikTok Shop operator, I can see refund/cancel impact in business analysis and SKU performance when uploaded order files contain status, refund amount, or cancel amount fields.

## Scope

In scope:

- Detect refund/cancel source fields from uploaded order files.
- Preserve refund/cancel as missing when source fields are absent.
- Show affected orders, affected rate, refund/cancel amount, refund orders, cancel orders, and status breakdown.
- Add refund/cancel and estimated net revenue columns to Top SKU performance.
- Add fixture proof for refund/cancel parsing and SKU net revenue estimate.

Out of scope:

- Changing existing revenue, plan, or profit formulas to subtract refunds/cancels.
- Live TikTok crawling or new third-party browser automation selectors.
- Auth, session, cookie, payment/billing, deployment, database migration, secrets, or user data deletion/export/retention changes.

## Affected Areas

- Code: `app/business-analysis.mjs`, `public/app.js`
- Scripts: `scripts/spreadsheet-smoke.mjs`
- Docs: `docs/TEST_MATRIX.md`, this story, PR report

## Risk Lane

Normal with targeted validation.

Risk flags:

- Business logic and data normalization.
- User-visible business analysis UI.
- Existing behavior with weak proof.

## Acceptance Criteria

- Uploaded order files with status/refund/cancel columns produce refund/cancel metrics.
- Uploaded order files without those columns leave refund/cancel metrics missing instead of zero.
- Refund/cancel affected order count and rate are derived from source status/amount fields.
- Refund/cancel amount uses explicit refund/cancel amount fields when present.
- SKU table shows refund/cancel count and estimated net revenue only when the source is available.
- Existing revenue and plan formulas are not changed by this slice.
- Smoke test proves affected orders, amount, rate, and SKU net revenue estimate.

## Validation Plan

- Syntax: `node --check app/business-analysis.mjs`, `node --check public/app.js`, `node --check scripts/spreadsheet-smoke.mjs`
- Smoke: `node scripts/spreadsheet-smoke.mjs`
- Existing smoke: `node scripts/smoke.mjs`
- Audit: `npm audit --audit-level=high`
- UI QA: open local app and inspect Phan tich KD rendering path when possible.
- Healthcheck: `./scripts/agent-healthcheck.sh`
