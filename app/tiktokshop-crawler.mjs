import fs from 'node:fs';
import path from 'node:path';
import {
  buildCrawlerSnapshotContract,
  sanitizeCrawlerText,
  sanitizeCrawlerUrl,
  scrubCrawlerPayload
} from './crawler-contract.mjs';

const DEFAULT_COMPASS_URL = 'https://seller-vn.tiktok.com/compass/data-overview?shop_region=VN';
const DEFAULT_READY_TIME = 'auto';
const DEFAULT_SELLER_ID = '7494478078863902049';

function localYesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export const COMPASS_OVERVIEW_METRICS = [
  // GMV analysis by content and by order source.
  4024, 4029, 4033, 4037, 4042, 4045, 7816, 7821, 7822, 7973, 7974, 7996, 7997
];

const METRIC_TYPE_201 = new Set([]);

export const COMPASS_METRIC_LABELS = {
  4024: 'Tổng GMV',
  4029: 'GMV theo nội dung - LIVE',
  4033: 'GMV theo nội dung - Thẻ sản phẩm',
  4037: 'GMV theo nội dung - Video',
  7821: 'GMV theo nguồn đơn hàng - Liên kết',
  7822: 'GMV theo nguồn đơn hàng - Người bán',
  4042: 'Liên kết - LIVE',
  4045: 'Liên kết - Video',
  7816: 'Liên kết - Thẻ sản phẩm',
  7973: 'Liên kết - Video - GMV trực tiếp',
  7974: 'Liên kết - Video - GMV gián tiếp'
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function safeName(value) {
  return String(value || 'unknown-shop')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'unknown-shop';
}

function monthRange(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Invalid month: ${month}. Expected YYYY-MM.`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    month: `${match[1]}-${match[2]}`,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function previousDay(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dateRangeDays(startString, endString) {
  const days = [];
  const cursor = new Date(`${startString}T00:00:00Z`);
  const end = new Date(`${endString}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function cdpTabs(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  if (!res.ok) throw new Error(`Cannot inspect CDP port ${port}: ${res.status}`);
  return res.json();
}

class CdpPage {
  constructor(webSocketDebuggerUrl) {
    this.ws = new WebSocket(webSocketDebuggerUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
        return;
      }
      if (msg.method && this.events.has(msg.method)) {
        for (const handler of this.events.get(msg.method)) handler(msg.params || {});
      }
    };
  }

  async send(method, params = {}, timeoutMs = 15000) {
    await this.ready;
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, msg => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, new Set());
    this.events.get(method).add(handler);
    return () => this.events.get(method)?.delete(handler);
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

export async function findCompassPage({ cdpPort, url = DEFAULT_COMPASS_URL } = {}) {
  if (!cdpPort) throw new Error('cdpPort is required.');
  const tabs = await cdpTabs(cdpPort);
  const expectedUrl = String(url || '');
  const isSellerPage = tab => (
    tab.type === 'page' &&
    String(tab.url || '').includes('seller-vn.tiktok.com') &&
    !String(tab.url || '').includes('/account/login') &&
    !String(tab.url || '').includes('permission-request-dialog')
  );
  let page = tabs.find(tab => tab.type === 'page' && String(tab.url || '').includes('/compass/data-overview'));
  if (!page) page = tabs.find(tab => expectedUrl && tab.type === 'page' && String(tab.url || '') === expectedUrl);
  if (!page) page = tabs.find(isSellerPage);
  if (!page) page = tabs.find(tab => tab.type === 'page' && String(tab.url || '').includes('seller-vn.tiktok.com'));
  if (!page) page = tabs.find(tab => tab.type === 'page' && !String(tab.url || '').startsWith('edge://'));
  if (!page) page = tabs.find(tab => tab.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error(`No page target found on CDP port ${cdpPort}.`);
  return { ...page, fallbackUrl: url };
}

export async function getCompassReadyDate({ cdpPort, sellerId = DEFAULT_SELLER_ID } = {}) {
  const page = await findCompassPage({ cdpPort });
  const cdp = new CdpPage(page.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    const expression = `
      (async () => {
        const body = { request: { module_name: 'US_SellerPC_Overview_MergeId_Offline_Part', feature: 'default' }, version: 2 };
        const url = '/api/v2/insights/seller/shop/data/available/date?locale=vi-VN&language=vi-VN&oec_seller_id=${sellerId}&seller_id=${sellerId}&aid=4068&app_name=i18n_ecom_shop&device_platform=web&timezone_name=Asia%2FHo_Chi_Minh&use_content_type_definition=1';
        const json = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' }).then(r => r.json());
        return json;
      })()`;
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 30000);
    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.text || 'Compass ready-date evaluation failed.');
    }
    const json = result.result?.result?.value;
    const map = json?.data?.module_name_to_available_date_map || {};
    const first = Object.values(map)[0];
    return first?.available_date || first?.date || localYesterday();
  } finally {
    cdp.close();
  }
}

function makeOverviewRequest({ start, end, readyTime, metrics = COMPASS_OVERVIEW_METRICS, groupBy = [] }) {
  return {
    query_condition: [
      {
        metrics: metrics.map(metric => {
          if (metric && typeof metric === 'object') return metric;
          const metric_id = Number(metric);
          return { metric_id, metric_type: METRIC_TYPE_201.has(metric_id) ? 201 : 1 };
        }),
        where_filter: readyTime ? { ready_time: { value_list: [readyTime] } } : {},
        group_by: groupBy,
        query_time: { start, end, timezone_offset: 25200 },
        compare_to_time: { start: previousDay(start), end: previousDay(end) },
        date_completion: { enabled: true, granularity: 0 },
        having_filter: {}
      }
    ],
    version: 2,
    module: 'us_overview_stats'
  };
}

