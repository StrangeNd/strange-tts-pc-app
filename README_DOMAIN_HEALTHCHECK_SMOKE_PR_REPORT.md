# README Domain Healthcheck Smoke PR Report

Branch: `ai-agent/readme-domain-healthcheck-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: tiny validation-only change
- Risk: low, limited to wiring an existing README/user-guide smoke into npm and healthcheck
- Affected areas: `package.json`, `scripts/agent-healthcheck.sh`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: README copy changes, runtime behavior, UI shell behavior, crawler behavior, cookies/sessions, auth, payment/billing, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

`SPEC.md` requires the repository to preserve the rule that `TTS` means TikTok Shop, not Text-To-Speech, and to keep Windows-local runtime guidance clear. The repository already has `scripts/readme-runtime-domain-smoke.mjs`, but it was not available as an npm script and did not run through the agent healthcheck. This PR makes that proof durable.

## Agent B Intake Review

- Approved. This is validation-only and preserves existing README/user-guide behavior without changing runtime code.

## Implementation Summary

- Added `readme:runtime-domain-smoke` to `package.json`.
- Added the README runtime domain smoke to `scripts/agent-healthcheck.sh`.
- Updated `docs/TEST_MATRIX.md` evidence for Product domain guard.

## Agent B Implementation Review

- Approved after validation. The change wires existing README/user-guide validation into npm and healthcheck only, with no documentation copy or runtime behavior changes.

## Validation Results

- `node --check scripts/readme-runtime-domain-smoke.mjs`: passed
- `npm run readme:runtime-domain-smoke` through WSL repo path: passed
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing moderate `exceljs`/`uuid` advisory remains below high threshold
- `scripts/agent-healthcheck.sh` through WSL: passed
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Browser UI QA is not required because this PR only wires existing documentation validation into the healthcheck.
- No real shop cookies, browser profiles, `.env` values, or production data are read.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
