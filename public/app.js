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
  statusVisible: false
};

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
    ['Cloud sync', state.appConfig.cloudSyncUrl],
    ['AI DATA', state.appConfig.aiDataUrl],
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
        Seller ID / Shop ID
        <input name="sellerId" autocomplete="off" placeholder="Neu co thi dien, khong co co the bo trong">
      </label>
      <label>
        Ads Account ID
        <input name="adsAccountId" autocomplete="off" placeholder="Neu co">
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

function renderDashboardWorkspace() {
  const selectedShop = shopQuickSelect.value;
  const shopCount = shopList.querySelectorAll('.shop-item').length;
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>Dashboard</h2>
      <p>Dashboard chính của app là dashboard gốc trong extension. Bấm mở dashboard để vào profile Chromium đã quản lý.</p>
    </div>
    <div class="summary-grid">
      <div><strong>${shopCount}</strong><span>Shop trong app</span></div>
      <div><strong>${selectedShop ? escapeHtml(selectedShop) : 'Default'}</strong><span>Profile dang chon</span></div>
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
  renderDashboardWorkspace();
  await openExtensionPage('pages/dashboard.html');
}

function renderCloudSyncWorkspace() {
  workspaceContent.innerHTML = `
    <form id="cloudSyncForm" class="workspace-content">
      <div class="panel-header">
        <h2>Cloud Sync</h2>
        <p>Luu endpoint sync trong app. Khi mo Seller Ads, extension van dung runtime goc trong Chrome profile rieng.</p>
      </div>
      <label>
        Cloud sync URL
        <input name="cloudSyncUrl" value="${escapeHtml(state.appConfig.cloudSyncUrl)}" autocomplete="off" placeholder="https://...">
      </label>
      <div class="actions">
        <button type="submit">Luu cau hinh</button>
        <button type="button" class="secondary" id="syncBundledInline">Dong bo extension bundled</button>
      </div>
    </form>
  `;
  document.querySelector('#cloudSyncForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const config = await saveAppConfig({ cloudSyncUrl: form.get('cloudSyncUrl') });
      setOutput({ ok: true, config });
      await refreshStatus();
    } catch (error) {
      setOutput(error.data || error.message);
    }
  });
  bindClick('#syncBundledInline', event => runAction(event.currentTarget, '/api/extensions/sync-bundled'));
}

