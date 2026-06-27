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
import { crawlCompassMonths, crawlSellerCenterDeep, createSellerCenterRunId, loadCompassDatabase, loadSellerCenterLatest, safeTikTokShopPageStateFromTabs, writeSellerCenterRunStatusMarker } from './tiktokshop-crawler.mjs';
import { buildCrawlerStatusContract, normalizeCrawlerFailureReason } from './crawler-contract.mjs';
import { downloadTikTokVideo } from './video-download.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const privateDir = path.join(rootDir, 'data', 'private');
const logDir = path.join(rootDir, 'data', 'logs');
const sessions = new Map();
const crawlerJobs = new Map();
const crawlerProfileSessions = new Map();
const requireLogin = process.env.STTS_REQUIRE_LOGIN === '1';
const enforceLicense = process.env.STTS_LICENSE_ENFORCE !== '0';
const CDP_RECOVERY_STEPS = Object.freeze([
  'Close stale browser windows opened by the app.',
  'Restart app if needed.',
  'Open/Attach seller profile again.',
  'Retry.'
]);
const CDP_RECOVERY_NEXT_ACTION = 'Close stale browser windows opened by the app, restart app if needed, Open/Attach seller profile again, then retry.';
const TARGET_CAPTURE_LOGIN_ACTION = 'Login in the opened profile, then click Refresh/Verify session.';
const TARGET_CAPTURE_PROFILE_ACTION = 'Open/Attach seller profile, login if needed, then click Refresh/Verify session.';
const NO_PROGRESS_NEXT_ACTION = 'No progress was detected. Close stale browser windows if needed, Open/Attach seller profile again, verify session, then retry.';
const SELLER_CENTER_NO_PROGRESS_TIMEOUT_MS = Number(process.env.STTS_CRAWLER_NO_PROGRESS_TIMEOUT_MS || 8 * 60 * 1000);

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

function crawlerContext(body = {}, mode = 'seller-center') {
  const shopId = String(body.shopId || body.sellerId || 'little-apricot-hawaii-fashion');
  const storedShop = getShop(rootDir, shopId);
  const shop = {
    ...(storedShop || {}),
    ...(body.shop || {})
  };
  const sellerId = String(body.sellerId || shop.sellerId || shop.oec_seller_id || '7494478078863902049');
  const shopKey = String(body.shopKey || shop.local_key || shop.canonical_shop_id || sellerId || shopId);
  const profileName = runtimeShopProfileName(shop, shopKey);
  const targetUrl = assertRuntimeUrlAllowed(body.baseUrl || crawlerDefaultUrl(mode, shop));
  return { shopId, storedShop, shop, sellerId, shopKey, profileName, targetUrl };
}

function safeActiveJob(job = null) {
  if (!job) return null;
  return {
    id: job.id || '',
    runId: job.runId || '',
    mode: job.mode || '',
    target: job.target || '',
    status: job.status || '',
    shopId: job.shopId || '',
    sellerId: job.sellerId || '',
    profileName: job.profileName || '',
    startedAt: job.startedAt || '',
    updatedAt: job.updatedAt || '',
    finishedAt: job.finishedAt || '',
    failureReason: job.failureReason || '',
    retryable: Boolean(job.retryable)
  };
}

function zeroTargetInventory(reason = 'cdp_unavailable_before_artifact') {
  return {
    classification: 'TARGET_CAPTURE_FAILED',
    reason,
    counts: {
      endpoint: 0,
      raw: 0,
      normalized: 0,
      export: 0
    }
  };
}

function zeroCrawlerSummary() {
  return { apiEndpoints: 0, rawFiles: 0, normalizedRows: 0, exportRequests: 0 };
}

function sellerCenterShopDir(shopId = '') {
  return path.join(rootDir, 'data', 'tiktokshop-crawler', 'shops', String(shopId || 'unknown-shop'));
}

