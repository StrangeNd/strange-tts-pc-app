# US-011 - Crawler Fixture Smoke

## Story

As an operator validating crawler changes,
I want a repeatable local Seller Center fixture run,
so that crawler normalization and dashboard reads can be tested without an authenticated browser profile.

## Acceptance Criteria

- The fixture run writes the same raw, normalized, log, latest, report, and snapshot-contract files used by live Seller Center runs.
- Secret-like query params, request bodies, cookies, authorization fields, CSRF tokens, and device identifiers are scrubbed from generated outputs.
- Safe business values remain available for downstream dashboard cards.
- Missing metrics remain explicit missing/null data, not invented zeroes.
- The smoke runs against a temporary directory and does not read or write real shop cookies, profiles, or production data.

## Validation

- `npm run crawler:fixture-smoke`
- `node scripts/crawler-contract-smoke.mjs`
- `scripts/agent-healthcheck.sh`