function renderAiDataWorkspace() {
  workspaceContent.innerHTML = `
    <form id="aiDataForm" class="workspace-content">
      <div class="panel-header">
        <h2>STRANGE TTS AI DATA</h2>
        <p>Quan ly link AI DATA trong app de team non-tech khong phai mo extension popup.</p>
      </div>
      <label>
        AI DATA URL
        <input name="aiDataUrl" value="${escapeHtml(state.appConfig.aiDataUrl)}" autocomplete="off" placeholder="https://...">
      </label>
      <div class="actions">
        <button type="submit">Luu URL</button>
        <button type="button" class="secondary" id="openAiDataUrl">Mo AI DATA</button>
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
    if (!url) return setOutput('Chua co AI DATA URL.');
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

function money(value) {
  return Math.round(Number(value || 0)).toLocaleString('vi-VN');
}

function pct(value) {
  const n = Number(value || 0);
  return `${(n * 100).toFixed(1)}%`;
}

function csvCell(value) {
  const raw = String(value ?? '');
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
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
  const rows = [
    ['Loai', 'Chi so', 'Gia tri'],
    ['Tong quan', 'Ky du lieu', result.period || ''],
    ['Tong quan', 'Ky ke hoach', result.plan?.period || ''],
    ['KPI', 'Doanh thu cu', Math.round(Number(result.kpis?.revenue || 0))],
    ['KPI', 'Loi nhuan uoc tinh', Math.round(Number(result.kpis?.netProfitEstimate || 0))],
    ['KPI', 'Net margin', pct(result.kpis?.netMargin)],
    ['Ads', 'Chi phi thuc te', Math.round(Number(result.costs?.adsActualCost || 0))],
    ['Ke hoach', 'Muc tieu doanh thu', Math.round(Number(result.plan?.targetRevenue || 0))],
    ['Ke hoach', 'Ngan sach ads goi y', Math.round(Number(result.plan?.suggestedAdsBudget || 0))],
    ['Ke hoach', 'ROI hoa von', Number(result.plan?.breakEvenRoi || 0).toFixed(2)]
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

function renderBusinessResult(result, mode = 'analysis') {
  state.businessResult = result;
  const warnings = (result.warnings || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const fileRows = (result.fileSummary || []).map(file => `
    <tr><td>${escapeHtml(file.name)}</td><td>${escapeHtml(file.type)}</td><td>${file.rows}</td></tr>
  `).join('');
  const topSkuRows = (result.orders?.topSkus || []).slice(0, 8).map(item => `
    <tr>
      <td>${escapeHtml(item.skuName)}</td>
      <td class="num">${money(item.units)}</td>
      <td class="num">${money(item.revenue)}</td>
      <td class="num">${money(item.revenue - item.cost)}</td>
    </tr>
  `).join('');
  const planRows = (result.plan?.focusSkus || []).map(item => `
    <tr>
      <td>${escapeHtml(item.skuName)}</td>
      <td class="num">${money(item.revenue)}</td>
      <td class="num">${money(item.grossProfit)}</td>
    </tr>
  `).join('');
  const planActions = (result.plan?.actions || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  workspaceContent.innerHTML = `
    <div class="panel-header">
      <h2>${mode === 'plan' ? 'Ke hoach thang/quy toi' : 'Phan tich chi so kinh doanh'}</h2>
      <p>Ket qua duoc tinh tu file TikTok Seller/Ads da nap va bang gia goc cot A/H.</p>
    </div>
    ${warnings ? `<ul class="warn-list">${warnings}</ul>` : ''}
    <div class="summary-grid business-kpis">
      <div><strong>${money(result.kpis?.revenue)}</strong><span>Doanh thu</span></div>
      <div><strong>${money(result.kpis?.netProfitEstimate)}</strong><span>Loi nhuan uoc tinh</span></div>
      <div><strong>${pct(result.kpis?.netMargin)}</strong><span>Net margin</span></div>
      <div><strong>${money(result.costs?.adsActualCost)}</strong><span>Ads thuc te</span></div>
      <div><strong>${money(result.costs?.productCost)}</strong><span>Gia von hang ban</span></div>
      <div><strong>${money(Number(result.affiliate?.sampleCost || 0) + Number(result.affiliate?.shipping || 0))}</strong><span>Mau + ship affiliate</span></div>
    </div>
    <div class="analysis-grid">
      <section class="mini-panel">
        <h3>Ads GMV Max</h3>
        <dl class="compact-list">
          <dt>Cash + Credit + Ads credit</dt><dd>${money(result.ads?.actual?.actualCost)}</dd>
          <dt>Chi phi gom chiet khau</dt><dd>${money(result.ads?.gmvMax?.costWithDiscount)}</dd>
          <dt>GMV ads</dt><dd>${money(result.ads?.gmvMax?.gmv)}</dd>
          <dt>ROI creative</dt><dd>${Number(result.ads?.gmvMax?.roi || 0).toFixed(2)}</dd>
          <dt>Dong GMV Max da dung</dt><dd>${money(result.ads?.actual?.rowsUsed)}</dd>
          <dt>Match chi phi</dt><dd>${escapeHtml(result.ads?.actual?.matchMode || '')}</dd>
        </dl>
      </section>
      <section class="mini-panel">
        <h3>Quyet toan</h3>
        <dl class="compact-list">
          <dt>Da quyet toan</dt><dd>${money(result.settlements?.income?.amount)}</dd>
          <dt>Se quyet toan</dt><dd>${money(result.settlements?.onhold?.amount)}</dd>
          <dt>Don hang</dt><dd>${money(result.kpis?.orders)}</dd>
          <dt>So luong ban</dt><dd>${money(result.kpis?.units)}</dd>
        </dl>
      </section>
      <section class="mini-panel">
        <h3>KOC / Creator</h3>
        <dl class="compact-list">
          <dt>GMV Video</dt><dd>${money(result.content?.video?.gmv)}</dd>
          <dt>GMV Creator</dt><dd>${money(result.content?.creator?.gmv)}</dd>
          <dt>Video rows</dt><dd>${money(result.content?.video?.rows)}</dd>
          <dt>Creator rows</dt><dd>${money(result.content?.creator?.rows)}</dd>
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
        <table class="data-table"><thead><tr><th>SKU</th><th>SL</th><th>DT</th><th>Lai gop</th></tr></thead><tbody>${topSkuRows || '<tr><td colspan="4">Chua co du lieu</td></tr>'}</tbody></table>
      </section>
      <section class="mini-panel">
        <h3>Ke hoach goi y</h3>
        <dl class="compact-list">
          <dt>Muc tieu doanh thu</dt><dd>${money(result.plan?.targetRevenue)}</dd>
          <dt>Ngan sach ads goi y</dt><dd>${money(result.plan?.suggestedAdsBudget)}</dd>
          <dt>ROI hoa von</dt><dd>${Number(result.plan?.breakEvenRoi || 0).toFixed(2)}</dd>
          <dt>ROI hien tai</dt><dd>${Number(result.plan?.currentRoi || 0).toFixed(2)}</dd>
        </dl>
        <ul class="plan-actions">${planActions}</ul>
      </section>
    </div>
    <div class="mini-panel">
      <h3>SKU uu tien cho ke hoach</h3>
      <table class="data-table"><thead><tr><th>SKU</th><th>Doanh thu cu</th><th>Lai gop uoc tinh</th></tr></thead><tbody>${planRows || '<tr><td colspan="3">Chua co du lieu</td></tr>'}</tbody></table>
    </div>
    <details class="mini-panel">
      <summary>File da nhan dien</summary>
      <table class="data-table"><thead><tr><th>File</th><th>Loai</th><th>Rows</th></tr></thead><tbody>${fileRows}</tbody></table>
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
        <p>Nap cac file TikTok Seller/Ads/KOC. Chay trong dashboard PC app, tu nhan dien file, gop trung loai, loc trung va tinh KPI. Neu mat mang, app dung file gia upload hoac cache gia da luu truoc do.</p>
      </div>
      <label>
        Google Sheet gia goc
        <input name="priceSheetUrl" value="https://docs.google.com/spreadsheets/d/1RlaQAhHvLdFrYiG3q80DyVWrJZBmrvLPsrCGGRO_AWo/edit?gid=478274778#gid=478274778" autocomplete="off">
      </label>
      <label>
        Hoac upload file gia goc (.xlsx/.csv) - lay cot A va H
        <input name="priceFile" type="file" accept=".xlsx,.xls,.csv">
      </label>
      <label>
        File TikTok Seller/Ads/KOC (.xlsx/.csv), co the chon nhieu file
        <input name="businessFiles" type="file" accept=".xlsx,.xls,.csv" multiple required>
      </label>
      <div class="form-grid">
        <label>Ky du lieu cu<input name="periodLabel" placeholder="VD: Thang 5/2026"></label>
        <label>Ky ke hoach<input name="nextPeriodLabel" placeholder="VD: Thang 6/2026 / Q3"></label>
        <label>Ty le tinh Ads credit con lai (%)<input name="adsCreditRatio" type="number" min="0" max="100" step="1" value="50"></label>
        <label>Tang truong muc tieu (%)<input name="targetGrowthPct" type="number" min="0" max="500" step="1" value="20"></label>
      </div>
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
            <th>Raw fields</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.startDate)}</td>
              <td>${money(row.totalGmv)}</td>
              <td>${money(row.contentVideoGmv)}</td>
              <td>${money(row.contentProductCardGmv)}</td>
              <td>${money(row.affiliateTotalGmv)}</td>
              <td>${money(row.affiliateVideoGmv)}</td>
              <td>${money(row.affiliateVideoDirectGmv)}</td>
              <td>${money(row.affiliateVideoIndirectGmv)}</td>
              <td>${money(row.rawFieldCount)}</td>
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
      <div><strong>${money(current.totalGmv)}</strong><span>GMV ${escapeHtml(activeMonth)}</span></div>
      <div><strong>${previous ? pct(growth) : '-'}</strong><span>Tang truong so voi ${escapeHtml(previousMonth || '')}</span></div>
      <div><strong>${pct(affiliateShare)}</strong><span>Ty trong lien ket</span></div>
      <div><strong>${pct(videoShare)}</strong><span>Ty trong video</span></div>
      <div><strong>${pct(directShare)}</strong><span>Video lien ket truc tiep</span></div>
    </div>
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
        <input name="months" value="2026-04,2026-05" autocomplete="off">
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
  const shopId = 'little-apricot-hawaii-fashion';
  let database = { months: {} };
  let sellerCenter = { summary: {}, modules: [], unresolved: [] };
  try {
    const data = await api(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`);
    database = data.database || database;
    sellerCenter = data.sellerCenter || sellerCenter;
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
        <div><strong>${money(sellerCenter.summary?.apiEndpoints)}</strong><span>API Seller Center</span></div>
        <div><strong>${money(sellerCenter.summary?.rawFiles)}</strong><span>Raw files</span></div>
        <div><strong>${money(sellerCenter.summary?.exportRequests)}</strong><span>Lệnh export</span></div>
      </div>
      <label>CDP port của profile TikTok<input name="cdpPort" value="58849" autocomplete="off"></label>
      <label>Seller ID<input name="sellerId" value="7494478078863902049" autocomplete="off"></label>
      <label>URL gốc Seller Center<input name="baseUrl" value="https://seller-vn.tiktok.com/homepage?shop_region=VN" autocomplete="off"></label>
      <label>Tháng cần crawl Compass<input name="months" value="2026-04,2026-05" autocomplete="off"></label>
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
          cdpPort: Number(form.get('cdpPort') || 58849),
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
  workspaceContent.innerHTML = `
    <form id="downloadVideoForm" class="workspace-content">
      <div class="panel-header">
        <h2>Tai video TikTok</h2>
        <p>Nhap link TikTok, app se tai file ve Downloads/STRANGETTS_Downloads bang logic Tikwm nhu extension goc.</p>
      </div>
      <label>
        Link TikTok
        <input name="url" autocomplete="off" required placeholder="https://www.tiktok.com/@.../video/...">
      </label>
      <button type="submit">Tai video</button>
    </form>
  `;
  document.querySelector('#downloadVideoForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const original = button.textContent;
    const form = new FormData(event.currentTarget);
    button.disabled = true;
    button.textContent = 'Dang tai';
    try {
      const data = await api('/api/video/download', { method: 'POST', body: { url: form.get('url') } });
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
    sellerId: form.get('sellerId'),
    adsAccountId: form.get('adsAccountId'),
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
      const opened = await api('/api/shops/open-seller-ads', { method: 'POST', body: { shopId: shop.id } });
      setOutput(opened);
    } else {
      setOutput(created);
    }
  } catch (error) {
    setOutput(error.data || error.message);
  }
}

async function openSellerAdsShop(shopId) {
  if (!shopId) {
    sellerAdsWorkspace();
    return;
  }
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
  renderDashboardWorkspace();
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
bindClick('#btnAppDashboard', renderDashboardWorkspace);
bindClick('#btnCloudSync', renderCloudSyncWorkspace);
bindClick('#btnAiData', renderAiDataWorkspace);
bindClick('#btnBusinessAnalysis', renderBusinessAnalysisWorkspace);
bindClick('#btnTikTokCrawler', renderTikTokCrawlerWorkspace);
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
