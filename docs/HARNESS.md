# Strange TikTok Shop Repository Harness

This repository uses a lightweight agent workflow inspired by
`hoangnb24/repository-harness`: the app is what users touch; the harness is what
agents touch before they change the app.

`TTS` is a legacy acronym in file names and runtime labels. In this repository it
means TikTok Shop, not Text-To-Speech.

The goal is to make every agent loop answer four questions before editing:

1. What behavior or workflow is being changed?
2. What risk lane does the change belong to?
3. What proof will show the work is done?
4. What decision or lesson should future agents inherit?

## Workflow

```text
Human request
  -> Feature intake
  -> Risk lane
  -> Story or direct patch
  -> Agent A implementation
  -> Healthcheck
  -> Agent B review against the test matrix
  -> Decision/story/report updates
```

## Source Hierarchy

- `docs/product/PRODUCT_CONTRACT.md`: current user-facing product contract.
- `docs/FEATURE_INTAKE.md`: task classification and risk gates.
- `docs/ARCHITECTURE.md`: current surfaces, boundaries, and safe edit zones.
- `docs/TEST_MATRIX.md`: behavior-to-proof expectations.
- `docs/stories/`: story packets for normal or high-risk work.
- `docs/decisions/`: durable decisions and tradeoffs.
- `agents/`: executable agent roles and loop prompts.

## Harness Growth Rule

If an agent repeats reasoning, misses a test case, gets confused about product
intent, or discovers a safer validation pattern, update the harness docs in the
same branch. If the task is too large to fix now, add a backlog row to
`docs/HARNESS_BACKLOG.md`.

## What Not To Add

- Do not add secrets, cookies, machine IDs, license keys, or credentials.
- Do not add production deployment automation without human approval.
- Do not install external harness binaries unless explicitly requested.
- Do not replace the existing agent loop; extend it with clearer context.
