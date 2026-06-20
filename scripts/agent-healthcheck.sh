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

if [[ -f package.json ]] && has_script "ui:shell-smoke"; then
  run_step "UI shell smoke" "$PM" run ui:shell-smoke || CHECK_CODE=$?
else
  echo "SKIP: npm script 'ui:shell-smoke' not configured"
fi

if [[ -f package.json ]] && has_script "gmv:max-smoke"; then
  run_step "GMV Max dashboard smoke" "$PM" run gmv:max-smoke || CHECK_CODE=$?
else
  echo "SKIP: npm script 'gmv:max-smoke' not configured"
fi

echo "NOTE: Browser UI QA remains manual/Codex Browser based when a task changes runtime interactions."

exit "$CHECK_CODE"
