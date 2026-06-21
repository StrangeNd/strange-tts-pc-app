# US-029 - Daily Checklist Scope Smoke

## Story

As a TikTok Shop operator,
I want the daily operations checklist to stay scoped to the selected shop/profile and local date,
so that one shop's checklist state does not leak into another shop or another day.

## Acceptance Criteria

- Checklist storage key includes a stable prefix, selected shop/profile, and local date.
- Local date uses local year/month/day to create a stable `YYYY-MM-DD` key.
- Missing selected shop falls back to a local default profile key.
- Corrupted checklist `localStorage` returns an empty checklist instead of breaking the UI.
- Checking/unchecking items writes only the scoped checklist key.
- Reset removes only today's selected shop/profile checklist key.
- The Seller Ads action from the checklist routes through the shop/profile confirmation flow.
- The six core daily operating tasks remain present.

## Validation

- `node --check public/app.js`
- `node --check scripts/daily-checklist-scope-smoke.mjs`
- `node scripts/daily-checklist-scope-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
