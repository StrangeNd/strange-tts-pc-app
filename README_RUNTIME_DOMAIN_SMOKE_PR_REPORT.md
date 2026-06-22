# README Runtime Domain Smoke PR Report

Branch: `ai-agent/readme-runtime-domain-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: tiny validation-only change
- Risk: low, limited to docs smoke and validation evidence
- Affected areas: `scripts/readme-runtime-domain-smoke.mjs`, `docs/stories/`, `docs/TEST_MATRIX.md`, PR report
- Out of scope: runtime behavior, UI shell behavior, crawler behavior, cookies/sessions, auth, payment/billing, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

`SPEC.md` keeps README/domain wording in the P0 cleanup area and requires the repository to preserve the rule that `TTS` means TikTok Shop, not Text-To-Speech. The README also carries important Windows-local runtime guidance because production usage should not run directly from the WSL UNC path. This PR adds a focused smoke so those docs do not drift.

## Implementation Summary

- Added `scripts/readme-runtime-domain-smoke.mjs`.
- Verified README title/domain wording remains TikTok Shop oriented.
- Verified README and user guide preserve the Text-To-Speech non-goal.
- Verified README and user guide warn against WSL UNC production runtime.
- Verified README keeps Windows start script, localhost debug/API wording, and encrypted cookie storage guidance.
- Added story `docs/stories/US-032-readme-runtime-domain-smoke.md`.
- Updated `docs/TEST_MATRIX.md` product domain evidence.

## Agent B Review

- Intake review: approved. The task is validation-only and does not change runtime behavior.
- Implementation review: approved. The smoke locks README/user-guide domain wording, Windows-local runtime guidance, WSL UNC warning, localhost debug/API wording, and encrypted cookie storage notes.

## Validation Results

- `node --check scripts/readme-runtime-domain-smoke.mjs`: passed
- `node scripts/readme-runtime-domain-smoke.mjs`: passed
- `node scripts/test-matrix-smoke.mjs`: passed
- `node scripts/security-scan.mjs`: passed
- `npm audit --audit-level=high`: passed; existing `exceljs`/`uuid` audit output is moderate severity only
- `scripts/agent-healthcheck.sh`: passed through WSL
- `git diff --check`: passed
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- No browser UI QA is required because this PR adds validation only.
- Existing legacy runtime labels such as shortcut names are not changed.
- No Text-To-Speech/audio behavior is added.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
