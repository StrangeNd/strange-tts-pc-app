# US-009: Content And Affiliate Performance Metrics

## User Outcome

As a TikTok Shop operator, I can read livestream, video, and product affiliate performance from uploaded files in business analysis without the app inventing missing metrics.

## Scope

In scope:

- Recognize uploaded livestream performance files.
- Summarize video performance GMV, orders, views, rows, and top videos.
- Summarize livestream performance GMV, orders, views, duration, rows, and top livestream sessions.
- Summarize product affiliate performance GMV, orders, commission, rows, and top products/creators from affiliate files.
- Show content and affiliate totals plus top performance rows in Phan tich KD.
- Add fixture proof for video, livestream, and product affiliate performance.

Out of scope:

- Live TikTok crawling or new browser automation selectors.
- Changing existing revenue, cost, refund/cancel, or planning formulas.
- Auth, sessions, cookies, payment/billing, deployment, database migrations, secrets, or user data deletion/export/retention changes.

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

- Livestream files can be classified as `livestream`.
- Video, livestream, and product affiliate performance totals are exposed in the business analysis result.
- Missing content/affiliate sources stay missing in the UI instead of displaying invented zeroes.
- Top video, livestream, and affiliate product rows are shown when source data exists.
- Existing revenue/cost/plan formulas are not changed by this slice.
- Spreadsheet smoke proves video, livestream, and product affiliate metrics.

## Validation Plan

- Syntax: `node --check app/business-analysis.mjs`, `node --check public/app.js`, `node --check scripts/spreadsheet-smoke.mjs`
- Smoke: `node scripts/spreadsheet-smoke.mjs`
- Existing smoke: `node scripts/smoke.mjs`
- Audit: `npm audit --audit-level=high`
- UI QA: open local app and inspect Phan tich KD rendering path when possible.
- Healthcheck: `./scripts/agent-healthcheck.sh`
