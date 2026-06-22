# US-035 - Cloud Sync Import Scope Smoke

## Story

As a TikTok Shop operator,
I want Cloud Sync Phase 0 imports to restore only safe local app settings,
so that backup files cannot recreate shop profiles, cookies, sessions, or private browser state.

## Acceptance Criteria

- Local backup export uses schema `strange-tiktokshop-local-backup/v1` and mode `local-only`.
- Shop records in backups are safe reference metadata only.
- Backup export does not include cookies, cookie JSON/path input, tokens, credentials, machine IDs, license keys, private browser state, or session payloads.
- Local backup import rejects non-Phase-0 schemas or non-local modes.
- Local backup import restores app config only.
- Local backup import does not create shop profiles or import cookies.
- Cloud Sync UI keeps remote cloud off and warns that sensitive data is excluded.

## Validation

- `node --check scripts/cloud-sync-import-scope-smoke.mjs`
- `node scripts/cloud-sync-import-scope-smoke.mjs`
- `node scripts/cloud-sync-local-smoke.mjs`
- `node scripts/test-matrix-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
