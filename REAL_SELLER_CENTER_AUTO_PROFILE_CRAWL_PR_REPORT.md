# Real Seller Center Auto Profile Crawl PR Report

Branch: `ai-agent/real-seller-center-overview`

Target: `main`

## Task Intake

- Type: spec slice
- Lane: high-risk boundary with explicit user request for already-loaded local cookies/session
- Risk: guarded session/cookie boundary; this PR uses the existing local managed profile/cookie launcher and does not add cookie import/export, plaintext cookie output, auth bypass, or remote upload
- Affected areas: `app/server.mjs`, `public/app.js`, `scripts/`, `docs/stories/`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: new cookie import/export, plaintext session restore, auth/admin behavior, payment/billing, deployment, database migration, production infrastructure, remote cloud upload, user data deletion/export/retention, and bypassing TikTok permissions/login/captcha

## Test Matrix Mapping

| Changed flow or behavior | Matrix row | Required proof | Evidence in this PR |
| --- | --- | --- | --- |
| TikTok crawler can auto-open the selected managed shop profile and use the returned CDP port | TikTok crawler | Auto-profile smoke, syntax, security scan, healthcheck, real-session manual validation note | `scripts/tiktok-crawler-auto-profile-smoke.mjs`; `docs/stories/US-039-real-seller-center-auto-profile-crawl.md`; this report |
| Shop overview can refresh from real Seller Center or Compass crawl output for the selected shop | Shop overview | Seller Center/Compass latest DB/API review, healthcheck, manual real-session validation note, secret URL scrub smoke | `/api/tiktokshop-crawler/crawl`; `/api/business/shop-overview`; `scripts/real-crawl-overview-smoke.mjs`; this report |

## Explicit Approval Context

The user explicitly requested the crawler and shop overview to work with the real shop `little apricot hawaii fashion` and future shops using a real run session with cookies already loaded and an existing logged-in session. This PR treats that as approval to use the existing local managed profile/cookie launcher for the crawler. It does not expose, export, print, or return raw cookie/session/token values.

## Agent B Intake Review

Approved before implementation.

- Domain check: TTS remains TikTok Shop; no Text-To-Speech/audio behavior is added.
- Risk check: touches the session/cookie boundary only by reusing existing local managed profile launch behavior; no new cookie storage/import/export or plaintext output is added.
- Scope check: focused on making the crawler use the real launched profile debug port instead of a hard-coded CDP port.
- Proof check: targeted smoke plus syntax/security/healthcheck and manual real-session validation notes cover this slice.

## Implementation Summary

- Added `prepareCrawlerBrowser()` in `app/server.mjs` to resolve shop metadata, open the selected managed profile when `autoOpenProfile` is enabled, and use the returned `debugPort` for crawler CDP.
- Updated Seller Center deep crawl and Compass crawl API paths to share the auto-profile preparation path.
- Kept manual CDP port as a fallback when `autoOpenProfile` is disabled.
- Updated the public crawler UI to default `autoOpenProfile` on.
- Added `scripts/tiktok-crawler-auto-profile-smoke.mjs` and wired it into npm/healthcheck.
- Fixed Compass target selection so the crawler prefers Seller Center/Compass tabs and avoids Edge permission dialog targets.
- Increased Compass Runtime.evaluate timeouts for ready-date, aggregate, and daily-loop calls.
- Added Compass DB-backed shop overview fallback and scrubbed crawler-derived overview payloads before returning them.
- Added `scripts/real-crawl-overview-smoke.mjs` to protect Compass overview selection, missing metric behavior, CDP target/timeout guards, and sensitive URL query scrubbing.
- Corrected Compass dashboard ranges so today, yesterday, last7, and month are separate; future zero rows after the current date are excluded from today/last7.
- Added a raw Compass mapping table to the dashboard so each visible value can be manually checked against Seller/Compass UI metric IDs and raw date/value rows.
- Added a dashboard `Crawl realtime + cap nhat` action that triggers current-month Compass crawl through the selected managed profile before reloading the overview.

## Validation Plan

- `node --check app/server.mjs`
- `node --check public/app.js`
- `node --check scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `node --check scripts/real-crawl-overview-smoke.mjs`
- `node scripts/tiktok-crawler-auto-profile-smoke.mjs`
- `node scripts/real-crawl-overview-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- WSL `scripts/agent-healthcheck.sh`
- Browser/local app real-session QA with `little-apricot-hawaii-fashion` when the Windows local profile is available.

## Validation Results

- `node --check app/server.mjs`: pass
- `node --check public/app.js`: pass
- `node --check scripts/tiktok-crawler-auto-profile-smoke.mjs`: pass
- `node scripts/tiktok-crawler-auto-profile-smoke.mjs`: pass
- `node --check scripts/real-crawl-overview-smoke.mjs`: pass
- `node scripts/real-crawl-overview-smoke.mjs`: pass
- `node scripts/security-scan.mjs`: pass
- `npm audit --audit-level=high`: pass; existing moderate `uuid` via `exceljs` remains
- `scripts/agent-healthcheck.sh`: pass via WSL after fixing `scripts/test-matrix-smoke.mjs` duplicate import and consolidating duplicate Test Matrix rows
- Manual real-session Compass validation: pass on the Windows installed app with the user-provided encrypted cookie import for `little-apricot-hawaii-fashion`; auto-profile crawl recorded month `2026-06`, `readyTime: 2026-06-23`, `dailyRows: 30`, and `totalGmv: 76714095` without printing raw cookie/session values.
- Manual shop overview validation: pass on the Windows installed app; `/api/business/shop-overview` selects `sourceType: compass`, `runId: compass-2026-06`, available months `2026-04`, `2026-05`, `2026-06`, GMV `76714095`, video GMV `55389662`, and keeps missing orders/visitors unavailable.
- Manual overview leak scan: pass; serialized overview JSON did not match `msToken|fp=|cookie=|cookie_enabled|sessionid=|authorization=|bearer\\s|x-bogus`.
- Manual realtime refresh validation: pass on the Windows installed app; current-month Compass crawl returned `launchProfile: shop-7494478078863902049`, `cookiesApplied: 41`, `readyTime: 2026-06-23`, `crawledAt: 2026-06-24T07:20:27.833Z`, and refreshed month GMV to `76949835`.
- Manual range validation after realtime refresh: pass; `/api/business/shop-overview` returned today `1169062` for `2026-06-24`, yesterday `2646003` for `2026-06-23`, last7 `19471704` for `2026-06-18 -> 2026-06-24`, and month `76949835` for `2026-06-01 -> 2026-06-30`.
- Manual raw mapping validation: pass; dashboard API exposes 9 raw mapping rows per Compass range, including metric ID `4024`, raw date/value rows, formula, raw file path, and no sensitive URL/query pattern.

## Manual Validation Notes

- Real Seller Center validation requires the local Windows app profile for `little-apricot-hawaii-fashion` to be available and logged in. If the profile/session is unavailable in the agent workspace, this PR records that remaining manual proof explicitly.
- No raw cookies, tokens, credentials, authorization headers, machine IDs, license keys, `.env` values, or private session payloads are printed or returned.

## Risk Review

- No Text-To-Speech/audio behavior added.
- No secrets, cookies, tokens, credentials, machine IDs, license keys, or `.env` values exposed.
- No auth, payment/billing, deployment, database migration, permissions, or user data deletion/export/retention behavior changed unless explicit approval is recorded here.
- Missing/unavailable product data remains missing rather than invented where applicable.
- This PR does not bypass TikTok access controls, captcha, login, or platform permissions; expired sessions should surface as crawler/auth errors.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
