# Shop Profile Metadata PR Report

Branch: `ai-agent/shop-profile-metadata-smoke`

Target: `main`

## Task Intake

- Type: spec slice / product proof
- Lane: normal, small local metadata behavior change
- Risk: medium because it supports shop/profile separation, but does not read, write, export, or expose cookies/session material
- Affected areas: shop library metadata, Seller Ads setup UI, profile confirmation UI, smoke tests, story, test matrix
- Out of scope: cookie/session restore, auth, payment/billing, deployment, database migrations, raw crawler data, user data deletion/export/retention

## Why This Task

`SPEC.md` says each active shop profile should keep shop name, avatar, login note, Ads account ID, Seller Center entry URL, Seller Ads entry URL, Compass entry URL, GMV Max dashboard entry URL, shop health status, product score status, and human confirmation metadata. This PR fills the missing metadata fields and adds proof that the confirmation flow still gates Seller Ads opening.

## Implementation Summary

- Extended `createShop` metadata to preserve avatar, login note, entry URLs, shop health status, and product score status.
- Extended the Seller Ads setup form and create payload with the same metadata fields.
- Extended selected shop context, local backup payload, and shop/profile confirmation card with the new metadata.
- Made Seller Ads and GMV Max entry URL builders prefer stored entry URLs with generated fallback behavior.
- Added `scripts/shop-profile-metadata-smoke.mjs`.
- Added story `docs/stories/US-030-shop-profile-metadata.md`.
- Updated `docs/TEST_MATRIX.md` evidence for shop profile/session safety.

## Agent B Review

- Intake review: approved. This is local metadata behavior aligned with SPEC P1 and avoids high-risk session/cookie handling.
- Implementation review: approved. The implementation stores local shop/profile metadata, keeps confirmation-before-open behavior, and does not read or expose cookie/session material.

## Validation Results

- `node --check app/shop-library.mjs`: passed
- `node --check public/app.js`: passed
- `node --check scripts/shop-profile-metadata-smoke.mjs`: passed
- `node scripts/shop-profile-metadata-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing `exceljs`/`uuid` audit output is moderate severity only
- `scripts/agent-healthcheck.sh`: passed through WSL
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Browser UI QA was attempted but could not complete in this environment: the in-app browser bridge returned a sandbox metadata error, and the fallback Playwright CLI module could not be loaded reliably through the WSL/PowerShell inline runner. The automated UI shell smoke and targeted metadata smoke passed.
- No cookies, tokens, credentials, machine IDs, license keys, or `.env` values are read or printed by the new smoke.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
