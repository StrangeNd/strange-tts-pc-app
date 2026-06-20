import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const template = readFileSync(join(rootDir, 'docs/templates/pr-report.md'), 'utf8');
const backlog = readFileSync(join(rootDir, 'docs/HARNESS_BACKLOG.md'), 'utf8');

const requiredSections = [
  '## Task Intake',
  '## Test Matrix Mapping',
  '## Implementation Summary',
  '## Validation Results',
  '## Manual Validation Notes',
  '## Risk Review',
  '## PR Checklist'
];

for (const section of requiredSections) {
  assert(template.includes(section), `PR report template should include ${section}`);
}

const requiredMappingCopy = [
  '| Changed flow or behavior | Matrix row | Required proof | Evidence in this PR |',
  'If no user-visible behavior changes, state why the existing matrix is unchanged.',
  'If a row is missing or stale, update `docs/TEST_MATRIX.md` in this PR.'
];

for (const copy of requiredMappingCopy) {
  assert(template.includes(copy), `PR report template should preserve test matrix mapping copy: ${copy}`);
}

const requiredRiskCopy = [
  'No Text-To-Speech/audio behavior added.',
  'No secrets, cookies, tokens, credentials, machine IDs, license keys, or `.env` values exposed.',
  'No auth, payment/billing, deployment, database migration, permissions, or user data deletion/export/retention behavior changed unless explicit approval is recorded here.',
  'Missing/unavailable product data remains missing rather than invented where applicable.'
];

for (const copy of requiredRiskCopy) {
  assert(template.includes(copy), `PR report template should preserve risk review copy: ${copy}`);
}

assert(template.includes('Do not push to `main`.'), 'PR checklist should prohibit pushing to main');
assert(template.includes('Do not merge automatically.'), 'PR checklist should prohibit auto-merge');
assert(template.includes('Open PR into `main`.'), 'PR checklist should require PR into main');

assert(
  /\| HB-002 \|[^|\n]*test matrix[^|\n]*\|[^|\n]*report template[^|\n]*\| implemented: `docs\/templates\/pr-report\.md`; `scripts\/pr-report-template-smoke\.mjs` \|/i.test(backlog),
  'HB-002 should be marked implemented with template and smoke evidence'
);

console.log('PR report template smoke passed.');
