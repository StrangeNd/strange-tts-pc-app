# Feature Intake

Every implementation request enters this gate before code changes.

## Intake Output

At the start of a task, Agent A should be able to summarize:

```text
Type: change request
Lane: normal
Affected areas: public TTS shell, desktop app UI
Proof: healthcheck, browser QA, no console errors
Story: docs/stories/US-XXX-name.md or direct patch
```

## Input Types

| Type | Use When | Typical Artifact |
| --- | --- | --- |
| New spec | A new product area or commercial requirement is introduced | Product doc plus story candidates |
| Spec slice | Implementing one accepted behavior from a larger plan | Story packet |
| Change request | Fixing or refining existing behavior | Direct patch or story packet |
| Maintenance request | Tooling, tests, scripts, CI, docs, performance, security | Validation report or decision |
| Harness improvement | Improving agent workflow itself | Docs/templates update |

## Lanes

### Tiny

Use for low-risk docs, copy, CSS, test metadata, small agent workflow docs, and
narrow UI-only changes.

Requirements:

- Patch directly.
- Run available quick checks.
- Update docs if behavior or workflow changes.

### Normal

Use for story-sized behavior with bounded blast radius.

Requirements:

- Create or update one story file under `docs/stories/` when the behavior is
  larger than a small direct patch.
- Update `docs/TEST_MATRIX.md` with expected proof.
- Run healthcheck and targeted QA.
- Record rejection details in `BUG_REPORT.md` when Agent B rejects.

### High Risk

Requires explicit human approval before editing.

Use when touching:

- Auth, sessions, passwords, license enforcement, or permissions.
- Payment, billing, subscriptions, invoices, or commercial key systems.
- Database migrations, data retention/deletion/export, or user/crawler raw data.
- Deployment config, release automation, production infrastructure, CI release
  gates, or secrets.
- Cross-shop isolation, cookie handling, encrypted storage, or sensitive logs.

## Risk Checklist

Mark each flag that applies:

- Auth/session/license.
- Payment/billing.
- Permissions/roles.
- Data model or migration.
- Secret/cookie/credential handling.
- Production deployment or release config.
- Public API contract.
- Browser automation against third-party systems.
- Desktop/window/runtime shell behavior.
- Existing behavior with weak proof.
- Multi-domain change.

Classification:

- 0-1 flags: tiny or normal, based on code impact.
- 2-3 flags: normal with stronger validation.
- 4+ flags or any hard gate: high risk.

## Hard Gates

Stop and ask for approval before changing:

- License/payment activation logic.
- Cookie encryption/import/export behavior.
- Database deletion/migration.
- Production deployment or update distribution.
- Auth, permissions, or admin role behavior.