export async function queryCompassOverview({
  cdpPort,
  sellerId = DEFAULT_SELLER_ID,
  start,
  end,
  readyTime = DEFAULT_READY_TIME,
  metrics = COMPASS_OVERVIEW_METRICS,
  groupBy = []
} = {}) {
  if (!start || !end) throw new Error('start and end are required.');
  const resolvedReadyTime = readyTime === 'auto'
    ? await getCompassReadyDate({ cdpPort, sellerId })
    : readyTime;
  const page = await findCompassPage({ cdpPort });
  const cdp = new CdpPage(page.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    const request = makeOverviewRequest({ start, end, readyTime: resolvedReadyTime, metrics, groupBy });
    const expression = `
      (async () => {
        const body = ${JSON.stringify(request)};
        const url = '/api/v2/insights/seller/unified/query/us_overview_stats?locale=vi-VN&language=vi-VN&oec_seller_id=${sellerId}&seller_id=${sellerId}&aid=4068&app_name=i18n_ecom_shop&device_platform=web&timezone_name=Asia%2FHo_Chi_Minh&use_content_type_definition=1';
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
        const json = await res.json();
        return { status: res.status, ok: res.ok, json };
      })()`;
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 60000);
    if (result.result?.exceptionDetails) {
      throw new Error(result.result.exceptionDetails.text || 'Compass query evaluation failed.');
    }
    const value = result.result?.result?.value;
    if (!value?.ok || value.json?.code !== 0) {
      throw new Error(`Compass query failed: HTTP ${value?.status}, code ${value?.json?.code}, message ${value?.json?.message}`);
    }
    return { request, readyTime: resolvedReadyTime, response: value.json };
  } finally {
    cdp.close();
  }
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function mergeOverviewResponses(parts) {
  if (!parts.length) return { code: 0, message: 'success', data: [] };
  const base = structuredClone(parts[0].response);
  const baseIntervals = base.data?.[0]?.intervals || [];
  for (const part of parts.slice(1)) {
    const intervals = part.response?.data?.[0]?.intervals || [];
    intervals.forEach((interval, intervalIndex) => {
      const targetInterval = baseIntervals[intervalIndex];
      if (!targetInterval) {
        baseIntervals[intervalIndex] = structuredClone(interval);
        return;
      }
      const rows = interval.rows || [];
      targetInterval.rows ||= [];
      rows.forEach((row, rowIndex) => {
        targetInterval.rows[rowIndex] ||= { values: {} };
        targetInterval.rows[rowIndex].values = {
          ...(targetInterval.rows[rowIndex].values || {}),
          ...(row.values || {})
        };
      });
    });
    base.data[0].metas = {
      ...(base.data?.[0]?.metas || {}),
      ...(part.response?.data?.[0]?.metas || {})
    };
  }
  return base;
}

export async function queryCompassOverviewBatched(options = {}) {
  const metrics = options.metrics || COMPASS_OVERVIEW_METRICS;
  try {
    return await queryCompassOverview({ ...options, metrics });
  } catch (error) {
    if (!/invalid params/i.test(error.message)) throw error;
  }

  const parts = [];
  const badMetrics = [];
  let readyTime = options.readyTime;
  for (const chunk of chunkItems(metrics, 8)) {
    try {
      const part = await queryCompassOverview({ ...options, readyTime, metrics: chunk });
      readyTime = part.readyTime;
      parts.push(part);
    } catch {
      for (const metric of chunk) {
        try {
          const part = await queryCompassOverview({ ...options, readyTime, metrics: [metric] });
          readyTime = part.readyTime;
          parts.push(part);
        } catch (metricError) {
          badMetrics.push({ metric, error: metricError.message });
        }
      }
    }
  }
  return {
    request: { batched: true, badMetrics },
    readyTime: readyTime === 'auto' ? parts[0]?.readyTime : readyTime,
    response: mergeOverviewResponses(parts)
  };
}

export async function queryCompassOverviewDailyLoop({
  cdpPort,
  sellerId = DEFAULT_SELLER_ID,
  start,
  end,
  readyTime = DEFAULT_READY_TIME,
  metrics = COMPASS_OVERVIEW_METRICS
} = {}) {
  const resolvedReadyTime = readyTime === 'auto'
    ? await getCompassReadyDate({ cdpPort, sellerId })
    : readyTime;
  const page = await findCompassPage({ cdpPort });
  const cdp = new CdpPage(page.webSocketDebuggerUrl);
  const days = dateRangeDays(start, end);
  try {
    await cdp.send('Runtime.enable');
    const metricObjects = metrics.map(metric => {
      if (metric && typeof metric === 'object') return metric;
      const metric_id = Number(metric);
      return { metric_id, metric_type: METRIC_TYPE_201.has(metric_id) ? 201 : 1 };
    });
    const expression = `
      (async () => {
        const days = ${JSON.stringify(days)};
        const metrics = ${JSON.stringify(metricObjects)};
        const readyTime = ${JSON.stringify(resolvedReadyTime)};
        const url = '/api/v2/insights/seller/unified/query/us_overview_stats?locale=vi-VN&language=vi-VN&oec_seller_id=${sellerId}&seller_id=${sellerId}&aid=4068&app_name=i18n_ecom_shop&device_platform=web&timezone_name=Asia%2FHo_Chi_Minh&use_content_type_definition=1';
        const previousDay = (value) => {
          const date = new Date(value + 'T00:00:00Z');
          date.setUTCDate(date.getUTCDate() - 1);
          return date.toISOString().slice(0, 10);
        };
        const intervals = [];
        const metas = {};
        const errors = [];
        for (const day of days) {
          const body = {
            query_condition: [{
              metrics,
              where_filter: readyTime ? { ready_time: { value_list: [readyTime] } } : {},
              group_by: [],
              query_time: { start: day, end: day, timezone_offset: 25200 },
              compare_to_time: { start: previousDay(day), end: previousDay(day) },
              date_completion: { enabled: true, granularity: 0 },
              having_filter: {}
            }],
            version: 2,
            module: 'us_overview_stats'
          };
          const json = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' }).then(r => r.json());
          if (json.code !== 0) {
            errors.push({ day, code: json.code, message: json.message });
            continue;
          }
          const item = json.data?.[0] || {};
          intervals.push(...(item.intervals || []));
          Object.assign(metas, item.metas || {});
        }
        return { errors, response: { code: errors.length ? 207 : 0, message: errors.length ? 'partial_success' : 'success', data: [{ intervals, metas }] } };
      })()`;
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 180000);
    const value = result.result?.result?.value;
    return {
      request: { dailyLoop: true, start, end, dayCount: days.length, errors: value?.errors || [] },
      readyTime: resolvedReadyTime,
      response: value?.response || { code: 500, message: 'empty-cdp-result', data: [] }
    };
  } finally {
    cdp.close();
  }
}

function extractRows(response) {
  const intervals = response?.data?.[0]?.intervals || [];
  return intervals.flatMap(interval => (interval.rows || []).map(row => ({
    startDate: interval.start_date,
    endDate: interval.end_date,
    values: row.values || {}
  })));
}

