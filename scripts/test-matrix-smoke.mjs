import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const matrix = await readFile(join(rootDir, 'docs', 'TEST_MATRIX.md'), 'utf8');

const rows = matrix
  .split(/\r?\n/)
  .filter(line => line.startsWith('| ') && !line.includes('---'))
  .slice(1)
  .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));

function evidenceRefs(evidence) {
  return [...evidence.matchAll(/`([^`]+)`/g)]
    .map(match => match[1].trim())
    .filter(ref => /^(scripts|docs|agents|app|public|extension)\//.test(ref) || /^[A-Z0-9_]+_PR_REPORT\.md$/.test(ref));
}

async function pathExists(ref) {
  try {
    await access(join(rootDir, ref));
    return true;
  } catch {
    return false;
  }
}

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
  for (const ref of evidenceRefs(evidence)) {
    assert(await pathExists(ref), `Missing test matrix evidence path for ${area}: ${ref}`);
  }
  seenAreas.set(area, row);
}

console.log(`Test matrix smoke passed: ${rows.length} rows, ${seenAreas.size} unique areas.`);
