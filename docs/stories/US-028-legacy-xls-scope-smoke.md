# US-028 - Legacy XLS Scope Smoke

## Story

As a TikTok Shop operator,
I want upload surfaces to advertise only supported spreadsheet formats,
so that legacy `.xls` files are not implied to work unless a supported parser is added.

## Acceptance Criteria

- User-facing upload copy does not advertise legacy `.xls`.
- Business upload inputs advertise `.xlsx`, `.csv`, `.tsv`, and `.txt`.
- Price upload copy advertises supported local file formats only.
- Business-analysis code keeps `.xlsx` parser coverage through `exceljs`.
- Business-analysis code keeps delimited parser coverage for `.csv`, `.tsv`, and `.txt`.
- Business-analysis code does not claim explicit legacy `.xls` support.

## Validation

- `node --check app/business-analysis.mjs`
- `node --check scripts/legacy-xls-scope-smoke.mjs`
- `node scripts/legacy-xls-scope-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
