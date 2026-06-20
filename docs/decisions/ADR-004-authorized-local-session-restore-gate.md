# ADR-004 - Authorized Local Session Restore Gate

Date: 2026-06-20

## Status

Proposed guardrail.

## Context

`SPEC.md` identifies Authorized Local Session Restore as a desired but high-risk capability. It may involve sensitive session material, browser profiles, and local operator authorization. The repository guardrails require explicit human approval before editing auth, session handling, cookies, credentials, permissions, deployment, database migrations, or secrets.

## Decision

Do not implement session restore until a dedicated, explicitly approved PR is opened for that purpose.

Any future PR must use the product wording `Authorized Local Session Restore` and must not frame the feature as a login bypass or platform-permission bypass.

The approval request must record:

- Authorized user/team and shop/profile scope.
- Local-only storage boundary.
- Encryption-at-rest approach.
- User-facing enable/disable control.
- Kill switch behavior.
- Metadata-only audit trail.
- Secret scrubbing and no-plaintext-export proof.
- Manual validation limits for authenticated local profiles.

## Required Proof For Future Implementation

- No cookies, tokens, credentials, authorization headers, machine IDs, license keys, or private browser state in logs.
- No sensitive session material in PR reports, screenshots, crawler reports, or raw snapshot artifacts.
- No plaintext cookie/session export.
- Local encryption behavior is documented and verified.
- Audit entries contain metadata only.
- Restore is limited to shops/profiles the user/team is authorized to operate.
- Disable/kill switch behavior is visible and tested.

## Consequences

- Product/UI work may mention `Needs session restore`, but it must not perform restore.
- Agents must stop before implementation if explicit approval is missing.
- Discovery, docs, and approval-packet PRs are allowed when they do not read, write, export, or restore sensitive session material.
