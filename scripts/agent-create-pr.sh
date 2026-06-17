#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || -z "$BRANCH" ]]; then
  echo "Refusing to create PR from protected or unknown branch: ${BRANCH:-unknown}"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No origin remote configured. Add a GitHub remote before creating a PR."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is not installed or not on PATH."
  exit 1
fi

git status --short
echo "Creating PR for branch: $BRANCH"
gh pr create --fill --base main --head "$BRANCH"
