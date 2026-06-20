import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { getAppConfig, updateAppConfig } from '../app/app-config.mjs';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const appConfigSource = await readFile(join(rootDir, 'app', 'app-config.mjs'), 'utf8');
const appJs = await readFile(join(rootDir, 'public', 'app.js'), 'utf8');
const tempRoot = await mkdtemp(join(tmpdir(), 'strange-cloud-sync-smoke-'));

try {
  assert.equal(getAppConfig(tempRoot).cloudSyncUrl, '', 'Cloud Sync Phase 0 should not default to a remote URL');
  assert.equal(
    updateAppConfig(tempRoot, { cloudSyncUrl: 'https://example.invalid/sync' }).cloudSyncUrl,
    '',
    'Cloud Sync Phase 0 should ignore remote sync URLs'
  );

  assert(appJs.includes('Dong bo local / Sao luu du lieu'), 'Cloud Sync workspace should use local backup wording');
  assert(appJs.includes('strange-tiktokshop-local-backup/v1'), 'Cloud Sync workspace should export local backup schema');
  assert(appJs.includes('cloudSyncBackupPayload'), 'Cloud Sync workspace should build a local backup payload');
  assert(appJs.includes('importLocalBackup'), 'Cloud Sync workspace should support local backup import');
  assert(!appJs.includes('Cloud sync URL'), 'Cloud Sync workspace should not expose a remote endpoint field');
  assert(
    !appConfigSource.includes('cartridges-warranty-management-incentive.trycloudflare.com'),
    'App config should not ship the legacy remote Cloud Sync default'
  );
  assert(!appJs.includes('cookiesJson') || !appJs.includes('cloudSyncBackupPayload().cookiesJson'), 'Local backup should not export cookies');

  console.log('Cloud Sync local smoke passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
