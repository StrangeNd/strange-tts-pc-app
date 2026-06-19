# US-005: Crawler Snapshot Contract

## User Outcome

As a TikTok Shop operator or maintainer, I can trust crawler outputs because raw snapshots, normalized metrics, and derived/dashboard data have a clear local-only contract, secret scrubbing, source/status metadata, and missing-data rules.

## Scope

In scope:

- Define a crawler snapshot contract for raw, parsed, normalized, derived, and dashboard/report layers.
- Scrub sensitive fields before writing crawler raw API responses, API logs, action logs, UI snapshots, and Compass raw files.
- Keep normalized missing metrics as missing/null instead of zero.
- Add a fixture-based smoke test for crawler contract behavior and secret scrubbing.
- Record that retention cleanup is manual in this PR and does not delete local data.

Out of scope:

- Live TikTok crawling.
- New crawler selectors or automatic crawler scheduling.
- Deleting, pruning, or migrating existing crawler raw data.
- Cookie/session restore, cookie import/export changes, auth, permissions, payment, billing, license enforcement, deployment, database migrations, or secrets.
- Uploading crawler data to any remote service.

## Affected Areas

- Code: `app/crawler-contract.mjs`, `app/tiktokshop-crawler.mjs`
- Scripts: `scripts/crawler-contract-smoke.mjs`
- Docs: `docs/TEST_MATRIX.md`, this story, PR report

## Risk Lane

Normal with stronger validation.

Risk flags:

- Data normalization/parsing.
- Crawler output/log safety.
- Existing behavior with weak proof.

This slice avoids high-risk retention deletion, raw data migration, cookie/session handling, and live third-party crawling.

## Acceptance Criteria

- Crawler raw API response writes scrub sensitive cookie/token/auth/session-like fields before saving.
- Crawler UI snapshots and logs are scrubbed before saving.
- Seller Center crawl runs write `snapshot-contract.json`.
- Compass crawl writes `snapshot-contract.json`.
- Normalized metric helpers preserve missing values as `null` with `status: missing`.
- A smoke script proves secret scrubbing and missing-data behavior without authenticated TikTok profiles.

## Validation Plan

- Syntax: `node --check app/crawler-contract.mjs`, `node --check app/tiktokshop-crawler.mjs`, `node --check scripts/crawler-contract-smoke.mjs`
- Smoke: `node scripts/crawler-contract-smoke.mjs`
- Existing smoke: `node scripts/smoke.mjs`
- Audit: `npm audit --audit-level=high`
- Healthcheck: `./scripts/agent-healthcheck.sh`
- Manual note: live crawler validation remains manual because it requires an authenticated local TikTok Shop profile.
