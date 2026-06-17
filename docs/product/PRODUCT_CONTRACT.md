# Product Contract

Strange TTS PC App is a local desktop companion for operating Strange TTS
workflows around TikTok Shop/Seller Center data, dashboard review, crawler data,
and TTS preview behavior.

## Core User Outcomes

- Open the local app from desktop or script.
- Manage shop/dashboard workflows in a controlled local runtime.
- Preview text-to-speech locally through available system/browser voices.
- Open GMV Max dashboard and shop overview views.
- Crawl TikTok Seller Center/Compass data with the user's authenticated local
  profile when explicitly requested.
- Combine crawled TikTok data and uploaded XLSX/CSV files into business
  analysis and planning views.

## Product Constraints

- The app must not expose cookies, credentials, license keys, or machine IDs in
  reports, logs, screenshots, or commits.
- Realtime crawler actions must perform a fresh crawl unless the UI clearly says
  cached data is being used.
- Raw crawler data must be saved separately from normalized data.
- Dashboard and analysis screens must show when a metric is missing instead of
  silently inventing values.
- Desktop shortcuts and packaged app flows must remain usable for non-technical
  users.

## Current Accepted Behaviors

- TTS preview is browser-local via `speechSynthesis`.
- TTS preview handles empty/short/long text, punctuation/numbers, missing voices,
  unsupported browsers, stop-before-preview, stop-during-preview, reload,
  mobile width, and console-clean UI feedback.
- TTS preview keeps a recent text history in browser `localStorage` only. Users
  can restore a recent text by clicking it or clear the history. The app must
  handle empty, duplicate, long, and corrupted history without sending text to a
  server.
- TTS preview stores voice/speed/pitch presets in browser `localStorage` only.
  Users can save, apply, and delete presets. The app must handle duplicate
  presets, empty/corrupted preset storage, and missing saved voices without
  sending settings to a server.
- The agent workflow must use a non-main branch, no production deploys, and
  human approval for high-risk areas.
