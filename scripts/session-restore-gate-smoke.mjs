import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const spec = read('SPEC.md');
const adr = read('docs/decisions/ADR-004-authorized-local-session-restore-gate.md');
const story = read('docs/stories/US-016-authorized-local-session-restore-approval-gate.md');
const publicApp = read('public/app.js');
const server = read('app/server.mjs');

for (const [name, text] of [
  ['SPEC.md', spec],
  ['ADR-004', adr],
  ['US-016', story]
]) {
  assert(
    text.includes('Authorized Local Session Restore'),
    `${name} must use the approved feature wording`
  );
}

const requiredApprovalPhrases = [
  /explicit human approval/i,
  /dedicated PR/i,
  /local-only storage boundary|Local-only storage boundary/i,
  /Encryption-at-rest approach|encrypted at rest/i,
  /User-facing enable\/disable control/i,
  /Kill switch behavior|kill switch/i,
  /Metadata-only audit trail|metadata only/i,
  /no-plaintext-export proof|No plaintext cookie\/session export|never .* exported in plaintext/i,
  /authorized .*shop/i
];

for (const pattern of requiredApprovalPhrases) {
  assert(
    pattern.test(adr) || pattern.test(story),
    `approval gate must document ${pattern}`
  );
}

assert(
  /id:\s*'needs-session-restore'[\s\S]*opensProfile:\s*false/.test(publicApp),
  'Needs session restore must remain a metadata-only confirmation status'
);
assert(
  publicApp.includes('Do not restore here; this requires a future approved PR.'),
  'UI copy must keep session restore implementation gated'
);

const runtimeRestoreMarkers = [
  /authorized[-_ ]local[-_ ]session[-_ ]restore/i,
  /restoreSession/i,
  /sessionRestore/i,
  /\/api\/.*session.*restore/i,
  /\/api\/.*restore.*session/i
];

for (const pattern of runtimeRestoreMarkers) {
  assert(!pattern.test(server), `server runtime must not implement ${pattern}`);
}

assert(
  !/login bypass/i.test(publicApp),
  'public UI must not frame session restore as login bypass'
);
assert(
  !/login bypass/i.test(server),
  'server runtime must not frame session restore as login bypass'
);

console.log('Session restore gate smoke passed.');
