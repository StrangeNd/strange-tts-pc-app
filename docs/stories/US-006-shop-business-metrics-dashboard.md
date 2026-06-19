# US-006: Shop Business Metrics Dashboard

## User Outcome

As a TikTok Shop operator, I can read Ads Spend in business analysis as separate Cash, Credit, and Ads credit components, with missing source fields shown clearly instead of being treated as zero.

## Scope

In scope:

- Split Ads Spend into Cash, Credit, direct Ads credit, prorated Ads credit, and other visible spend fields.
- Preserve missing component fields as missing in the UI.
- Keep the existing uploaded-file business analysis flow and CSV export usable.
- Add fixture proof for GMV Max ads spend component calculations.
- Record validation proof in the test matrix and PR report.

Out of scope:

- Live crawling of `ads.tiktok.com`.
- New browser automation selectors for Ads payment pages.
- Cookie/session handling, auth, permissions, payment/billing behavior, deployment, database migrations, or secrets.
- Changing the calculation settings UI beyond the existing Ads credit ratio input.

## Affected Areas

- Code: `app/business-analysis.mjs`, `public/app.js`, `public/styles.css`
- Scripts: `scripts/spreadsheet-smoke.mjs`
- Docs: `docs/TEST_MATRIX.md`, this story, PR report

## Risk Lane

Normal with targeted validation.

Risk flags:

- Business logic and data normalization.
- User-visible business analysis UI.
- Existing behavior with weak proof.

This slice does not change high-risk payment systems; it only labels and displays spend components from uploaded/local analysis data.

## Acceptance Criteria

- Business analysis summary exposes Cash, Credit, direct Ads credit, prorated Ads credit, total Ads credit, and per-component availability metadata.
- Ads Spend total is computed from available Cash, Credit, direct Ads credit, and prorated Ads credit.
- Ads credit-only rows use the configured Ads credit ratio.
- Non-GMV Max ads rows are not included in GMV Max Ads Spend totals.
- UI shows a component table with source/status and rows used.
- Missing component fields render as missing, not zero.
- CSV export includes the main Ads Spend components.
- Smoke test proves component math using local workbook fixtures.

## Validation Plan

- Syntax: `node --check app/business-analysis.mjs`, `node --check public/app.js`, `node --check scripts/spreadsheet-smoke.mjs`
- Smoke: `node scripts/spreadsheet-smoke.mjs`
- Existing smoke: `node scripts/smoke.mjs`
- Audit: `npm audit --audit-level=high`
- UI QA: open local app and inspect Phan tich KD rendering path when possible.
- Healthcheck: `./scripts/agent-healthcheck.sh`
