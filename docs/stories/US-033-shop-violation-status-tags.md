# US-033 - Shop Violation Status Tags

## Story

As a TikTok Shop operator,
I want shop violation rows to use consistent appeal/status tags,
so that I can quickly tell whether a violation still needs appeal work.

## Acceptance Criteria

- Violation rows normalize supported source status variants to these tags:
  - `Chua khieu nai`
  - `Khieu nai khong thanh cong`
  - `Thanh cong`
  - `Khong can khieu nai`
- Unknown source statuses remain visible instead of being hidden.
- Zero-count violation rows do not inflate the violation summary count.
- Violation title/type, normalized status tag, count, and source remain visible.
- The smoke uses sanitized local fixtures and does not require an authenticated TikTok Shop profile.

## Validation

- `node --check app/business-analysis.mjs`
- `node --check scripts/shop-violation-status-tags-smoke.mjs`
- `node scripts/shop-violation-status-tags-smoke.mjs`
- `node scripts/shop-health-score-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
