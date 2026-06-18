import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_BYTES = 18 * 1024 * 1024;

const DEFAULT_METRIC_DEFINITIONS = Object.freeze([
  { key: 'revenue', section: 'kpis', sectionTitle: 'KPI', sectionKind: 'kpi', label: 'Doanh thu', format: 'money', mode: 'path', path: 'kpis.revenue', visible: true },
  { key: 'netProfitEstimate', section: 'kpis', sectionTitle: 'KPI', sectionKind: 'kpi', label: 'Lợi nhuận ước tính', format: 'money', mode: 'path', path: 'kpis.netProfitEstimate', visible: true },
  { key: 'netMargin', section: 'kpis', sectionTitle: 'KPI', sectionKind: 'kpi', label: 'Net margin', format: 'percent', mode: 'path', path: 'kpis.netMargin', visible: true },
  { key: 'adsActualCost', section: 'kpis', sectionTitle: 'KPI', sectionKind: 'kpi', label: 'Ads thực tế', format: 'money', mode: 'path', path: 'costs.adsActualCost', visible: true },
  { key: 'productCost', section: 'kpis', sectionTitle: 'KPI', sectionKind: 'kpi', label: 'Giá vốn', format: 'money', mode: 'path', path: 'costs.productCost', visible: true },
  { key: 'affiliateTotalCost', section: 'kpis', sectionTitle: 'KPI', sectionKind: 'kpi', label: 'Mẫu + ship affiliate', format: 'money', mode: 'formula', formula: 'costs.affiliateSampleCost + costs.affiliateShipping', visible: true },
  { key: 'adsActualTotalCost', section: 'ads', sectionTitle: 'Ads GMV Max', sectionKind: 'list', label: 'Cash + Credit + Ads credit', format: 'money', mode: 'path', path: 'ads.actual.actualCost', visible: true },
  { key: 'adsCostWithDiscount', section: 'ads', sectionTitle: 'Ads GMV Max', sectionKind: 'list', label: 'Chi phí gồm chiết khấu', format: 'money', mode: 'path', path: 'ads.gmvMax.costWithDiscount', visible: true },
  { key: 'adsGmv', section: 'ads', sectionTitle: 'Ads GMV Max', sectionKind: 'list', label: 'GMV ads', format: 'money', mode: 'path', path: 'ads.gmvMax.gmv', visible: true },
  { key: 'adsRoiCreative', section: 'ads', sectionTitle: 'Ads GMV Max', sectionKind: 'list', label: 'ROI creative', format: 'decimal', mode: 'path', path: 'ads.gmvMax.roi', visible: true },
  { key: 'adsRowsUsed', section: 'ads', sectionTitle: 'Ads GMV Max', sectionKind: 'list', label: 'Dòng GMV Max đã dùng', format: 'number', mode: 'path', path: 'ads.actual.rowsUsed', visible: true },
  { key: 'adsMatchMode', section: 'ads', sectionTitle: 'Ads GMV Max', sectionKind: 'list', label: 'Match chi phi', format: 'text', mode: 'path', path: 'ads.actual.matchMode', visible: true },
  { key: 'settledAmount', section: 'settlement', sectionTitle: 'Quyết toán', sectionKind: 'list', label: 'Đã quyết toán', format: 'money', mode: 'path', path: 'settlements.income.amount', visible: true },
  { key: 'onholdAmount', section: 'settlement', sectionTitle: 'Quyết toán', sectionKind: 'list', label: 'Sẽ quyết toán', format: 'money', mode: 'path', path: 'settlements.onhold.amount', visible: true },
  { key: 'orderCount', section: 'settlement', sectionTitle: 'Quyết toán', sectionKind: 'list', label: 'Đơn hàng', format: 'number', mode: 'path', path: 'kpis.orders', visible: true },
  { key: 'unitCount', section: 'settlement', sectionTitle: 'Quyết toán', sectionKind: 'list', label: 'Số lượng bán', format: 'number', mode: 'path', path: 'kpis.units', visible: true },
  { key: 'videoGmv', section: 'content', sectionTitle: 'KOC / Creator', sectionKind: 'list', label: 'GMV Video', format: 'money', mode: 'path', path: 'content.video.gmv', visible: true },
  { key: 'creatorGmv', section: 'content', sectionTitle: 'KOC / Creator', sectionKind: 'list', label: 'GMV Creator', format: 'money', mode: 'path', path: 'content.creator.gmv', visible: true },
  { key: 'videoRows', section: 'content', sectionTitle: 'KOC / Creator', sectionKind: 'list', label: 'Video rows', format: 'number', mode: 'path', path: 'content.video.rows', visible: true },
  { key: 'creatorRows', section: 'content', sectionTitle: 'KOC / Creator', sectionKind: 'list', label: 'Creator rows', format: 'number', mode: 'path', path: 'content.creator.rows', visible: true },
  { key: 'revenueSource', section: 'logic', sectionTitle: 'Logic đang áp dụng', sectionKind: 'list', label: 'Nguồn doanh thu', format: 'text', mode: 'path', path: 'kpis.revenueSource', visible: true },
  { key: 'marketplaceFee', section: 'logic', sectionTitle: 'Logic đang áp dụng', sectionKind: 'list', label: 'Phí sàn', format: 'money', mode: 'path', path: 'costs.marketplaceFee', visible: true },
  { key: 'paymentFee', section: 'logic', sectionTitle: 'Logic đang áp dụng', sectionKind: 'list', label: 'Phí thanh toán', format: 'money', mode: 'path', path: 'costs.paymentFee', visible: true },
  { key: 'operationFee', section: 'logic', sectionTitle: 'Logic đang áp dụng', sectionKind: 'list', label: 'Phí vận hành', format: 'money', mode: 'path', path: 'costs.operationFee', visible: true },
  { key: 'fixedCost', section: 'logic', sectionTitle: 'Logic đang áp dụng', sectionKind: 'list', label: 'Chi phí cố định', format: 'money', mode: 'path', path: 'costs.fixedCost', visible: true },
  { key: 'totalCost', section: 'logic', sectionTitle: 'Logic đang áp dụng', sectionKind: 'list', label: 'Tổng chi phí', format: 'money', mode: 'path', path: 'costs.totalCost', visible: true },
  { key: 'priceRows', section: 'mapping', sectionTitle: 'Chất lượng mapping', sectionKind: 'list', label: 'Giá gốc rows', format: 'number', mode: 'path', path: 'priceRows', visible: true },
  { key: 'productImportCount', section: 'mapping', sectionTitle: 'Chất lượng mapping', sectionKind: 'list', label: 'Sản phẩm import', format: 'number', mode: 'path', path: 'productCatalog.items.length', visible: true },
  { key: 'aliasCount', section: 'mapping', sectionTitle: 'Chất lượng mapping', sectionKind: 'list', label: 'Alias map từ file SP', format: 'number', mode: 'path', path: 'productCatalog.aliasCount', visible: true },
  { key: 'unmatchedCount', section: 'mapping', sectionTitle: 'Chất lượng mapping', sectionKind: 'list', label: 'Chưa map giá', format: 'number', mode: 'path', path: 'productCatalog.unmatched.length', visible: true },
  { key: 'fileCount', section: 'mapping', sectionTitle: 'Chất lượng mapping', sectionKind: 'list', label: 'File đã nạp', format: 'number', mode: 'path', path: 'fileSummary.length', visible: true }
]);

const DEFAULT_CALCULATION_RULES = Object.freeze({
  version: 1,
  revenueMode: 'auto',
  adsCreditRatioPct: 50,
  includeProductCost: true,
  includeAffiliateSampleCost: true,
  includeAffiliateShipping: true,
  includeAdsActualCost: true,
  marketplaceFeePct: 0,
  paymentFeePct: 0,
  operationFeePct: 0,
  fixedCost: 0,
  targetGrowthPct: 20,
  minRoiOverride: 0,
  skuProfitFeePct: 0,
  metricDefinitions: DEFAULT_METRIC_DEFINITIONS
});

const METRIC_TEXT_MIGRATIONS = Object.freeze({
  sectionTitle: {
    'Quyet toan': 'Quyết toán',
    'Logic dang ap dung': 'Logic đang áp dụng',
    'Chat luong mapping': 'Chất lượng mapping'
  },
  label: {
    'Loi nhuan uoc tinh': 'Lợi nhuận ước tính',
    'Ads thuc te': 'Ads thực tế',
    'Gia von': 'Giá vốn',
    'Mau + ship affiliate': 'Mẫu + ship affiliate',
    'Chi phi gom chiet khau': 'Chi phí gồm chiết khấu',
    'Dong GMV Max da dung': 'Dòng GMV Max đã dùng',
    'Da quyet toan': 'Đã quyết toán',
    'Se quyet toan': 'Sẽ quyết toán',
    'Don hang': 'Đơn hàng',
    'So luong ban': 'Số lượng bán',
    'Nguon doanh thu': 'Nguồn doanh thu',
    'Phi san': 'Phí sàn',
    'Phi thanh toan': 'Phí thanh toán',
    'Phi van hanh': 'Phí vận hành',
    'Chi phi co dinh': 'Chi phí cố định',
    'Tong chi phi': 'Tổng chi phí',
    'Gia goc rows': 'Giá gốc rows',
    'San pham import': 'Sản phẩm import',
    'Alias map tu file SP': 'Alias map từ file SP',
    'Chua map gia': 'Chưa map giá',
    'File da nap': 'File đã nạp'
  }
});

const REVENUE_MODES = new Set(['auto', 'orders', 'settlement', 'gmvMax']);

