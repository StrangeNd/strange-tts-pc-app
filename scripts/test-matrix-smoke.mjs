import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const matrix = await readFile(join(rootDir, 'docs', 'TEST_MATRIX.md'), 'utf8');

const rows = matrix
  .split(/\r?\n/)
  .filter(line => line.startsWith('| ') && !line.includes('---'))
  .slice(1)
  .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));

assert(rows.length > 0, 'Test matrix should contain behavior rows');

const seenAreas = new Map();
for (const row of rows) {
  const [area, criticalFlow, requiredProof, status, evidence] = row;
  assert(area, 'Test matrix area should not be empty');
  assert(criticalFlow, `Critical flow should not be empty for ${area}`);
  assert(requiredProof, `Required proof should not be empty for ${area}`);
  assert(status, `Status should not be empty for ${area}`);
  assert(evidence, `Evidence should not be empty for ${area}`);
  assert.notEqual(evidence, 'none', `Evidence should not be 'none' for ${area}`);
  assert(!seenAreas.has(area), `Duplicate test matrix area: ${area}`);
  seenAreas.set(area, row);
}

console.log(`Test matrix smoke passed: ${rows.length} rows, ${seenAreas.size} unique areas.`);
