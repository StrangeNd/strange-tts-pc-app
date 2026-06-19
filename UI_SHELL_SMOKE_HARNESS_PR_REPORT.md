# UI Shell Smoke Harness PR Report

Branch: `ai-agent/ui-qa-harness`

Target: `main`

## Task Intake

- Type: maintenance request
- Lane: tiny
- Risk: low, limited to validation tooling and docs
- Affected areas: `scripts/ui-shell-smoke.mjs`, `scripts/agent-healthcheck.sh`, `package.json`, `public/index.html`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: browser automation, authenticated TikTok flows, shell redesign, business logic, crawler behavior, sessions, cookies, auth, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

SPEC.md lists reusable local UI QA as an open gap, and `scripts/agent-healthcheck.sh` previously skipped UI shell coverage entirely. This PR adds a small deterministic smoke check for the local app shell so missing button IDs, health anchors, asset references, or click bindings fail before manual browser QA.

## Implementation Summary

- Added `scripts/ui-shell-smoke.mjs`.
- Added `npm run ui:shell-smoke`.
- Wired the smoke into `scripts/agent-healthcheck.sh`.
- Normalized existing replacement-character shell copy in `public/index.html` while preserving shell IDs.
- Added story and test matrix evidence for the UI shell harness.

## Validation Results

- Passed: `node --check scripts/ui-shell-smoke.mjs`
- Passed: `node --check public/app.js`
- Passed: `npm run ui:shell-smoke` from WSL mirror
  - Confirmed 22 shell IDs and 13 click bindings.
- Passed: `node scripts/smoke.mjs` from WSL mirror
- Passed: `node scripts/security-scan.mjs`
- Passed: `npm audit --audit-level=high`
  - Existing moderate `uuid`/`exceljs` advisory remains below the high gate.
- Passed: `git diff --check`
- Passed: replacement-character diff check
- Passed: in-app browser QA at `http://127.0.0.1:48741/`
  - Confirmed health pill, Vietnamese shell labels, workspace anchor, replacement count `0`, and console error count `0`.
- Passed: `./scripts/agent-healthcheck.sh`
  - Confirmed healthcheck now runs the UI shell smoke step.

Note: direct `npm run` / `node scripts/smoke.mjs` from the Windows UNC working directory can hit Windows CMD or Node module resolution issues. Validation used the repository's WSL mirror path, matching the agent workflow for this workspace.

## Manual Validation Notes

- This PR does not replace real browser QA for tasks that change runtime interactions.
- The smoke checks static shell contracts only and does not open TikTok, crawl pages, or touch profile/session data.
- No cookies, tokens, credentials, browser profile data, payment system behavior, or user data deletion/export/retention were read or modified.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
