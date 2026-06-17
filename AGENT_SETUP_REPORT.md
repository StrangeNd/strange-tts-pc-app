# Agent Setup Report

Generated: 2026-06-16

## Repository

- Git root: parent workspace repository
- Working project: `strange-tts-pc-app`
- Current setup branch: `ai-agent-system/setup`
- GitHub remote: not configured for this project/repository at inspection time

## Stack Detected

- Runtime: Node.js ESM (`"type": "module"`)
- Minimum Node version: `>=22.12`
- Package manager: npm (`package-lock.json` present)
- App type: local desktop/web app shell for a Chrome/Edge extension runtime
- Web UI files:
  - `public/index.html`
  - `public/app.js`
  - `extension/pages/dashboard.html`
  - `extension/src/dashboard.js`
- Backend/server files:
  - `app/server.mjs`
  - `scripts/start-pc-app.mjs`

## Existing Scripts

- `npm start`: starts local PC app server
- `npm run app` / `npm run desktop`: opens desktop app
- `npm run pc:start`: starts and launches app
- `npm run stop`: stops local app
- `npm run prod`: starts production local mode
- `npm run build`: runs package/build script
- `npm run prod:smoke`: runs existing smoke script
- `npm run security:scan`: runs local security scan
- `npm run parity:audit`: runs parity audit

## Test Setup Detected

- No standard `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, or `test:e2e` npm scripts were present.
- Existing smoke script: `scripts/smoke.mjs`.
- Browser/UI QA should use Codex Browser or the local app window instead of Playwright.

## CI Detected

- No `.github/workflows` directory existed in this project.
- Added `.github/workflows/agent-ci.yml` for pull request checks.

## Safety Notes

- This setup does not push, deploy, auto-merge, or alter production resources.
- Agent loop files require high-risk changes to stop for human approval.
- Healthcheck scripts intentionally skip missing commands instead of inventing checks.
- Test credentials must come from environment variables; no secrets are hardcoded.
