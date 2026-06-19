# AI Data External Link PR Report

Branch: `ai-agent/ai-data-out-of-scope-clarity`

Target: `main`

## Task Intake

- Type: spec slice
- Lane: tiny/normal UI copy slice
- Risk: low, limited to shell labels and docs
- Affected areas: `public/index.html`, `public/app.js`, `docs/PC_APP_USER_GUIDE.md`, `docs/TEST_MATRIX.md`, `docs/stories/`
- Out of scope: AI feature work, speech/audio/Text-To-Speech behavior, crawler changes, sync changes, auth, sessions, cookies, payment/billing systems, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

SPEC.md says AI Data, if still present, must be removed or treated as out of scope/external. Main still had a `STRANGE TTS AI DATA` shell entry that looked like a native app feature. This PR keeps the existing URL opener but makes the surface clearly external and out of scope for local TikTok Shop metrics, crawler data, and business analysis.

## Implementation Summary

- Renamed the menu card to `External AI Data` while preserving `btnAiData`.
- Renamed runtime status label to `External AI Data`.
- Updated the AI Data workspace heading, URL label, open button, and missing-URL output copy.
- Updated the user guide.
- Added story and test matrix evidence.

## Validation Results

- `node --check public/app.js`: pass
- `node scripts/smoke.mjs`: pass, production smoke in licensed mode
- Bound button ID verification: pass; shell IDs including `btnAiData` remain present
- Text-To-Speech/audio added-line check: pass; no speech/audio behavior added in code diff
- Replacement-character diff check: pass
- `git diff --check`: pass
- Browser/UI QA on `http://127.0.0.1:48736/`: pass; External AI Data menu/workspace visible, old `STRANGE TTS AI DATA` label absent, no console errors
- `./scripts/agent-healthcheck.sh`: pass

## Manual Validation Notes

- This PR does not remove the saved `aiDataUrl` config field or change the configured destination URL.
- This PR does not add AI, speech, audio, Text-To-Speech, crawler, auth, payment, deployment, or database behavior.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
