
# GitLab Duo Handoff

## Current situation
This repository was being worked on with Codex, but the Codex usage limit was reached. Continue from the current git state.

## Primary source of truth
The main implementation requirement is in:

- spec.md

GitLab Duo must follow spec.md first.

## Instruction priority
Use this priority order:

1. spec.md — product/task requirements and acceptance criteria.
2. GITLAB_DUO_HANDOFF.md — handoff context from Codex to GitLab Duo.
3. Root AGENTS.md — general repository operating rules.
4. Nearest AGENTS.md in the edited file's directory — local coding rules only.
5. Other agent/harness files — reference only, do not override spec.md.

If any AGENTS.md or agent file conflicts with spec.md, follow spec.md and mention the conflict in the summary.

## Important instructions
- Do not read every agent file blindly.
- Do not restart from scratch.
- First inspect spec.md and current git state.
- Identify what Codex already completed and what remains unfinished.
- Make small, reviewable changes.
- Preserve existing architecture and naming conventions.
- Run relevant checks/tests before committing.
- Ask before destructive actions.

## Current branch
duo/continue-codex-handoff

## What to do next
1. Read spec.md.
2. Read this handoff file.
3. Read root AGENTS.md only if present.
4. Check git status, current branch, and recent commits.
5. Compare current implementation against spec.md.
6. Create a short plan.
7. Implement the next safest unfinished slice.
8. Run checks/tests.
9. Commit changes.
10. Summarize what changed and what remains.
