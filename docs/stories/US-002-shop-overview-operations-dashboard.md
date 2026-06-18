# US-002: Shop Overview Operations Dashboard

## User Outcome

As a TikTok Shop operator, I can open the local PC app Dashboard and immediately see the selected shop/profile, crawler data status, last crawl timestamp, KPI cards, metric sources, missing metric states, and next operational actions.

## Scope

In scope:

- Read normalized local crawler data for shop overview.
- Show selected shop/profile and Seller ID where available.
- Show cached/missing crawler status without inventing metrics.
- Let the operator switch common date ranges exposed by crawler data.
- Link directly to TikTok Crawler, Business Analysis, Checklist, and the extension dashboard.

Out of scope:

- Running crawler automatically.
- Cookie/session restore, import/export, or browser profile changes.
- Auth, payment, billing, license enforcement, cloud sync backend, deployment, or database migrations.
- New business formulas beyond existing normalized crawler overview logic.

## Affected Areas

- Product docs: `docs/TEST_MATRIX.md`
- Code: `app/business-analysis.mjs`, `app/server.mjs`, `public/app.js`, `public/styles.css`
- Data: read-only local crawler data under `data/tiktokshop-crawler/`
- Scripts: existing validation scripts only

## Risk Lane

Normal.

Risk flags:

- Public API contract.
- Desktop/window/runtime shell behavior.
- Existing behavior with weak proof.

## Acceptance Criteria

- Dashboard loads a shop overview from local normalized crawler data when available.
- Dashboard clearly says when no crawler data exists.
- KPI cards and metric table show missing data visibly.
- Each metric row includes source/status.
- Dashboard exposes last crawl timestamp where crawler metadata exists.
- Dashboard range tabs switch visible KPI ranges without reloading the page.
- Important existing button IDs in `public/index.html` remain present.

## Validation Plan

- Syntax: `node --check public/app.js`, `node --check app/server.mjs`, `node --check app/business-analysis.mjs`, `node --check scripts/smoke.mjs`
- Healthcheck: `./scripts/agent-healthcheck.sh`
- Unit/integration: local API call to `/api/business/shop-overview`
- Browser/platform: local browser QA for Dashboard range switching and action buttons
- Manual evidence: `SHOP_OVERVIEW_OPERATIONS_DASHBOARD_PR_REPORT.md`

## Agent Notes

- This story intentionally reuses existing crawler overview builders instead of introducing new formulas.
- Live authenticated TikTok crawl may remain manual because crawler validation requires a logged-in local profile.
