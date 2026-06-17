# SAFE_GIT_INIT_PLAN.md

## Goal

Prepare `strange-tts-pc-app` to become its own standalone GitHub repository
root without exposing local runtime data, secrets, generated builds, or crawler
captures.

Do not run `git add .`.

## Top-Level Inventory

Inspected top-level files and folders:

```text
.github/
AGENTS.md
AGENT_A_SUMMARY.md
AGENT_QUICKSTART.md
AGENT_SETUP_REPORT.md
BUG_REPORT.md
FINAL_AGENT_RUN_REPORT.md
GITHUB_REMOTE_SETUP.md
HARNESS_STABILIZATION_REPORT.md
PR_WORKFLOW_REPORT.md
README.md
REPO_ROOT_DECISION_REPORT.md
SAFE_GIT_INIT_PLAN.md
.gitignore
agents/
app/
assets/
data/
dist/
docs/
extension/
memory/
node_modules/
package-lock.json
package.json
public/
review-status.txt
scripts/
test-*.json
tests/
tmp-*
tools/
```

## Safe To Include

These files/folders are safe and recommended for the first standalone repo
commit:

```text
.github/
.gitignore
AGENTS.md
AGENT_QUICKSTART.md
AGENT_SETUP_REPORT.md
GITHUB_REMOTE_SETUP.md
HARNESS_STABILIZATION_REPORT.md
PR_WORKFLOW_REPORT.md
README.md
REPO_ROOT_DECISION_REPORT.md
SAFE_GIT_INIT_PLAN.md
agents/
app/
assets/
docs/
extension/
package.json
package-lock.json
public/
scripts/
tests/
```

### package-lock.json

`package-lock.json` exists and should be included.

Reason: `.github/workflows/agent-ci.yml` uses `npm ci`, which requires the lock
file for deterministic installs.

## Excluded And Why

The updated `.gitignore` excludes these categories:

```text
node_modules/
dist/
build/
coverage/
.env
.env.*
data/
memory/
*.log
tmp-*
test-*
chrome-profile/
extension-runtime/
profile/
profiles/
local credential/key/token/cookie/license-private patterns
OS/editor cache files
archive artifacts such as *.zip, *.7z, *.rar
```

Reasons:

- `node_modules/`: generated dependencies, recreated by `npm ci`.
- `dist/`, `build/`, `coverage/`: generated build/test output.
- `.env`, `.env.*`: local configuration and secrets.
- `data/`: local runtime data, private license/admin files, logs, crawler data,
  encrypted cookies, and business/cache data.
- `memory/`: local agent/runtime continuity notes, not product source.
- `tmp-*`, `test-*`: scratch captures and one-off test artifacts.
- `*.log`: local runtime logs.
- `chrome-profile/`, `extension-runtime/`, `profile/`, `profiles/`: local
  browser/runtime state.
- credential/key/token/cookie patterns: defense-in-depth against accidental
  local secret files.
- OS/editor/cache/archive files: not source.

## Requires Human Review Before Including

Do not include these in the first repo commit without manual inspection:

```text
data/
memory/
dist/
node_modules/
review-status.txt
AGENT_A_SUMMARY.md
BUG_REPORT.md
FINAL_AGENT_RUN_REPORT.md
test-*.json
tmp-*
tools/cloudflared.exe
```

Notes:

- `AGENT_A_SUMMARY.md`, `BUG_REPORT.md`, and `FINAL_AGENT_RUN_REPORT.md` are
  useful historical artifacts, but they are task-run outputs. Include only if
  the human wants the initial repo to preserve prior loop evidence.
- `tools/cloudflared.exe` is a binary. Include only if redistribution and repo
  size are acceptable. Prefer documenting how to install/download it.
- `review-status.txt` is transient loop state and should usually stay out of
  the initial commit.

## Exact Standalone Repo Init Commands

Run later only when explicitly instructed.

```bash
cd /home/strange/.openclaw/workspace/strange-tts-pc-app
git init
git checkout -b main
```

## Pre-Add Safety Checks

```bash
git status --short --ignored
git check-ignore -v \
  node_modules/ \
  dist/ \
  build/ \
  coverage/ \
  data/ \
  memory/ \
  tmp-crawl-apr-may.json \
  test-481216-496cdbf6f701.json
```

## Exact Allowlist Git Add Commands

Do not use `git add .`.

```bash
git add \
  .gitignore \
  .github \
  AGENTS.md \
  AGENT_QUICKSTART.md \
  AGENT_SETUP_REPORT.md \
  GITHUB_REMOTE_SETUP.md \
  HARNESS_STABILIZATION_REPORT.md \
  PR_WORKFLOW_REPORT.md \
  README.md \
  REPO_ROOT_DECISION_REPORT.md \
  SAFE_GIT_INIT_PLAN.md \
  agents \
  app \
  assets \
  docs \
  extension \
  package.json \
  package-lock.json \
  public \
  scripts \
  tests
```

Check what will be committed:

```bash
git status --short
git diff --cached --stat
git diff --cached --check
```

If any ignored or local/private file appears, unstage it:

```bash
git restore --staged <path>
```

## Exact First Commit Command

```bash
git commit -m "Initialize Strange TTS PC app repository"
```

## Exact Remote Add Command Placeholder

SSH:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git remote -v
```

HTTPS:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git remote -v
```

## Exact Push Command Placeholder

Only after the human confirms the remote and reviews the staged files:

```bash
git push -u origin main
```

For future work, use feature branches and PRs:

```bash
git checkout -b ai-agent/<task-name>
git push -u origin ai-agent/<task-name>
gh pr create --base main --head ai-agent/<task-name>
```

## Healthcheck

Run before first commit and before PRs:

```bash
./scripts/agent-healthcheck.sh
```

Expected current result:

- install check: OK
- existing smoke script: OK
- lint/typecheck/unit/integration/e2e: skipped unless scripts are configured
- npm audit: one existing high-severity issue, intentionally not fixed here
