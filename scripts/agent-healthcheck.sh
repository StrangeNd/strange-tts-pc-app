#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

echo "== Agent healthcheck =="
echo "Root: $ROOT"

if [[ -f package-lock.json ]]; then
  PM="npm"
elif [[ -f pnpm-lock.yaml ]]; then
  PM="pnpm"
elif [[ -f yarn.lock ]]; then
  PM="yarn"
else
  PM="npm"
fi
echo "Package manager: $PM"

run_step() {
  local name="$1"
  shift
  echo ""
  echo "== $name =="
  "$@"
  local code=$?
  if [[ $code -ne 0 ]]; then
    echo "FAILED: $name ($code)"
    return $code
  fi
  echo "OK: $name"
}

has_script() {
  local script="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script'] ? 0 : 1)" 2>/dev/null
}

INSTALL_CODE=0
if [[ -f package.json ]]; then
  if [[ "$PM" == "npm" ]]; then
    if [[ -f package-lock.json ]]; then
      run_step "install check" npm ci --ignore-scripts || INSTALL_CODE=$?
    else
      run_step "install check" npm install --package-lock-only --ignore-scripts || INSTALL_CODE=$?
    fi
  elif [[ "$PM" == "pnpm" ]]; then
    run_step "install check" pnpm install --frozen-lockfile --ignore-scripts || INSTALL_CODE=$?
  elif [[ "$PM" == "yarn" ]]; then
    run_step "install check" yarn install --frozen-lockfile --ignore-scripts || INSTALL_CODE=$?
  fi
else
  echo "No package.json found; skipping dependency checks."
fi

CHECK_CODE=$INSTALL_CODE

for script in lint typecheck test test:unit test:integration test:e2e; do
  if [[ -f package.json ]] && has_script "$script"; then
    run_step "npm script: $script" "$PM" run "$script" || CHECK_CODE=$?
  else
    echo "SKIP: npm script '$script' not configured"
  fi
done

if [[ -f scripts/smoke.mjs ]]; then
  run_step "existing smoke script" node scripts/smoke.mjs || CHECK_CODE=$?
else
  echo "SKIP: scripts/smoke.mjs not found"
fi

echo "SKIP: Browser UI QA is manual/Codex Browser based for this repository."

exit "$CHECK_CODE"