function countFilesUnder(dir = '') {
  if (!dir || !fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(item => item.isFile())
    .length;
}

function sellerCenterRunDirInfo(shopId = '', runId = '') {
  const runDir = shopId && runId
    ? path.join(sellerCenterShopDir(shopId), 'seller-center', String(runId))
    : '';
  const exists = Boolean(runDir && fs.existsSync(runDir) && fs.statSync(runDir).isDirectory());
  const rawDir = exists ? path.join(runDir, 'raw') : '';
  const normalizedDir = exists ? path.join(runDir, 'normalized') : '';
  const files = exists ? countFilesUnder(runDir) : 0;
  const rawFiles = exists ? countFilesUnder(rawDir) : 0;
  const normalizedRows = exists
    ? (() => {
        const recordsFile = path.join(normalizedDir, 'records.json');
        if (!fs.existsSync(recordsFile)) return 0;
        try {
          const parsed = JSON.parse(fs.readFileSync(recordsFile, 'utf8'));
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      })()
    : 0;
  const apiLogFile = exists ? path.join(runDir, 'logs', 'api-log.json') : '';
  const apiEndpoints = apiLogFile && fs.existsSync(apiLogFile)
    ? (() => {
        try {
          const parsed = JSON.parse(fs.readFileSync(apiLogFile, 'utf8'));
          return Array.isArray(parsed) ? new Set(parsed.map(item => item?.url).filter(Boolean)).size : 0;
        } catch {
          return 0;
        }
      })()
    : 0;
  const exportFile = exists ? path.join(rawDir, 'export-requests.json') : '';
  const exportRequests = exportFile && fs.existsSync(exportFile)
    ? (() => {
        try {
          const parsed = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      })()
    : 0;
  return {
    runDir,
    outputDir: runId ? path.join('seller-center', String(runId)) : '',
    exists,
    files,
    artifactExists: Boolean(exists && (fs.existsSync(path.join(runDir, 'crawl_report.json')) || fs.existsSync(path.join(runDir, 'snapshot-contract.json')))),
    summary: { apiEndpoints, rawFiles, normalizedRows, exportRequests },
    updatedAt: exists ? new Date(fs.statSync(runDir).mtimeMs).toISOString() : ''
  };
}

function sellerCenterRunArtifactExists(shopId = '', runId = '') {
  return sellerCenterRunDirInfo(shopId, runId).artifactExists;
}

function withSellerCenterOutputDirState(sellerCenter = {}, shopId = '') {
  if (!sellerCenter || !sellerCenter.runId) return sellerCenter;
  const info = sellerCenterRunDirInfo(shopId || sellerCenter.shopId || '', sellerCenter.runId);
  return {
    ...sellerCenter,
    outputDir: sellerCenter.outputDir || info.outputDir,
    outputDirMissing: !info.exists
  };
}

function writePartialSellerCenterLatest({ shopId, sellerId, job, outputDirMissing = false, targetInventory = null, failureReason = 'cdp_unavailable', partialReason = 'cdp_unavailable', reasonText = 'CDP became unavailable before target capture could finish.' } = {}) {
  const shopDir = sellerCenterShopDir(shopId);
  fs.mkdirSync(shopDir, { recursive: true, mode: 0o700 });
  const now = new Date().toISOString();
  const runId = job?.runId || job?.id || '';
  const latest = {
    ok: false,
    mode: job?.mode || 'seller-center',
    target: job?.target || undefined,
    status: 'incomplete',
    runId,
    shopId,
    sellerId,
    outputDir: job?.outputDir || (runId ? path.join('seller-center', runId) : ''),
    outputDirMissing: Boolean(outputDirMissing),
    startedAt: job?.startedAt || '',
    updatedAt: now,
    finishedAt: job?.finishedAt || now,
    failureReason,
    partialReason,
    retryable: true,
    summary: job?.summary || zeroCrawlerSummary(),
    targetInventory: targetInventory || zeroTargetInventory(),
    modules: [],
    unresolved: [{
      module: 'Seller Center',
      failureReason,
      reason: reasonText
    }]
  };
  fs.writeFileSync(path.join(shopDir, 'seller-center-latest.json'), JSON.stringify(latest, null, 2), { mode: 0o600 });
  return latest;
}

export function finalizeCdpUnavailableJobForStatus({
  job = null,
  shopId = '',
  sellerId = '',
  artifactExists = false,
  finishedAt = ''
} = {}) {
  if (!job || job.status !== 'running') return null;
  const outputDirMissing = !artifactExists;
  const targetInventory = outputDirMissing
    ? zeroTargetInventory('cdp_unavailable_before_artifact')
    : zeroTargetInventory('cdp_unavailable_during_capture');
  return {
    ...job,
    status: 'partial',
    readiness: 'partial',
    shopId: job.shopId || shopId,
    sellerId: job.sellerId || sellerId,
    finishedAt: finishedAt || new Date().toISOString(),
    failureReason: 'cdp_unavailable',
    partialReason: 'cdp_unavailable',
    retryable: true,
    activeJob: false,
    outputDirMissing,
    targetInventory,
    summary: job.summary || zeroCrawlerSummary()
  };
}

function latestProgressTimestamp({ job = null, sellerCenter = null, runInfo = null } = {}) {
  const candidates = [
    job?.progressUpdatedAt,
    job?.updatedAt,
    sellerCenter?.updatedAt,
    sellerCenter?.finishedAt,
    sellerCenter?.startedAt,
    runInfo?.updatedAt,
    job?.startedAt
  ];
  return candidates.find(Boolean) || '';
}

function noProgressJobTimedOut({
  job = null,
  sellerCenter = null,
  runInfo = null,
  nowMs = Date.now(),
  timeoutMs = SELLER_CENTER_NO_PROGRESS_TIMEOUT_MS
} = {}) {
  if (!job || job.status !== 'running') return false;
  if (job.mode && job.mode !== 'seller-center') return false;
  if (job.target && job.target !== 'overview') return false;
  const startedMs = Date.parse(job.startedAt || '');
  if (!Number.isFinite(startedMs)) return false;
  if (Number(nowMs) - startedMs <= Number(timeoutMs || SELLER_CENTER_NO_PROGRESS_TIMEOUT_MS)) return false;
  const latestMs = Date.parse(latestProgressTimestamp({ job, sellerCenter, runInfo }));
  const latestIsFresh = Number.isFinite(latestMs) && latestMs > startedMs;
  const noRunDir = !runInfo?.exists;
  const noArtifactFiles = !Number(runInfo?.files || 0);
  const noLatestProgress = !latestIsFresh;
  return Boolean(noRunDir || noArtifactFiles || noLatestProgress);
}

export function finalizeNoProgressJobForStatus({
  job = null,
  shopId = '',
  sellerId = '',
  outputDirMissing = false,
  summary = null,
  finishedAt = ''
} = {}) {
  if (!job || job.status !== 'running') return null;
  const finalSummary = summary || zeroCrawlerSummary();
  return {
    ...job,
    mode: job.mode || 'seller-center',
    target: job.target || 'overview',
    status: 'partial',
    readiness: 'partial',
    shopId: job.shopId || shopId,
    sellerId: job.sellerId || sellerId,
    updatedAt: finishedAt || new Date().toISOString(),
    finishedAt: finishedAt || new Date().toISOString(),
    failureReason: 'no_progress_timeout',
    partialReason: 'no_progress_timeout',
    retryable: true,
    activeJob: false,
    outputDir: job.outputDir || (job.runId ? path.join('seller-center', job.runId) : ''),
    outputDirMissing: Boolean(outputDirMissing),
    targetInventory: zeroTargetInventory('no_progress_before_artifact'),
    summary: finalSummary
  };
}

function finalizeActiveJobOnCdpDrop({ shopId, sellerId = '', job = null } = {}) {
  if (!job || job.status !== 'running') return { finalized: false, job };
  const runId = job.runId || job.id || '';
  const artifactExists = sellerCenterRunArtifactExists(shopId, runId);
  const finalJob = finalizeCdpUnavailableJobForStatus({ job, shopId, sellerId, artifactExists });
  if (!finalJob) return { finalized: false, job };
  crawlerJobs.set(shopId, finalJob);
  if (finalJob.outputDirMissing) {
    writePartialSellerCenterLatest({
      shopId,
      sellerId: finalJob.sellerId || sellerId,
      job: finalJob,
      outputDirMissing: true,
      targetInventory: finalJob.targetInventory
    });
  }
  appendAudit(rootDir, 'tiktokshop_crawler.cdp_drop_finalized', {
    mode: finalJob.mode || 'seller-center',
    shopId,
    sellerId: finalJob.sellerId || sellerId,
    jobId: finalJob.id || '',
    runId: finalJob.runId || '',
    failureReason: 'cdp_unavailable',
    retryable: true,
    outputDirMissing: Boolean(finalJob.outputDirMissing),
    targetInventory: finalJob.targetInventory
  });
  return { finalized: true, job: finalJob };
}

function finalizeActiveJobOnNoProgress({ shopId, sellerId = '', job = null, sellerCenter = null, nowMs = Date.now(), timeoutMs = SELLER_CENTER_NO_PROGRESS_TIMEOUT_MS } = {}) {
  if (!job || job.status !== 'running') return { finalized: false, job };
  const runInfo = sellerCenterRunDirInfo(shopId, job.runId || job.id || '');
  if (!noProgressJobTimedOut({ job, sellerCenter, runInfo, nowMs, timeoutMs })) return { finalized: false, job };
  const finalJob = finalizeNoProgressJobForStatus({
    job,
    shopId,
    sellerId,
    outputDirMissing: !runInfo.exists,
    summary: runInfo.exists && runInfo.files ? runInfo.summary : zeroCrawlerSummary()
  });
  if (!finalJob) return { finalized: false, job };
  crawlerJobs.set(shopId, finalJob);
  writePartialSellerCenterLatest({
    shopId,
    sellerId: finalJob.sellerId || sellerId,
    job: finalJob,
    outputDirMissing: !runInfo.exists,
    targetInventory: finalJob.targetInventory,
    failureReason: 'no_progress_timeout',
    partialReason: 'no_progress_timeout',
    reasonText: 'No progress was detected before Seller Center target capture produced artifacts.'
  });
  appendAudit(rootDir, 'tiktokshop_crawler.no_progress_finalized', {
    mode: finalJob.mode || 'seller-center',
    target: finalJob.target || 'overview',
    shopId,
    sellerId: finalJob.sellerId || sellerId,
    jobId: finalJob.id || '',
    runId: finalJob.runId || '',
    failureReason: 'no_progress_timeout',
    retryable: true,
    outputDirMissing: Boolean(finalJob.outputDirMissing),
    targetInventory: finalJob.targetInventory
  });
  return { finalized: true, job: finalJob };
}

async function inspectCdpPageState(cdpPort, { targetUrl = '', activeJob = false } = {}) {
  const port = Number(cdpPort || 0);
  if (!port) {
    return {
      cdpStatus: safeCdpStatus({
        reachable: null,
        reason: 'cdp_not_checked',
        retryable: false,
        activeJob
      }),
      currentPageKind: 'unknown',
      sessionReady: null
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: controller.signal });
    if (!response.ok) throw new Error('cdp_unavailable');
    const tabs = await response.json();
    const pageState = safeTikTokShopPageStateFromTabs(tabs, targetUrl);
    const sessionReady = pageState.currentPageKind === 'seller_center';
    return {
      cdpStatus: safeCdpStatus({
        reachable: pageState.hasUsablePage,
        reason: pageState.hasUsablePage ? 'cdp_reachable' : 'cdp_unavailable',
        retryable: !pageState.hasUsablePage,
        recoverySteps: pageState.hasUsablePage ? [] : [...CDP_RECOVERY_STEPS],
        nextAction: pageState.hasUsablePage ? '' : TARGET_CAPTURE_PROFILE_ACTION,
        activeJob
      }),
      currentPageKind: pageState.currentPageKind,
      sessionReady,
      pageCount: pageState.pageCount
    };
  } catch {
    return {
      cdpStatus: safeCdpStatus({
        reachable: false,
        reason: 'cdp_unavailable',
        retryable: true,
        nextAction: TARGET_CAPTURE_PROFILE_ACTION,
        activeJob
      }),
      currentPageKind: 'unknown',
      sessionReady: false
    };
  } finally {
    clearTimeout(timer);
  }
}

function targetCaptureBlockedResponse({
  shopId,
  shop = {},
  database = {},
  sellerCenter = {},
  activeJob = null,
  cdpStatus = null,
  currentPageKind = 'unknown',
  sessionReady = null,
  failureReason = 'cookie_missing',
  nextAction = TARGET_CAPTURE_PROFILE_ACTION,
  mode = 'seller-center',
  profileName = ''
} = {}) {
  const job = activeJob ? safeActiveJob(activeJob) : null;
  const normalizedReason = normalizeCrawlerFailureReason(failureReason);
  const statusJob = job
    ? { ...job, status: 'running', failureReason: normalizedReason, retryable: true }
    : { mode, status: 'error', shopId, profileName, failureReason: normalizedReason, retryable: true };
  const crawlerStatus = buildServerCrawlerStatus({
    shop,
    shopId,
    database,
    sellerCenter,
    job: statusJob,
    mode,
    cdpStatus: cdpStatus ? safeCdpStatus({ ...cdpStatus, activeJob: Boolean(job) }) : null,
    activeJob: Boolean(job),
    staleRun: Boolean(sellerCenter?.staleRun)
  });
  return {
    ok: false,
    accepted: false,
    status: job ? 'running' : 'blocked',
    sessionReady,
    currentPageKind,
    selectedShop: crawlerSafeShop(shop, shopId),
    profileName: profileName || statusJob.profileName || crawlerStatus.profileName || '',
    cdpStatus: crawlerStatus.cdpStatus,
    activeJob: job,
    failureReason: normalizedReason,
    retryable: true,
    nextAction,
    crawlerStatus: {
      ...crawlerStatus,
      failureReason: normalizedReason,
      retryable: true,
      nextAction,
      currentPageKind,
      sessionReady
    }
  };
}

function crawlerSafeShop(shop = {}, fallbackId = '') {
  return {
    id: shop.id || fallbackId || '',
    name: shop.name || shop.shopRealName || shop.id || fallbackId || '',
    sellerId: shop.sellerId || shop.oec_seller_id || '',
    adsAccountId: shop.adsAccountId || shop.aadvid || ''
  };
}

function crawlerMissingMetrics(database = {}, sellerCenter = {}) {
  const missing = [];
  if (!Object.keys(database.months || {}).length) missing.push('compass_months');
  const latestMonth = Object.keys(database.months || {}).sort().at(-1);
  const latest = latestMonth ? database.months?.[latestMonth] : null;
  if (latest && !latest.aggregate) missing.push('compass_aggregate');
  if (latest && !Array.isArray(latest.daily)) missing.push('compass_daily');
  if (!sellerCenter.runId) missing.push('seller_center_latest_run');
  return missing;
}

function crawlerLatestRun({ database = {}, sellerCenter = {}, job = null, mode = '' } = {}) {
  if (job) {
    return {
      runId: job.runId || job.id || '',
      status: job.status,
      mode: job.mode || mode,
      source: 'server-job',
      startedAt: job.startedAt || '',
      finishedAt: job.finishedAt || '',
      updatedAt: job.finishedAt || job.startedAt || '',
      summary: job.summary || {}
    };
  }
  if (sellerCenter?.runId) {
    return {
      runId: sellerCenter.runId,
      status: sellerCenter.status || (sellerCenter.ok ? 'done' : 'incomplete'),
      mode: 'seller-center',
      source: 'seller-center-latest',
      startedAt: sellerCenter.startedAt || '',
      finishedAt: sellerCenter.finishedAt || '',
      updatedAt: sellerCenter.finishedAt || sellerCenter.startedAt || '',
      summary: sellerCenter.summary || {}
    };
  }
  return {
    runId: database.runId || '',
    status: Object.keys(database.months || {}).length ? 'done' : 'ready',
    mode: 'compass',
    source: 'compass-database',
    startedAt: '',
    finishedAt: database.updatedAt || '',
    updatedAt: database.updatedAt || '',
    summary: { months: Object.keys(database.months || {}).length }
  };
}

function safeCdpStatus({
  reachable = null,
  checkedAt = '',
  reason = '',
  retryable,
  recoverySteps,
  nextAction = '',
  activeJob = false,
  staleRun = false
} = {}) {
  const cdpProblem = reason === 'cdp_unavailable' || reachable === false;
  return {
    reachable,
    checkedAt: checkedAt || new Date().toISOString(),
    reason: reason || (reachable === true ? 'cdp_reachable' : 'cdp_not_checked'),
    retryable: retryable === undefined ? cdpProblem : Boolean(retryable),
    recoverySteps: recoverySteps || (cdpProblem ? [...CDP_RECOVERY_STEPS] : []),
    nextAction: nextAction || (cdpProblem ? CDP_RECOVERY_NEXT_ACTION : ''),
    activeJob: Boolean(activeJob),
    staleRun: Boolean(staleRun)
  };
}

async function probeCdpStatus(cdpPort, { requirePage = true } = {}) {
  const port = Number(cdpPort || 0);
  if (!port) {
    return safeCdpStatus({ reachable: null, reason: 'cdp_not_checked', retryable: false });
  }

  let latest = safeCdpStatus({ reachable: false, reason: 'cdp_unavailable', retryable: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: controller.signal });
      if (!response.ok) {
        latest = safeCdpStatus({ reachable: false, reason: 'cdp_unavailable', retryable: true });
      } else {
        const tabs = await response.json();
        const pageCount = Array.isArray(tabs)
          ? tabs.filter(tab => tab?.type === 'page' && tab.webSocketDebuggerUrl).length
          : 0;
        if (!requirePage || pageCount) {
          return safeCdpStatus({
            reachable: true,
            reason: 'cdp_reachable',
            retryable: false,
            recoverySteps: [],
            nextAction: ''
          });
        }
        latest = safeCdpStatus({ reachable: false, reason: 'cdp_unavailable', retryable: true });
      }
    } catch {
      latest = safeCdpStatus({ reachable: false, reason: 'cdp_unavailable', retryable: true });
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 450));
  }
  return latest;
}

