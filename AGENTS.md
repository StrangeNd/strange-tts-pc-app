# AGENTS.md

This repository is agent-ready through a lightweight harness.

Product domain rule: `TTS` in this repository means TikTok Shop, not
Text-To-Speech. Do not add speech synthesis, voice, pitch, or audio preview
features unless a human explicitly requests an audio feature.

Before editing code:

1. Read `agents/guardrails.md`.
2. Read `agents/risk-policy.md`.
3. Classify the task with `docs/FEATURE_INTAKE.md`.
4. Check affected behavior in `docs/PRODUCT_CONTRACT.md` and canonical
   `docs/product/PRODUCT_CONTRACT.md`.
5. Check boundaries in `docs/ARCHITECTURE.md`.
6. Check required proof in `docs/TEST_MATRIX.md`.

## Default Workflow

- Work only on a non-main branch.
- Keep changes scoped to the requested task.
- Run `scripts/agent-healthcheck.sh` before approval.
- For UI work, use Codex Browser, Chrome/Edge CDP, or the desktop app window for
  real user-flow QA.
- Update `docs/TEST_MATRIX.md`, `docs/stories/`, or `docs/decisions/` when the
  task changes product behavior, architecture, risk gates, or validation proof.

## Hard Stops

Do not modify without explicit human approval:

- Secrets, cookies, credentials, machine IDs, license keys, or `.env` files.
- Auth, permissions, payment, billing, deployment, database migrations, or user
  data deletion/export/retention.
- Production infrastructure or release automation.

## Agent Loop

Use:

```bash
scripts/agent-loop.sh "task description"
```

Agent A builds/fixes. Agent B reviews/tests. The loop stops on approval, high
risk, or 5 rounds.
