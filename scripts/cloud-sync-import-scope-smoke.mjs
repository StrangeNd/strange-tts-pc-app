import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(rootDir, 'public', 'app.js'), 'utf8');

function extractFunction(name) {
  const start = appJs.indexOf(`function ${name}`);
  assert(start >= 0, `${name} should exist`);
  const next = appJs.indexOf('\nfunction ', start + 1);
  return appJs.slice(start, next > start ? next : appJs.length);
}

const backupShop = extractFunction('localBackupShop');
const backupPayload = extractFunction('cloudSyncBackupPayload');
const importBackup = extractFunction('importLocalBackup');
const renderCloudSync = extractFunction('renderCloudSyncWorkspace');

const allowedShopFields = [
  'id',
  'name',
  'avatar',
  'loginNote',
  'sellerId',
  'adsAccountId',
  'sellerCenterUrl',
  'sellerAdsUrl',
  'compassUrl',
  'gmvMaxUrl',
  'shopHealthStatus',
  'productScoreStatus',
  'region',
  'cookieStorage'
];

for (const field of allowedShopFields) {
  assert(backupShop.includes(`${field}: shop.${field} ||`) || backupShop.includes(`${field}: shop.${field}`), `backup shop should preserve safe reference metadata: ${field}`);
}

for (const forbidden of ['cookiesJson', 'cookiesPath', 'cookies:', 'token:', 'credential:', 'machineId:', 'licenseKey:', 'privateBrowserState:', 'sessionPayload:']) {
  assert(!backupShop.includes(forbidden), `backup shop should not export sensitive field ${forbidden}`);
  assert(!backupPayload.includes(forbidden), `backup payload should not export sensitive field ${forbidden}`);
}

assert(backupPayload.includes("schema: 'strange-tiktokshop-local-backup/v1'"), 'backup should use the local Phase 0 schema');
assert(backupPayload.includes("mode: 'local-only'"), 'backup should remain local-only');
assert(backupPayload.includes('(state.shops || []).map(localBackupShop)'), 'backup should include shop references through the safe mapper');
assert(backupPayload.includes('Cookies, tokens, credentials, machine IDs, license keys, and private browser state are not exported.'), 'backup notes should warn about excluded sensitive data');

assert(importBackup.includes("parsed.schema !== 'strange-tiktokshop-local-backup/v1'"), 'import should reject non-local backup schemas');
assert(importBackup.includes("parsed.mode !== 'local-only'"), 'import should reject non-local modes');
assert(importBackup.includes('saveAppConfig({'), 'import should restore app config only');
assert(importBackup.includes("imported: 'appConfig'"), 'import result should say only appConfig was imported');
assert(importBackup.includes('shops are included as read-only backup reference only'), 'import should skip shop/profile state restoration');
assert(!importBackup.includes('/api/shops/create'), 'import should not create shop profiles from backup');
assert(!importBackup.includes('/api/shops/import-cookies'), 'import should not import cookies from backup');
assert(!importBackup.includes('state.shops ='), 'import should not mutate runtime shop state from backup');

assert(renderCloudSync.includes('Remote cloud'), 'Cloud Sync workspace should explicitly show remote cloud is off');
assert(renderCloudSync.includes('Backup khong xuat cookies, tokens, credentials, machine IDs, license keys'), 'Cloud Sync UI should warn that sensitive data is excluded');
assert(renderCloudSync.includes('accept="application/json"'), 'Cloud Sync import should accept local JSON backup files only');

console.log('Cloud Sync import scope smoke passed.');
