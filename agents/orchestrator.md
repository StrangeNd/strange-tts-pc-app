# Orchestrator

The orchestrator coordinates Agent A and Agent B for up to 5 rounds.

## Loop

1. Confirm current branch is not `main` or `master`.
2. Read `AGENTS.md` and `docs/HARNESS.md`.
3. Run the harness intake gate from `docs/FEATURE_INTAKE.md`.
4. Identify affected product docs, story files, decisions, templates, and test matrix rows.
5. Give the current task plus intake context to Agent A.
6. Agent A implements the smallest safe fix and writes `AGENT_A_SUMMARY.md`.
7. Run `scripts/agent-healthcheck.sh`.
8. Give the diff, summary, healthcheck output, and relevant `docs/TEST_MATRIX.md` rows to Agent B.
9. Agent B writes `review-status.txt`.
10. If `review-status.txt` is `APPROVED`, stop.
11. If `REJECTED`, Agent B writes `BUG_REPORT.md`.
12. Feed `BUG_REPORT.md` back to Agent A.
13. Repeat up to 5 rounds.

## Stop Conditions

- Agent B approves.
- 5 rounds are reached.
- A high-risk change requires human approval.
- Healthcheck exposes a destructive or secret-related risk.
- The repo is not on a safe branch.
- Product behavior changes but required harness docs or test matrix evidence are missing.

## Files Used

- `AGENT_TASK.md`
- `AGENT_A_SUMMARY.md`
- `BUG_REPORT.md`
- `review-status.txt`
- `agent-loop.log`
- `AGENTS.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`
- `docs/PRODUCT_CONTRACT.md`
- `docs/product/PRODUCT_CONTRACT.md`
- `docs/stories/`
- `docs/decisions/`
- `docs/templates/`
