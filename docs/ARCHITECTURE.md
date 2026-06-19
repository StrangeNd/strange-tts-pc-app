# Architecture Notes

This is a local desktop app shell plus bundled Chrome/Edge extension runtime for
Strange TikTok Shop workflows. `TTS` is a legacy acronym in file names and
runtime labels; it does not mean Text-To-Speech in this repository.

## Current Surfaces

- Desktop app shell: PowerShell launchers and local Node server.
- Public app UI: `public/index.html`, `public/app.js`, `public/styles.css`.
- Extension/dashboard runtime: bundled extension pages and managed browser
  profile.
- TikTok crawler: scripts and browser automation that use an authenticated local
  profile.
- Packaging/license utilities: scripts for release, license, smoke, and security
  checks.
- Agent workflow: `agents/`, `AGENT_QUICKSTART.md`, and harness docs.

## Safe Edit Zones

Low-risk changes usually live in:

- `public/` UI copy, layout, and browser-local behavior.
- `agents/` prompts and process docs.
- `docs/` product, story, decision, and validation docs.
- Focused smoke/QA scripts that do not alter runtime data.

Medium-risk changes usually live in:

- Crawler selectors and API discovery.
- Data normalization and business analysis calculations.
- Cache behavior and local runtime state.
- Desktop window behavior.

High-risk changes require approval:

- License enforcement and activation.
- Cookie handling, profile data, encrypted stores, and raw crawler data.
- Auth/admin permissions.
- Database migrations or destructive cleanup.
- Deployment, packaging distribution, and production release settings.

## Boundary Rules

- Parse unknown external data before using it in analysis calculations.
- Keep raw crawler output separate from normalized reports.
- Do not mix UI presentation fixes with business-calculation changes unless the
  story explicitly covers both.
- Do not weaken license, admin, or cookie protections as a convenience for tests.
- Use environment variables or user-provided local config for credentials; never
  hardcode secrets.

## Validation Ladder

Prefer the smallest proof that covers the risk:

1. Syntax check (`node --check`, shell parse where practical).
2. Existing healthcheck (`scripts/agent-healthcheck.sh`).
3. Targeted smoke script or local API call.
4. Browser/UI QA through Codex Browser, Chrome, Edge CDP, or local app window.
5. Manual evidence in `BUG_REPORT.md` or `FINAL_AGENT_RUN_REPORT.md`.
