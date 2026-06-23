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

## Validation

- `node --check app/server.mjs`
- `node --check public/app.js`
- `node --check scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `node scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
- Manual real-session validation should be run on a Windows local app folder with the `little-apricot-hawaii-fashion` profile already logged in.
