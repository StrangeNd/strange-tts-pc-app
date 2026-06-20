# US-013 - Cloud Sync Phase 0 Local Backup

## Story

As a TikTok Shop operator,
I want Cloud Sync Phase 0 to create a local backup file instead of using a remote endpoint,
so that I can preserve app settings and shop references without introducing remote storage, accounts, auth, or billing.

## Acceptance Criteria

- Cloud Sync copy clearly says Phase 0 is local backup only.
- The app does not ship a default remote Cloud Sync URL.
- Remote Cloud Sync URLs are ignored by app config normalization.
- Operators can download a local JSON backup with app settings and safe shop reference metadata.
- Operators can import a local backup to restore non-sensitive app settings.
- Shop records in backups are reference-only and are not imported as profile/session/cookie state.
- Backup export does not include cookies, tokens, credentials, machine IDs, license keys, or private browser state.
- No remote upload, account login, auth, payment/billing, deployment, database migration, or session restore behavior is added.

## Validation

- `node --check app/app-config.mjs`
- `node --check public/app.js`
- `node --check scripts/cloud-sync-local-smoke.mjs`
- `node scripts/cloud-sync-local-smoke.mjs`
- `node scripts/ui-shell-smoke.mjs`
- `scripts/agent-healthcheck.sh`
