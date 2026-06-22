# US-031 - Crawler Retention Contract

## Story

As a TikTok Shop operations maintainer,
I want each crawler snapshot contract to record a local raw-data retention review deadline,
so that raw snapshots remain local, scrubbed, and intentionally managed instead of growing without policy.

## Acceptance Criteria

- Crawler snapshot contracts include a local-only retention policy.
- Raw snapshot retention defaults to 30 days.
- The contract records `startedAt` and a derived `expiresAt` review deadline.
- The policy does not automatically delete crawler data.
- The policy requires review before deletion.
- The policy keeps remote upload disabled.
- Raw snapshots remain hidden by default from non-technical users.
- Existing scrub, forbidden-field, raw/normalized separation, and missing-not-zero policies remain intact.

## Validation

- `node --check app/crawler-contract.mjs`
- `node --check scripts/crawler-contract-smoke.mjs`
- `node --check scripts/crawler-contract-policy-smoke.mjs`
- `node --check scripts/crawler-retention-contract-smoke.mjs`
- `node scripts/crawler-contract-smoke.mjs`
- `node scripts/crawler-contract-policy-smoke.mjs`
- `node scripts/crawler-retention-contract-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
