# US-022 - Audit Log Redaction Smoke

## Story

As a TikTok Shop operator and maintainer,
I want audit logs to preserve useful metadata while redacting sensitive values,
so that local reports and PR evidence do not expose cookies, tokens, credentials, sessions, headers, or private data.

## Intake

- Type: maintenance request
- Lane: tiny
- Affected areas: targeted smoke, story, PR report
- Risk: low, validation-only

## Scope

- Add a temporary-directory smoke for `app/audit-log.mjs`.
- Verify sensitive keys are redacted recursively.
- Verify arrays are summarized instead of logged raw.
- Verify safe cookie metadata fields stay visible: `cookieCount`, `cookieStorage`, `cookieUpdatedAt`.

## Non-Scope

- No runtime audit-log implementation changes.
- No real shop data, cookies, profiles, crawler outputs, production data, or `.env` files are read.
- No auth, session, cookie import/export, payment, billing, deployment, database migration, production infrastructure, release automation, or user data deletion/export/retention changes.

## Acceptance Criteria

- `scripts/audit-log-redaction-smoke.mjs` passes.
- The smoke fails if secret-like sample values are written to `audit.ndjson`.
- The smoke proves safe cookie metadata remains visible without logging raw cookie/session/token values.

## Validation

- `node --check scripts/audit-log-redaction-smoke.mjs`
- `node scripts/audit-log-redaction-smoke.mjs`
- `node scripts/security-scan.mjs`
- `scripts/agent-healthcheck.sh`
