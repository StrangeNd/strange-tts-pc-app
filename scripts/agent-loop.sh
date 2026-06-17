#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MAX_ROUNDS="${MAX_AGENT_ROUNDS:-5}"
TASK="${*:-}"

if [[ -z "$TASK" ]]; then
  echo "Usage: scripts/agent-loop.sh \"task description\""
  exit 2
fi

BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || -z "$BRANCH" ]]; then
  echo "Refusing to run agent loop on protected or unknown branch: ${BRANCH:-unknown}"
  exit 1
fi

cat > AGENT_TASK.md <<TASK_EOF
# Agent Task

$TASK

## Required Harness Context

Before editing, Agent A must read:

- agents/guardrails.md
- agents/risk-policy.md
- AGENTS.md
- docs/HARNESS.md
- docs/FEATURE_INTAKE.md
- docs/PRODUCT_CONTRACT.md
- docs/product/PRODUCT_CONTRACT.md
- docs/ARCHITECTURE.md
- docs/TEST_MATRIX.md

Agent A must include the intake type, lane, affected areas, and proof required
in AGENT_A_SUMMARY.md.

Agent B must review the diff against docs/TEST_MATRIX.md and reject missing or
stale proof.
TASK_EOF

echo "Agent loop started on branch $BRANCH" | tee agent-loop.log
echo "Max rounds: $MAX_ROUNDS" | tee -a agent-loop.log
echo "Harness docs: AGENTS.md docs/HARNESS.md docs/FEATURE_INTAKE.md docs/ARCHITECTURE.md docs/TEST_MATRIX.md docs/PRODUCT_CONTRACT.md" | tee -a agent-loop.log

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "" | tee -a agent-loop.log
  echo "== Round $round / $MAX_ROUNDS ==" | tee -a agent-loop.log
  echo "Give AGENT_TASK.md, harness docs, and BUG_REPORT.md (if present) to Agent A using agents/agent-a-builder.md." | tee -a agent-loop.log

  scripts/agent-healthcheck.sh | tee -a agent-loop.log || true

  echo "Give the diff, AGENT_A_SUMMARY.md, docs/TEST_MATRIX.md, and healthcheck output to Agent B using agents/agent-b-reviewer.md." | tee -a agent-loop.log
  if [[ ! -f review-status.txt ]]; then
    echo "WAITING_FOR_REVIEW" > review-status.txt
    echo "review-status.txt created with WAITING_FOR_REVIEW. Run Agent B, then rerun this script." | tee -a agent-loop.log
    exit 0
  fi

  STATUS="$(tr -d '\r\n[:space:]' < review-status.txt)"
  if [[ "$STATUS" == "APPROVED" ]]; then
    echo "Agent loop approved in round $round." | tee -a agent-loop.log
    exit 0
  fi

  if [[ "$STATUS" == "REJECTED" ]]; then
    if [[ ! -f BUG_REPORT.md ]]; then
      echo "Agent B rejected but BUG_REPORT.md is missing."
      exit 1
    fi
    rm -f review-status.txt
    echo "Rejected. BUG_REPORT.md will be sent back to Agent A in the next round." | tee -a agent-loop.log
    continue
  fi

  echo "Unknown review status '$STATUS'. Expected APPROVED or REJECTED."
  exit 1
done

echo "Max rounds reached without approval." | tee -a agent-loop.log
exit 1
