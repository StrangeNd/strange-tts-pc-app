# Video Download Confirmation Gate PR Report

Branch: `ai-agent/video-download-confirmation-gate`

Target: `main`

## Task Intake

- Type: spec slice / safety hardening
- Lane: normal with focused validation
- Risk: medium, because this tightens a user-facing download API gate, but it does not add cookie/session/auth/payment/deployment behavior
- Affected areas: video download UI payload, video download API route, video safety smoke, story, test matrix
- Out of scope: DRM bypass, private content access, cookie/session restore, cookie import/export, auth, payment/billing, deployment, database migrations, new third-party downloader behavior, user data deletion/export/retention

## Why This Task

`SPEC.md` keeps video downloader behavior in scope only for videos the selected shop/profile can already view, and it must not bypass DRM, private content, access controls, or shop/profile boundaries. The UI already required an operator confirmation checkbox, but the backend accepted direct `/api/video/download` calls without that confirmation. This PR adds the server-side confirmation gate.

## Implementation Summary

- Video download UI now sends `operatorCanView: true` plus selected profile metadata.
- `/api/video/download` rejects requests that do not include explicit operator confirmation.
- Server writes metadata-only audit entries for download start/completion.
- Updated `scripts/video-downloader-safety-smoke.mjs` to cover the client payload and server gate.
- Updated `docs/stories/US-014-profile-video-downloader-safety.md`.

## Agent B Review

- Intake review: approved. This hardens an existing safety boundary and does not add sensitive session/cookie handling.
- Implementation review: approved. The UI sends explicit operator authorization and selected profile metadata, while the backend rejects direct calls without that authorization and audits metadata only.

## Validation Results

- `node --check public/app.js`: passed
- `node --check app/server.mjs`: passed
- `node --check scripts/video-downloader-safety-smoke.mjs`: passed
- `node scripts/video-downloader-safety-smoke.mjs`: passed
- `npm run video:safety-smoke`: passed through WSL; direct Windows UNC run hit the known CMD current-directory limitation
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing `exceljs`/`uuid` audit output is moderate severity only
- `scripts/agent-healthcheck.sh`: passed through WSL
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Live video download is not run because it would call an external downloader service and write to the user Downloads folder.
- Browser UI QA remains recommended before marking ready because this PR touches a submit payload, but the existing UI shell and safety smoke cover the static contract.
- No cookies, tokens, credentials, machine IDs, license keys, or private session payloads are read or printed.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
