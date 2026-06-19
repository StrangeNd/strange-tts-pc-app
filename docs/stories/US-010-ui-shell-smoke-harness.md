# US-010: UI Shell Smoke Harness

## User Outcome

As an operator, I can trust that the local PC app shell keeps its main buttons, health indicator, and workspace anchors wired before a PR reaches manual browser QA.

## Scope

In scope:

- Add a committed local smoke script for the public app shell.
- Verify important shell IDs exist in `public/index.html`.
- Verify `public/app.js` references important shell IDs and binds the main shell buttons.
- Verify shell buttons have visible labels.
- Verify the shell still loads `/app.js` and `/styles.css`.
- Verify no replacement character is present in the public shell files.
- Normalize existing replacement-character shell copy in `public/index.html` so the harness has a clean baseline.
- Run this smoke from `scripts/agent-healthcheck.sh`.

Out of scope:

- Full browser automation or authenticated TikTok Shop flows.
- Changing shell layout, copy, business logic, crawler behavior, sessions, cookies, auth, payments, billing, deployment, database migrations, secrets, or user data deletion/export/retention.

## Affected Areas

- Scripts: `scripts/ui-shell-smoke.mjs`, `scripts/agent-healthcheck.sh`
- Package metadata: `package.json`
- Docs: `docs/TEST_MATRIX.md`, this story, PR report
- UI shell: `public/index.html`

## Risk Lane

Tiny maintenance request.

Risk flags:

- Developer tooling and validation coverage.
- No production runtime behavior change.

## Acceptance Criteria

- `npm run ui:shell-smoke` passes on the current shell.
- `scripts/agent-healthcheck.sh` runs the UI shell smoke step automatically.
- Missing important shell IDs or missing click bindings fail the smoke script.
- The PR report records validation proof and residual browser QA scope.

## Validation Plan

- Syntax: `node --check scripts/ui-shell-smoke.mjs`
- Smoke: `npm run ui:shell-smoke`
- Existing smoke: `node scripts/smoke.mjs`
- Security scan: `node scripts/security-scan.mjs`
- Audit: `npm audit --audit-level=high`
- Diff hygiene: `git diff --check`
- Encoding: replacement-character diff check
- Healthcheck: `./scripts/agent-healthcheck.sh`
