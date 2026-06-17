# GitHub Remote Setup

No Git remote is currently configured for this repository.

Do not create a public repository automatically. Create or confirm the target
GitHub repository manually first, preferably private while this app still
contains commercial/runtime workflow code.

## Confirm Current Branch

```bash
git branch --show-current
```

Current working branch at setup time:

```text
ai-agent/repository-harness-workflow
```

## Option A: SSH Remote

Use this if SSH keys are configured for GitHub:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git remote -v
```

## Option B: HTTPS Remote

Use this if you prefer GitHub HTTPS authentication:

```bash
git remote add origin https://github.com/<owner>/<repo>.git
git remote -v
```

## Install And Authenticate GitHub CLI

GitHub CLI is not currently available on PATH in WSL or Windows PowerShell.

Windows install options:

```powershell
winget install --id GitHub.cli
gh auth login
gh auth status
```

WSL install options:

```bash
type -p curl >/dev/null || sudo apt-get update && sudo apt-get install -y curl
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
sudo apt-get update
sudo apt-get install -y gh
gh auth login
gh auth status
```

## Push Current Branch Only After Remote Is Confirmed

Do not push to `main`.

After the human confirms the remote:

```bash
git push -u origin ai-agent/repository-harness-workflow
```

## Create Pull Request

After branch push succeeds:

```bash
gh pr create \
  --base main \
  --head ai-agent/repository-harness-workflow \
  --title "Stabilize repository harness workflow" \
  --body-file PR_WORKFLOW_REPORT.md
```

If the default branch is not `main`, replace `--base main` with the actual
default branch.
