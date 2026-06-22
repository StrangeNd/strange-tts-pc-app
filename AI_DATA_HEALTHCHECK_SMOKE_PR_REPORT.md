# AI Data Healthcheck Smoke PR Report

Branch: `ai-agent/ai-data-healthcheck-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: tiny validation-only change
- Risk: low, limited to wiring an existing smoke into npm and healthcheck
- Affected areas: `package.json`, `scripts/agent-healthcheck.sh`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: AI feature work, UI runtime behavior changes, crawler changes, business metric changes, sync changes, auth, sessions, cookies, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

`SPEC.md` says AI Data must be removed or clearly treated as external/out of scope. The repository already has `scripts/ai-data-external-scope-smoke.mjs`, but it was not available as an npm script and did not run through the agent healthcheck. This PR makes that proof durable so future PRs catch regressions automatically.

## Agent B Intake Review

- Approved. This is validation-only, low risk, and preserves the existing external AI Data behavior without adding native AI, crawler, metrics, speech, or audio functionality.

## Implementation Summary

- Added `ai-data:external-scope-smoke` to `package.json`.
- Added the AI Data external scope smoke to `scripts/agent-healthcheck.sh`.
- Updated `docs/TEST_MATRIX.md` evidence for External AI Data.

## Agent B Implementation Review

- Approved after validation. The change wires existing validation into npm and healthcheck only, with no runtime AI Data behavior changes.

## Validation Results

- `node --check scripts/ai-data-external-scope-smoke.mjs`: passed
- `npm run ai-data:external-scope-smoke` through WSL repo path: passed
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing moderate `exceljs`/`uuid` advisory remains below high threshold
- `scripts/agent-healthcheck.sh` through WSL: passed
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Browser UI QA is not required because this PR only wires existing validation into the healthcheck.
- Direct `npm run ai-data:external-scope-smoke` from the Windows UNC current directory failed because `cmd.exe` defaulted to `C:\Windows`; the same npm script passed through the WSL repo path, matching the repository's WSL runner guidance.
- No real shop cookies, browser profiles, `.env` values, or production data are read.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
