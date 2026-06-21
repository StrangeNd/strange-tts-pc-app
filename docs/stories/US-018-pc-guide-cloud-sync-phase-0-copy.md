# US-018 - PC Guide Cloud Sync Phase 0 Copy

## Story

As a non-technical TikTok Shop operator reading the PC app guide,
I want Cloud Sync to be described as local backup/import-export in Phase 0,
so that I do not configure or expect remote Cloud Sync without a dedicated approved feature.

## Intake

- Type: change request
- Lane: tiny
- Affected areas: PC app user guide, targeted docs smoke, PR report
- Risk: low, docs/copy plus smoke only

## Scope

- Clarify the `Cloud Sync` button description in `docs/PC_APP_USER_GUIDE.md`.
- Add a short Cloud Sync Phase 0 section for local backup/import-export.
- State that cookies, tokens, credentials, machine IDs, license keys, sessions, and private browser state must not be included in Phase 0 backups.
- Add a docs smoke that rejects the old endpoint-sync wording.

## Non-Scope

- No runtime Cloud Sync, cookie/session, auth, payment, billing, deployment, database migration, production infrastructure, or release automation changes.
- No change to existing shop cookie import/runtime behavior.

## Acceptance Criteria

- The PC app guide says Cloud Sync Phase 0 is local backup/import-export.
- The guide no longer describes Cloud Sync as endpoint sync configuration.
- The guide warns that sensitive session/cookie/private browser material is not part of Phase 0 backups.
- A targeted smoke fails if the old endpoint-sync wording returns.

## Validation

- `node --check scripts/pc-guide-cloud-copy-smoke.mjs`
- `node scripts/pc-guide-cloud-copy-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/security-scan.mjs`
- `scripts/agent-healthcheck.sh`