const FILE_TYPES = new Set([
  'auto',
  'product',
  'income',
  'onhold',
  'orders',
  'affiliate',
  'adsActual',
  'gmvMaxCreative',
  'video',
  'creator'
]);

const HEADER_HINTS = [
  'order id',
  'id don hang',
  'campaign id',
  'id chien dich',
  'campaign name',
  'ten chien dich',
  'cash cost',
  'credit cost',
  'ad credit cost',
  'tong so tien quyet toan',
  'so tien quyet toan',
  'product id',
  'product id',
  'product name',
  'product name',
  'sku id',
  'seller sku',
  'ten san pham',
  'gmv',
  'chi phi',
  'doanh thu gop'
];

function normalizeText(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, match => (match === '\u0110' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactKey(value = '') {
  return normalizeText(value).replace(/\s+/g, '');
}

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw || /^[-\u2013\u2014]$/.test(raw)) return 0;
  const negative = /^\(|-/.test(raw) || /\)$/.test(raw);
  let clean = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const n = Number.parseFloat(clean);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw || /^[-\u2013\u2014]$/.test(raw)) return 0;
  const n = Number.parseFloat(raw.replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return Math.round(Number(value || 0)).toLocaleString('vi-VN');
}

function readJsonFileSafe(file, fallback = null) {
  try {
    if (!file || !fs.existsSync(file) || fs.statSync(file).size <= 0) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function statNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object') {
    if (value.amount !== undefined) return parseMoney(value.amount);
    if (value.value !== undefined) return parseMoney(value.value);
    if (value.amount_delimited !== undefined) return parseMoney(value.amount_delimited);
    if (value.amount_formatted !== undefined) return parseMoney(value.amount_formatted);
  }
  return parseMoney(value);
}

