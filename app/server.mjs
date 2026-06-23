import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { ensureAdmin, hashPassword, randomToken, saveAdmin, verifyPassword } from './auth.mjs';
import { getAppConfig, updateAppConfig } from './app-config.mjs';
import { appendAudit, auditLogPath } from './audit-log.mjs';
import { analyzeBusinessInput, buildAllShopOverviewsFromCrawler, getBusinessCalculationRules, saveBusinessCalculationRules } from './business-analysis.mjs';
import { fetchShopDataHeadless, findChromeExecutable, getRuntimePaths, launchChrome, launchChromeAppWindow, launchChromeWithCookies, syncExtensionToRuntime } from './chrome-launcher.mjs';
import { encryptionStatus } from './crypto-store.mjs';
import { ensureExtensionLibrary, getExtensionLibrary, importExtensionFromPath, setActiveExtension } from './extension-library.mjs';
import { activateLicense, deactivateLicense, getLicenseMetadata, getLicenseStatus } from './license.mjs';
import { buildSellerAdsUrl, createShop, getShop, getShopCookies, getShopLibrary, importShopCookies } from './shop-library.mjs';
import { crawlCompassMonths, crawlSellerCenterDeep, loadCompassDatabase, loadSellerCenterLatest } from './tiktokshop-crawler.mjs';
import { downloadTikTokVideo } from './video-download.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const privateDir = path.join(rootDir, 'data', 'private');
const logDir = path.join(rootDir, 'data', 'logs');
const sessions = new Map();
const crawlerJobs = new Map();
const requireLogin = process.env.STTS_REQUIRE_LOGIN === '1';
const enforceLicense = process.env.STTS_LICENSE_ENFORCE !== '0';

fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadManifest() {
  return readJsonFile(path.join(rootDir, 'extension', 'manifest.json'));
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...headers
  });
  res.end(body);
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const idx = part.indexOf('=');
        return idx === -1 ? [part, ''] : [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function getSession(req) {
  if (!requireLogin) {
    return { username: 'local-admin', createdAt: Date.now(), expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 };
  }
  const token = parseCookies(req.headers.cookie).stts_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  return session;
}

async function readBody(req, { maxBytes = 1024 * 1024 } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function setSecurityHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('content-security-policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const target = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(publicDir, target));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  }[ext] || 'application/octet-stream';
  setSecurityHeaders(res);
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}

function runNodeScript(scriptName) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(rootDir, 'scripts', scriptName)], {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('close', code => resolve({ code, stdout: stdout.slice(-12000), stderr: stderr.slice(-12000) }));
  });
}

function publicHealth() {
  const manifest = loadManifest();
  return {
    ok: true,
    app: 'Strange TTS PC App',
    version: manifest.version,
    extensionName: manifest.name,
    host: '127.0.0.1',
    time: new Date().toISOString()
  };
}

function licenseRequiredForPath(pathname) {
  if (!enforceLicense) return false;
  if (!pathname.startsWith('/api/')) return false;
  const publicPaths = new Set([
    '/api/health',
    '/api/license/status',
    '/api/license/activate',
    '/api/license/deactivate',
    '/api/extension/open-page',
    '/api/extension/open-dashboard-app',
    '/api/app/open-dashboard-app',
    '/api/sync-extension-runtime'
  ]);
  return !publicPaths.has(pathname);
}

function privateStatus() {
  const manifest = loadManifest();
  const runtime = getRuntimePaths(rootDir);
  const admin = ensureAdmin(privateDir);
  const library = getExtensionLibrary(rootDir);
  return {
    ...publicHealth(),
    manifestPermissions: manifest.permissions || [],
    hostPermissions: manifest.host_permissions || [],
    runtime,
    managedBrowser: findChromeExecutable(),
    extensionLibrary: {
      active: library.active,
      count: library.extensions.length
    },
    admin: {
      username: admin.username,
      mustChangePassword: Boolean(admin.mustChangePassword)
    },
    appConfig: getAppConfig(rootDir),
    license: getLicenseStatus(rootDir),
    dataSecurity: {
      cookieEncryption: encryptionStatus(rootDir),
      cookieStoreFile: path.join(rootDir, 'data', 'shops', '<shopId>', 'cookies.enc.json'),
      auditLog: auditLogPath(rootDir)
    }
  };
}

