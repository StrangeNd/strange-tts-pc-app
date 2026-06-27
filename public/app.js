const healthPill = document.querySelector('#healthPill');
const loginPanel = document.querySelector('#loginPanel');
const appPanel = document.querySelector('#appPanel');
const loginForm = document.querySelector('#loginForm');
const passwordForm = document.querySelector('#passwordForm');
const importExtensionForm = document.querySelector('#importExtensionForm');
const statusList = document.querySelector('#statusList');
const extensionList = document.querySelector('#extensionList');
const shopList = document.querySelector('#shopList');
const shopQuickSelect = document.querySelector('#shopQuickSelect');
const workspaceContent = document.querySelector('#workspaceContent');
const outputBox = document.querySelector('#outputBox');
const state = {
  appConfig: {
    cloudSyncUrl: '',
    aiDataUrl: '',
    productViewEnabled: true,
    videoAutoplay: true,
    videoSound: true,
    videoLoop: true
  },
  businessResult: null,
  dashboardOverview: null,
  dashboardRangeKey: '',
  sessionReadiness: {},
  shops: [],
  statusVisible: false
};

const SHOP_SESSION_CONFIRMATION_PREFIX = 'strange-tiktokshop-session-confirmation';
const SHOP_SESSION_STATUSES = [
  { id: 'correct-shop', label: 'Correct shop', detail: 'The opened session matches the selected shop.', opensProfile: true },
  { id: 'wrong-shop', label: 'Wrong shop', detail: 'Stop and switch profile before operating this shop.', opensProfile: false },
  { id: 'not-logged-in', label: 'Not logged in', detail: 'Open the selected profile so the operator can log in.', opensProfile: true },
  { id: 'needs-relogin', label: 'Needs re-login', detail: 'Open the selected profile for manual re-login.', opensProfile: true },
  { id: 'needs-session-restore', label: 'Needs session restore', detail: 'Do not restore here; this requires a future approved PR.', opensProfile: false }
];

function setOutput(value) {
  outputBox.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function setHealth(ok, text) {
  healthPill.classList.toggle('ok', ok);
  healthPill.classList.toggle('err', !ok);
  healthPill.textContent = text;
}

function bindClick(selector, handler) {
  const element = document.querySelector(selector);
  if (element) element.addEventListener('click', handler);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.data = data;
    throw error;
  }
  return data;
}

function renderStatus(status) {
  if (status.appConfig) state.appConfig = { ...state.appConfig, ...status.appConfig };
  const rows = [
    ['Extension', `${status.extensionName} ${status.version}`],
    ['Server', status.host],
    ['Admin mode', `${status.admin.username}${status.admin.mustChangePassword ? ' - cần đổi mật khẩu nếu bật login' : ''}`],
    ['Active package', status.extensionLibrary.active ? `${status.extensionLibrary.active.name} ${status.extensionLibrary.active.version}` : 'none'],
    ['Library count', status.extensionLibrary.count],
    ['Managed browser', status.managedBrowser],
    ['Cookie encryption', status.dataSecurity?.cookieEncryption?.enabled ? `${String(status.dataSecurity.cookieEncryption.algorithm || '').toUpperCase()} - enabled` : 'off'],
    ['Cookie store', status.dataSecurity?.cookieStoreFile],
    ['Audit log', status.dataSecurity?.auditLog],
    ['Runtime extension', status.runtime.runtimeExtensionDir],
    ['Profiles base', status.runtime.profilesBase],
    ['Local sync', state.appConfig.cloudSyncUrl ? 'legacy URL ignored in Phase 0' : 'Phase 0 local backup only'],
    ['External AI Data', state.appConfig.aiDataUrl],
    ['Host permissions', (status.hostPermissions || []).join(', ')]
  ];
  statusList.innerHTML = rows
    .map(([key, value]) => `<dt>${key}</dt><dd>${String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</dd>`)
    .join('');
}

async function refreshAppConfig() {
  const data = await api('/api/app-config');
  state.appConfig = { ...state.appConfig, ...data.config };
  return state.appConfig;
}

