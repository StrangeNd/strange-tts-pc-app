# US-023 - Crawler Contract Policy Smoke

## Story

As a TikTok Shop operations maintainer,
I want crawler storage policy assumptions covered by a focused smoke test,
so that raw snapshots, normalized metrics, and reports stay local, scrubbed, and missing-data-safe as crawler work continues.

## Acceptance Criteria

- The crawler snapshot contract keeps raw, parsed, normalized, derived, and dashboard/report layers in the documented order.
- Raw snapshot and parsed source layers remain scrubbed.
- Raw snapshots are not shown by default to non-technical users.
- Normalized metrics preserve the `missing-not-zero` policy.
- Derived metrics remain recomputable from normalized metrics.
- Retention policy remains manual and does not claim automatic deletion.
- Security policy keeps plaintext cookie export and remote upload disabled.
- Forbidden fields include cookies, tokens, credentials, authorization headers, machine IDs, and license keys.
- Explicit zero metric values remain available while unavailable values remain missing/null.
- Recursive payload scrubbing covers arrays and nested objects without removing safe metadata.

## Validation

- `node --check app/crawler-contract.mjs`
- `node --check scripts/crawler-contract-policy-smoke.mjs`
- `node scripts/crawler-contract-policy-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
