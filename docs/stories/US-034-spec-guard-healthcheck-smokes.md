# US-034 - Spec Guard Healthcheck Smokes

## Story

As a repository maintainer,
I want merged spec guard smoke scripts to run through npm and the agent healthcheck,
so that important SPEC invariants do not drift after their PRs merge.

## Acceptance Criteria

- Merged smoke scripts for desktop launch, shop health, shop session safety, Ads Spend missing data, legacy XLS scope, daily checklist scope, crawler contract policy, crawler fixture, session restore gate, and video downloader safety are available as npm scripts.
- `scripts/agent-healthcheck.sh` runs the extended smoke set when the npm scripts are present.
- The healthcheck keeps existing optional script behavior and still skips missing scripts cleanly.
- The change does not alter product runtime behavior.

## Validation

- `node --check scripts/test-matrix-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- Targeted npm smoke scripts
- `scripts/agent-healthcheck.sh`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