function findLatestSellerCenterRun(rootDir, preferredShopId = '') {
  const crawlerRoot = path.join(rootDir, 'data', 'tiktokshop-crawler', 'shops');
  if (!fs.existsSync(crawlerRoot)) return null;
  const shopDirs = fs.readdirSync(crawlerRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  const orderedShopDirs = preferredShopId && shopDirs.includes(preferredShopId)
    ? [preferredShopId, ...shopDirs.filter(name => name !== preferredShopId)]
    : shopDirs;

  for (const shopId of orderedShopDirs) {
    const shopDir = path.join(crawlerRoot, shopId);
    const latest = readJsonFileSafe(path.join(shopDir, 'seller-center-latest.json'), null);
    const runDir = selectSellerCenterRunForShop(shopDir, latest);
    if (runDir && fs.existsSync(runDir)) return { shopId, shopDir, runDir, latest };
  }
  return null;
}

function sellerCenterRunHasApi(runDir, urlNeedle) {
  const apiLog = readJsonFileSafe(path.join(runDir, 'logs', 'api-log.json'), []);
  return Array.isArray(apiLog) && apiLog.some(item => String(item.url || '').includes(urlNeedle) && item.file);
}

function selectSellerCenterRunForShop(shopDir, latest = null) {
  const latestOutput = latest?.outputDir ? path.join(shopDir, latest.outputDir) : '';
  if (latestOutput && fs.existsSync(latestOutput) && sellerCenterRunHasApi(latestOutput, '/seller_center/homepage/stats')) {
    return latestOutput;
  }
  const sellerCenterDir = path.join(shopDir, 'seller-center');
  if (!fs.existsSync(sellerCenterDir)) return latestOutput && fs.existsSync(latestOutput) ? latestOutput : '';
  const runs = fs.readdirSync(sellerCenterDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      dir: path.join(sellerCenterDir, entry.name),
      mtime: fs.statSync(path.join(sellerCenterDir, entry.name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  const withHomepageStats = runs.find(run => sellerCenterRunHasApi(run.dir, '/seller_center/homepage/stats'));
  return withHomepageStats?.dir || runs[0]?.dir || '';
}

function listLatestSellerCenterRuns(rootDir, preferredShopId = '') {
  const crawlerRoot = path.join(rootDir, 'data', 'tiktokshop-crawler', 'shops');
  if (!fs.existsSync(crawlerRoot)) return [];
  const shopDirs = fs.readdirSync(crawlerRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  const orderedShopDirs = preferredShopId && shopDirs.includes(preferredShopId)
    ? [preferredShopId, ...shopDirs.filter(name => name !== preferredShopId)]
    : shopDirs;
  return orderedShopDirs.map(shopId => findLatestSellerCenterRun(rootDir, shopId)).filter(Boolean);
}

function readCrawlerApiBody(runDir, urlNeedle) {
  const apiLog = readJsonFileSafe(path.join(runDir, 'logs', 'api-log.json'), []);
  const matches = Array.isArray(apiLog)
    ? apiLog.filter(item => String(item.url || '').includes(urlNeedle) && item.file)
    : [];
  for (const item of matches.reverse()) {
    const rawFile = path.join(runDir, String(item.file).replace(/[\\/]/g, path.sep));
    const body = readJsonFileSafe(rawFile, null);
    if (body) return { body, log: item, rawFile };
  }
  return null;
}

function readCrawlerApiBodies(runDir, urlNeedle) {
  const apiLog = readJsonFileSafe(path.join(runDir, 'logs', 'api-log.json'), []);
  const matches = Array.isArray(apiLog)
    ? apiLog.filter(item => String(item.url || '').includes(urlNeedle) && item.file)
    : [];
  return matches.map(item => {
    const rawFile = path.join(runDir, String(item.file).replace(/[\\/]/g, path.sep));
    const body = readJsonFileSafe(rawFile, null);
    return body ? { body, log: item, rawFile } : null;
  }).filter(Boolean);
}

function buildDelta(current, previous) {
  const currentNumber = Number(current || 0);
  const previousNumber = Number(previous || 0);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber) || previousNumber === 0) return null;
  return (currentNumber - previousNumber) / Math.abs(previousNumber);
}

function buildShopCard({ key, label, icon, value, previousValue = null, format = 'number', source = 'crawler', note = '', group = 'overview', available = undefined }) {
  const hasValue = available !== undefined ? Boolean(available) : value !== null && value !== undefined && value !== '';
  return {
    key,
    label,
    icon,
    value: hasValue && Number.isFinite(Number(value)) ? Number(value) : null,
    previousValue: previousValue === null || previousValue === undefined ? null : Number(previousValue || 0),
    deltaPct: !hasValue || previousValue === null || previousValue === undefined ? null : buildDelta(value, previousValue),
    format,
    source,
    note,
    group,
    available: hasValue
  };
}

function findIndicatorValue(performanceBodies, titleNeedles = [], nameNeedles = []) {
  const titleNorm = titleNeedles.map(normalizeText);
  const nameNorm = nameNeedles.map(normalizeText);
  for (const entry of performanceBodies.slice().reverse()) {
    const indicators = entry.body?.data?.indicators || [];
    for (const indicator of indicators) {
      const title = normalizeText(indicator.title || '');
      const name = normalizeText(indicator.name || '');
      const titleMatch = titleNorm.length && titleNorm.every(needle => title.includes(needle));
      const nameMatch = nameNorm.length && nameNorm.every(needle => name.includes(needle));
      if (titleMatch || nameMatch) {
        return {
          value: statNumber(indicator.value),
          title: indicator.title || '',
          explanation: indicator.explanation || '',
          source: entry.log?.url || ''
        };
      }
    }
  }
  return null;
}

function latestViolationSummary(violationBodies) {
  const entry = violationBodies[violationBodies.length - 1];
  const data = entry?.body?.data || {};
  const points = Array.isArray(data.violation_points_v2) ? data.violation_points_v2 : [];
  return {
    score: data.violation_score ?? null,
    count: points.reduce((sum, item) => sum + Number(item.count || 0), 0),
    risk: data.section_infos?.find?.(item => Number(data.violation_score || 0) >= Number(item.left_node || 0) && Number(data.violation_score || 0) <= Number(item.right_node || 0))?.risk_level || '',
    source: entry?.log?.url || ''
  };
}

function taskText(value) {
  return normalizeText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function collectTaskItemsFromValue(value, items = [], seen = new Set()) {
  if (!value || typeof value !== 'object') return items;
  if (seen.has(value)) return items;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach(item => collectTaskItemsFromValue(item, items, seen));
    return items;
  }
  const title = value.title || value.task_title || value.taskName || value.task_name || value.name || value.desc || value.description;
  const key = value.key || value.task_key || value.task_id || value.id || value.type || value.scene;
  const rawStatus = value.status || value.state || value.task_status || value.complete_status || value.is_completed || value.completed || value.done;
  const text = taskText(title);
  if (text && text.length >= 3 && text.length <= 140) {
    const statusText = taskText(rawStatus);
    const done = rawStatus === true
      || Number(rawStatus) === 1
      || /done|finish|complete|completed|claimed|success|hoan thanh|da hoan thanh/.test(statusText);
    const id = String(key || text);
    if (!items.some(item => item.id === id || item.title === String(title))) {
      items.push({
        id,
        title: String(title),
        status: rawStatus === undefined || rawStatus === null ? '' : String(rawStatus),
        done,
        key: key === undefined || key === null ? '' : String(key)
      });
    }
  }
  for (const child of Object.values(value)) collectTaskItemsFromValue(child, items, seen);
  return items;
}

function latestTaskSummary(taskBodies, noviceBodies) {
  const task = taskBodies[taskBodies.length - 1]?.body?.data || {};
  const novice = noviceBodies[noviceBodies.length - 1]?.body?.data || {};
  const items = collectTaskItemsFromValue(task).slice(0, 80);
  const doneCount = items.filter(item => item.done).length;
  return {
    completed: task.process ?? (items.length ? doneCount : null),
    remaining: items.length ? items.length - doneCount : (task.has_step_task ? null : 0),
    level: novice.AssessmentLevelsData?.CurrentLevel ?? null,
    items
  };
}

function findStatsValue(stats = {}, keyNeedles = []) {
  const needles = keyNeedles.map(normalizeText);
  for (const [key, value] of Object.entries(stats || {})) {
    const normalized = normalizeText(key);
    if (needles.every(needle => normalized.includes(needle))) return statNumber(value);
  }
  return null;
}

function ratioValue(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  return bottom ? top / bottom : null;
}

function buildRangeMetricCards(stats = {}, compareStats = {}, performanceBodies = [], violationBodies = [], taskBodies = [], noviceBodies = []) {
  const gmv = statNumber(stats.gmv);
  const orders = statNumber(stats.orders_cnt);
  const visitors = statNumber(stats.visitors_cnt);
  const impressions = findStatsValue(stats, ['impression']) ?? findStatsValue(stats, ['show']);
  const refunds = findStatsValue(stats, ['refund']);
  const violation = latestViolationSummary(violationBodies);
  const tasks = latestTaskSummary(taskBodies, noviceBodies);
  const sellerFaultNegativeReview = findIndicatorValue(performanceBodies, ['đánh giá tiêu cực', 'người bán'], ['negative', 'review']);
  const sellerFaultRefundReturn = findIndicatorValue(performanceBodies, ['hoàn tiền', 'trả hàng', 'lỗi người bán'], ['seller', 'fault', 'refund']);
  const fastDispatch = findIndicatorValue(performanceBodies, ['tỷ lệ gửi hàng nhanh'], ['fast', 'dispatch']);
  const sellerFaultCancel = findIndicatorValue(performanceBodies, ['hủy', 'lỗi của người bán'], ['liable', 'cancel']);
  const aftersaleHandle = findIndicatorValue(performanceBodies, ['thời gian phản hồi trung bình'], ['imart', 'hour']);
  const reply12h = findIndicatorValue(performanceBodies, ['trả lời', '12 giờ'], ['12h', 'reply']);
  return [
    buildShopCard({ key: 'gmv', label: 'GMV', icon: 'st-icon-money', value: gmv, previousValue: compareStats.gmv ? statNumber(compareStats.gmv) : null, format: 'money', source: 'crawler' }),
    buildShopCard({ key: 'orders', label: 'Số đơn hàng', icon: 'st-icon-order', value: orders, previousValue: compareStats.orders_cnt !== undefined ? statNumber(compareStats.orders_cnt) : null, source: 'crawler' }),
    buildShopCard({ key: 'impressions', label: 'Lượt hiển thị', icon: 'st-icon-data', value: impressions, previousValue: findStatsValue(compareStats, ['impression']) ?? findStatsValue(compareStats, ['show']), source: 'crawler', available: impressions !== null }),
    buildShopCard({ key: 'visitors', label: 'Khách truy cập', icon: 'st-icon-data', value: visitors, previousValue: compareStats.visitors_cnt !== undefined ? statNumber(compareStats.visitors_cnt) : null, source: 'crawler' }),
    buildShopCard({ key: 'refunds', label: 'Hoàn tiền', icon: 'st-icon-trend-down', value: refunds, source: 'crawler', available: refunds !== null }),
    buildShopCard({ key: 'conversionRate', label: 'Tỷ lệ chuyển đổi', icon: 'st-icon-trend-up', value: ratioValue(orders, visitors), previousValue: ratioValue(statNumber(compareStats.orders_cnt), statNumber(compareStats.visitors_cnt)), format: 'percent', source: 'computed' }),
    buildShopCard({ key: 'aov', label: 'AOV', icon: 'st-icon-revenue', value: ratioValue(gmv, orders), previousValue: ratioValue(statNumber(compareStats.gmv), statNumber(compareStats.orders_cnt)), format: 'money', source: 'computed' }),
    buildShopCard({ key: 'storeViolations', label: 'Vi phạm cửa hàng', icon: 'st-icon-report', value: violation.count, source: 'crawler', note: violation.risk, available: violation.count !== null }),
    buildShopCard({ key: 'storeScore', label: 'Điểm cửa hàng', icon: 'st-icon-cpo', value: violation.score, format: 'decimal', source: 'crawler', note: violation.risk, available: violation.score !== null }),
    buildShopCard({ key: 'negativeReviewRate', label: 'Tỷ lệ đánh giá tiêu cực', icon: 'st-icon-trend-down', value: sellerFaultNegativeReview?.value, format: 'percent', source: 'crawler', note: sellerFaultNegativeReview?.explanation || '', available: Boolean(sellerFaultNegativeReview) }),
    buildShopCard({ key: 'sellerFaultRefundReturnRate', label: 'Trả hàng/hoàn tiền lỗi người bán', icon: 'st-icon-trend-down', value: sellerFaultRefundReturn?.value, format: 'percent', source: 'crawler', note: sellerFaultRefundReturn?.explanation || '', available: Boolean(sellerFaultRefundReturn) }),
    buildShopCard({ key: 'fastDispatchRate30d', label: 'Tỷ lệ gửi hàng nhanh 30 ngày', icon: 'st-icon-rocket', value: fastDispatch?.value, format: 'percent', source: 'crawler', note: fastDispatch?.explanation || '', available: Boolean(fastDispatch) }),
    buildShopCard({ key: 'sellerFaultCancelRate', label: 'Tỷ lệ hủy do lỗi người bán', icon: 'st-icon-trend-down', value: sellerFaultCancel?.value, format: 'percent', source: 'crawler', note: sellerFaultCancel?.explanation || '', available: Boolean(sellerFaultCancel) }),
    buildShopCard({ key: 'aftersaleHandleTime', label: 'Thời gian xử lý hậu mãi', icon: 'st-icon-settings', value: aftersaleHandle?.value, format: 'hours', source: 'crawler', note: aftersaleHandle?.explanation || '', available: Boolean(aftersaleHandle) }),
    buildShopCard({ key: 'reply12hRate30d', label: 'Tỷ lệ phản hồi 12 giờ 30 ngày', icon: 'st-icon-check', value: reply12h?.value, format: 'percent', source: 'crawler', note: reply12h?.explanation || '', available: Boolean(reply12h) }),
    buildShopCard({ key: 'tasksCompleted', label: 'Nhiệm vụ đã hoàn thành', icon: 'st-icon-check', value: tasks.completed, source: 'crawler', available: tasks.completed !== null }),
    buildShopCard({ key: 'tasksRemaining', label: 'Nhiệm vụ còn lại', icon: 'st-icon-guide', value: tasks.remaining, source: 'crawler', available: tasks.remaining !== null })
  ];
}

function emptyDetailMetric(label, key, format = 'number') {
  return { key, label, value: null, format, available: false, source: 'pending' };
}

function metricFromValue(label, key, value, format = 'number', source = 'crawler') {
  return { key, label, value: value === null || value === undefined ? null : Number(value), format, source, available: value !== null && value !== undefined };
}

function buildShopDetailSections(stats = {}, summary = {}) {
  const gmv = statNumber(stats.gmv);
  const orders = statNumber(stats.orders_cnt);
  const visitors = statNumber(stats.visitors_cnt);
  const views = findStatsValue(stats, ['view']);
  const productClicks = findStatsValue(stats, ['product', 'click']);
  const productImpressions = findStatsValue(stats, ['product', 'impression']) ?? findStatsValue(stats, ['impression']);
  const videoTop = (summary.content?.video?.top || []).slice(0, 8).map(item => ({
    name: item.name,
    tag: 'Tài khoản liên kết / tài khoản kết nối',
    metrics: [
      metricFromValue('GMV', 'gmv', item.gmv, 'money', 'xlsx'),
      metricFromValue('Đơn hàng', 'orders', item.orders, 'number', 'xlsx'),
      emptyDetailMetric('CTOR', 'ctor', 'percent'),
      metricFromValue('Lượt xem', 'views', item.views, 'number', 'xlsx'),
      emptyDetailMetric('Lượt hiển thị', 'impressions'),
      emptyDetailMetric('Lượt nhấp', 'clicks'),
      emptyDetailMetric('GPM', 'gpm', 'money'),
      emptyDetailMetric('Số khách TB mỗi ngày', 'avgCustomers'),
      emptyDetailMetric('CTR', 'ctr', 'percent'),
      emptyDetailMetric('Tỷ lệ xem hết', 'completionRate', 'percent')
    ]
  }));
  return [
    {
      key: 'liveVideo',
      title: 'Phân tích Live & video',
      metrics: [
        metricFromValue('GMV đến từ buổi Live', 'liveGmv', statNumber(stats.live_gmv), 'money'),
        metricFromValue('Sản phẩm', 'productCardGmv', statNumber(stats.product_card_gmv), 'money'),
        emptyDetailMetric('Các sản phẩm khác nhau đã bán', 'uniqueProducts'),
        metricFromValue('Đơn hàng đã tạo', 'createdOrders', orders),
        metricFromValue('Đơn hàng đã thanh toán', 'paidOrders', orders),
        metricFromValue('Số món bán ra đã ghi nhận vào live', 'liveItemsSold', statNumber(stats.items_sold_cnt)),
        metricFromValue('Người mua', 'buyers', statNumber(stats.customers_cnt)),
        metricFromValue('Giá trung bình', 'avgPrice', ratioValue(gmv, orders), 'money'),
        emptyDetailMetric('CTOR', 'ctor', 'percent'),
        metricFromValue('Người xem', 'viewers', visitors),
        metricFromValue('Lượt xem', 'views', views, 'number'),
        emptyDetailMetric('Thời lượng xem trung bình', 'avgWatchDuration'),
        emptyDetailMetric('Bình luận', 'comments'),
        emptyDetailMetric('Lượt chia sẻ', 'shares'),
        emptyDetailMetric('Lượt thích', 'likes'),
        emptyDetailMetric('Người theo dõi mới', 'newFollowers'),
        metricFromValue('Lượt hiển thị sản phẩm', 'productImpressions', productImpressions),
        metricFromValue('Lượt nhấp sản phẩm', 'productClicks', productClicks),
        metricFromValue('CTR', 'ctr', ratioValue(productClicks, productImpressions), 'percent')
      ],
      videos: videoTop
    },
    {
      key: 'productCard',
      title: 'Phân tích thẻ sản phẩm',
      metrics: [
        metricFromValue('Người xem', 'viewers', visitors),
        metricFromValue('Lượt xem', 'views', views),
        emptyDetailMetric('Lượt nhấp chuột duy nhất', 'uniqueClicks'),
        metricFromValue('Lượt nhấp', 'clicks', productClicks),
        metricFromValue('Tỷ lệ xem đến khi nhấp chuột', 'viewToClickRate', ratioValue(productClicks, views), 'percent'),
        emptyDetailMetric('Lượt nhấp thêm vào giỏ hàng', 'cartClicks'),
        emptyDetailMetric('Người dùng thêm vào giỏ hàng', 'cartUsers'),
        emptyDetailMetric('Tỷ lệ nhấp chuột đến khi thêm vào giỏ hàng', 'clickToCartRate', 'percent'),
        emptyDetailMetric('Số khách mỗi ngày', 'dailyCustomers'),
        metricFromValue('Đơn hàng SKU', 'skuOrders', orders),
        metricFromValue('GMV', 'gmv', statNumber(stats.product_card_gmv), 'money'),
        emptyDetailMetric('Tỷ lệ xem đến khi thanh toán', 'viewToPaymentRate', 'percent'),
        emptyDetailMetric('Tỷ lệ nhấp chuột đến khi thanh toán', 'clickToPaymentRate', 'percent'),
        emptyDetailMetric('Tỷ lệ thêm vào giỏ hàng đến khi thanh toán', 'cartToPaymentRate', 'percent'),
        metricFromValue('GMV quy ra từ nội dung', 'contentGmv', gmv, 'money'),
        emptyDetailMetric('Sản phẩm', 'productName', 'text'),
        emptyDetailMetric('ID', 'productId', 'text')
      ]
    }
  ];
}

function rangeDescriptor(key, label, interval = {}, compare = {}, performanceBodies, violationBodies, taskBodies, noviceBodies, summary) {
  const stats = interval.stats || {};
  const compareStats = compare.stats || {};
  const tasks = latestTaskSummary(taskBodies, noviceBodies);
  return {
    key,
    label,
    startDate: interval.start_date || '',
    endDate: interval.end_date || '',
    rangeLabel: interval.start_date && interval.end_date ? `${interval.start_date} -> ${interval.end_date}` : '',
    compareLabel: compare.start_date && compare.end_date ? `${compare.start_date} -> ${compare.end_date}` : '',
    updatedAt: stats.updated_time || '',
    cards: buildRangeMetricCards(stats, compareStats, performanceBodies, violationBodies, taskBodies, noviceBodies),
    detailSections: buildShopDetailSections(stats, summary),
    tasks
  };
}

function buildShopOverviewForRun(run, summary, payload = {}) {
  const preferredShopId = payload.shopId || payload.crawlerShopId || '';
  const homepage = run ? readCrawlerApiBody(run.runDir, '/seller_center/homepage/stats') : null;
  const segments = homepage?.body?.data?.segments || [];
  const byDateRange = value => segments.find(item => Number(item.date_range) === value) || {};
  const todaySeg = byDateRange(0);
  const weekSeg = byDateRange(1);
  const monthSeg = byDateRange(2);
  const performanceBodies = run ? readCrawlerApiBodies(run.runDir, '/seller/growth_center/performance/list') : [];
  const violationBodies = run ? readCrawlerApiBodies(run.runDir, '/seller/growth_center/violation/overview/get') : [];
  const taskBodies = run ? readCrawlerApiBodies(run.runDir, '/seller/tasks/config/get') : [];
  const noviceBodies = run ? readCrawlerApiBodies(run.runDir, '/seller/growth_center/novice/record/get') : [];
  const ranges = [
    rangeDescriptor('today', 'Hôm nay', todaySeg.interval, todaySeg.compare_to_interval, performanceBodies, violationBodies, taskBodies, noviceBodies, summary),
    rangeDescriptor('yesterday', 'Hôm qua', todaySeg.compare_to_interval, {}, performanceBodies, violationBodies, taskBodies, noviceBodies, summary),
    rangeDescriptor('last7', '7 ngày qua', weekSeg.interval, weekSeg.compare_to_interval, performanceBodies, violationBodies, taskBodies, noviceBodies, summary),
    rangeDescriptor('month', 'Tháng', monthSeg.interval, monthSeg.compare_to_interval, performanceBodies, violationBodies, taskBodies, noviceBodies, summary),
    rangeDescriptor('custom', 'Tùy chọn', weekSeg.interval, weekSeg.compare_to_interval, performanceBodies, violationBodies, taskBodies, noviceBodies, summary)
  ];
  const defaultRange = ranges.find(item => item.key === 'last7' && item.rangeLabel) || ranges.find(item => item.rangeLabel) || ranges[0];
  return {
    ok: Boolean(homepage),
    shopId: run?.shopId || preferredShopId || '',
    sellerId: run?.latest?.sellerId || payload.sellerId || '',
    runId: run?.latest?.runId || path.basename(run?.runDir || ''),
    runDir: run?.runDir || '',
    endpoint: homepage?.log?.url || '',
    defaultRangeKey: defaultRange.key,
    rangeLabel: defaultRange.rangeLabel || 'Chưa có dữ liệu crawler',
    compareLabel: defaultRange.compareLabel || '',
    updatedAt: defaultRange.updatedAt || '',
    cards: defaultRange.cards,
    ranges,
    availableStartDate: ranges.map(item => item.startDate).filter(Boolean).sort()[0] || '',
    availableEndDate: ranges.map(item => item.endDate).filter(Boolean).sort().at(-1) || '',
    availableMonths: [...new Set(ranges.map(item => String(item.startDate || '').slice(0, 7)).filter(Boolean))],
    crawlerSummary: run?.latest?.summary || null,
    notes: homepage
      ? ['KPI shop lấy từ API Seller Center homepage/stats, Growth Center performance và violation overview.', 'Các ô chưa có dữ liệu sẽ hiển thị -- để tránh suy đoán sai.']
      : ['Chưa tìm thấy dữ liệu crawler Seller Center. Dashboard dùng tạm dữ liệu file đã nạp nếu có.']
  };
}

function buildShopOverviewFromCrawler(rootDir, summary, payload = {}) {
  const preferredShopId = payload.shopId || payload.crawlerShopId || '';
  const run = findLatestSellerCenterRun(rootDir, preferredShopId);
  return buildShopOverviewForRun(run, summary, payload);
}

export function buildAllShopOverviewsFromCrawler(rootDir, summary = {}, payload = {}) {
  const preferredShopId = payload.shopId || payload.crawlerShopId || '';
  const runs = listLatestSellerCenterRuns(rootDir, preferredShopId);
  if (!runs.length) return [buildShopOverviewFromCrawler(rootDir, summary, payload)];
  return runs.map(run => buildShopOverviewForRun(run, summary, payload));
}

function buildBusinessLogicReport(summary, grouped) {
  return {
    title: 'Logic phân tích kinh doanh',
    steps: [
      {
        label: 'Crawler Seller Center',
        detail: 'Lấy KPI native của shop như GMV, lượng đơn, khách truy cập, số món bán ra và kỳ so sánh.'
      },
      {
        label: 'File XLSX/CSV nạp vào',
        detail: 'Bổ sung dữ liệu Ads GMV Max, chi phí ads thực tế, video/KOC, quyết toán, đơn hàng, giá vốn và affiliate.'
      },
      {
        label: 'Chuẩn hóa & mapping',
        detail: 'Chuẩn hóa tên cột, map SKU/sản phẩm với bảng giá, gom dữ liệu theo nhóm order/ads/content/settlement.'
      },
      {
        label: 'Tính P&L',
        detail: 'Doanh thu - giá vốn - mẫu/ship affiliate - chi phí ads - phí cấu hình - chi phí cố định = lợi nhuận ước tính.'
      }
    ],
    sourceRows: {
      uploadedRows: Object.fromEntries(Object.entries(grouped).map(([key, rows]) => [key, rows.length])),
      crawlerRunId: summary.shopOverview?.runId || '',
      crawlerEndpoint: summary.shopOverview?.endpoint || ''
    }
  };
}

function clampNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeMetricDefinition(input = {}, index = 0) {
  const key = String(input.key || `metric_${index + 1}`)
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || `metric_${index + 1}`;
  const mode = ['path', 'aggregate', 'formula'].includes(input.mode) ? input.mode : 'path';
  const format = ['money', 'number', 'percent', 'decimal', 'text'].includes(input.format) ? input.format : 'number';
  const op = ['sum', 'count', 'avg', 'first', 'min', 'max'].includes(input.op) ? input.op : 'sum';
  const fileType = FILE_TYPES.has(input.fileType) && input.fileType !== 'auto' ? input.fileType : 'orders';
  return {
    key,
    section: String(input.section || 'custom').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 80) || 'custom',
    sectionTitle: String(METRIC_TEXT_MIGRATIONS.sectionTitle[input.sectionTitle] || input.sectionTitle || 'Custom').slice(0, 80),
    sectionKind: input.sectionKind === 'kpi' ? 'kpi' : 'list',
    label: String(METRIC_TEXT_MIGRATIONS.label[input.label] || input.label || key).slice(0, 120),
    format,
    mode,
    path: String(input.path || '').slice(0, 180),
    fileType,
    op,
    valueColumns: Array.isArray(input.valueColumns)
      ? input.valueColumns.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20)
      : String(input.valueColumns || '').split(/[,|\n]/).map(item => item.trim()).filter(Boolean).slice(0, 20),
    rowStart: clampNumber(input.rowStart, 0, 1000000, 0),
    rowEnd: clampNumber(input.rowEnd, 0, 1000000, 0),
    rowNumber: clampNumber(input.rowNumber, 0, 1000000, 0),
    filterColumn: String(input.filterColumn || '').slice(0, 120),
    filterContains: String(input.filterContains || '').slice(0, 180),
    formula: String(input.formula || '').slice(0, 500),
    visible: input.visible !== false
  };
}

function normalizeMetricDefinitions(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_METRIC_DEFINITIONS;
  return source.map((item, index) => normalizeMetricDefinition(item, index)).slice(0, 120);
}

function normalizeBusinessCalculationRules(input = {}) {
  const raw = { ...DEFAULT_CALCULATION_RULES, ...(input || {}) };
  const bool = value => value === true || value === 'true' || value === 1 || value === '1';
  return {
    version: 1,
    revenueMode: REVENUE_MODES.has(raw.revenueMode) ? raw.revenueMode : DEFAULT_CALCULATION_RULES.revenueMode,
    adsCreditRatioPct: clampNumber(raw.adsCreditRatioPct, 0, 100, DEFAULT_CALCULATION_RULES.adsCreditRatioPct),
    includeProductCost: bool(raw.includeProductCost),
    includeAffiliateSampleCost: bool(raw.includeAffiliateSampleCost),
    includeAffiliateShipping: bool(raw.includeAffiliateShipping),
    includeAdsActualCost: bool(raw.includeAdsActualCost),
    marketplaceFeePct: clampNumber(raw.marketplaceFeePct, 0, 100, 0),
    paymentFeePct: clampNumber(raw.paymentFeePct, 0, 100, 0),
    operationFeePct: clampNumber(raw.operationFeePct, 0, 100, 0),
    fixedCost: clampNumber(raw.fixedCost, 0, 999999999999, 0),
    targetGrowthPct: clampNumber(raw.targetGrowthPct, 0, 500, DEFAULT_CALCULATION_RULES.targetGrowthPct),
    minRoiOverride: clampNumber(raw.minRoiOverride, 0, 999, 0),
    skuProfitFeePct: clampNumber(raw.skuProfitFeePct, 0, 100, 0),
    metricDefinitions: normalizeMetricDefinitions(raw.metricDefinitions),
    updatedAt: raw.updatedAt || ''
  };
}

function businessRulesPath(rootDir) {
  return path.join(rootDir, 'data', 'business', 'calculation-rules.json');
}

export function getBusinessCalculationRules(rootDir = process.cwd()) {
  try {
    const file = businessRulesPath(rootDir);
    if (!fs.existsSync(file)) return normalizeBusinessCalculationRules();
    return normalizeBusinessCalculationRules(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return normalizeBusinessCalculationRules();
  }
}

export function saveBusinessCalculationRules(rootDir = process.cwd(), rules = {}) {
  const normalized = normalizeBusinessCalculationRules({
    ...rules,
    updatedAt: new Date().toISOString()
  });
  const file = businessRulesPath(rootDir);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  return normalized;
}

function rowMap(row) {
  const map = new Map();
  for (const [key, value] of Object.entries(row || {})) {
    map.set(normalizeText(key), value);
  }
  return map;
}

function valueByHeader(row, candidates = []) {
  const map = rowMap(row);
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (map.has(normalized)) return map.get(normalized);
  }
  for (const [key, value] of map.entries()) {
    if (candidates.some(candidate => {
      const words = normalizeText(candidate).split(/\s+/).filter(Boolean);
      return words.length && words.every(word => key.includes(word));
    })) return value;
  }
  return '';
}

function firstText(row, candidates) {
  return String(valueByHeader(row, candidates) ?? '').trim();
}

function firstMoney(row, candidates) {
  return parseMoney(valueByHeader(row, candidates));
}

function firstNumber(row, candidates) {
  return parseNumber(valueByHeader(row, candidates));
}

function classifyFile(name = '', type = 'auto') {
  if (FILE_TYPES.has(type) && type !== 'auto') return type;
  const n = normalizeText(name);
  if (n.includes('creative data') || n.includes('gmv max')) return 'gmvMaxCreative';
  if (n.includes('batchedit') || n.includes('batch edit') || n.includes('product')) return 'product';
  if (n.includes('income')) return 'income';
  if (n.includes('onhold') || n.includes('on hold')) return 'onhold';
  if (n.includes('affiliate')) return 'affiliate';
  if (n.includes('video list')) return 'video';
  if (n.includes('creator list')) return 'creator';
  if (n.startsWith('cost ')) return 'adsActual';
  if (n.includes('ads') || n.includes('ad cost') || n.includes('campaign')) return 'adsActual';
  if (n.includes('tat ca don hang') || n.includes('all order') || n.includes('orders')) return 'orders';
  return 'orders';
}

function excelCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (value.text !== undefined) return value.text;
  if (value.result !== undefined) return value.result;
  if (value.richText) return value.richText.map(part => part.text || '').join('');
  if (value.hyperlink && value.text) return value.text;
  return String(value);
}

