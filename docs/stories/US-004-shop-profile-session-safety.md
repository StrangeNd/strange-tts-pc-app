# US-004: Shop Profile Session Safety

## User Outcome

As a TikTok Shop operator, I can see which shop/profile I am about to open and record a local confirmation before using Seller Ads, so I reduce the chance of operating Shop A inside Shop B's browser session.

## Scope

In scope:

- Show selected shop name, profile ID, seller ID, ads account ID, cookie storage status, and last local confirmation before opening Seller Ads.
- Add a local confirmation flow with:
  - Correct shop
  - Wrong shop
  - Not logged in
  - Needs re-login
  - Needs session restore
- Store confirmation metadata in browser `localStorage` only.
- Route dropdown, shop list, and create-shop open flows through the confirmation screen.
- Keep the existing per-shop profile launch API unchanged.

Out of scope:

- Cookie/session restore.
- Cookie import/export changes.
- Reading active browser cookies, tokens, credentials, authorization headers, machine IDs, or private session state.
- Auth, permissions, payment, billing, license enforcement, deployment, migrations, or destructive data operations.
- Automatic detection of the active TikTok account.

## Affected Areas

- UI: `public/app.js`, `public/styles.css`
- Docs: `docs/TEST_MATRIX.md`, this story, PR report
- Storage: browser `localStorage` metadata only

## Risk Lane

Normal with stronger validation.

Risk flags:

- Cross-shop safety UI.
- Desktop/window/runtime shell behavior.
- Existing behavior with weak proof.

This slice avoids high-risk cookie/session/profile-runtime changes. Any real session restore or cookie/session handling remains a separate explicitly approved PR.

## Acceptance Criteria

- Selecting a shop from the quick dropdown shows a shop/profile check before Seller Ads opens.
- Clicking Seller Ads from the shop list shows the same check before Seller Ads opens.
- Creating a shop routes to the check screen before Seller Ads opens.
- Confirmation statuses are stored as local metadata only.
- Wrong shop and Needs session restore do not open Seller Ads automatically.
- Correct shop, Not logged in, and Needs re-login can open the selected profile for manual operator action.
- No cookie/token/credential values are displayed or logged by the confirmation UI.

## Validation Plan

- Syntax: `node --check public/app.js`, `node --check scripts/smoke.mjs`
- Healthcheck: `./scripts/agent-healthcheck.sh`
- Browser QA: shop/profile check renders, confirmation metadata is stored locally, safe statuses open the selected profile path, blocked statuses do not auto-open.
- Static review: no cookie/token/session values are added to UI or reports.
