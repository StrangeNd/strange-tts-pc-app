# Domain Correction Report

## Summary

Correction branch: `ai-agent/correct-tts-domain`

The product domain has been corrected: in this repository, `TTS` means TikTok
Shop, not Text-To-Speech.

## Root Cause

Previous agent work interpreted `TTS` as Text-To-Speech because the repository
name and app copy used the short acronym without an explicit domain guard. That
led to speech synthesis, voice, pitch, audio preview, recent speech text
history, and related reports being added to the product scope.

## Files With Wrong Text-To-Speech Assumptions

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `docs/TEST_MATRIX.md`
- `docs/product/PRODUCT_CONTRACT.md`
- `FINAL_AGENT_RUN_REPORT.md`
- `TTS_HISTORY_PR_REPORT.md`
- `docs/runs/deep-tts-qa-loop/AGENT_A_SUMMARY.md`
- `docs/runs/deep-tts-qa-loop/BUG_REPORT.md`
- `docs/runs/deep-tts-qa-loop/FINAL_AGENT_RUN_REPORT.md`

## Changes Removed

- Removed the PC app Text-To-Speech entry point.
- Removed browser `speechSynthesis` code.
- Removed voice selector, speed/rate, pitch, preview, and stop controls.
- Removed recent speech text history and localStorage helpers.
- Removed Text-To-Speech-specific CSS.
- Removed merged agent reports describing Text-To-Speech product behavior.
- Closed PR #3 because it added voice/speed/pitch presets for the wrong product
  domain.

## Docs Corrected

- `AGENTS.md`: added the domain rule for future agents.
- `docs/HARNESS.md`: added the domain correction rule.
- `docs/ARCHITECTURE.md`: clarified Strange TikTok Shop architecture.
- `docs/product/PRODUCT_CONTRACT.md`: renamed the product identity and marked
  Text-To-Speech/audio/voice as out of scope unless explicitly requested.
- `docs/TEST_MATRIX.md`: replaced Text-To-Speech rows with a product-domain
  guard row.

## Audit Result

After cleanup, public app code no longer contains:

- `speechSynthesis`
- `SpeechSynthesisUtterance`
- `btnTtsPreview`
- `renderTtsPreviewWorkspace`
- `tts-history`
- `.tts-*` Text-To-Speech UI classes

Remaining occurrences of `Text-To-Speech`, `voice`, `pitch`, and audio terms in
docs are intentional domain guard text.

The extension still contains TikTok video playback, speed, and audio-related
logic. Those are TikTok video/product-viewer operations features, not the
incorrect Text-To-Speech PC app feature, so they were not removed.

## Remaining Uncertainty

- The repository/folder/package still use `strange-tts-pc-app` naming. This may
  be a legacy acronym for TikTok Shop. A later rename to
  `strange-tiktokshop-pc-app` should be planned carefully because it affects
  GitHub remote names, scripts, paths, shortcuts, and packaging.

## Recommended Next TikTok Shop Operations Task

Add a TikTok Shop operations quick-start workspace that summarizes the core PC
app actions: open GMV Max dashboard, open Seller Ads, run crawler, review shop
overview, and open business analysis. Keep it focused on workflow guidance and
do not add new TikTok integrations until the existing app surfaces are stable.
