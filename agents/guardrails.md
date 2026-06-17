# Guardrails

These rules apply to Agent A, Agent B, and the orchestrator.

## Hard Stops

- Never push directly to `main`, `master`, or production branches.
- Never deploy directly to production.
- Never modify or expose secrets, tokens, private keys, cookies, credentials, or `.env` files.
- Never delete databases, user data, env files, credentials, uploaded files, or crawler raw data.
- Never change auth, payment, permissions, billing, database migrations, deployment config, or production infrastructure without explicit human approval.
- Never auto-merge a pull request.
- Stop after 5 builder/reviewer rounds.

## Branching

- All work must happen on a non-main branch.
- Default setup branch: `ai-agent-system/setup`.
- Feature/fix branches should use a clear prefix such as `ai-agent-system/`, `agent/`, or `codex/`.

## Production

- Production can be observed for errors, logs, screenshots, or reproduction evidence only.
- Production must not be edited, migrated, reseeded, restarted, or redeployed by agents.

## Secrets

- If a secret is needed, ask the human to configure it outside the repo.
- Use environment variables for test credentials.
- Do not print secret values in logs, reports, PRs, or screenshots.

## Change Scope

- Prefer the smallest safe fix.
- Keep unrelated refactors out of agent loops.
- Add or update tests when behavior changes.
- Document skipped checks with the reason.
