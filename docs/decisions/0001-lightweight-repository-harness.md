# 0001: Lightweight Repository Harness

Date: 2026-06-17

## Status

Accepted.

## Context

The project already has a two-agent builder/reviewer loop, but earlier runs
showed that agents can be too shallow without durable product context, risk
classification, and explicit validation expectations.

The public `hoangnb24/repository-harness` project proposes an agent-ready repo
model based on feature intake, architecture notes, test matrix, stories,
decisions, and harness growth.

## Decision

Adopt the repository-harness pattern as lightweight markdown process docs rather
than installing the full external CLI/binary layer.

The current integration adds:

- Feature intake and risk gates.
- Product contract.
- Architecture boundary notes.
- Test matrix.
- Story and decision templates.
- Harness backlog.
- Agent prompt updates to use these files.

## Consequences

- Future agent loops have a clearer contract before editing code.
- High-risk areas such as license, cookies, databases, auth, and deployment are
  easier to gate.
- Validation evidence becomes more consistent across tasks.
- The repo does not gain a new Rust CLI dependency or binary artifact yet.

## Follow-up

- Consider adding a committed UI QA harness for public shell flows.
- Consider adding sanitized crawler fixtures so business-analysis changes can be
  tested without live TikTok credentials.
