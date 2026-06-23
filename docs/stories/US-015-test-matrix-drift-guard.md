# US-015 - Test Matrix Drift Guard

## Story

As an agent maintaining the TikTok Shop PC app,
I want the test matrix to reject duplicate behavior rows and missing evidence,
so that merged PRs do not leave stale planned rows beside implemented proof.

## Acceptance Criteria

- `docs/TEST_MATRIX.md` has one row per behavior area.
- Implemented/in-progress rows do not keep stale `planned | none` duplicates.
- A smoke script fails when area names are duplicated.
- The smoke script fails when a row has empty critical flow, proof, status, or evidence.
- The smoke script fails when a backticked local evidence path such as `scripts/...`, `docs/...`, or `*_PR_REPORT.md` does not exist.
- The smoke script fails when evidence is exactly `none`.
- Agent healthcheck runs the test matrix smoke before feature-specific smoke checks.

## Validation

- `node --check scripts/test-matrix-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `bash -n scripts/agent-healthcheck.sh`
- `scripts/agent-healthcheck.sh`
