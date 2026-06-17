# Remove Speech Shell PR Report

## Harness Intake

- Task name: Remove Text-To-Speech shell drift
- User value: Users and future agents see a TikTok Shop operations PC app, not
  an audio/Text-To-Speech app.
- Scope:
  - Remove Text-To-Speech/audio UI from the public PC app shell.
  - Remove `speechSynthesis` and recent speech text history code.
  - Keep the app default workspace on the GMV Max dashboard workflow.
  - Update smoke expectations if product title changes.
  - Update validation docs for the domain guard.
- Non-scope:
  - No real TikTok Shop API integration.
  - No crawler changes.
  - No auth, payment, billing, database, deployment, or secrets changes.
  - No extension TikTok video playback/product-viewer changes.
- Risk lane: Low risk UI/docs cleanup.
- Affected files:
  - `public/index.html`
  - `public/app.js`
  - `public/styles.css`
  - `scripts/smoke.mjs`
  - `docs/TEST_MATRIX.md`
  - `docs/product/PRODUCT_CONTRACT.md`
  - `REMOVE_SPEECH_SHELL_PR_REPORT.md`
- Acceptance criteria:
  - No `speechSynthesis`, `SpeechSynthesisUtterance`, `btnTtsPreview`,
    `renderTtsPreviewWorkspace`, or `.tts-*` public app shell code remains.
  - App opens to the dashboard workspace.
  - Product copy says TikTok Shop operations, not Text-To-Speech.
  - Smoke and healthcheck pass.
- Validation plan:
  - `node --check public/app.js`
  - `node --check scripts/smoke.mjs`
  - `./scripts/agent-healthcheck.sh`
  - Repository audit for Text-To-Speech-specific public app code.

## Agent B Intake Review

APPROVED. The task is correctly scoped to remove wrong-domain product drift and
does not add external integration or high-risk behavior.

## Agent B Implementation Review

APPROVED.

Validation completed:

- `node --check public/app.js`: passed
- `node --check scripts/smoke.mjs`: passed
- `./scripts/agent-healthcheck.sh`: passed
- Static UI smoke: passed
  - Correct product title rendered.
  - Text-To-Speech menu entry removed.
  - Dashboard entry remains available.
  - TikTok Shop operations copy is present.

Domain audit result:

- Public app shell no longer contains `speechSynthesis`,
  `SpeechSynthesisUtterance`, `btnTtsPreview`, `renderTtsPreviewWorkspace`,
  `tts-history`, or `.tts-*` Text-To-Speech UI classes.
- Remaining mentions of speech/voice/pitch are domain guard text in docs.

## PR

Pending.
