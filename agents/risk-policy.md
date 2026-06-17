# Risk Policy

## Low Risk

Allowed without extra approval when scoped and tested:

- Text copy changes
- CSS and visual layout fixes
- Tests, docs, comments, and developer tooling
- Small UI-only changes
- Non-sensitive logging improvements

## Medium Risk

Allowed only with careful tests and clear summary:

- API/business logic
- Cache behavior
- Performance-sensitive code
- Data normalization/parsing
- Background jobs and schedulers
- Browser automation selectors

## High Risk

Requires explicit human approval before editing:

- Authentication or session handling
- Payments, billing, subscriptions, invoices
- Permissions, roles, access control
- Database schema migrations
- Deployment config, production infra, CI/CD release steps
- Secrets, credentials, cookies, tokens, key material
- User data deletion, retention, export, or privacy behavior

If a task touches high-risk areas, agents must stop and write the required approval request into `BUG_REPORT.md` or the active task report.
