# US-019 - AI Data External Scope Smoke

## Story

As a TikTok Shop operator,
I want the PC app to keep AI Data clearly marked as an external link,
so that I do not mistake it for local crawler, dashboard, or business analysis functionality.

## Intake

- Type: maintenance request
- Lane: tiny
- Affected areas: targeted smoke, story, PR report
- Risk: low, validation-only

## Scope

- Add a smoke check for the existing `External AI Data` shell and workspace contract.
- Verify `btnAiData` remains present for existing binding.
- Verify the workspace says the link is external and out of scope for local metrics, crawler data, and business analysis.
- Verify the open action still uses `window.open` with `noopener,noreferrer`.

## Non-Scope

- No UI runtime behavior changes.
- No AI feature work.
- No crawler, business metric, sync, auth, session, cookie, payment, billing, deployment, database migration, or secret handling changes.
- No destination URL changes.

## Acceptance Criteria

- `scripts/ai-data-external-scope-smoke.mjs` passes against the current public shell.
- The smoke fails if the public shell reverts to `STRANGE TTS AI DATA`.
- The smoke fails if obvious native AI Data crawler/metrics/audio markers are introduced in `public/app.js`.

## Validation

- `node --check scripts/ai-data-external-scope-smoke.mjs`
- `node scripts/ai-data-external-scope-smoke.mjs`
- `node scripts/ui-shell-smoke.mjs`
- `node scripts/security-scan.mjs`
- `scripts/agent-healthcheck.sh`
