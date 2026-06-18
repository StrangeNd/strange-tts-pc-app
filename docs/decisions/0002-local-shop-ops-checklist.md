# 0002 Local Shop Ops Checklist

## Context

Operators need a lightweight daily workflow inside the PC app before deeper
TikTok Shop API/crawler integrations are safe to automate.

## Decision

Add a browser-local daily operations checklist. Checklist state is stored in
`localStorage`, scoped by selected shop/profile and local date.

## Rationale

- Keeps the feature useful without touching TikTok Seller Center APIs.
- Avoids backend, database, auth, permission, and deployment changes.
- Gives operators a repeatable daily workflow that works offline.

## Consequences

- Checklist state is local to the browser profile and device.
- It is not shared across machines or users.
- If `localStorage` is cleared, checklist progress is lost.
