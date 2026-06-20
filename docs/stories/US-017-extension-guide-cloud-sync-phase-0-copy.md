# US-017 - Extension Guide Cloud Sync Phase 0 Copy

## Story

As a TikTok Shop operator reading the bundled extension guide,
I want Cloud Sync instructions to match the PC app Phase 0 local-backup scope,
so that I do not mistake legacy extension Cloud Sync controls for approved remote cookie/session upload behavior.

## Intake

- Type: change request
- Lane: tiny
- Affected areas: extension guide copy, validation smoke, PR report
- Risk: low, docs/copy plus smoke only

## Scope

- Clarify that PC app Cloud Sync Phase 0 is local backup / import-export only.
- Warn operators not to upload cookies, sessions, tokens, private browser state, machine IDs, credentials, or license keys.
- Mark legacy extension Cloud Sync controls as outside PC app Phase 0 unless a future approved Cloud Sync PR changes that.
- Add a smoke check that rejects the old remote-cookie Cloud Sync guide copy.

## Non-Scope

- No runtime Cloud Sync implementation changes.
- No cookie/session restore, cookie import/export, auth, payment, billing, deployment, database migration, or release automation changes.
- No remote endpoint, account system, or production backend changes.

## Acceptance Criteria

- The extension guide no longer tells users to upload cookie exports to a server for normal PC app Cloud Sync Phase 0 use.
- The guide points users to PC app local backup/import-export for Phase 0.
- The guide says true Cloud Sync requires a dedicated PR and approval.
- A targeted smoke fails if legacy remote-cookie Cloud Sync wording is restored.

## Validation

- `node --check scripts/extension-guide-cloud-copy-smoke.mjs`
- `node scripts/extension-guide-cloud-copy-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/ui-shell-smoke.mjs`
- `node scripts/security-scan.mjs`
- `scripts/agent-healthcheck.sh`
