# BUG_REPORT.md

## Round 1 - REJECTED

### Summary

The current TTS preview works for the happy path, but it is not robust enough for the required edge-case journey.

### Steps / Cases Tested

1. Empty text input.
2. Very short text.
3. Long Vietnamese text.
4. Text with punctuation and numbers.
5. No available system voices.
6. Change voice while preview is active.
7. Change speed and pitch while preview is active.
8. Click preview multiple times quickly.
9. Click stop before preview.
10. Click stop during preview.
11. Reload page after using TTS.
12. Resize browser to mobile width.
13. Check visible text for mojibake/broken Vietnamese.
14. Check console errors.
15. Check UI feedback states.
16. Check unsupported `speechSynthesis` handling.

### Expected Result

The TTS flow should provide clear validation, predictable playback controls, clear unavailable/unsupported states, mobile-friendly layout, no mojibake in the main journey, and no console errors.

### Actual Result

- Changing voice/rate/pitch while a preview is active does not clearly tell the user whether changes apply immediately or require replay.
- Multiple fast preview clicks rely on `cancel()` but do not expose a stable UI state or active/idle status.
- Stop before preview always says stopped, even if nothing was playing.
- There is no character counter or clear long-text boundary feedback.
- No-voice and unsupported-speech states are present, but they are too passive and not testable from the UI.
- Several surrounding public-shell labels still use non-accented Vietnamese or older technical language.
- Mobile controls are acceptable structurally but the TTS controls need clearer stacking and compact status.

### Evidence

Manual code review of `public/app.js`, `public/index.html`, and `public/styles.css` after the first shallow loop.

### Suspected Cause

The first implementation added a basic Web Speech API wrapper but did not model playback state or edge-case feedback.

### Suggested Fix

- Add explicit TTS state: `idle`, `playing`, `stopped`, `unsupported`, `error`.
- Add character count and validation messaging.
- Treat changes during active preview as queued for next preview, with clear feedback.
- Debounce/disable repeated preview actions while speech starts.
- Make stop idempotent and distinguish "nothing is playing".
- Provide a UI test hook for unsupported/no-voice simulation without changing backend.
- Polish visible TTS journey Vietnamese labels.

### Risk Assessment

Low risk: public-shell UI and browser-local TTS behavior only. No backend, auth, payment, database, deployment, credentials, secrets, or billing changes required.

## Round 2 - REJECTED

### Summary

Agent B ran the full browser-driven 16-case QA matrix after the first fix. Fifteen cases passed, but stop-before-preview still behaved incorrectly after prior playback had left speech pending.

### Steps / Cases Tested

1. Empty text input.
2. Very short text.
3. Long Vietnamese text.
4. Text with punctuation and numbers.
5. No available system voices.
6. Change voice while preview is active.
7. Change speed and pitch while preview is active.
8. Click preview multiple times quickly.
9. Click stop before preview.
10. Click stop during preview.
11. Reload page after using TTS.
12. Resize browser to mobile width.
13. Check visible text for mojibake/broken Vietnamese.
14. Check console errors.
15. Check UI feedback states.
16. Check unsupported `speechSynthesis` handling.

### Expected Result

After a fresh TTS workspace render, clicking Stop before starting a new preview should say no preview is currently playing.

### Actual Result

The Stop button returned "Đã dừng giọng đọc." because previous `speechSynthesis` pending state survived the workspace re-render.

### Evidence

Browser QA result: case 9 failed with detail `Đã dừng giọng đọc.` while all other required cases passed and there were no console errors.

### Suspected Cause

`renderTtsPreviewWorkspace()` rebuilt the form but did not cancel/reset existing speech playback state before presenting the new idle UI.

### Suggested Fix

Cancel any active/pending speech and bump the playback token when rendering the TTS workspace so old utterances cannot affect the new idle form.

### Risk Assessment

Low risk: frontend-only TTS workspace state reset. No backend, auth, payment, database, deployment, credentials, secrets, or billing changes.
