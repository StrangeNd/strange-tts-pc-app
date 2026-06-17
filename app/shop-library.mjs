import fs from 'node:fs';
import path from 'node:path';
import { decryptJsonFromFile, encryptJsonToFile } from './crypto-store.mjs';

const SHOP_DIR = 'shops';
const CATALOG_FILE = 'catalog.json';
const COOKIE_FILE = 'cookies.enc.json';
const LEGACY_COOKIE_FILE = 'cookies.json';
const MAX_COOKIE_FILE_BYTES = 2 * 1024 * 1024;

function shopsRoot(rootDir) {
  return path.join(rootDir, 'data', SHOP_DIR);
}

function catalogPath(rootDir) {
  return path.join(shopsRoot(rootDir), CATALOG_FILE);
}

function safeId(value) {
  return String(value || 'shop')
    .normalize('NFKD')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'shop';
}

function loadCatalog(rootDir) {
  const file = catalogPath(rootDir);
  if (!fs.existsSync(file)) return { shops: [], order: [] };
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!text) return { shops: [], order: [] };
  const catalog = JSON.parse(text);
  return {
    shops: Array.isArray(catalog.shops) ? catalog.shops : [],
    order: Array.isArray(catalog.order) ? catalog.order : []
  };
}

function saveCatalog(rootDir, catalog) {
  fs.mkdirSync(shopsRoot(rootDir), { recursive: true, mode: 0o700 });
  const safeCatalog = {
    shops: (catalog.shops || []).map(({ cookieFile, ...shop }) => shop),
    order: Array.isArray(catalog.order) ? catalog.order : []
  };
  fs.writeFileSync(catalogPath(rootDir), JSON.stringify(safeCatalog, null, 2), { mode: 0o600 });
}

function parseCookies(raw) {
  if (!raw) return [];
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;
  if (!Array.isArray(cookies)) throw new Error('Cookie data must be a JSON array or an object with cookies[].');
  return cookies.map(cookie => {
    if (!cookie.name || typeof cookie.value === 'undefined') {
      throw new Error('Each cookie must include name and value.');
    }
    return {
      name: String(cookie.name),
      value: String(cookie.value),
      domain: cookie.domain || '.tiktok.com',
      path: cookie.path || '/',
      expires: cookie.expires || cookie.expirationDate || undefined,
      httpOnly: Boolean(cookie.httpOnly),
      secure: cookie.secure !== false,
      sameSite: cookie.sameSite || undefined
    };
  });
}

function shopDir(rootDir, shopId) {
  return path.join(shopsRoot(rootDir), shopId);
}

function encryptedCookiePath(rootDir, shopId) {
  return path.join(shopDir(rootDir, shopId), COOKIE_FILE);
}

function legacyCookiePath(rootDir, shopId) {
  return path.join(shopDir(rootDir, shopId), LEGACY_COOKIE_FILE);
}

function assertInsideShopRoot(rootDir, file) {
  const resolved = path.resolve(file);
  const root = path.resolve(shopsRoot(rootDir));
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Cookie file is outside the app shop data directory.');
  }
  return resolved;
}

function readCookieInputFile(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) throw new Error(`Cookie file not found: ${resolved}`);
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error('Cookie import path must be a JSON file.');
  if (!/\.json$/i.test(resolved)) throw new Error('Cookie import file must end with .json.');
  if (stat.size > MAX_COOKIE_FILE_BYTES) throw new Error('Cookie import file is too large.');
  return fs.readFileSync(resolved, 'utf8');
}

