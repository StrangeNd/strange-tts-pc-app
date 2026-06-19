# Shop Profile Session Safety PR Report

Branch: `ai-agent/shop-profile-session-safety`

Target: `main`

## Task intake

- Type: spec slice
- Lane: normal with stronger validation
- Risk: medium, limited to UI and local metadata
- Affected areas: `public/app.js`, `public/styles.css`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: cookie/session restore, cookie import/export changes, browser profile runtime changes, auth, payment, billing, license enforcement, cloud sync backend, deployment, database migrations, raw browser state, secrets

## Why this task

SPEC.md identifies shop/profile mixing as a core product risk. This slice adds a local confirmation screen before opening Seller Ads so operators can verify the selected shop/profile and record whether the session is correct, wrong, logged out, needs re-login, or needs a future approved session restore.

## Implementation summary

- Added a Shop/profile check screen before Seller Ads opens.
- Routed quick dropdown, shop list Seller Ads buttons, and create-shop open flow through the check screen.
- Added local confirmation statuses and metadata storage in browser `localStorage`.
- Kept cookie/session/profile launch backend behavior unchanged.
- Prevented Wrong shop and Needs session restore statuses from auto-opening Seller Ads.

## Validation results

- `node --check public/app.js`: pass
- `node --check scripts/smoke.mjs`: pass
- `node scripts/smoke.mjs`: pass, production smoke in licensed mode
- `npm audit --audit-level=high`: pass; only moderate `uuid`/`exceljs` remains
- Added replacement/mojibake characters in diff: none found
- Static sensitive-term review: confirmation UI mentions cookies/session only as metadata/warnings; no cookie/token/credential values are read or displayed
- `./scripts/agent-healthcheck.sh`: pass, production smoke in unlicensed mode

## Manual validation notes

- This PR does not inspect active TikTok browser sessions and does not read or export cookie/session material.
- Active account detection and authorized local session restore remain future dedicated PRs requiring explicit approval.
- Browser app load was checked at `http://127.0.0.1:48741`; the local shop library had no configured shops, so the full confirmation click path remains manual until a local shop profile exists.

## PR checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
