# HARNESS_STABILIZATION_REPORT.md

## Current Branch

`ai-agent/repository-harness-workflow`

## Git Status Summary

Repository root contains many unrelated dirty/untracked files outside
`strange-tts-pc-app`. This stabilization only inspected and changed the app
harness scope.

Relevant app-scope changes before commit:

- Modified:
  - `AGENTS.md`
  - `AGENT_QUICKSTART.md`
  - `agents/README.md`
  - `agents/agent-a-builder.md`
  - `agents/agent-b-reviewer.md`
  - `agents/orchestrator.md`
  - `scripts/agent-loop.sh`
- Added:
  - `docs/PRODUCT_CONTRACT.md`
  - `HARNESS_STABILIZATION_REPORT.md`
- Previously untracked docs inspected:
  - `docs/EXTENSION_PARITY_AUDIT.md`
  - `docs/PC_APP_USER_GUIDE.md`
  - `docs/SECURITY.md`

## Workflow Consistency Check

Agent workflow now points to the required harness surfaces:

| Required Surface | Agent A | Agent B | Orchestrator |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | yes | yes |
| `docs/HARNESS.md` | yes | yes | yes |
| `docs/FEATURE_INTAKE.md` | yes | yes | yes |
| `docs/ARCHITECTURE.md` | yes | yes | yes |
| `docs/TEST_MATRIX.md` | yes | yes | yes |
| `docs/PRODUCT_CONTRACT.md` | yes | yes | yes |
| `docs/product/PRODUCT_CONTRACT.md` | yes | yes | yes |
| `docs/decisions/` | yes | yes | yes |
| `docs/stories/` | yes | yes | yes |
| `docs/templates/` | yes | yes | yes |

`docs/PRODUCT_CONTRACT.md` was added as a stable pointer to the canonical
`docs/product/PRODUCT_CONTRACT.md` file because human tasks and agent prompts
commonly use the top-level path.

## Agent Prompt Gaps Found

- Agent A did not explicitly read `AGENTS.md` or `docs/HARNESS.md`.
- Agent B did not explicitly read `AGENTS.md`, `docs/HARNESS.md`,
  `docs/ARCHITECTURE.md`, or product contract paths.
- Orchestrator did not explicitly read `AGENTS.md`, `docs/HARNESS.md`,
  `docs/ARCHITECTURE.md`, product contract paths, or `docs/templates/`.
- `scripts/agent-loop.sh` generated task context without the full harness file
  set.

All gaps above were fixed with documentation/script-only updates.

## Docs To Commit Or Ignore

### `docs/EXTENSION_PARITY_AUDIT.md`

Decision: commit.

Reason: useful operational documentation for extension parity audit and allowed
sanitized differences. No secret values were present.

Follow-up: replace user-specific example source path with a configurable
placeholder in a future docs cleanup.

### `docs/PC_APP_USER_GUIDE.md`

Decision: commit.

Reason: useful non-technical operator guide for the desktop app, shop import,
headless refresh, video download, and handoff checks. No raw credentials or
tokens were present.

Follow-up: normalize Vietnamese with accents and replace machine-specific paths
with placeholders before public/commercial documentation.

### `docs/SECURITY.md`

Decision: commit.

Reason: important security documentation for local binding, encrypted cookie
storage, audit log redaction, runtime profiles, and packaging safeguards. No
secrets were present.

Follow-up: add this file to future high-risk review context when work touches
cookies, login, license, packaging, or crawler data.

## Recommended Next Branch

`ai-agent/harness-ui-qa-runner`

## Recommended Next Task

Create a committed, reusable local UI QA runner for public-shell flows so Agent
B does not have to rely on temporary Edge CDP scripts. Keep it secret-free,
local-only, and limited to unlicensed/dev smoke flows.

Suggested target:

- `scripts/agent-ui-smoke.mjs`
- healthcheck integration that runs it only when local browser automation is
  available
- test matrix row updates for TTS preview and desktop shell smoke

## Validation

- No business logic changed.
- No production files changed.
- No secrets changed or exposed.
- npm audit was not fixed.
- Healthcheck was run after stabilization changes.
