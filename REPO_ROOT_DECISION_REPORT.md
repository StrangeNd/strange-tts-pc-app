# REPO_ROOT_DECISION_REPORT.md

## Current Git Root

Current Git root:

```text
/home/strange/.openclaw/workspace
```

Current app folder:

```text
/home/strange/.openclaw/workspace/strange-tts-pc-app
```

Current branch:

```text
ai-agent/repository-harness-workflow
```

## Recommended Repo Root

Recommended GitHub repository root:

```text
/home/strange/.openclaw/workspace/strange-tts-pc-app
```

## Why

`strange-tts-pc-app` already contains the app source, runtime scripts, docs,
agent harness, and GitHub Actions workflow in the layout GitHub expects for a
standalone repository.

Required files checked:

| Required File/Folder | Status |
| --- | --- |
| `package.json` | present |
| `public/` | present |
| `scripts/` | present |
| `agents/` | present |
| `docs/` | present |
| `.github/workflows/agent-ci.yml` | present |
| `AGENTS.md` | present |
| `AGENT_QUICKSTART.md` | present |
| `AGENT_SETUP_REPORT.md` | present |
| `GITHUB_REMOTE_SETUP.md` | present |
| `PR_WORKFLOW_REPORT.md` | present |

If the GitHub repo root is `strange-tts-pc-app`, the existing workflow path:

```text
.github/workflows/agent-ci.yml
```

will be at the repository root and should run on pull requests.

## Files Outside The App Required To Build Or Run

No required build/runtime imports were found outside `strange-tts-pc-app`.

The app's Node scripts import local modules using paths such as:

```text
../app/server.mjs
../app/license.mjs
../app/tiktokshop-crawler.mjs
```

Those imports are internal to the app folder because they are relative to
`scripts/`.

Known path notes:

- `scripts/parity-audit.mjs` has a fallback example path pointing to a local
  historical extension source under `C:\Users\Stephen Strange\Downloads\...`.
  This is not required for normal app build/run and can be overridden by
  `STTS_EXTENSION_SOURCE_DIR`.
- `README.md` and `docs/PC_APP_USER_GUIDE.md` contain operator examples with
  local Windows paths. They are documentation examples, not runtime
  dependencies.

## Risks

### Data Folder Risk

The app folder contains local runtime/data folders. `.gitignore` currently
ignores sensitive locations such as:

```text
data/private/
data/extensions/
data/shops/
data/runtime/
data/logs/
node_modules/
dist/
```

However, the app folder also contains other local data paths such as crawler and
business data. Before creating the standalone GitHub repo, do not run a blind
`git add .` until the human reviews whether these should be committed:

```text
data/tiktokshop-crawler/
data/business/
memory/
tmp-*.json
tmp-*.txt
tools/cloudflared.exe
test-*.json
```

These were not deleted or changed in this task.

### History Risk

The current commits live in the parent workspace Git repository. If the app
becomes its own repository, the human must choose whether to:

1. Start a clean new Git history inside `strange-tts-pc-app`.
2. Preserve history with a subtree/filter migration.

The safer commercial path is usually a clean private repository with an
explicit allowlist of files.

### CI Risk

The existing CI workflow assumes repository root contains `package.json`.
That will be true only if `strange-tts-pc-app` is the GitHub repo root.

If the parent workspace remains the GitHub repo root, the current app workflow
will not auto-run because it is nested under:

```text
strange-tts-pc-app/.github/workflows/agent-ci.yml
```

In that case a root-level workflow would be needed. It was not installed because
the safer recommendation is to make `strange-tts-pc-app` the repo root.

## Exact Commands For A Clean Standalone Repo

Run these only after confirming the GitHub repo target. Do not create a public
repo automatically.

### 1. Enter The App Folder

```bash
cd /home/strange/.openclaw/workspace/strange-tts-pc-app
```

### 2. Review Ignored And Untracked Files Before Init

```bash
git status --short
git check-ignore -v node_modules dist data/private data/extensions data/shops data/runtime data/logs
find . -maxdepth 2 -type f | sort
```

Review whether these should stay out of Git:

```text
data/
dist/
node_modules/
memory/
tmp-*
test-*.json
tools/cloudflared.exe
```

### 3. Initialize A New Repo

```bash
git init
git checkout -b main
```

### 4. Add Files With An Allowlist

Prefer an allowlist instead of `git add .`:

```bash
git add \
  .gitignore \
  .github \
  AGENTS.md \
  AGENT_QUICKSTART.md \
  AGENT_SETUP_REPORT.md \
  AGENT_A_SUMMARY.md \
  BUG_REPORT.md \
  FINAL_AGENT_RUN_REPORT.md \
  GITHUB_REMOTE_SETUP.md \
  HARNESS_STABILIZATION_REPORT.md \
  PR_WORKFLOW_REPORT.md \
  REPO_ROOT_DECISION_REPORT.md \
  README.md \
  agents \
  app \
  assets \
  docs \
  extension \
  package.json \
  package-lock.json \
  public \
  scripts
```

Do not add private/runtime data unless explicitly reviewed:

```bash
git status --short
```

### 5. Commit

```bash
git commit -m "Initialize Strange TTS PC app repository"
```

### 6. Add Remote After The Human Creates/Confirms The Repo

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

### 7. Push Main Only After Review

Only after the human confirms the remote and reviewed files:

```bash
git push -u origin main
```

For future feature work, create branches and PRs:

```bash
git checkout -b ai-agent/<task-name>
git push -u origin ai-agent/<task-name>
gh pr create --base main --head ai-agent/<task-name>
```

## Root-Level Workflow Alternative

If the parent workspace must remain the GitHub repo root, create a root-level
workflow at:

```text
/home/strange/.openclaw/workspace/.github/workflows/agent-ci.yml
```

The workflow should set:

```yaml
defaults:
  run:
    working-directory: strange-tts-pc-app
```

This was not installed because the recommended repo root is the app folder.

## Files To Move

No files need to be moved if `strange-tts-pc-app` becomes the GitHub repo root.

## Validation

Healthcheck was run from inside `strange-tts-pc-app`:

```text
./scripts/agent-healthcheck.sh
```

Result:

- install check: OK
- existing smoke script: OK
- lint/typecheck/unit/integration/e2e: skipped because scripts are not
  configured
- npm audit: one existing high-severity item reported, intentionally not fixed

## Decision

Safe to prepare `strange-tts-pc-app` as its own GitHub repository, with one
important guardrail: use an allowlist for the first commit and review local
runtime/data files before adding anything under `data/`, `memory/`, `tmp-*`,
`test-*`, `dist/`, `node_modules/`, or `tools/`.
