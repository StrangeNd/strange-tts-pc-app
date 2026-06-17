# Test Matrix

This matrix maps user-visible behavior to proof. Update it when adding or
changing product behavior.

| Area | Critical Flow | Required Proof | Status | Evidence |
| --- | --- | --- | --- | --- |
| Desktop launch | User opens the local app from shortcut/script | Healthcheck or smoke script; no license bypass in production mode | in_progress | `scripts/agent-healthcheck.sh` |
| Product domain guard | Agents understand TTS means TikTok Shop, not Text-To-Speech | Repository audit for speech synthesis, voice/pitch/audio preview assumptions plus syntax and healthcheck | implemented | `REMOVE_SPEECH_SHELL_PR_REPORT.md` on branch `ai-agent/remove-speech-shell` |
| GMV Max dashboard | User sees loaded shops and shop cards | Manual UI QA plus smoke where available | planned | none |
| Shop overview | User selects date range and reviews shop KPIs | Crawler data fixture or real crawl proof plus UI QA | planned | none |
| TikTok crawler | Crawl Seller Center/Compass without exposing cookies | Raw/normalized/log outputs, crawl report, no secret logging | in_progress | crawler reports/logs when produced |
| Business analysis | Combine crawler and XLSX inputs into readable analysis | Fixture-based calculation check plus UI review | planned | none |
| Agent loop | Agent A fixes, Agent B rejects/approves, max 5 rounds | Healthcheck plus reports: `BUG_REPORT.md`, `FINAL_AGENT_RUN_REPORT.md` | implemented | agent workflow files |

## Evidence Rules

- Unit proof covers pure calculation and parsing rules.
- Integration proof covers local API/server behavior.
- Browser proof covers user-visible flows and console/network failures.
- Platform proof covers desktop shell, shortcut, managed browser, or packaged app
  behavior.
- If proof is skipped, the report must say why and what risk remains.
