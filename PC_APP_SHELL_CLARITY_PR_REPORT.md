# PC App Shell Clarity PR Report

## Harness Intake

- Task name: Clarify PC app shell for non-technical users
- User value: A non-technical operator can open the app and quickly understand
  where to start, which button opens the dashboard, which button opens Seller
  Ads, and where local status/logs live.
- Scope:
  - Rewrite `public/index.html` shell copy as clean Vietnamese/English product
    labels.
  - Keep the same element IDs and existing JavaScript behavior.
  - Add a compact "Start here" hint block on the shell.
  - Update package/architecture wording away from ambiguous "Strange TTS"
    product phrasing where safe.
- Non-scope:
  - No crawler logic changes.
  - No spreadsheet parser changes.
  - No backend/database changes.
  - No auth, payment, billing, deployment, permissions, secrets, or license
    changes.
  - No Text-To-Speech/audio behavior.
- Risk lane: Low risk UI/copy/docs cleanup.
- Affected files:
  - `public/index.html`
  - `public/styles.css`
  - `package.json`
  - `docs/ARCHITECTURE.md`
  - `PC_APP_SHELL_CLARITY_PR_REPORT.md`
- Acceptance criteria:
  - Shell title and hero clearly say TikTok Shop PC app.
  - Main actions are readable for non-technical users.
  - Existing button IDs remain unchanged.
  - No Text-To-Speech/audio APIs or product drift are introduced.
  - Syntax, smoke, and healthcheck pass.
- Validation plan:
  - `node --check public/app.js`
  - `node --check scripts/smoke.mjs`
  - `./scripts/agent-healthcheck.sh`
  - Static DOM check for required IDs and clean shell copy.

## Agent B Intake Review

APPROVED. The task is low risk and improves non-technical usability without
touching runtime behavior or high-risk areas.

## Agent B Implementation Review

APPROVED after 2 loops.

Round 1 result: REJECTED.

- Issue: the first static clean-copy assertion was too broad and treated valid
  Vietnamese/Windows console rendering as mojibake.
- Fix: retested the HTML through WSL/Python with UTF-8 decoding and checked for
  replacement characters plus known mojibake substrings instead of banning
  valid Vietnamese text.

Round 2 result: APPROVED.

Validation completed:

- `node --check public/app.js`: passed
- `node --check scripts/smoke.mjs`: passed
- `./scripts/agent-healthcheck.sh`: passed
- Static DOM check: passed
  - required app IDs are still present
  - shell copy contains `Strange TikTok Shop`
  - shell copy contains `Bắt đầu đơn giản`
  - no replacement characters or known mojibake snippets are present in
    `public/index.html`
- Domain audit: no Text-To-Speech/audio APIs were introduced.

Audit note:

- This branch intentionally does not include PR #7, so the existing `xlsx`
  high-severity audit warning still appears in healthcheck output from `main`.
  PR #7 handles that separately.

## PR

- URL: https://github.com/StrangeNd/strange-tts-pc-app/pull/8
- Branch: `ai-agent/clarify-pc-app-shell`
- Commit: `01207b115992fd83b0d050e52608e609019f06bb`
- Status: opened, not merged.
