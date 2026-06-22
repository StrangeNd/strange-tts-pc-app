# Cloud Sync Import Scope Smoke PR Report

Branch: `ai-agent/cloud-sync-import-scope-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: tiny validation-only change
- Risk: low, limited to static proof for existing Cloud Sync Phase 0 local backup behavior
- Affected areas: Cloud Sync smoke script, `docs/stories/`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: runtime Cloud Sync implementation, remote storage, account systems, auth, payment/billing, deployment, database migrations, cookie/session restore, cookie import/export changes, secrets, user data deletion/export/retention

## Why This Task

`SPEC.md` says Cloud Sync Phase 0 should be local backup/import-export only, with no remote cloud upload and no sensitive browser/session material. Existing smoke covered local wording and remote URL suppression. This PR adds focused proof that import restores only app config and does not recreate shops, cookies, sessions, or private browser state from backup files.

## Implementation Summary

- Added `scripts/cloud-sync-import-scope-smoke.mjs`.
- Verified local backup schema and `local-only` mode.
- Verified shop backup records use safe reference metadata only.
- Verified Cloud Sync import rejects non-local backup formats.
- Verified Cloud Sync import saves app config only and skips shop/profile restoration.
- Verified Cloud Sync import does not call shop creation or cookie import APIs.
- Added story `docs/stories/US-035-cloud-sync-import-scope-smoke.md`.
- Updated Cloud Sync evidence in `docs/TEST_MATRIX.md`.
- Removed duplicate Test Matrix rows left after prior merges so `test-matrix-smoke` remains green for the next PR cycle.

## Agent B Review

- Intake review: approved. The task is validation-only and does not alter Cloud Sync runtime behavior.
- Implementation review: approved after local validation. Scope is static proof/docs only, with no runtime Cloud Sync changes.

## Validation Results

- `node --check scripts/cloud-sync-import-scope-smoke.mjs`: passed
- `node scripts/cloud-sync-import-scope-smoke.mjs`: passed
- `node scripts/cloud-sync-local-smoke.mjs`: passed
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing moderate `exceljs`/`uuid` advisory remains below high threshold
- `scripts/agent-healthcheck.sh` through WSL: passed
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Browser UI QA is not required because this PR adds validation only.
- No real shop cookies, browser profiles, `.env` values, or production data are read.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.