function pickNumber(values, key) {
  const raw = values?.[String(key)];
  if (raw === '' || raw == null) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function summarizeRows(rows) {
  return rows.map(row => {
    const values = row.values || {};
    return {
      startDate: row.startDate,
      endDate: row.endDate,
      totalGmv: pickNumber(values, 4024),
      contentLiveGmv: pickNumber(values, 4029),
      contentVideoGmv: pickNumber(values, 4037),
      contentProductCardGmv: pickNumber(values, 4033),
      affiliateTotalGmv: pickNumber(values, 7821),
      sellerTotalGmv: pickNumber(values, 7822),
      affiliateLiveGmv: pickNumber(values, 4042),
      affiliateVideoGmv: pickNumber(values, 4045),
      affiliateProductCardGmv: pickNumber(values, 7816),
      affiliateVideoDirectGmv: pickNumber(values, 7973),
      affiliateVideoIndirectGmv: pickNumber(values, 7974),
      rawFieldCount: Object.keys(values).length
    };
  });
}

function databaseDir(rootDir, shopId) {
  return path.join(rootDir, 'data', 'tiktokshop-crawler', 'shops', safeName(shopId));
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function writeCrawlerContract(file, options) {
  writeJson(file, buildCrawlerSnapshotContract(options));
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function crawlCompassMonths({
  rootDir,
  cdpPort,
  shopId = DEFAULT_SELLER_ID,
  sellerId = shopId,
  months = [],
  readyTime = DEFAULT_READY_TIME,
  metrics = COMPASS_OVERVIEW_METRICS
} = {}) {
  if (!rootDir) throw new Error('rootDir is required.');
  if (!months.length) throw new Error('months[] is required.');
  const dir = databaseDir(rootDir, shopId);
  ensureDir(dir);

  const dbFile = path.join(dir, 'compass-overview-db.json');
  const db = readJson(dbFile, { shopId, sellerId, updatedAt: '', months: {}, metricLabels: COMPASS_METRIC_LABELS });
  const results = [];
  const startedAt = new Date().toISOString();
  writeCrawlerContract(path.join(dir, 'snapshot-contract.json'), {
    shopId,
    sellerId,
    runId: `compass-${startedAt.replace(/[:.]/g, '-')}`,
    startedAt,
    rawDir: 'raw',
    normalizedDir: '.',
    source: 'tiktokshop-crawler:compass',
    status: 'running',
    summary: { months: months.length }
  });

  for (const month of months) {
    const range = monthRange(month);
    const aggregate = await queryCompassOverviewBatched({
      cdpPort,
      sellerId,
      start: range.start,
      end: range.end,
      readyTime,
      metrics,
      groupBy: []
    });
    const daily = await queryCompassOverviewDailyLoop({
      cdpPort,
      sellerId,
      start: range.start,
      end: range.end,
      readyTime: aggregate.readyTime,
      metrics
    });
    const aggregateRows = extractRows(aggregate.response);
    const dailyRows = extractRows(daily.response);
    const normalized = {
      month: range.month,
      start: range.start,
      end: range.end,
      readyTime: aggregate.readyTime,
      crawledAt: new Date().toISOString(),
      aggregate: summarizeRows(aggregateRows),
      daily: summarizeRows(dailyRows),
      rawFiles: {
        aggregate: path.join('raw', `${range.month}-aggregate.json`),
        daily: path.join('raw', `${range.month}-daily.json`)
      }
    };

    writeJson(path.join(dir, normalized.rawFiles.aggregate), scrubCrawlerPayload(aggregate));
    writeJson(path.join(dir, normalized.rawFiles.daily), scrubCrawlerPayload(daily));
    db.months[range.month] = normalized;
    results.push(normalized);
  }

  db.updatedAt = new Date().toISOString();
  writeJson(dbFile, db);
  writeCrawlerContract(path.join(dir, 'snapshot-contract.json'), {
    shopId,
    sellerId,
    runId: `compass-${startedAt.replace(/[:.]/g, '-')}`,
    startedAt,
    finishedAt: db.updatedAt,
    rawDir: 'raw',
    normalizedDir: '.',
    source: 'tiktokshop-crawler:compass',
    status: 'done',
    summary: { months: results.length, rawFiles: results.length * 2 }
  });
  return { ok: true, shopId, sellerId, databaseDir: dir, databaseFile: dbFile, results };
}

export function loadCompassDatabase(rootDir, shopId) {
  const dir = databaseDir(rootDir, shopId);
  const dbFile = path.join(dir, 'compass-overview-db.json');
  return readJson(dbFile, { shopId, months: {}, metricLabels: COMPASS_METRIC_LABELS });
}

const DEFAULT_SELLER_CENTER_CONFIG = path.join('data', 'tiktokshop-crawler', 'seller-center-modules.json');

function vietnamYesterdayRange() {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  vnNow.setDate(vnNow.getDate() - 1);
  const date = vnNow.toISOString().slice(0, 10);
  return { start: date, end: date, label: 'Hôm qua', clickText: ['hôm qua', 'yesterday'] };
}

function vietnamTodayRange() {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const date = vnNow.toISOString().slice(0, 10);
  return { start: date, end: date, label: 'Hôm nay', clickText: ['hôm nay', 'today'] };
}

function vietnamLast7Range() {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const endDate = new Date(vnNow);
  const startDate = new Date(vnNow);
  startDate.setDate(startDate.getDate() - 6);
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    label: '7 ngày qua',
    clickText: ['7 ngày qua', 'last 7 days']
  };
}

function normalizeSellerCenterDateRange(dateRange) {
  if (!dateRange || dateRange === 'yesterday') return vietnamYesterdayRange();
  if (dateRange === 'today' || dateRange === 'realtime') return vietnamTodayRange();
  if (dateRange === 'last7' || dateRange === '7d') return vietnamLast7Range();
  if (typeof dateRange === 'object') {
    const fallback = vietnamYesterdayRange();
    const start = String(dateRange.start || dateRange.end || fallback.start);
    const end = String(dateRange.end || start);
    return {
      start,
      end,
      label: String(dateRange.label || `${start} -> ${end}`),
      clickText: Array.isArray(dateRange.clickText) ? dateRange.clickText : []
    };
  }
  return vietnamYesterdayRange();
}

function runId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sellerCenterDir(rootDir, shopId, id) {
  return path.join(databaseDir(rootDir, shopId), 'seller-center', id);
}

function readSellerCenterConfig(rootDir, configPath) {
  const file = path.isAbsolute(configPath || '')
    ? configPath
    : path.join(rootDir, configPath || DEFAULT_SELLER_CENTER_CONFIG);
  return readJson(file, null);
}

function flattenModules(config) {
  const rows = [];
  for (const module of config.modules || []) {
    rows.push({ ...module, parentId: null, parentName: null, depth: 0 });
    for (const child of module.children || []) {
      rows.push({
        ...child,
        parentId: module.id,
        parentName: module.name,
        inheritedLabels: module.menuLabels || [],
        depth: 1
      });
    }
  }
  return rows;
}

function fileSafePart(value) {
  return String(value || 'item')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

function countRows(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  let total = 0;
  for (const item of Object.values(value)) {
    if (Array.isArray(item)) total += item.length;
    else if (item && typeof item === 'object') total += countRows(item);
  }
  return total;
}

function collectFields(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    value.slice(0, 10).forEach(item => collectFields(item, prefix, out));
    return out;
  }
  if (!value || typeof value !== 'object') {
    if (prefix) out[prefix] ||= { path: prefix, samples: [] };
    if (prefix && out[prefix].samples.length < 5) out[prefix].samples.push(value);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') collectFields(child, next, out);
    else {
      out[next] ||= { path: next, samples: [] };
      if (out[next].samples.length < 5) out[next].samples.push(child);
    }
  }
  return out;
}

function flattenRecords(value, source = 'unknown') {
  const rows = [];
  function pushRow(item, basePath) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = { source, sourcePath: basePath };
    const flat = {};
    collectFields(item, '', flat);
    for (const [key, meta] of Object.entries(flat)) row[key] = meta.samples[0] ?? '';
    rows.push(row);
  }
  function walk(node, currentPath) {
    if (Array.isArray(node)) {
      node.forEach(item => pushRow(item, currentPath));
      node.slice(0, 3).forEach((item, index) => walk(item, `${currentPath}[${index}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) walk(child, currentPath ? `${currentPath}.${key}` : key);
  }
  walk(value, '');
  return rows.slice(0, 10000);
}

function csvEscape(value) {
  const raw = String(value ?? '');
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function writeCsv(file, rows) {
  ensureDir(path.dirname(file));
  if (!rows.length) {
    fs.writeFileSync(file, '', { mode: 0o600 });
    return;
  }
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(key => csvEscape(row[key])).join(','))
  ];
  fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
}

function makeReport(report) {
  const lines = [
    `# TikTok Seller Center crawl report`,
    ``,
    `- Run ID: ${report.runId}`,
    `- Shop: ${report.shopId}`,
    `- Date range: ${report.dateRange.start} -> ${report.dateRange.end}`,
    `- Base URL: ${report.baseUrl}`,
    `- API endpoints captured: ${report.summary.apiEndpoints}`,
    `- Raw files: ${report.summary.rawFiles}`,
    `- Normalized rows: ${report.summary.normalizedRows}`,
    ``,
    `## Module status`,
    ``,
    `| Module | Status | APIs | Exports | Rows | Notes |`,
    `|---|---:|---:|---:|---:|---|`
  ];
  for (const item of report.modules) {
    lines.push(`| ${item.name} | ${item.status} | ${item.apiCount} | ${item.exportCount} | ${item.rowCount} | ${String(item.notes || '').replace(/\|/g, '/')} |`);
  }
  if (report.unresolved.length) {
    lines.push('', '## Không lấy được API / cần fallback UI', '');
    report.unresolved.forEach(item => lines.push(`- ${item.module}: ${item.reason}`));
  }
  return `${lines.join('\n')}\n`;
}

export function buildSellerCenterFixtureRun({
  rootDir,
  shopId = 'fixture-shop',
  sellerId = 'fixture-seller',
  baseUrl = 'https://seller-vn.tiktok.com/fixture',
  dateRange = { start: '2026-06-19', end: '2026-06-19', label: 'Fixture' },
  rawResponses = [],
  fixtureRunId = `fixture-${runId()}`
} = {}) {
  if (!rootDir) throw new Error('rootDir is required.');
  if (!Array.isArray(rawResponses) || !rawResponses.length) {
    throw new Error('rawResponses[] is required for fixture runs.');
  }

  const range = normalizeSellerCenterDateRange(dateRange);
  const startedAt = new Date().toISOString();
  const dir = sellerCenterDir(rootDir, shopId, fixtureRunId);
  const shopDir = databaseDir(rootDir, shopId);
  const rawDir = path.join(dir, 'raw');
  const normalizedDir = path.join(dir, 'normalized');
  const logsDir = path.join(dir, 'logs');
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  ensureDir(logsDir);

  writeCrawlerContract(path.join(dir, 'snapshot-contract.json'), {
    shopId,
    sellerId,
    runId: fixtureRunId,
    startedAt,
    rawDir: path.relative(dir, rawDir),
    normalizedDir: path.relative(dir, normalizedDir),
    source: 'tiktokshop-crawler:seller-center-fixture',
    status: 'running',
    summary: { apiEndpoints: 0, rawFiles: 0, normalizedRows: 0, exportRequests: 0 }
  });

  const apiLog = [];
  const actionLog = [{
    module: 'fixture',
    action: 'build-fixture-run',
    rawResponses: rawResponses.length,
    at: startedAt
  }];
  const rawEntries = [];
  const dataDictionary = {};
  for (const [index, response] of rawResponses.entries()) {
    const rawText = typeof response.rawText === 'string'
      ? response.rawText
      : JSON.stringify(response.body ?? response.data ?? {});
    saveRawApiResponse({
      dir,
      rawDir,
      rawEntries,
      apiLog,
      dataDictionary,
      url: response.url || `${baseUrl}/api/fixture/${index + 1}`,
      method: response.method || 'GET',
      status: response.status ?? 200,
      type: response.type || 'Fixture',
      contentType: response.contentType || 'application/json',
      rawText,
      requestPostData: response.requestPostData || ''
    });
  }

  const normalizedRows = [];
  for (const entry of rawEntries) {
    if (!entry.file.endsWith('.json')) continue;
    const parsed = readJson(path.join(dir, entry.file), null);
    normalizedRows.push(...flattenRecords(parsed, entry.url));
  }

  writeJson(path.join(logsDir, 'api-log.json'), scrubCrawlerPayload(apiLog));
  writeJson(path.join(logsDir, 'action-log.json'), scrubCrawlerPayload(actionLog));
  writeJson(path.join(rawDir, 'export-requests.json'), []);
  writeJson(path.join(dir, 'data_dictionary.json'), {
    generatedAt: new Date().toISOString(),
    fields: Object.values(dataDictionary).sort((a, b) => a.path.localeCompare(b.path))
  });
  writeJson(path.join(normalizedDir, 'records.json'), normalizedRows);
  writeCsv(path.join(normalizedDir, 'records.csv'), normalizedRows);

  const report = {
    ok: true,
    runId: fixtureRunId,
    shopId,
    sellerId,
    baseUrl,
    dateRange: range,
    outputDir: dir,
    snapshotContract: 'snapshot-contract.json',
    modules: [{
      id: 'fixture',
      name: 'Sanitized fixture',
      status: 'ok',
      apiCount: rawEntries.length,
      exportCount: 0,
      rowCount: normalizedRows.length,
      notes: 'Generated from local sanitized fixture responses; no live TikTok crawl.'
    }],
    unresolved: [],
    summary: {
      apiEndpoints: new Set(apiLog.map(item => item.url)).size,
      rawFiles: rawEntries.length,
      normalizedRows: normalizedRows.length,
      exportRequests: 0
    }
  };
  writeCrawlerContract(path.join(dir, 'snapshot-contract.json'), {
    shopId,
    sellerId,
    runId: fixtureRunId,
    startedAt,
    finishedAt: new Date().toISOString(),
    rawDir: path.relative(dir, rawDir),
    normalizedDir: path.relative(dir, normalizedDir),
    source: 'tiktokshop-crawler:seller-center-fixture',
    status: 'done',
    summary: report.summary
  });
  writeJson(path.join(dir, 'crawl_report.json'), report);
  fs.writeFileSync(path.join(dir, 'crawl_report.md'), makeReport(report), { mode: 0o600 });
  writeJson(path.join(shopDir, 'seller-center-latest.json'), {
    ...report,
    outputDir: path.relative(shopDir, dir)
  });
  return report;
}

async function findSellerCenterPage({ cdpPort, url } = {}) {
  if (!cdpPort) throw new Error('cdpPort is required.');
  const tabs = await cdpTabs(cdpPort);
  const expectedUrl = String(url || '');
  const isUsableSellerPage = tab => (
    tab.type === 'page' &&
    String(tab.url || '').includes('seller-vn.tiktok.com') &&
    !String(tab.url || '').includes('/account/login') &&
    !String(tab.url || '').includes('permission-request-dialog')
  );
  let page = tabs.find(tab => expectedUrl && tab.type === 'page' && String(tab.url || '') === expectedUrl);
  if (!page) page = tabs.find(isUsableSellerPage);
  if (!page) page = tabs.find(tab => tab.type === 'page' && String(tab.url || '').includes('seller-vn.tiktok.com'));
  if (!page) page = tabs.find(tab => tab.type === 'page' && !String(tab.url || '').startsWith('edge://'));
  if (!page) page = tabs.find(tab => tab.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error(`No Seller Center page target found on CDP port ${cdpPort}.`);
  return { ...page, fallbackUrl: url };
}

async function cdpEval(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, 8000);
  if (result.result?.exceptionDetails) {
    throw new Error(result.result.exceptionDetails.text || 'CDP evaluate failed');
  }
  return result.result?.result?.value;
}

function browserHelperSource() {
  return `
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 2 && rect.height > 2 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const textOf = (el) => (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').trim().replace(/\\s+/g, ' ');
    const norm = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    const clickText = async (labels) => {
      const wanted = labels.map(norm).filter(Boolean);
      const selectors = 'a,button,[role="button"],[role="menuitem"],[role="tab"],[aria-label],[title],span,div';
      const nodes = Array.from(document.querySelectorAll(selectors)).filter(visible);
      const found = nodes.find(el => wanted.some(label => norm(textOf(el)).includes(label)));
      if (!found) return { ok: false, labels, url: location.href };
      found.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise(resolve => setTimeout(resolve, 80));
      found.click();
      return { ok: true, label: textOf(found), tag: found.tagName, role: found.getAttribute('role') || '', url: location.href };
    };
    const unsafeControlText = [
      'xoa', 'delete', 'remove', 'trash',
      'dung', 'stop', 'pause', 'tam dung',
      'gui', 'send', 'submit', 'confirm', 'xac nhan', 'dong y',
      'dang ky', 'register', 'join', 'tham gia',
      'tao', 'create', 'them', 'add',
      'sua', 'edit', 'update', 'save', 'luu',
      'huy', 'cancel', 'withdraw',
      'nap', 'pay', 'thanh toan', 'mua', 'buy'
    ];
    const isUnsafeControl = (item) => {
      const haystack = norm([item.text, item.aria, item.title, item.role].join(' '));
      return unsafeControlText.some(word => haystack.includes(word));
    };
    const clickControlByIndex = async (index) => {
      const nodes = Array.from(document.querySelectorAll('button,a,input,select,[role="button"],[role="tab"],[role="menuitem"],[aria-label],[title]')).filter(visible);
      const el = nodes[index];
      if (!el) return { ok: false, reason: 'index_not_found', index, url: location.href };
      const item = { index, text: textOf(el), role: el.getAttribute('role') || el.tagName.toLowerCase(), aria: el.getAttribute('aria-label') || '', title: el.title || '', disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true' };
      if (item.disabled) return { ok: false, reason: 'disabled', item, url: location.href };
      if (isUnsafeControl(item)) return { ok: false, reason: 'unsafe_skipped', item, url: location.href };
      el.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise(resolve => setTimeout(resolve, 80));
      el.click();
      return { ok: true, item, url: location.href };
    };
    const controls = (kindText = []) => {
      const wanted = kindText.map(norm).filter(Boolean);
      return Array.from(document.querySelectorAll('button,a,input,select,[role="button"],[role="tab"],[role="menuitem"],[aria-label],[title]'))
        .filter(visible)
        .map((el, index) => ({ index, text: textOf(el), role: el.getAttribute('role') || el.tagName.toLowerCase(), aria: el.getAttribute('aria-label') || '', title: el.title || '', disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true' }))
        .filter(item => !wanted.length || wanted.some(label => norm([item.text, item.aria, item.title, item.role].join(' ')).includes(label)))
        .slice(0, 120);
    };
    const snapshot = () => ({
      url: location.href,
      title: document.title,
      h1: Array.from(document.querySelectorAll('h1,h2')).filter(visible).map(textOf).slice(0, 20),
      buttons: controls([]).slice(0, 80),
      tabs: controls(['tab', 'theo', 'phan tich', 'tong quan', 'chi tiet']),
      filters: controls(['loc', 'filter', 'trang thai', 'loai', 'sap xep', 'sort']),
      exports: controls(['xuat', 'export', 'tai xuong', 'download', 'csv', 'excel']),
      tooltips: Array.from(document.querySelectorAll('[title],[aria-label]')).filter(visible).map(el => ({ text: textOf(el), title: el.title || '', aria: el.getAttribute('aria-label') || '' })).slice(0, 100)
    });
  `;
}

async function waitMs(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function safeGetResponseBody(cdp, requestId) {
  const body = await cdp.send('Network.getResponseBody', { requestId });
  return body.result || body;
}

function isJsonLike(contentType, rawText) {
  return /json/i.test(String(contentType || '')) || /^[\[{]/.test(String(rawText || '').trim());
}

function saveRawApiResponse({ dir, rawDir, rawEntries, apiLog, dataDictionary, url, method = 'GET', status, type = 'XHR', contentType = '', rawText = '', requestPostData = '' }) {
  const isJson = isJsonLike(contentType, rawText);
  const ext = /csv/i.test(String(contentType || '')) ? 'csv' : isJson ? 'json' : 'txt';
  const index = rawEntries.length + 1;
  const filename = `${String(index).padStart(4, '0')}-${fileSafePart(url)}.${ext}`;
  const file = path.join(rawDir, filename);
  let parsed = null;
  if (isJson) {
    try {
      parsed = scrubCrawlerPayload(JSON.parse(rawText));
      writeJson(file, parsed);
    } catch {
      fs.writeFileSync(file, sanitizeCrawlerText(rawText), { mode: 0o600 });
    }
  } else {
    fs.writeFileSync(file, sanitizeCrawlerText(rawText), { mode: 0o600 });
  }
  const rows = parsed ? countRows(parsed) : String(rawText || '').split(/\r?\n/).filter(Boolean).length;
  const entry = {
    file: path.relative(dir, file),
    url: sanitizeCrawlerUrl(url),
    method,
    status,
    type,
    contentType,
    rows,
    requestPostData: requestPostData ? sanitizeCrawlerText(requestPostData) : '',
    capturedAt: new Date().toISOString()
  };
  rawEntries.push(entry);
  apiLog.push(entry);
  if (parsed) collectFields(parsed, '', dataDictionary);
  return entry;
}

async function collectBrowserResourceUrls(cdp) {
  return cdpEval(cdp, `(() => {
    const urls = new Set();
    try {
      for (const item of performance.getEntriesByType('resource') || []) {
        if (item && item.name) urls.add(item.name);
      }
    } catch {}
    try {
      if (performance.getEntriesByType) {
        for (const item of performance.getEntriesByType('navigation') || []) {
          if (item && item.name) urls.add(item.name);
        }
      }
    } catch {}
    return Array.from(urls);
  })()`).catch(() => []);
}

async function fetchBrowserUrl(cdp, url) {
  const expression = `(async () => {
    const target = ${JSON.stringify(url)};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(target, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'x-strange-tts-crawler': 'browser-resource-refetch' }
    });
    try {
      const text = await response.text();
      const headers = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      return {
        url: response.url || target,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type') || '',
        headers,
        text
      };
    } finally {
      clearTimeout(timer);
    }
  })()`;
  return cdpEval(cdp, expression);
}

async function captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId = 'root', limit = 80 }) {
  const existing = new Set(apiLog.map(item => `${item.method || 'GET'} ${item.url}`));
  const urls = (await collectBrowserResourceUrls(cdp))
    .filter(url => shouldCapture(url))
    .filter(url => !existing.has(`GET ${url}`))
    .slice(0, Number(limit || 80));
  let captured = 0;
  for (const url of urls) {
    try {
      const result = await fetchBrowserUrl(cdp, url);
      const rawText = result?.text || '';
      const contentType = result?.contentType || result?.headers?.['content-type'] || '';
      if (!rawText.trim()) continue;
      saveRawApiResponse({
        dir,
        rawDir,
        rawEntries,
        apiLog,
        dataDictionary,
        url: result?.url || url,
        method: 'GET',
        status: result?.status,
        type: 'BrowserFetch',
        contentType,
        rawText
      });
      captured += 1;
    } catch (error) {
      actionLog.push({ module: moduleId, action: 'browser-resource-fetch-error', url, error: error.message, at: new Date().toISOString() });
    }
  }
  if (captured || urls.length) {
    actionLog.push({ module: moduleId, action: 'browser-resource-fetch', candidates: urls.length, captured, at: new Date().toISOString() });
  }
  return captured;
}

export async function crawlSellerCenterDeep({
  rootDir,
  cdpPort,
  shopId = 'default-shop',
  sellerId = '',
  configPath = DEFAULT_SELLER_CENTER_CONFIG,
  baseUrl,
  dateRange = 'yesterday',
  maxModules = 0,
  dryRun = false,
  clickAllControls = false,
  maxSafeControls = 28
} = {}) {
  if (!rootDir) throw new Error('rootDir is required.');
  const config = readSellerCenterConfig(rootDir, configPath);
  if (!config) throw new Error(`Cannot read Seller Center crawler config: ${configPath}`);
  const range = normalizeSellerCenterDateRange(dateRange);
  const id = runId();
  const dir = sellerCenterDir(rootDir, shopId, id);
  const shopDir = databaseDir(rootDir, shopId);
  const rawDir = path.join(dir, 'raw');
  const normalizedDir = path.join(dir, 'normalized');
  const logsDir = path.join(dir, 'logs');
  const startedAt = new Date().toISOString();
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  ensureDir(logsDir);
  writeCrawlerContract(path.join(dir, 'snapshot-contract.json'), {
    shopId,
    sellerId,
    runId: id,
    startedAt,
    rawDir: path.relative(dir, rawDir),
    normalizedDir: path.relative(dir, normalizedDir),
    source: 'tiktokshop-crawler:seller-center',
    status: 'running',
    summary: { apiEndpoints: 0, rawFiles: 0, normalizedRows: 0, exportRequests: 0 }
  });
  writeJson(path.join(shopDir, 'seller-center-latest.json'), {
    ok: false,
    status: 'running',
    runId: id,
    shopId,
    sellerId,
    baseUrl: baseUrl || config.baseUrl,
    dateRange: range,
    outputDir: path.relative(shopDir, dir),
    startedAt,
    summary: { apiEndpoints: 0, rawFiles: 0, normalizedRows: 0, exportRequests: 0 },
    modules: [],
    unresolved: []
  });

  const page = await findSellerCenterPage({ cdpPort, url: baseUrl || config.baseUrl });
  const cdp = new CdpPage(page.webSocketDebuggerUrl);
  const apiLog = [];
  const actionLog = [];
  const rawEntries = [];
  const unresolved = [];
  const exportRequests = [];
  const dataDictionary = {};

  const shouldCapture = url => {
    const lower = String(url || '').toLowerCase();
    const network = config.network || {};
    if ((network.ignoredUrlContains || []).some(part => lower.includes(String(part).toLowerCase()))) return false;
    if ([
      'ttwstatic.com',
      'mcs-sg.tiktok.com',
      'mon.tiktokv.com',
      'vcs-sg.tiktokv.com',
      'verification',
      'captcha',
      '/passport/',
      'check_login',
      '/webid',
      '/monitor_',
      '/resource/'
    ].some(part => lower.includes(part))) return false;
    const looksLikeApi = lower.includes('/api/') || lower.includes('/api/v') || lower.includes('api.') || lower.includes('tiktokshop.com/api');
    if (!looksLikeApi) return false;
    return (network.captureUrlContains || []).some(part => lower.includes(String(part).toLowerCase()));
  };

  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => null);

    const requests = new Map();
    cdp.on('Network.requestWillBeSent', params => {
      requests.set(params.requestId, {
        requestId: params.requestId,
        url: params.request?.url,
        method: params.request?.method,
        postData: params.request?.postData || '',
        type: params.type,
        startedAt: new Date().toISOString()
      });
    });
    cdp.on('Network.responseReceived', async params => {
      const req = requests.get(params.requestId) || {};
      const url = params.response?.url || req.url || '';
      if (!shouldCapture(url)) return;
      const type = params.type;
      const allowedTypes = new Set(config.network?.captureResourceTypes || ['XHR', 'Fetch']);
      if (!allowedTypes.has(type)) return;
      try {
        const bodyResult = await safeGetResponseBody(cdp, params.requestId);
        const contentType = params.response?.headers?.['content-type'] || params.response?.headers?.['Content-Type'] || '';
        const rawText = bodyResult.base64Encoded ? Buffer.from(bodyResult.body || '', 'base64').toString('utf8') : (bodyResult.body || '');
        saveRawApiResponse({
          dir,
          rawDir,
          rawEntries,
          apiLog,
          dataDictionary,
          url,
          method: req.method || 'GET',
          status: params.response?.status,
          type,
          contentType,
          rawText,
          requestPostData: req.postData || ''
        });
      } catch (error) {
        apiLog.push({
          url,
          status: params.response?.status,
          type,
          error: error.message,
          capturedAt: new Date().toISOString()
        });
      }
    });

    const targetUrl = baseUrl || config.baseUrl;
    if (targetUrl && page.url !== targetUrl) {
      await cdp.send('Page.navigate', { url: targetUrl });
      await waitMs(3500);
    }
    await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: 'start', limit: 40 });
    await cdpEval(cdp, `(async () => { ${browserHelperSource()} return true; })()`);
    const dateClickText = range.clickText?.length ? range.clickText : (config.discovery?.dateText || ['Hôm qua']);
    await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickText(${JSON.stringify(dateClickText)}); })()`).catch(() => null);
    await waitMs(1200);
    await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: 'date-range', limit: 40 });

    const modules = flattenModules(config).slice(0, maxModules > 0 ? maxModules : undefined);
    const moduleReports = [];
    for (const module of modules) {
      const beforeApiCount = apiLog.length;
      const beforeExportCount = exportRequests.length;
      const labels = [...(module.inheritedLabels || []), ...(module.menuLabels || []), module.name].filter(Boolean);
      let status = 'ok';
      let notes = '';
      try {
        if (module.url) {
          await cdp.send('Page.navigate', { url: module.url });
          await waitMs(3000);
        } else {
          const clicked = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickText(${JSON.stringify(labels)}); })()`);
          actionLog.push({ module: module.id, action: 'click-menu', labels, result: clicked, at: new Date().toISOString() });
          if (!clicked?.ok) {
            status = 'ui_not_found';
            notes = 'Không tìm thấy menu bằng text/role.';
            unresolved.push({ module: module.name, reason: notes });
          }
          await waitMs(2200);
        }

        const snapshot = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return snapshot(); })()`);
        writeJson(path.join(rawDir, `${fileSafePart(module.id)}-ui-snapshot.json`), scrubCrawlerPayload(snapshot));
        await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: module.id, limit: 80 });

        const filters = snapshot.filters || [];
        for (const filter of filters.slice(0, 8)) {
          const clicked = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickText(${JSON.stringify([filter.text, filter.aria, filter.title].filter(Boolean))}); })()`).catch(error => ({ ok: false, error: error.message }));
          actionLog.push({ module: module.id, action: 'inspect-filter', target: filter, result: clicked, at: new Date().toISOString() });
          await waitMs(600);
          await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: module.id, limit: 40 });
        }

        const tabs = snapshot.tabs || [];
        for (const tab of tabs.slice(0, 12)) {
          const clicked = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickText(${JSON.stringify([tab.text, tab.aria, tab.title].filter(Boolean))}); })()`).catch(error => ({ ok: false, error: error.message }));
          actionLog.push({ module: module.id, action: 'click-tab', target: tab, result: clicked, at: new Date().toISOString() });
          await waitMs(1200);
          await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: module.id, limit: 60 });
        }

        const exportButtons = (snapshot.exports || []).slice(0, 15);
        for (const [index, button] of exportButtons.entries()) {
          const name = `${module.parentName ? `${module.parentName} - ` : ''}${module.name} - Xuất dữ liệu ${index + 1} - ${button.text || button.aria || button.title || 'không tên'}`;
          exportRequests.push({ name, module: module.id, button, status: dryRun ? 'queued' : 'clicked' });
          if (!dryRun) {
            const clicked = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickText(${JSON.stringify([button.text, button.aria, button.title].filter(Boolean))}); })()`).catch(error => ({ ok: false, error: error.message }));
            actionLog.push({ module: module.id, action: 'click-export', exportName: name, result: clicked, at: new Date().toISOString() });
            await waitMs(1600);
            await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: module.id, limit: 40 });
          }
        }

        if (clickAllControls && !dryRun && (module.depth > 0 || module.url)) {
          const afterCommonSnapshot = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return snapshot(); })()`).catch(() => snapshot);
          const safeControlIndexes = (afterCommonSnapshot.buttons || [])
            .filter(item => !item.disabled)
            .filter(item => {
              const haystack = [item.text, item.aria, item.title, item.role].join(' ').toLowerCase();
              if (!haystack.trim()) return false;
              if (/xoa|delete|remove|trash|dung|stop|pause|gui|send|submit|confirm|xac nhan|dong y|dang ky|register|join|tham gia|tao|create|them|add|sua|edit|update|save|luu|huy|cancel|withdraw|nap|pay|thanh toan|mua|buy/.test(haystack)) return false;
              return true;
            })
            .slice(0, Number(maxSafeControls || 28))
            .map(item => item.index);
          let safeClickNumber = 0;
          for (const index of safeControlIndexes) {
            const clicked = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickControlByIndex(${Number(index)}); })()`).catch(error => ({ ok: false, error: error.message }));
            actionLog.push({ module: module.id, action: 'click-safe-control', index, result: clicked, at: new Date().toISOString() });
            await waitMs(900);
            await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: module.id, limit: 40 });
            safeClickNumber += 1;
            if (safeClickNumber % 6 === 0) {
              const deepSnapshot = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return snapshot(); })()`).catch(() => null);
              if (deepSnapshot) writeJson(path.join(rawDir, `${fileSafePart(module.id)}-deep-${String(safeClickNumber).padStart(2, '0')}-ui-snapshot.json`), scrubCrawlerPayload(deepSnapshot));
            }
          }
          const finalDeepSnapshot = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return snapshot(); })()`).catch(() => null);
          if (finalDeepSnapshot) writeJson(path.join(rawDir, `${fileSafePart(module.id)}-deep-final-ui-snapshot.json`), scrubCrawlerPayload(finalDeepSnapshot));
        }

        for (let pageIndex = 0; pageIndex < Number(config.maxPaginationPages || 30); pageIndex += 1) {
          const clicked = await cdpEval(cdp, `(async () => { ${browserHelperSource()} return await clickText(${JSON.stringify(config.discovery?.paginationText || ['Tiếp', 'Next'])}); })()`).catch(() => ({ ok: false }));
          if (!clicked?.ok) break;
          actionLog.push({ module: module.id, action: 'pagination-next', pageIndex: pageIndex + 1, result: clicked, at: new Date().toISOString() });
          await waitMs(1200);
          await captureBrowserResources({ cdp, shouldCapture, dir, rawDir, rawEntries, apiLog, dataDictionary, actionLog, moduleId: module.id, limit: 40 });
        }
      } catch (error) {
        status = 'error';
        notes = error.message;
        unresolved.push({ module: module.name, reason: error.message });
        actionLog.push({ module: module.id, action: 'module-error-recover', error: error.message, at: new Date().toISOString() });
        await cdp.send('Page.navigate', { url: targetUrl }).catch(() => null);
        await waitMs(3500);
      }
      const moduleApis = apiLog.slice(beforeApiCount);
      moduleReports.push({
        id: module.id,
        name: module.parentName ? `${module.parentName} / ${module.name}` : module.name,
        status,
        apiCount: moduleApis.length,
        exportCount: exportRequests.length - beforeExportCount,
        rowCount: moduleApis.reduce((sum, item) => sum + Number(item.rows || 0), 0),
        notes
      });
    }

    const childCoveredParentIds = new Set(
      modules
        .filter(module => module.parentId)
        .map(module => module.parentId)
    );
    for (const report of moduleReports) {
      if (report.status === 'ui_not_found' && childCoveredParentIds.has(report.id)) {
        const coveredChildren = moduleReports.filter(item => item.id !== report.id && item.name.startsWith(`${report.name} / `));
        if (coveredChildren.length && coveredChildren.every(item => item.status === 'ok')) {
          report.status = 'ok';
          report.notes = 'Nhom cha da duoc crawl thong qua cac module con.';
        }
      }
    }
    const reportUnresolved = unresolved.filter(item => {
      const moduleReport = moduleReports.find(report => report.name === item.module || report.id === item.module);
      return moduleReport?.status !== 'ok';
    });

    await waitMs(1200);
    const normalizedRows = [];
    for (const entry of rawEntries) {
      if (!entry.file.endsWith('.json')) continue;
      const parsed = readJson(path.join(dir, entry.file), null);
      normalizedRows.push(...flattenRecords(parsed, entry.url));
    }
    writeJson(path.join(logsDir, 'api-log.json'), scrubCrawlerPayload(apiLog));
    writeJson(path.join(logsDir, 'action-log.json'), scrubCrawlerPayload(actionLog));
    writeJson(path.join(rawDir, 'export-requests.json'), scrubCrawlerPayload(exportRequests));
    writeJson(path.join(dir, 'data_dictionary.json'), {
      generatedAt: new Date().toISOString(),
      fields: Object.values(dataDictionary).sort((a, b) => a.path.localeCompare(b.path))
    });
    writeJson(path.join(normalizedDir, 'records.json'), normalizedRows);
    writeCsv(path.join(normalizedDir, 'records.csv'), normalizedRows);

    const report = {
      ok: true,
      runId: id,
      shopId,
      sellerId,
      baseUrl: targetUrl,
      dateRange: range,
      outputDir: dir,
      snapshotContract: 'snapshot-contract.json',
      modules: moduleReports,
      unresolved: reportUnresolved,
      summary: {
        apiEndpoints: new Set(apiLog.map(item => item.url)).size,
        rawFiles: rawEntries.length,
        normalizedRows: normalizedRows.length,
        exportRequests: exportRequests.length
      }
    };
    writeCrawlerContract(path.join(dir, 'snapshot-contract.json'), {
      shopId,
      sellerId,
      runId: id,
      startedAt,
      finishedAt: new Date().toISOString(),
      rawDir: path.relative(dir, rawDir),
      normalizedDir: path.relative(dir, normalizedDir),
      source: 'tiktokshop-crawler:seller-center',
      status: 'done',
      summary: report.summary
    });
    writeJson(path.join(dir, 'crawl_report.json'), report);
    fs.writeFileSync(path.join(dir, 'crawl_report.md'), makeReport(report), { mode: 0o600 });
    writeJson(path.join(shopDir, 'seller-center-latest.json'), {
      ...report,
      outputDir: path.relative(shopDir, dir)
    });
    return report;
  } finally {
    cdp.close();
  }
}

