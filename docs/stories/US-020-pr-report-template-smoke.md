# US-020 - PR Report Template Smoke

## Story

As an agent working through repeated PRs,
I want the PR report template to keep test-matrix mapping and risk-review sections,
so that future changes do not drift away from required proof.

## Intake

- Type: harness improvement
- Lane: tiny
- Affected areas: harness template, harness backlog, targeted smoke, PR report
- Risk: low, docs/developer-tooling only

## Scope

- Add a smoke check for `docs/templates/pr-report.md`.
- Verify the template keeps task intake, test matrix mapping, validation, risk review, and PR checklist sections.
- Verify the template keeps no-main-push and no-auto-merge checklist items.
- Mark HB-002 implemented with template and smoke evidence.

## Non-Scope

- No product runtime changes.
- No UI, crawler, business logic, auth, session, cookie, payment, billing, deployment, database migration, production infrastructure, or release automation changes.
- No durable harness database initialization.

## Acceptance Criteria

- `scripts/pr-report-template-smoke.mjs` passes.
- The smoke fails if the template loses the test matrix mapping table or row-missing guidance.
- The smoke fails if the template loses the core risk review or no-auto-merge checklist.
- HB-002 is marked implemented with evidence.

## Validation

- `node --check scripts/pr-report-template-smoke.mjs`
- `node scripts/pr-report-template-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/security-scan.mjs`
- `scripts/agent-healthcheck.sh`
