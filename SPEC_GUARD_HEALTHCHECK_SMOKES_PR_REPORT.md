# Spec Guard Healthcheck Smokes PR Report

Branch: `ai-agent/spec-guard-healthcheck-smokes`

Target: `main`

## Task Intake

- Type: maintenance request / validation hardening
- Lane: tiny tooling change
- Risk: low, limited to npm scripts and healthcheck coverage
- Affected areas: `package.json`, `scripts/agent-healthcheck.sh`, `docs/stories/`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: runtime behavior, UI behavior, crawler behavior, auth, sessions, cookies, payment/billing, deployment/release automation, database migrations, secrets, user data deletion/export/retention

## Why This Task

Several focused SPEC guard smokes have merged, but only a subset are exposed through npm and run by `scripts/agent-healthcheck.sh`. This makes it easier to regress a SPEC invariant without the default agent proof catching it. This PR wires the merged guard smokes into npm scripts and the healthcheck.

## Implementation Summary

- Added npm scripts for merged desktop, shop, business, ops, crawler, and session guard smokes.
- Refactored `scripts/agent-healthcheck.sh` with `run_npm_script_if_present`.
- Extended healthcheck to run the merged guard smoke set when scripts are present.
- Added story `docs/stories/US-034-spec-guard-healthcheck-smokes.md`.
- Updated `docs/TEST_MATRIX.md` Agent loop evidence.

## Agent B Review

- Intake review: approved. The task changes validation wiring only and does not alter runtime behavior.
- Implementation review: approved. The merged spec guard smokes are exposed through npm and included in the default agent healthcheck without changing product runtime behavior.

## Validation Results

- `node scripts/test-matrix-smoke.mjs`: passed
- Targeted npm smoke scripts: passed through WSL
- `scripts/agent-healthcheck.sh`: passed through WSL with extended spec guard smoke set
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing `exceljs`/`uuid` audit output is moderate severity only
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Browser UI QA is not required because this PR only changes validation wiring.
- Direct npm scripts from Windows UNC can hit the known CMD current-directory limitation; validation should run through WSL or direct `node` when needed.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
