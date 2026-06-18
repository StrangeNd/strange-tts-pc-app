# Bug Report

## Round

Daily Shop Ops Checklist - Agent B round 1.

## Status

REJECTED, then fixed and retested.

## Steps

1. Inspect the new checklist UI entry and workspace copy.
2. Compare the new copy against the app's Vietnamese UI direction.

## Expected Result

New user-facing labels should be readable Vietnamese and should not make the
local operations workflow look unfinished.

## Actual Result

The new checklist menu label and workspace text used unaccented Vietnamese.

## Evidence

- `public/index.html` initially added `Checklist van hanh`.
- `public/app.js` initially added unaccented checklist task titles and details.

## Suspected Cause

The initial implementation followed the existing mixed ASCII/mojibake style in
parts of the app too closely instead of keeping new feature text polished.

## Suggested Fix

Use Vietnamese with accents for new checklist copy. For the menu label in
`public/index.html`, use HTML entities where needed to avoid issues with the
file's legacy mixed encoding.

## Resolution

Fixed in the same branch. Validation passed after the copy update.
