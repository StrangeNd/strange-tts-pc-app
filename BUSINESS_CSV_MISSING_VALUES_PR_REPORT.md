# Business CSV Missing Values PR Report

## Task Intake

Type: change request
Lane: normal
Affected areas: browser-side business analysis CSV export, smoke scripts, validation docs
Proof: syntax checks, CSV missing fixture smoke, existing business smokes, security scan, high audit, agent healthcheck
Story: `docs/stories/US-037-business-csv-missing-values.md`

## User Value

Operators can download a business-plan CSV without missing source metrics being silently converted into numeric zeroes.

## Scope

- Preserve unavailable KPI, Ads Spend, refund/cancel, content, affiliate, and break-even ROI fields as `missing` in the CSV export.
- Keep explicit source-provided zero values as zero.
- Add a smoke fixture that exercises both missing and explicit-zero CSV cases.

## Non-Scope

- Backend business calculations.
- Spreadsheet parsing rules.
- Auth, sessions, cookies, payments, billing, deployment, database migrations, production infrastructure, or user data deletion/export/retention.

## Risk

Normal. This touches browser-side presentation of generated CSV output and validation only. It does not handle secrets, sessions, cookies, auth, payment, production deployment, or database state.

## Agent B Review

Intake approved. The change is aligned with SPEC missing-data policy, scoped to CSV presentation, and includes targeted proof plus existing business-analysis regression smokes.

## Validation Plan

- `node --check public/app.js`
- `node --check scripts/business-csv-missing-smoke.mjs`
- `node scripts/business-csv-missing-smoke.mjs`
- `node scripts/ads-spend-missing-smoke.mjs`
- `node scripts/spreadsheet-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`

## Validation Results

Passed via WSL repo path because the Windows UNC sandbox helper repeatedly failed with `helper_unknown_error` during normal command execution.

- `node --check public/app.js`
- `node --check scripts/business-csv-missing-smoke.mjs`
- `node scripts/business-csv-missing-smoke.mjs`
- `node scripts/ads-spend-missing-smoke.mjs`
- `node scripts/spreadsheet-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high` passed high threshold; existing moderate `uuid`/`exceljs` advisories remain.
- `bash scripts/agent-healthcheck.sh`