async function saveAppConfig(patch) {
  const data = await api('/api/app-config', { method: 'POST', body: patch });
  state.appConfig = { ...state.appConfig, ...data.config };
  return state.appConfig;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function hasMetricValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function formatTimestamp(value) {
  if (!value) return 'Chua co';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('vi-VN');
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function selectedShopContext() {
  const selectedId = shopQuickSelect?.value || '';
  const shop = state.shops.find(item => item.id === selectedId);
  return {
    id: selectedId,
    name: shop?.name || selectedId || '',
    loginNote: shop?.loginNote || '',
    sellerId: shop?.sellerId || '',
    adsAccountId: shop?.adsAccountId || '',
    sellerCenterUrl: shop?.sellerCenterUrl || '',
    sellerAdsUrl: shop?.sellerAdsUrl || '',
    compassUrl: shop?.compassUrl || '',
    gmvMaxUrl: shop?.gmvMaxUrl || '',
    shopHealthStatus: shop?.shopHealthStatus || '',
    productScoreStatus: shop?.productScoreStatus || '',
    cookieCount: Number(shop?.cookieCount || 0),
    cookieStorage: shop?.cookieStorage || 'none',
    cookieUpdatedAt: shop?.cookieUpdatedAt || '',
    label: shop?.name ? `${shop.name} (${shop.id})` : (selectedId || 'Chua chon shop/profile')
  };
}

function shopSessionConfirmationKey(shopId) {
  return `${SHOP_SESSION_CONFIRMATION_PREFIX}:${shopId || 'default'}`;
}

function readShopSessionConfirmation(shopId) {
  try {
    const raw = localStorage.getItem(shopSessionConfirmationKey(shopId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeShopSessionConfirmation(shop, statusId) {
  const status = SHOP_SESSION_STATUSES.find(item => item.id === statusId) || SHOP_SESSION_STATUSES[0];
  const metadata = {
    shopId: shop.id,
    shopName: shop.name || '',
    profileId: shop.id,
    sellerId: shop.sellerId || '',
    adsAccountId: shop.adsAccountId || '',
    status: status.id,
    statusLabel: status.label,
    confirmedAt: new Date().toISOString()
  };
  localStorage.setItem(shopSessionConfirmationKey(shop.id), JSON.stringify(metadata));
  return metadata;
}

function shopById(shopId) {
  return state.shops.find(shop => shop.id === shopId) || null;
}

function confirmationLabel(value) {
  return SHOP_SESSION_STATUSES.find(item => item.id === value)?.label || value || 'No confirmation yet';
}

function sourceLabel(value) {
  const labels = {
    crawler: 'Crawler',
    computed: 'Tinh tu metric',
    pending: 'Chua co nguon',
    orders: 'File don hang',
    settlement: 'File quyet toan',
    gmvMax: 'File GMV Max',
    uploaded: 'File upload',
    cached: 'Cache local',
    'cached-crawler': 'Cache crawler',
    realtime: 'Realtime crawl',
    partial: 'Partial',
    failed: 'Failed',
    missing: 'Missing'
  };
  return labels[value] || value || 'Chua ro';
}

function gmvMaxEntryUrl(shop = {}) {
  if (shop.gmvMaxUrl) {
    try {
      return new URL(shop.gmvMaxUrl).toString();
    } catch {
      // Fall back to the generated local entry URL when metadata is malformed.
    }
  }
  const url = new URL('https://seller-vn.tiktok.com/ads-creation/dashboard');
  const shopId = shop.sellerId || shop.id || '';
  if (shopId) url.searchParams.set('shop_id', shopId);
  if (shop.adsAccountId) url.searchParams.set('aadvid', shop.adsAccountId);
  url.searchParams.set('type', 'product');
  url.searchParams.set('shop_region', shop.region || 'VN');
  url.searchParams.set('list_status', 'delivery_ok');
  url.searchParams.set('list_order_field', 'cost');
  url.searchParams.set('list_order_type', 'descend');
  return url.toString();
}

function gmvMaxShopCard(shop) {
  const confirmation = readShopSessionConfirmation(shop.id);
  const url = gmvMaxEntryUrl(shop);
  const hasSeller = Boolean(shop.sellerId);
  const hasAds = Boolean(shop.adsAccountId);
  const confirmed = confirmation?.status === 'correct-shop';
  return `
    <div class="gmv-shop-card">
      <div class="gmv-shop-card-head">
        <div>
          <strong>${escapeHtml(shop.name || shop.id)}</strong>
          <span>Profile: ${escapeHtml(shop.id)}</span>
        </div>
        <span class="${confirmation?.status === 'correct-shop' ? 'status-chip ok' : 'status-chip'}">${escapeHtml(confirmationLabel(confirmation?.status))}</span>
      </div>
      <dl class="compact-list">
        <dt>Seller ID</dt><dd class="${hasSeller ? '' : 'is-missing'}">${escapeHtml(shop.sellerId || 'Missing')}</dd>
        <dt>Ads account</dt><dd class="${hasAds ? '' : 'is-missing'}">${escapeHtml(shop.adsAccountId || 'Missing')}</dd>
        <dt>GMV Max entry</dt><dd>${escapeHtml(url)}</dd>
      </dl>
      <div class="actions gmv-card-actions">
        <button type="button" data-gmv-profile-check="${escapeHtml(shop.id)}">Check profile</button>
        <button type="button" class="secondary" ${confirmed ? `data-gmv-open-extension="${escapeHtml(shop.id)}"` : `data-gmv-profile-check="${escapeHtml(shop.id)}"`}>${confirmed ? 'Open extension dashboard' : 'Confirm before opening'}</button>
      </div>
    </div>
  `;
}

function renderGmvMaxDashboardWorkspace() {
  const selectedShop = selectedShopContext();
  const shops = state.shops || [];
  const readyCount = shops.filter(shop => shop.sellerId && shop.adsAccountId).length;
  const selected = selectedShop.id ? shops.find(shop => shop.id === selectedShop.id) : null;
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>GMV Max dashboard</h2>
      <p>Read-only shop cards for GMV Max operations. Use the profile check before opening shop-specific work.</p>
    </div>
    <div class="summary-grid gmv-summary">
      <div><strong>${shops.length}</strong><span>Loaded shops</span></div>
      <div><strong>${readyCount}</strong><span>Ready with Seller + Ads IDs</span></div>
      <div><strong>${escapeHtml(selected?.name || 'No selected shop')}</strong><span>Selected profile</span></div>
    </div>
    <div class="gmv-shop-grid">
      ${shops.length ? shops.map(gmvMaxShopCard).join('') : '<p class="hint">No shops loaded yet. Create a shop in Seller Ads first.</p>'}
    </div>
    <div class="actions dashboard-actions">
      <button id="gmvRefreshShops">Refresh shops</button>
      <button id="gmvGoSellerAds" class="secondary">Manage shops</button>
      <button id="gmvOpenBusinessAnalysis" class="secondary">Load GMV Max files</button>
    </div>
  `;
  workspaceContent.querySelectorAll('[data-gmv-profile-check]').forEach(button => {
    button.addEventListener('click', event => renderShopSessionSafety(event.currentTarget.dataset.gmvProfileCheck));
  });
  workspaceContent.querySelectorAll('[data-gmv-open-extension]').forEach(button => {
    button.addEventListener('click', event => openExtensionPage('pages/dashboard.html', event.currentTarget.dataset.gmvOpenExtension));
  });
  bindClick('#gmvRefreshShops', async () => {
    await refreshShops();
    renderGmvMaxDashboardWorkspace();
  });
  bindClick('#gmvGoSellerAds', sellerAdsWorkspace);
  bindClick('#gmvOpenBusinessAnalysis', renderBusinessAnalysisWorkspace);
}

function renderExtensions(library) {
  if (!extensionList) return;
  const activeId = library.activeId;
  extensionList.innerHTML = (library.extensions || []).map(item => `
    <div class="extension-item">
      <div>
        <strong>${escapeHtml(item.name)} ${escapeHtml(item.version)}${item.id === activeId ? ' - active' : ''}</strong>
        <span>${escapeHtml(item.id)} | ${escapeHtml(item.sourceType)} | ${escapeHtml(item.packageDir)}</span>
      </div>
      <button data-extension-id="${escapeHtml(item.id)}" ${item.id === activeId ? 'disabled' : ''}>Dat active</button>
    </div>
  `).join('');
}

function sellerAdsWorkspace() {
  workspaceContent.innerHTML = `
    <form id="sellerAdsForm" class="workspace-content">
      <label>
        Ten shop
        <input name="name" autocomplete="off" required placeholder="VD: Ha Anh Shine">
      </label>
      <label>
        Avatar URL
        <input name="avatar" autocomplete="off" placeholder="https://...">
      </label>
      <label>
        Login note
        <input name="loginNote" autocomplete="off" placeholder="Nguoi phu trach / trang thai dang nhap">
      </label>
      <label>
        Seller ID / Shop ID
        <input name="sellerId" autocomplete="off" placeholder="Neu co thi dien, khong co co the bo trong">
      </label>
      <label>
        Ads Account ID
        <input name="adsAccountId" autocomplete="off" placeholder="Neu co">
      </label>
      <label>
        Seller Center URL
        <input name="sellerCenterUrl" autocomplete="off" placeholder="https://seller-vn.tiktok.com/...">
      </label>
      <label>
        Seller Ads URL
        <input name="sellerAdsUrl" autocomplete="off" placeholder="https://seller-vn.tiktok.com/ads-creation/dashboard">
      </label>
      <label>
        Compass URL
        <input name="compassUrl" autocomplete="off" placeholder="https://seller-vn.tiktok.com/compass/...">
      </label>
      <label>
        GMV Max URL
        <input name="gmvMaxUrl" autocomplete="off" placeholder="https://seller-vn.tiktok.com/ads-creation/dashboard">
      </label>
      <label>
        Shop health status
        <input name="shopHealthStatus" autocomplete="off" placeholder="OK / Can kiem tra / Missing">
      </label>
      <label>
        Product score status
        <input name="productScoreStatus" autocomplete="off" placeholder="OK / Can toi uu / Missing">
      </label>
      <label>
        Import cookies bang file path
        <input name="cookiesPath" autocomplete="off" placeholder="C:\\duong-dan\\cookies.json">
      </label>
      <label>
        Hoac dan JSON cookies
        <textarea class="textarea-input" name="cookiesJson" placeholder='[{"name":"sessionid","value":"...","domain":".tiktok.com"}]'></textarea>
      </label>
      <button type="submit">Tao shop va mo Seller Ads</button>
    </form>
  `;
  document.querySelector('#sellerAdsForm').addEventListener('submit', createSellerAdsShop);
}

function simpleWorkspace(title, body) {
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function checked(value) {
  return value ? 'checked' : '';
}

const OPS_CHECKLIST_ITEMS = [
  {
    id: 'seller-center-health',
    title: 'Kiểm tra tình trạng Seller Center',
    detail: 'Mở Seller Center và xem nhanh cảnh báo, thông báo, điểm cửa hàng.'
  },
  {
    id: 'orders-risk',
    title: 'Kiểm tra đơn hàng cần xử lý',
    detail: 'Ưu tiên đơn sắp quá hạn, đơn lỗi vận chuyển, hủy/hoàn cần phản hồi.'
  },
  {
    id: 'ads-budget',
    title: 'Kiểm tra ngân sách và GMV Max',
    detail: 'Đối chiếu chi tiêu, ROI, camp bật/tắt và shop gần hết ngân sách.'
  },
  {
    id: 'content-live-video',
    title: 'Kiểm tra Live, video và sản phẩm nổi bật',
    detail: 'Xem nội dung đang phân phối, sản phẩm có GMV, CTR hoặc tồn kho bất thường.'
  },
  {
    id: 'listing-quality',
    title: 'Kiểm tra listing và giá',
    detail: 'Soát sản phẩm bị ẩn, lỗi giá, thiếu ảnh, điểm sản phẩm hoặc cơ hội tối ưu.'
  },
  {
    id: 'daily-report',
    title: 'Chốt ghi chú vận hành trong ngày',
    detail: 'Ghi lại việc đã làm, việc cần theo dõi và điểm bất thường để ca sau tiếp tục.'
  }
];

const OPS_CHECKLIST_PREFIX = 'strange-tiktokshop-ops-checklist';

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentShopKey() {
  return shopQuickSelect.value || 'default-profile';
}

function opsChecklistStorageKey() {
  return `${OPS_CHECKLIST_PREFIX}:${currentShopKey()}:${todayKey()}`;
}

function readOpsChecklist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(opsChecklistStorageKey()) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeOpsChecklist(next) {
  localStorage.setItem(opsChecklistStorageKey(), JSON.stringify(next));
}

function renderOpsChecklistWorkspace() {
  const shopId = currentShopKey();
  const checklist = readOpsChecklist();
  const doneCount = OPS_CHECKLIST_ITEMS.filter(item => checklist[item.id]).length;
  const totalCount = OPS_CHECKLIST_ITEMS.length;
  const progress = Math.round((doneCount / totalCount) * 100);
  const rows = OPS_CHECKLIST_ITEMS.map(item => `
    <label class="ops-check-item">
      <input type="checkbox" data-ops-check="${escapeHtml(item.id)}" ${checked(checklist[item.id])}>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </span>
    </label>
  `).join('');

  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Checklist vận hành shop</h2>
      <p>Theo dõi việc cần làm mỗi ngày cho shop/profile đang chọn. Dữ liệu chỉ lưu local trên máy này.</p>
    </div>
    <div class="ops-check-header">
      <div>
        <strong>${escapeHtml(doneCount)} / ${escapeHtml(totalCount)}</strong>
        <span>Đã hoàn thành hôm nay</span>
      </div>
      <div>
        <strong>${escapeHtml(progress)}%</strong>
        <span>${escapeHtml(shopId)} | ${escapeHtml(todayKey())}</span>
      </div>
    </div>
    <div class="ops-progress" aria-label="Tien do checklist">
      <span style="width: ${progress}%"></span>
    </div>
    <div class="ops-check-list">${rows}</div>
    <div class="actions">
      <button id="openSellerFromChecklist" type="button">Mở Seller Ads</button>
      <button id="resetOpsChecklist" type="button" class="secondary">Reset hôm nay</button>
    </div>
  `;

  workspaceContent.querySelectorAll('[data-ops-check]').forEach(input => {
    input.addEventListener('change', event => {
      const next = readOpsChecklist();
      next[event.currentTarget.dataset.opsCheck] = event.currentTarget.checked;
      writeOpsChecklist(next);
      renderOpsChecklistWorkspace();
    });
  });
  bindClick('#openSellerFromChecklist', () => openSellerAdsShop(shopQuickSelect.value));
  bindClick('#resetOpsChecklist', () => {
    localStorage.removeItem(opsChecklistStorageKey());
    renderOpsChecklistWorkspace();
  });
}

function renderDashboardWorkspace() {
  const selectedShop = selectedShopContext();
  const shopCount = shopList.querySelectorAll('.shop-item').length;
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Dashboard</h2>
      <p>Dashboard chính của app là dashboard gốc trong extension. Bấm mở dashboard để vào profile Chromium đã quản lý.</p>
    </div>
    <div class="summary-grid">
      <div><strong>${shopCount}</strong><span>Shop trong app</span></div>
      <div><strong>${escapeHtml(selectedShop.name || 'Default')}</strong><span>Profile dang chon</span></div>
      <div><strong>${selectedShop.sellerId ? escapeHtml(selectedShop.sellerId) : 'Chua co'}</strong><span>Seller ID</span></div>
      <div><strong>On</strong><span>Bundled extension</span></div>
    </div>
    <div class="actions">
      <button id="refreshDashboardInline">Làm mới dữ liệu</button>
      <button id="openDashboardDiagnostic" class="secondary">Mở Dashboard extension</button>
    </div>
  `;
  bindClick('#refreshDashboardInline', refreshStatus);
  bindClick('#openDashboardDiagnostic', () => openExtensionPage('pages/dashboard.html'));
}

async function openAppDashboard() {
  renderOperationsDashboardWorkspace();
  await openExtensionPage('pages/dashboard.html');
}

function dashboardRange(overview) {
  const ranges = overview?.ranges || [];
  return ranges.find(item => item.key === state.dashboardRangeKey)
    || ranges.find(item => item.key === overview?.defaultRangeKey)
    || ranges.find(item => item.rangeLabel)
    || ranges[0]
    || { cards: [], detailSections: [], tasks: {} };
}


function metricCoverageSummary(cards = []) {
  const coverageCards = (Array.isArray(cards) ? cards : []).filter(card => card && card.coverage);
  const missingCurrent = coverageCards.filter(card => !card.coverage.currentAvailable);
  const missingCompare = coverageCards.filter(card => card.coverage.currentAvailable && !card.coverage.compareAvailable);

  return {
    total: coverageCards.length,
    currentAvailable: coverageCards.length - missingCurrent.length,
    missingCurrent,
    missingCompare
  };
}

function renderMetricCoveragePanel(cards = [], overview = {}) {
  const summary = metricCoverageSummary(cards);
  if (!summary.total) {
    return `
      <section class="data-health-card">
        <div class="data-health-card-head">
          <h3>Metric coverage</h3>
          <span class="status-tag warn">Chưa có coverage</span>
        </div>
        <p>API chưa trả coverage cho từng metric. Cần kiểm tra backend buildShopCard/metricCoverage.</p>
      </section>
    `;
  }

  const missingCurrentRows = summary.missingCurrent.map(card => `
    <tr>
      <td>${escapeHtml(card.label || card.key)}</td>
      <td>${escapeHtml(card.coverage.requiredSource || '')}</td>
      <td>${escapeHtml(card.coverage.missingReason || '')}</td>
      <td>${escapeHtml(card.coverage.suggestedAction || '')}</td>
    </tr>
  `).join('');

  const missingCompareRows = summary.missingCompare.map(card => `
    <tr>
      <td>${escapeHtml(card.label || card.key)}</td>
      <td>${escapeHtml(card.coverage.requiredSource || '')}</td>
      <td>${escapeHtml(card.coverage.missingReason || '')}</td>
    </tr>
  `).join('');

  return `
    <section class="data-health-card">
      <div class="data-health-card-head">
        <h3>Metric coverage</h3>
        <span class="status-tag ${summary.missingCurrent.length ? 'warn' : 'ok'}">
          ${summary.currentAvailable}/${summary.total} có số liệu chính
        </span>
      </div>

      <div class="mini-kpi-grid">
        <div><strong>${escapeHtml(overview.sourceStatus || 'unknown')}</strong><span>Nguồn đang dùng</span></div>
        <div><strong>${summary.currentAvailable}/${summary.total}</strong><span>Có số liệu chính</span></div>
        <div><strong>${summary.missingCurrent.length}</strong><span>Thiếu số liệu chính</span></div>
        <div><strong>${summary.missingCompare.length}</strong><span>Thiếu so sánh</span></div>
      </div>

      ${summary.missingCurrent.length ? `
        <h4>Thiếu số liệu chính</h4>
        <table class="data-table compact-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Cần nguồn</th>
              <th>Lý do</th>
              <th>Gợi ý</th>
            </tr>
          </thead>
          <tbody>${missingCurrentRows}</tbody>
        </table>
      ` : '<p class="hint">Không thiếu số liệu chính trong range hiện tại.</p>'}

      ${summary.missingCompare.length ? `
        <h4>Thiếu số liệu so sánh</h4>
        <table class="data-table compact-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Cần nguồn</th>
              <th>Lý do</th>
            </tr>
          </thead>
          <tbody>${missingCompareRows}</tbody>
        </table>
      ` : '<p class="hint">Không thiếu số liệu so sánh.</p>'}
    </section>
  `;
}

function dashboardCard(title, value, source, format = 'number', available = true, note = '') {
  return `
    <div class="${available ? '' : 'is-missing'}">
      <strong>${metricValue(value, format, available)}</strong>
      <span>${escapeHtml(title)}</span>
      <small>${escapeHtml(sourceLabel(source))}${note ? ` | ${escapeHtml(note)}` : ''}</small>
    </div>
  `;
}

function dataSourceTone(status = {}) {
  if (status.fallbackUsed || status.effectiveSource === 'partial') return 'warn';
  if (status.effectiveSource === 'missing') return 'danger';
  if (status.effectiveSource === 'realtime' || status.effectiveSource === 'cached-crawler') return 'ok';
  return 'neutral';
}

function yesNo(value) {
  return value ? 'Co' : 'Khong';
}

function cdpRecoveryInfo({ crawlerStatus = null, dataSourceStatus = null } = {}) {
  const cdpStatus = crawlerStatus?.cdpStatus || dataSourceStatus?.cdpStatus || {};
  const failureReason = crawlerStatus?.failureReason || dataSourceStatus?.latestAttemptedFailureReason || '';
  const hasCdpProblem = failureReason === 'cdp_unavailable' || cdpStatus.reason === 'cdp_unavailable' || cdpStatus.reachable === false;
  if (!hasCdpProblem) return null;
  return {
    checkedAt: cdpStatus.checkedAt || dataSourceStatus?.updatedAt || crawlerStatus?.updatedAt || '',
    retryable: cdpStatus.retryable ?? crawlerStatus?.retryable ?? dataSourceStatus?.retryable ?? true,
    recoverySteps: Array.isArray(cdpStatus.recoverySteps) && cdpStatus.recoverySteps.length
      ? cdpStatus.recoverySteps
      : (Array.isArray(dataSourceStatus?.recoverySteps) && dataSourceStatus.recoverySteps.length
        ? dataSourceStatus.recoverySteps
        : [
          'Đóng cửa sổ browser cũ.',
          'Restart app.',
          'Mở lại profile shop.',
          'Retry crawl.'
        ]),
    nextAction: cdpStatus.nextAction || dataSourceStatus?.nextAction || crawlerStatus?.nextAction || 'Đóng cửa sổ browser cũ, restart app, mở lại profile shop rồi retry crawl.'
  };
}

function recoveryStepLabel(step = '') {
  const normalized = String(step || '').toLowerCase();
  if (normalized.includes('close stale browser')) return 'Đóng cửa sổ browser cũ.';
  if (normalized.includes('restart')) return 'Restart app.';
  if (normalized.includes('open the selected tiktok shop profile')) return 'Mở lại profile shop.';
  if (normalized.includes('retry seller center')) return 'Retry crawl.';
  return step;
}

function renderCdpRecoveryPanel(input = {}) {
  const info = cdpRecoveryInfo(input);
  if (!info) return '';
  const steps = info.recoverySteps.map(step => `<li>${escapeHtml(recoveryStepLabel(step))}</li>`).join('');
  const surface = input.surface || (input.dataSourceStatus ? 'dashboard' : 'crawler');
  const dashboardActions = `
    <button type="button" data-cdp-action="open-crawler">Mở TikTok Crawler để retry</button>
    <button type="button" class="secondary" data-cdp-action="refresh-dashboard-status">Refresh trạng thái</button>
  `;
  const crawlerActions = `
    <button type="button" data-cdp-action="retry-seller-center">Retry Seller Center crawl</button>
    <button type="button" class="secondary" data-cdp-action="refresh-crawler-status">Refresh trạng thái</button>
  `;
  return `
    <div class="failure-panel cdp-recovery-panel">
      <h4>Mất kết nối browser/CDP</h4>
      <p>App không kết nối được browser đang dùng để crawl.</p>
      <p>Đóng browser cũ, restart app, mở lại profile rồi retry crawl.</p>
      <ul>${steps}</ul>
      <p class="hint">Retryable: ${yesNo(info.retryable)}${info.checkedAt ? ` | Checked: ${formatTimestamp(info.checkedAt)}` : ''}</p>
      <div class="cdp-recovery-actions">
        ${surface === 'dashboard' ? dashboardActions : crawlerActions}
      </div>
    </div>
  `;
}

function renderDataSourceStatusPanel(status = {}, { surface = 'dashboard' } = {}) {
  if (!status || !Object.keys(status).length) {
    return `
      <section class="data-health-card">
        <div class="data-health-card-head">
          <h3>Data source status</h3>
          <span class="status-tag warn">Chua co metadata</span>
        </div>
        <p>API chua tra dataSourceStatus cho overview nay.</p>
      </section>
    `;
  }
  const tone = dataSourceTone(status);
  const failureReason = status.latestAttemptedFailureReason
    ? crawlerFailureLabel(status.latestAttemptedFailureReason)
    : 'Khong co';
  const freshnessGap = status.freshnessGap || {};
  return `
    <section class="data-health-card">
      <div class="data-health-card-head">
        <h3>Data source status</h3>
        <span class="status-tag ${escapeHtml(tone)}">${escapeHtml(sourceLabel(status.effectiveSource))}</span>
      </div>
      <div class="mini-kpi-grid">
        <div><strong>${escapeHtml(sourceLabel(status.effectiveSource))}</strong><span>Du lieu dang xem</span></div>
        <div><strong>${escapeHtml(status.cacheRunId || 'Chua co')}</strong><span>Cache run</span></div>
        <div><strong>${formatTimestamp(status.cacheUpdatedAt)}</strong><span>Cache updated</span></div>
        <div><strong>${escapeHtml(status.latestAttemptedStatus || 'Chua co')}</strong><span>Realtime gan nhat</span></div>
        <div><strong>${escapeHtml(failureReason)}</strong><span>Failure reason</span></div>
        <div><strong>${yesNo(status.fallbackUsed)}</strong><span>Fallback cache</span></div>
      </div>
      <p class="hint">${escapeHtml(status.nextAction || 'Chua co next action.')}</p>
      ${status.fallbackReason ? `<p class="hint">Fallback reason: ${escapeHtml(status.fallbackReason)}</p>` : ''}
      ${renderCdpRecoveryPanel({ dataSourceStatus: status, surface })}
      ${freshnessGap.exists ? `
        <div class="freshness-gap-panel">
          <h4>Dữ liệu realtime đã chạy xong, nhưng card vẫn dùng cache</h4>
          <p>Seller Center crawl mới nhất đã completed.</p>
          <p>Các card Tổng quan shop hiện vẫn lấy từ Compass/cache run cũ.</p>
          <p>Chỉ coi đây là trạng thái metadata-fresh, chưa phải dashboard-card fresh.</p>
          <div class="context-grid freshness-gap-grid">
            <div><strong>${escapeHtml(freshnessGap.realtimeRunId || 'Chua co')}</strong><span>Realtime run</span></div>
            <div><strong>${escapeHtml(freshnessGap.effectiveCardRunId || 'Chua co')}</strong><span>Card source run</span></div>
            <div><strong>${formatTimestamp(freshnessGap.effectiveCardUpdatedAt)}</strong><span>Card source updated</span></div>
            <div><strong>${escapeHtml(freshnessGap.nextAction || 'Chua co')}</strong><span>Next action</span></div>
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderDashboardRangeButtons(overview) {
  const ranges = overview?.ranges || [];
  if (!ranges.length) return '';
  const active = dashboardRange(overview).key;
  return `
    <div class="dashboard-range-tabs" aria-label="Chon khoang du lieu">
      ${ranges.map(range => `
        <button type="button" class="${range.key === active ? 'active' : ''}" data-dashboard-range="${escapeHtml(range.key)}">
          ${escapeHtml(range.label || range.key)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderDashboardCards(range) {
  const cards = range.cards || [];
  const preferred = ['gmv', 'orders', 'visitors', 'conversionRate', 'aov', 'storeScore', 'storeViolations', 'tasksRemaining'];
  const ordered = [
    ...preferred.map(key => cards.find(card => card.key === key)).filter(Boolean),
    ...cards.filter(card => !preferred.includes(card.key))
  ].slice(0, 8);
  if (!ordered.length) {
    return `
      <div class="summary-grid business-kpis">
        ${dashboardCard('GMV', null, 'missing', 'money', false)}
        ${dashboardCard('Don hang', null, 'missing', 'number', false)}
        ${dashboardCard('Shop score', null, 'missing', 'decimal', false)}
      </div>
    `;
  }
  return `
    <div class="summary-grid business-kpis">
      ${ordered.map(card => dashboardCard(card.label, card.value, card.source, card.format, card.available, card.note)).join('')}
    </div>
    ${renderMetricCoveragePanel(cards, range)}
  `;
}

function renderDashboardMetricTable(range) {
  const rows = (range.cards || []).map(card => `
    <tr>
      <td>${escapeHtml(card.label)}</td>
      <td class="num">${metricValue(card.value, card.format, card.available)}</td>
      <td>${statusTag(card.available, card.source)}</td>
      <td>${card.deltaPct === null || card.deltaPct === undefined ? '<span class="missing-value">Chua co du lieu</span>' : pct(card.deltaPct)}</td>
      <td>${escapeHtml(card.note || '')}</td>
    </tr>
  `).join('');
  return `
    <section class="mini-panel">
      <h3>Nguon tung metric</h3>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Gia tri</th><th>Nguon/status</th><th>So sanh</th><th>Ghi chu</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Chua co metric crawler cho khoang nay.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDashboardRawMappings(range) {
  const mappings = range.rawMappings || [];
  const rows = mappings.map(item => {
    const rawDates = (item.rawValues || [])
      .map(raw => `${raw.startDate || 'missing'}=${hasMetricValue(raw.value) ? money(raw.value) : 'missing'}`)
      .join(' | ');
    return `
      <tr>
        <td>${escapeHtml(item.uiLabel || item.uiField || '')}</td>
        <td>${escapeHtml(String(item.metricId || ''))}</td>
        <td>${escapeHtml(item.rawLabel || '')}</td>
        <td class="num">${metricValue(item.value, item.format, hasMetricValue(item.value))}</td>
        <td>${escapeHtml(item.formula || '')}</td>
        <td>${escapeHtml(rawDates || 'missing')}</td>
        <td>${escapeHtml(item.rawPath || '')}</td>
      </tr>
    `;
  }).join('');
  return `
    <section class="mini-panel">
      <h3>Raw Compass mapping de doi chieu thu cong</h3>
      <p class="hint">Bang nay noi ro moi o tren dashboard dang lay tu metric nao tren Seller/Compass. Hay dung cot Seller UI / metric ID de doi chieu voi man hinh TikTok truoc khi minh khoa mapping.</p>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>O tren dashboard</th><th>Metric ID</th><th>Seller UI / raw label</th><th>Gia tri dang hien</th><th>Cach tinh</th><th>Raw date=value</th><th>Raw file</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7">Chua co raw mapping cho range nay.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHealthDependencyList(dependencies = []) {
  return dependencies.map(item => `
    <li class="${item.available ? 'available' : 'missing'}">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${metricValue(item.value, item.format, item.available)}</span>
      ${statusTag(item.available, item.source)}
    </li>
  `).join('');
}

function renderShopHealthCenter(range) {
  const health = range.healthCenter;
  if (!health) {
    return `
      <section class="mini-panel">
        <h3>Shop Health / Score</h3>
        <p class="hint">Chua co du lieu Shop Score hoac violations tu crawler.</p>
      </section>
    `;
  }
  const violationRows = (health.violations?.items || []).slice(0, 8).map(item => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.status || 'Chua co trang thai')}</td>
      <td class="num">${metricValue(item.count, 'number', item.count !== null && item.count !== undefined)}</td>
      <td>${escapeHtml(item.source || health.violations?.source || 'Chua co')}</td>
      <td>${escapeHtml(formatTimestamp(item.timestamp || health.violations?.timestamp || ''))}</td>
    </tr>
  `).join('');
  const missingDependencyItems = (health.missingDependencies || []).map(item => `
    <li>${escapeHtml(item)}</li>
  `).join('');
  const missingDependencyDetail = missingDependencyItems
    ? `
      <div class="health-missing-dependencies" data-shop-health-missing-dependencies>
        <strong>Missing dependency detail</strong>
        <ul>${missingDependencyItems}</ul>
      </div>
    `
    : `
      <div class="health-missing-dependencies complete" data-shop-health-missing-dependencies>
        <strong>Missing dependency detail</strong>
        <span>No missing health dependencies.</span>
      </div>
    `;
  return `
    <section class="mini-panel shop-health-panel">
      <h3>Shop Health / Score</h3>
      <div class="summary-grid shop-health-summary">
        ${dashboardCard('Shop Score', health.score?.value, health.score?.source || 'crawler', health.score?.format || 'decimal', health.score?.available, health.score?.note || '')}
        ${dashboardCard('Shop Violations', health.violations?.summary?.value, health.violations?.summary?.source || 'crawler', health.violations?.summary?.format || 'number', health.violations?.summary?.available, health.violations?.risk || '')}
        ${dashboardCard('Missing dependencies', health.missingDependencies?.length || 0, 'computed', 'number', true)}
      </div>
      ${missingDependencyDetail}
      <div class="analysis-grid">
        ${(health.components || []).map(component => `
          <section class="mini-panel health-component">
            <h3>${escapeHtml(component.title)}</h3>
            <dl class="compact-list">
              <dt>Formula</dt><dd>${escapeHtml(component.formula)}</dd>
              <dt>Weight</dt><dd>${escapeHtml(component.weight || '')}</dd>
              <dt>Status</dt><dd>${statusTag(component.available, component.available ? 'computed' : 'missing')}</dd>
              <dt>Score</dt><dd>${metricValue(component.value, component.format, component.available)}</dd>
            </dl>
            <p class="hint">${escapeHtml(component.unitNote || '')}</p>
            <ul class="health-dependencies">${renderHealthDependencyList(component.dependencies || [])}</ul>
          </section>
        `).join('')}
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Violation title/type</th><th>Status tag</th><th>Count</th><th>Source</th><th>Timestamp</th></tr></thead>
          <tbody>${violationRows || '<tr><td colspan="5">Chua co violation detail. Neu co vi pham, app se hien title/status/source/timestamp khi crawler lay duoc.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDashboardDetails(range) {
  const sections = (range.detailSections || []).slice(0, 2);
  if (!sections.length) return '';
  return `
    <div class="analysis-grid">
      ${sections.map(section => `
        <section class="mini-panel">
          <h3>${escapeHtml(section.title)}</h3>
          <dl class="compact-list">
            ${(section.metrics || []).slice(0, 10).map(metric => `
              <dt>${escapeHtml(metric.label)}</dt>
              <dd>${metricValue(metric.value, metric.format, metric.available)}</dd>
            `).join('')}
          </dl>
        </section>
      `).join('')}
    </div>
  `;
}

function renderDashboardEmpty(selectedShop, shopCount) {
  return `
    <div class="panel-header">
      <h2>Dashboard van hanh shop</h2>
      <p>Chua co crawler data cho shop/profile dang chon. Dashboard khong tao so lieu gia; hay crawl realtime hoac nap file business.</p>
    </div>
    <div class="context-panel">
      <div class="context-grid">
        <div><strong>${escapeHtml(selectedShop.label)}</strong><span>Shop/profile dang chon</span></div>
        <div><strong>${shopCount}</strong><span>Shop trong app</span></div>
        <div><strong>No crawler data yet</strong><span>Trang thai du lieu</span></div>
        <div><strong>Chua co</strong><span>Last crawl timestamp</span></div>
      </div>
    </div>
    ${renderDashboardCards({ cards: [] })}
    ${renderTargetCaptureGate(selectedShop)}
    ${renderShopHealthCenter({})}
    <div class="actions dashboard-actions">
      <button id="dashboardOpenSellerProfile">Open/Attach seller profile</button>
      <button id="dashboardVerifySession" class="secondary">Refresh/Verify session</button>
      <button id="dashboardTargetOverviewCapture" class="secondary" ${sessionReadinessFor(selectedShop.id || '').sessionReady === true ? '' : 'disabled'}>Target overview capture</button>
      <button id="dashboardOpenCrawler">Mo TikTok Crawler</button>
      <button id="dashboardOpenBusinessAnalysis" class="secondary">Nap file Phan tich KD</button>
      <button id="dashboardOpenChecklist" class="secondary">Checklist van hanh</button>
      <button id="openDashboardDiagnostic" class="secondary">Mo Dashboard extension</button>
    </div>
  `;
}

function bindDashboardActions() {
  bindClick('#refreshDashboardInline', renderOperationsDashboardWorkspace);
  bindClick('#dashboardOpenSellerProfile', openOrAttachSellerProfile);
  bindClick('#dashboardVerifySession', verifySellerProfileSession);
  bindClick('#dashboardTargetOverviewCapture', refreshDashboardRealtime);
  bindClick('#openDashboardDiagnostic', () => openExtensionPage('pages/dashboard.html'));
  bindClick('#dashboardOpenCrawler', renderTikTokCrawlerWorkspace);
  bindClick('#dashboardOpenBusinessAnalysis', renderBusinessAnalysisWorkspace);
  bindClick('#dashboardOpenChecklist', renderOpsChecklistWorkspace);
  bindCdpRecoveryActions('dashboard');
}

function targetProfilePayload(mode = 'seller-center') {
  const selectedShop = selectedShopContext();
  return {
    mode,
    shopId: selectedShop.id || 'little-apricot-hawaii-fashion',
    sellerId: selectedShop.sellerId || '7494478078863902049',
    baseUrl: selectedShop.sellerCenterUrl || 'https://seller-vn.tiktok.com/homepage?shop_region=VN'
  };
}

function rememberSessionReadiness(shopId, result = {}) {
  if (!shopId) return null;
  const next = {
    sessionReady: result.sessionReady ?? null,
    currentPageKind: result.currentPageKind || 'unknown',
    selectedShop: result.selectedShop || null,
    profileName: result.profileName || '',
    cdpStatus: result.cdpStatus || null,
    activeJob: result.activeJob || null,
    failureReason: result.failureReason || '',
    nextAction: result.nextAction || '',
    checkedAt: new Date().toISOString()
  };
  state.sessionReadiness[shopId] = next;
  return next;
}

function sessionReadinessFor(shopId) {
  return state.sessionReadiness[shopId] || {
    sessionReady: null,
    currentPageKind: 'unknown',
    failureReason: 'cookie_missing',
    nextAction: 'Open/Attach seller profile, login if needed, then click Refresh/Verify session.'
  };
}

function renderTargetCaptureGate(selectedShop) {
  const readiness = sessionReadinessFor(selectedShop.id || '');
  const ready = readiness.sessionReady === true;
  const kind = readiness.currentPageKind || 'unknown';
  const failure = readiness.failureReason ? crawlerFailureLabel(readiness.failureReason) : 'Khong co';
  return `
    <section class="data-health-card target-session-gate ${ready ? 'ok' : 'warn'}">
      <div class="data-health-card-head">
        <h3>Target overview capture</h3>
        <span class="status-tag ${ready ? 'ok' : 'warn'}">${ready ? 'Session/profile da san sang' : 'Chưa xác thực session'}</span>
      </div>
      <div class="mini-kpi-grid">
        <div><strong>${ready ? 'true' : (readiness.sessionReady === false ? 'false' : 'null')}</strong><span>sessionReady</span></div>
        <div><strong>${escapeHtml(kind)}</strong><span>currentPageKind</span></div>
        <div><strong>${escapeHtml(selectedShop.name || selectedShop.label || 'Chua chon')}</strong><span>selectedShop</span></div>
        <div><strong>${escapeHtml(readiness.profileName || 'Chua co')}</strong><span>profileName</span></div>
        <div><strong>${escapeHtml(readiness.cdpStatus?.reason || 'cdp_not_checked')}</strong><span>cdpStatus</span></div>
        <div><strong>${escapeHtml(readiness.activeJob?.status || 'Khong co')}</strong><span>activeJob</span></div>
        <div><strong>${escapeHtml(failure)}</strong><span>failureReason</span></div>
        <div><strong>${escapeHtml(readiness.nextAction || 'Target overview capture chỉ chạy sau khi session/profile đã sẵn sàng')}</strong><span>nextAction</span></div>
      </div>
      <p class="hint">Đăng nhập trong browser app đã mở, sau đó bấm Refresh/Verify session.</p>
      <p class="hint">Không mở browser mới khi session chưa sẵn sàng. Target overview capture chỉ chạy sau khi session/profile đã sẵn sàng.</p>
    </section>
  `;
}

async function openOrAttachSellerProfile(event) {
  const button = event?.currentTarget;
  const selectedShop = selectedShopContext();
  if (!selectedShop.id) return setOutput('Chua chon shop/profile de open/attach.');
  const original = button?.textContent || '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Dang open/attach...';
  }
  try {
    const result = await api('/api/tiktokshop-crawler/profile/open', {
      method: 'POST',
      body: targetProfilePayload('seller-center')
    });
    rememberSessionReadiness(selectedShop.id, result);
    setOutput(result);
    await renderOperationsDashboardWorkspace();
  } catch (error) {
    rememberSessionReadiness(selectedShop.id, error.data || {});
    setOutput(error.data || error.message);
    await renderOperationsDashboardWorkspace();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

async function verifySellerProfileSession(event) {
  const button = event?.currentTarget;
  const selectedShop = selectedShopContext();
  if (!selectedShop.id) return setOutput('Chua chon shop/profile de verify session.');
  const original = button?.textContent || '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Dang verify...';
  }
  try {
    const result = await api('/api/tiktokshop-crawler/profile/verify', {
      method: 'POST',
      body: targetProfilePayload('seller-center')
    });
    rememberSessionReadiness(selectedShop.id, result);
    setOutput(result);
    await renderOperationsDashboardWorkspace();
  } catch (error) {
    rememberSessionReadiness(selectedShop.id, error.data || {});
    setOutput(error.data || error.message);
    await renderOperationsDashboardWorkspace();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

async function refreshDashboardRealtime(event) {
  const button = event?.currentTarget;
  const selectedShop = selectedShopContext();
  if (!selectedShop.id) return setOutput('Chua chon shop/profile de crawl realtime.');
  if (!selectedShop.sellerId) return setOutput('Shop dang chon chua co Seller ID.');
  const readiness = sessionReadinessFor(selectedShop.id);
  if (readiness.sessionReady !== true) {
    const blocked = {
      ok: false,
      sessionReady: readiness.sessionReady,
      currentPageKind: readiness.currentPageKind || 'unknown',
      selectedShop: selectedShop.name || selectedShop.label || selectedShop.id,
      profileName: readiness.profileName || '',
      cdpStatus: readiness.cdpStatus || { reason: 'cdp_not_checked' },
      activeJob: readiness.activeJob || null,
      failureReason: readiness.failureReason || 'cookie_missing',
      retryable: true,
      nextAction: 'Đăng nhập trong browser app đã mở, sau đó bấm Refresh/Verify session.'
    };
    setOutput(blocked);
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = 'Dang capture...';
  }
  try {
    const result = await api('/api/tiktokshop-crawler/crawl', {
      method: 'POST',
      body: {
        ...targetProfilePayload('seller-center'),
        mode: 'seller-center',
        shopId: selectedShop.id,
        sellerId: selectedShop.sellerId,
        autoOpenProfile: false,
        targetedOverviewCapture: true,
        dateRange: 'yesterday',
        maxModules: 0
      }
    });
    setOutput(result);
    await renderOperationsDashboardWorkspace();
  } catch (error) {
    rememberSessionReadiness(selectedShop.id, error.data || {});
    setOutput(error.data || error.message);
    await renderOperationsDashboardWorkspace();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Target overview capture';
    }
  }
}

function crawlerFormPayload(mode = 'seller-center') {
  const selectedShop = selectedShopContext();
  const form = document.querySelector('#tiktokCrawlerForm');
  const data = form ? new FormData(form) : null;
  return {
    mode,
    shopId: selectedShop.id || 'little-apricot-hawaii-fashion',
    autoOpenProfile: data ? data.get('autoOpenProfile') === 'on' : true,
    cdpPort: Number(data?.get('cdpPort') || 0),
    sellerId: data?.get('sellerId') || selectedShop.sellerId || '7494478078863902049',
    baseUrl: data?.get('baseUrl') || 'https://seller-vn.tiktok.com/homepage?shop_region=VN',
    months: String(data?.get('months') || currentMonthKey()).split(',').map(item => item.trim()).filter(Boolean),
    dateRange: 'yesterday',
    maxModules: Number(data?.get('maxModules') || 0)
  };
}

async function retrySellerCenterCrawl(event) {
  const button = event?.currentTarget;
  const original = button?.textContent || '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Đang retry...';
  }
  setOutput('Đang retry Seller Center crawl theo thao tác của người dùng...');
  try {
    const result = await api('/api/tiktokshop-crawler/crawl', {
      method: 'POST',
      body: crawlerFormPayload('seller-center')
    });
    setOutput(result);
  } catch (error) {
    setOutput(error.data || error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
    await renderTikTokCrawlerWorkspace();
  }
}

async function refreshCdpRecoveryStatus(event, surface = 'crawler') {
  const button = event?.currentTarget;
  const original = button?.textContent || '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Đang refresh...';
  }
  try {
    if (surface === 'dashboard') await renderOperationsDashboardWorkspace();
    else await renderTikTokCrawlerWorkspace();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function bindCdpRecoveryActions(surface = 'crawler') {
  document.querySelectorAll('[data-cdp-action]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const action = event.currentTarget.dataset.cdpAction;
      if (action === 'open-crawler') return renderTikTokCrawlerWorkspace();
      if (action === 'retry-seller-center') return retrySellerCenterCrawl(event);
      if (action === 'refresh-dashboard-status') return refreshCdpRecoveryStatus(event, 'dashboard');
      if (action === 'refresh-crawler-status') return refreshCdpRecoveryStatus(event, surface);
      return null;
    });
  });
}

function renderDashboardView(data) {
  const selectedShop = selectedShopContext();
  const shopCount = shopList.querySelectorAll('.shop-item').length;
  const overview = (data?.overviews || []).find(item => item.profileId === selectedShop.id || item.shopId === selectedShop.id)
    || (data?.overviews || [])[0]
    || null;
  state.dashboardOverview = data || null;
  if (!overview?.ok) {
    workspaceContent.innerHTML = renderDashboardEmpty(selectedShop, shopCount);
    bindDashboardActions();
    return;
  }
  if (!state.dashboardRangeKey) state.dashboardRangeKey = overview.defaultRangeKey || '';
  const range = dashboardRange(overview);
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Dashboard van hanh shop</h2>
      <p>Tong quan doc tu crawler local da normalize. Neu can du lieu moi, bam TikTok Crawler de crawl realtime.</p>
    </div>
    <div class="context-panel">
      <div class="context-grid">
        <div><strong>${escapeHtml(overview.shopName || selectedShop.label)}</strong><span>Shop/profile</span></div>
        <div><strong>${escapeHtml(overview.sellerId || selectedShop.sellerId || 'Chua co')}</strong><span>Seller ID</span></div>
        <div><strong>${escapeHtml(sourceLabel('cached'))}</strong><span>Nguon dang hien thi</span></div>
        <div><strong>${formatTimestamp(overview.updatedAt || overview.crawlerSummary?.finishedAt || overview.crawlerSummary?.startedAt)}</strong><span>Last crawl timestamp</span></div>
        <div><strong>${escapeHtml(range.rangeLabel || overview.rangeLabel || 'Chua co')}</strong><span>Khoang du lieu</span></div>
        <div><strong>${escapeHtml(overview.runId || 'Chua co')}</strong><span>Crawler run ID</span></div>
        <div><strong>${shopCount}</strong><span>Shop trong app</span></div>
        <div><strong>${escapeHtml(overview.availableStartDate || 'Chua co')} -> ${escapeHtml(overview.availableEndDate || 'Chua co')}</strong><span>Du lieu co san</span></div>
      </div>
    </div>
    ${renderDashboardRangeButtons(overview)}
    ${renderDashboardCards(range)}
    ${renderDataSourceStatusPanel(overview.dataSourceStatus)}
    ${renderTargetCaptureGate(selectedShop)}
    <div class="dashboard-notes">
      ${(overview.notes || []).map(note => `<p>${escapeHtml(note)}</p>`).join('')}
    </div>
    ${renderShopHealthCenter(range)}
    ${renderDashboardRawMappings(range)}
    ${renderDashboardMetricTable(range)}
    ${renderDashboardDetails(range)}
    <div class="actions dashboard-actions">
      <button id="dashboardOpenSellerProfile">Open/Attach seller profile</button>
      <button id="dashboardVerifySession" class="secondary">Refresh/Verify session</button>
      <button id="dashboardTargetOverviewCapture" class="secondary" ${sessionReadinessFor(selectedShop.id || '').sessionReady === true ? '' : 'disabled'}>Target overview capture</button>
      <button id="refreshDashboardInline" class="secondary">Tai lai cache dashboard</button>
      <button id="dashboardOpenCrawler" class="secondary">Mo TikTok Crawler</button>
      <button id="dashboardOpenBusinessAnalysis" class="secondary">Nap file Phan tich KD</button>
      <button id="dashboardOpenChecklist" class="secondary">Checklist van hanh</button>
      <button id="openDashboardDiagnostic" class="secondary">Mo Dashboard extension</button>
    </div>
  `;
  workspaceContent.querySelectorAll('[data-dashboard-range]').forEach(button => {
    button.addEventListener('click', event => {
      state.dashboardRangeKey = event.currentTarget.dataset.dashboardRange;
      renderDashboardView(state.dashboardOverview);
    });
  });
  bindDashboardActions();
}

async function renderOperationsDashboardWorkspace() {
  const selectedShop = selectedShopContext();
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Dashboard van hanh shop</h2>
      <p>Dang tai tong quan shop tu crawler local.</p>
    </div>
  `;
  try {
    const query = new URLSearchParams();
    if (selectedShop.id) query.set('shopId', selectedShop.id);
    if (selectedShop.sellerId) query.set('sellerId', selectedShop.sellerId);
    const data = await api(`/api/business/shop-overview${query.toString() ? `?${query}` : ''}`);
    renderDashboardView(data);
  } catch (error) {
    setOutput(error.data || error.message);
    renderDashboardView({ ok: false, overviews: [] });
  }
}

function localBackupShop(shop = {}) {
  return {
    id: shop.id || '',
    name: shop.name || '',
    avatar: shop.avatar || '',
    loginNote: shop.loginNote || '',
    sellerId: shop.sellerId || '',
    adsAccountId: shop.adsAccountId || '',
    sellerCenterUrl: shop.sellerCenterUrl || '',
    sellerAdsUrl: shop.sellerAdsUrl || '',
    compassUrl: shop.compassUrl || '',
    gmvMaxUrl: shop.gmvMaxUrl || '',
    shopHealthStatus: shop.shopHealthStatus || '',
    productScoreStatus: shop.productScoreStatus || '',
    region: shop.region || '',
    cookieStorage: shop.cookieStorage || 'none'
  };
}

function cloudSyncBackupPayload() {
  return {
    schema: 'strange-tiktokshop-local-backup/v1',
    exportedAt: new Date().toISOString(),
    mode: 'local-only',
    appConfig: {
      aiDataUrl: state.appConfig.aiDataUrl || '',
      productViewEnabled: Boolean(state.appConfig.productViewEnabled),
      videoAutoplay: Boolean(state.appConfig.videoAutoplay),
      videoSound: Boolean(state.appConfig.videoSound),
      videoLoop: Boolean(state.appConfig.videoLoop)
    },
    shops: (state.shops || []).map(localBackupShop),
    notes: [
      'Phase 0 local backup only.',
      'Cookies, tokens, credentials, machine IDs, license keys, and private browser state are not exported.'
    ]
  };
}

function importedBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

async function importLocalBackup(file) {
  if (!file) return { ok: false, error: 'Chua chon file backup local.' };
  const parsed = JSON.parse(await file.text());
  if (parsed.schema !== 'strange-tiktokshop-local-backup/v1' || parsed.mode !== 'local-only') {
    throw new Error('File backup khong dung dinh dang local Phase 0.');
  }
  const config = parsed.appConfig || {};
  const nextConfig = await saveAppConfig({
    aiDataUrl: config.aiDataUrl || state.appConfig.aiDataUrl || '',
    productViewEnabled: importedBool(config.productViewEnabled, state.appConfig.productViewEnabled),
    videoAutoplay: importedBool(config.videoAutoplay, state.appConfig.videoAutoplay),
    videoSound: importedBool(config.videoSound, state.appConfig.videoSound),
    videoLoop: importedBool(config.videoLoop, state.appConfig.videoLoop)
  });
  return {
    ok: true,
    imported: 'appConfig',
    skipped: 'shops are included as read-only backup reference only',
    shopCount: Array.isArray(parsed.shops) ? parsed.shops.length : 0,
    config: nextConfig
  };
}

function renderCloudSyncWorkspace() {
  workspaceContent.innerHTML = `
    <div class="workspace-content">
      <div class="panel-header">
        <h2>Dong bo local / Sao luu du lieu</h2>
        <p>Phase 0 chi tao file backup cuc bo tren may nay. Cloud that se duoc phat trien sau khi co phe duyet rieng.</p>
      </div>
      <div class="summary-grid">
        <div><strong>Off</strong><span>Remote cloud</span></div>
        <div><strong>${state.shops.length}</strong><span>Shop references</span></div>
        <div><strong>Local JSON</strong><span>Backup format</span></div>
      </div>
      <p class="hint">Backup khong xuat cookies, tokens, credentials, machine IDs, license keys, hay private browser state.</p>
      <label>
        Nap file backup local
        <input id="cloudBackupFile" type="file" accept="application/json">
      </label>
      <div class="actions dashboard-actions">
        <button type="button" id="exportLocalBackup">Tai backup local</button>
        <button type="button" class="secondary" id="importLocalBackup">Nap cau hinh local</button>
        <button type="button" class="secondary" id="syncBundledInline">Dong bo extension bundled</button>
      </div>
    </div>
  `;
  bindClick('#exportLocalBackup', () => {
    const filename = `strange-tiktokshop-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadTextFile(filename, JSON.stringify(cloudSyncBackupPayload(), null, 2), 'application/json;charset=utf-8');
    setOutput({ ok: true, exported: filename, mode: 'local-only', shopCount: state.shops.length });
  });
  bindClick('#importLocalBackup', async () => {
    const file = document.querySelector('#cloudBackupFile')?.files?.[0];
    try {
      setOutput(await importLocalBackup(file));
      await refreshStatus();
    } catch (error) {
      setOutput(error.data || error.message || String(error));
    }
  });
  bindClick('#syncBundledInline', event => runAction(event.currentTarget, '/api/extensions/sync-bundled'));
}

function renderAiDataWorkspace() {
  workspaceContent.innerHTML = `
    <form id="aiDataForm" class="workspace-content">
      <div class="panel-header">
        <h2>External AI Data</h2>
        <p>External link only. Out of scope for local TikTok Shop metrics, crawler data, and business analysis.</p>
      </div>
      <label>
        External AI Data URL
        <input name="aiDataUrl" value="${escapeHtml(state.appConfig.aiDataUrl)}" autocomplete="off" placeholder="https://...">
      </label>
      <div class="actions">
        <button type="submit">Luu URL</button>
        <button type="button" class="secondary" id="openAiDataUrl">Mo external link</button>
      </div>
    </form>
  `;
  document.querySelector('#aiDataForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const config = await saveAppConfig({ aiDataUrl: form.get('aiDataUrl') });
      setOutput({ ok: true, config });
      await refreshStatus();
    } catch (error) {
      setOutput(error.data || error.message);
    }
  });
  bindClick('#openAiDataUrl', () => {
    const url = state.appConfig.aiDataUrl;
    if (!url) return setOutput('Chua co External AI Data URL.');
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

function money(value) {
  if (!hasMetricValue(value)) return 'Chua co du lieu';
  return Math.round(Number(value)).toLocaleString('vi-VN');
}

function pct(value) {
  if (!hasMetricValue(value)) return 'Chua co du lieu';
  const n = Number(value);
  return `${(n * 100).toFixed(1)}%`;
}

function decimal(value, digits = 2) {
  if (!hasMetricValue(value)) return 'Chua co du lieu';
  return Number(value).toFixed(digits);
}

function metricValue(value, format = 'number', available = true) {
  if (!available || !hasMetricValue(value)) return '<span class="missing-value">Chua co du lieu</span>';
  if (format === 'money') return money(value);
  if (format === 'percent') return pct(value);
  if (format === 'decimal') return decimal(value);
  if (format === 'hours') return `${decimal(value, 1)} gio`;
  return Number(value).toLocaleString('vi-VN');
}

function statusTag(available, source = '') {
  const text = available ? sourceLabel(source) : 'Missing';
  const className = available ? 'metric-status ok' : 'metric-status missing';
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function flowStatusTag(label, tone = 'neutral') {
  return `<span class="flow-status ${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function healthTile(label, value, tone = 'neutral', note = '') {
  return `
    <div class="data-health-tile ${escapeHtml(tone)}">
      <strong>${escapeHtml(value || 'Chua co')}</strong>
      <span>${escapeHtml(label)}</span>
      ${note ? `<small>${escapeHtml(note)}</small>` : ''}
    </div>
  `;
}

function renderBusinessHealthBand(result = null) {
  const selectedShop = selectedShopContext();
  if (!result) {
    const confirmation = selectedShop.id ? readShopSessionConfirmation(selectedShop.id) : null;
    return `
      <section class="data-health-band">
        ${healthTile('Shop/profile dang chon', selectedShop.label, selectedShop.id ? 'ok' : 'warn')}
        ${healthTile('Uploaded data', 'Dang cho file', 'neutral', '.xlsx/.csv/.tsv/.txt')}
        ${healthTile('Crawler data', 'Se kiem tra sau khi phan tich', 'neutral', 'Cache local neu co')}
        ${healthTile('Session note', confirmationLabel(confirmation?.status), confirmation?.status === 'correct-shop' ? 'ok' : 'warn')}
      </section>
    `;
  }
  const overview = result.shopOverview || {};
  const fileCount = (result.fileSummary || []).length;
  const uploadedRows = Object.values(result.groupedRows || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const warningCount = (result.warnings || []).length;
  const crawlerOk = Boolean(overview.ok);
  return `
    <section class="data-health-band">
      ${healthTile('Shop/profile', selectedShop.label, selectedShop.id ? 'ok' : 'warn')}
      ${healthTile('Uploaded data', fileCount ? `${fileCount} file / ${money(uploadedRows)} dong` : 'Chua upload file', fileCount ? 'ok' : 'warn')}
      ${healthTile('Crawler data', crawlerOk ? 'Co cache local' : 'Missing', crawlerOk ? 'ok' : 'warn', overview.runId || '')}
      ${healthTile('Last crawl', formatTimestamp(overview.updatedAt || overview.crawlerSummary?.finishedAt || overview.crawlerSummary?.startedAt), crawlerOk ? 'ok' : 'neutral')}
      ${healthTile('Warnings', warningCount ? `${warningCount} can xem` : 'Khong co', warningCount ? 'warn' : 'ok')}
    </section>
  `;
}

function renderBusinessWarningPanel(result) {
  const warnings = (result.warnings || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const missing = [];
  if (!businessRevenueAvailable(result)) missing.push('Doanh thu chua co nguon du lieu ro rang.');
  if (!adsSpendAvailable(result)) missing.push('Ads Spend dang missing hoac thieu cot Cash/Credit/Ads credit.');
  if (!result.orders?.refundCancel?.available) missing.push('Refund/cancel chua co cot status/refund/cancel.');
  if (!result.shopOverview?.ok) missing.push('Crawler local chua co overview cho shop/profile dang chon.');
  const missingRows = missing.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  if (!warnings && !missingRows) {
    return `
      <section class="warning-panel ok">
        <h3>Data health</h3>
        <p>Basic view khong thay metric bat buoc bi thieu. Van can validate bang data that truoc khi ket luan.</p>
      </section>
    `;
  }
  return `
    <section class="warning-panel">
      <h3>Missing / warning can xu ly</h3>
      <ul>${warnings}${missingRows}</ul>
    </section>
  `;
}

function renderBusinessNextActions(result) {
  const actions = [
    !result.shopOverview?.ok ? 'Mo TikTok Crawler va crawl realtime bang dung shop/profile.' : '',
    !adsSpendAvailable(result) ? 'Nap file Ads actual co cot Cash/Credit/Ads credit neu can tinh Ads Spend.' : '',
    !result.orders?.refundCancel?.available ? 'Nap file don hang co status/refund/cancel de xem ty le hoan/huy.' : '',
    groupedRows(result, 'orders') > 0 && !Number(result.priceRows || 0) ? 'Nap bang gia goc de tinh gia von/SKU profit.' : '',
    'Kiem tra Advanced detail neu can doi chieu file, crawler cache, hoac mapping.'
  ].filter(Boolean);
  return `
    <section class="mini-panel next-actions-panel">
      <h3>Next actions</h3>
      <ul>${actions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  `;
}

function csvCell(value) {
  const raw = String(value ?? '');
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function csvMetricNumber(value, available = true) {
  return available && hasMetricValue(value) ? Math.round(Number(value)) : 'missing';
}

function csvMetricPercent(value, available = true) {
  return available && hasMetricValue(value) ? pct(value) : 'missing';
}

function csvMetricDecimal(value, available = true) {
  return available && hasMetricValue(value) ? Number(value).toFixed(2) : 'missing';
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportBusinessPlanCsv(result) {
  const hasOrderRows = groupedRows(result, 'orders') > 0;
  const adsActualAvailable = Boolean(result.ads?.actual?.hasSpendComponent) && Number(result.ads?.actual?.rowsUsed || 0) > 0;
  const adsComponents = Object.fromEntries((result.ads?.actual?.components || []).map(item => [item.key, item]));
  const adsComponentValue = key => csvMetricNumber(adsComponents[key]?.value, Boolean(adsComponents[key]?.available));
  const refundCancelAvailable = Boolean(result.orders?.refundCancel?.available);
  const rows = [
    ['Loai', 'Chi so', 'Gia tri'],
    ['Tong quan', 'Ky du lieu', result.period || ''],
    ['Tong quan', 'Ky ke hoach', result.plan?.period || ''],
    ['KPI', 'Doanh thu cu', csvMetricNumber(result.kpis?.revenue, hasOrderRows)],
    ['KPI', 'Loi nhuan uoc tinh', csvMetricNumber(result.kpis?.netProfitEstimate, hasOrderRows)],
    ['KPI', 'Net margin', csvMetricPercent(result.kpis?.netMargin, hasOrderRows && hasMetricValue(result.kpis?.revenue) && Number(result.kpis.revenue) !== 0)],
    ['Ads', 'Chi phi thuc te', csvMetricNumber(result.costs?.adsActualCost, adsActualAvailable)],
    ['Ads', 'Cash', adsComponentValue('cash')],
    ['Ads', 'Credit', adsComponentValue('credit')],
    ['Ads', 'Ads credit direct', adsComponentValue('adsCreditDirect')],
    ['Ads', 'Ads credit prorated', adsComponentValue('adsCreditProrated')],
    ['Orders', 'Refund/cancel orders', csvMetricNumber(result.orders?.refundCancel?.affectedOrders, refundCancelAvailable)],
    ['Orders', 'Refund/cancel rate', csvMetricPercent(result.orders?.refundCancel?.affectedRate, refundCancelAvailable)],
    ['Orders', 'Refund/cancel amount', csvMetricNumber(result.orders?.refundCancel?.amount, refundCancelAvailable)],
    ['Content', 'GMV Video', csvMetricNumber(result.content?.video?.gmv, groupedRows(result, 'video') > 0)],
    ['Content', 'GMV Livestream', csvMetricNumber(result.content?.livestream?.gmv, groupedRows(result, 'livestream') > 0)],
    ['Content', 'GMV Product affiliate', csvMetricNumber(result.affiliate?.performance?.gmv, Boolean(result.affiliate?.performance?.available))],
    ['Ke hoach', 'Muc tieu doanh thu', Math.round(Number(result.plan?.targetRevenue || 0))],
    ['Ke hoach', 'Ngan sach ads goi y', Math.round(Number(result.plan?.suggestedAdsBudget || 0))],
    ['Ke hoach', 'ROI hoa von', csvMetricDecimal(result.plan?.breakEvenRoi)]
  ];
  for (const action of result.plan?.actions || []) rows.push(['Action', action, '']);
  rows.push([]);
  rows.push(['SKU uu tien', 'Doanh thu cu', 'Lai gop uoc tinh']);
  for (const item of result.plan?.focusSkus || []) {
    rows.push([item.skuName, Math.round(Number(item.revenue || 0)), Math.round(Number(item.grossProfit || 0))]);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Khong doc duoc file ${file.name}`));
    reader.onload = () => {
      const raw = String(reader.result || '');
      resolve(raw.includes(',') ? raw.split(',').pop() : raw);
    };
    reader.readAsDataURL(file);
  });
}

async function buildBusinessPayload(form) {
  const dataFiles = Array.from(form.querySelector('input[name="businessFiles"]')?.files || []);
  const priceFiles = Array.from(form.querySelector('input[name="priceFile"]')?.files || []);
  const files = [];
  for (const file of dataFiles) {
    files.push({
      name: file.name,
      type: 'auto',
      size: file.size,
      contentBase64: await readFileAsBase64(file)
    });
  }
  const priceFile = priceFiles[0]
    ? {
        name: priceFiles[0].name,
        size: priceFiles[0].size,
        contentBase64: await readFileAsBase64(priceFiles[0])
      }
    : null;
  const fd = new FormData(form);
  return {
    priceSheetUrl: fd.get('priceSheetUrl'),
    priceFile,
    files,
    adsCreditRatio: Number(fd.get('adsCreditRatio') || 0) / 100,
    periodLabel: fd.get('periodLabel'),
    nextPeriodLabel: fd.get('nextPeriodLabel'),
    targetGrowthPct: Number(fd.get('targetGrowthPct') || 20)
  };
}

function groupedRows(result, key) {
  return Number(result.groupedRows?.[key] || 0);
}

function businessRevenueAvailable(result) {
  const source = result.kpis?.revenueSource;
  if (source === 'orders') return groupedRows(result, 'orders') > 0;
  if (source === 'settlement') return groupedRows(result, 'income') > 0 || groupedRows(result, 'onhold') > 0;
  if (source === 'gmvMax') return groupedRows(result, 'gmvMaxCreative') > 0;
  return hasMetricValue(result.kpis?.revenue);
}

function adsSpendAvailable(result) {
  return Boolean(result.ads?.actual?.hasSpendComponent);
}

function businessMetricCard(label, value, source, format = 'money', available = true) {
  return `
    <div class="${available ? '' : 'is-missing'}">
      <strong>${metricValue(value, format, available)}</strong>
      <span>${escapeHtml(label)}</span>
      <small>Nguon: ${escapeHtml(sourceLabel(source))}</small>
    </div>
  `;
}

function renderAdsSpendComponents(result) {
  const components = Array.isArray(result.ads?.actual?.components) ? result.ads.actual.components : [];
  if (!components.length) {
    return '<p class="hint">Chua co chi tiet Cash/Credit/Ads credit.</p>';
  }
  const rows = components.map(component => `
    <tr>
      <td>${escapeHtml(component.label)}</td>
      <td class="num">${metricValue(component.value, 'money', component.available)}</td>
      <td>${statusTag(component.available, component.source)}</td>
      <td class="num">${component.available ? metricValue(component.rows, 'number', true) : '<span class="missing-value">Chua co du lieu</span>'}</td>
      <td>${escapeHtml(component.note || '')}</td>
    </tr>
  `).join('');
  return `
    <div class="table-scroll spend-component-table">
      <table class="data-table">
        <thead><tr><th>Component</th><th>Value</th><th>Source/status</th><th>Rows</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRefundCancelBreakdown(result) {
  const refundCancel = result.orders?.refundCancel || {};
  const available = Boolean(refundCancel.available);
  const rows = (refundCancel.statusBreakdown || []).map(item => `
    <tr>
      <td>${escapeHtml(item.status)}</td>
      <td class="num">${metricValue(item.orders, 'number', available)}</td>
      <td class="num">${metricValue(item.rows, 'number', available)}</td>
    </tr>
  `).join('');
  return `
    <section class="mini-panel">
      <h3>Refund / Cancel</h3>
      <dl class="compact-list">
        <dt>Don anh huong</dt><dd>${metricValue(refundCancel.affectedOrders, 'number', available)}</dd>
        <dt>Ty le anh huong</dt><dd>${metricValue(refundCancel.affectedRate, 'percent', available)}</dd>
        <dt>So tien refund/cancel</dt><dd>${metricValue(refundCancel.amount, 'money', available)}</dd>
        <dt>Refund orders</dt><dd>${metricValue(refundCancel.refundOrders, 'number', available)}</dd>
        <dt>Cancel orders</dt><dd>${metricValue(refundCancel.cancelOrders, 'number', available)}</dd>
        <dt>Nguon</dt><dd>${statusTag(available, refundCancel.source || 'missing')}</dd>
      </dl>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Status</th><th>Orders</th><th>Rows</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">Chua co cot status/refund/cancel trong file don hang.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBusinessDataContext(result) {
  const selectedShop = selectedShopContext();
  const overview = result.shopOverview || {};
  const dataSourceStatus = result.dataSourceStatus || overview.dataSourceStatus || {};
  const crawlerOk = Boolean(overview.ok);
  const fileCount = (result.fileSummary || []).length;
  const uploadedRows = Object.values(result.groupedRows || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const priceSource = result.priceRows
    ? ((result.warnings || []).some(item => /cache/i.test(item)) ? 'cached' : 'uploaded')
    : 'missing';
  const freshnessGap = dataSourceStatus.freshnessGap || {};
  return `
    <section class="context-panel">
      <div class="panel-header">
        <h3>Data context</h3>
        <p>Thong tin nay giup biet so lieu dang xem la realtime, cache local, file upload hay dang thieu.</p>
      </div>
      <div class="context-grid">
        <div><strong>${escapeHtml(selectedShop.label)}</strong><span>Shop/profile dang chon</span></div>
        <div><strong>${fileCount ? `${fileCount} file / ${money(uploadedRows)} dong` : 'Chua upload file'}</strong><span>Nguon uploaded</span></div>
        <div><strong>${crawlerOk ? 'Cache crawler local' : 'Chua co crawler data'}</strong><span>Trang thai crawler</span></div>
        <div><strong>${formatTimestamp(overview.updatedAt || overview.crawlerSummary?.finishedAt || overview.crawlerSummary?.startedAt)}</strong><span>Last crawl timestamp</span></div>
        <div><strong>${escapeHtml(sourceLabel(priceSource))}</strong><span>Bang gia goc</span></div>
        <div><strong>${overview.runId ? escapeHtml(overview.runId) : 'Chua co'}</strong><span>Crawler run ID</span></div>
        <div><strong>${escapeHtml(sourceLabel(dataSourceStatus.effectiveSource || overview.sourceStatus || 'missing'))}</strong><span>Nguon dang xem</span></div>
        <div><strong>${yesNo(dataSourceStatus.fallbackUsed)}</strong><span>Fallback cache</span></div>
      </div>
      ${freshnessGap.exists ? `<p class="hint freshness-gap-note">Realtime completed, nhung KPI hien van dua tren cached overview/Compass.</p>` : ''}
      ${dataSourceStatus.nextAction ? `<p class="hint">Next action: ${escapeHtml(dataSourceStatus.nextAction)}</p>` : ''}
    </section>
  `;
}

function renderShopOverviewMetrics(overview = {}) {
  const cards = Array.isArray(overview.cards) ? overview.cards : [];
  if (!cards.length) {
    return `
      <section class="mini-panel">
        <h3>Crawler metrics</h3>
        <p class="hint">Chua co crawler data yet. Bam TikTok Crawler de crawl realtime, hoac upload file trong Phan tich KD.</p>
      </section>
    `;
  }
  const rows = cards.map(card => `
    <tr>
      <td>${escapeHtml(card.label)}</td>
      <td class="num">${metricValue(card.value, card.format, card.available)}</td>
      <td>${statusTag(card.available, card.source)}</td>
      <td>${escapeHtml(card.note || '')}</td>
    </tr>
  `).join('');
  return `
    <section class="mini-panel">
      <h3>Crawler metric source</h3>
      <div class="meta-line">
        <span>Shop DB: ${escapeHtml(overview.shopId || 'Chua co')}</span>
        <span>Range: ${escapeHtml(overview.rangeLabel || 'Chua co')}</span>
        <span>Source: ${escapeHtml(overview.endpoint || 'Chua co endpoint')}</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Metric</th><th>Value</th><th>Source/status</th><th>Note</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBusinessResult(result, mode = 'analysis') {
  state.businessResult = result;
  const fileRows = (result.fileSummary || []).map(file => `
    <tr><td>${escapeHtml(file.name)}</td><td>${escapeHtml(file.type)}</td><td>${file.rows}</td></tr>
  `).join('');
  const refundCancelAvailable = Boolean(result.orders?.refundCancel?.available);
  const topSkuRows = (result.orders?.topSkus || []).slice(0, 8).map(item => `
    <tr>
      <td>${escapeHtml(item.skuName)}</td>
      <td class="num">${money(item.units)}</td>
      <td class="num">${money(item.revenue)}</td>
      <td class="num">${money(item.revenue - item.cost)}</td>
      <td class="num">${metricValue(item.refundCancelOrders, 'number', refundCancelAvailable)}</td>
      <td class="num">${metricValue(item.netRevenueEstimate, 'money', refundCancelAvailable)}</td>
    </tr>
  `).join('');
  const planRows = (result.plan?.focusSkus || []).map(item => `
    <tr>
      <td>${escapeHtml(item.skuName)}</td>
      <td class="num">${money(item.revenue)}</td>
      <td class="num">${money(item.grossProfit)}</td>
    </tr>
  `).join('');
  const topVideoRows = (result.content?.video?.top || []).slice(0, 6).map(item => `
    <tr><td>${escapeHtml(item.name)}</td><td class="num">${metricValue(item.gmv, 'money', true)}</td><td class="num">${metricValue(item.orders, 'number', true)}</td></tr>
  `).join('');
  const topLivestreamRows = (result.content?.livestream?.top || []).slice(0, 6).map(item => `
    <tr><td>${escapeHtml(item.name)}</td><td class="num">${metricValue(item.gmv, 'money', true)}</td><td class="num">${metricValue(item.orders, 'number', true)}</td></tr>
  `).join('');
  const topAffiliateRows = (result.affiliate?.performance?.topProducts || []).slice(0, 6).map(item => `
    <tr><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(item.creatorName || '')}</td><td class="num">${metricValue(item.gmv, 'money', true)}</td><td class="num">${metricValue(item.orders, 'number', true)}</td></tr>
  `).join('');
  const planActions = (result.plan?.actions || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const revenueAvailable = businessRevenueAvailable(result);
  const adsCostAvailable = adsSpendAvailable(result);
  const adsActualRowsAvailable = Number(result.ads?.actual?.rowsUsed || 0) > 0;
  const productCostAvailable = groupedRows(result, 'orders') > 0 && Number(result.priceRows || 0) > 0;
  const affiliateCostAvailable = groupedRows(result, 'affiliate') > 0;
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>${mode === 'plan' ? 'Ke hoach thang/quy toi' : 'Phan tich chi so kinh doanh'}</h2>
      <p>Basic view uu tien source, missing data, KPI chinh va next actions. Advanced detail nam ben duoi de doi chieu file/crawler khi can.</p>
    </div>
    ${renderBusinessHealthBand(result)}
    ${renderBusinessDataContext(result)}
    ${renderBusinessWarningPanel(result)}
    <div class="summary-grid business-kpis">
      ${businessMetricCard('Doanh thu', result.kpis?.revenue, result.kpis?.revenueSource || 'uploaded', 'money', revenueAvailable)}
      ${businessMetricCard('Loi nhuan uoc tinh', result.kpis?.netProfitEstimate, 'computed', 'money', revenueAvailable)}
      ${businessMetricCard('Net margin', result.kpis?.netMargin, 'computed', 'percent', revenueAvailable && Number(result.kpis?.revenue || 0) !== 0)}
      ${businessMetricCard('Ads thuc te', result.costs?.adsActualCost, 'uploaded', 'money', adsCostAvailable)}
      ${businessMetricCard('Refund/cancel', result.orders?.refundCancel?.affectedOrders, result.orders?.refundCancel?.source || 'missing', 'number', refundCancelAvailable)}
      ${businessMetricCard('Gia von hang ban', result.costs?.productCost, 'uploaded', 'money', productCostAvailable)}
      ${businessMetricCard('Mau + ship affiliate', Number(result.affiliate?.sampleCost || 0) + Number(result.affiliate?.shipping || 0), 'uploaded', 'money', affiliateCostAvailable)}
    </div>
    ${renderBusinessNextActions(result)}
    ${renderShopOverviewMetrics(result.shopOverview)}
    <div class="analysis-grid">
      <section class="mini-panel">
        <h3>Ads GMV Max</h3>
        <dl class="compact-list">
          <dt>Cash + Credit + Ads credit</dt><dd>${metricValue(result.ads?.actual?.actualCost, 'money', adsCostAvailable)}</dd>
          <dt>Cash</dt><dd>${metricValue(result.ads?.actual?.cash, 'money', result.ads?.actual?.cashRows > 0)}</dd>
          <dt>Credit</dt><dd>${metricValue(result.ads?.actual?.credit, 'money', result.ads?.actual?.creditRows > 0)}</dd>
          <dt>Ads credit total</dt><dd>${metricValue(result.ads?.actual?.adsCreditTotal, 'money', result.ads?.actual?.adsCreditRows > 0)}</dd>
          <dt>Chi phi gom chiet khau</dt><dd>${metricValue(result.ads?.gmvMax?.costWithDiscount, 'money', groupedRows(result, 'gmvMaxCreative') > 0)}</dd>
          <dt>GMV ads</dt><dd>${metricValue(result.ads?.gmvMax?.gmv, 'money', groupedRows(result, 'gmvMaxCreative') > 0)}</dd>
          <dt>ROI creative</dt><dd>${metricValue(result.ads?.gmvMax?.roi, 'decimal', groupedRows(result, 'gmvMaxCreative') > 0)}</dd>
          <dt>Dong GMV Max da dung</dt><dd>${metricValue(result.ads?.actual?.rowsUsed, 'number', adsActualRowsAvailable)}</dd>
          <dt>Match chi phi</dt><dd>${adsActualRowsAvailable ? escapeHtml(result.ads?.actual?.matchMode || '') : '<span class="missing-value">Chua co du lieu</span>'}</dd>
        </dl>
        ${renderAdsSpendComponents(result)}
      </section>
      <section class="mini-panel">
        <h3>Quyet toan</h3>
        <dl class="compact-list">
          <dt>Da quyet toan</dt><dd>${metricValue(result.settlements?.income?.amount, 'money', groupedRows(result, 'income') > 0)}</dd>
          <dt>Se quyet toan</dt><dd>${metricValue(result.settlements?.onhold?.amount, 'money', groupedRows(result, 'onhold') > 0)}</dd>
          <dt>Don hang</dt><dd>${metricValue(result.kpis?.orders, 'number', groupedRows(result, 'orders') > 0)}</dd>
          <dt>So luong ban</dt><dd>${metricValue(result.kpis?.units, 'number', groupedRows(result, 'orders') > 0)}</dd>
          <dt>Refund/cancel rate</dt><dd>${metricValue(result.orders?.refundCancel?.affectedRate, 'percent', refundCancelAvailable)}</dd>
        </dl>
      </section>
      ${renderRefundCancelBreakdown(result)}
      <section class="mini-panel">
        <h3>Content / KOC</h3>
        <dl class="compact-list">
          <dt>GMV Video</dt><dd>${metricValue(result.content?.video?.gmv, 'money', groupedRows(result, 'video') > 0)}</dd>
          <dt>GMV Livestream</dt><dd>${metricValue(result.content?.livestream?.gmv, 'money', groupedRows(result, 'livestream') > 0)}</dd>
          <dt>GMV Creator</dt><dd>${metricValue(result.content?.creator?.gmv, 'money', groupedRows(result, 'creator') > 0)}</dd>
          <dt>GMV Product affiliate</dt><dd>${metricValue(result.affiliate?.performance?.gmv, 'money', Boolean(result.affiliate?.performance?.available))}</dd>
          <dt>Affiliate commission</dt><dd>${metricValue(result.affiliate?.performance?.commission, 'money', Boolean(result.affiliate?.performance?.available))}</dd>
          <dt>Video rows</dt><dd>${metricValue(result.content?.video?.rows, 'number', groupedRows(result, 'video') > 0)}</dd>
          <dt>Livestream rows</dt><dd>${metricValue(result.content?.livestream?.rows, 'number', groupedRows(result, 'livestream') > 0)}</dd>
          <dt>Creator rows</dt><dd>${metricValue(result.content?.creator?.rows, 'number', groupedRows(result, 'creator') > 0)}</dd>
          <dt>Product affiliate rows</dt><dd>${metricValue(result.affiliate?.performance?.rows, 'number', Boolean(result.affiliate?.performance?.available))}</dd>
        </dl>
      </section>
      <section class="mini-panel">
        <h3>Chat luong mapping</h3>
        <dl class="compact-list">
          <dt>Gia goc rows</dt><dd>${money(result.priceRows)}</dd>
          <dt>San pham import</dt><dd>${money(result.productCatalog?.items?.length)}</dd>
          <dt>Alias map tu file SP</dt><dd>${money(result.productCatalog?.aliasCount)}</dd>
          <dt>Chua map gia</dt><dd>${money(result.productCatalog?.unmatched?.length)}</dd>
          <dt>File da nap</dt><dd>${money((result.fileSummary || []).length)}</dd>
        </dl>
      </section>
    </div>
    <div class="analysis-grid">
      <section class="mini-panel">
        <h3>Top SKU</h3>
        <table class="data-table"><thead><tr><th>SKU</th><th>SL</th><th>DT</th><th>Lai gop</th><th>Refund/cancel</th><th>Net DT est.</th></tr></thead><tbody>${topSkuRows || '<tr><td colspan="6">Chua co du lieu</td></tr>'}</tbody></table>
      </section>
      <section class="mini-panel">
        <h3>Top content / affiliate</h3>
        <div class="table-scroll">
          <table class="data-table"><thead><tr><th>Video</th><th>GMV</th><th>Orders</th></tr></thead><tbody>${topVideoRows || '<tr><td colspan="3">Chua co video performance</td></tr>'}</tbody></table>
        </div>
        <div class="table-scroll">
          <table class="data-table"><thead><tr><th>Livestream</th><th>GMV</th><th>Orders</th></tr></thead><tbody>${topLivestreamRows || '<tr><td colspan="3">Chua co livestream performance</td></tr>'}</tbody></table>
        </div>
        <div class="table-scroll">
          <table class="data-table"><thead><tr><th>Product affiliate</th><th>Creator</th><th>GMV</th><th>Orders</th></tr></thead><tbody>${topAffiliateRows || '<tr><td colspan="4">Chua co product affiliate performance</td></tr>'}</tbody></table>
        </div>
      </section>
      <section class="mini-panel">
        <h3>Ke hoach goi y</h3>
        <dl class="compact-list">
          <dt>Muc tieu doanh thu</dt><dd>${money(result.plan?.targetRevenue)}</dd>
          <dt>Ngan sach ads goi y</dt><dd>${money(result.plan?.suggestedAdsBudget)}</dd>
          <dt>ROI hoa von</dt><dd>${metricValue(result.plan?.breakEvenRoi, 'decimal', hasMetricValue(result.plan?.breakEvenRoi))}</dd>
          <dt>ROI hien tai</dt><dd>${metricValue(result.plan?.currentRoi, 'decimal', hasMetricValue(result.plan?.currentRoi))}</dd>
        </dl>
        <ul class="plan-actions">${planActions}</ul>
      </section>
    </div>
    <details class="mini-panel advanced-detail">
      <summary>Advanced detail: file, SKU plan, raw result export</summary>
      <div class="advanced-detail-grid">
        <section>
          <h3>SKU uu tien cho ke hoach</h3>
          <table class="data-table"><thead><tr><th>SKU</th><th>Doanh thu cu</th><th>Lai gop uoc tinh</th></tr></thead><tbody>${planRows || '<tr><td colspan="3">Chua co du lieu</td></tr>'}</tbody></table>
        </section>
        <section>
          <h3>File da nhan dien</h3>
          <table class="data-table"><thead><tr><th>File</th><th>Loai</th><th>Rows</th></tr></thead><tbody>${fileRows || '<tr><td colspan="3">Chua co file</td></tr>'}</tbody></table>
        </section>
      </div>
    </details>
    <div class="actions">
      <button id="businessAnalyzeAgain">Nap lai file</button>
      <button id="businessShowPlan" class="secondary">Xem ke hoach</button>
      <button id="businessDownloadPlan" class="secondary">Tai ke hoach CSV</button>
      <button id="businessDownloadJson" class="secondary">Tai ket qua JSON</button>
    </div>
  `;
  bindClick('#businessAnalyzeAgain', renderBusinessAnalysisWorkspace);
  bindClick('#businessShowPlan', () => renderBusinessResult(result, 'plan'));
  bindClick('#businessDownloadPlan', () => downloadTextFile('strange-tts-ke-hoach.csv', exportBusinessPlanCsv(result), 'text/csv;charset=utf-8'));
  bindClick('#businessDownloadJson', () => downloadTextFile('strange-tts-phan-tich.json', JSON.stringify(result, null, 2), 'application/json;charset=utf-8'));
}

function renderBusinessAnalysisWorkspace() {
  workspaceContent.innerHTML = `
    <form id="businessAnalysisForm" class="workspace-content">
      <div class="panel-header">
        <h2>Phan tich chi so kinh doanh</h2>
        <p>Nap file truoc, app se tach ro uploaded data, crawler data, missing/warning, KPI/result va next actions.</p>
      </div>
      ${renderBusinessHealthBand()}
      <section class="data-flow-section">
        <div class="flow-step">
          <div>${flowStatusTag('1', 'neutral')}</div>
          <div>
            <h3>Upload data</h3>
            <p>File business la bat buoc. Bang gia co the lay tu Google Sheet, file upload, hoac cache local neu da co.</p>
            <label>
              Google Sheet gia goc
              <input name="priceSheetUrl" value="https://docs.google.com/spreadsheets/d/1RlaQAhHvLdFrYiG3q80DyVWrJZBmrvLPsrCGGRO_AWo/edit?gid=478274778#gid=478274778" autocomplete="off">
            </label>
            <label>
              Hoac upload file gia goc (.xlsx/.csv/.tsv) - lay cot A va H
              <input name="priceFile" type="file" accept=".xlsx,.csv,.tsv,.txt">
            </label>
            <label>
              File TikTok Seller/Ads/KOC (.xlsx/.csv/.tsv), co the chon nhieu file
              <input name="businessFiles" type="file" accept=".xlsx,.csv,.tsv,.txt" multiple required>
            </label>
          </div>
        </div>
        <div class="flow-step">
          <div>${flowStatusTag('2', 'neutral')}</div>
          <div>
            <h3>Calculation settings</h3>
            <p>Cac setting nay chi dieu khien cach hien thi ke hoach va Ads credit, khong doc cookie/session.</p>
            <div class="form-grid">
              <label>Ky du lieu cu<input name="periodLabel" placeholder="VD: Thang 5/2026"></label>
              <label>Ky ke hoach<input name="nextPeriodLabel" placeholder="VD: Thang 6/2026 / Q3"></label>
              <label>Ty le tinh Ads credit con lai (%)<input name="adsCreditRatio" type="number" min="0" max="100" step="1" value="50"></label>
              <label>Tang truong muc tieu (%)<input name="targetGrowthPct" type="number" min="0" max="500" step="1" value="20"></label>
            </div>
          </div>
        </div>
      </section>
      <button type="submit">Phan tich va tao ke hoach</button>
    </form>
  `;
  document.querySelector('#businessAnalysisForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Dang doc file';
    try {
      const payload = await buildBusinessPayload(event.currentTarget);
      button.textContent = 'Dang tinh KPI';
      const result = await api('/api/business/analyze', { method: 'POST', body: payload });
      setOutput({ ok: true, generatedAt: result.generatedAt, groupedRows: result.groupedRows, warnings: result.warnings });
      renderBusinessResult(result);
    } catch (error) {
      setOutput(error.data || error.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
}

function renderBusinessPlanWorkspace() {
  if (state.businessResult) {
    renderBusinessResult(state.businessResult, 'plan');
    return;
  }
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Ke hoach thang/quy toi</h2>
      <p>Chua co data cu trong phien nay. Nap file o man Phan tich KD truoc, app se tao ke hoach dua tren KPI vua tinh.</p>
    </div>
    <button id="openBusinessAnalysisFromPlan">Nap file de tao ke hoach</button>
  `;
  bindClick('#openBusinessAnalysisFromPlan', renderBusinessAnalysisWorkspace);
}

function renderCrawlerRows(monthData) {
  const rows = monthData?.daily || [];
  if (!rows.length) return '<p>Chua co du lieu daily cho thang nay.</p>';
  const crawlTime = monthData?.crawledAt || '';
  return `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>Ngay</th>
            <th>GMV</th>
            <th>Video</th>
            <th>The SP</th>
            <th>Lien ket</th>
            <th>Lien ket Video</th>
            <th>Truc tiep</th>
            <th>Gian tiep</th>
            <th>Nguon</th>
            <th>Last crawl</th>
            <th>Raw fields</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.startDate)}</td>
              <td>${metricValue(row.totalGmv, 'money', hasMetricValue(row.totalGmv))}</td>
              <td>${metricValue(row.contentVideoGmv, 'money', hasMetricValue(row.contentVideoGmv))}</td>
              <td>${metricValue(row.contentProductCardGmv, 'money', hasMetricValue(row.contentProductCardGmv))}</td>
              <td>${metricValue(row.affiliateTotalGmv, 'money', hasMetricValue(row.affiliateTotalGmv))}</td>
              <td>${metricValue(row.affiliateVideoGmv, 'money', hasMetricValue(row.affiliateVideoGmv))}</td>
              <td>${metricValue(row.affiliateVideoDirectGmv, 'money', hasMetricValue(row.affiliateVideoDirectGmv))}</td>
              <td>${metricValue(row.affiliateVideoIndirectGmv, 'money', hasMetricValue(row.affiliateVideoIndirectGmv))}</td>
              <td>${statusTag(true, 'cached')}</td>
              <td>${escapeHtml(formatTimestamp(crawlTime))}</td>
              <td>${metricValue(row.rawFieldCount, 'number', hasMetricValue(row.rawFieldCount))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCrawlerBusinessInsight(database, activeMonth) {
  const months = Object.keys(database?.months || {}).sort();
  const current = database?.months?.[activeMonth]?.aggregate?.[0];
  const previousMonth = months[months.indexOf(activeMonth) - 1];
  const previous = previousMonth ? database.months[previousMonth]?.aggregate?.[0] : null;
  if (!current) return '';
  const growth = previous?.totalGmv ? (current.totalGmv - previous.totalGmv) / previous.totalGmv : 0;
  const affiliateShare = current.totalGmv ? current.affiliateTotalGmv / current.totalGmv : 0;
  const videoShare = current.totalGmv ? current.contentVideoGmv / current.totalGmv : 0;
  const directShare = current.affiliateVideoGmv ? current.affiliateVideoDirectGmv / current.affiliateVideoGmv : 0;
  return `
    <div class="summary-grid business-kpis">
      ${businessMetricCard(`GMV ${activeMonth}`, current.totalGmv, 'cached', 'money', hasMetricValue(current.totalGmv))}
      ${businessMetricCard(`Tang truong so voi ${previousMonth || 'ky truoc'}`, growth, 'computed', 'percent', Boolean(previous))}
      ${businessMetricCard('Ty trong lien ket', affiliateShare, 'computed', 'percent', hasMetricValue(current.affiliateTotalGmv) && hasMetricValue(current.totalGmv))}
      ${businessMetricCard('Ty trong video', videoShare, 'computed', 'percent', hasMetricValue(current.contentVideoGmv) && hasMetricValue(current.totalGmv))}
      ${businessMetricCard('Video lien ket truc tiep', directShare, 'computed', 'percent', hasMetricValue(current.affiliateVideoDirectGmv) && hasMetricValue(current.affiliateVideoGmv))}
    </div>
  `;
}

function latestCompassTimestamp(database = {}, activeMonth = '') {
  return database.months?.[activeMonth]?.crawledAt || database.updatedAt || '';
}

const CRAWLER_FAILURE_LABELS = {
  not_logged_in: 'Need login',
  cookie_missing: 'Cookie missing',
  cookie_expired: 'Cookie expired',
  wrong_shop_suspected: 'Wrong shop suspected',
  captcha_or_verification_needed: 'Captcha / verification needed',
  seller_center_unavailable: 'Seller Center unavailable',
  compass_unavailable: 'Compass unavailable',
  cdp_unavailable: 'Browser/CDP unavailable',
  active_job_running: 'Active job running',
  api_response_changed: 'API response changed',
  selector_changed: 'UI selector changed',
  network_error: 'Network error',
  parse_error: 'Parse error',
  partial_capture: 'Partial capture',
  unknown: 'Unknown issue'
};

function crawlerFailureLabel(reason = '') {
  return CRAWLER_FAILURE_LABELS[reason] || (reason ? reason.replaceAll('_', ' ') : 'Khong co');
}

function crawlerStatusTone(status = '') {
  if (['ready', 'completed'].includes(status)) return 'ok';
  if (['need-login', 'cookie-expired', 'partial'].includes(status)) return 'warn';
  if (status === 'failed') return 'danger';
  if (status === 'crawling') return 'neutral';
  return 'neutral';
}

function crawlerStateLabel({ selectedShop, active, sellerCenter, confirmation, crawlerStatus }) {
  if (crawlerStatus?.status) {
    const status = String(crawlerStatus.status || '').replace('_', '-');
    const labels = {
      ready: 'Ready',
      'need-login': 'Need login/cookies',
      'cookie-expired': 'Cookie expired / re-login',
      crawling: 'Crawling',
      completed: 'Completed',
      failed: 'Failed',
      partial: 'Partial'
    };
    const reason = crawlerStatus.failureReason
      ? crawlerFailureLabel(crawlerStatus.failureReason)
      : crawlerStatus.partialReason || crawlerStatus.sessionHint || 'Safe status metadata is available.';
    return { key: status, label: labels[status] || labels.ready, tone: crawlerStatusTone(status), reason };
  }
  const unresolvedCount = Array.isArray(sellerCenter?.unresolved) ? sellerCenter.unresolved.length : 0;
  if (!selectedShop.id) {
    return { key: 'need-login', label: 'Need shop/profile', tone: 'warn', reason: 'Chua chon shop/profile.' };
  }
  if (!selectedShop.cookieCount || selectedShop.cookieStorage === 'none') {
    return { key: 'need-login', label: 'Need login/cookies', tone: 'warn', reason: 'Profile chua co encrypted cookie metadata.' };
  }
  if (confirmation?.status === 'wrong-shop') {
    return { key: 'failed', label: 'Wrong shop', tone: 'danger', reason: 'Local confirmation dang bao sai shop.' };
  }
  if (confirmation?.status === 'not-logged-in') {
    return { key: 'need-login', label: 'Need login', tone: 'warn', reason: 'Operator da danh dau profile chua dang nhap.' };
  }
  if (confirmation?.status === 'needs-relogin') {
    return { key: 'cookie-expired', label: 'Cookie expired / re-login', tone: 'warn', reason: 'Operator da danh dau can dang nhap lai.' };
  }
  if (unresolvedCount && (active || sellerCenter?.runId)) {
    return { key: 'partial', label: 'Partial', tone: 'warn', reason: `${unresolvedCount} module can xem lai.` };
  }
  if (active || sellerCenter?.runId) {
    return { key: 'completed', label: 'Completed', tone: 'ok', reason: 'Co latest local crawl data.' };
  }
  if (confirmation?.status === 'correct-shop') {
    return { key: 'ready', label: 'Ready', tone: 'ok', reason: 'Dung shop/profile theo local confirmation.' };
  }
  return { key: 'ready', label: 'Ready to check', tone: 'neutral', reason: 'Hay confirm profile truoc khi crawl that.' };
}

function renderCrawlerProfileCard(selectedShop, confirmation, crawlerStatus) {
  const status = confirmationLabel(confirmation?.status);
  const contractShop = crawlerStatus?.selectedShop || {};
  return `
    <section class="crawler-state-card">
      <div class="panel-header compact">
        <h3>Selected shop/profile</h3>
        <p>Chi hien metadata an toan. Khong hien cookie/token/session value.</p>
      </div>
      <div class="context-grid crawler-context-grid">
        <div><strong>${escapeHtml(contractShop.name || selectedShop.label)}</strong><span>Shop/profile</span></div>
        <div><strong>${escapeHtml(contractShop.sellerId || selectedShop.sellerId || 'Missing')}</strong><span>Seller ID</span></div>
        <div><strong>${escapeHtml(contractShop.adsAccountId || selectedShop.adsAccountId || 'Missing')}</strong><span>Ads account</span></div>
        <div><strong>${escapeHtml(status)}</strong><span>Local confirmation</span></div>
      </div>
    </section>
  `;
}

function renderCrawlerSecurityCard(selectedShop, crawlerStatus) {
  const cookieCount = crawlerStatus?.cookieCount ?? selectedShop.cookieCount;
  const cookieStorage = crawlerStatus?.cookieStorageStatus || selectedShop.cookieStorage || 'none';
  const cookieUpdatedAt = crawlerStatus?.cookieUpdatedAt || selectedShop.cookieUpdatedAt;
  return `
    <section class="crawler-state-card">
      <div class="panel-header compact">
        <h3>Safe cookie/session metadata</h3>
        <p>Phase 1 chi dung count/status de operator biet profile co san sang hay khong.</p>
      </div>
      <div class="context-grid crawler-context-grid">
        <div><strong>${metricValue(cookieCount, 'number', cookieCount > 0)}</strong><span>Cookie count</span></div>
        <div><strong>${escapeHtml(cookieStorage)}</strong><span>Cookie storage</span></div>
        <div><strong>${formatTimestamp(cookieUpdatedAt)}</strong><span>Cookie updated</span></div>
        <div><strong>${escapeHtml(selectedShop.loginNote || 'Chua co')}</strong><span>Login note</span></div>
      </div>
    </section>
  `;
}

function renderCrawlerRunStatus({ stateInfo, database, activeMonth, active, sellerCenter, crawlerStatus }) {
  const unresolved = Array.isArray(sellerCenter?.unresolved) ? sellerCenter.unresolved : [];
  const latestRun = crawlerStatus?.latestRun || {};
  const latestTime = latestRun.updatedAt || latestCompassTimestamp(database, activeMonth) || sellerCenter.startedAt || sellerCenter.finishedAt;
  const failureReason = crawlerFailureLabel(crawlerStatus?.failureReason || '');
  const partialReason = crawlerStatus?.partialReason || '';
  const missingMetrics = Array.isArray(crawlerStatus?.missingMetrics) ? crawlerStatus.missingMetrics : [];
  const failureRows = unresolved.slice(0, 6).map(item => `
    <li>${escapeHtml(item.module || 'Module')} - ${escapeHtml(item.failureReason ? crawlerFailureLabel(item.failureReason) : (item.reason || item.notes || 'Can xem lai'))}</li>
  `).join('');
  const contractFailureRows = [
    crawlerStatus?.failureReason ? `<li>${escapeHtml(failureReason)}</li>` : '',
    partialReason ? `<li>${escapeHtml(partialReason)}</li>` : '',
    missingMetrics.length ? `<li>Missing metrics: ${escapeHtml(missingMetrics.join(', '))}</li>` : ''
  ].filter(Boolean).join('');
  return `
    <section class="crawler-status-panel ${escapeHtml(stateInfo.tone)}">
      <div class="crawler-status-head">
        <div>
          ${flowStatusTag(stateInfo.label, stateInfo.tone)}
          <h3>Current crawler state</h3>
          <p>${escapeHtml(stateInfo.reason)}</p>
        </div>
        <div class="crawler-status-meta">
          <strong>${escapeHtml(crawlerStatus?.runId || latestRun.runId || sellerCenter.runId || active?.runId || database.runId || 'Chua co run')}</strong>
          <span>Latest run ID</span>
        </div>
      </div>
      <div class="context-grid crawler-context-grid">
        <div><strong>${Object.keys(database.months || {}).length}</strong><span>Compass months</span></div>
        <div><strong>${active?.daily?.length || 0}</strong><span>Daily rows</span></div>
        <div><strong>${formatTimestamp(latestTime)}</strong><span>Latest timestamp</span></div>
        <div><strong>${escapeHtml(crawlerStatus?.failureReason ? failureReason : (unresolved.length ? `${unresolved.length} issue` : 'Khong co'))}</strong><span>Failure/partial reason</span></div>
      </div>
      ${contractFailureRows || failureRows ? `<div class="failure-panel"><h4>Failure reason / partial modules</h4><ul>${contractFailureRows}${failureRows}</ul></div>` : ''}
      ${renderCdpRecoveryPanel({ crawlerStatus })}
    </section>
  `;
}

async function renderTikTokCrawlerWorkspaceLegacy() {
  const shopId = 'little-apricot-hawaii-fashion';
  let database = null;
  let sellerCenter = null;
  try {
    const data = await api(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`);
    database = data.database;
    sellerCenter = data.sellerCenter;
  } catch {
    database = { months: {} };
    sellerCenter = { summary: {}, modules: [], unresolved: [] };
  }
  const months = Object.keys(database.months || {}).sort();
  const activeMonth = months.at(-1) || '2026-05';
  const active = database.months?.[activeMonth];
  const moduleRows = (sellerCenter?.modules || []).map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td class="num">${money(item.apiCount)}</td>
      <td class="num">${money(item.exportCount)}</td>
      <td class="num">${money(item.rowCount)}</td>
      <td>${escapeHtml(item.notes || '')}</td>
    </tr>
  `).join('');
  workspaceContent.innerHTML = `
    <form id="tiktokCrawlerForm" class="workspace-content">
      <div class="panel-header">
        <h2>TikTok Shop Crawler</h2>
        <p>Crawl số liệu Compass bằng browser profile đang đăng nhập, lưu raw response và bảng chỉ số riêng theo shop.</p>
      </div>
      <div class="summary-grid">
        <div><strong>${escapeHtml(shopId)}</strong><span>Shop DB</span></div>
        <div><strong>${months.length}</strong><span>Thang da luu</span></div>
        <div><strong>${active?.daily?.length || 0}</strong><span>Dong daily</span></div>
      </div>
      <label>
        CDP port cua profile TikTok
        <input name="cdpPort" value="58849" autocomplete="off">
      </label>
      <label>
        Seller ID
        <input name="sellerId" value="7494478078863902049" autocomplete="off">
      </label>
      <label>
        Thang can crawl
        <input name="months" value="${escapeHtml(currentMonthKey())}" autocomplete="off">
      </label>
      <div class="actions">
        <button type="submit">Crawl va cap nhat DB</button>
        <button type="button" class="secondary" id="reloadCrawlerDb">Tai lai DB</button>
      </div>
    </form>
    <div class="panel-header">
      <h2>Bang chi so ${escapeHtml(activeMonth)}</h2>
      <p>${active ? `Raw: ${escapeHtml(active.rawFiles?.aggregate || '')} | ${escapeHtml(active.rawFiles?.daily || '')}` : 'Chua co du lieu.'}</p>
    </div>
    ${renderCrawlerBusinessInsight(database, activeMonth)}
    ${renderCrawlerRows(active)}
  `;
  document.querySelector('#tiktokCrawlerForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.submitter;
    button.disabled = true;
    button.textContent = 'Dang crawl...';
    try {
      const result = await api('/api/tiktokshop-crawler/crawl', {
        method: 'POST',
        body: {
          shopId,
          cdpPort: Number(form.get('cdpPort') || 58849),
          sellerId: form.get('sellerId'),
          months: String(form.get('months') || '').split(',').map(item => item.trim()).filter(Boolean)
        }
      });
      setOutput(result);
      await renderTikTokCrawlerWorkspace();
    } catch (error) {
      setOutput(error.data || error.message);
    }
  });
  bindClick('#reloadCrawlerDb', renderTikTokCrawlerWorkspace);
}

async function renderTikTokCrawlerWorkspace() {
  const selectedShop = selectedShopContext();
  const shopId = selectedShop.id || 'little-apricot-hawaii-fashion';
  const defaultSellerId = selectedShop.sellerId || '7494478078863902049';
  let database = { months: {} };
  let sellerCenter = { summary: {}, modules: [], unresolved: [] };
  let crawlerStatus = null;
  try {
    const data = await api(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`);
    database = data.database || database;
    sellerCenter = data.sellerCenter || sellerCenter;
    crawlerStatus = data.crawlerStatus || null;
    if (crawlerStatus && data.cdpStatus) {
      crawlerStatus = { ...crawlerStatus, cdpStatus: data.cdpStatus };
    }
  } catch {}

  const months = Object.keys(database.months || {}).sort();
  const activeMonth = months.at(-1) || '2026-05';
  const active = database.months?.[activeMonth];
  const moduleRows = (sellerCenter.modules || []).map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td class="num">${money(item.apiCount)}</td>
      <td class="num">${money(item.exportCount)}</td>
      <td class="num">${money(item.rowCount)}</td>
      <td>${escapeHtml(item.notes || '')}</td>
    </tr>
  `).join('');

  const confirmation = selectedShop.id ? readShopSessionConfirmation(selectedShop.id) : null;
  const stateInfo = crawlerStateLabel({ selectedShop, active, sellerCenter, confirmation, crawlerStatus });
  workspaceContent.innerHTML = `
    <form id="tiktokCrawlerForm" class="workspace-content">
      <div class="panel-header">
        <h2>TikTok Shop Crawler</h2>
        <p>Basic view cho biet shop/profile, safe cookie metadata, current state, latest run va failure reason truoc khi xem technical detail.</p>
      </div>
      ${renderCrawlerProfileCard(selectedShop, confirmation, crawlerStatus)}
      ${renderCrawlerSecurityCard(selectedShop, crawlerStatus)}
      ${renderCrawlerRunStatus({ stateInfo, database, activeMonth, active, sellerCenter, crawlerStatus })}
      <section class="data-flow-section">
        <div class="flow-step">
          <div>${flowStatusTag('Basic', stateInfo.tone)}</div>
          <div>
            <h3>Crawl controls</h3>
            <p>Mac dinh auto-open dung managed profile. CDP port chi dung khi tat auto-open.</p>
            <label><input type="checkbox" name="autoOpenProfile" checked> Tu mo dung profile shop va dung session/cookie local da nap</label>
            <div class="form-grid">
              <label>Seller ID<input name="sellerId" value="${escapeHtml(defaultSellerId)}" autocomplete="off"></label>
              <label>Thang can crawl Compass<input name="months" value="${escapeHtml(currentMonthKey())}" autocomplete="off"></label>
              <label>CDP port thu cong<input name="cdpPort" value="58849" autocomplete="off"></label>
              <label>Gioi han module Seller Center (0 = toan bo)<input name="maxModules" value="0" autocomplete="off"></label>
            </div>
            <label>URL goc Seller Center<input name="baseUrl" value="https://seller-vn.tiktok.com/homepage?shop_region=VN" autocomplete="off"></label>
          </div>
        </div>
      </section>
      <div class="actions">
        <button type="submit" value="compass">Crawl Compass</button>
        <button type="submit" value="seller-center" class="secondary">Crawl Seller Center full hom qua</button>
        <button type="button" class="secondary" id="reloadCrawlerDb">Tai lai DB</button>
      </div>
    </form>
    <div class="panel-header">
      <h2>Compass basic metrics ${escapeHtml(activeMonth)}</h2>
      <p>${active ? 'Source cache local. Raw path va module report nam trong Advanced detail.' : 'Chua co du lieu Compass cho shop/profile nay.'}</p>
    </div>
    ${renderCrawlerBusinessInsight(database, activeMonth)}
    ${renderCrawlerRows(active)}
    <details class="mini-panel advanced-detail">
      <summary>Advanced / technical detail</summary>
      <div class="advanced-detail-grid">
        <section>
          <h3>Seller Center latest run</h3>
          <p>${sellerCenter.runId ? `Run: ${escapeHtml(sellerCenter.runId)} | Output: ${escapeHtml(sellerCenter.outputDir || '')}` : 'Chua co crawl Seller Center.'}</p>
          <div class="context-grid crawler-context-grid">
            <div><strong>${money(sellerCenter.summary?.apiEndpoints)}</strong><span>API endpoints</span></div>
            <div><strong>${money(sellerCenter.summary?.rawFiles)}</strong><span>Raw files</span></div>
            <div><strong>${money(sellerCenter.summary?.exportRequests)}</strong><span>Export requests</span></div>
            <div><strong>${escapeHtml(shopId)}</strong><span>Shop DB</span></div>
          </div>
        </section>
        <section>
          <h3>Compass raw paths</h3>
          <p>${active ? `Aggregate: ${escapeHtml(active.rawFiles?.aggregate || 'Chua co')} | Daily: ${escapeHtml(active.rawFiles?.daily || 'Chua co')}` : 'Chua co du lieu.'}</p>
        </section>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Module</th><th>Trang thai</th><th>API</th><th>Export</th><th>Dong</th><th>Ghi chu</th></tr></thead>
          <tbody>${moduleRows || '<tr><td colspan="6">Chua co report.</td></tr>'}</tbody>
        </table>
      </div>
    </details>
  `;
  document.querySelector('#tiktokCrawlerForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.submitter;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Dang crawl...';
    try {
      const result = await api('/api/tiktokshop-crawler/crawl', {
        method: 'POST',
        body: {
          mode: button.value || 'compass',
          shopId,
          autoOpenProfile: form.get('autoOpenProfile') === 'on',
          cdpPort: Number(form.get('cdpPort') || 0),
          sellerId: form.get('sellerId'),
          baseUrl: form.get('baseUrl'),
          months: String(form.get('months') || '').split(',').map(item => item.trim()).filter(Boolean),
          dateRange: 'yesterday',
          maxModules: Number(form.get('maxModules') || 0)
        }
      });
      setOutput(result);
      await renderTikTokCrawlerWorkspace();
    } catch (error) {
      setOutput(error.data || error.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
  bindClick('#reloadCrawlerDb', renderTikTokCrawlerWorkspace);
  bindCdpRecoveryActions('crawler');
  return;

  workspaceContent.innerHTML = `
    <form id="tiktokCrawlerForm" class="workspace-content">
      <div class="panel-header">
        <h2>TikTok Shop Crawler</h2>
        <p>Crawl bằng browser profile đang đăng nhập. Ưu tiên bắt API Network, fallback click UI để discover menu, tab, filter, export, pagination và lưu raw trước khi normalize.</p>
      </div>
      <div class="summary-grid">
        <div><strong>${escapeHtml(shopId)}</strong><span>Shop DB</span></div>
        <div><strong>${months.length}</strong><span>Tháng Compass đã lưu</span></div>
        <div><strong>${active?.daily?.length || 0}</strong><span>Dòng daily</span></div>
        <div><strong>${escapeHtml(selectedShop.label)}</strong><span>Shop/profile dang chon</span></div>
        <div><strong>${months.length ? 'Cache Compass local' : 'No crawler data yet'}</strong><span>Nguon dang hien thi</span></div>
        <div><strong>${formatTimestamp(latestCompassTimestamp(database, activeMonth) || sellerCenter.startedAt)}</strong><span>Last crawl timestamp</span></div>
        <div><strong>${money(sellerCenter.summary?.apiEndpoints)}</strong><span>API Seller Center</span></div>
        <div><strong>${money(sellerCenter.summary?.rawFiles)}</strong><span>Raw files</span></div>
        <div><strong>${money(sellerCenter.summary?.exportRequests)}</strong><span>Lệnh export</span></div>
      </div>
      <label><input type="checkbox" name="autoOpenProfile" checked> Tu mo dung profile shop va dung session/cookie local da nap</label>
      <label>CDP port thu cong (khi tat tu mo profile)<input name="cdpPort" value="58849" autocomplete="off"></label>
      <label>Seller ID<input name="sellerId" value="${escapeHtml(defaultSellerId)}" autocomplete="off"></label>
      <label>URL gốc Seller Center<input name="baseUrl" value="https://seller-vn.tiktok.com/homepage?shop_region=VN" autocomplete="off"></label>
      <label>Tháng cần crawl Compass<input name="months" value="${escapeHtml(currentMonthKey())}" autocomplete="off"></label>
      <label>Giới hạn module Seller Center (0 = toàn bộ)<input name="maxModules" value="0" autocomplete="off"></label>
      <div class="actions">
        <button type="submit" value="compass">Crawl Compass</button>
        <button type="submit" value="seller-center" class="secondary">Crawl Seller Center full hôm qua</button>
        <button type="button" class="secondary" id="reloadCrawlerDb">Tải lại DB</button>
      </div>
    </form>
    <div class="panel-header">
      <h2>Seller Center crawl mới nhất</h2>
      <p>${sellerCenter.runId ? `Run: ${escapeHtml(sellerCenter.runId)} | Output: ${escapeHtml(sellerCenter.outputDir || '')}` : 'Chưa có crawl Seller Center.'}</p>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Module</th><th>Trạng thái</th><th>API</th><th>Export</th><th>Dòng</th><th>Ghi chú</th></tr></thead>
        <tbody>${moduleRows || '<tr><td colspan="6">Chưa có report.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="panel-header">
      <h2>Bảng chỉ số Compass ${escapeHtml(activeMonth)}</h2>
      <p>${active ? `Raw: ${escapeHtml(active.rawFiles?.aggregate || '')} | ${escapeHtml(active.rawFiles?.daily || '')}` : 'Chưa có dữ liệu.'}</p>
    </div>
    ${renderCrawlerBusinessInsight(database, activeMonth)}
    ${renderCrawlerRows(active)}
  `;
  document.querySelector('#tiktokCrawlerForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.submitter;
    button.disabled = true;
    button.textContent = 'Đang crawl...';
    try {
      const result = await api('/api/tiktokshop-crawler/crawl', {
        method: 'POST',
        body: {
          mode: button.value || 'compass',
          shopId,
          autoOpenProfile: form.get('autoOpenProfile') === 'on',
          cdpPort: Number(form.get('cdpPort') || 0),
          sellerId: form.get('sellerId'),
          baseUrl: form.get('baseUrl'),
          months: String(form.get('months') || '').split(',').map(item => item.trim()).filter(Boolean),
          dateRange: 'yesterday',
          maxModules: Number(form.get('maxModules') || 0)
        }
      });
      setOutput(result);
      await renderTikTokCrawlerWorkspace();
    } catch (error) {
      setOutput(error.data || error.message);
    } finally {
      button.disabled = false;
    }
  });
  bindClick('#reloadCrawlerDb', renderTikTokCrawlerWorkspace);
}

function renderGuideWorkspace() {
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Huong dan nhanh</h2>
      <p>Quy trinh dung app PC local cho nguoi non-tech.</p>
    </div>
    <div class="guide-list">
      <p><strong>1. Mo app:</strong> bam shortcut "Strange TTS PC App" tren Desktop. Khong can vao folder WSL hay chay npm thu cong.</p>
      <p><strong>2. Tao shop:</strong> bam Seller Ads, nhap ten shop, import cookies bang file JSON hoac dan JSON cookies.</p>
      <p><strong>3. Mo shop:</strong> chon shop trong dropdown hoac bam nut Seller Ads o danh sach Multishop. App se mo Chrome profile rieng, nap extension san, bom cookies va vao Seller Ads.</p>
      <p><strong>4. Sua camp GMV:</strong> thao tac trong cua so Seller Ads vua mo. Extension content script goc chay trong profile do de giu logic cu.</p>
      <p><strong>5. Bao mat:</strong> cookies/profile nam trong thu muc data local, khong hien token/cookie len man hinh log.</p>
    </div>
  `;
}

function renderDownloadWorkspace() {
  const selectedShop = selectedShopContext();
  const confirmation = selectedShop.id ? readShopSessionConfirmation(selectedShop.id) : null;
  const confirmationText = confirmation
    ? `${confirmationLabel(confirmation.status)} at ${formatTimestamp(confirmation.confirmedAt)}`
    : 'No confirmation yet';
  workspaceContent.innerHTML = `
    <form id="downloadVideoForm" class="workspace-content">
      <div class="panel-header">
        <h2>Tai video TikTok</h2>
        <p>Download by operator-provided URL only. Use this for videos the selected shop/profile can already view.</p>
      </div>
      <div class="shop-session-card">
        <div>
          <strong>${escapeHtml(selectedShop.name || 'Chua chon shop/profile')}</strong>
          <span>Profile: ${escapeHtml(selectedShop.id || 'Missing')}</span>
        </div>
        <dl class="compact-list">
          <dt>Seller ID</dt><dd>${escapeHtml(selectedShop.sellerId || 'Missing')}</dd>
          <dt>Ads account</dt><dd>${escapeHtml(selectedShop.adsAccountId || 'Missing')}</dd>
          <dt>Session check</dt><dd>${escapeHtml(confirmationText)}</dd>
        </dl>
      </div>
      <p class="hint">Khong dung de bypass DRM, private content, access control, hay shop/profile khac. Neu chua chac profile dung, hay check profile truoc.</p>
      <label>
        Link TikTok
        <input name="url" autocomplete="off" required placeholder="https://www.tiktok.com/@.../video/...">
      </label>
      <label class="check-row">
        <input type="checkbox" name="operatorCanView" required>
        Toi xac nhan shop/profile dang chon co quyen xem video nay.
      </label>
      <div class="actions dashboard-actions">
        <button type="submit">Tai video</button>
        <button type="button" class="secondary" id="downloadProfileCheck">Check profile</button>
      </div>
    </form>
  `;
  bindClick('#downloadProfileCheck', () => {
    if (!selectedShop.id) return setOutput('Chua chon shop/profile de check.');
    renderShopSessionSafety(selectedShop.id);
  });
  document.querySelector('#downloadVideoForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const original = button.textContent;
    const form = new FormData(event.currentTarget);
    if (!form.has('operatorCanView')) {
      setOutput('Can xac nhan shop/profile co quyen xem video truoc khi tai.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Dang tai';
    try {
      const data = await api('/api/video/download', {
        method: 'POST',
        body: {
          url: form.get('url'),
          operatorCanView: true,
          profileId: selectedShop.id || 'default-profile',
          shopName: selectedShop.name || ''
        }
      });
      setOutput(data);
      event.currentTarget.reset();
    } catch (error) {
      setOutput(error.data || error.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });
}

function renderVideoSettingsWorkspace() {
  workspaceContent.innerHTML = `
    <form id="videoSettingsForm" class="workspace-content">
      <div class="panel-header">
        <h2>Cai dat xem video</h2>
        <p>Cau hinh mac dinh cho module xem video trong app. Content script goc van duoc nap san trong profile Seller Ads.</p>
      </div>
      <label class="check-row"><input type="checkbox" name="productViewEnabled" ${checked(state.appConfig.productViewEnabled)}> Xem san pham: Bat</label>
      <label class="check-row"><input type="checkbox" name="videoAutoplay" ${checked(state.appConfig.videoAutoplay)}> Tu dong phat video</label>
      <label class="check-row"><input type="checkbox" name="videoSound" ${checked(state.appConfig.videoSound)}> Bat am thanh khi co the</label>
      <label class="check-row"><input type="checkbox" name="videoLoop" ${checked(state.appConfig.videoLoop)}> Lap lai video</label>
      <button type="submit">Luu cai dat</button>
    </form>
  `;
  document.querySelector('#videoSettingsForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patch = {
      productViewEnabled: form.has('productViewEnabled'),
      videoAutoplay: form.has('videoAutoplay'),
      videoSound: form.has('videoSound'),
      videoLoop: form.has('videoLoop')
    };
    try {
      const config = await saveAppConfig(patch);
      updateProductToggle(config.productViewEnabled);
      setOutput({ ok: true, config });
      await refreshStatus();
    } catch (error) {
      setOutput(error.data || error.message);
    }
  });
}

function updateProductToggle(enabled) {
  const button = document.querySelector('#btnProductToggle');
  if (!button) return;
  button.classList.toggle('enabled', enabled);
  button.textContent = enabled ? 'Xem sản phẩm: Bật' : 'Xem sản phẩm: Tắt';
}

function toggleRuntimeStatus() {
  const statusPanel = document.querySelector('#statusPanel');
  state.statusVisible = !state.statusVisible;
  statusPanel?.classList.toggle('hidden', !state.statusVisible);
  if (state.statusVisible) refreshStatus();
}

function renderShops(library) {
  const shops = library.shops || [];
  state.shops = shops;
  shopQuickSelect.innerHTML = '<option value="">--- Chọn shop để mở ---</option>' + shops
    .map(shop => `<option value="${escapeHtml(shop.id)}">${escapeHtml(shop.name)}</option>`)
    .join('');

  shopList.innerHTML = shops.length ? shops.map(shop => `
    <div class="shop-item">
      <div>
        <strong>${escapeHtml(shop.name)}</strong>
        <span>${escapeHtml(shop.id)} | cookies: ${shop.cookieCount || 0} | seller: ${escapeHtml(shop.sellerId || 'chưa có')}</span>
      </div>
      <button data-open-seller-ads="${escapeHtml(shop.id)}">Seller Ads</button>
      <button data-import-cookies="${escapeHtml(shop.id)}" class="secondary">Import cookies</button>
    </div>
  `).join('') : '<p class="hint">Chưa có shop. Bấm Seller Ads để tạo shop đầu tiên.</p>';
}

async function refreshShops() {
  const data = await api('/api/shops');
  renderShops(data.library);
}

async function refreshExtensions() {
  const data = await api('/api/extensions');
  renderExtensions(data.library);
}

async function refreshStatus() {
  try {
    const status = await api('/api/status');
    loginPanel?.classList.add('hidden');
    appPanel?.classList.remove('hidden');
    renderStatus(status);
    updateProductToggle(state.appConfig.productViewEnabled);
    try {
      await refreshExtensions();
      await refreshShops();
    } catch (error) {
      setOutput(error.data || error.message);
    }
  } catch {
    if (loginPanel) loginPanel.classList.remove('hidden');
    if (loginPanel) appPanel?.classList.add('hidden');
    else appPanel?.classList.remove('hidden');
  }
}

async function createSellerAdsShop(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    name: form.get('name'),
    avatar: form.get('avatar'),
    loginNote: form.get('loginNote'),
    sellerId: form.get('sellerId'),
    adsAccountId: form.get('adsAccountId'),
    sellerCenterUrl: form.get('sellerCenterUrl'),
    sellerAdsUrl: form.get('sellerAdsUrl'),
    compassUrl: form.get('compassUrl'),
    gmvMaxUrl: form.get('gmvMaxUrl'),
    shopHealthStatus: form.get('shopHealthStatus'),
    productScoreStatus: form.get('productScoreStatus'),
    cookiesPath: form.get('cookiesPath'),
    cookiesJson: form.get('cookiesJson')
  };
  if (!String(payload.cookiesPath || '').trim()) delete payload.cookiesPath;
  if (!String(payload.cookiesJson || '').trim()) delete payload.cookiesJson;
  try {
    const created = await api('/api/shops/create', { method: 'POST', body: payload });
    const shop = created.library.shops.at(-1);
    await refreshStatus();
    if (shop?.id) {
      renderShopSessionSafety(shop.id);
      setOutput('Shop created. Confirm the selected shop/profile before opening Seller Ads.');
    } else {
      setOutput(created);
    }
  } catch (error) {
    setOutput(error.data || error.message);
  }
}

function renderShopSessionSafety(shopId) {
  if (!shopId) {
    sellerAdsWorkspace();
    return;
  }
  const shop = shopById(shopId);
  if (!shop) {
    setOutput(`Shop not found: ${shopId}`);
    sellerAdsWorkspace();
    return;
  }
  if (shopQuickSelect) shopQuickSelect.value = shop.id;
  const confirmation = readShopSessionConfirmation(shop.id);
  workspaceContent.innerHTML = `
    <section class="workspace-content">
      <div class="panel-header">
        <h2>Shop/profile check</h2>
        <p>Confirm the selected shop before opening Seller Ads. This stores local metadata only and never reads or exports cookies.</p>
      </div>
      <div class="shop-session-card">
        <div>
          <strong>${escapeHtml(shop.name || shop.id)}</strong>
          <span>Profile: ${escapeHtml(shop.id)}</span>
        </div>
        <dl class="compact-list">
          <dt>Seller ID</dt><dd>${escapeHtml(shop.sellerId || 'Missing')}</dd>
          <dt>Ads account</dt><dd>${escapeHtml(shop.adsAccountId || 'Missing')}</dd>
          <dt>Login note</dt><dd>${escapeHtml(shop.loginNote || 'Missing')}</dd>
          <dt>Seller Center URL</dt><dd>${escapeHtml(shop.sellerCenterUrl || 'Missing')}</dd>
          <dt>Seller Ads URL</dt><dd>${escapeHtml(shop.sellerAdsUrl || 'Missing')}</dd>
          <dt>Compass URL</dt><dd>${escapeHtml(shop.compassUrl || 'Missing')}</dd>
          <dt>GMV Max URL</dt><dd>${escapeHtml(shop.gmvMaxUrl || 'Missing')}</dd>
          <dt>Shop health</dt><dd>${escapeHtml(shop.shopHealthStatus || 'Missing')}</dd>
          <dt>Product score</dt><dd>${escapeHtml(shop.productScoreStatus || 'Missing')}</dd>
          <dt>Cookie storage</dt><dd>${escapeHtml(shop.cookieStorage || 'Missing')}</dd>
          <dt>Last confirmation</dt><dd>${escapeHtml(confirmation ? `${confirmationLabel(confirmation.status)} at ${formatTimestamp(confirmation.confirmedAt)}` : 'No confirmation yet')}</dd>
        </dl>
      </div>
      <div class="confirmation-grid">
        ${SHOP_SESSION_STATUSES.map(status => `
          <button type="button" class="${status.opensProfile ? '' : 'secondary'}" data-session-status="${escapeHtml(status.id)}">
            <span>${escapeHtml(status.label)}</span>
            <small>${escapeHtml(status.detail)}</small>
          </button>
        `).join('')}
      </div>
      <div class="actions">
        <button type="button" id="backToSellerAdsSetup" class="secondary">Manage shops</button>
      </div>
    </section>
  `;
  document.querySelectorAll('[data-session-status]').forEach(button => {
    button.addEventListener('click', async event => {
      const statusId = event.currentTarget.dataset.sessionStatus;
      const metadata = writeShopSessionConfirmation(shop, statusId);
      const status = SHOP_SESSION_STATUSES.find(item => item.id === statusId);
      setOutput({ ok: true, confirmation: metadata });
      if (status?.opensProfile) await openSellerAdsShopDirect(shop.id);
      else renderShopSessionSafety(shop.id);
    });
  });
  bindClick('#backToSellerAdsSetup', sellerAdsWorkspace);
}

async function openSellerAdsShop(shopId) {
  renderShopSessionSafety(shopId);
}

async function openSellerAdsShopDirect(shopId) {
  try {
    const opened = await api('/api/shops/open-seller-ads', { method: 'POST', body: { shopId } });
    setOutput(opened);
  } catch (error) {
    setOutput(error.data || error.message);
  }
}

async function openExtensionPage(page, profileName = '') {
  try {
    const data = await api('/api/extension/open-page', {
      method: 'POST',
      body: {
        page,
        profileName: profileName || shopQuickSelect.value || 'default'
      }
    });
    setOutput(data);
  } catch (error) {
    setOutput(error.data || error.message);
  }
}

async function boot() {
  try {
    const health = await api('/api/health');
    setHealth(true, `OK ${health.version}`);
  } catch {
    setHealth(false, 'Server lỗi');
  }
  try {
    await refreshAppConfig();
    updateProductToggle(state.appConfig.productViewEnabled);
  } catch (error) {
    setOutput(error.data || error.message);
  }
  await refreshStatus();
  renderOperationsDashboardWorkspace();
}

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(loginForm);
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: {
        username: form.get('username'),
        password: form.get('password')
      }
    });
    setOutput(data.mustChangePassword ? 'Dang nhap thanh cong. Nen doi mat khau ngay.' : 'Dang nhap thanh cong.');
    loginForm.reset();
    await refreshStatus();
  } catch (error) {
    setOutput(error.message);
  }
});

passwordForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(passwordForm);
  try {
    const data = await api('/api/change-password', {
      method: 'POST',
      body: { nextPassword: form.get('nextPassword') }
    });
    setOutput(data);
    passwordForm.reset();
    await refreshStatus();
  } catch (error) {
    setOutput(error.message);
  }
});

async function runAction(button, endpoint) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Dang chay';
  try {
    const data = await api(endpoint, { method: 'POST', body: { profileName: shopQuickSelect.value || 'default' } });
    setOutput(data);
    await refreshStatus();
  } catch (error) {
    setOutput(error.data || error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

bindClick('#launchChromeBtn', event => runAction(event.currentTarget, '/api/launch-chrome'));
bindClick('#syncRuntimeBtn', event => runAction(event.currentTarget, '/api/sync-extension-runtime'));
bindClick('#securityScanBtn', event => runAction(event.currentTarget, '/api/security-scan'));
bindClick('#parityAuditBtn', event => runAction(event.currentTarget, '/api/parity-audit'));
bindClick('#syncBundledBtn', event => runAction(event.currentTarget, '/api/extensions/sync-bundled'));
bindClick('#btnSellerAds', sellerAdsWorkspace);
bindClick('#btnAppDashboard', renderOperationsDashboardWorkspace);
bindClick('#btnCloudSync', renderCloudSyncWorkspace);
bindClick('#btnAiData', renderAiDataWorkspace);
bindClick('#btnBusinessAnalysis', renderBusinessAnalysisWorkspace);
bindClick('#btnGmvMaxDashboard', renderGmvMaxDashboardWorkspace);
bindClick('#btnTikTokCrawler', renderTikTokCrawlerWorkspace);
bindClick('#btnOpsChecklist', renderOpsChecklistWorkspace);
bindClick('#btnBusinessPlan', renderBusinessPlanWorkspace);
bindClick('#btnGuide', renderGuideWorkspace);
bindClick('#btnDownloadVideo', renderDownloadWorkspace);
bindClick('#btnVideoSettings', renderVideoSettingsWorkspace);
bindClick('#btnExtensionPopup', () => openExtensionPage('pages/login.html'));
bindClick('#btnRuntimeStatus', toggleRuntimeStatus);
bindClick('#btnProductToggle', async event => {
  const next = !event.currentTarget.classList.contains('enabled');
  updateProductToggle(next);
  try {
    const config = await saveAppConfig({ productViewEnabled: next });
    setOutput({ ok: true, config });
  } catch (error) {
    setOutput(error.data || error.message);
    updateProductToggle(!next);
  }
});
shopQuickSelect.addEventListener('change', event => openSellerAdsShop(event.target.value));
shopList.addEventListener('click', async event => {
  const openButton = event.target.closest('button[data-open-seller-ads]');
  if (openButton) return openSellerAdsShop(openButton.dataset.openSellerAds);

  const importButton = event.target.closest('button[data-import-cookies]');
  if (!importButton) return;
  const shopId = importButton.dataset.importCookies;
  workspaceContent.innerHTML = `
    <form id="importCookiesForm" class="workspace-content">
      <h2>Import cookies cho ${escapeHtml(shopId)}</h2>
      <input type="hidden" name="shopId" value="${escapeHtml(shopId)}">
      <label>File cookies JSON<input name="cookiesPath" autocomplete="off" placeholder="C:\\duong-dan\\cookies.json"></label>
      <label>Hoac dan JSON cookies<textarea class="textarea-input" name="cookiesJson"></textarea></label>
      <button type="submit">Import cookies</button>
    </form>
  `;
  document.querySelector('#importCookiesForm').addEventListener('submit', async submitEvent => {
    submitEvent.preventDefault();
    const form = new FormData(submitEvent.currentTarget);
    const payload = {
      shopId: form.get('shopId'),
      cookiesPath: form.get('cookiesPath'),
      cookiesJson: form.get('cookiesJson')
    };
    if (!String(payload.cookiesPath || '').trim()) delete payload.cookiesPath;
    if (!String(payload.cookiesJson || '').trim()) delete payload.cookiesJson;
    try {
      const data = await api('/api/shops/import-cookies', { method: 'POST', body: payload });
      setOutput(data);
      await refreshStatus();
    } catch (error) {
      setOutput(error.data || error.message);
    }
  });
});
importExtensionForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = importExtensionForm.querySelector('button[type="submit"]');
  const original = button.textContent;
  const form = new FormData(importExtensionForm);
  button.disabled = true;
  button.textContent = 'Dang nap';
  try {
    const data = await api('/api/extensions/import-path', {
      method: 'POST',
      body: { path: form.get('extensionPath') }
    });
    setOutput(data);
    importExtensionForm.reset();
    await refreshStatus();
  } catch (error) {
    setOutput(error.data || error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});
extensionList?.addEventListener('click', async event => {
  const button = event.target.closest('button[data-extension-id]');
  if (!button) return;
  try {
    const data = await api('/api/extensions/set-active', {
      method: 'POST',
      body: { id: button.dataset.extensionId }
    });
    setOutput(data);
    await refreshStatus();
  } catch (error) {
    setOutput(error.data || error.message);
  }
});
bindClick('#logoutBtn', async () => {
  await api('/api/logout', { method: 'POST', body: {} });
  setOutput('Da dang xuat.');
  await refreshStatus();
});

boot();
