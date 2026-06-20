# Desktop Launch Smoke PR Report

## Task Intake

- Task name: Desktop Launch Smoke
- Type: maintenance request
- Lane: tiny
- User value: non-technical operators keep a stable Windows-local desktop launch path with a shortcut/open script that starts the app and opens the dashboard app-window.
- Scope: add targeted static smoke, story, and PR report.
- Non-scope: no desktop runtime behavior changes, no license/auth/session/cookie/payment/billing/deployment/database/production infrastructure/release automation changes, no browser UI automation.
- Affected files: `scripts/desktop-launch-smoke.mjs`, `docs/stories/US-021-desktop-launch-smoke.md`, this report.
- Risk lane: low. Validation-only.

## Test Matrix Mapping

| Changed flow or behavior | Matrix row | Required proof | Evidence in this PR |
| --- | --- | --- | --- |
| Desktop launch script wiring is covered by a targeted static smoke | Desktop launch | Healthcheck or smoke script; no license bypass in production mode | `scripts/desktop-launch-smoke.mjs`; this report |

No runtime product behavior changes. `docs/TEST_MATRIX.md` is unchanged because this PR adds proof for an existing row while avoiding conflicts with open PRs touching the matrix/healthcheck.

## Agent B Intake Review

Approved before implementation.

- Domain check: TTS remains TikTok Shop; no Text-To-Speech/audio behavior is added.
- Risk check: validation-only, no high-risk runtime behavior touched.
- Scope check: no launcher behavior is changed.
- Proof check: static smoke plus existing healthcheck covers the added guard.

## Implementation Summary

- Added `scripts/desktop-launch-smoke.mjs`.
- Added story `US-021`.
- The smoke checks the shortcut creator, PowerShell opener, PowerShell start wrapper, Node production launcher, and README Windows-local launch guidance.

## Validation Plan

- `node --check scripts/desktop-launch-smoke.mjs`
- `node scripts/desktop-launch-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- WSL `scripts/agent-healthcheck.sh`
- Diff hygiene and replacement-character check

## Agent B Implementation Review

Approved.

- Scope stayed validation-only: no launcher or runtime behavior files were modified.
- The smoke verifies existing desktop-launch wiring across shortcut creation, PowerShell opener, PowerShell start wrapper, Node launcher, and README Windows-local runtime guidance.
- No license, auth, session, cookie, payment, billing, deployment, database migration, production infrastructure, release automation, or browser profile behavior was changed.

## Results

- PASS: `node --check scripts/desktop-launch-smoke.mjs`
- PASS: `node scripts/desktop-launch-smoke.mjs`
- PASS: `node scripts/security-scan.mjs`
- PASS: `npm audit --audit-level=high`
- PASS: WSL `scripts/agent-healthcheck.sh`
- PASS: `git diff --check`
- PASS: replacement-character diff check

Note: `npm audit --audit-level=high` still reports the existing moderate `uuid` advisory through `exceljs`, but exits successfully because no high-severity issue is present.
