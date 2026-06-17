# Agent Quickstart

## Run Healthcheck

```bash
scripts/agent-healthcheck.sh
```

This detects the package manager, installs dependencies when needed, and runs available checks.
For UI work, use Codex Browser/in-app browser or the desktop app window after healthcheck.

## Classify A Task First

Before code changes, read:

```bash
sed -n '1,220p' docs/FEATURE_INTAKE.md
sed -n '1,220p' docs/HARNESS.md
sed -n '1,220p' docs/ARCHITECTURE.md
sed -n '1,220p' docs/TEST_MATRIX.md
sed -n '1,220p' docs/PRODUCT_CONTRACT.md
```

Then write the intake summary in `AGENT_A_SUMMARY.md`:

- input type
- lane: tiny, normal, or high-risk
- affected areas
- proof required

## Start One Agent Loop

```bash
scripts/agent-loop.sh "Describe the bug or feature here"
```

The loop stops when Agent B writes `APPROVED`, when a high-risk change needs approval, or after 5 rounds.

If Agent B rejects, preserve the rejection in `BUG_REPORT.md` and feed it back
to Agent A for the next round.

## Create a PR

```bash
scripts/agent-create-pr.sh
```

The script refuses to run on `main` or `master`. It uses `gh pr create` when GitHub CLI and a remote are configured.

## PR Workflow Check

Future agent changes should happen on a feature branch, then be reviewed through
a pull request before merging into `main`. Direct pushes to `main` are only for
explicitly approved repository setup or emergency maintenance tasks.

## Stop / Recover Safely

```bash
git status --short
cat review-status.txt 2>/dev/null || true
cat BUG_REPORT.md 2>/dev/null || true
```

To stop a local app server:

```bash
npm run stop
```

To abandon generated loop artifacts without touching source changes:

```bash
rm -f AGENT_TASK.md AGENT_A_SUMMARY.md BUG_REPORT.md review-status.txt agent-loop.log
```

Do not run destructive git commands unless you are certain the human asked for them.

## Harness Files

- `docs/HARNESS.md`: workflow model
- `docs/PRODUCT_CONTRACT.md`: stable pointer to the canonical product contract
- `docs/product/PRODUCT_CONTRACT.md`: accepted product behavior
- `docs/ARCHITECTURE.md`: surfaces, boundaries, and safe edit zones
- `docs/TEST_MATRIX.md`: behavior-to-proof expectations
- `docs/stories/`: story packets for normal/high-risk work
- `docs/decisions/`: durable decisions
