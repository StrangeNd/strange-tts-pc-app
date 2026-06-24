# Phase 2.5 Real Data Validation Small Scope Report

Branch: ai-agent/real-data-validation-small-scope

## Summary

Phase 2.5 was run as validation/report-only. No app code was modified.

The Windows local app launched successfully from the desktop shortcut and responded on 127.0.0.1:48731.

A small real Compass crawl for the current month was executed for shop little-apricot-hawaii-fashion. The crawl opened TikTok Seller/Compass page metadata showing seller-vn.tiktok.com/compass/data-overview and the page title included Little Apricot Hawaii Fashion.

However, the Windows local app runtime did not expose the new Phase 2 crawlerStatus contract in /api/tiktokshop-crawler/db. This means the installed Windows local app appears older than the latest Phase 2 branch code, so full Phase 2 status-contract validation is blocked until the Windows local runtime is updated.

## Scope

Validated:

- Windows local shortcut launch.
- Local health endpoint.
- Safe shop/profile metadata access through API.
- Small real Compass crawl for current month.
- CDP page metadata only: title, host, path.
- Shop Overview latest run refresh.
- No direct cookie/session/token value reading.

Not validated:

- Full Phase 2 crawlerStatus contract in local Windows runtime.
- Full UI status transition using the new backend fields.
- Full real-data validation inside latest Phase 2 build.
- Full multi-shop crawl.
- Full performance test on large real crawler output.

## Environment

- App launched from Windows desktop shortcut:
  - C:\Users\Stephen Strange\OneDrive\Desktop\Strange TTS PC App.lnk
- Local app working folder observed:
  - C:\Users\Stephen Strange\StrangeTTS-PC-App
- Local API:
  - http://127.0.0.1:48731
- Health:
  - OK
- Validation date:
  - 2026-06-24

## Safe Shop/Profile Metadata

- Shop ID:
  - little-apricot-hawaii-fashion
- Seller ID used for crawl:
  - 7494478078863902049
- Current month crawl:
  - 2026-06
- CDP debug port observed:
  - 54083
- CDP page metadata:
  - Host: seller-vn.tiktok.com
  - Path: /compass/data-overview
  - Title included: Little Apricot Hawaii Fashion

No cookie values, session values, tokens, authorization headers, or private browser storage were read or printed.

## Crawl Result

A small Compass crawl was run through:

- Endpoint:
  - /api/tiktokshop-crawler/crawl
- Mode:
  - compass
- Month:
  - 2026-06
- autoOpenProfile:
  - true

Observed result:

- The crawl completed enough to open Compass/Seller Center with the intended shop context.
- The local app returned safe launch metadata such as profile name, debug port, and cookie count/application metadata.
- No raw cookie values were printed.

## Shop Overview Result

/api/business/shop-overview reflected the latest intended run.

Observed safe metadata:

- Shop:
  - little-apricot-hawaii-fashion
- Latest run ID:
  - compass-2026-06
- Last crawl timestamp:
  - 2026-06-24T15:36:52.319Z

This confirms the Shop Overview path can read the latest real crawl output from the local runtime.

## Business Analysis Result

Business Analysis validation was started, but the Codex session hit usage limit before a final report was written.

Partial observation:

- /api/business/analyze was queried with selected shop and no uploaded files.
- The goal was to check uploaded/crawler/missing/computed source states.
- Final UI source-state validation remains incomplete and should be repeated after the Windows local app is updated to the Phase 2 code.

## Phase 2 Status Contract Validation

Blocked.

Reason:

- /api/tiktokshop-crawler/db on the Windows local app returned real/cache crawler data but did not expose the new Phase 2 crawlerStatus field.
- This indicates the Windows local runtime is not updated to the Phase 2 branch code.

Required next step:

- Update/rebuild/sync the Windows local app folder from the latest Phase 2 branch.
- Relaunch app from the Windows local folder.
- Re-run /api/tiktokshop-crawler/db.
- Confirm crawlerStatus exists before continuing real-data status validation.

## Leak Safety

Observed validation used API metadata and CDP page metadata only.

No direct reading or printing of:

- cookie values
- session values
- tokens
- authorization headers
- bearer values
- msToken
- x-bogus
- credentials
- app-secret
- .env
- private browser storage

## Final Status

Partial pass with blocker.

Pass:

- Windows local app launched.
- Health endpoint OK.
- Real shop/profile context opened.
- Small current-month Compass crawl ran.
- Shop Overview received latest run.
- No secret values were intentionally read or printed.

Blocked:

- New Phase 2 crawlerStatus contract could not be validated because the Windows local app runtime appears outdated.

## Recommendation

Before Phase 3, update the Windows local app runtime to the latest Phase 2 code and rerun this validation.

Do not proceed to Phase 3 optimization or broader crawler changes until:

- crawlerStatus appears in /api/tiktokshop-crawler/db
- TikTokCrawler UI shows the new status/readiness/failure fields from live runtime
- a small current-month Compass crawl produces completed/partial/failed status with safe reason metadata
- no secrets appear in UI, API response, audit log, console output, or report

---

## Rerun After Restarting Windows Local App

After syncing the Windows local app and restarting it with:

- `npm run stop`
- `npm run app`

`/api/tiktokshop-crawler/db` returned the Phase 2 `crawlerStatus` contract successfully.

Observed safe metadata:

- `crawlerStatus.status`: `partial`
- `crawlerStatus.readiness`: `partial`
- `crawlerStatus.selectedShop.id`: `little-apricot-hawaii-fashion`
- `crawlerStatus.selectedShop.name`: `Little Apricot Hawaii Fashion`
- `crawlerStatus.profileName`: `shop-7494478078863902049`
- `crawlerStatus.cookieStorageStatus`: `encrypted`
- `crawlerStatus.cookieCount`: `41`
- `crawlerStatus.cookieUpdatedAt`: `2026-06-24T02:47:14.849Z`
- `crawlerStatus.sessionHint`: `safe_metadata_only`
- `crawlerStatus.latestRun.status`: `partial`
- `crawlerStatus.latestRun.mode`: `seller-center`
- `crawlerStatus.latestRun.source`: `seller-center-latest`
- `crawlerStatus.failureReason`: `cdp_unavailable`
- `crawlerStatus.partialReason`: `Job dang chay truoc do da bi dung hoac mat ket noi browser/CDP.`
- `crawlerStatus.retryable`: `true`

Result:

- The Phase 2 crawler status contract is visible in the Windows local runtime.
- The contract exposes safe metadata only.
- No cookie/session/token value was printed.
- Current real-operation status is partial because the previous Seller Center/CDP job lost browser connection.
- The issue is retryable and should be handled as a crawler runtime retry/stale CDP cleanup case.

Updated validation status:

- Previous blocker `crawlerStatus missing from local runtime`: resolved.
- Current blocker: Seller Center latest run is partial due to `cdp_unavailable`.
- Next action: close stale browser/CDP sessions, restart the app, then retry a small current-month crawl.