async function workbookFromBuffer(buffer, fileName) {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`${fileName} is too large. Limit is ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB per file.`);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function worksheetToMatrix(sheet) {
  const matrix = [];
  sheet.eachRow({ includeEmpty: true }, row => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = excelCellValue(cell.value);
    });
    matrix.push(values);
  });
  return matrix;
}

async function workbookRowsFromBuffer(buffer, fileName, fileType = 'auto') {
  const workbook = await workbookFromBuffer(buffer, fileName);
  const rows = [];
  const sheetNames = fileType === 'product'
    ? [workbook.worksheets.find(sheet => normalizeText(sheet.name) === 'template')?.name || workbook.worksheets[0]?.name].filter(Boolean)
    : workbook.worksheets.map(sheet => sheet.name);
  for (const sheetName of sheetNames) {
    const sheet = workbook.getWorksheet(sheetName);
    const jsonRows = rowsFromSheet(sheet);
    for (const row of jsonRows) rows.push({ ...row, __sheet: sheetName, __file: fileName });
  }
  return rows;
}

function rowsFromSheet(sheet) {
  const matrix = worksheetToMatrix(sheet);
  return rowsFromMatrix(matrix);
}

function rowsFromMatrix(matrix = []) {
  const headerIdx = detectHeaderRow(matrix);
  if (headerIdx === -1) return matrix
    .map(row => Object.fromEntries(row.map((cell, index) => [`__EMPTY_${index}`, cell ?? ''])))
    .filter(row => Object.values(row).some(value => String(value ?? '').trim()));
  const headers = matrix[headerIdx].map((cell, idx) => String(cell || `__EMPTY_${idx}`).trim() || `__EMPTY_${idx}`);
  const rows = [];
  for (const row of matrix.slice(headerIdx + 1)) {
    const obj = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const value = row[idx] ?? '';
      if (String(value).trim()) hasValue = true;
      obj[header] = value;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

function parseDelimitedLine(line, delimiter = ',') {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseDelimitedMatrix(text, delimiter = ',') {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => parseDelimitedLine(line, delimiter));
}

function rowsFromDelimitedText(text, fileName) {
  const delimiter = /\.tsv$/i.test(fileName) ? '\t' : ',';
  return rowsFromMatrix(parseDelimitedMatrix(text, delimiter));
}

function detectHeaderRow(matrix) {
  const limit = Math.min(matrix.length, 30);
  for (let i = 0; i < limit; i += 1) {
    const cells = (matrix[i] || []).map(normalizeText).filter(Boolean);
    const score = cells.reduce((sum, cell) => {
      return sum + (HEADER_HINTS.some(hint => {
        const normalizedHint = normalizeText(hint);
        return cell === normalizedHint || cell.includes(normalizedHint);
      }) ? 1 : 0);
    }, 0);
    if (score >= 2) return i;
  }
  return -1;
}

async function worksheetMatrixFromBuffer(buffer, fileName = 'price.xlsx') {
  const workbook = await workbookFromBuffer(buffer, fileName);
  const sheet = workbook.worksheets[0];
  return sheet ? worksheetToMatrix(sheet) : [];
}

async function loadGoogleSheetMatrix(sheetUrl, warnings) {
  const url = String(sheetUrl || '').trim();
  if (!url) return [];
  try {
    const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) throw new Error('Invalid Google Sheet URL.');
    const gid = (url.match(/[?#&]gid=(\d+)/) || [])[1] || '0';
    const csvUrls = [
      `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${gid}`
    ];
    let text = '';
    let lastError = '';
    for (const csvUrl of csvUrls) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(csvUrl);
        if (response.ok) {
          text = await response.text();
          break;
        }
        lastError = `Google Sheet export failed: ${response.status}`;
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      if (text) break;
    }
    if (!text) throw new Error(lastError || 'Google Sheet export failed.');
    return parseDelimitedMatrix(text, ',');
  } catch (error) {
    warnings.push(`Không đọc được Google Sheet giá gốc: ${error.message}`);
    return [];
  }
}

function buildPriceMapFromMatrix(matrix = []) {
  const map = new Map();
  for (const row of matrix) {
    const name = String(row?.[0] ?? '').trim();
    const cost = parseMoney(row?.[7]);
    if (!name || !cost) continue;
    const key = compactKey(name);
    if (!key || ['tensanpham', 'sanpham', 'productname', 'name'].includes(key)) continue;
    map.set(key, { name, cost });
  }
  return map;
}

function priceCachePath(rootDir) {
  return path.join(rootDir, 'data', 'business', 'price-cache.json');
}

function readPriceCache(rootDir, warnings) {
  try {
    const filePath = priceCachePath(rootDir);
    if (!fs.existsSync(filePath)) return new Map();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const map = new Map();
    for (const item of data.items || []) {
      if (!item.key || !item.name || !item.cost) continue;
      map.set(item.key, { name: item.name, cost: Number(item.cost) || 0 });
    }
    if (map.size) warnings.push(`Đang dùng cache giá gốc offline cập nhật lúc ${data.updatedAt || 'không rõ thời gian'}.`);
    return map;
  } catch (error) {
    warnings.push(`Không đọc được cache giá gốc offline: ${error.message}`);
    return new Map();
  }
}

function writePriceCache(rootDir, priceMap, source) {
  if (!rootDir || !priceMap?.size) return;
  const filePath = priceCachePath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const items = [...priceMap.entries()].map(([key, item]) => ({ key, name: item.name, cost: item.cost }));
  fs.writeFileSync(filePath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source,
    items
  }, null, 2));
}

function findCost(priceMap, ...names) {
  const normalized = names.map(compactKey).filter(Boolean);
  for (const name of normalized) {
    if (priceMap.has(name)) return priceMap.get(name);
  }
  for (const name of normalized) {
    for (const [key, item] of priceMap.entries()) {
      if (name.length >= 8 && key.includes(name)) return item;
      if (key.length >= 8 && name.includes(key)) return item;
    }
  }
  return null;
}

function aliasKey(kind, value) {
  const key = compactKey(value);
  return key ? `${kind}:${key}` : '';
}

function setAlias(aliasMap, kind, value, priceItem) {
  const key = aliasKey(kind, value);
  if (key && priceItem?.cost) aliasMap.set(key, priceItem);
}

function valueByAnyHeader(row, candidates = []) {
  return String(valueByHeader(row, candidates) ?? '').trim();
}

function looksLikeProductInstructionRow(row) {
  const productId = compactKey(valueByAnyHeader(row, ['product_id', 'product id']));
  const productName = compactKey(valueByAnyHeader(row, ['product_name', 'product name', 'ten san pham']));
  const skuId = compactKey(valueByAnyHeader(row, ['sku_id', 'sku id']));
  const sellerSku = compactKey(valueByAnyHeader(row, ['seller_sku', 'seller sku', 'sku nguoi ban']));
  if (!productName && !skuId && !sellerSku) return true;
  return [
    'v3',
    'idsanpham',
    'tensanpham',
    'batbuoc',
    'khongthechinhsua',
    'metric',
    'text'
  ].includes(productId) || [
    'metric',
    'tensanpham',
    'batbuoc',
    'khongthechinhsua'
  ].includes(productName);
}

function mergeDedup(rows, preferredKeys = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const keyValue = preferredKeys.map(key => String(valueByHeader(row, [key]) || '').trim()).find(Boolean);
    const key = keyValue ? `${preferredKeys.join('|')}:${keyValue}` : JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function ingestFiles(files = []) {
  const grouped = Object.fromEntries([...FILE_TYPES].filter(type => type !== 'auto').map(type => [type, []]));
  const fileSummary = [];
  for (const file of files || []) {
    const name = file.name || 'uploaded-file';
    const type = classifyFile(name, file.type);
    const buffer = Buffer.from(String(file.contentBase64 || ''), 'base64');
    const rows = /\.(csv|tsv|txt)$/i.test(name)
      ? rowsFromDelimitedText(buffer.toString('utf8'), name).map(row => ({ ...row, __sheet: 'text', __file: name }))
      : await workbookRowsFromBuffer(buffer, name, type);
    grouped[type].push(...rows);
    fileSummary.push({ name, requestedType: file.type || 'auto', type, rows: rows.length });
  }
  const deduped = {
    product: mergeDedup(grouped.product, ['product id', 'sku id', 'seller sku']),
    income: mergeDedup(grouped.income, ['order id', 'transaction id']),
    onhold: mergeDedup(grouped.onhold, ['order id', 'transaction id']),
    orders: mergeDedup(grouped.orders, ['order id', 'sku id']),
    affiliate: mergeDedup(grouped.affiliate, ['order id', 'sku id']),
    adsActual: mergeDedup(grouped.adsActual, ['campaign id', 'campaign name', 'date']),
    gmvMaxCreative: mergeDedup(grouped.gmvMaxCreative, ['campaign id', 'ad id', 'date']),
    video: mergeDedup(grouped.video, ['video id', 'content id', 'video link']),
    creator: mergeDedup(grouped.creator, ['creator id', 'creator name'])
  };
  return { grouped: deduped, fileSummary };
}

function buildProductCatalog(rows, priceMap) {
  const items = [];
  const unmatched = [];
  const aliasMap = new Map();
  for (const row of rows) {
    if (looksLikeProductInstructionRow(row)) continue;
    const productName = firstText(row, ['product_name', 'product name', 'ten san pham', 'san pham', 'product']);
    const skuName = firstText(row, ['variation_value', 'sku name', 'ten phan loai', 'variation', 'sku']);
    const sellerSku = firstText(row, ['seller_sku', 'seller sku', 'sku nguoi ban']);
    const productId = firstText(row, ['product_id', 'product id', 'item id', 'spu id']);
    const skuId = firstText(row, ['sku_id', 'sku id', 'seller sku id']);
    const priceItem = findCost(priceMap, sellerSku, productName, skuName);
    const item = {
      productName,
      skuName,
      sellerSku,
      productId,
      skuId,
      matchedCostName: priceItem?.name || '',
      unitCost: priceItem?.cost || 0
    };
    items.push(item);
    if (priceItem?.cost) {
      setAlias(aliasMap, 'productId', productId, priceItem);
      setAlias(aliasMap, 'skuId', skuId, priceItem);
      setAlias(aliasMap, 'sellerSku', sellerSku, priceItem);
      setAlias(aliasMap, 'name', productName, priceItem);
      setAlias(aliasMap, 'name', skuName, priceItem);
    } else if (productName || skuName || sellerSku) {
      unmatched.push(item);
    }
  }
  return { items, unmatched, aliasMap };
}

function findCostForRow(row, priceMap, aliasMap) {
  const productId = firstText(row, ['product_id', 'product id', 'item id', 'spu id']);
  const skuId = firstText(row, ['sku_id', 'sku id', 'seller sku id']);
  const sellerSku = firstText(row, ['seller_sku', 'seller sku', 'sku nguoi ban']);
  const productName = firstText(row, ['product_name', 'product name', 'ten san pham', 'item name']);
  const skuName = firstText(row, ['variation_value', 'sku name', 'ten phan loai', 'seller sku', 'sku']);
  const aliases = [
    aliasKey('skuId', skuId),
    aliasKey('productId', productId),
    aliasKey('sellerSku', sellerSku),
    aliasKey('name', skuName),
    aliasKey('name', productName)
  ].filter(Boolean);
  for (const key of aliases) {
    if (aliasMap?.has(key)) return aliasMap.get(key);
  }
  return findCost(priceMap, sellerSku, skuName, productName);
}

function looksLikeOrderInstructionRow(row) {
  const orderId = normalizeText(firstText(row, ['order id', 'ma don hang', 'id don hang', 'don hang id']));
  const skuId = normalizeText(firstText(row, ['sku id', 'id sku']));
  const quantity = normalizeText(valueByHeader(row, ['quantity', 'so luong']));
  return orderId.includes('platform unique order id')
    || skuId.includes('platform sku id')
    || quantity.includes('sku sold quantity');
}

function summarizeOrders(rows, priceMap, aliasMap) {
  let revenue = 0;
  let units = 0;
  let productCost = 0;
  const orderIds = new Set();
  const bySku = new Map();
  for (const row of rows) {
    if (looksLikeOrderInstructionRow(row)) continue;
    const orderId = firstText(row, ['order id', 'ma don hang', 'don hang id']);
    const productName = firstText(row, ['product_name', 'product name', 'ten san pham', 'item name']);
    const skuName = firstText(row, ['variation_value', 'sku name', 'ten phan loai', 'seller sku', 'sku']);
    const qty = firstNumber(row, ['quantity', 'qty', 'so luong', 'sku quantity']) || 1;
    const amount = firstMoney(row, ['order amount', 'buyer paid', 'payment amount', 'sku subtotal', 'total amount', 'gmv', 'doanh thu', 'tong tien']);
    const costItem = findCostForRow(row, priceMap, aliasMap);
    revenue += amount;
    units += qty;
    productCost += qty * (costItem?.cost || 0);
    if (orderId) orderIds.add(orderId);
    const skuKey = compactKey(skuName || productName || 'unknown');
    const current = bySku.get(skuKey) || { skuName: skuName || productName || 'Unknown', units: 0, revenue: 0, cost: 0 };
    current.units += qty;
    current.revenue += amount;
    current.cost += qty * (costItem?.cost || 0);
    bySku.set(skuKey, current);
  }
  return {
    revenue,
    orders: orderIds.size || rows.length,
    units,
    productCost,
    topSkus: [...bySku.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  };
}

function summarizeSettlement(rows) {
  let amount = 0;
  for (const row of rows) {
    amount += firstMoney(row, ['settlement amount', 'settled amount', 'income', 'amount', 'so tien', 'tien da quyet toan', 'estimated settlement']);
  }
  return { amount, rows: rows.length };
}

function summarizeAffiliate(rows, priceMap, aliasMap) {
  let sampleUnits = 0;
  let sampleCost = 0;
  let shipping = 0;
  for (const row of rows) {
    const productName = firstText(row, ['product_name', 'product name', 'ten san pham', 'item name']);
    const skuName = firstText(row, ['variation_value', 'sku name', 'seller sku', 'sku']);
    const qty = firstNumber(row, ['quantity', 'qty', 'sample quantity', 'so luong']) || 1;
    const ship = firstMoney(row, ['shipping fee', 'shipping', 'ship', 'phi van chuyen', 'tien ship']);
    const costItem = findCostForRow(row, priceMap, aliasMap);
    sampleUnits += qty;
    shipping += ship;
    sampleCost += qty * (costItem?.cost || 0);
  }
  return { sampleUnits, sampleCost, shipping, rows: rows.length };
}

function isGmvMax(row) {
  const haystack = normalizeText([
    firstText(row, ['campaign name', 'ten chien dich', 'campaign type', 'objective', 'type']),
    firstText(row, ['ad group name', 'ad name'])
  ].join(' '));
  return haystack.includes('gmv')
    || haystack.includes('product gmv max')
    || haystack.includes('max doanh thu')
    || haystack.includes('api s')
    || haystack.includes('api e')
    || haystack.includes('stonkagency');
}

function campaignKeys(row) {
  const id = firstText(row, ['campaign id', 'id chien dich']);
  const name = firstText(row, ['campaign name', 'ten chien dich']);
  return [aliasKey('campaignId', id), aliasKey('campaignName', name)].filter(Boolean);
}

function buildGmvCampaignIndex(rows) {
  const keys = new Set();
  for (const row of rows) {
    for (const key of campaignKeys(row)) keys.add(key);
  }
  return keys;
}

function isGmvMaxCostRow(row, gmvCampaignIndex) {
  if (gmvCampaignIndex?.size) {
    return campaignKeys(row).some(key => gmvCampaignIndex.has(key));
  }
  return isGmvMax(row);
}

function summarizeAdsActual(rows, adsCreditRatio = 0, gmvCampaignIndex = new Set()) {
  let cash = 0;
  let credit = 0;
  let adsCreditDirect = 0;
  let adsCreditProrated = 0;
  let skippedNonGmv = 0;
  let rowsUsed = 0;
  const ratio = Math.max(0, Math.min(1, Number(adsCreditRatio) || 0));
  const hasCampaignIndexMatch = Boolean(gmvCampaignIndex?.size)
    && rows.some(row => campaignKeys(row).some(key => gmvCampaignIndex.has(key)));
  for (const row of rows) {
    if (!(hasCampaignIndexMatch ? isGmvMaxCostRow(row, gmvCampaignIndex) : isGmvMax(row))) {
      skippedNonGmv += 1;
      continue;
    }
    const cashValue = Math.abs(firstMoney(row, ['cash cost', 'cash']));
    const creditValue = Math.abs(firstMoney(row, ['credit cost', 'credit']));
    const adsCreditValue = Math.abs(firstMoney(row, ['ad credit cost', 'ads credit', 'ad credit']));
    cash += cashValue;
    credit += creditValue;
    if (adsCreditValue && (cashValue || creditValue)) adsCreditDirect += adsCreditValue;
    else if (adsCreditValue) adsCreditProrated += adsCreditValue * ratio;
    rowsUsed += 1;
  }
  return {
    cash,
    credit,
    adsCreditDirect,
    adsCreditProrated,
    actualCost: cash + credit + adsCreditDirect + adsCreditProrated,
    rowsUsed,
    skippedNonGmv,
    adsCreditRatio: ratio,
    matchMode: hasCampaignIndexMatch ? 'creative-campaign-id' : 'campaign-name-pattern'
  };
}

function summarizeGmvCreative(rows) {
  let costWithDiscount = 0;
  let gmv = 0;
  let orders = 0;
  let impressions = 0;
  let clicks = 0;
  for (const row of rows) {
    costWithDiscount += firstMoney(row, ['cost', 'total cost', 'spend', 'chi phi']);
    gmv += firstMoney(row, ['gmv', 'gross revenue', 'doanh thu']);
    orders += firstNumber(row, ['orders', 'order', 'don']);
    impressions += firstNumber(row, ['impressions', 'impression', 'hien thi']);
    clicks += firstNumber(row, ['clicks', 'click']);
  }
  return {
    costWithDiscount,
    gmv,
    orders,
    impressions,
    clicks,
    roi: costWithDiscount ? gmv / costWithDiscount : 0,
    rows: rows.length
  };
}

function summarizeContent(rows, kind) {
  const items = rows.map(row => ({
    name: firstText(row, kind === 'video'
      ? ['ten video', 'video name', 'video title', 'content name', 'title']
      : ['ten nguoi dung cua nha sang tao', 'creator name', 'name', 'nickname']),
    gmv: firstMoney(row, ['gmv', 'revenue', 'doanh thu']),
    orders: firstNumber(row, ['don hang lien ket', 'orders', 'order', 'don']),
    views: firstNumber(row, ['luot hien thi san pham', 'luot hien thi cua video link ban hang', 'views', 'view', 'video views']),
    cost: firstMoney(row, ['hoa hong uoc tinh', 'phi co dinh uoc tinh', 'cost', 'commission', 'chi phi'])
  }));
  return {
    rows: rows.length,
    activeRows: items.filter(item => item.gmv || item.orders || item.views || item.cost).length,
    gmv: items.reduce((sum, item) => sum + item.gmv, 0),
    orders: items.reduce((sum, item) => sum + item.orders, 0),
    views: items.reduce((sum, item) => sum + item.views, 0),
    top: items.filter(item => item.name).sort((a, b) => b.gmv - a.gmv).slice(0, 10)
  };
}

function buildPlan(summary, payload = {}, rules = normalizeBusinessCalculationRules()) {
  const hasPayloadGrowth = payload.targetGrowthPct !== undefined && payload.targetGrowthPct !== null && String(payload.targetGrowthPct).trim() !== '';
  const growthPct = hasPayloadGrowth ? Number(payload.targetGrowthPct) : rules.targetGrowthPct;
  const growth = Math.max(0, growthPct / 100);
  const revenueBase = summary.kpis.revenue || summary.ads.gmvMax.gmv || 0;
  const targetRevenue = revenueBase * (1 + growth);
  const currentRoi = summary.ads.actual.actualCost ? revenueBase / summary.ads.actual.actualCost : summary.ads.gmvMax.roi;
  const grossMarginRate = revenueBase ? Math.max(0, (revenueBase - summary.costs.productCost) / revenueBase) : 0;
  const computedBreakEvenRoi = grossMarginRate ? 1 / grossMarginRate : 0;
  const breakEvenRoi = rules.minRoiOverride > 0 ? rules.minRoiOverride : computedBreakEvenRoi;
  const suggestedAdsBudget = currentRoi ? targetRevenue / Math.max(currentRoi, breakEvenRoi || currentRoi) : summary.ads.actual.actualCost * (1 + growth);
  const topSkus = summary.orders.topSkus.slice(0, 5);
  return {
    period: payload.nextPeriodLabel || 'Tháng/Quý tới',
    targetRevenue,
    suggestedAdsBudget,
    breakEvenRoi,
    currentRoi,
    grossMarginRate,
    actions: [
      `Đặt mức doanh thu mục tiêu ${formatMoney(targetRevenue)} VND (${Math.round(growth * 100)}% tăng trưởng).`,
      `Giữ ROI GMV Max tối thiểu ${breakEvenRoi ? breakEvenRoi.toFixed(2) : 'N/A'} để không phá biên lợi nhuận gộp.`,
      `Ngân sách ads gợi ý: ${formatMoney(suggestedAdsBudget)} VND, ưu tiên campaign GMV Max có SKU lợi nhuận tốt.`,
      `Kiểm tra ${summary.productCatalog.unmatched.length} SKU/sản phẩm chưa map được giá nhập trước khi chốt P&L.`,
      `Tập trung KOC/video có GMV cao, cắt mẫu gửi nếu không có doanh thu sau chu kỳ test.`
    ],
    focusSkus: topSkus.map(item => ({
      skuName: item.skuName,
      revenue: item.revenue,
      units: item.units,
      grossProfit: item.revenue - item.cost - (item.revenue * (rules.skuProfitFeePct / 100))
    }))
  };
}

function selectBusinessRevenue(rules, orders, income, onhold, gmvMax) {
  const orderRevenue = orders.revenue || 0;
  const settlementRevenue = (income.amount || 0) + (onhold.amount || 0);
  const gmvMaxRevenue = gmvMax.gmv || 0;
  if (rules.revenueMode === 'orders') return { revenue: orderRevenue, source: 'orders' };
  if (rules.revenueMode === 'settlement') return { revenue: settlementRevenue, source: 'settlement' };
  if (rules.revenueMode === 'gmvMax') return { revenue: gmvMaxRevenue, source: 'gmvMax' };
  if (orderRevenue) return { revenue: orderRevenue, source: 'orders' };
  if (settlementRevenue) return { revenue: settlementRevenue, source: 'settlement' };
  return { revenue: gmvMaxRevenue, source: 'gmvMax' };
}

function getPathValue(source, pathExpression = '') {
  if (!pathExpression) return 0;
  const parts = String(pathExpression).split('.').filter(Boolean);
  let value = source;
  for (const part of parts) {
    if (value == null) return 0;
    value = value[part];
  }
  return value ?? 0;
}

function metricNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return parseMoney(value);
}

function rowsForMetric(grouped, definition) {
  let rows = grouped[definition.fileType] || [];
  if (definition.rowNumber > 0) {
    rows = rows[definition.rowNumber - 1] ? [rows[definition.rowNumber - 1]] : [];
  } else {
    const start = definition.rowStart > 0 ? definition.rowStart - 1 : 0;
    const end = definition.rowEnd > 0 ? definition.rowEnd : rows.length;
    rows = rows.slice(start, end);
  }
  if (definition.filterColumn && definition.filterContains) {
    const needle = normalizeText(definition.filterContains);
    rows = rows.filter(row => normalizeText(valueByHeader(row, [definition.filterColumn])).includes(needle));
  }
  return rows;
}

function computeAggregateMetric(grouped, definition) {
  const rows = rowsForMetric(grouped, definition);
  if (definition.op === 'count') return rows.length;
  const columns = definition.valueColumns.length ? definition.valueColumns : [definition.path].filter(Boolean);
  const values = rows.map(row => {
    const raw = columns.map(column => valueByHeader(row, [column])).find(value => String(value ?? '').trim() !== '');
    return metricNumber(raw);
  });
  if (!values.length) return 0;
  if (definition.op === 'first') return values[0];
  if (definition.op === 'min') return Math.min(...values);
  if (definition.op === 'max') return Math.max(...values);
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (definition.op === 'avg') return sum / values.length;
  return sum;
}

function computeFormulaMetric(definition, values, summary) {
  const expression = String(definition.formula || '').trim();
  if (!expression) return 0;
  if (!/^[A-Za-z0-9_.$\s+\-*/()%]+$/.test(expression)) return 0;
  const tokens = [...new Set(expression.match(/\b[A-Za-z_][A-Za-z0-9_.]*\b/g) || [])];
  const params = [];
  let compiled = expression;
  tokens.forEach((token, index) => {
    const param = `v${index}`;
    const raw = Object.prototype.hasOwnProperty.call(values, token) ? values[token] : getPathValue(summary, token);
    params.push(metricNumber(raw));
    compiled = compiled.replace(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), param);
  });
  try {
    const result = Function(...tokens.map((_, index) => `v${index}`), `"use strict"; return (${compiled});`)(...params);
    return Number.isFinite(Number(result)) ? Number(result) : 0;
  } catch {
    return 0;
  }
}

function computeMetricSections(summary, grouped, definitions = []) {
  const metricValues = {};
  const sections = new Map();
  for (const definition of definitions.filter(item => item.visible !== false)) {
    let value = 0;
    if (definition.mode === 'aggregate') value = computeAggregateMetric(grouped, definition);
    else if (definition.mode === 'formula') value = computeFormulaMetric(definition, metricValues, summary);
    else value = getPathValue(summary, definition.path);
    metricValues[definition.key] = value;
    const sectionKey = definition.section || 'custom';
    const section = sections.get(sectionKey) || {
      key: sectionKey,
      title: definition.sectionTitle || sectionKey,
      kind: definition.sectionKind === 'kpi' ? 'kpi' : 'list',
      items: []
    };
    section.items.push({
      key: definition.key,
      label: definition.label,
      value,
      format: definition.format,
      mode: definition.mode,
      source: definition.mode === 'aggregate'
        ? { fileType: definition.fileType, op: definition.op, valueColumns: definition.valueColumns, rowStart: definition.rowStart, rowEnd: definition.rowEnd, rowNumber: definition.rowNumber, filterColumn: definition.filterColumn, filterContains: definition.filterContains }
        : (definition.mode === 'formula' ? { formula: definition.formula } : { path: definition.path })
    });
    sections.set(sectionKey, section);
  }
  return { metricValues, metricSections: [...sections.values()] };
}

export async function analyzeBusinessInput(payload = {}, options = {}) {
  const warnings = [];
  const rootDir = options.rootDir || process.cwd();
  const savedRules = getBusinessCalculationRules(rootDir);
  const rules = normalizeBusinessCalculationRules({
    ...savedRules,
    ...(payload.calculationRules || {})
  });
  const hasPayloadAdsRatio = payload.adsCreditRatio !== undefined && payload.adsCreditRatio !== null && String(payload.adsCreditRatio).trim() !== '';
  const adsCreditRatio = hasPayloadAdsRatio ? Number(payload.adsCreditRatio || 0) : rules.adsCreditRatioPct / 100;
  const priceMatrixFromFile = payload.priceFile?.contentBase64
    ? await worksheetMatrixFromBuffer(Buffer.from(payload.priceFile.contentBase64, 'base64'), payload.priceFile.name || 'price.xlsx')
    : [];
  const priceMatrixFromSheet = priceMatrixFromFile.length
    ? []
    : await loadGoogleSheetMatrix(payload.priceSheetUrl, warnings);
  let priceMap = buildPriceMapFromMatrix(priceMatrixFromFile.length ? priceMatrixFromFile : priceMatrixFromSheet);
  if (priceMap.size) {
    writePriceCache(rootDir, priceMap, priceMatrixFromFile.length ? 'uploaded-price-file' : 'google-sheet');
  } else {
    priceMap = readPriceCache(rootDir, warnings);
  }
  if (!priceMap.size) {
    warnings.push('Chưa có bảng giá gốc. Hãy upload file giá gốc hoặc mở mạng một lần để app cache Google Sheet.');
  }

  const { grouped, fileSummary } = await ingestFiles(payload.files || []);
  const productCatalogData = buildProductCatalog(grouped.product, priceMap);
  const productAliasMap = productCatalogData.aliasMap;
  const productCatalog = {
    items: productCatalogData.items,
    unmatched: productCatalogData.unmatched,
    aliasCount: productAliasMap.size
  };
  const orders = summarizeOrders(grouped.orders, priceMap, productAliasMap);
  const income = summarizeSettlement(grouped.income);
  const onhold = summarizeSettlement(grouped.onhold);
  const gmvMax = summarizeGmvCreative(grouped.gmvMaxCreative);
  const gmvCampaignIndex = buildGmvCampaignIndex(grouped.gmvMaxCreative);
  const affiliate = summarizeAffiliate(grouped.affiliate, priceMap, productAliasMap);
  const adsActual = summarizeAdsActual(grouped.adsActual, adsCreditRatio, gmvCampaignIndex);
  const video = summarizeContent(grouped.video, 'video');
  const creator = summarizeContent(grouped.creator, 'creator');

  const revenueSelection = selectBusinessRevenue(rules, orders, income, onhold, gmvMax);
  const revenue = revenueSelection.revenue;
  const productCost = rules.includeProductCost ? orders.productCost : 0;
  const affiliateSampleCost = rules.includeAffiliateSampleCost ? affiliate.sampleCost : 0;
  const affiliateShipping = rules.includeAffiliateShipping ? affiliate.shipping : 0;
  const adsActualCost = rules.includeAdsActualCost ? adsActual.actualCost : 0;
  const marketplaceFee = revenue * (rules.marketplaceFeePct / 100);
  const paymentFee = revenue * (rules.paymentFeePct / 100);
  const operationFee = revenue * (rules.operationFeePct / 100);
  const fixedCost = rules.fixedCost;
  const totalCost = productCost + affiliateSampleCost + affiliateShipping + adsActualCost + marketplaceFee + paymentFee + operationFee + fixedCost;
  const netProfitEstimate = revenue - totalCost;
  const summary = {
    ok: true,
    generatedAt: new Date().toISOString(),
    period: payload.periodLabel || '',
    calculationRules: rules,
    priceRows: priceMap.size,
    fileSummary,
    groupedRows: Object.fromEntries(Object.entries(grouped).map(([key, rows]) => [key, rows.length])),
    kpis: {
      revenue,
      revenueSource: revenueSelection.source,
      settledAmount: income.amount,
      onholdAmount: onhold.amount,
      orders: orders.orders,
      units: orders.units,
      netProfitEstimate,
      netMargin: revenue ? netProfitEstimate / revenue : 0
    },
    costs: {
      productCost,
      rawProductCost: orders.productCost,
      affiliateSampleCost,
      rawAffiliateSampleCost: affiliate.sampleCost,
      affiliateShipping,
      rawAffiliateShipping: affiliate.shipping,
      adsActualCost,
      rawAdsActualCost: adsActual.actualCost,
      marketplaceFee,
      paymentFee,
      operationFee,
      fixedCost,
      totalCost
    },
    orders,
    settlements: { income, onhold },
    affiliate,
    ads: { actual: adsActual, gmvMax },
    content: { video, creator },
    productCatalog,
    warnings
  };
  summary.shopOverviews = buildAllShopOverviewsFromCrawler(rootDir, summary, payload);
  summary.shopOverview = summary.shopOverviews[0] || buildShopOverviewFromCrawler(rootDir, summary, payload);
  summary.businessLogicReport = buildBusinessLogicReport(summary, grouped);
  summary.plan = buildPlan(summary, payload, rules);
  const metrics = computeMetricSections(summary, grouped, rules.metricDefinitions);
  summary.metricValues = metrics.metricValues;
  summary.metricSections = metrics.metricSections;
  return summary;
}
