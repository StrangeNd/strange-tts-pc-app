# Safe 2-Agent Development Loop

This folder defines a safe local workflow where:

- Agent A builds or fixes.
- Agent B reviews and tests like a real user.
- The orchestrator repeats the loop until approval or max 5 rounds.

## Files

- `agent-a-builder.md`: Builder/Fixer prompt
- `agent-b-reviewer.md`: Reviewer/User Simulator/QA prompt
- `orchestrator.md`: Loop protocol
- `guardrails.md`: Hard safety rules
- `risk-policy.md`: Low/medium/high risk policy
- `critical-flows.md`: App flows Agent B should test
- `../docs/HARNESS.md`: Repository harness model
- `../docs/FEATURE_INTAKE.md`: Task type, lane, and risk gates
- `../docs/ARCHITECTURE.md`: Current surfaces, boundaries, and safe edit zones
- `../docs/TEST_MATRIX.md`: Behavior-to-proof validation matrix
- `../docs/PRODUCT_CONTRACT.md`: Stable pointer to the canonical product contract
- `../docs/product/PRODUCT_CONTRACT.md`: Canonical accepted product behavior
- `../docs/decisions/`: Durable decisions and tradeoffs
- `../docs/stories/`: Story packets for normal/high-risk work
- `../docs/templates/`: Templates for stories, decisions, and validation reports

## Commands

```bash
scripts/agent-healthcheck.sh
scripts/agent-loop.sh "Fix the reported bug"
scripts/agent-create-pr.sh
```

The scripts do not deploy, auto-merge, or push to protected branches.
UI QA is intended to run through Codex Browser/in-app browser or the local desktop app window, not Playwright.

## Harness Rule

Before implementation, classify the task through `docs/FEATURE_INTAKE.md`.
After implementation, update `docs/TEST_MATRIX.md`, `docs/stories/`, or
`docs/decisions/` when the task changes product behavior, architecture, or
validation expectations.
