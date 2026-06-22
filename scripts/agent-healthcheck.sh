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

run_npm_script_if_present() {
  local label="$1"
  local script="$2"
  if [[ -f package.json ]] && has_script "$script"; then
    run_step "$label" "$PM" run "$script" || CHECK_CODE=$?
  else
    echo "SKIP: npm script '$script' not configured"
  fi
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

run_npm_script_if_present "UI shell smoke" "ui:shell-smoke"
run_npm_script_if_present "README runtime domain smoke" "readme:runtime-domain-smoke"
run_npm_script_if_present "AI Data external scope smoke" "ai-data:external-scope-smoke"
run_npm_script_if_present "Audit log redaction smoke" "audit:log-redaction-smoke"
run_npm_script_if_present "Test matrix smoke" "test-matrix:smoke"
run_npm_script_if_present "Agent WSL runner smoke" "agent:wsl-runner-smoke"
run_npm_script_if_present "Desktop launch smoke" "desktop:launch-smoke"
run_npm_script_if_present "Cloud Sync local smoke" "cloud:local-smoke"
run_npm_script_if_present "Cloud Sync import scope smoke" "cloud:import-scope-smoke"
run_npm_script_if_present "GMV Max dashboard smoke" "gmv:max-smoke"
run_npm_script_if_present "Shop health score smoke" "shop:health-score-smoke"
run_npm_script_if_present "Shop violation status tags smoke" "shop:violation-status-tags-smoke"
run_npm_script_if_present "Shop session safety smoke" "shop:session-safety-smoke"
run_npm_script_if_present "Business Ads Spend missing smoke" "business:ads-spend-missing-smoke"
run_npm_script_if_present "Business spreadsheet smoke" "business:spreadsheet-smoke"
run_npm_script_if_present "Business legacy XLS scope smoke" "business:legacy-xls-scope-smoke"
run_npm_script_if_present "Daily checklist scope smoke" "ops:daily-checklist-scope-smoke"
run_npm_script_if_present "Crawler contract smoke" "crawler:contract-smoke"
run_npm_script_if_present "Crawler contract policy smoke" "crawler:contract-policy-smoke"
run_npm_script_if_present "Crawler retention contract smoke" "crawler:retention-contract-smoke"
run_npm_script_if_present "Crawler fixture smoke" "crawler:fixture-smoke"
run_npm_script_if_present "Session restore gate smoke" "session:restore-gate-smoke"
run_npm_script_if_present "Video downloader safety smoke" "video:safety-smoke"

echo "NOTE: Browser UI QA remains manual/Codex Browser based when a task changes runtime interactions."

exit "$CHECK_CODE"
