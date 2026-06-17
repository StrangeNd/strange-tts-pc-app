# Product Contract

Strange-tiktokshop-pc-app is a local desktop companion for operating,
managing, and optimizing TikTok Shop workflows on PC.

In this repository, `TTS` means TikTok Shop, not Text-To-Speech. Do not add
speech synthesis, voice, pitch, or audio preview features unless a human
explicitly requests an audio feature.

## Core User Outcomes

- Open the local app from desktop or script.
- Manage shop/dashboard workflows in a controlled local runtime.
- Open GMV Max dashboard and shop overview views.
- Crawl TikTok Seller Center/Compass data with the user's authenticated local
  profile when explicitly requested.
- Combine crawled TikTok data and uploaded XLSX/CSV files into business
  analysis and planning views.
- Support TikTok Shop operations workflows such as shop management, listing,
  order, content, crawler, ads, and productivity support.

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
- Text-To-Speech, speech synthesis, generated audio, voice selection, pitch, and
  audio preview behavior are out of scope unless explicitly requested by a
  human.

## Current Accepted Behaviors

- The agent workflow must use a non-main branch, no production deploys, and
  human approval for high-risk areas.
