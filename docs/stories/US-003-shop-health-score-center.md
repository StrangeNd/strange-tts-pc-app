# US-003: Shop Health Score Center

## User Outcome

As a TikTok Shop operator, I can see shop health, Shop Score components, violations, source/status, timestamps, and missing dependencies without needing to understand crawler internals.

## Scope

In scope:

- Reuse normalized local crawler overview data.
- Show Shop Score and violation summary when available.
- Show Product Satisfaction, Fulfillment/Logistics, and Customer Service component dependencies.
- Show formulas and unit notes so the app does not hide assumptions.
- Show missing dependencies visibly instead of computing fake scores.
- Show violation title/type, status tag, count, and source when crawler data includes them.

Out of scope:

- Running crawler automatically.
- Adding new crawler selectors.
- Cookie/session restore, auth, payment, billing, license enforcement, cloud sync backend, deployment, database migrations, or secrets.
- Inventing Shop Score components when source metrics are missing.

## Affected Areas

- Product docs: `docs/TEST_MATRIX.md`
- Code: `app/business-analysis.mjs`, `public/app.js`, `public/styles.css`
- Data: read-only local normalized crawler overview data
- Scripts: existing validation scripts only

## Risk Lane

Normal.

Risk flags:

- Public API contract.
- Desktop/window/runtime shell behavior.
- Existing behavior with weak proof.

## Acceptance Criteria

- Dashboard includes a Shop Health / Score section.
- Shop Score and violations render with source/status when available.
- Product Satisfaction dependencies render separately from the formula.
- Fulfillment and Logistics dependencies render separately from the formula.
- Customer Service shows component metrics only and does not invent a score.
- Missing dependencies are visible.
- Violation rows show title/type, status tag, count, and source when available.

## Validation Plan

- Syntax: `node --check public/app.js`, `node --check app/business-analysis.mjs`, `node --check app/server.mjs`, `node --check scripts/smoke.mjs`
- Healthcheck: `./scripts/agent-healthcheck.sh`
- Unit/integration: local API smoke for `/api/business/shop-overview`
- Browser/platform: Dashboard UI QA for Shop Health missing-data state and navigation
- Manual evidence: `SHOP_HEALTH_SCORE_CENTER_PR_REPORT.md`

## Agent Notes

- The Customer Service formula remains incomplete per SPEC, so this story explicitly displays component metrics only.
- Formula scores are only available when all required source metrics exist.
