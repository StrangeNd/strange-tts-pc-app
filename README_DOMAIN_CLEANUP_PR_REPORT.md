# README Domain Cleanup PR Report

Branch: `ai-agent/readme-domain-cleanup`

Target: `main`

## Task Intake

- Type: maintenance request
- Lane: tiny
- Risk: low, limited to docs/package metadata copy
- Affected areas: `README.md`, `docs/PC_APP_USER_GUIDE.md`, `docs/HARNESS.md`, `docs/ARCHITECTURE.md`, `package.json`, `docs/TEST_MATRIX.md`
- Out of scope: runtime behavior, UI shell behavior, extension logic, business logic, crawler behavior, sessions, cookies, auth, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

SPEC.md lists README/domain wording as a P0 cleanup item and requires the repo to preserve the rule that `TTS` means TikTok Shop, not Text-To-Speech. This PR clarifies the product domain in primary docs while preserving existing legacy shortcut/runtime labels where they describe current local behavior.

## Implementation Summary

- Retitled the README as Strange TikTok Shop PC App and added an explicit TTS legacy acronym note.
- Added the same domain note to the non-technical PC app guide.
- Clarified harness and architecture docs so they describe TikTok Shop workflows rather than generic TTS workflows.
- Updated package metadata description to TikTok Shop operations.
- Updated product domain guard evidence in `docs/TEST_MATRIX.md`.

## Validation Results

- Passed: domain wording audit
- Passed: Text-To-Speech/audio scope audit
  - Only explicit non-goal/domain-guard references are present in added docs.
- Passed: `node --check scripts/smoke.mjs`
- Passed: `node scripts/smoke.mjs`
- Passed: `node scripts/security-scan.mjs`
- Passed: `npm audit --audit-level=high`
  - Existing moderate `uuid`/`exceljs` advisory remains below the high gate.
- Passed: `git diff --check`
- Passed: replacement-character diff check
- Passed: `./scripts/agent-healthcheck.sh`
  - Includes the UI shell smoke step from the current main baseline.

## Manual Validation Notes

- Existing runtime strings, shortcut filenames, env vars, and legacy extension names are not changed in this PR.
- No Text-To-Speech/audio behavior is added.
- No cookies, tokens, credentials, browser profile data, payment system behavior, or user data deletion/export/retention were read or modified.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
