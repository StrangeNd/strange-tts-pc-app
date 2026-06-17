# Critical Flows

Agent B should prioritize these user-facing flows when testing.

## Local App Runtime

1. Start the PC app server.
2. Open the local app window or browser URL.
3. Confirm the dashboard renders without console errors.
4. Confirm navigation between major dashboard tabs works.

## Dashboard / GMV Max

1. Open the dashboard.
2. Confirm shop cards render.
3. Confirm sorting/layout controls do not break the page.
4. Confirm buttons are visible and not clipped.

## Shop Overview

1. Open `Tổng quan Shop`.
2. Change date preset.
3. Change month/custom range when available.
4. Confirm cards do not show stale run IDs after a realtime crawl.

## TikTok Crawler

1. Open `TikTok Crawler`.
2. Start a safe crawl only in a local authenticated test profile.
3. Confirm the app reports run ID, status, raw/API counts, and errors.
4. Confirm crawler output is written under `data/tiktokshop-crawler/`.

## Business Analysis

1. Load available crawl/file data.
2. Confirm KPIs render with clear missing-data states.
3. Confirm detail tables are readable and not clipped.

## Safety Regression Checks

- No secrets appear in logs or reports.
- No production deploy commands run.
- No database/user-data deletion commands run.
