# US-038 - PR Report Sensitive Content Smoke

## Story

As an agent preparing repeated PR evidence,
I want archived PR reports to be scanned for raw secret-like values,
so that validation notes do not accidentally expose sensitive local data.

## Intake

- Type: maintenance request
- Lane: tiny
- Affected areas: harness smoke, healthcheck, PR report archive, story, PR report
- Risk: low, developer tooling only

## Scope

- Add a smoke check that scans committed `*_PR_REPORT.md` files.
- Fail when report evidence contains raw-looking private keys, bearer values, cookie/session assignments, API keys, or token-like assignments.
- Keep normal risk wording about cookies, tokens, sessions, and credentials allowed.
- Wire the smoke into npm and `scripts/agent-healthcheck.sh`.

## Non-Scope

- No product runtime behavior changes.
- No UI, crawler, business logic, auth, session, cookie import/export, payment, billing, deployment, database migration, production infrastructure, or release automation changes.
- No real shop data, browser profile, `.env`, private key, cookie, token, credential, machine ID, license key, or session material is read.
- No `docs/TEST_MATRIX.md` change because this strengthens the existing Agent loop proof row without adding user-visible behavior.

## Acceptance Criteria

- `scripts/pr-report-sensitive-content-smoke.mjs` scans committed PR reports.
- The smoke fails on raw-looking secret evidence while allowing policy/risk wording.
- The smoke is available as `npm run harness:pr-report-sensitive-smoke`.
- The smoke runs through `scripts/agent-healthcheck.sh`.

## Validation

- `node --check scripts/pr-report-sensitive-content-smoke.mjs`
- `node scripts/pr-report-sensitive-content-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
