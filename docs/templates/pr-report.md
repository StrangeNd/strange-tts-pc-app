# PR Report Template

Branch: `ai-agent/<area>-<short-task>`

Target: `main`

## Task Intake

- Type:
- Lane:
- Risk:
- Affected areas:
- Out of scope:

## Test Matrix Mapping

| Changed flow or behavior | Matrix row | Required proof | Evidence in this PR |
| --- | --- | --- | --- |
| ... | `docs/TEST_MATRIX.md` row name or `new row required` | ... | ... |

If no user-visible behavior changes, state why the existing matrix is unchanged.
If a row is missing or stale, update `docs/TEST_MATRIX.md` in this PR.

## Implementation Summary

- ...

## Validation Results

- Pending/Passed/Failed:

## Manual Validation Notes

- ...

## Risk Review

- No Text-To-Speech/audio behavior added.
- No secrets, cookies, tokens, credentials, machine IDs, license keys, or `.env` values exposed.
- No auth, payment/billing, deployment, database migration, permissions, or user data deletion/export/retention behavior changed unless explicit approval is recorded here.
- Missing/unavailable product data remains missing rather than invented where applicable.

## PR Checklist

- Do not push to `main`.
- Do not merge automatically.
- Open PR into `main`.
