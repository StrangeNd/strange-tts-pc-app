# Test Matrix

This matrix maps user-visible behavior to proof. Update it when adding or
changing product behavior.

| Area | Critical Flow | Required Proof | Status | Evidence |
| --- | --- | --- | --- | --- |
| Desktop launch | User opens the local app from shortcut/script | Healthcheck or smoke script; no license bypass in production mode | in_progress | `scripts/agent-healthcheck.sh` |
| Product domain guard | Agents understand TTS means TikTok Shop, not Text-To-Speech | Repository audit for speech synthesis, voice/pitch/audio preview assumptions plus syntax and healthcheck | implemented | `REMOVE_SPEECH_SHELL_PR_REPORT.md` on branch `ai-agent/remove-speech-shell` |
| GMV Max dashboard | User sees loaded shops and shop cards | Manual UI QA plus smoke where available | planned | none |
| Daily shop ops checklist | User tracks today's TikTok Shop operating tasks for the selected shop/profile | Local storage persistence check, reset check, syntax, healthcheck, UI QA | implemented | `DAILY_SHOP_OPS_CHECKLIST_PR_REPORT.md` on branch `ai-agent/daily-shop-ops-checklist` |
| Shop overview | User selects date range and reviews shop KPIs | Read-only shop overview API check, syntax, healthcheck, browser UI QA, missing-data review | in_progress | `SHOP_OVERVIEW_OPERATIONS_DASHBOARD_PR_REPORT.md`; `docs/stories/US-002-shop-overview-operations-dashboard.md` |
| Shop health / score | User reviews Shop Score components, health dependencies, and shop violations | Read-only overview API check, syntax, healthcheck, browser UI QA, missing dependency review | in_progress | `SHOP_HEALTH_SCORE_CENTER_PR_REPORT.md`; `docs/stories/US-003-shop-health-score-center.md` |
| TikTok crawler | Crawl Seller Center/Compass without exposing cookies | Raw/normalized/log outputs, crawl report, no secret logging | in_progress | crawler reports/logs when produced |
| Crawler/business data clarity | Operator can see selected shop/profile, data source/status, last crawl timestamp, and missing metrics without fake values | Syntax checks, healthcheck, high audit check, button ID verification, mojibake/replacement-character diff check, and UI/status review | in_progress | `CRAWLER_DATA_STATUS_CLARITY_PR_REPORT.md` on branch `ai-agent/crawler-data-status-clarity` |
| Business analysis | Combine crawler and XLSX inputs into readable analysis | Fixture-based calculation check plus UI review | in_progress | `scripts/spreadsheet-smoke.mjs`; `XLSX_AUDIT_FIX_PR_REPORT.md` |
| Agent loop | Agent A fixes, Agent B rejects/approves, max 5 rounds | Healthcheck plus reports: `BUG_REPORT.md`, `FINAL_AGENT_RUN_REPORT.md` | implemented | agent workflow files |

## Evidence Rules

- Unit proof covers pure calculation and parsing rules.
- Integration proof covers local API/server behavior.
- Browser proof covers user-visible flows and console/network failures.
- Platform proof covers desktop shell, shortcut, managed browser, or packaged app
  behavior.
- If proof is skipped, the report must say why and what risk remains.
