import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const guide = readFileSync(join(rootDir, 'docs/PC_APP_USER_GUIDE.md'), 'utf8');

const requiredCopy = [
  '`Cloud Sync`: sao luu local / import-export file JSON an toan',
  '## 4.2. Cloud Sync Phase 0',
  'Cloud Sync la local backup/import-export',
  'Backup Phase 0 khong dung de upload remote',
  'Cloud Sync that, tinh nang do phai di bang PR rieng'
];

for (const copy of requiredCopy) {
  assert(guide.includes(copy), `PC user guide should include local-only Cloud Sync copy: ${copy}`);
}

const forbiddenCopy = [
  /`Cloud Sync`: luu endpoint sync/i,
  /Cloud Sync URL/i,
  /server sync/i
];

for (const pattern of forbiddenCopy) {
  assert(!pattern.test(guide), `PC user guide should not advertise remote Cloud Sync setup: ${pattern}`);
}

console.log('PC user guide Cloud Sync copy smoke passed.');