function buildCdpUnavailableResponse({ shopId, shop, database, sellerCenter, job, mode, launch, cdpStatus }) {
  const crawlerStatus = buildServerCrawlerStatus({
    shop,
    shopId,
    database,
    sellerCenter,
    job,
    mode,
    launch,
    error: 'cdp_unavailable',
    cdpStatus,
    activeJob: false,
    staleRun: Boolean(sellerCenter?.staleRun)
  });
  return {
    ok: false,
    accepted: false,
    status: 'failed',
    failureReason: 'cdp_unavailable',
    retryable: true,
    cdpStatus,
    crawlerStatus,
    recoverySteps: cdpStatus.recoverySteps || [...CDP_RECOVERY_STEPS],
    nextAction: cdpStatus.nextAction || CDP_RECOVERY_NEXT_ACTION,
    launch: launch ? {
      profileName: launch.profileName,
      debugPort: launch.debugPort,
      cookiesApplied: launch.cookiesApplied,
      extensionId: launch.extensionId
    } : null
  };
}

function cdpStatusFromCrawlerStatus(crawlerStatus = {}, { activeJob = false, staleRun = false } = {}) {
  const failureReason = crawlerStatus?.failureReason || '';
  const partialReason = String(crawlerStatus?.partialReason || '');
  if (failureReason === 'no_progress_timeout' || partialReason === 'no_progress_timeout') {
    return safeCdpStatus({
      reachable: crawlerStatus?.cdpStatus?.reachable ?? null,
      reason: 'no_progress_timeout',
      retryable: true,
      recoverySteps: [],
      nextAction: NO_PROGRESS_NEXT_ACTION,
      activeJob,
      staleRun
    });
  }
  const hasCdpProblem = failureReason === 'cdp_unavailable' || /browser\/CDP|cdp|debug/i.test(partialReason);
  return safeCdpStatus({
    reachable: hasCdpProblem ? false : null,
    reason: hasCdpProblem ? 'cdp_unavailable' : 'cdp_not_checked',
    retryable: hasCdpProblem ? true : Boolean(crawlerStatus?.retryable),
    recoverySteps: hasCdpProblem ? [...CDP_RECOVERY_STEPS] : [],
    nextAction: hasCdpProblem ? CDP_RECOVERY_NEXT_ACTION : '',
    activeJob,
    staleRun
  });
}

