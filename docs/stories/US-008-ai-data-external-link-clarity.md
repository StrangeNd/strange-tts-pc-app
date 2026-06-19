# US-008: AI Data External Link Clarity

## User Outcome

As a TikTok Shop operator, I can tell that AI Data is only an external link and is not part of the local TikTok Shop crawler, dashboard, or business metrics contract.

## Scope

In scope:

- Keep existing button IDs and URL config binding intact.
- Rename the visible shell entry from `STRANGE TTS AI DATA` to `External AI Data`.
- Mark the workspace as an external/out-of-scope link for local metrics, crawler data, and business analysis.
- Update user-facing docs and test matrix evidence.

Out of scope:

- Removing the saved config field.
- Adding AI, speech, audio, Text-To-Speech, crawler, sync, auth, payment, deployment, or database behavior.
- Changing the external destination URL.

## Affected Areas

- UI: `public/index.html`, `public/app.js`
- Docs: `docs/PC_APP_USER_GUIDE.md`, `docs/TEST_MATRIX.md`, this story, PR report

## Risk Lane

Tiny/normal UI copy slice.

Risk flags:

- Desktop/window/runtime shell behavior.

## Acceptance Criteria

- `btnAiData` remains present for existing event binding.
- The visible menu label says `External AI Data`.
- The AI Data workspace states that the link is external and out of scope for local metrics, crawler data, and business analysis.
- Opening the link still uses the existing `openAiDataUrl` button and saved URL field.
- No Text-To-Speech/audio behavior is added.
- Button ID check, syntax, smoke, browser UI QA, and healthcheck pass.

## Validation Plan

- Syntax: `node --check public/app.js`
- Smoke: `node scripts/smoke.mjs`
- Button IDs: verify bound IDs exist in `public/index.html`
- Audit: replacement-character diff check and Text-To-Speech/audio scope search for added lines
- UI QA: open local app and inspect External AI Data workspace
- Healthcheck: `./scripts/agent-healthcheck.sh`