function safeRuntimeProfileName(value) {
  return String(value || 'shop')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'shop';
}

function runtimeShopProfileName(shop = {}, shopKey = '') {
  const identity = shop.canonical_shop_id || shop.seller_id || shop.oec_seller_id || shop.shop_id || shop.aadvid || shopKey || shop.name;
  return `shop-${safeRuntimeProfileName(identity)}`;
}

function runtimeShopHeadlessProfileName(shop = {}, shopKey = '') {
  return `${runtimeShopProfileName(shop, shopKey)}-headless`;
}

function redactRuntimeData(value) {
  if (Array.isArray(value)) return value.map(redactRuntimeData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/(cookie|token|secret|password|authorization|csrf|session|header|value)/i.test(key)) {
      if (/^(totalGmv|gmv|onsite_roi2_shopping_value)$/i.test(key)) return [key, item];
      return [key, '[redacted]'];
    }
    return [key, redactRuntimeData(item)];
  }));
}

function assertRuntimeUrlAllowed(targetUrl) {
  const parsed = new URL(targetUrl);
  const host = parsed.hostname.toLowerCase();
  const allowed = [
    'seller-vn.tiktok.com',
    'seller.tiktok.com',
    'ads.tiktok.com',
    'business.tiktok.com',
    'shop.tiktok.com',
    'www.tiktok.com',
    'm.tiktok.com'
  ];
  if (!allowed.some(item => host === item || host.endsWith(`.${item}`))) {
    throw new Error(`Runtime URL is not allowed: ${host}`);
  }
  return parsed.href;
}

function crawlerDefaultUrl(mode, shop = {}) {
  if (mode === 'compass') {
    return shop.compassUrl || 'https://seller-vn.tiktok.com/compass/data-overview?shop_region=VN';
  }
  return shop.sellerCenterUrl || 'https://seller-vn.tiktok.com/homepage?shop_region=VN';
}