export function loadSellerCenterLatest(rootDir, shopId) {
  const dir = databaseDir(rootDir, shopId);
  const latestFile = path.join(dir, 'seller-center-latest.json');
  const latest = readJson(latestFile, null);
  if (latest) return latest;
  const runsDir = path.join(dir, 'seller-center');
  if (fs.existsSync(runsDir)) {
    const runs = fs.readdirSync(runsDir, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => {
        const full = path.join(runsDir, item.name);
        return { name: item.name, full, mtimeMs: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    const run = runs[0];
    if (run) {
      const report = readJson(path.join(run.full, 'crawl_report.json'), null);
      if (report) {
        const snapshotContract = readJson(path.join(run.full, 'snapshot-contract.json'), null);
        writeJson(latestFile, { ...report, outputDir: path.relative(dir, run.full), snapshotContract });
        return { ...report, outputDir: path.relative(dir, run.full), snapshotContract };
      }
      const rawDir = path.join(run.full, 'raw');
      const normalizedDir = path.join(run.full, 'normalized');
      const rawFiles = fs.existsSync(rawDir)
        ? fs.readdirSync(rawDir, { recursive: true }).filter(item => /\.[a-z0-9]+$/i.test(String(item))).length
        : 0;
      const normalizedRows = readJson(path.join(normalizedDir, 'records.json'), []).length || 0;
      return {
        ok: false,
        status: 'incomplete',
        runId: run.name,
        shopId,
        outputDir: path.relative(dir, run.full),
        summary: { apiEndpoints: 0, rawFiles, normalizedRows, exportRequests: 0 },
        modules: [],
        unresolved: [{ module: 'Seller Center', reason: 'Run trước đó chưa hoàn tất hoặc bị dừng giữa chừng.' }]
      };
    }
  }
  return {
    ok: false,
    shopId,
    summary: { apiEndpoints: 0, rawFiles: 0, normalizedRows: 0, exportRequests: 0 },
    modules: [],
    unresolved: []
  };
}
