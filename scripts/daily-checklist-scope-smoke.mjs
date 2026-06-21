import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJs = fs.readFileSync(path.join(rootDir, 'public', 'app.js'), 'utf8');

function extractFunction(name) {
  const start = appJs.indexOf(`function ${name}`);
  assert(start >= 0, `${name} should exist`);
  const next = appJs.indexOf('\nfunction ', start + 1);
  return appJs.slice(start, next > start ? next : appJs.length);
}

const todayKey = extractFunction('todayKey');
assert(todayKey.includes('getFullYear()'), 'todayKey should use local year');
assert(todayKey.includes('getMonth() + 1'), 'todayKey should use local month');
assert(todayKey.includes('getDate()'), 'todayKey should use local day');
assert(todayKey.includes('padStart(2, '), 'todayKey should create stable YYYY-MM-DD parts');

const currentShopKey = extractFunction('currentShopKey');
assert(
  /return shopQuickSelect\.value \|\| 'default-profile'/.test(currentShopKey),
  'checklist should scope to selected shop/profile with a default local profile'
);

const storageKey = extractFunction('opsChecklistStorageKey');
assert(storageKey.includes('OPS_CHECKLIST_PREFIX'), 'storage key should include checklist prefix');
assert(storageKey.includes('currentShopKey()'), 'storage key should include selected shop/profile');
assert(storageKey.includes('todayKey()'), 'storage key should include local date');

const readChecklist = extractFunction('readOpsChecklist');
assert(readChecklist.includes('localStorage.getItem(opsChecklistStorageKey())'), 'read should use scoped storage key');
assert(/catch\s*\{\s*return \{\};\s*\}/.test(readChecklist), 'corrupted localStorage should fall back to an empty checklist');

const writeChecklist = extractFunction('writeOpsChecklist');
assert(writeChecklist.includes('localStorage.setItem(opsChecklistStorageKey(), JSON.stringify(next))'), 'write should persist only the scoped checklist');

const renderChecklist = extractFunction('renderOpsChecklistWorkspace');
assert(renderChecklist.includes('const shopId = currentShopKey();'), 'UI should show selected shop/profile context');
assert(renderChecklist.includes('${escapeHtml(shopId)} | ${escapeHtml(todayKey())}'), 'UI should show shop/date scope');
assert(renderChecklist.includes("workspaceContent.querySelectorAll('[data-ops-check]')"), 'checkbox changes should be delegated within the workspace');
assert(renderChecklist.includes('writeOpsChecklist(next);'), 'checkbox changes should persist to localStorage');
assert(renderChecklist.includes("bindClick('#resetOpsChecklist'"), 'reset button should be bound');
assert(renderChecklist.includes('localStorage.removeItem(opsChecklistStorageKey())'), 'reset should remove only today/shop scoped checklist');
assert(renderChecklist.includes("bindClick('#openSellerFromChecklist', () => openSellerAdsShop(shopQuickSelect.value))"), 'Seller Ads action should use the shop/profile confirmation flow');

const itemIds = [...appJs.matchAll(/id:\s*'([^']+)'/g)]
  .map(match => match[1])
  .filter(id => ['seller-center-health', 'orders-risk', 'ads-budget', 'content-live-video', 'listing-quality', 'daily-report'].includes(id));
assert.equal(new Set(itemIds).size, 6, 'daily checklist should keep the six core operating tasks');

console.log('Daily checklist scope smoke passed.');
