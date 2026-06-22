# US-021 - Desktop Launch Smoke

## Story

As a non-technical TikTok Shop operator,
I want the local desktop shortcut/start scripts to stay wired to the app-window launch flow,
so that opening the app from Windows remains simple and does not require WSL or manual npm steps.

## Intake

- Type: maintenance request
- Lane: tiny
- Affected areas: desktop launch smoke, story, PR report
- Risk: low, validation-only

## Scope

- Add a static smoke for the existing desktop launch scripts.
- Verify the shortcut points to `scripts/open-desktop-app.ps1`.
- Verify the opener checks local health, starts `npm` from the local app directory, and calls `/api/app/open-dashboard-app`.
- Verify the start wrapper runs `scripts/start-pc-app.mjs --production`.
- Verify npm entry points keep pointing to the desktop opener, shortcut creator, app-window launcher, and desktop launch smoke.
- Verify README keeps the Windows-local launch guidance and WSL UNC warning.

## Non-Scope

- No desktop runtime behavior changes.
- No license, auth, session, cookie, payment, billing, deployment, database migration, production infrastructure, or release automation changes.
- No browser/UI automation in this slice; live desktop launch remains manual/platform QA.

## Acceptance Criteria

- `scripts/desktop-launch-smoke.mjs` passes.
- The smoke fails if the shortcut no longer targets `open-desktop-app.ps1`.
- The smoke fails if the opener stops using localhost health or dashboard app-window launch.
- The smoke fails if npm desktop/start/shortcut entry points drift away from the intended local launch scripts.
- The smoke fails if production launch docs no longer warn against WSL UNC runtime.

## Validation

- `node --check scripts/desktop-launch-smoke.mjs`
- `node scripts/desktop-launch-smoke.mjs`
- `node scripts/security-scan.mjs`
- `scripts/agent-healthcheck.sh`
