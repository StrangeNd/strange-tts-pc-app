# Agent WSL Runner Recovery Docs PR Report

Branch: `ai-agent/wsl-runner-recovery-doc-smoke`

Target: `main`

## Task Intake

- Type: maintenance request / product proof
- Lane: tiny validation-only change
- Risk: low, limited to agent runner smoke coverage
- Affected areas: `scripts/agent-wsl-run-smoke.mjs`, PR report
- Out of scope: product runtime behavior, UI behavior, crawler behavior, cookies/sessions, auth, payment/billing, deployment, database migrations, secrets, user data deletion/export/retention

## Why This Task

The Windows in-app terminal can fail from a WSL UNC current directory. The repository already has a WSL wrapper and quickstart recovery instructions; this PR makes the docs part of the existing WSL runner smoke so the manual recovery path does not quietly drift.

## Agent B Intake Review

Approved. This is validation-only and directly supports the existing WSL runner story acceptance criteria without touching high-risk runtime behavior.

## Implementation Summary

- Extended `scripts/agent-wsl-run-smoke.mjs` to read `AGENT_QUICKSTART.md`.
- The smoke now verifies the quickstart documents the UNC failure mode, the `cmd.exe` reason, the wrapper command, and a targeted command example.

## Agent B Implementation Review

Approved after validation. The smoke now proves the manual WSL recovery docs stay aligned with the wrapper behavior.

## Validation Plan

- `node --check scripts/agent-wsl-run-smoke.mjs`
- `node scripts/agent-wsl-run-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
- `git diff --cached --check`

## Validation Results

Passed via WSL repo path because the Windows UNC sandbox helper repeatedly failed with `helper_unknown_error` during normal command execution.

- `node --check scripts/agent-wsl-run-smoke.mjs`
- `node scripts/agent-wsl-run-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high` passed high threshold; existing moderate `uuid`/`exceljs` advisories remain.
- `bash scripts/agent-healthcheck.sh`
