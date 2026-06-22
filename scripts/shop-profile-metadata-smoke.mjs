import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSellerAdsUrl, createShop, getShopLibrary } from '../app/shop-library.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJs = fs.readFileSync(path.join(rootDir, 'public', 'app.js'), 'utf8');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strange-shop-profile-metadata-'));

const metadata = {
  name: 'Shop Metadata Smoke',
  avatar: 'https://example.test/avatar.png',
  loginNote: 'Owner confirmed on local machine',
  sellerId: 'seller-123',
  adsAccountId: 'ads-456',
  sellerCenterUrl: 'https://seller-vn.tiktok.com/homepage?shop_region=VN',
  sellerAdsUrl: 'https://seller-vn.tiktok.com/ads-creation/dashboard?shop_id=seller-123&aadvid=ads-456',
  compassUrl: 'https://seller-vn.tiktok.com/compass/home?shop_region=VN',
  gmvMaxUrl: 'https://seller-vn.tiktok.com/ads-creation/dashboard?type=product&aadvid=ads-456',
  shopHealthStatus: 'needs-review',
  productScoreStatus: 'missing',
  region: 'VN'
};

const created = createShop(tempRoot, metadata);
const createdShop = created.shops[0];
assert(createdShop, 'createShop should return the created shop');

for (const [key, value] of Object.entries(metadata)) {
  assert.equal(createdShop[key], value, `created shop should preserve ${key}`);
}

const libraryShop = getShopLibrary(tempRoot).shops[0];
assert.equal(libraryShop.cookieStorage, 'none', 'metadata-only shop should not create cookie storage');
assert.equal(libraryShop.loginNote, metadata.loginNote, 'public shop should expose login note metadata');
assert.equal(libraryShop.gmvMaxUrl, metadata.gmvMaxUrl, 'public shop should expose GMV Max URL metadata');

assert.equal(
  buildSellerAdsUrl(libraryShop),
  new URL(metadata.sellerAdsUrl).toString(),
  'Seller Ads opener should prefer the stored Seller Ads entry URL'
);

assert(
  buildSellerAdsUrl({ sellerId: 'seller-789', region: 'VN' }).includes('shop_id=seller-789'),
  'Seller Ads opener should still generate a fallback URL from sellerId'
);

const requiredFormFields = [
  'name="avatar"',
  'name="loginNote"',
  'name="sellerCenterUrl"',
  'name="sellerAdsUrl"',
  'name="compassUrl"',
  'name="gmvMaxUrl"',
  'name="shopHealthStatus"',
  'name="productScoreStatus"'
];
for (const field of requiredFormFields) {
  assert(appJs.includes(field), `Seller Ads setup form should include ${field}`);
}

const requiredPayloadFields = [
  "avatar: form.get('avatar')",
  "loginNote: form.get('loginNote')",
  "sellerCenterUrl: form.get('sellerCenterUrl')",
  "sellerAdsUrl: form.get('sellerAdsUrl')",
  "compassUrl: form.get('compassUrl')",
  "gmvMaxUrl: form.get('gmvMaxUrl')",
  "shopHealthStatus: form.get('shopHealthStatus')",
  "productScoreStatus: form.get('productScoreStatus')"
];
for (const field of requiredPayloadFields) {
  assert(appJs.includes(field), `create shop payload should include ${field}`);
}

assert(appJs.includes('return new URL(shop.gmvMaxUrl).toString();'), 'GMV Max card should prefer stored GMV Max URL metadata');
assert(appJs.includes('Confirm the selected shop before opening Seller Ads'), 'profile check should remain before Seller Ads opens');
assert(appJs.includes('never reads or exports cookies'), 'profile check should keep cookie safety copy');
assert(appJs.includes('renderShopSessionSafety(shop.id)'), 'created shops should route to profile confirmation before opening Seller Ads');
assert(appJs.includes("localStorage.setItem(shopSessionConfirmationKey(shop.id), JSON.stringify(metadata))"), 'profile confirmation should store local metadata only');

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('Shop profile metadata smoke passed.');