function buildServerCrawlerStatus({
  shop = {},
  shopId = '',
  database = {},
  sellerCenter = {},
  job = null,
  mode = '',
  launch = null,
  error = '',
  cdpStatus = null,
  activeJob = false,
  staleRun = false
} = {}) {
  const cookieCount = Number(shop.cookieCount || launch?.cookiesApplied || 0);
  const cookieStorageStatus = shop.cookieStorage || (cookieCount ? 'encrypted' : 'none');
  const unresolved = Array.isArray(sellerCenter?.unresolved) ? sellerCenter.unresolved : [];
  const firstUnresolved = job?.partialReason || sellerCenter?.partialReason || unresolved[0]?.failureReason || unresolved[0]?.reason || '';
  const rawFailure = error || job?.failureReason || job?.error || sellerCenter?.failureReason || firstUnresolved || '';
  const failureReason = rawFailure ? normalizeCrawlerFailureReason(rawFailure) : '';
  let status = 'ready';
  if (job?.status === 'running' || ['running', 'crawling'].includes(sellerCenter?.status)) status = 'crawling';
  else if (job?.status === 'partial' || sellerCenter?.status === 'incomplete') status = 'partial';
  else if (!shop?.id) status = 'need-login';
  else if (!cookieCount || cookieStorageStatus === 'none') status = 'need-login';
  else if (job?.status === 'error' || error || sellerCenter?.status === 'error') status = 'failed';
  else if (unresolved.length) status = 'partial';
  else if (sellerCenter?.runId || Object.keys(database.months || {}).length) status = 'completed';

  if (failureReason === 'cookie_expired') status = 'cookie-expired';
  if (failureReason === 'not_logged_in' || failureReason === 'cookie_missing') status = 'need-login';
  if (failureReason === 'no_progress_timeout') status = 'partial';
  if (failureReason && status === 'ready') status = failureReason === 'cdp_unavailable' ? 'partial' : 'failed';

  const sessionHint = status === 'need-login'
    ? (cookieCount ? 'login_check_required' : 'cookie_missing')
    : status === 'cookie-expired'
      ? 'cookie_expired'
      : status === 'crawling'
        ? 'crawl_running'
        : 'safe_metadata_only';

  const statusContract = buildCrawlerStatusContract({
    status,
    readiness: status,
    selectedShop: crawlerSafeShop(shop, shopId),
    profileName: launch?.profileName || job?.profileName || (shop.sellerId ? `shop-${shop.sellerId}` : shopId || ''),
    cookieStorageStatus,
    cookieCount,
    cookieUpdatedAt: shop.cookieUpdatedAt || '',
    sessionHint,
    latestRun: crawlerLatestRun({ database, sellerCenter, job, mode }),
    failureReason,
    partialReason: firstUnresolved,
    missingMetrics: crawlerMissingMetrics(database, sellerCenter),
    retryable: Boolean(failureReason) && !['wrong_shop_suspected', 'api_response_changed', 'selector_changed'].includes(failureReason),
    runId: job?.runId || job?.id || sellerCenter?.runId || database.runId || '',
    updatedAt: new Date().toISOString()
  });
  const resolvedCdpStatus = cdpStatus || cdpStatusFromCrawlerStatus(statusContract, { activeJob, staleRun });
  return {
    ...statusContract,
    outputDirMissing: Boolean(job?.outputDirMissing || sellerCenter?.outputDirMissing),
    targetInventory: job?.targetInventory || sellerCenter?.targetInventory || null,
    retryable: Boolean(statusContract.retryable || resolvedCdpStatus.retryable),
    activeJob: Boolean(activeJob),
    staleRun: Boolean(staleRun),
    cdpStatus: resolvedCdpStatus,
    recoverySteps: resolvedCdpStatus.recoverySteps || [],
    nextAction: failureReason === 'no_progress_timeout' ? NO_PROGRESS_NEXT_ACTION : (resolvedCdpStatus.nextAction || '')
  };
}

function sourceStatusForOverview(overview = {}) {
  if (!overview?.ok) return 'missing-crawler';
  if (overview.sourceStatus) return overview.sourceStatus;
  return 'cached-crawler';
}

function sourceStatusEffectiveSource(sourceStatus = '', crawlerStatus = {}) {
  const hasCache = sourceStatus === 'cached-crawler';
  const realtimeStatus = crawlerStatus?.status || '';
  if (hasCache) return 'cached-crawler';
  if (['partial', 'failed'].includes(realtimeStatus)) return realtimeStatus === 'partial' ? 'partial' : 'missing';
  if (realtimeStatus === 'crawling') return 'partial';
  return 'missing';
}

function dataSourceNextAction({ fallbackUsed = false, realtimeStatus = '', failureReason = '', retryable = false, hasCache = false } = {}) {
  if (failureReason === 'no_progress_timeout') return NO_PROGRESS_NEXT_ACTION;
  if (failureReason === 'cdp_unavailable') return CDP_RECOVERY_NEXT_ACTION;
  if (fallbackUsed && retryable) return 'Close stale browser/CDP sessions, reopen the selected profile, then retry Seller Center or Compass crawl.';
  if (fallbackUsed) return 'Review the latest realtime failure before retrying crawl.';
  if (['partial', 'failed'].includes(realtimeStatus) && retryable) return 'Retry the realtime crawl from TikTok Crawler after checking the selected profile.';
  if (['partial', 'failed'].includes(realtimeStatus)) return 'Review failure reason and update crawler mapping if needed.';
  if (!hasCache) return 'Run a small Compass crawl for the selected range.';
  if (failureReason) return 'Review the latest realtime attempt; cached crawler data is still being displayed.';
  return 'Use cached crawler data or run a fresh crawl when newer data is needed.';
}

