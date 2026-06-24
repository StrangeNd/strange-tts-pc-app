export const CRAWLER_SNAPSHOT_CONTRACT_VERSION = '2026-06-22.1';
export const DEFAULT_CRAWLER_RAW_RETENTION_DAYS = 30;
export const CRAWLER_FAILURE_REASONS = [
  'not_logged_in',
  'cookie_missing',
  'cookie_expired',
  'wrong_shop_suspected',
  'captcha_or_verification_needed',
  'seller_center_unavailable',
  'compass_unavailable',
  'cdp_unavailable',
  'api_response_changed',
  'selector_changed',
  'network_error',
  'parse_error',
  'partial_capture',
  'unknown'
];

const REDACTED = '[redacted]';
const SENSITIVE_KEY_RE = /(^|[_-])(cookie|cookies|token|access|refresh|secret|password|authorization|auth|csrf|session|sessionid|sid|credential|license|machine_id|device_id|web_id)([_-]|$)|set-cookie|x-tt-token|bearer/i;
const SENSITIVE_QUERY_RE = /cookie|token|secret|password|authorization|auth|csrf|session|sessionid|sid|credential|license|machine_id|device_id|web_id|fp|msToken|x-bogus/i;
const SENSITIVE_KEY_PARTS = [
  'cookie',
  'token',
  'access',
  'refresh',
  'secret',
  'password',
  'authorization',
  'csrf',
  'session',
  'sessionid',
  'credential',
  'license',
  'machineid',
  'deviceid',
  'webid'
];
const SAFE_COOKIE_METADATA_KEYS = new Set([
  'cookieCount',
  'cookieStorage',
  'cookieStorageStatus',
  'cookieUpdatedAt',
  'sessionHint'
]);
const SECRET_TEXT_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(sessionid|sid|token|authorization|cookie)=([^;&\s]+)/gi,
  /(sk-[A-Za-z0-9_-]{12,})/g
];

export function isSensitiveCrawlerKey(key = '') {
  const normalized = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SENSITIVE_KEY_RE.test(String(key)) || SENSITIVE_KEY_PARTS.some(part => normalized.includes(part));
}

export function sanitizeCrawlerText(value = '') {
  return SECRET_TEXT_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, match => {
      const [prefix] = match.split('=');
      if (match.includes('=')) return `${prefix}=${REDACTED}`;
      return REDACTED;
    }),
    String(value)
  );
}

