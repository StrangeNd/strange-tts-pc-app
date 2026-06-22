# Shop Health Missing Dependencies PR Report

## Summary

- Shows the Shop Health missing dependency names directly under the summary cards.
- Keeps the existing computed missing dependency count.
- Adds smoke coverage so the UI cannot regress to count-only visibility.

## Classification

- Feature intake: existing SPEC slice for `US-003-shop-health-score-center`.
- Risk lane: normal UI/product behavior change.
- Hard-stop review: no secrets, auth, billing, deployment, database migrations, retention, or destructive user data handling changed.

## Scope

- In scope: Shop Health dashboard rendering for known missing health score dependencies.
- Out of scope: health score formulas, crawler selectors, cookie/session handling, and raw Seller Center capture behavior.

## Files

- `public/app.js`
- `public/styles.css`
- `scripts/shop-health-score-smoke.mjs`
- `docs/TEST_MATRIX.md`

## Validation

- Passed:
  - `node --check public/app.js`
  - `node --check scripts/shop-health-score-smoke.mjs`
  - `node scripts/shop-health-score-smoke.mjs`
  - `node scripts/test-matrix-smoke.mjs`
  - `node scripts/security-scan.mjs`
  - `npm audit --audit-level=high`
  - `bash scripts/agent-healthcheck.sh`
  - `git diff --check`
  - Browser UI QA with Playwright CLI and system Chrome against `http://127.0.0.1:48731/`.

## Notes

- Browser QA used the existing local runtime, which had no crawler data for the selected shop. The page-load screenshot verifies the dashboard shell and empty Shop Health state.
- `scripts/shop-health-score-smoke.mjs` provides the fixture-backed proof for the missing dependency list itself, including the seller fault cancellation dependency.
- Initial parallel WSL invocations for security/audit failed with WSL service errors. Re-running sequentially passed; the app validation commands did not fail.
