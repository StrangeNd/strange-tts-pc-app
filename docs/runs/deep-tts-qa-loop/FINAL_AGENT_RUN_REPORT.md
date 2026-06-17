# FINAL_AGENT_RUN_REPORT.md

## Summary

Deep 2-agent loop completed for the TTS main user journey on branch `ai-agent/deep-tts-qa-loop`.

## Total Loop Count

3 rounds.

## Round Results

- Round 1: REJECTED by Agent B after strict edge-case review. The happy path worked, but playback state, queued control changes, stop behavior, no-voice/unsupported states, long-text feedback, and mobile feedback were not strong enough.
- Round 2: REJECTED by Agent B after browser-driven QA. 15/16 required cases passed; Stop before preview still reported "Đã dừng giọng đọc." because previous pending speech survived a workspace re-render.
- Round 3: APPROVED by Agent B. All 16 required cases passed with no console errors or runtime exceptions in the QA result.

## Bugs Found

- Missing explicit playback state for TTS preview.
- Repeated Preview clicks could leave stale `speechSynthesis` callbacks racing with the current UI state.
- Stop before preview did not reliably distinguish idle vs active playback.
- Changing voice/speed/pitch during active preview did not explain when the change applies.
- No available voices and unsupported `speechSynthesis` states were hard to verify.
- Long text had no visible character counter or boundary feedback.
- TTS mobile state needed clearer compact feedback.

## Fixes Made

- Added `state.tts` with `isPlaying`, `lastText`, and `playbackId`.
- Added stale-callback protection to `SpeechSynthesisUtterance` handlers.
- Added character counter and long-text warning.
- Added validation for empty text, one-character text, and text over 1200 characters.
- Added queued feedback for voice/rate/pitch changes during active playback.
- Added idempotent Stop behavior and explicit "Chưa có preview nào đang phát." idle feedback.
- Added unsupported/no-voice test hooks and user-facing fallback messages.
- Reset active/pending speech when re-rendering the TTS workspace.
- Added status `data-mode` styling for ready, playing, queued, stopped, done, error, and unsupported states.
- Added mobile stacking for the TTS helper row.

## Required Test Matrix

- Empty text input: passed.
- Very short text: passed.
- Long Vietnamese text: passed.
- Text with punctuation and numbers: passed.
- No available system voices: passed.
- Change voice while preview is active: passed.
- Change speed and pitch while preview is active: passed.
- Click preview multiple times quickly: passed.
- Click stop before preview: passed after Round 2 fix.
- Click stop during preview: passed.
- Reload page after using TTS: passed.
- Resize browser to mobile width: passed.
- Check all visible text for mojibake/broken Vietnamese: passed.
- Check console errors: passed.
- Check UI feedback states: passed.
- Check unsupported `speechSynthesis` handling gracefully: passed.

## Commands Run

- `git checkout -b ai-agent/deep-tts-qa-loop`
- `node --check public/app.js`
- `./scripts/agent-healthcheck.sh`
- Browser-driven Agent B QA through Microsoft Edge CDP against a local unlicensed app server.

## Remaining Risks

- Browser voices still depend on the user's OS and installed speech voices.
- This feature previews speech locally through Web Speech API; it does not export generated audio.
- The QA runner was temporary and not committed as a permanent test script.
- Healthcheck still reports one existing high-severity npm audit item; this was intentionally not fixed per prior rule.

## Production Readiness

Not production-ready as a commercial TTS engine. It is materially deeper than the previous shallow loop and ready for focused manual acceptance testing of the local TTS preview journey.

## Final Commit Hash

The final commit hash is reported in the assistant final response. A commit cannot include its own final hash inside a file that is part of that same commit without changing the hash.
