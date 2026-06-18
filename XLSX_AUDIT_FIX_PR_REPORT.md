# XLSX Audit Fix PR Report

## Harness Intake

- Task name: Fix XLSX dependency audit issue
- User value: Keep business-analysis uploads usable while removing the high
  severity vulnerable `xlsx` dependency from production dependencies.
- Scope:
  - Replace direct `xlsx` dependency with an audit-clean spreadsheet reader.
  - Keep existing business-analysis read behavior for XLSX, CSV, and TSV inputs.
  - Add a focused parser smoke script that creates and reads an XLSX workbook.
  - Restore stale test matrix evidence for the daily checklist if needed.
- Non-scope:
  - No crawler behavior changes.
  - No business formula changes.
  - No database, auth, payment, billing, deployment, permissions, secrets, or
    license changes.
  - No Text-To-Speech/audio behavior.
- Risk lane: Medium risk because spreadsheet parsing affects business analysis.
- Affected files:
  - `package.json`
  - `package-lock.json`
  - `app/business-analysis.mjs`
  - `scripts/spreadsheet-smoke.mjs`
  - `docs/TEST_MATRIX.md`
  - `XLSX_AUDIT_FIX_PR_REPORT.md`
- Acceptance criteria:
  - `npm audit --audit-level=high` passes.
  - No direct `xlsx` dependency remains.
  - XLSX parser smoke creates a workbook and reads expected rows.
  - Existing healthcheck passes.
  - No Text-To-Speech/audio strings or APIs are introduced.
- Validation plan:
  - `npm audit --audit-level=high`
  - `node --check app/business-analysis.mjs`
  - `node --check scripts/spreadsheet-smoke.mjs`
  - `node scripts/spreadsheet-smoke.mjs`
  - `node --check public/app.js`
  - `node --check scripts/smoke.mjs`
  - `./scripts/agent-healthcheck.sh`

## Agent B Intake Review

APPROVED. The task is medium risk but bounded to spreadsheet parsing and
dependency cleanup, with a focused parser smoke test and no high-risk areas.

## Agent B Implementation Review

APPROVED after 2 loops.

Round 1 result: REJECTED.

- Issue: replacing `xlsx` with `exceljs` removed legacy `.xls` support, but the
  UI still advertised `.xls` uploads.
- Fix: narrowed upload copy and file accept filters to `.xlsx`, `.csv`, `.tsv`,
  and `.txt`, matching the parser supported by this branch.

Round 2 result: APPROVED.

Validation completed:

- `npm audit --audit-level=high`: passed
- `node --check app/business-analysis.mjs`: passed
- `node --check scripts/spreadsheet-smoke.mjs`: passed
- `node scripts/spreadsheet-smoke.mjs`: passed
- `node --check public/app.js`: passed
- `node --check scripts/smoke.mjs`: passed
- `./scripts/agent-healthcheck.sh`: passed
- Dependency audit:
  - Direct vulnerable `xlsx` dependency removed.
  - Remaining audit output is moderate severity from transitive `exceljs`
    dependency `uuid`; no high severity issue remains.

Residual risk:

- Spreadsheet parser changed from SheetJS `xlsx` to `exceljs`, so unusual XLSX
  constructs should be monitored in real user files.
- Legacy binary `.xls` upload is no longer advertised by the UI.

## PR

- URL: https://github.com/StrangeNd/strange-tts-pc-app/pull/7
- Branch: `ai-agent/fix-xlsx-audit`
- Commit: `40d14bffc93c37a20be3ae6880d46042b8353c1c`
- Status: opened, not merged.