async function prepareCrawlerBrowser(body = {}, mode = 'seller-center') {
  const shopId = String(body.shopId || body.sellerId || 'little-apricot-hawaii-fashion');
  const storedShop = getShop(rootDir, shopId);
  const shop = {
    ...(storedShop || {}),
    ...(body.shop || {})
  };
  const sellerId = String(body.sellerId || shop.sellerId || shop.oec_seller_id || '7494478078863902049');
  const targetUrl = assertRuntimeUrlAllowed(body.baseUrl || crawlerDefaultUrl(mode, shop));
  const requestedPort = Number(body.cdpPort || 0);
  const autoOpenProfile = body.autoOpenProfile === true || body.autoOpenProfile === 'true' || !requestedPort;
  if (!autoOpenProfile) {
    return { shopId, sellerId, cdpPort: requestedPort, targetUrl, launch: null };
  }

  const shopKey = String(body.shopKey || shop.local_key || shop.canonical_shop_id || sellerId || shopId);
  const profileName = runtimeShopProfileName(shop, shopKey);
  const cookies = storedShop?.id ? getShopCookies(rootDir, storedShop.id) : [];
  const launch = await launchChromeWithCookies(rootDir, {
    appUrl: targetUrl,
    profileName,
    cookies,
    shopContext: {
      shopKey,
      name: shop.name || shop.shopRealName || shopId,
      avatar: shop.avatar || shop.shopAvatar || shop.shopLogo || '',
      sellerId,
      adsAccountId: shop.adsAccountId || shop.aadvid || '',
      profileName,
      pageType: mode === 'compass' ? 'compass' : 'seller-center',
      targetUrl
    },
    appWindow: true,
    extensionPage: '',
    stopExistingProfile: body.stopExistingProfile !== false
  });
  return { shopId, sellerId, cdpPort: launch.debugPort, targetUrl, launch };
}
export function createServer({ port = 48731 } = {}) {
  ensureAdmin(privateDir);
  ensureExtensionLibrary(rootDir);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type',
          'cache-control': 'no-store'
        });
        return res.end();
      }
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, publicHealth());
      }

      if (url.pathname === '/api/license/status' && req.method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          license: getLicenseStatus(rootDir),
          metadata: getLicenseMetadata(rootDir)
        });
      }

      if (url.pathname === '/api/license/activate' && req.method === 'POST') {
        const body = await readBody(req);
        const result = activateLicense(rootDir, body.key);
        appendAudit(rootDir, result.ok ? 'license.activate' : 'license.activate_failed', {
          active: result.active,
          machineId: result.status?.machineId || result.machineId || '',
          error: result.error || ''
        });
        return sendJson(res, result.ok ? 200 : 400, result);
      }

      if (url.pathname === '/api/license/deactivate' && req.method === 'POST') {
        const result = deactivateLicense(rootDir);
        appendAudit(rootDir, 'license.deactivate', { machineId: result.machineId });
        return sendJson(res, 200, result);
      }

      if (url.pathname === '/api/login' && req.method === 'POST') {
        const body = await readBody(req);
        const admin = ensureAdmin(privateDir);
        if (body.username !== admin.username || !verifyPassword(String(body.password || ''), admin.password)) {
          return sendJson(res, 401, { ok: false, error: 'Sai tai khoan hoac mat khau.' });
        }
        const token = randomToken();
        sessions.set(token, {
          username: admin.username,
          createdAt: Date.now(),
          expiresAt: Date.now() + 8 * 60 * 60 * 1000
        });
        return sendJson(res, 200, { ok: true, user: admin.username, mustChangePassword: Boolean(admin.mustChangePassword) }, {
          'set-cookie': `stts_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
        });
      }

      const session = getSession(req);
      if (requireLogin && url.pathname.startsWith('/api/') && !session) {
        return sendJson(res, 401, { ok: false, error: 'Can dang nhap admin.' });
      }

      if (licenseRequiredForPath(url.pathname)) {
        const license = getLicenseStatus(rootDir);
        if (!license.active) {
          return sendJson(res, 402, {
            ok: false,
            error: 'Can kich hoat license de su dung tinh nang nay.',
            license
          });
        }
      }

      if (url.pathname === '/api/session' && req.method === 'GET') {
        const admin = ensureAdmin(privateDir);
        return sendJson(res, 200, { ok: true, user: session.username, mustChangePassword: Boolean(admin.mustChangePassword) });
      }

      if (url.pathname === '/api/logout' && req.method === 'POST') {
        const token = parseCookies(req.headers.cookie).stts_session;
        if (token) sessions.delete(token);
        return sendJson(res, 200, { ok: true }, {
          'set-cookie': 'stts_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
        });
      }

      if (url.pathname === '/api/status' && req.method === 'GET') {
        return sendJson(res, 200, privateStatus());
      }

      if (url.pathname === '/api/app-config' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, config: getAppConfig(rootDir) });
      }

      if (url.pathname === '/api/app-config' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, { ok: true, config: updateAppConfig(rootDir, body) });
      }

      if (url.pathname === '/api/extensions' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, library: getExtensionLibrary(rootDir) });
      }

      if (url.pathname === '/api/change-password' && req.method === 'POST') {
        const body = await readBody(req);
        const nextPassword = String(body.nextPassword || '');
        if (nextPassword.length < 12) {
          return sendJson(res, 400, { ok: false, error: 'Mat khau moi can it nhat 12 ky tu.' });
        }
        const admin = ensureAdmin(privateDir);
        admin.password = hashPassword(nextPassword);
        admin.mustChangePassword = false;
        admin.updatedAt = new Date().toISOString();
        saveAdmin(privateDir, admin);
        appendAudit(rootDir, 'admin.password_changed', { username: admin.username });
        return sendJson(res, 200, { ok: true });
      }

      if (url.pathname === '/api/launch-chrome' && req.method === 'POST') {
        const body = await readBody(req);
        const result = await launchChrome(rootDir, {
          appUrl: `http://127.0.0.1:${port}`,
          profileName: body.profileName || 'default',
          extensionPage: body.extensionPage || ''
        });
        appendAudit(rootDir, 'browser.launch', { profileName: result.profileName, extensionId: result.extensionId });
        return sendJson(res, 200, { ok: true, result });
      }

      if (url.pathname === '/api/extension/open-page' && req.method === 'POST') {
        const body = await readBody(req);
        const allowedPages = new Set(['pages/login.html', 'pages/dashboard.html', 'pages/guide.html']);
        const extensionPage = allowedPages.has(body.page) ? body.page : 'pages/login.html';
        if (extensionPage === 'pages/dashboard.html') {
          const result = await launchChromeAppWindow(rootDir, {
            profileName: body.profileName || 'default',
            extensionPage
          });
          appendAudit(rootDir, 'extension.open_dashboard_app_window', { profileName: result.profileName, extensionId: result.extensionId });
          return sendJson(res, 200, { ok: true, result });
        }
        const result = await launchChrome(rootDir, {
          appUrl: `http://127.0.0.1:${port}`,
          profileName: body.profileName || 'default',
          extensionPage,
          closeInitialPage: true,
          closeOtherPages: true
        });
        appendAudit(rootDir, 'extension.open_page', { profileName: result.profileName, page: extensionPage, extensionId: result.extensionId });
        return sendJson(res, 200, { ok: true, result });
      }

      if (url.pathname === '/api/extension/open-dashboard-app' && req.method === 'POST') {
        const body = await readBody(req);
        const requestedPage = String(body.extensionPage || body.page || 'pages/dashboard.html').replace(/^\/+/, '');
        const extensionPage = /^pages\/dashboard\.html(?:\?(?:tab|view)=[a-z-]+)?$/i.test(requestedPage)
          ? requestedPage
          : 'pages/dashboard.html';
        const result = await launchChromeAppWindow(rootDir, {
          profileName: body.profileName || 'default',
          extensionPage
        });
        appendAudit(rootDir, 'extension.open_dashboard_app_window', { profileName: result.profileName, extensionId: result.extensionId });
        return sendJson(res, 200, { ok: true, result });
      }

      if (url.pathname === '/api/app/open-dashboard-app' && req.method === 'POST') {
        const body = await readBody(req);
        const result = await launchChromeWithCookies(rootDir, {
          appUrl: `http://127.0.0.1:${port}`,
          profileName: body.profileName || 'default',
          cookies: [],
          extensionPage: '',
          appWindow: true
        });
        appendAudit(rootDir, 'app.open_dashboard_app_window', { profileName: result.profileName, extensionId: result.extensionId });
        return sendJson(res, 200, { ok: true, result: { ...result, appUrl: `http://127.0.0.1:${port}` } });
      }

      if (url.pathname === '/api/sync-extension-runtime' && req.method === 'POST') {
        const body = await readBody(req);
        const result = syncExtensionToRuntime(rootDir, { profileName: body.profileName || 'default' });
        return sendJson(res, 200, { ok: true, result });
      }

      if (url.pathname === '/api/extensions/sync-bundled' && req.method === 'POST') {
        return sendJson(res, 200, { ok: true, library: ensureExtensionLibrary(rootDir) });
      }

      if (url.pathname === '/api/extensions/import-path' && req.method === 'POST') {
        const body = await readBody(req);
        const library = importExtensionFromPath(rootDir, body.path);
        appendAudit(rootDir, 'extension.import_path', { path: body.path, activeId: library.activeId });
        return sendJson(res, 200, { ok: true, library });
      }

      if (url.pathname === '/api/extensions/set-active' && req.method === 'POST') {
        const body = await readBody(req);
        const library = setActiveExtension(rootDir, body.id);
        appendAudit(rootDir, 'extension.set_active', { id: body.id });
        return sendJson(res, 200, { ok: true, library });
      }

      if (url.pathname === '/api/shops' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, library: getShopLibrary(rootDir) });
      }

      if (url.pathname === '/api/shops/create' && req.method === 'POST') {
        const body = await readBody(req);
        const library = createShop(rootDir, body);
        const shop = library.shops.at(-1);
        appendAudit(rootDir, 'shop.create', { shopId: shop?.id, name: shop?.name, cookieCount: shop?.cookieCount || 0 });
        return sendJson(res, 200, { ok: true, library });
      }

      if (url.pathname === '/api/shops/import-cookies' && req.method === 'POST') {
        const body = await readBody(req);
        const library = importShopCookies(rootDir, body);
        const shop = library.shops.find(item => item.id === body.shopId);
        appendAudit(rootDir, 'shop.import_cookies', { shopId: body.shopId, cookieCount: shop?.cookieCount || 0 });
        return sendJson(res, 200, { ok: true, library });
      }

      if (url.pathname === '/api/shops/open-seller-ads' && req.method === 'POST') {
        const body = await readBody(req);
        const shop = getShop(rootDir, body.shopId);
        if (!shop) return sendJson(res, 404, { ok: false, error: 'Shop not found.' });
        const sellerAdsUrl = buildSellerAdsUrl(shop);
        const cookies = getShopCookies(rootDir, shop.id);
        const result = await launchChromeWithCookies(rootDir, {
          appUrl: sellerAdsUrl,
          profileName: shop.id,
          cookies,
          shopContext: {
            shopKey: shop.id,
            name: shop.name,
            avatar: shop.shopAvatar || shop.shopLogo || '',
            profileName: shop.id,
            pageType: 'seller'
          },
          appWindow: true,
          extensionPage: ''
        });
        appendAudit(rootDir, 'shop.open_seller_ads', { shopId: shop.id, cookieCount: cookies.length, extensionId: result.extensionId });
        return sendJson(res, 200, { ok: true, shop, sellerAdsUrl, cookieCount: cookies.length, result });
      }

      if (url.pathname === '/api/runtime/open-shop-page' && req.method === 'POST') {
        const body = await readBody(req);
        const shop = body.shop || {};
        const shopKey = String(body.shopKey || shop.local_key || shop.canonical_shop_id || shop.seller_id || shop.oec_seller_id || shop.aadvid || '');
        const cookies = Array.isArray(shop.cookies) ? shop.cookies : [];
        const targetUrl = assertRuntimeUrlAllowed(body.targetUrl || buildSellerAdsUrl(shop));
        const profileName = runtimeShopProfileName(shop, shopKey);
        const result = await launchChromeWithCookies(rootDir, {
          appUrl: targetUrl,
          profileName,
          cookies,
          shopContext: {
            shopKey,
            name: shop.shopRealName || shop.name || shopKey || profileName,
            avatar: shop.shopAvatar || shop.shopLogo || '',
            sellerId: shop.seller_id || shop.oec_seller_id || '',
            adsAccountId: shop.aadvid || '',
            profileName,
            pageType: body.pageType || 'seller',
            targetUrl
          },
          appWindow: true,
          extensionPage: ''
        });
        appendAudit(rootDir, 'runtime.open_shop_page', {
          shopKey,
          profileName,
          pageType: body.pageType || 'seller',
          cookieCount: cookies.length,
          extensionId: result.extensionId
        });
        return sendJson(res, 200, {
          ok: true,
          profileName,
          targetUrl,
          cookieCount: cookies.length,
          result
        });
      }

      if (url.pathname === '/api/runtime/fetch-shop-data' && req.method === 'POST') {
        const body = await readBody(req);
        const storedShop = body.shopId ? getShop(rootDir, body.shopId) : null;
        const shop = {
          ...(storedShop || {}),
          ...(body.shop || {})
        };
        const shopKey = String(body.shopKey || body.shopId || shop.local_key || shop.canonical_shop_id || shop.seller_id || shop.oec_seller_id || shop.aadvid || shop.id || '');
        const cookies = Array.isArray(body.shop?.cookies)
          ? body.shop.cookies
          : (storedShop?.id ? getShopCookies(rootDir, storedShop.id) : []);
        if (!shop.aadvid) {
          return sendJson(res, 400, { ok: false, error: 'Missing Ads Account ID (aadvid).' });
        }
        if (!cookies.length) {
          return sendJson(res, 400, { ok: false, error: 'Missing shop cookies for headless fetch.' });
        }
        const profileName = runtimeShopHeadlessProfileName(shop, shopKey);
        const result = await fetchShopDataHeadless(rootDir, {
          profileName,
          cookies,
          shop: {
            ...shop,
            name: shop.shopRealName || shop.name || shopKey || profileName,
            cookies
          },
          fetchOptions: body.fetchOptions || {},
          timeoutMs: body.timeoutMs || 90000
        });
        const data = redactRuntimeData(result.data);
        appendAudit(rootDir, 'runtime.fetch_shop_data_headless', {
          shopKey,
          profileName,
          aadvid: shop.aadvid,
          sellerId: shop.oec_seller_id || shop.seller_id || '',
          cookieCount: cookies.length,
          extensionId: result.extensionId,
          status: data?.status || '',
          durationMs: result.durationMs
        });
        return sendJson(res, 200, {
          ok: data?.status === 'ok',
          headless: true,
          profileName,
          cookieCount: cookies.length,
          result: {
            chrome: result.chrome,
            extensionId: result.extensionId,
            profileName: result.profileName,
            cookiesApplied: result.cookiesApplied,
            durationMs: result.durationMs
          },
          data
        });
      }

      if (url.pathname === '/api/video/download' && req.method === 'POST') {
        const body = await readBody(req);
        try {
          if (body.operatorCanView !== true) {
            return sendJson(res, 400, { ok: false, error: 'Confirm the selected shop/profile can already view this video before downloading.' });
          }
          appendAudit(rootDir, 'video.download_start', {
            profileId: body.profileId || 'default-profile',
            shopName: body.shopName || '',
            operatorCanView: true
          });
          const result = await downloadTikTokVideo(body.url);
          appendAudit(rootDir, 'video.download_done', {
            profileId: body.profileId || 'default-profile',
            shopName: body.shopName || '',
            bytes: result.bytes,
            source: result.source
          });
          return sendJson(res, 200, { ok: true, result });
        } catch (error) {
          return sendJson(res, 400, { ok: false, error: error.message });
        }
      }

      if (url.pathname === '/api/business/analyze' && req.method === 'POST') {
        const body = await readBody(req, { maxBytes: 96 * 1024 * 1024 });
        const result = await analyzeBusinessInput(body, { rootDir });
        appendAudit(rootDir, 'business.analyze', {
          fileCount: Array.isArray(body.files) ? body.files.length : 0,
          priceSheet: Boolean(body.priceSheetUrl),
          priceFile: Boolean(body.priceFile),
          revenue: result.kpis?.revenue || 0,
          netProfitEstimate: result.kpis?.netProfitEstimate || 0
        });
        return sendJson(res, 200, result);
      }

      if (url.pathname === '/api/business/shop-overview' && req.method === 'GET') {
        const shopId = url.searchParams.get('shopId') || '';
        const sellerId = url.searchParams.get('sellerId') || '';
        const library = getShopLibrary(rootDir);
        const shopById = new Map((library.shops || []).map(shop => [shop.id, shop]));
        const overviews = buildAllShopOverviewsFromCrawler(rootDir, {}, { shopId, sellerId })
          .map(overview => {
            const shop = shopById.get(overview.shopId) || shopById.get(shopId) || null;
            return {
              ...overview,
              shopName: shop?.name || overview.shopId || shopId || '',
              profileId: shop?.id || overview.shopId || shopId || '',
              adsAccountId: shop?.adsAccountId || '',
              loginNote: shop?.loginNote || '',
              sourceStatus: overview.ok ? 'cached-crawler' : 'missing-crawler'
            };
          });
        return sendJson(res, 200, {
          ok: true,
          generatedAt: new Date().toISOString(),
          selectedShopId: shopId,
          overviews
        });
      }

      if (url.pathname === '/api/tiktokshop-crawler/db' && req.method === 'GET') {
        const shopId = url.searchParams.get('shopId') || 'little-apricot-hawaii-fashion';
        const sellerCenter = loadSellerCenterLatest(rootDir, shopId);
        const activeJob = crawlerJobs.get(shopId);
        if (sellerCenter?.status === 'running' && activeJob?.status !== 'running') {
          sellerCenter.status = 'incomplete';
          sellerCenter.ok = false;
          sellerCenter.unresolved ||= [];
          sellerCenter.unresolved.push({
            module: 'Seller Center',
            reason: 'Job dang chay truoc do da bi dung hoac mat ket noi browser/CDP.'
          });
        }
        return sendJson(res, 200, {
          ok: true,
          database: loadCompassDatabase(rootDir, shopId),
          sellerCenter
        });
      }

      if (url.pathname === '/api/tiktokshop-crawler/crawl' && req.method === 'POST') {
        const body = await readBody(req, { maxBytes: 256 * 1024 });
        const mode = body.mode || 'compass';
        if (mode === 'seller-center') {
          const prepared = await prepareCrawlerBrowser(body, mode);
          const { shopId, sellerId, cdpPort, targetUrl, launch } = prepared;
          const existing = crawlerJobs.get(shopId);
          if (existing?.status === 'running' && !body.force) {
            return sendJson(res, 202, { ok: true, accepted: true, status: 'running', job: existing });
          }
          const job = {
            id: new Date().toISOString().replace(/[:.]/g, '-'),
            mode,
            status: 'running',
            shopId,
            sellerId,
            cdpPort,
            autoOpenProfile: Boolean(launch),
            profileName: launch?.profileName || '',
            startedAt: new Date().toISOString()
          };
          crawlerJobs.set(shopId, job);
          crawlSellerCenterDeep({
            rootDir,
            cdpPort,
            shopId,
            sellerId,
            baseUrl: targetUrl,
            configPath: body.configPath || undefined,
            dateRange: body.dateRange || 'yesterday',
            maxModules: Number(body.maxModules || 0),
            dryRun: Boolean(body.dryRun),
            clickAllControls: Boolean(body.clickAllControls),
            maxSafeControls: Number(body.maxSafeControls || 28)
          })
            .then(result => {
              crawlerJobs.set(shopId, { ...job, status: 'done', finishedAt: new Date().toISOString(), runId: result.runId, summary: result.summary });
              appendAudit(rootDir, 'tiktokshop_crawler.crawl_done', { mode, shopId, runId: result.runId, summary: result.summary });
            })
            .catch(error => {
              crawlerJobs.set(shopId, { ...job, status: 'error', finishedAt: new Date().toISOString(), error: error.message });
              appendAudit(rootDir, 'tiktokshop_crawler.crawl_error', { mode, shopId, error: error.message });
            });
          appendAudit(rootDir, 'tiktokshop_crawler.crawl_start', {
            mode,
            shopId,
            sellerId,
            jobId: job.id,
            cdpPort,
            profileName: launch?.profileName || '',
            cookiesApplied: launch?.cookiesApplied || 0,
            autoOpenProfile: Boolean(launch)
          });
          return sendJson(res, 202, {
            ok: true,
            accepted: true,
            status: 'running',
            job,
            launch: launch ? {
              profileName: launch.profileName,
              debugPort: launch.debugPort,
              cookiesApplied: launch.cookiesApplied,
              extensionId: launch.extensionId
            } : null
          });
        }
        const prepared = await prepareCrawlerBrowser(body, mode);
        const { shopId, sellerId, cdpPort, launch } = prepared;
        const result = await crawlCompassMonths({
          rootDir,
          cdpPort,
          shopId,
          sellerId,
          months: Array.isArray(body.months)
            ? body.months
            : String(body.months || '').split(',').map(item => item.trim()).filter(Boolean)
        });
        appendAudit(rootDir, 'tiktokshop_crawler.crawl', {
          mode,
          shopId,
          sellerId,
          months: result.results?.map(item => item.month) || [],
          runId: result.runId || '',
          cdpPort,
          profileName: launch?.profileName || '',
          cookiesApplied: launch?.cookiesApplied || 0,
          autoOpenProfile: Boolean(launch)
        });
        return sendJson(res, 200, {
          ...result,
          launch: launch ? {
            profileName: launch.profileName,
            debugPort: launch.debugPort,
            cookiesApplied: launch.cookiesApplied,
            extensionId: launch.extensionId
          } : null
        });
      }

      if (url.pathname === '/api/business/rules' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, rules: getBusinessCalculationRules(rootDir) });
      }

      if (url.pathname === '/api/business/rules' && req.method === 'POST') {
        const body = await readBody(req);
        const rules = saveBusinessCalculationRules(rootDir, body.rules || body);
        appendAudit(rootDir, 'business.rules.update', {
          revenueMode: rules.revenueMode,
          adsCreditRatioPct: rules.adsCreditRatioPct,
          marketplaceFeePct: rules.marketplaceFeePct,
          paymentFeePct: rules.paymentFeePct,
          operationFeePct: rules.operationFeePct,
          fixedCost: rules.fixedCost
        });
        return sendJson(res, 200, { ok: true, rules });
      }

      if (url.pathname === '/api/security-scan' && req.method === 'POST') {
        const result = await runNodeScript('security-scan.mjs');
        return sendJson(res, result.code === 0 ? 200 : 500, { ok: result.code === 0, result });
      }

      if (url.pathname === '/api/parity-audit' && req.method === 'POST') {
        const result = await runNodeScript('parity-audit.mjs');
        return sendJson(res, result.code === 0 ? 200 : 500, { ok: result.code === 0, result });
      }

      if (url.pathname.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'API not found' });
      }

      serveStatic(req, res);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
  });
}

export function startServer({ port = Number(process.env.PORT || 48731), host = '127.0.0.1' } = {}) {
  const server = createServer({ port });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const actualPort = server.address().port;
      resolve({ server, port: actualPort, host, url: `http://${host}:${actualPort}` });
    });
  });
}
