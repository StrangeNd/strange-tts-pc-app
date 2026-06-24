export const CRAWLER_SNAPSHOT_CONTRACT_VERSION = '2026-06-22.1';
export const DEFAULT_CRAWLER_RAW_RETENTION_DAYS = 30;

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
    if (isSensitiveCrawlerKey(key)) return [key, REDACTED];
    if (/url$/i.test(key) || key === 'url') return [key, sanitizeCrawlerUrl(String(child || ''))];
    if (typeof child === 'string' && /^https?:\/\//i.test(child)) return [key, sanitizeCrawlerUrl(child)];
    return [key, scrubCrawlerPayload(child, nextPath)];
  }));
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