export function sanitizeCrawlerUrl(value = '') {
  const raw = sanitizeCrawlerText(value);
  try {
    const parsed = new URL(raw);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_RE.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function scrubCrawlerPayload(value, path = '') {
  if (Array.isArray(value)) {
    return value.map((item, index) => scrubCrawlerPayload(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? sanitizeCrawlerText(value) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (SAFE_COOKIE_METADATA_KEYS.has(key)) return [key, scrubCrawlerPayload(child, nextPath)];
    if (isSensitiveCrawlerKey(key)) return [key, REDACTED];
    if (/url$/i.test(key) || key === 'url') return [key, sanitizeCrawlerUrl(String(child || ''))];
    if (typeof child === 'string' && /^https?:\/\//i.test(child)) return [key, sanitizeCrawlerUrl(child)];
    return [key, scrubCrawlerPayload(child, nextPath)];
  }));
}

export function normalizeCrawlerFailureReason(value = '') {
  if (CRAWLER_FAILURE_REASONS.includes(value)) return value;
  const text = String(value || '').toLowerCase();
  if (!text.trim()) return 'unknown';
  if (/wrong\s*shop|sai\s*shop|shop\s*khong\s*dung|shop\s*không\s*đúng/.test(text)) return 'wrong_shop_suspected';
  if (/captcha|verification|verify|xac\s*minh|xác\s*minh|otp/.test(text)) return 'captcha_or_verification_needed';
  if (/expired|expire|re-?login|relogin|dang\s*nhap\s*lai|đăng\s*nhập\s*lại|needs-relogin/.test(text)) return 'cookie_expired';
  if (/cookie.*missing|missing.*cookie|no\s*cookie|cookie\s*missing|chua\s*co.*cookie|chưa\s*có.*cookie/.test(text)) return 'cookie_missing';
  if (/not\s*logged\s*in|need\s*login|needs?\s*login|login\s*required|chua\s*dang\s*nhap|chưa\s*đăng\s*nhập/.test(text)) return 'not_logged_in';
  if (/seller\s*center.*(unavailable|down|blocked)|homepage.*(unavailable|down)|seller-vn.*unavailable/.test(text)) return 'seller_center_unavailable';
  if (/compass.*(unavailable|down|blocked|not\s*found)|data-overview.*(unavailable|down)/.test(text)) return 'compass_unavailable';
  if (/cdp|chrome\s*debug|debugger|websocket|web\s*socket|devtools|econnrefused|target.*closed|no\s*page\s*target/.test(text)) return 'cdp_unavailable';
  if (/api.*(changed|unexpected|invalid)|response.*(changed|unexpected|invalid)|message.*code|schema|contract/.test(text)) return 'api_response_changed';
  if (/selector|ui_not_found|click|menu|tab|filter|export|pagination|khong\s*tim\s*thay|không\s*tìm\s*thấy/.test(text)) return 'selector_changed';
  if (/network|timeout|timed\s*out|fetch|econnreset|enotfound|socket|dns/.test(text)) return 'network_error';
  if (/parse|json|csv|xlsx|spreadsheet|unreadable|invalid\s*number/.test(text)) return 'parse_error';
  if (/partial|incomplete|unresolved|giua\s*chung|giữa\s*chừng/.test(text)) return 'partial_capture';
  return 'unknown';
}

function normalizedStatus(value = '') {
  const status = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (['ready', 'need-login', 'cookie-expired', 'crawling', 'completed', 'failed', 'partial'].includes(status)) {
    return status;
  }
  if (status === 'running') return 'crawling';
  if (status === 'done' || status === 'success') return 'completed';
  if (status === 'error') return 'failed';
  if (status === 'incomplete') return 'partial';
  return 'ready';
}

function defaultRetryable(reason = '') {
  if (!reason) return false;
  return !['wrong_shop_suspected', 'api_response_changed', 'selector_changed'].includes(reason);
}

export function buildCrawlerStatusContract({
  status = 'ready',
  readiness = '',
  selectedShop = {},
  profileName = '',
  cookieStorageStatus = 'none',
  cookieCount = 0,
  cookieUpdatedAt = '',
  sessionHint = '',
  latestRun = null,
  failureReason = '',
  partialReason = '',
  missingMetrics = [],
  retryable,
  runId = '',
  updatedAt = ''
} = {}) {
  const normalizedFailureReason = failureReason ? normalizeCrawlerFailureReason(failureReason) : null;
  const safeShop = selectedShop ? {
    id: selectedShop.id || selectedShop.shopId || '',
    name: selectedShop.name || selectedShop.label || selectedShop.shopName || '',
    sellerId: selectedShop.sellerId || selectedShop.oec_seller_id || '',
    adsAccountId: selectedShop.adsAccountId || selectedShop.aadvid || ''
  } : {};
  const safeLatestRun = latestRun ? {
    runId: latestRun.runId || latestRun.id || '',
    status: normalizedStatus(latestRun.status || status),
    mode: latestRun.mode || '',
    source: latestRun.source || '',
    startedAt: latestRun.startedAt || '',
    finishedAt: latestRun.finishedAt || '',
    updatedAt: latestRun.updatedAt || latestRun.finishedAt || latestRun.startedAt || '',
    summary: latestRun.summary || {}
  } : null;
  const normalized = {
    status: normalizedStatus(status),
    readiness: readiness || normalizedStatus(status),
    selectedShop: safeShop,
    profileName: String(profileName || ''),
    cookieStorageStatus: String(cookieStorageStatus || 'none'),
    cookieCount: Number.isFinite(Number(cookieCount)) ? Number(cookieCount) : 0,
    cookieUpdatedAt: String(cookieUpdatedAt || ''),
    sessionHint: String(sessionHint || ''),
    latestRun: safeLatestRun,
    failureReason: normalizedFailureReason,
    partialReason: partialReason ? sanitizeCrawlerText(String(partialReason)) : '',
    missingMetrics: Array.isArray(missingMetrics) ? missingMetrics.map(item => sanitizeCrawlerText(String(item))) : [],
    retryable: typeof retryable === 'boolean' ? retryable : defaultRetryable(normalizedFailureReason),
    runId: runId || safeLatestRun?.runId || '',
    updatedAt: updatedAt || new Date().toISOString()
  };
  return scrubCrawlerPayload(normalized);
}

export function normalizedCrawlerMetric({
  key,
  label = '',
  value = null,
  unit = '',
  source = '',
  sourceType = 'crawler',
  shopId = '',
  profileId = '',
  timestamp = '',
  status
} = {}) {
  const available = value !== null && value !== undefined && value !== '';
  return {
    key,
    label,
    value: available ? value : null,
    unit,
    source,
    sourceType,
    shopId,
    profileId: profileId || shopId,
    timestamp,
    status: status || (available ? 'available' : 'missing')
  };
}

export function buildCrawlerRetentionPolicy({
  startedAt = '',
  retentionDays = DEFAULT_CRAWLER_RAW_RETENTION_DAYS
} = {}) {
  const days = Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0
    ? Math.floor(Number(retentionDays))
    : DEFAULT_CRAWLER_RAW_RETENTION_DAYS;
  const started = new Date(startedAt || Date.now());
  const validStartedAt = Number.isNaN(started.getTime()) ? new Date() : started;
  const expiresAt = new Date(validStartedAt.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    mode: 'local-retention-policy',
    rawSnapshotDays: days,
    pruneAutomatically: false,
    reviewBeforeDelete: true,
    compressedRecommended: true,
    remoteUpload: false,
    startedAt: validStartedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    note: 'Raw snapshots remain local. This policy records a review deadline but does not automatically delete crawler data.'
  };
}

export function buildCrawlerSnapshotContract({
  shopId = '',
  sellerId = '',
  runId = '',
  startedAt = '',
  finishedAt = '',
  rawDir = 'raw',
  normalizedDir = 'normalized',
  source = 'tiktokshop-crawler',
  status = 'running',
  summary = {}
} = {}) {
  const retentionPolicy = buildCrawlerRetentionPolicy({ startedAt });
  return {
    version: CRAWLER_SNAPSHOT_CONTRACT_VERSION,
    source,
    status,
    shopId,
    sellerId,
    runId,
    startedAt,
    finishedAt,
    layers: [
      { key: 'raw_snapshot', path: rawDir, scrubbed: true, shownByDefault: false },
      { key: 'parsed_source_data', path: 'data_dictionary.json', scrubbed: true },
      { key: 'normalized_metrics', path: normalizedDir, missingDataPolicy: 'missing-not-zero' },
      { key: 'derived_metrics', path: 'dashboard/business-analysis', recomputable: true },
      { key: 'dashboard_report_view', path: 'public dashboard/business analysis', userFacing: true }
    ],
    retentionPolicy,
    security: {
      secretScrubbed: true,
      plaintextCookieExport: false,
      remoteUpload: false,
      forbiddenFields: ['cookies', 'tokens', 'credentials', 'authorization headers', 'machine IDs', 'license keys']
    },
    summary
  };
}