function buildFreshnessGap({ overview = {}, latestRun = null, sourceStatus = '', effectiveSource = '', hasCache = false } = {}) {
  const realtimeRunId = latestRun?.runId || latestRun?.id || '';
  const realtimeStatus = latestRun?.status || '';
  const effectiveCardRunId = hasCache ? (overview?.runId || '') : '';
  const effectiveCardUpdatedAt = hasCache ? (overview?.updatedAt || overview?.lastCrawlAt || '') : '';
  const cardsUseCachedCompass = sourceStatus === 'cached-crawler' && effectiveSource === 'cached-crawler';
  const realtimeCompleted = realtimeStatus === 'completed' || realtimeStatus === 'done';
  const exists = Boolean(
    realtimeCompleted
    && cardsUseCachedCompass
    && realtimeRunId
    && effectiveCardRunId
    && realtimeRunId !== effectiveCardRunId
  );
  return {
    exists,
    reason: exists ? 'realtime_completed_but_cards_use_cached_compass' : '',
    realtimeRunId: realtimeRunId || '',
    realtimeUpdatedAt: latestRun?.updatedAt || latestRun?.finishedAt || latestRun?.startedAt || '',
    realtimeStatus: realtimeStatus || '',
    effectiveCardRunId,
    effectiveCardSource: effectiveSource || sourceStatus || '',
    effectiveCardUpdatedAt,
    severity: exists ? 'info' : '',
    nextAction: exists
      ? 'Dashboard cards still use cached Compass data. Run/implement fresh overview mapping before treating cards as realtime-fresh.'
      : ''
  };
}

function buildDataSourceStatus({ overview = {}, crawlerStatus = {}, requestedRange = '' } = {}) {
  const sourceStatus = sourceStatusForOverview(overview);
  const hasCache = sourceStatus === 'cached-crawler' && Boolean(overview?.ok);
  const realtimeStatus = crawlerStatus?.status || '';
  const latestRun = crawlerStatus?.latestRun || null;
  const realtimeAttempted = Boolean(
    realtimeStatus
    && latestRun?.runId
    && latestRun.runId !== overview?.runId
  );
  const realtimeProblem = ['partial', 'failed', 'cookie-expired', 'need-login'].includes(realtimeStatus);
  const fallbackUsed = Boolean(hasCache && realtimeAttempted && realtimeProblem);
  const fallbackReason = fallbackUsed
    ? (realtimeStatus === 'partial' ? 'realtime_partial_using_cached_crawler' : 'realtime_failed_using_cached_crawler')
    : '';
  const effectiveSource = fallbackUsed
    ? 'cached-crawler'
    : sourceStatusEffectiveSource(sourceStatus, crawlerStatus);
  const cacheUpdatedAt = overview?.updatedAt || overview?.lastCrawlAt || '';
  const latestSuccessfulRunId = hasCache ? (overview?.runId || '') : '';
  const latestSuccessfulUpdatedAt = hasCache ? cacheUpdatedAt : '';
  const retryable = Boolean(crawlerStatus?.retryable);
  const failureReason = crawlerStatus?.failureReason || '';
  const cdpStatus = crawlerStatus?.cdpStatus || cdpStatusFromCrawlerStatus(crawlerStatus);
  const cdpProblem = failureReason === 'cdp_unavailable' || cdpStatus?.reason === 'cdp_unavailable';
  const freshnessGap = buildFreshnessGap({
    overview,
    latestRun,
    sourceStatus,
    effectiveSource,
    hasCache
  });

  return {
    effectiveSource,
    requestedRange: requestedRange || '',
    effectiveRange: overview?.rangeLabel || '',
    cacheRunId: hasCache ? (overview?.runId || '') : '',
    cacheUpdatedAt: hasCache ? cacheUpdatedAt : '',
    latestAttemptedRunId: latestRun?.runId || crawlerStatus?.runId || '',
    latestAttemptedStatus: realtimeStatus || '',
    latestAttemptedMode: latestRun?.mode || '',
    latestAttemptedSource: latestRun?.source || '',
    latestAttemptedUpdatedAt: latestRun?.updatedAt || crawlerStatus?.updatedAt || '',
    latestAttemptedFailureReason: failureReason,
    latestAttemptedPartialReason: crawlerStatus?.partialReason || '',
    latestSuccessfulRunId,
    latestSuccessfulUpdatedAt,
    realtimeAttempted,
    realtimeStatus,
    fallbackUsed,
    fallbackReason,
    retryable,
    cdpStatus,
    freshnessGap,
    recoverySteps: cdpProblem ? [...CDP_RECOVERY_STEPS] : [],
    nextAction: dataSourceNextAction({ fallbackUsed, realtimeStatus, failureReason, retryable, hasCache }),
    updatedAt: new Date().toISOString()
  };
}

function markStaleCrawlerRun(sellerCenter = {}, job = null) {
  if (sellerCenter?.status === 'running' && job?.status !== 'running') {
    return {
      ...sellerCenter,
      status: 'incomplete',
      ok: false,
      failureReason: 'cdp_unavailable',
      retryable: true,
      staleRun: true,
      unresolved: [
        ...(Array.isArray(sellerCenter.unresolved) ? sellerCenter.unresolved : []),
        {
          module: 'Seller Center',
          failureReason: 'cdp_unavailable',
          reason: 'Job dang chay truoc do da bi dung hoac mat ket noi browser/CDP.'
        }
      ]
    };
  }
  return sellerCenter;
}

function enrichOverviewDataSourceStatus({ overview = {}, shop = {}, requestedRange = '' } = {}) {
  const shopId = overview.shopId || shop?.id || '';
  const database = loadCompassDatabase(rootDir, shopId);
  const job = crawlerJobs.get(shopId) || null;
  const sellerCenter = markStaleCrawlerRun(loadSellerCenterLatest(rootDir, shopId), job);
  const staleRun = Boolean(sellerCenter?.staleRun);
  const crawlerStatus = buildServerCrawlerStatus({
    shop,
    shopId,
    database,
    sellerCenter,
    job,
    activeJob: job?.status === 'running',
    staleRun
  });
  return {
    ...overview,
    dataSourceStatus: buildDataSourceStatus({
      overview,
      crawlerStatus,
      requestedRange
    })
  };
}

function enrichBusinessAnalysisDataSourceStatus(result = {}, body = {}) {
  const library = getShopLibrary(rootDir);
  const shopById = new Map((library.shops || []).map(shop => [shop.id, shop]));
  const requestedRange = body.range || body.rangeKey || body.periodLabel || '';
  const shopId = body.shopId || body.crawlerShopId || result.shopOverview?.shopId || '';
  const enrichedOverviews = (result.shopOverviews || []).map(overview => {
    const shop = shopById.get(overview.shopId) || shopById.get(shopId) || {};
    return enrichOverviewDataSourceStatus({ overview, shop, requestedRange });
  });
  return {
    ...result,
    shopOverviews: enrichedOverviews,
    shopOverview: enrichedOverviews[0] || result.shopOverview || null,
    dataSourceStatus: enrichedOverviews[0]?.dataSourceStatus || null
  };
}

