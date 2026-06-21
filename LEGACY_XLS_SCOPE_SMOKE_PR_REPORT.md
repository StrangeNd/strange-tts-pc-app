# Legacy XLS Scope Smoke PR Report

Branch: `ai-agent/legacy-xls-scope-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: tiny validation-only change
- Risk: low, limited to static format-scope proof
- Affected areas: `scripts/legacy-xls-scope-smoke.mjs`, `docs/stories/`, PR report
- Out of scope: parser changes, upload UI changes, spreadsheet engine changes, legacy `.xls` support, live browser QA, auth, payment/billing, deployment, database migrations, cookie/session restore, secrets

## Why This Task

`SPEC.md` says supported business-analysis upload formats after the parser change are `.xlsx`, `.csv`, `.tsv`, and `.txt`, and legacy `.xls` should not be advertised unless a supported parser is added. This PR adds a guard so user-facing copy and parser claims do not drift back toward legacy `.xls` support.

## Implementation Summary

- Added `scripts/legacy-xls-scope-smoke.mjs`.
- Verified key user-facing files do not advertise legacy `.xls`.
- Verified business upload inputs advertise `.xlsx/.csv/.tsv/.txt`.
- Verified business-analysis code still covers `.xlsx` and `.csv/.tsv/.txt` paths without claiming explicit `.xls` support.
- Added story `docs/stories/US-028-legacy-xls-scope-smoke.md`.

## Agent B Review

- Intake review: approved. The task is validation-only and aligns with the current supported upload format boundary.
- Implementation review: approved. The smoke locks user-facing format scope without changing parser behavior.

## Validation Results

- `node --check app/business-analysis.mjs`: pass
- `node --check scripts/legacy-xls-scope-smoke.mjs`: pass
- `node scripts/legacy-xls-scope-smoke.mjs`: pass
- `node scripts/security-scan.mjs`: pass
- `npm audit --audit-level=high`: pass; existing moderate `uuid` via `exceljs` remains
- `scripts/agent-healthcheck.sh`: pass via WSL
- `git diff --check`: pass
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- This PR does not add or remove parser support.
- This PR intentionally does not update `docs/TEST_MATRIX.md` to avoid overlapping with currently open validation PRs.
- Browser UI QA is not required because no UI behavior or copy is changed.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
