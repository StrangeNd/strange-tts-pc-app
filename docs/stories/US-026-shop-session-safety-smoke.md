# US-026 - Shop Session Safety Smoke

## Story

As a TikTok Shop operator,
I want automated proof that Seller Ads opens pass through the shop/profile confirmation screen,
so that wrong-shop and future session-restore states do not accidentally launch the selected profile.

## Acceptance Criteria

- The five confirmation statuses remain present: Correct shop, Wrong shop, Not logged in, Needs re-login, and Needs session restore.
- Wrong shop and Needs session restore remain blocked from opening Seller Ads automatically.
- Correct shop, Not logged in, and Needs re-login remain allowed to open the selected profile for manual operator action.
- Confirmation metadata is stored in browser `localStorage` under the selected shop key.
- Confirmation metadata contains only shop/profile/status fields and no cookie, token, credential, authorization, machine ID, license, header, or private session payload field.
- Quick dropdown, shop-list Seller Ads buttons, and create-shop flow all route through the confirmation screen.
- The direct Seller Ads open call is only reachable from the gated `opensProfile` confirmation branch.

## Validation

- `node --check public/app.js`
- `node --check scripts/shop-session-safety-smoke.mjs`
- `node scripts/shop-session-safety-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