function writeCookies(rootDir, shopId, cookies) {
  const dir = shopDir(rootDir, shopId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cookieFile = encryptedCookiePath(rootDir, shopId);
  encryptJsonToFile(rootDir, cookieFile, { cookies, importedAt: new Date().toISOString() });
  const legacyFile = legacyCookiePath(rootDir, shopId);
  if (fs.existsSync(legacyFile)) fs.rmSync(legacyFile, { force: true });
  return cookieFile;
}

function readCookies(rootDir, shopId) {
  const encryptedFile = assertInsideShopRoot(rootDir, encryptedCookiePath(rootDir, shopId));
  if (fs.existsSync(encryptedFile)) {
    return parseCookies(decryptJsonFromFile(rootDir, encryptedFile));
  }

  const legacyFile = assertInsideShopRoot(rootDir, legacyCookiePath(rootDir, shopId));
  if (!fs.existsSync(legacyFile)) return [];
  const legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf8').replace(/^\uFEFF/, ''));
  const cookies = parseCookies(legacy);
  writeCookies(rootDir, shopId, cookies);
  if (fs.existsSync(legacyFile)) fs.rmSync(legacyFile, { force: true });
  return cookies;
}

function cookieStorageState(rootDir, shopId) {
  if (fs.existsSync(encryptedCookiePath(rootDir, shopId))) return 'encrypted';
  if (fs.existsSync(legacyCookiePath(rootDir, shopId))) return 'legacy';
  return 'none';
}

function publicShop(rootDir, shop) {
  const { cookieFile, ...safe } = shop;
  return {
    ...safe,
    cookieStorage: cookieStorageState(rootDir, shop.id)
  };
}

export function getShopLibrary(rootDir) {
  const catalog = loadCatalog(rootDir);
  return {
    shops: catalog.order
      .map(id => catalog.shops.find(shop => shop.id === id))
      .filter(Boolean)
      .concat(catalog.shops.filter(shop => !catalog.order.includes(shop.id)))
      .map(shop => publicShop(rootDir, shop))
  };
}

export function createShop(rootDir, input = {}) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Shop name is required.');
  const catalog = loadCatalog(rootDir);
  const baseId = safeId(name);
  let id = baseId;
  let suffix = 2;
  while (catalog.shops.some(shop => shop.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  let cookieCount = 0;
  if (input.cookiesJson || input.cookiesPath) {
    const raw = input.cookiesPath
      ? readCookieInputFile(input.cookiesPath)
      : input.cookiesJson;
    const cookies = parseCookies(raw);
    writeCookies(rootDir, id, cookies);
    cookieCount = cookies.length;
  }

  const shop = {
    id,
    name,
    sellerId: String(input.sellerId || '').trim(),
    adsAccountId: String(input.adsAccountId || '').trim(),
    region: String(input.region || 'VN').trim() || 'VN',
    cookieCount,
    cookieStorage: cookieCount ? 'encrypted' : 'none',
    cookieUpdatedAt: cookieCount ? new Date().toISOString() : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  catalog.shops.push(shop);
  catalog.order.push(id);
  saveCatalog(rootDir, catalog);
  return getShopLibrary(rootDir);
}

export function importShopCookies(rootDir, input = {}) {
  const shopId = String(input.shopId || '').trim();
  if (!shopId) throw new Error('Shop id is required.');
  const catalog = loadCatalog(rootDir);
  const shop = catalog.shops.find(item => item.id === shopId);
  if (!shop) throw new Error(`Shop not found: ${shopId}`);
  const raw = input.cookiesPath
    ? readCookieInputFile(input.cookiesPath)
    : input.cookiesJson;
  if (!raw) throw new Error('Cookie JSON or cookie file path is required.');
  const cookies = parseCookies(raw);
  writeCookies(rootDir, shopId, cookies);
  delete shop.cookieFile;
  shop.cookieCount = cookies.length;
  shop.cookieStorage = 'encrypted';
  shop.cookieUpdatedAt = new Date().toISOString();
  shop.updatedAt = new Date().toISOString();
  saveCatalog(rootDir, catalog);
  return getShopLibrary(rootDir);
}

export function buildSellerAdsUrl(shop = {}) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
  const url = new URL('https://seller-vn.tiktok.com/ads-creation/dashboard');
  if (shop.sellerId) url.searchParams.set('shop_id', shop.sellerId);
  url.searchParams.set('type', 'product');
  url.searchParams.set('shop_region', shop.region || 'VN');
  url.searchParams.set('list_order_field', 'cost');
  url.searchParams.set('list_order_type', 'descend');
  url.searchParams.set('list_status', 'delivery_ok');
  url.searchParams.set('list_start_date', String(start));
  url.searchParams.set('list_end_date', String(end));
  return url.toString();
}

export function getShop(rootDir, id) {
  const catalog = loadCatalog(rootDir);
  return catalog.shops.find(shop => shop.id === id) || null;
}

export function getShopCookies(rootDir, id) {
  const shop = getShop(rootDir, id);
  if (!shop) return [];
  const cookies = readCookies(rootDir, id);
  const catalog = loadCatalog(rootDir);
  const record = catalog.shops.find(item => item.id === id);
  if (record) {
    delete record.cookieFile;
    record.cookieCount = cookies.length;
    record.cookieStorage = cookies.length ? 'encrypted' : 'none';
    if (cookies.length) record.cookieUpdatedAt ||= new Date().toISOString();
    saveCatalog(rootDir, catalog);
  }
  return cookies;
}
