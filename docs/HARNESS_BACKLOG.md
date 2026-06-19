# Harness Backlog

Use this file when a workflow improvement is useful but not in scope for the
current task.

| ID | Pain | Proposed Improvement | Status |
| --- | --- | --- | --- |
| HB-001 | Browser QA scripts are temporary and not reusable | Add a committed, non-secret local UI QA harness for public shell flows | proposed |
| HB-002 | Agent reports can drift from the test matrix | Add a report template that requires mapping every changed flow to `docs/TEST_MATRIX.md` | in_progress: `docs/templates/pr-report.md` |
| HB-003 | Crawler validation is hard to reproduce without authenticated profiles | Add sanitized fixture mode for crawler normalization and dashboard QA | in_progress: `scripts/crawler-fixture-smoke.mjs` |
