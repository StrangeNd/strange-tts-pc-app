# US-039 - Real Seller Center Auto Profile Crawl

## Story

As a TikTok Shop operator,
I want the crawler and shop overview to run against the selected shop profile that already has a local logged-in session,
so that `little-apricot-hawaii-fashion` and future shops can collect Seller Center data without manually guessing a CDP port.

## Intake

- Type: spec slice
- Lane: high-risk boundary with explicit user request for already-loaded local cookies/session
- Affected areas: crawler API, crawler UI, healthcheck smoke, Test Matrix, PR report
- Risk: guarded session/cookie boundary. This PR does not add cookie import/export, plaintext cookie output, auth bypass, remote upload, deployment, payment, billing, database migration, or user data deletion/export/retention.

## Scope

- Add crawler `autoOpenProfile` support so `/api/tiktokshop-crawler/crawl` can open the selected managed shop profile and use the returned `debugPort`.
- Apply the same auto-profile path to Seller Center deep crawl and Compass crawl.
- Keep manual CDP port input as an advanced fallback.
- Default the public crawler UI to auto-open the selected profile.
- Add a smoke check that protects the auto-profile path and no-raw-cookie response/audit boundary.
- Build the shop overview from the latest Compass overview database when real Compass data exists.
- Scrub URL-like overview fields, including nested `source` strings, before returning crawler-derived overview data.
- Show raw Compass metric mappings on the dashboard so the operator can manually verify which Seller UI metric feeds each dashboard value.
- Add a dashboard realtime crawl action that opens the selected managed profile and refreshes the current month before reloading overview data.

## Non-Scope

- No new cookie import/export flow.
- No plaintext cookie/session output.
- No session restore implementation beyond using the existing local managed profile/cookie launcher.
- No remote cloud upload, auth/admin change, payment/billing, deployment, database migration, or user data deletion/export/retention.
- No bypass of TikTok permissions, captcha, or login requirements.

## Acceptance Criteria

- Seller Center crawl can be requested with `autoOpenProfile: true` and use the launch `debugPort` instead of a hard-coded CDP port.
- Compass crawl can use the same auto-profile path.
- UI sends `autoOpenProfile` by default.
- Crawler response/audit exposes only safe launch metadata such as profile name, debug port, extension ID, and cookie count metadata.
- Smoke fails if the UI stops sending `autoOpenProfile` or if the server returns/logs raw cookies.
- Smoke fails if the overview no longer reads the latest Compass DB, invents missing orders, chooses Edge/permission dialog tabs before Seller Center, loses the extended daily Compass timeout, or exposes sensitive URL query names.
- Dashboard ranges show `today`, `yesterday`, `last7`, and `month`; future zero rows after the current date must not pollute today/last7 calculations.
- Dashboard realtime refresh must trigger a current-month Compass crawl through the selected managed profile, not just reload the cached overview.

## Validation

- `node --check app/server.mjs`
- `node --check public/app.js`
- `node --check scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `node --check scripts/real-crawl-overview-smoke.mjs`
- `node scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `node scripts/real-crawl-overview-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
- Manual real-session validation should be run on a Windows local app folder with the `little-apricot-hawaii-fashion` profile already logged in.

## Live Evidence - 2026-06-24

- Imported the user-provided local cookie JSON into the Windows installed app encrypted store for `little-apricot-hawaii-fashion`; only cookie count metadata was recorded.
- Real Compass auto-profile crawl succeeded with `launchProfile: shop-7494478078863902049`, `cookiesApplied: 41`, month `2026-06`, `readyTime: 2026-06-23`, `dailyRows: 30`, and `totalGmv: 76714095`.
- The installed app Compass DB now contains months `2026-04`, `2026-05`, and `2026-06` for the shop.
- `/api/business/shop-overview` selects the Compass overview `runId: compass-2026-06` for the shop and keeps unavailable orders/visitors missing.
- Follow-up realtime crawl on 2026-06-24 refreshed June GMV to `76949835`; dashboard API now reports today `1169062`, yesterday `2646003`, last7 `19471704`, and month `76949835`.
- Dashboard overview includes raw Compass mapping rows with metric IDs, Seller UI labels, raw date/value rows, formula, raw file path, and crawled timestamp for manual operator verification.
