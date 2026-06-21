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

function statusBlock(id) {
  const match = appJs.match(new RegExp(`\\{ id: '${id}'[\\s\\S]*?\\}`));
  assert(match, `status ${id} should exist`);
  return match[0];
}

const expectedStatuses = [
  ['correct-shop', true],
  ['wrong-shop', false],
  ['not-logged-in', true],
  ['needs-relogin', true],
  ['needs-session-restore', false]
];

for (const [id, opensProfile] of expectedStatuses) {
  assert(
    statusBlock(id).includes(`opensProfile: ${String(opensProfile)}`),
    `${id} opensProfile should be ${opensProfile}`
  );
}

assert(
  appJs.includes("const SHOP_SESSION_CONFIRMATION_PREFIX = 'strange-tiktokshop-session-confirmation';"),
  'session confirmation should use the local metadata prefix'
);

const writeConfirmation = extractFunction('writeShopSessionConfirmation');
assert(writeConfirmation.includes('localStorage.setItem'), 'confirmation metadata must be stored in localStorage');
assert(writeConfirmation.includes('shopSessionConfirmationKey(shop.id)'), 'confirmation metadata must be keyed by selected shop');

const metadataMatch = writeConfirmation.match(/const metadata = \{([\s\S]*?)\n  \};/);
assert(metadataMatch, 'confirmation metadata object should be explicit');
const metadataBody = metadataMatch[1];
for (const field of ['shopId', 'shopName', 'profileId', 'sellerId', 'adsAccountId', 'status', 'statusLabel', 'confirmedAt']) {
  assert(metadataBody.includes(field), `metadata should include ${field}`);
}
for (const forbidden of ['cookie', 'cookies', 'token', 'credential', 'authorization', 'machine', 'license', 'sessionPayload', 'headers']) {
  assert(!new RegExp(`\\b${forbidden}\\b`, 'i').test(metadataBody), `metadata must not include sensitive field ${forbidden}`);
}

const renderSafety = extractFunction('renderShopSessionSafety');
assert(
  /never reads or exports cookies/i.test(renderSafety),
  'shop/profile check copy should state that cookies are not read or exported'
);
assert(
  /if \(status\?\.opensProfile\) await openSellerAdsShopDirect\(shop\.id\);\s*else renderShopSessionSafety\(shop\.id\);/.test(renderSafety),
  'blocked confirmation statuses must not open Seller Ads automatically'
);

const openSellerAdsShop = extractFunction('openSellerAdsShop');
assert(
  /renderShopSessionSafety\(shopId\)/.test(openSellerAdsShop),
  'openSellerAdsShop should route through the confirmation screen'
);

const createSellerAdsShop = extractFunction('createSellerAdsShop');
assert(
  /renderShopSessionSafety\(shop\.id\)/.test(createSellerAdsShop),
  'create-shop flow should route through confirmation before opening Seller Ads'
);

assert(
  /shopQuickSelect\.addEventListener\('change', event => openSellerAdsShop\(event\.target\.value\)\)/.test(appJs),
  'quick dropdown should route through openSellerAdsShop'
);
assert(
  /openButton\) return openSellerAdsShop\(openButton\.dataset\.openSellerAds\)/.test(appJs),
  'shop list Seller Ads buttons should route through openSellerAdsShop'
);

const directCalls = [...appJs.matchAll(/openSellerAdsShopDirect\(/g)].length;
assert.equal(directCalls, 2, 'direct open should be limited to function definition and gated opensProfile branch');

console.log('Shop session safety smoke passed.');
