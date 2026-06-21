# US-027 - Ads Spend Missing Components Smoke

## Story

As a TikTok Shop operator,
I want Ads Spend to show when Cash, Credit, and Ads credit source fields are missing,
so that a matched GMV Max campaign is not silently treated as having real zero spend.

## Acceptance Criteria

- A synthetic Ads actual file can match a GMV Max campaign while omitting Cash, Credit, and Ads credit columns.
- The matched Ads actual row is counted as matched, while non-GMV rows are skipped.
- Ads Spend component metadata remains present for Cash, Credit, direct Ads credit, prorated Ads credit, and other visible spend fields.
- Missing component source fields are marked unavailable with zero source rows.
- Business analysis emits a warning that Ads Spend is missing because spend columns are absent.
- Missing Ads Spend does not invent a non-zero cost.

## Validation

- `node --check app/business-analysis.mjs`
- `node --check scripts/ads-spend-missing-smoke.mjs`
- `node scripts/ads-spend-missing-smoke.mjs`
- `node scripts/security-scan.mjs`
- `npm audit --audit-level=high`
- `scripts/agent-healthcheck.sh`
