# Agent WSL Runner Wrapper PR Report

## Intake

- Type: maintenance request
- Lane: tiny
- Affected areas: agent tooling, quickstart docs, healthcheck smoke coverage
- Proof: targeted WSL runner smoke, PowerShell wrapper command, healthcheck

## User Value

Windows PowerShell sessions opened on `\\wsl.localhost\...` can make direct
`npm run ...` commands fail or default to `C:\Windows`. The helper gives agents
and developers a single manual recovery command that runs inside the WSL repo
path instead.

## Scope

- Add `scripts/agent-wsl-run.ps1`.
- Add `scripts/agent-wsl-run-smoke.mjs`.
- Add `npm run agent:wsl-runner-smoke`.
- Wire the smoke into `scripts/agent-healthcheck.sh`.
- Document the wrapper in agent quickstart docs.
- Consolidate duplicate Test Matrix rows for crawler/video safety so the
  existing test-matrix smoke passes on this branch.

## Non-Scope

- No product UI/runtime changes.
- No session, cookie, credential, auth, license, billing, deployment, or user
  data behavior.
- No automatic merge behavior.

## Validation

- Passed: `npm run agent:wsl-runner-smoke` through WSL
- Passed: `powershell -ExecutionPolicy Bypass -File scripts/agent-wsl-run.ps1 pwd`
- Passed: `powershell -ExecutionPolicy Bypass -File scripts/agent-wsl-run.ps1 node scripts/agent-wsl-run-smoke.mjs`
- Passed: `powershell -ExecutionPolicy Bypass -File scripts/agent-wsl-run.ps1`
- Passed: `node scripts/test-matrix-smoke.mjs` through WSL
- Passed: `scripts/agent-healthcheck.sh` through WSL
- Passed: `node scripts/security-scan.mjs`
- Passed: `npm audit --audit-level=high`
- Passed: `git diff --check`
- Passed: diff replacement/mojibake scan

## Review Notes

- The wrapper only forwards the command the caller supplies; by default it runs
  `bash scripts/agent-healthcheck.sh` so it does not depend on executable bits
  in Windows/WSL checkouts.
- The static smoke rejects destructive git reset/checkout snippets in the
  helper.
