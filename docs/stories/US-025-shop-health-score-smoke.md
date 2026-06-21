# US-025 - Shop Health Score Smoke

## Story

As a TikTok Shop operator,
I want automated proof that Shop Health / Score keeps missing dependencies visible,
so that dashboard health numbers are not invented when crawler source data is incomplete.

## Acceptance Criteria

- A synthetic Seller Center fixture can produce a shop overview with `healthCenter`.
- Shop Score and violation summary render from violation overview data when available.
- Violation rows preserve title/type, status tag, count, and source.
- Product Satisfaction dependencies render separately and compute only when both source metrics exist.
- Fulfillment and Logistics remains unavailable when seller fault cancellation rate is missing.
- Missing health dependencies remain `null`/missing, not zero.
- Customer Service displays component metrics only and does not invent a score.

## Validation

- `node --check app/business-analysis.mjs`
- `node --check scripts/shop-health-score-smoke.mjs`
- `node scripts/shop-health-score-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
