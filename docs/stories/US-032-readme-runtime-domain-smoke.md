# US-032 - README Runtime Domain Smoke

## Story

As a TikTok Shop operations maintainer,
I want README and user-guide wording to stay guarded by a smoke test,
so that future changes do not reintroduce Text-To-Speech confusion or unsafe WSL/UNC launch guidance.

## Acceptance Criteria

- README title names TikTok Shop rather than generic TTS.
- README explains that `TTS` is a legacy TikTok Shop acronym, not Text-To-Speech.
- README and user guide only mention `Strange TTS PC App` when the nearby context frames it as a legacy runtime/shortcut label tied to TikTok Shop operations.
- README keeps Windows-local production runtime guidance.
- README warns against running production from `\\wsl.localhost\...`.
- README keeps the Windows start script path and labels localhost as internal/debug API.
- README keeps encrypted local cookie storage guidance.
- User guide preserves the Text-To-Speech non-goal and WSL UNC warning.
- Docs do not advertise speech synthesis, voice selector, audio preview workspace, or generated audio workflows.

## Validation

- `node --check scripts/readme-runtime-domain-smoke.mjs`
- `node scripts/readme-runtime-domain-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