async function prepareCrawlerBrowser(body = {}, mode = 'seller-center') {
  const { shopId, storedShop, shop, sellerId, shopKey, profileName, targetUrl } = crawlerContext(body, mode);
  const requestedPort = Number(body.cdpPort || 0);
  const autoOpenProfile = body.autoOpenProfile === true || body.autoOpenProfile === 'true' || !requestedPort;
  if (!autoOpenProfile) {
    return { shopId, sellerId, cdpPort: requestedPort, targetUrl, launch: null };
  }

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
  crawlerProfileSessions.set(shopId, {
    shopId,
    sellerId,
    profileName: launch.profileName || profileName,
    cdpPort: launch.debugPort,
    targetUrl,
    openedAt: new Date().toISOString(),
    verifiedAt: '',
    sessionReady: null,
    currentPageKind: 'unknown'
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
        const result = enrichBusinessAnalysisDataSourceStatus(
          await analyzeBusinessInput(body, { rootDir }),
          body
        );
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
        const requestedRange = url.searchParams.get('range') || url.searchParams.get('rangeKey') || '';
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
          })
          .map(overview => enrichOverviewDataSourceStatus({
            overview,
            shop: shopById.get(overview.shopId) || shopById.get(shopId) || {},
            requestedRange
          }));
        return sendJson(res, 200, {
          ok: true,
          generatedAt: new Date().toISOString(),
          selectedShopId: shopId,
          overviews
        });
      }

      if (url.pathname === '/api/tiktokshop-crawler/db' && req.method === 'GET') {
        const shopId = url.searchParams.get('shopId') || 'little-apricot-hawaii-fashion';
        const shop = getShop(rootDir, shopId) || {};
        const database = loadCompassDatabase(rootDir, shopId);
        let activeJob = crawlerJobs.get(shopId);
        let sellerCenter = markStaleCrawlerRun(withSellerCenterOutputDirState(loadSellerCenterLatest(rootDir, shopId), shopId), activeJob);
        let activeJobRunning = activeJob?.status === 'running';
        let staleRun = Boolean(sellerCenter?.staleRun);
        let liveCdpStatus = activeJobRunning && activeJob?.cdpPort
          ? safeCdpStatus({ ...(await probeCdpStatus(activeJob.cdpPort, { requirePage: false })), activeJob: true, staleRun })
          : null;
        if (activeJobRunning && liveCdpStatus?.reason === 'cdp_unavailable') {
          const finalized = finalizeActiveJobOnCdpDrop({ shopId, sellerId: activeJob?.sellerId || shop.sellerId || '', job: activeJob });
          if (finalized.finalized) {
            activeJob = finalized.job;
            sellerCenter = markStaleCrawlerRun(withSellerCenterOutputDirState(loadSellerCenterLatest(rootDir, shopId), shopId), activeJob);
            activeJobRunning = false;
            staleRun = Boolean(sellerCenter?.staleRun);
            liveCdpStatus = safeCdpStatus({ ...liveCdpStatus, activeJob: false, staleRun });
          }
        }
        if (activeJobRunning && (!liveCdpStatus || liveCdpStatus.reachable === true || liveCdpStatus.reachable === null)) {
          const finalized = finalizeActiveJobOnNoProgress({
            shopId,
            sellerId: activeJob?.sellerId || shop.sellerId || '',
            job: activeJob,
            sellerCenter
          });
          if (finalized.finalized) {
            activeJob = finalized.job;
            sellerCenter = markStaleCrawlerRun(withSellerCenterOutputDirState(loadSellerCenterLatest(rootDir, shopId), shopId), activeJob);
            activeJobRunning = false;
            staleRun = Boolean(sellerCenter?.staleRun);
            liveCdpStatus = safeCdpStatus({
              ...(liveCdpStatus || {}),
              reachable: liveCdpStatus?.reachable ?? null,
              reason: 'no_progress_timeout',
              retryable: true,
              nextAction: NO_PROGRESS_NEXT_ACTION,
              activeJob: false,
              staleRun
            });
          }
        }
        const crawlerStatus = buildServerCrawlerStatus({
          shop,
          shopId,
          database,
          sellerCenter,
          job: activeJob || null,
          cdpStatus: liveCdpStatus,
          activeJob: activeJobRunning,
          staleRun
        });
        const cdpStatus = crawlerStatus.cdpStatus || cdpStatusFromCrawlerStatus(crawlerStatus, {
          activeJob: activeJobRunning,
          staleRun
        });
        return sendJson(res, 200, {
          ok: true,
          database,
          sellerCenter,
          cdpStatus,
          crawlerStatus: { ...crawlerStatus, cdpStatus }
        });
      }

      if (url.pathname === '/api/tiktokshop-crawler/profile/open' && req.method === 'POST') {
        const body = await readBody(req, { maxBytes: 256 * 1024 });
        const mode = body.mode || 'seller-center';
        const context = crawlerContext(body, mode);
        const existing = crawlerProfileSessions.get(context.shopId);
        if (existing?.cdpPort) {
          const state = await inspectCdpPageState(existing.cdpPort, { targetUrl: existing.targetUrl || context.targetUrl });
          if (state.cdpStatus.reachable) {
            const nextSession = {
              ...existing,
              cdpStatus: state.cdpStatus,
              currentPageKind: state.currentPageKind,
              sessionReady: state.sessionReady,
              verifiedAt: state.sessionReady ? new Date().toISOString() : existing.verifiedAt
            };
            crawlerProfileSessions.set(context.shopId, nextSession);
            return sendJson(res, 200, {
              ok: true,
              attached: true,
              opened: false,
              sessionReady: state.sessionReady,
              currentPageKind: state.currentPageKind,
              selectedShop: crawlerSafeShop(context.shop, context.shopId),
              profileName: existing.profileName,
              cdpStatus: state.cdpStatus,
              activeJob: safeActiveJob(crawlerJobs.get(context.shopId)) || null,
              failureReason: state.sessionReady ? '' : (['login', 'signup'].includes(state.currentPageKind) ? 'not_logged_in' : ''),
              nextAction: state.sessionReady ? '' : TARGET_CAPTURE_LOGIN_ACTION
            });
          }
        }

        const cookies = context.storedShop?.id ? getShopCookies(rootDir, context.storedShop.id) : [];
        const launch = await launchChromeWithCookies(rootDir, {
          appUrl: context.targetUrl,
          profileName: context.profileName,
          cookies,
          shopContext: {
            shopKey: context.shopKey,
            name: context.shop.name || context.shop.shopRealName || context.shopId,
            avatar: context.shop.avatar || context.shop.shopAvatar || context.shop.shopLogo || '',
            sellerId: context.sellerId,
            adsAccountId: context.shop.adsAccountId || context.shop.aadvid || '',
            profileName: context.profileName,
            pageType: mode === 'compass' ? 'compass' : 'seller-center',
            targetUrl: context.targetUrl
          },
          appWindow: true,
          extensionPage: '',
          stopExistingProfile: false
        });
        const state = await inspectCdpPageState(launch.debugPort, { targetUrl: context.targetUrl });
        crawlerProfileSessions.set(context.shopId, {
          shopId: context.shopId,
          sellerId: context.sellerId,
          profileName: launch.profileName || context.profileName,
          cdpPort: launch.debugPort,
          targetUrl: context.targetUrl,
          openedAt: new Date().toISOString(),
          verifiedAt: state.sessionReady ? new Date().toISOString() : '',
          sessionReady: state.sessionReady,
          currentPageKind: state.currentPageKind,
          cdpStatus: state.cdpStatus
        });
        appendAudit(rootDir, 'tiktokshop_crawler.profile_open_attach', {
          mode,
          shopId: context.shopId,
          sellerId: context.sellerId,
          profileName: launch.profileName || context.profileName,
          currentPageKind: state.currentPageKind,
          sessionReady: state.sessionReady,
          cookieCount: cookies.length
        });
        return sendJson(res, 200, {
          ok: true,
          attached: false,
          opened: true,
          sessionReady: state.sessionReady,
          currentPageKind: state.currentPageKind,
          selectedShop: crawlerSafeShop(context.shop, context.shopId),
          profileName: launch.profileName || context.profileName,
          cdpStatus: state.cdpStatus,
          activeJob: safeActiveJob(crawlerJobs.get(context.shopId)) || null,
          failureReason: state.sessionReady ? '' : (['login', 'signup'].includes(state.currentPageKind) ? 'not_logged_in' : ''),
          nextAction: state.sessionReady ? '' : TARGET_CAPTURE_LOGIN_ACTION
        });
      }

      if (url.pathname === '/api/tiktokshop-crawler/profile/verify' && req.method === 'POST') {
        const body = await readBody(req, { maxBytes: 256 * 1024 });
        const mode = body.mode || 'seller-center';
        const context = crawlerContext(body, mode);
        const existing = crawlerProfileSessions.get(context.shopId);
        const cdpPort = Number(body.cdpPort || existing?.cdpPort || 0);
        const state = await inspectCdpPageState(cdpPort, { targetUrl: existing?.targetUrl || context.targetUrl });
        const failureReason = state.sessionReady
          ? ''
          : (['login', 'signup'].includes(state.currentPageKind) ? 'not_logged_in' : (state.cdpStatus.reachable === false ? 'cdp_unavailable' : 'cookie_missing'));
        crawlerProfileSessions.set(context.shopId, {
          ...(existing || {}),
          shopId: context.shopId,
          sellerId: context.sellerId,
          profileName: existing?.profileName || context.profileName,
          cdpPort,
          targetUrl: existing?.targetUrl || context.targetUrl,
          verifiedAt: new Date().toISOString(),
          sessionReady: state.sessionReady,
          currentPageKind: state.currentPageKind,
          cdpStatus: state.cdpStatus
        });
        return sendJson(res, 200, {
          ok: state.sessionReady,
          sessionReady: state.sessionReady,
          currentPageKind: state.currentPageKind,
          selectedShop: crawlerSafeShop(context.shop, context.shopId),
          profileName: existing?.profileName || context.profileName,
          cdpStatus: state.cdpStatus,
          activeJob: safeActiveJob(crawlerJobs.get(context.shopId)) || null,
          failureReason,
          retryable: !state.sessionReady,
          nextAction: state.sessionReady ? 'Target overview capture chỉ chạy sau khi session/profile đã sẵn sàng' : TARGET_CAPTURE_LOGIN_ACTION
        });
      }

      if (url.pathname === '/api/tiktokshop-crawler/crawl' && req.method === 'POST') {
        const body = await readBody(req, { maxBytes: 256 * 1024 });
        const mode = body.mode || 'compass';
        if (mode === 'seller-center') {
          const isTargetedOverviewCapture = body.targetedOverviewCapture === true || body.targetedOverviewCapture === 'true';
          const context = crawlerContext(body, mode);
          const { shopId, sellerId, targetUrl } = context;
          let existing = crawlerJobs.get(shopId);
          if (existing?.status === 'running' && !body.force) {
            const shop = getShop(rootDir, shopId) || {};
            const database = loadCompassDatabase(rootDir, shopId);
            const sellerCenter = markStaleCrawlerRun(withSellerCenterOutputDirState(loadSellerCenterLatest(rootDir, shopId), shopId), existing);
            const duplicateCdpStatus = existing?.cdpPort
              ? safeCdpStatus({ ...(await probeCdpStatus(existing.cdpPort, { requirePage: false })), activeJob: true })
              : null;
            const noProgressFinalized = isTargetedOverviewCapture && (!duplicateCdpStatus || duplicateCdpStatus.reachable === true || duplicateCdpStatus.reachable === null)
              ? finalizeActiveJobOnNoProgress({ shopId, sellerId, job: existing, sellerCenter })
              : { finalized: false, job: existing };
            if (noProgressFinalized.finalized) {
              existing = null;
            } else if (duplicateCdpStatus?.reason === 'cdp_unavailable') {
              const finalized = finalizeActiveJobOnCdpDrop({ shopId, sellerId, job: existing });
              const finalSellerCenter = markStaleCrawlerRun(withSellerCenterOutputDirState(loadSellerCenterLatest(rootDir, shopId), shopId), finalized.job);
              const finalCdpStatus = safeCdpStatus({ ...duplicateCdpStatus, activeJob: false });
              const finalCrawlerStatus = buildServerCrawlerStatus({
                shop,
                shopId,
                database,
                sellerCenter: finalSellerCenter,
                job: finalized.job,
                mode,
                cdpStatus: finalCdpStatus,
                activeJob: false,
                staleRun: Boolean(finalSellerCenter?.staleRun)
              });
              return sendJson(res, 409, {
                ok: false,
                accepted: false,
                status: 'partial',
                cdpStatus: finalCdpStatus,
                crawlerStatus: finalCrawlerStatus,
                activeJob: false,
                failureReason: 'cdp_unavailable',
                partialReason: 'cdp_unavailable',
                retryable: true,
                outputDirMissing: Boolean(finalCrawlerStatus.outputDirMissing),
                targetInventory: finalCrawlerStatus.targetInventory,
                nextAction: CDP_RECOVERY_NEXT_ACTION
              });
            }
            if (existing?.status === 'running') {
              const crawlerStatus = buildServerCrawlerStatus({
                shop,
                shopId,
                database,
                sellerCenter,
                job: existing,
                mode,
                cdpStatus: duplicateCdpStatus,
                activeJob: true,
                staleRun: Boolean(sellerCenter?.staleRun)
              });
              const duplicatePayload = {
                ok: true,
                accepted: true,
                status: 'running',
                activeJob: safeActiveJob(existing),
                cdpStatus: crawlerStatus.cdpStatus,
                crawlerStatus
              };
              if (isTargetedOverviewCapture) {
                return sendJson(res, 409, {
                  ...duplicatePayload,
                  ok: false,
                  accepted: false,
                  failureReason: 'active_job_running',
                  retryable: true,
                  nextAction: 'Wait for the active job to finish, then refresh status.'
                });
              }
              return sendJson(res, 202, { ...duplicatePayload, job: existing });
            }
          }

          let prepared = null;
          let launch = null;
          let cdpPort = Number(body.cdpPort || 0);
          if (isTargetedOverviewCapture) {
            const session = crawlerProfileSessions.get(shopId);
            const shop = getShop(rootDir, shopId) || {};
            const database = loadCompassDatabase(rootDir, shopId);
            const sellerCenter = markStaleCrawlerRun(loadSellerCenterLatest(rootDir, shopId), null);
            if (!session?.cdpPort) {
              return sendJson(res, 409, targetCaptureBlockedResponse({
                shopId,
                shop,
                database,
                sellerCenter,
                currentPageKind: 'unknown',
                sessionReady: false,
                failureReason: 'cookie_missing',
                nextAction: TARGET_CAPTURE_PROFILE_ACTION,
                profileName: context.profileName
              }));
            }
            const state = await inspectCdpPageState(session.cdpPort, { targetUrl: session.targetUrl || targetUrl });
            const loginLike = ['login', 'signup'].includes(state.currentPageKind);
            if (!state.sessionReady || loginLike) {
              const failureReason = loginLike ? 'not_logged_in' : (state.cdpStatus.reachable === false ? 'cdp_unavailable' : 'cookie_missing');
              crawlerProfileSessions.set(shopId, {
                ...session,
                verifiedAt: new Date().toISOString(),
                sessionReady: state.sessionReady,
                currentPageKind: state.currentPageKind,
                cdpStatus: state.cdpStatus
              });
              appendAudit(rootDir, 'tiktokshop_crawler.target_capture_blocked', {
                mode,
                shopId,
                sellerId,
                profileName: session.profileName || context.profileName,
                currentPageKind: state.currentPageKind,
                sessionReady: state.sessionReady,
                failureReason,
                retryable: true
              });
              return sendJson(res, 409, targetCaptureBlockedResponse({
                shopId,
                shop,
                database,
                sellerCenter,
                cdpStatus: state.cdpStatus,
                currentPageKind: state.currentPageKind,
                sessionReady: state.sessionReady,
                failureReason,
                nextAction: TARGET_CAPTURE_LOGIN_ACTION,
                profileName: session.profileName || context.profileName
              }));
            }
            crawlerProfileSessions.set(shopId, {
              ...session,
              verifiedAt: new Date().toISOString(),
              sessionReady: true,
              currentPageKind: state.currentPageKind,
              cdpStatus: state.cdpStatus
            });
            cdpPort = session.cdpPort;
            prepared = { shopId, sellerId, cdpPort, targetUrl: session.targetUrl || targetUrl, launch: null };
          } else {
            prepared = await prepareCrawlerBrowser(body, mode);
            cdpPort = prepared.cdpPort;
            launch = prepared.launch;
          }
          const shop = getShop(rootDir, shopId) || {};
          const database = loadCompassDatabase(rootDir, shopId);
          const sellerCenter = markStaleCrawlerRun(loadSellerCenterLatest(rootDir, shopId), null);
          const cdpStatus = await probeCdpStatus(cdpPort, { requirePage: true });
          if (cdpStatus.reachable === false) {
            const failedJob = {
              id: new Date().toISOString().replace(/[:.]/g, '-'),
              mode,
              status: 'error',
              shopId,
              sellerId,
              autoOpenProfile: Boolean(launch),
              profileName: launch?.profileName || crawlerProfileSessions.get(shopId)?.profileName || '',
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              failureReason: 'cdp_unavailable',
              retryable: true
            };
            crawlerJobs.set(shopId, failedJob);
            appendAudit(rootDir, 'tiktokshop_crawler.crawl_preflight_failed', {
              mode,
              shopId,
              sellerId,
              jobId: failedJob.id,
              failureReason: 'cdp_unavailable',
              retryable: true,
              autoOpenProfile: Boolean(launch)
            });
            return sendJson(res, 503, buildCdpUnavailableResponse({
              shopId,
              shop,
              database,
              sellerCenter,
              job: failedJob,
              mode,
              launch,
              cdpStatus
            }));
          }
          const startedAt = new Date().toISOString();
          const jobRunId = createSellerCenterRunId();
          const job = {
            id: jobRunId,
            runId: jobRunId,
            mode,
            target: isTargetedOverviewCapture ? 'overview' : '',
            status: 'running',
            shopId,
            sellerId,
            cdpPort,
            autoOpenProfile: Boolean(launch),
            profileName: launch?.profileName || crawlerProfileSessions.get(shopId)?.profileName || '',
            startedAt,
            updatedAt: startedAt,
            outputDir: path.join('seller-center', jobRunId),
            summary: zeroCrawlerSummary()
          };
          crawlerJobs.set(shopId, job);
          writeSellerCenterRunStatusMarker({
            rootDir,
            shopId,
            sellerId,
            runId: jobRunId,
            baseUrl: targetUrl,
            dateRange: body.dateRange || 'yesterday',
            target: isTargetedOverviewCapture ? 'overview' : ''
          });
          crawlSellerCenterDeep({
            rootDir,
            cdpPort,
            shopId,
            sellerId,
            runId: jobRunId,
            baseUrl: targetUrl,
            configPath: body.configPath || undefined,
            dateRange: body.dateRange || 'yesterday',
            maxModules: Number(body.maxModules || 0),
            dryRun: Boolean(body.dryRun),
            clickAllControls: Boolean(body.clickAllControls),
            maxSafeControls: Number(body.maxSafeControls || 28)
          })
            .then(result => {
              const finishedAt = new Date().toISOString();
              crawlerJobs.set(shopId, { ...job, status: 'done', finishedAt, updatedAt: finishedAt, runId: result.runId, outputDir: path.join('seller-center', result.runId), summary: result.summary });
              appendAudit(rootDir, 'tiktokshop_crawler.crawl_done', { mode, shopId, runId: result.runId, summary: result.summary });
            })
            .catch(error => {
              const failureReason = normalizeCrawlerFailureReason(error.message);
              if (failureReason === 'cdp_unavailable') {
                finalizeActiveJobOnCdpDrop({ shopId, sellerId, job });
              } else {
                const finishedAt = new Date().toISOString();
                crawlerJobs.set(shopId, { ...job, status: 'error', finishedAt, updatedAt: finishedAt, failureReason });
              }
              appendAudit(rootDir, 'tiktokshop_crawler.crawl_error', { mode, shopId, failureReason });
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
            crawlerStatus: buildServerCrawlerStatus({
              shop,
              shopId,
              database,
              sellerCenter,
              job,
              mode,
              launch,
              cdpStatus,
              activeJob: true,
              staleRun: Boolean(sellerCenter?.staleRun)
            }),
            cdpStatus,
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
        const shop = getShop(rootDir, shopId) || {};
        const databaseBeforeCrawl = loadCompassDatabase(rootDir, shopId);
        const sellerCenter = markStaleCrawlerRun(loadSellerCenterLatest(rootDir, shopId), null);
        const cdpStatus = await probeCdpStatus(cdpPort, { requirePage: true });
        if (cdpStatus.reachable === false) {
          const failedJob = {
            id: new Date().toISOString().replace(/[:.]/g, '-'),
            mode,
            status: 'error',
            shopId,
            sellerId,
            autoOpenProfile: Boolean(launch),
            profileName: launch?.profileName || '',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            failureReason: 'cdp_unavailable',
            retryable: true
          };
          crawlerJobs.set(shopId, failedJob);
          appendAudit(rootDir, 'tiktokshop_crawler.crawl_preflight_failed', {
            mode,
            shopId,
            sellerId,
            jobId: failedJob.id,
            failureReason: 'cdp_unavailable',
            retryable: true,
            autoOpenProfile: Boolean(launch)
          });
          return sendJson(res, 503, buildCdpUnavailableResponse({
            shopId,
            shop,
            database: databaseBeforeCrawl,
            sellerCenter,
            job: failedJob,
            mode,
            launch,
            cdpStatus
          }));
        }
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
          crawlerStatus: buildServerCrawlerStatus({
            shop,
            shopId,
            database: loadCompassDatabase(rootDir, shopId),
            sellerCenter: loadSellerCenterLatest(rootDir, shopId),
            mode,
            launch,
            cdpStatus
          }),
          cdpStatus,
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
