# Crawler Contract Policy Smoke PR Report

Branch: `ai-agent/crawler-contract-policy-smoke`

Target: `main`

## Task Intake

- Type: maintenance request
- Lane: tiny/normal validation-only change
- Risk: low, limited to a synthetic smoke test and story/report documentation
- Affected areas: `scripts/crawler-contract-policy-smoke.mjs`, `docs/stories/`, PR report
- Out of scope: live TikTok crawling, crawler selector changes, runtime crawler writes, raw data deletion/retention cleanup, session restore, cookie import/export, auth, payment, billing, license enforcement, deployment, database migrations, secrets, remote upload

## Why This Task

`SPEC.md` requires crawler raw snapshots and normalized metrics to remain separate, scrubbed, local-only, and missing-data-safe. The existing crawler contract smoke covers basic scrubbing and missing metrics. This PR adds a narrower policy guard for retention, remote upload, forbidden fields, layer ordering, and recursive array scrubbing without touching crawler runtime behavior.

## Implementation Summary

- Added `scripts/crawler-contract-policy-smoke.mjs`.
- Verified crawler contract layer order, raw snapshot visibility, manual retention, disabled remote upload, disabled plaintext cookie export, and forbidden sensitive field coverage.
- Verified explicit zero metrics remain available while unavailable metrics remain `null`/missing.
- Verified recursive scrubbing removes synthetic nested/array secrets while preserving safe metadata.
- Added story `docs/stories/US-023-crawler-contract-policy-smoke.md`.

## Agent B Review

- Intake review: approved. The task is validation-only, does not touch high-risk runtime behavior, and has a bounded validation plan.
- Implementation review: approved. The implementation adds focused synthetic proof only, preserves crawler runtime behavior, and does not read or print real sensitive data.

## Validation Results

- `node --check app/crawler-contract.mjs`: pass
- `node --check scripts/crawler-contract-policy-smoke.mjs`: pass
- `node scripts/crawler-contract-policy-smoke.mjs`: pass
- `node scripts/security-scan.mjs`: pass
- `npm audit --audit-level=high`: pass; existing moderate `uuid` via `exceljs` remains
- `scripts/agent-healthcheck.sh`: pass via WSL
- `git diff --check`: pass
- Added replacement/mojibake characters in diff: none found

## Manual Validation Notes

- Live TikTok crawling is not required for this validation-only PR.
- The smoke uses synthetic secret-like values only; no real cookies, tokens, credentials, machine IDs, license keys, or private session data are read or printed.
- This PR does not delete, migrate, upload, export, or retain crawler raw data.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open a draft PR into `main`.
