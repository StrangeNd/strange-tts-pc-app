# US-024 - Session Restore Gate Smoke

## Story

As a TikTok Shop agency operator,
I want the Authorized Local Session Restore approval gate covered by a static smoke test,
so that future work cannot quietly turn a planning-only status into runtime session restore behavior.

## Acceptance Criteria

- The spec, ADR, and story continue to use the approved wording `Authorized Local Session Restore`.
- The gate documents explicit human approval, dedicated PR scope, local-only storage boundary, encryption-at-rest approach, user-facing enable/disable control, kill switch behavior, metadata-only audit trail, no-plaintext-export proof, and authorized shop/profile scope.
- The `Needs session restore` UI status remains non-opening metadata only.
- The UI keeps copy that says restore must happen in a future approved PR.
- The local server does not add a session restore endpoint or handler marker.
- Public UI and server runtime do not frame session restore as a login bypass.

## Validation

- `node --check scripts/session-restore-gate-smoke.mjs`
- `node scripts/session-restore-gate-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
