# US-035 Agent WSL Runner Wrapper

## Story

As an agent or developer working from the Windows in-app terminal,
I want one stable wrapper for running repo checks through WSL,
so that PowerShell/UNC current-directory issues do not make npm or healthcheck
commands appear broken.

## Scope

- Add a PowerShell helper that converts the WSL UNC repo path to a Linux path.
- Default the helper to `bash scripts/agent-healthcheck.sh`.
- Allow a caller to pass another command for targeted validation.
- Add a smoke script so healthcheck catches accidental helper drift.

## Non-Scope

- No product runtime behavior.
- No production release or deployment changes.
- No auth, cookie, session, license, payment, billing, or user-data behavior.
- No automatic PR merge behavior.

## Risk

Lane: tiny maintenance/tooling.

## Acceptance Criteria

- `powershell -ExecutionPolicy Bypass -File scripts/agent-wsl-run.ps1 pwd`
  runs inside the WSL repo path from the Windows UNC workspace.
- `npm run agent:wsl-runner-smoke` passes.
- `scripts/agent-healthcheck.sh` runs the WSL runner smoke when the npm script exists.
- Agent docs mention the wrapper as the manual fix for Windows UNC terminal runs.
