// ==============================================
// Strange TTS Solution & CRM TT AI DASHBOARD
// Card-based layout + Campaign Panel
// + Auth Guard + Multi-Account Ads
// ==============================================
console.log("%c 🚀 Strange TTS Solution 1.0.0 LOADED %c", "background:#c084fc;color:#fff;padding:5px 10px;border-radius:5px;font-weight:bold;", "");
// Strange TTS Solution & CRM TT AI AUTH GUARD — Kiểm tra session đăng nhập
// Nếu chưa login → show overlay, block UI
// ══════════════════════════════════════════════
const STORAGE_AUTH_KEY = 'strangetts_v30_auth';
const AUTH_SECRET_DASH = '';
const STORAGE_KEY = 'strangetts_multi_shops';
const SYNC_URL_KEY = 'strangetts_sync_url';
const UI_THEME_KEY = 'strangetts_ui_theme';
const UI_LAYOUT_KEY = 'strangetts_dashboard_layout';
const STRANGETTS_LOCAL_APP_MODE_DASH = true;
const STRANGETTS_LOCAL_SESSION_TTL_DASH = 365 * 24 * 60 * 60 * 1000;
const STRANGETTS_LICENSE_API = 'http://127.0.0.1:48731';

// --- Global Data Strange TTS ---
let shops = {}; // { aadvid: { shop info + cookies } }
let shopOrder = []; // [aadvid1, aadvid2, ...]
let shopData = {}; // { aadvid: { fetched data + campaigns[] } }
let sortCol = 'totalCost';
let sortAsc = false;
let currentDashSort = 'name';
let refreshTimer = null;
let activeShop = null; // currently selected shop aadvid
let viewMode = 'cards'; // 'cards' | 'table'
let dashboardLayout = 'cards'; // 'cards' | 'table' | 'compact'
let activePerfFilter = 'all';
let isFetchingAll = false;
let configSyncEnabled = false; // Mặc định tắt auto-sync
let alertConfig = {
    recapEnabled: true,
    recapTimes: '11:45, 23:15',
    tgToken: '',
    tgChatId: '',
    tgChatId2: '',
    zaloServer: 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788',
    zaloUser: '',
    zaloGroup: ''
};
let alertHistory = {}; // { aadvid: { lastStatus: 'ok'|'zero'|'threshold', count: 0, lastReportDate: 'YYYY-MM-DD' } }
const STORAGE_ALERT_CONFIG = 'strangetts_alert_config';
const STORAGE_ALERT_HISTORY = 'strangetts_alert_history';
const STORAGE_QUICK_RECAP_LAST = 'strangetts_quick_recap_last';

// --- Master Admin State ---
let adminUserList = [];
let adminViewUserShops = {}; // { aadvid: shopObj } - Temporary data for preview only
let adminGlobalShopPool = []; 
let masterFilterState = { search: '', owner: 'all', freshness: 'all', groupByShop: true };
let expandedShops = new Set(); // Set of shop IDs that are expanded in UI
let isAdminScanning = false; // Flag to prevent redundant background sweeps
let displayList = []; // Globalized for event delegation access
let dashboardBusinessResult = null;
let dashboardBusinessRules = null;
const DEFAULT_BUSINESS_RULES = {
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
    metricDefinitions: []
};

const BUSINESS_BACKEND_PATH_DOCS = {
    'kpis.revenue': {
        title: 'Doanh thu',
        source: 'Kết quả backend sau khi chọn nguồn doanh thu theo Cấu hình logic tính toán.',
        formula: 'Auto: orders.revenue -> settlements.income.amount + settlements.onhold.amount -> ads.gmvMax.gmv. Nếu chọn cố định thì lấy đúng nguồn đã chọn.',
        note: 'Bị ảnh hưởng bởi ô Nguồn doanh thu.'
    },
    'kpis.revenueSource': {
        title: 'Nguồn doanh thu',
        source: 'Backend trả về tên nguồn doanh thu thực tế đang dùng.',
        formula: 'orders / settlement / gmvMax theo lựa chọn hoặc fallback của chế độ Auto.',
        note: 'Định dạng nên để Text.'
    },
    'kpis.settledAmount': {
        title: 'Đã quyết toán',
        source: 'File quyết toán đã hoàn tất.',
        formula: 'settlements.income.amount'
    },
    'kpis.onholdAmount': {
        title: 'Sẽ quyết toán',
        source: 'File quyết toán đang treo/on-hold.',
        formula: 'settlements.onhold.amount'
    },
    'kpis.orders': {
        title: 'Đơn hàng',
        source: 'File đơn hàng TikTok Seller.',
        formula: 'Tổng số đơn hợp lệ sau khi parse file orders.'
    },
    'kpis.units': {
        title: 'Số lượng bán',
        source: 'File đơn hàng TikTok Seller.',
        formula: 'Tổng số lượng SKU bán ra trong orders.'
    },
    'kpis.netProfitEstimate': {
        title: 'Lợi nhuận ước tính',
        source: 'KPI tổng hợp từ doanh thu và toàn bộ chi phí được bật trong rules.',
        formula: 'kpis.revenue - costs.totalCost'
    },
    'kpis.netMargin': {
        title: 'Net margin',
        source: 'KPI tổng hợp.',
        formula: 'kpis.netProfitEstimate / kpis.revenue. Nếu doanh thu = 0 thì trả 0.'
    },
    'costs.productCost': {
        title: 'Giá vốn',
        source: 'File đơn hàng + bảng giá gốc/cache giá.',
        formula: 'orders.productCost nếu bật Tính giá vốn hàng bán, ngược lại = 0.'
    },
    'costs.rawProductCost': {
        title: 'Giá vốn gốc',
        source: 'File đơn hàng + bảng giá gốc/cache giá.',
        formula: 'orders.productCost, không phụ thuộc checkbox bật/tắt chi phí.'
    },
    'costs.affiliateSampleCost': {
        title: 'Chi phí mẫu affiliate',
        source: 'File affiliate/KOC + bảng giá gốc.',
        formula: 'affiliate.sampleCost nếu bật Tính chi phí mẫu affiliate, ngược lại = 0.'
    },
    'costs.rawAffiliateSampleCost': {
        title: 'Chi phí mẫu affiliate gốc',
        source: 'File affiliate/KOC + bảng giá gốc.',
        formula: 'affiliate.sampleCost, không phụ thuộc checkbox bật/tắt chi phí.'
    },
    'costs.affiliateShipping': {
        title: 'Ship affiliate',
        source: 'File affiliate/KOC.',
        formula: 'affiliate.shipping nếu bật Tính ship affiliate, ngược lại = 0.'
    },
    'costs.rawAffiliateShipping': {
        title: 'Ship affiliate gốc',
        source: 'File affiliate/KOC.',
        formula: 'affiliate.shipping, không phụ thuộc checkbox bật/tắt chi phí.'
    },
    'costs.adsActualCost': {
        title: 'Ads thực tế',
        source: 'File Ads actual/cost export.',
        formula: 'ads.actual.actualCost nếu bật Tính Ads thực tế, ngược lại = 0. Ads credit được nhân theo tỷ lệ Ads credit.'
    },
    'costs.rawAdsActualCost': {
        title: 'Ads thực tế gốc',
        source: 'File Ads actual/cost export.',
        formula: 'ads.actual.actualCost, không phụ thuộc checkbox bật/tắt chi phí.'
    },
    'costs.marketplaceFee': {
        title: 'Phí sàn',
        source: 'Cấu hình logic tính toán.',
        formula: 'kpis.revenue * marketplaceFeePct / 100'
    },
    'costs.paymentFee': {
        title: 'Phí thanh toán',
        source: 'Cấu hình logic tính toán.',
        formula: 'kpis.revenue * paymentFeePct / 100'
    },
    'costs.operationFee': {
        title: 'Phí vận hành',
        source: 'Cấu hình logic tính toán.',
        formula: 'kpis.revenue * operationFeePct / 100'
    },
    'costs.fixedCost': {
        title: 'Chi phí cố định',
        source: 'Cấu hình logic tính toán.',
        formula: 'fixedCost nhập trong rules.'
    },
    'costs.totalCost': {
        title: 'Tổng chi phí',
        source: 'Tổng hợp các chi phí đã bật trong rules.',
        formula: 'costs.productCost + costs.affiliateSampleCost + costs.affiliateShipping + costs.adsActualCost + costs.marketplaceFee + costs.paymentFee + costs.operationFee + costs.fixedCost'
    },
    'ads.actual.actualCost': {
        title: 'Cash + Credit + Ads credit',
        source: 'File Ads actual/cost export.',
        formula: 'Tổng cash cost + credit cost + ad credit cost * tỷ lệ Ads credit.'
    },
    'ads.actual.rowsUsed': {
        title: 'Dòng GMV Max đã dùng',
        source: 'File Ads actual/cost export.',
        formula: 'Số dòng ads actual match được vào campaign GMV Max.'
    },
    'ads.actual.matchMode': {
        title: 'Match chi phí',
        source: 'Backend matching giữa Ads actual và GMV Max creative.',
        formula: 'campaign-id-match / campaign-name-pattern / fallback tùy dữ liệu tìm được.',
        note: 'Định dạng nên để Text.'
    },
    'ads.gmvMax.costWithDiscount': {
        title: 'Chi phí gồm chiết khấu',
        source: 'File GMV Max creative.',
        formula: 'Tổng cột chi phí/cost đã gồm chiết khấu trong file GMV Max.'
    },
    'ads.gmvMax.gmv': {
        title: 'GMV ads',
        source: 'File GMV Max creative.',
        formula: 'Tổng GMV/revenue từ các dòng GMV Max creative.'
    },
    'ads.gmvMax.roi': {
        title: 'ROI creative',
        source: 'File GMV Max creative.',
        formula: 'ads.gmvMax.gmv / ads.gmvMax.costWithDiscount. Nếu cost = 0 thì trả 0.'
    },
    'settlements.income.amount': {
        title: 'Đã quyết toán',
        source: 'File income/settlement.',
        formula: 'Tổng settlement amount/income/amount trong file đã quyết toán.'
    },
    'settlements.onhold.amount': {
        title: 'Sẽ quyết toán',
        source: 'File onhold settlement.',
        formula: 'Tổng settlement amount/income/amount trong file đang treo.'
    },
    'content.video.gmv': {
        title: 'GMV Video',
        source: 'File KOC/video.',
        formula: 'Tổng GMV/revenue của dữ liệu video.'
    },
    'content.creator.gmv': {
        title: 'GMV Creator',
        source: 'File KOC/creator.',
        formula: 'Tổng GMV/revenue của dữ liệu creator.'
    },
    'content.video.rows': {
        title: 'Video rows',
        source: 'File KOC/video.',
        formula: 'Số dòng video đã nhận diện.'
    },
    'content.creator.rows': {
        title: 'Creator rows',
        source: 'File KOC/creator.',
        formula: 'Số dòng creator đã nhận diện.'
    },
    'priceRows': {
        title: 'Giá gốc rows',
        source: 'Google Sheet/file giá gốc hoặc cache offline.',
        formula: 'Số dòng giá gốc đã đọc được.'
    },
    'productCatalog.items.length': {
        title: 'Sản phẩm import',
        source: 'File product/catalog.',
        formula: 'Số sản phẩm/SKU import được từ file sản phẩm.'
    },
    'productCatalog.aliasCount': {
        title: 'Alias map từ file SP',
        source: 'File product/catalog.',
        formula: 'Số alias/tên phụ được tạo để map SKU/sản phẩm với bảng giá.'
    },
    'productCatalog.unmatched.length': {
        title: 'Chưa map giá',
        source: 'File đơn hàng/product + bảng giá.',
        formula: 'Số SKU/sản phẩm chưa tìm được giá gốc.'
    },
    'fileSummary.length': {
        title: 'File đã nạp',
        source: 'Danh sách file upload.',
        formula: 'Số file TikTok Seller/Ads/KOC đã được backend nhận diện.'
    }
};

async function strangettsFetchLicenseStatus() {
    try {
        const resp = await fetch(`${STRANGETTS_LICENSE_API}/api/license/status`, { cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        return data.license || { active: false, error: `Local app API ${resp.status}` };
    } catch (error) {
        return { active: false, error: 'Không kết nối được local license server.' };
    }
}

function strangettsShowLicenseGate(license = {}) {
    let overlay = document.getElementById('strangetts-license-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'strangetts-license-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:2147483647;
            display:flex;align-items:center;justify-content:center;
            background:radial-gradient(circle at 50% 0%,rgba(217,165,46,.16),transparent 34%),rgba(3,4,3,.96);
            color:#f5ecd2;font-family:Inter,system-ui,sans-serif;padding:24px;
        `;
        overlay.innerHTML = `
            <div style="width:min(520px,94vw);border:1px solid rgba(217,165,46,.34);background:rgba(8,10,8,.94);border-radius:10px;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:24px">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
                    <img src="../assets/icons/icon48.png" alt="Strange TTS" style="width:42px;height:42px;border-radius:8px;border:1px solid rgba(217,165,46,.34)">
                    <div>
                        <div style="font-size:18px;font-weight:900;letter-spacing:.02em;color:#f5c95d">Kich hoat Strange TTS</div>
                        <div style="font-size:12px;color:#a79b7c;margin-top:3px">Nhap license key de mo khoa dashboard va seller tools.</div>
                    </div>
                </div>
                <div id="strangetts-license-msg" style="min-height:18px;font-size:12px;color:#ffb4aa;margin-bottom:10px"></div>
                <textarea id="strangetts-license-key" spellcheck="false" placeholder="STTS1-..." style="width:100%;min-height:92px;resize:vertical;box-sizing:border-box;border-radius:8px;border:1px solid rgba(217,165,46,.28);background:#050605;color:#fff7d8;padding:12px;font:12px/1.45 ui-monospace,Consolas,monospace;outline:none"></textarea>
                <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:14px;flex-wrap:wrap">
                    <div id="strangetts-license-machine" style="font-size:11px;color:#8d846e;word-break:break-all"></div>
                    <button id="strangetts-license-activate" style="border:1px solid rgba(217,165,46,.45);background:rgba(217,165,46,.14);color:#f5c95d;border-radius:8px;padding:9px 14px;font-weight:900;cursor:pointer">Kich hoat</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#strangetts-license-activate')?.addEventListener('click', async () => {
            const key = overlay.querySelector('#strangetts-license-key')?.value.trim();
            const msg = overlay.querySelector('#strangetts-license-msg');
            if (!key) {
                if (msg) msg.textContent = 'Vui long nhap license key.';
                return;
            }
            if (msg) {
                msg.style.color = '#d9a52e';
                msg.textContent = 'Đang kích hoạt...';
            }
            try {
                const resp = await fetch(`${STRANGETTS_LICENSE_API}/api/license/activate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.ok) throw new Error(data.error || `Local app API ${resp.status}`);
                if (msg) {
                    msg.style.color = '#4ade80';
                    msg.textContent = 'Kích hoạt thành công. Đang tải lại dashboard...';
                }
                setTimeout(() => location.reload(), 700);
            } catch (error) {
                if (msg) {
                    msg.style.color = '#ffb4aa';
                    msg.textContent = error.message || 'Kich hoat that bai.';
                }
            }
        });
    }
    const msg = overlay.querySelector('#strangetts-license-msg');
    if (msg && license.error) msg.textContent = license.error;
    const machine = overlay.querySelector('#strangetts-license-machine');
    if (machine) machine.textContent = `Machine ID: ${license.machineId || '-'}`;
}

async function strangettsInitLicenseGate() {
    const license = await strangettsFetchLicenseStatus();
    if (!license.active) {
        strangettsShowLicenseGate(license);
        return false;
    }
    document.getElementById('strangetts-license-overlay')?.remove();
    const headerRight = document.querySelector('.dash-header-right');
    if (headerRight && !document.getElementById('strangetts-license-badge')) {
        const badge = document.createElement('div');
        badge.id = 'strangetts-license-badge';
        badge.className = 'btn btn-secondary';
        badge.style.cssText = 'padding:6px 10px;font-size:11px;gap:6px';
        badge.title = license.expiresAt ? `License expires: ${license.expiresAt}` : 'License active';
        badge.innerHTML = `<span class="st-icon st-icon-shield" aria-hidden="true"></span><span>${license.plan || 'Active'}</span>`;
        headerRight.prepend(badge);
    }
    return true;
}

function applyDashboardTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    const btn = document.getElementById('btn-theme-toggle');
    const icon = document.getElementById('theme-toggle-icon');
    if (btn) {
        btn.setAttribute('aria-pressed', nextTheme === 'light' ? 'true' : 'false');
        btn.title = nextTheme === 'light' ? 'Đang dùng giao diện sáng' : 'Đang dùng giao diện tối';
    }
    if (icon) {
        icon.textContent = '';
        icon.className = 'st-icon st-icon-theme';
    }
}

async function initDashboardTheme() {
    const store = await chrome.storage.local.get({ [UI_THEME_KEY]: 'dark' });
    applyDashboardTheme(store[UI_THEME_KEY]);

    document.getElementById('btn-theme-toggle')?.addEventListener('click', async () => {
        const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        const nextTheme = current === 'light' ? 'dark' : 'light';
        await chrome.storage.local.set({ [UI_THEME_KEY]: nextTheme });
        applyDashboardTheme(nextTheme);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[UI_THEME_KEY]) {
            applyDashboardTheme(changes[UI_THEME_KEY].newValue);
        }
    });
}

/**
 * ── STRANGE TTS CUSTOM MODAL (Jarvis Style) ──
 * Thay thế confirm() và alert() bằng giao diện Glassmorphism Jarivs
 */
function strangettsModal({ title, body, icon = '💡', confirmText = 'OK', cancelText = '', onConfirm, onCancel, isInput = false, autoClose = true }) {
    let overlay = document.querySelector('.strangetts-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'strangetts-modal-overlay';
        overlay.innerHTML = `
            <div class="strangetts-modal">
                <span class="strangetts-modal-icon"></span>
                <div class="strangetts-modal-title"></div>
                <div class="strangetts-modal-body"></div>
                <div class="strangetts-modal-input-wrap" style="display:none; padding:15px">
                    <input type="text" class="strangetts-modal-input" placeholder="Nhập tại đây..." style="width:100%; padding:10px; border-radius:8px; border:1px solid rgba(167,139,250,0.3); background:rgba(0,0,0,0.2); color:#fff; font-size:14px; outline:none">
                </div>
                <div class="strangetts-modal-footer">
                    <button class="btn btn-secondary strangetts-modal-cancel" style="display:none"></button>
                    <button class="btn btn-primary strangetts-modal-confirm"></button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const modal = overlay.querySelector('.strangetts-modal');
    const btnConfirm = modal.querySelector('.strangetts-modal-confirm');
    const btnCancel = modal.querySelector('.strangetts-modal-cancel');
    const bodyEl = modal.querySelector('.strangetts-modal-body');

    modal.querySelector('.strangetts-modal-icon').textContent = icon;
    modal.querySelector('.strangetts-modal-title').textContent = title;
    
    if (typeof body === 'string') {
        bodyEl.innerHTML = body;
    } else {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(body);
    }

    btnConfirm.textContent = confirmText;
    if (cancelText) {
        btnCancel.textContent = cancelText;
        btnCancel.style.display = 'flex';
    } else {
        btnCancel.style.display = 'none';
    }

    overlay.querySelector('.strangetts-modal-input-wrap').style.display = isInput ? 'block' : 'none';
    const inputEl = overlay.querySelector('.strangetts-modal-input');
    if (isInput) {
        inputEl.value = '';
        setTimeout(() => inputEl.focus(), 200);
    }

    overlay.classList.add('show');

    const cleanup = () => {
        overlay.classList.remove('show');
        const newConfirm = btnConfirm.cloneNode(true);
        const newCancel = btnCancel.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
    };

    modal.querySelector('.strangetts-modal-confirm').onclick = () => {
        const val = isInput ? inputEl.value : null;
        if (autoClose) cleanup();
        if (onConfirm) onConfirm(autoClose ? val : cleanup);
    };
    modal.querySelector('.strangetts-modal-cancel').onclick = () => {
        cleanup();
        if (onCancel) onCancel();
    };
}

function strangettsAlert(title, body, icon = 'ℹ️') {
    strangettsModal({ title, body, icon });
}


async function dashSha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function dashTodayVN() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}
async function dashMakeToken(username) {
    return (await dashSha256(`${username}-${AUTH_SECRET_DASH}-${dashTodayVN()}`)).slice(0, 16);
}

async function checkDashAuth() {
    const store = await chrome.storage.local.get(STORAGE_AUTH_KEY);
    let sess = store[STORAGE_AUTH_KEY];
    if ((!sess || !sess.username || !sess.token || !sess.expiry) && STRANGETTS_LOCAL_APP_MODE_DASH) {
        sess = {
            username: 'local-admin',
            role: 'admin',
            display: 'Strange',
            token: `local-pc-app-${chrome.runtime.id || 'runtime'}`,
            syncUrl: 'https://cartridges-warranty-management-incentive.trycloudflare.com',
            serverAuth: true,
            localAppMode: true,
            expiry: Date.now() + STRANGETTS_LOCAL_SESSION_TTL_DASH,
            loginAt: Date.now()
        };
        await chrome.storage.local.set({ [STORAGE_AUTH_KEY]: sess });
    }
    if (!sess || !sess.username || !sess.token || !sess.expiry) return null;
    if (sess.serverAuth !== true) {
        await chrome.storage.local.remove(STORAGE_AUTH_KEY);
        return STRANGETTS_LOCAL_APP_MODE_DASH ? checkDashAuth() : null;
    }
    if (Date.now() > sess.expiry) {
        await chrome.storage.local.remove(STORAGE_AUTH_KEY);
        return STRANGETTS_LOCAL_APP_MODE_DASH ? checkDashAuth() : null;
    }
    
    // V30: Show Master Admin tab if role is admin
    if (sess.role === 'admin') {
        const btnAdmin = document.getElementById('tab-btn-admin');
        if (btnAdmin) btnAdmin.style.display = 'block';
    }
    document.querySelectorAll('.business-admin-only').forEach(el => {
        if (el.id === 'business-rules-form' && (sess.role === 'admin' || sess.role === 'owner')) return;
        el.style.display = (sess.role === 'admin' || sess.role === 'owner') ? '' : 'none';
    });
    
    return sess;
}

function showAuthOverlay(username) {
    const existingOverlay = document.getElementById('dash-auth-overlay');
    if (existingOverlay) existingOverlay.remove();

    const headerRight = document.querySelector('.dash-header-right');
    if (headerRight && username) {
        let badge = document.getElementById('dash-user-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'dash-user-badge';
            badge.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(168,170,173,0.12);border:1px solid rgba(168,170,173,0.3);border-radius:20px;font-size:11px;font-weight:800;color:#a8aaad;cursor:pointer;transition:all 0.2s;';
            badge.innerHTML = `<span class="st-icon st-icon-user" aria-hidden="true"></span><span>${username}</span>`;
            badge.title = 'Bấm để đổi mật khẩu';
            badge.onmouseover = () => { badge.style.background = 'rgba(168,170,173,0.2)'; badge.style.boxShadow = '0 0 10px rgba(168,170,173,0.3)'; };
            badge.onmouseout = () => { badge.style.background = 'rgba(168,170,173,0.12)'; badge.style.boxShadow = 'none'; };
            badge.onclick = openAccountSettings;
            headerRight.prepend(badge);
        }
    }
}

async function openAccountSettings() {
    const sess = await checkDashAuth();
    if (!sess) return;

    const content = document.createElement('div');
    content.innerHTML = `
        <div style="margin-top:10px">
            <div class="form-group">
                <label class="form-label">MẬT KHẨU CŨ</label>
                <div class="pw-wrapper">
                    <input type="password" id="modal-old-pw" class="form-input pw-input" placeholder="••••••">
                    <span class="pw-toggle">👁️</span>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">MẬT KHẨU MỚI</label>
                <div class="pw-wrapper">
                    <input type="password" id="modal-new-pw" class="form-input pw-input" placeholder="Tối thiểu 6 ký tự">
                    <span class="pw-toggle">👁️</span>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">XÁC NHẬN MẬT KHẨU MỚI</label>
                <div class="pw-wrapper">
                    <input type="password" id="modal-confirm-pw" class="form-input pw-input" placeholder="Nhập lại mật khẩu mới">
                    <span class="pw-toggle">👁️</span>
                </div>
            </div>
            <div id="modal-pw-msg" style="font-size:11px; color:#ff4d4d; margin-top:5px; text-align:center; min-height:16px"></div>
        </div>
    `;

    strangettsModal({
        title: 'Cài Đặt Tài Khoản',
        body: content,
        icon: '🔐',
        confirmText: 'ĐỔI MẬT KHẨU',
        cancelText: 'HỦY',
        isInput: false,
        autoClose: false,
        onConfirm: async (cleanup) => {
            const oldPw = document.getElementById('modal-old-pw').value;
            const newPw = document.getElementById('modal-new-pw').value;
            const confirmPw = document.getElementById('modal-confirm-pw').value;
            const msgEl = document.getElementById('modal-pw-msg');

            if (!oldPw || !newPw || !confirmPw) { msgEl.textContent = '⚠️ Vui lòng nhập đủ!'; return; }
            if (newPw.length < 6) { msgEl.textContent = '⚠️ Mật khẩu mới quá ngắn!'; return; }
            if (newPw !== confirmPw) { msgEl.textContent = '❌ Mật khẩu xác nhận không khớp!'; return; }

            try {
                const syncUrl = sess.syncUrl || (await chrome.storage.local.get(SYNC_URL_KEY))[SYNC_URL_KEY] || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
                const resp = await fetch(`${syncUrl}/api/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sess.token, old_password: oldPw, new_password: newPw })
                });
                const res = await resp.json();
                if (res.ok) {
                    cleanup();
                    await chrome.storage.local.remove(STORAGE_AUTH_KEY);
                    strangettsAlert('✅ Thành Công', 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại bằng mật khẩu mới.', '🎉');
                } else {
                    msgEl.textContent = `❌ ${res.error || 'Lỗi không xác định'}`;
                }
            } catch (e) {
                msgEl.textContent = '❌ Không thể kết nối Server!';
            }
        }
    });

    // Add eye toggle listener for the new modal (since it's dynamic HTML)
    content.querySelectorAll('.pw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            btn.textContent = isPass ? '🙈' : '👁️';
        });
    });
}

function showNotLoggedIn() {
    const existing = document.getElementById('dash-auth-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'dash-auth-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:999999;
        background:rgba(10,5,30,1);backdrop-filter:blur(15px);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-family:'Plus Jakarta Sans',sans-serif;
    `;
    overlay.innerHTML = `
        <div style="text-align:center;padding:40px;max-width:360px">
            <div style="font-size:56px;margin-bottom:16px;filter:drop-shadow(0 0 24px rgba(168,170,173,0.6))">🔐</div>
            <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:8px">Chưa Đăng Nhập</div>
            <div style="font-size:13px;color:#a78bfa;margin-bottom:20px;line-height:1.5">Đăng nhập để sử dụng Dashboard quản lý ads</div>
            <div style="font-size:12px;color:#7c6fa0;background:rgba(255,255,255,0.05);padding:12px 18px;border-radius:10px;border:1px solid rgba(92,96,102,0.4);line-height:1.6">
                💡 Bấm icon <strong style="color:#a8aaad">Strange TTS Solution</strong><br>trên thanh toolbar Chrome để đăng nhập
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Khởi tạo auth ngay khi load
async function initDashAuth() {
    const sess = await checkDashAuth();
    if (!sess) {
        showNotLoggedIn();
    } else {
        showAuthOverlay(sess.display || sess.username);
        // Sau khi load shops từ local, kiểm tra xem có cần sync khởi tạo không
        loadShops(async () => {
            renderAll();
            await checkFirstFullSync(sess);
            
            // AUTO-OPTIMIZATION: Background sweep for admin
            if (sess.role === 'admin') {
                console.log('[Auth] Admin detected, triggering silent background shop sweep...');
                adminLoadGlobalShops(); 
                // startAdminCookieSignalPolling(); // Đã tắt auto-polling — chỉ quét khi bấm nút
            }
        });
    }
}
initDashAuth();
window.initDashAuth = initDashAuth;

// Lắng nghe sự kiện từ extension popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'STRANGETTS_LOGOUT_EVENT') {
        console.log('[STRANGE TTS] Logout event received — Wiping RAM and showing overlay');
        // 1. Xóa sạch dữ liệu trong RAM
        shops = {};
        shopData = {};
        shopOrder = [];
        // 2. Cập nhật UI
        renderAll();
        showNotLoggedIn();
        strangettsAlert('🔐 Đã Đăng Xuất', 'Phiên đăng nhập đã kết thúc. Dữ liệu đã được xóa để bảo mật.', '🚪');
    }
    
    if (request.action === 'STRANGETTS_LOGIN_SUCCESS') {
        console.log('[STRANGE TTS] Login success detected — Refreshing Dashboard');
        // Xóa overlay nếu có
        const overlay = document.getElementById('dash-auth-overlay');
        if (overlay) overlay.remove();
        
        // Tải lại auth và data
        const sess = await checkDashAuth();
        if (sess) {
            showAuthOverlay(sess.display || sess.username);
            loadShops(async () => {
                renderAll();
                await checkFirstFullSync(sess);
                // if (sess.role === 'admin') startAdminCookieSignalPolling(); // Đã tắt auto-polling
            });
        }
    }
});

// Hàm đồng bộ khởi tạo: Ưu tiên bảo vệ data Cloud
// 1. Cloud TRỐNG -> Upload Local lên (Khởi tạo CRM)
// 2. Cloud CÓ DATA -> Chỉ Download về, TUYỆT ĐỐI không Auto Upload ghi đè
async function checkFirstFullSync(sess) {
    if (!sess || !sess.username) return;
    const flagKey = `strangetts_init_sync_v30_${sess.username}`;
    const storeFlag = await chrome.storage.local.get(flagKey);
    
    // Nếu thiết bị này đã từng khởi tạo sync cho user này rồi thì không chạy lại nữa
    if (storeFlag[flagKey]) return;

    console.log('[Sync] Kiểm tra Cloud lần đầu cho:', sess.username);
    
    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    try {
        const url = `${syncUrl}/api/download?username=${encodeURIComponent(sess.username)}&token=${encodeURIComponent(sess.token)}`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const res = await resp.json();
        
        if (res.ok && res.shops && Object.keys(res.shops).length > 0) {
            // TRƯỜNG HỢP 2: CLOUD ĐÃ CÓ DATA (User đăng nhập máy mới)
            // Chỉ tải về, không tự động đẩy lên để bảo vệ data Cloud hiện tại
            shops = normalizeStoredShopEntries(res.shops || {});
            shopOrder = (res.order || Object.keys(shops))
                .map(k => Object.keys(shops).find(x => x === k || shops[x].aadvid === k || shops[x].seller_id === k || shops[x].oec_seller_id === k) || k)
                .filter((k, i, arr) => shops[k] && arr.indexOf(k) === i);
            if (res.rp_config) await chrome.storage.local.set({ strangetts_rp_config: res.rp_config });
            await saveShops();
            renderAll();
            showToast(`☁️ Đã tự động tải dữ liệu Cloud về máy.`);
            console.log('[Sync] Cloud có data, đã tải về máy.');
        } else if (res.no_data) {
            // TRƯỜNG HỢP 1: CLOUD TRỐNG (User đăng nhập lần đầu tiên trong đời)
            // Nếu local đang có sẵn dữ liệu thì mới tự động đẩy lên Cloud
            if (Object.keys(shops).length > 0) {
                console.log('[Sync] Cloud trống, tự động đẩy dữ liệu Local lên Cloud...');
                await doSyncCloud(true); // Chạy ngầm upload
                showToast(`🚀 Đã tự động sao lưu dữ liệu local lên CRM Cloud.`);
            }
        }
        
        // Đánh dấu đã xong bước khởi tạo cho user này trên máy này
        await chrome.storage.local.set({ [flagKey]: true });
    } catch (e) {
        console.error('[Sync] Lỗi khởi tạo sync:', e);
    }
}

// Strange TTS Solution & CRM TT AI MULTI-ACCOUNT ADS
// Mỗi shop có thể có nhiều aadvid (TK Ads)
// Lưu trong shop.ads_accounts = [{ aadvid, label }]
// Fetch từng TK, gộp kết quả
// ══════════════════════════════════════════════

// Fetch tất cả TK ads của 1 shop, gộp kết quả
async function fetchShopMultiAccount(key, opts = {}) {
    const shop = shops[key];
    if (!shop) return;
    const silent = !!opts.silent;
    const shopName = shop.shopRealName || shop.name || key;

    const mainAadvid = String(shop.aadvid || '');
    const dataKey = dashGetShopDataKey(key, shop);
    const extraAccounts = (shop.ads_accounts || []).filter(a => a.aadvid && String(a.aadvid) !== mainAadvid && a.enabled !== false);
    if (extraAccounts.length === 0) {
        // Không có TK phụ → dùng logic cũ
        return fetchShop(key, opts);
    }

    // Có TK phụ → fetch tuần tự để tránh các lần inject cookie ghi đè nhau.
    // Data UI phải key theo shop identity; aadvid chỉ dùng làm Ads account khi gọi API.
    shopData[dataKey] = shopData[dataKey] || {};
    shopData[dataKey].status = 'loading';
    renderShopCard(key);
    if (!silent) showToast(`⏳ Đang tải dữ liệu ${shopName}...`);

    const allAadvids = [{ aadvid: mainAadvid, label: 'TK chính' }, ...extraAccounts];

    try {
        const results = [];
        for (const acc of allAadvids) {
            const isMainAccount = String(acc.aadvid) === mainAadvid;
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    action: 'fetch_multi_shop',
                    shop: { ...buildRuntimeShopPayload(shop, key), aadvid: acc.aadvid },
                    fetchOptions: { needAccountInfo: isMainAccount }
                }, response => resolve(response));
            });
            results.push({ acc, response });
        }

        // Gộp kết quả
        let merged = {
            shopName: shop.name, aadvid: shop.aadvid,
            totalCost: 0, totalGmv: 0, totalOrders: 0,
            campaigns: [], balance: 0, credit: 0,
            status: 'ok', fetchedAt: Date.now()
        };

        let anyOk = false;
        for (const { acc, response } of results) {
            if (!response || response.status !== 'ok') continue;
            anyOk = true;
            const isMainAccount = String(acc.aadvid) === mainAadvid;
            merged.totalCost   += (response.totalCost || 0);
            merged.totalGmv    += (response.totalGmv || 0);
            merged.totalOrders += (response.totalOrders || 0);
            if (isMainAccount) {
                merged.balance = response.balance || 0;
                merged.credit = response.credit || 0;
                merged.billingType = response.billingType || 0;
                merged.threshold = response.threshold || 0;
                merged.thresholdSpent = response.thresholdSpent || 0;
                merged._balanceLoaded = !!response._balanceLoaded;
                merged._billingLoaded = !!response._billingLoaded;
                merged._dueDateLoaded = !!response._dueDateLoaded;
                merged._accountInfoLoaded = !!response._accountInfoLoaded;
            }

            // Tag campaign với tên TK để phân biệt & trích xuất metrics
            const camps = (response.campaigns || []).map(c => {
                let stat = c.statistics || c.stat || {};
                return {
                    ...c,
                    name: `[${acc.label || acc.aadvid.slice(-4)}] ${c.name || c.campaign_name || c.campaign_id || c.id}`,
                    id: c.campaign_id || c.id,
                    cost: Number(c.cost || stat.cost || 0),
                    gmv: Number(c.gmv || stat.onsite_roi2_shopping_value || 0),
                    orders: Number(c.orders || stat.onsite_roi2_shopping_sku || 0),
                    roi: parseFloat(c.roi || stat.onsite_roi2_shopping || 0),
                    budget: Number(c.budget || c.campaign_target_roi_budget || 0),
                    targetRoi: parseFloat(c.targetRoi || c.campaign_target_roi || 0),
                    _aadvid: acc.aadvid
                };
            });
            merged.campaigns = merged.campaigns.concat(camps);
        }

        if (!anyOk) merged.status = 'error';
        merged.roi = merged.totalCost > 0 ? (merged.totalGmv / merged.totalCost).toFixed(2) : '0';
        merged.cpo = merged.totalOrders > 0 ? Math.round(merged.totalCost / merged.totalOrders) : 0;
        merged.campaignCount = merged.campaigns.length;

        shopData[dataKey] = merged;
        shopData[key] = merged;
        renderAll();
        if (activeShop === key) renderCampPanelContent(key);
        if (!silent) {
            if (merged.status === 'ok') showToast(`✅ Đã tải xong ${shopName}: GMV ${fmtDots(merged.totalGmv || 0)} | Đơn ${fmtDots(merged.totalOrders || 0)} | ROI ${merged.roi || '0'}`);
            else showToast(`❌ Lỗi tải ${shopName}: không lấy được dữ liệu tài khoản ads`);
        }
    } catch (err) {
        shopData[dataKey] = { status: 'error', error: err.message };
        shopData[key] = shopData[dataKey];
        renderAll();
        if (!silent) showToast(`❌ Lỗi tải ${shopName}: ${err.message}`);
    }
}

// Modal quản lý TK Ads cho 1 shop
function openMultiAccountModal(key) {
    const shop = shops[key];
    if (!shop) return;

    const existing = document.getElementById('multi-acc-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'multi-acc-modal';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:9990;
        background:rgba(26,8,56,0.92);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;
    `;

    const allAccounts = normalizeAdsAccountsForShop(shop, shop.ads_accounts || []);

    const listHtml = allAccounts.map((acc, i) => `
        <div class="s39-ad-account-row" data-aadvid="${acc.aadvid}" style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(92,96,102,0.3);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:border-color .15s,background .15s">
            <input type="radio" name="s39-main-ad-account" class="main-ad-account-radio" data-aadvid="${acc.aadvid}" ${acc.aadvid === shop.aadvid ? 'checked' : ''} style="display:none">
            <input type="checkbox" class="enabled-ad-account-check" data-aadvid="${acc.aadvid}" ${acc.enabled !== false ? 'checked' : ''} title="Lấy dữ liệu TK này" style="width:18px;height:18px;flex:0 0 auto;cursor:pointer">
            <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:700;color:#fff">${acc.label || acc.name || 'TK Ads ' + (i + 1)} <span class="s39-main-badge" style="font-size:9px;color:#fbbf24;${acc.aadvid === shop.aadvid ? '' : 'display:none'}">CHÍNH</span></div>
                <div style="font-size:10px;color:#7c6fa0;font-family:monospace">${acc.aadvid}</div>
            </div>
            <button class="btn-set-main-acc" data-aadvid="${acc.aadvid}" style="background:rgba(251,191,36,0.10);border:1px solid rgba(251,191,36,0.25);color:#fde68a;border-radius:6px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:700;${acc.aadvid === shop.aadvid ? 'display:none' : ''}">Đặt chính</button>
            <button class="btn-remove-acc" data-aadvid="${acc.aadvid}" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:6px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:700;${acc.aadvid === shop.aadvid ? 'display:none' : ''}">Xóa</button>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#222428;border:1px solid #5c6066;border-radius:16px;padding:20px;width:460px;max-width:calc(100vw - 40px);max-height:calc(100vh - 32px);box-shadow:0 20px 50px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex:0 0 auto">
                <div>
                    <div style="font-size:14px;font-weight:800;color:#a8aaad">📊 Quản Lý Tài Khoản Ads</div>
                    <div style="font-size:11px;color:#7c6fa0;margin-top:2px">${shop.name}</div>
                </div>
                <button id="modal-close-top" style="background:rgba(255,255,255,0.07);border:none;color:#94a3b8;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:16px">✕</button>
            </div>

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex:0 0 auto">
                <button id="btn-select-all-acc" style="flex:1;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#86efac;border-radius:8px;padding:7px 10px;font-size:11px;cursor:pointer;font-weight:800">
                    Chọn tất cả
                </button>
                <button id="btn-unselect-all-acc" style="flex:1;background:rgba(148,163,184,0.10);border:1px solid rgba(148,163,184,0.25);color:#cbd5e1;border-radius:8px;padding:7px 10px;font-size:11px;cursor:pointer;font-weight:800">
                    Bỏ chọn tất cả
                </button>
                <span id="multi-acc-selected-count" style="font-size:10px;color:#a78bfa;white-space:nowrap;min-width:56px;text-align:right"></span>
            </div>

            <div id="multi-acc-list" style="margin-bottom:14px;overflow-y:auto;max-height:min(52vh,520px);padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(168,170,173,0.5) transparent;flex:1 1 auto;min-height:120px">${listHtml}</div>

            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(92,96,102,0.3);border-radius:10px;padding:12px;flex:0 0 auto">
                <div style="font-size:11px;font-weight:800;color:#a78bfa;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">Thêm Tài Khoản Ads thủ công nếu API chưa có</div>
                <div style="display:flex;gap:6px;margin-bottom:6px">
                    <input id="new-acc-aadvid" type="text" placeholder="Ads Account ID (aadvid)..." style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(92,96,102,0.5);border-radius:7px;padding:7px 10px;color:#fff;font-size:12px;font-family:monospace">
                    <input id="new-acc-label" type="text" placeholder="Tên TK (VD: TK phụ 2)" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(92,96,102,0.5);border-radius:7px;padding:7px 10px;color:#fff;font-size:12px">
                </div>
                <button id="btn-add-acc-confirm" style="width:100%;background:linear-gradient(135deg,#8a8d91,#a8aaad);border:none;color:#fff;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">
                    Thêm Tài Khoản Ads
                </button>
                <div style="font-size:10px;color:#7c6fa0;margin-top:6px;text-align:center">
                    V40 sẽ ưu tiên danh sách lấy tự động từ seller. Ô này chỉ dùng làm fallback.
                </div>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-top:12px;flex:0 0 auto">
                <button id="btn-save-acc-selection" style="background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;border-radius:8px;padding:7px 16px;font-size:12px;cursor:pointer;font-weight:700;margin-right:8px">
                    Lưu lựa chọn
                </button>
                <button id="modal-close-bottom" style="background:rgba(255,255,255,0.07);border:1px solid rgba(92,96,102,0.3);color:#94a3b8;border-radius:8px;padding:7px 16px;font-size:12px;cursor:pointer;font-weight:700">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // ── Wire up events (CSP-safe: no inline onclick) ──
    modal.querySelector('#modal-close-top').addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-close-bottom').addEventListener('click', () => modal.remove());
    modal.querySelector('#btn-add-acc-confirm').addEventListener('click', () => addAdsAccount(key));
    modal.querySelector('#btn-save-acc-selection').addEventListener('click', () => saveAdsAccountSelection(key));
    const updateAccountRows = () => {
        const mainAadvid = modal.querySelector('.main-ad-account-radio:checked')?.dataset.aadvid;
        modal.querySelectorAll('.s39-ad-account-row').forEach(row => {
            const checkbox = row.querySelector('.enabled-ad-account-check');
            const isChecked = !!checkbox?.checked;
            const isMain = row.dataset.aadvid === mainAadvid;
            row.style.borderColor = isChecked ? 'rgba(16,185,129,0.45)' : 'rgba(92,96,102,0.3)';
            row.style.background = isChecked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)';
            const badge = row.querySelector('.s39-main-badge');
            if (badge) badge.style.display = isMain ? 'inline' : 'none';
            const setMainBtn = row.querySelector('.btn-set-main-acc');
            if (setMainBtn) setMainBtn.style.display = isMain ? 'none' : 'inline-flex';
            const removeBtn = row.querySelector('.btn-remove-acc');
            if (removeBtn) removeBtn.style.display = isMain ? 'none' : 'inline-flex';
        });
    };
    const refreshSelectedCount = () => {
        const checks = Array.from(modal.querySelectorAll('.enabled-ad-account-check'));
        const selected = checks.filter(el => el.checked).length;
        const countEl = modal.querySelector('#multi-acc-selected-count');
        if (countEl) countEl.textContent = `${selected}/${checks.length}`;
        updateAccountRows();
    };
    const ensureMainAccountEnabled = () => {
        const mainAadvid = modal.querySelector('.main-ad-account-radio:checked')?.dataset.aadvid;
        if (!mainAadvid) return;
        const mainCheck = Array.from(modal.querySelectorAll('.enabled-ad-account-check'))
            .find(el => el.dataset.aadvid === mainAadvid);
        if (mainCheck) mainCheck.checked = true;
    };
    modal.querySelector('#btn-select-all-acc')?.addEventListener('click', () => {
        modal.querySelectorAll('.enabled-ad-account-check').forEach(el => { el.checked = true; });
        refreshSelectedCount();
    });
    modal.querySelector('#btn-unselect-all-acc')?.addEventListener('click', () => {
        modal.querySelectorAll('.enabled-ad-account-check').forEach(el => { el.checked = false; });
        ensureMainAccountEnabled();
        refreshSelectedCount();
    });
    modal.querySelectorAll('.enabled-ad-account-check').forEach(el => {
        el.addEventListener('change', () => {
            ensureMainAccountEnabled();
            refreshSelectedCount();
        });
    });
    modal.querySelectorAll('.main-ad-account-radio').forEach(el => {
        el.addEventListener('change', () => {
            ensureMainAccountEnabled();
            refreshSelectedCount();
        });
    });
    modal.querySelectorAll('.btn-set-main-acc').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const radio = modal.querySelector(`.main-ad-account-radio[data-aadvid="${btn.dataset.aadvid}"]`);
            if (radio) radio.checked = true;
            ensureMainAccountEnabled();
            refreshSelectedCount();
        });
    });
    modal.querySelectorAll('.s39-ad-account-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('button,input')) return;
            const checkbox = row.querySelector('.enabled-ad-account-check');
            if (!checkbox) return;
            checkbox.checked = !checkbox.checked;
            ensureMainAccountEnabled();
            refreshSelectedCount();
        });
    });
    ensureMainAccountEnabled();
    refreshSelectedCount();
    modal.querySelectorAll('.btn-remove-acc').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            removeAdsAccount(key, btn.dataset.aadvid);
        });
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function saveAdsAccountSelection(key) {
    const shop = shops[key];
    const modal = document.getElementById('multi-acc-modal');
    if (!shop || !modal) return;
    const allAccounts = normalizeAdsAccountsForShop(shop, shop.ads_accounts || []);
    const mainAadvid = modal.querySelector('.main-ad-account-radio:checked')?.dataset.aadvid || shop.aadvid;
    const enabledSet = new Set(Array.from(modal.querySelectorAll('.enabled-ad-account-check:checked')).map(el => el.dataset.aadvid));
    if (!enabledSet.size) enabledSet.add(mainAadvid);
    const selectedMain = allAccounts.find(acc => acc.aadvid === mainAadvid) || { aadvid: mainAadvid, label: mainAadvid };
    const dataKey = dashGetShopDataKey(key, shop);
    shop.aadvid = mainAadvid;
    shop.mainAccountLabel = selectedMain.label || selectedMain.name || mainAadvid;
    shop.ads_accounts = allAccounts
        .map(acc => ({ ...acc, enabled: enabledSet.has(acc.aadvid), isMain: acc.aadvid === mainAadvid }))
        .filter(acc => acc.aadvid !== mainAadvid);
    saveShops();
    delete shopData[dataKey];
    chrome.storage.local.remove('strangetts_rp_data_' + dataKey);
    if (typeof syncShopsToBackground === 'function') syncShopsToBackground();
    if (typeof renderReportShopList === 'function') renderReportShopList({ captureInputs: true });
    renderAll();
    showToast('Đã lưu lựa chọn tài khoản ads');
    modal.remove();
}

function addAdsAccount(key) {
    const aadvid = document.getElementById('new-acc-aadvid')?.value.trim();
    const label  = document.getElementById('new-acc-label')?.value.trim() || ('TK phụ ' + ((shops[key].ads_accounts || []).length + 1));

    if (!aadvid) return showToast('⚠️ Vui lòng nhập Ads Account ID!');
    if (!/^\d{6,}$/.test(aadvid)) return showToast('⚠️ Ads Account ID không hợp lệ (chỉ gồm số)!');

    const shop = shops[key];
    if (!shop) return;

    if (shop.aadvid === aadvid) return showToast('⚠️ Đây là TK chính, không cần thêm!');

    const existing = (shop.ads_accounts || []);
    if (existing.find(a => a.aadvid === aadvid)) return showToast('⚠️ Tài khoản này đã được thêm!');

    shops[key].ads_accounts = [...existing, { aadvid, label, name: label, enabled: true }];
    saveShops();
    showToast(`✅ Đã thêm tài khoản ${label} (${aadvid})`);

    // Mở lại modal để thấy danh sách cập nhật
    document.getElementById('multi-acc-modal')?.remove();
    openMultiAccountModal(key);
}

function removeAdsAccount(key, aadvid) {
    if (!confirm(`Xóa tài khoản ads ${aadvid} khỏi shop này?`)) return;
    const shop = shops[key];
    if (!shop) return;
    shops[key].ads_accounts = (shop.ads_accounts || []).filter(a => a.aadvid !== aadvid);
    saveShops();
    showToast(`🗑 Đã xóa tài khoản ${aadvid}`);
    document.getElementById('multi-acc-modal')?.remove();
    openMultiAccountModal(key);
}

// ── Realtime clock (global, cập nhật mỗi giây) ──────────────────────────────
(function startGlobalClock() {
    function tick() {
        const el = document.getElementById('rp-realtime-clock');
        if (!el) return;
        const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        el.textContent = `${String(vn.getHours()).padStart(2,'0')}:${String(vn.getMinutes()).padStart(2,'0')}:${String(vn.getSeconds()).padStart(2,'0')}`;
    }
    tick();
    setInterval(tick, 1000);
})();

// ── FORMAT HELPERS ──────────────────────────────
function fmt(num) {
    if (!num && num !== 0) return '—';
    return Math.round(Number(num)).toLocaleString('vi-VN');
}
function fmtShort(num) {
    if (num === 0) return '0';
    if (!num) return '—';
    let n = Number(num);
    if (n >= 1000000) {
        let m = Math.floor(n / 1000000);
        let r = Math.round((n % 1000000) / 100000);
        return r > 0 ? m + 'm' + r : m + 'm';
    }
    if (n >= 1000) {
        let k = Math.floor(n / 1000);
        let r = Math.round((n % 1000) / 100);
        return r > 0 ? k + 'k' + r : k + 'k';
    }
    return Math.round(n).toString();
}
function fmtDots(num) {
    if (!num && num !== 0) return '0';
    return Math.round(Number(num)).toLocaleString('vi-VN');
}

function getPerfStats(campaigns) {
    let stats = { total: (campaigns || []).length, near_budget: 0, low_roi: 0, good_roi: 0, strong: 0, weak: 0, testing: 0, totalBudget: 0 };
    (campaigns || []).forEach(c => {
        let spend = Number(c.cost) || 0;
        let budget = Number(c.budget) || 0;
        let roi = parseFloat(c.roi) || 0;
        let targetRoi = parseFloat(c.targetRoi) || 0;
        let orders = Number(c.orders) || 0;
        stats.totalBudget += budget;
        let spendPct = budget > 0 ? (spend / budget) * 100 : 0;
        
        if (spendPct >= 85 || (c.status || '').includes('OUT_OF_BUDGET')) stats.near_budget++;
        if (targetRoi > 0 && roi < targetRoi * 0.8) stats.low_roi++;
        if (targetRoi > 0 && roi >= targetRoi) stats.good_roi++;
        if (targetRoi > 0 && roi >= targetRoi && orders >= 10 && spendPct >= 50) stats.strong++;
        if (spend >= 50000 && (orders === 0 || (targetRoi > 0 && roi < targetRoi * 0.6))) stats.weak++;
        if (spend > 0 && spend < 50000) stats.testing++;
    });
    return stats;
}

function getShopActionStatus(aadvid) {
    let d = dashGetShopData(aadvid);
    let score = 0;
    let status = 'stable'; // stable, monitor, urgent, inactive
    let recommendation = 'Đang chạy ổn định';
    let type = 'normal'; // normal, warn, crit

    if (d.status === 'error') return { score: 100, status: 'urgent', recommendation: 'Lỗi Cookie - Hãy xuất lại shop!', type: 'crit' };
    if (!d.campaigns || d.campaigns.length === 0) return { score: 50, status: 'inactive', recommendation: 'Shop chưa có campaign đang chạy', type: 'warn' };

    let stats = getPerfStats(d.campaigns);
    if (d.billingType === 2 && d.threshold > 0) {
        let pct = (d.thresholdSpent / d.threshold) * 100;
        if (pct >= 90) { score += 45; recommendation = 'Rủi ro: Ngưỡng sắp đầy (>90%)'; type = 'crit'; }
        else if (pct >= 75) { score += 20; recommendation = 'Chú ý: Ngưỡng đã dùng >75%'; type = 'warn'; }
    } else if (d.billingType === 1 && d.balance != null) {
        if (d.balance < 100000) { score += 40; recommendation = 'Sắp hết số dư!'; type = 'crit'; }
    }

    if (stats.low_roi > 0) { score += stats.low_roi * 5; if (score > 30 && type !== 'crit') { recommendation = 'Cần tối ưu ROI cho ' + stats.low_roi + ' camp'; type = 'warn'; } }
    if (stats.weak > 0) { score += stats.weak * 8; if (score > 40 && type !== 'crit') { recommendation = 'Nhiều camp yếu tiêu tiền không đơn'; type = 'crit'; } }
    if (stats.strong > 0 && type === 'normal') { recommendation = 'Có ' + stats.strong + ' camp cực khỏe - Hãy scale!'; }
    else if (stats.near_budget > 0 && type === 'normal') { recommendation = 'Có ' + stats.near_budget + ' camp sắp hết ngân sách'; type = 'warn'; }

    if (score >= 60) status = 'urgent';
    else if (score >= 30) status = 'monitor';
    else status = 'stable';

    return { score, status, recommendation, type };
}

function getRoiClass(roi) {
    let r = parseFloat(roi);
    if (r >= 3) return 'green';
    if (r >= 2) return 'yellow';
    return 'orange';
}

// ===== TOAST =====
function showToast(msg) {
    let t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function dashFirstText(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
}

function getShopCanonicalKey(shop = {}, fallback = '') {
    const aadvid = dashFirstText(shop.aadvid);
    const canonical = dashFirstText(shop.canonical_shop_id);
    if (canonical && canonical !== aadvid) return canonical;
    return dashFirstText(shop.oec_seller_id, shop.seller_id, shop.shop_id, shop.id, fallback, aadvid);
}

function dashGetShopDataKey(shopKey, shop = null) {
    const s = shop || shops[shopKey] || {};
    const aadvid = dashFirstText(s.aadvid);
    const dataKey = getShopCanonicalKey(s, shopKey);
    if (aadvid && dataKey === aadvid && dashAadvidIsShared(aadvid, shopKey)) return shopKey;
    return dataKey;
}

function dashAadvidIsShared(aadvid, currentKey = '') {
    const id = dashFirstText(aadvid);
    if (!id) return false;
    return Object.keys(shops || {}).some(k => k !== currentKey && String(shops[k]?.aadvid || '') === id);
}

function normalizeAdsAccountsForShop(shop = {}, rawAccounts = []) {
    const primaryAadvid = dashFirstText(shop.aadvid);
    const map = new Map();
    const push = (acc, fallbackLabel = '') => {
        if (!acc) return;
        const aadvid = dashFirstText(acc.aadvid, acc.id, acc.advertiser_id, acc.adv_id);
        if (!aadvid) return;
        const prev = map.get(aadvid) || {};
        map.set(aadvid, {
            ...prev,
            ...acc,
            aadvid,
            label: dashFirstText(acc.label, acc.name, acc.advertiser_name, fallbackLabel, aadvid),
            name: dashFirstText(acc.name, acc.label, acc.advertiser_name, fallbackLabel, aadvid),
            enabled: acc.enabled !== false,
            isMain: aadvid === primaryAadvid
        });
    };
    (rawAccounts || []).forEach(acc => push(acc));
    (shop.ads_accounts || []).forEach(acc => push(acc));
    if (primaryAadvid) {
        if (map.has(primaryAadvid)) {
            map.set(primaryAadvid, { ...map.get(primaryAadvid), isMain: true });
        } else {
            push({ aadvid: primaryAadvid, enabled: true, isMain: true }, shop.mainAccountLabel || 'TK chính');
        }
    }
    return Array.from(map.values()).sort((a, b) => {
        if (a.aadvid === primaryAadvid) return -1;
        if (b.aadvid === primaryAadvid) return 1;
        return String(a.label || a.aadvid).localeCompare(String(b.label || b.aadvid));
    });
}

function mergeAdsAccountsPreservingSelection(existingShop = {}, incomingAccounts = [], primaryAadvid = '') {
    const mainAadvid = dashFirstText(primaryAadvid, existingShop.aadvid);
    const existingAccounts = normalizeAdsAccountsForShop(existingShop, existingShop.ads_accounts || []);
    const incomingNormalized = normalizeAdsAccountsForShop({ ...existingShop, aadvid: mainAadvid, ads_accounts: [] }, incomingAccounts || []);
    const enabledById = new Map(existingAccounts.map(acc => [acc.aadvid, acc.enabled !== false]));
    const mergedById = new Map();

    incomingNormalized.forEach(acc => mergedById.set(acc.aadvid, acc));
    existingAccounts.forEach(acc => {
        const incoming = mergedById.get(acc.aadvid);
        mergedById.set(acc.aadvid, incoming ? { ...acc, ...incoming } : acc);
    });

    return normalizeAdsAccountsForShop({ ...existingShop, aadvid: mainAadvid, ads_accounts: [] }, Array.from(mergedById.values()).map(acc => ({
        ...acc,
        enabled: enabledById.has(acc.aadvid) ? enabledById.get(acc.aadvid) : acc.enabled !== false,
        isMain: acc.aadvid === mainAadvid
    })));
}

function normalizeIncomingShopRecord(data = {}, fallbackKey = '', sourceMeta = {}) {
    const base = (data.shop && typeof data.shop === 'object') ? data.shop : data;
    const allAccounts = normalizeAdsAccountsForShop(base, [
        ...(data.ads_accounts || []),
        ...(base.ads_accounts || [])
    ]);
    const primaryAadvid = dashFirstText(base.aadvid, allAccounts[0]?.aadvid, fallbackKey);
    const canonical = getShopCanonicalKey(base, fallbackKey);
    return {
        ...base,
        name: dashFirstText(base.name, base.shopRealName, data.name, fallbackKey),
        shopRealName: dashFirstText(base.shopRealName, data.shopRealName, base.name, data.name, fallbackKey),
        shopAvatar: dashFirstText(base.shopAvatar, base.shopLogo, data.shopAvatar, data.shopLogo),
        aadvid: primaryAadvid,
        oec_seller_id: dashFirstText(base.oec_seller_id, data.oec_seller_id),
        seller_id: dashFirstText(base.seller_id, data.seller_id),
        bc_id: dashFirstText(base.bc_id, data.bc_id),
        uid: dashFirstText(base.uid, data.uid),
        canonical_shop_id: canonical,
        cookies: data.cookies || base.cookies || [],
        ads_accounts: allAccounts.filter(acc => acc.aadvid !== primaryAadvid),
        version: data.version || base.version || '42',
        exportedAt: data.exportedAt || base.exportedAt || '',
        importedAt: data.importedAt || base.importedAt || Date.now(),
        source_username: dashFirstText(sourceMeta.source_username, data.source_username, base.source_username, data.owner, base.owner),
        source_shop_key: dashFirstText(sourceMeta.source_shop_key, data.source_shop_key, base.source_shop_key, fallbackKey),
        cookieFingerprint: dashFirstText(data.cookieFingerprint, base.cookieFingerprint),
        cookieUpdatedAt: dashFirstText(data.cookieUpdatedAt, base.cookieUpdatedAt)
    };
}

function findExistingShopKeyByIdentity(shopObj = {}, preferredKey = '') {
    const canonical = getShopCanonicalKey(shopObj, preferredKey);
    return Object.keys(shops || {}).find(k => {
        const s = shops[k] || {};
        return k === preferredKey ||
            getShopCanonicalKey(s, k) === canonical ||
            (shopObj.oec_seller_id && s.oec_seller_id === shopObj.oec_seller_id) ||
            (shopObj.seller_id && s.seller_id === shopObj.seller_id);
    });
}

function upsertShopRecord(data = {}, fallbackKey = '', sourceMeta = {}) {
    const shopObj = normalizeIncomingShopRecord(data, fallbackKey, sourceMeta);
    const shopKey = getShopCanonicalKey(shopObj, fallbackKey);
    if (!shopKey || !shopObj.aadvid) return null;
    const existingKey = findExistingShopKeyByIdentity(shopObj, shopKey);
    const finalKey = shopKey;
    const existing = (existingKey && shops[existingKey]) || shops[finalKey] || {};
    const mergedAccounts = mergeAdsAccountsPreservingSelection(existing, shopObj.ads_accounts || [], shopObj.aadvid);
    shops[finalKey] = {
        ...existing,
        ...shopObj,
        canonical_shop_id: shopKey,
        ads_accounts: mergedAccounts.filter(acc => acc.aadvid !== shopObj.aadvid)
    };
    if (existingKey && existingKey !== finalKey) {
        delete shops[existingKey];
        shopOrder = shopOrder.map(k => k === existingKey ? finalKey : k);
    }
    if (!shopOrder.includes(finalKey)) shopOrder.unshift(finalKey);
    shopOrder = shopOrder.filter((k, idx, arr) => shops[k] && arr.indexOf(k) === idx);
    return finalKey;
}

function buildRuntimeShopPayload(shop = {}, localKey = '') {
    return {
        name: shop.name,
        shopRealName: shop.shopRealName || shop.name,
        shopAvatar: shop.shopAvatar || '',
        aadvid: shop.aadvid,
        oec_seller_id: shop.oec_seller_id,
        seller_id: shop.seller_id,
        bc_id: shop.bc_id,
        cookies: shop.cookies || [],
        ads_accounts: shop.ads_accounts || [],
        local_key: localKey,
        canonical_shop_id: shop.canonical_shop_id || getShopCanonicalKey(shop, localKey),
        source_username: shop.source_username || '',
        source_shop_key: shop.source_shop_key || '',
        cookieFingerprint: shop.cookieFingerprint || '',
        cookieUpdatedAt: shop.cookieUpdatedAt || ''
    };
}

function normalizeDashboardLayout(layout) {
    return ['cards', 'table', 'compact'].includes(layout) ? layout : 'cards';
}

function syncViewToggleButtons() {
    const cardBtn = document.getElementById('btn-view-cards');
    const tableBtn = document.getElementById('btn-view-table');
    if (cardBtn) cardBtn.classList.toggle('active', viewMode !== 'table');
    if (tableBtn) tableBtn.classList.toggle('active', viewMode === 'table');
}

function applyDashboardLayout(layout) {
    const nextLayout = normalizeDashboardLayout(layout);
    dashboardLayout = nextLayout;
    viewMode = nextLayout === 'table' ? 'table' : 'cards';
    document.documentElement.dataset.dashboardLayout = nextLayout;
    const selector = document.getElementById('sel-dashboard-layout');
    if (selector && selector.value !== nextLayout) selector.value = nextLayout;
    syncViewToggleButtons();
}

async function initDashboardLayout() {
    const store = await chrome.storage.local.get({ [UI_LAYOUT_KEY]: 'cards' });
    applyDashboardLayout(store[UI_LAYOUT_KEY]);

    document.getElementById('sel-dashboard-layout')?.addEventListener('change', async (event) => {
        const nextLayout = normalizeDashboardLayout(event.target.value);
        await chrome.storage.local.set({ [UI_LAYOUT_KEY]: nextLayout });
        applyDashboardLayout(nextLayout);
        renderAll();
        showToast(`Layout: ${nextLayout}`);
    });
}

const STRANGETTS_LOCAL_APP_API = 'http://127.0.0.1:48731';

function buildSellerAdsDashboardUrl() {
    const now = new Date();
    const startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const endTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    return `https://seller-vn.tiktok.com/ads-creation/dashboard?type=product&shop_region=VN&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${startTs}&list_end_date=${endTs}`;
}

async function openIsolatedShopPage(shopKey, options = {}) {
    const shop = options.shopOverride || shops[shopKey];
    if (!shop) throw new Error('Shop not found');
    const payload = {
        shopKey,
        shop: buildRuntimeShopPayload(shop, shopKey),
        targetUrl: options.targetUrl || buildSellerAdsDashboardUrl(),
        pageType: options.pageType || 'seller'
    };
    const response = await fetch(`${STRANGETTS_LOCAL_APP_API}/api/runtime/open-shop-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        throw new Error(result.error || `Local app API ${response.status}`);
    }
    return result;
}

async function fetchShopViaLocalHeadless(shopKey, shop, fetchOptions = {}) {
    const response = await fetch(`${STRANGETTS_LOCAL_APP_API}/api/runtime/fetch-shop-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shopKey,
            shop: buildRuntimeShopPayload(shop, shopKey),
            fetchOptions,
            timeoutMs: 90000
        })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.data) {
        throw new Error(result.error || `Local app API ${response.status}`);
    }
    return result.data;
}

function businessEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function businessMoney(value) {
    return Math.round(Number(value || 0)).toLocaleString('vi-VN');
}

function businessPct(value) {
    const n = Number(value || 0);
    return `${(n * 100).toFixed(1)}%`;
}

function businessCsvCell(value) {
    const raw = String(value ?? '');
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function businessDownloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
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

function businessExportPlanCsv(result) {
    const rows = [
        ['Loại', 'Chỉ số', 'Giá trị'],
        ['Tổng quan', 'Kỳ dữ liệu', result.period || ''],
        ['Tổng quan', 'Kỳ kế hoạch', result.plan?.period || ''],
        ['KPI', 'Doanh thu cũ', Math.round(Number(result.kpis?.revenue || 0))],
        ['KPI', 'Nguồn doanh thu', result.kpis?.revenueSource || ''],
        ['KPI', 'Lợi nhuận ước tính', Math.round(Number(result.kpis?.netProfitEstimate || 0))],
        ['KPI', 'Net margin', businessPct(result.kpis?.netMargin)],
        ['Ads', 'Chi phí thực tế', Math.round(Number(result.costs?.adsActualCost || 0))],
        ['Chi phí', 'Phí sàn / voucher / hoàn tiền', Math.round(Number(result.costs?.marketplaceFee || 0))],
        ['Chi phí', 'Phí thanh toán', Math.round(Number(result.costs?.paymentFee || 0))],
        ['Chi phí', 'Phí vận hành / đóng gói', Math.round(Number(result.costs?.operationFee || 0))],
        ['Chi phí', 'Chi phí cố định', Math.round(Number(result.costs?.fixedCost || 0))],
        ['Chi phí', 'Tổng chi phí', Math.round(Number(result.costs?.totalCost || 0))],
        ['Kế hoạch', 'Mục tiêu doanh thu', Math.round(Number(result.plan?.targetRevenue || 0))],
        ['Kế hoạch', 'Ngân sách ads gợi ý', Math.round(Number(result.plan?.suggestedAdsBudget || 0))],
        ['Kế hoạch', 'ROI hòa vốn', Number(result.plan?.breakEvenRoi || 0).toFixed(2)]
    ];
    for (const action of result.plan?.actions || []) rows.push(['Action', action, '']);
    rows.push([]);
    rows.push(['Metric tùy biến', 'Chỉ số', 'Giá trị']);
    for (const section of result.metricSections || []) {
        for (const item of section.items || []) {
            rows.push([section.title || section.key || '', item.label || item.key || '', item.format === 'text' ? (item.value ?? '') : Number(item.value || 0)]);
        }
    }
    rows.push([]);
    rows.push(['SKU ưu tiên', 'Doanh thu cũ', 'Lãi gộp ước tính']);
    for (const item of result.plan?.focusSkus || []) {
        rows.push([item.skuName, Math.round(Number(item.revenue || 0)), Math.round(Number(item.grossProfit || 0))]);
    }
    return rows.map(row => row.map(businessCsvCell).join(',')).join('\r\n');
}

function businessReadFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}`));
        reader.onload = () => {
            const raw = String(reader.result || '');
            resolve(raw.includes(',') ? raw.split(',').pop() : raw);
        };
        reader.readAsDataURL(file);
    });
}

async function businessBuildPayload(form) {
    const dataFiles = Array.from(form.querySelector('input[name="businessFiles"]')?.files || []);
    const priceFiles = Array.from(form.querySelector('input[name="priceFile"]')?.files || []);
    const files = [];
    for (const file of dataFiles) {
        files.push({
            name: file.name,
            type: 'auto',
            size: file.size,
            contentBase64: await businessReadFileAsBase64(file)
        });
    }
    const priceFile = priceFiles[0]
        ? {
            name: priceFiles[0].name,
            size: priceFiles[0].size,
            contentBase64: await businessReadFileAsBase64(priceFiles[0])
        }
        : null;
    const fd = new FormData(form);
    return {
        priceSheetUrl: fd.get('priceSheetUrl'),
        priceFile,
        files,
        shopId: fd.get('crawlerShopId') || document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion',
        crawlerShopId: fd.get('crawlerShopId') || document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion',
        sellerId: fd.get('crawlerSellerId') || document.getElementById('tts-crawler-seller-id')?.value || '7494478078863902049',
        adsCreditRatio: Number(fd.get('adsCreditRatio') || 0) / 100,
        periodLabel: fd.get('periodLabel'),
        nextPeriodLabel: fd.get('nextPeriodLabel'),
        targetGrowthPct: Number(fd.get('targetGrowthPct') || 20)
    };
}

function businessEnsureRealtimeCrawlerUi() {
    const form = document.getElementById('business-analysis-form');
    if (form && !document.getElementById('business-realtime-panel')) {
        form.classList.add('business-analysis-layout');
        form.insertAdjacentHTML('afterbegin', `
            <section class="business-form-section business-form-section-compact" id="business-realtime-panel">
                <div class="business-section-title">
                    <div>
                        <strong>Crawler realtime</strong>
                        <span>Cào nhanh Seller Center để cập nhật chỉ số native theo shop đang chọn.</span>
                    </div>
                    <span class="business-section-pill">Ngày hiện tại</span>
                </div>
                <label class="business-field">
                    <span>Shop DB</span>
                    <input name="crawlerShopId" id="business-crawler-shop-id" value="${businessEscapeHtml(document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion')}" autocomplete="off">
                </label>
                <label class="business-field">
                    <span>Seller ID</span>
                    <input name="crawlerSellerId" id="business-crawler-seller-id" value="${businessEscapeHtml(document.getElementById('tts-crawler-seller-id')?.value || '7494478078863902049')}" autocomplete="off">
                </label>
                <label class="business-field">
                    <span>CDP port</span>
                    <input name="crawlerCdpPort" id="business-crawler-cdp-port" value="${businessEscapeHtml(document.getElementById('tts-crawler-cdp-port')?.value || '58849')}" autocomplete="off">
                </label>
                <label class="business-field">
                    <span>Giới hạn module</span>
                    <input name="crawlerMaxModules" id="business-crawler-max-modules" value="${businessEscapeHtml(document.getElementById('tts-crawler-max-modules')?.value || '0')}" autocomplete="off">
                </label>
                <label class="business-field wide">
                    <span>URL Seller Center</span>
                    <input name="crawlerBaseUrl" id="business-crawler-base-url" value="${businessEscapeHtml(document.getElementById('tts-crawler-base-url')?.value || 'https://seller-vn.tiktok.com/homepage?shop_region=VN')}" autocomplete="off">
                </label>
                <div class="business-actions business-actions-bar">
                    <button class="btn btn-primary" type="button" id="business-realtime-crawl-inline"><span class="st-icon st-icon-refresh" aria-hidden="true"></span>Cào realtime</button>
                    <button class="btn btn-secondary" type="button" id="business-open-crawler-tab"><span class="st-icon st-icon-data" aria-hidden="true"></span>Mở TikTok Crawler</button>
                    <span class="business-help-text" id="business-realtime-status">Chưa chạy realtime crawl trong phiên này.</span>
                </div>
            </section>
            <section class="business-form-section" id="business-upload-panel">
                <div class="business-section-title">
                    <div>
                        <strong>Dữ liệu bổ sung từ file</strong>
                        <span>Nạp XLSX/CSV để bổ sung ads, giá vốn, KOC/video và P&L. Có thể bỏ trống nếu chỉ xem crawler.</span>
                    </div>
                </div>
            </section>
        `);
        const uploadPanel = document.getElementById('business-upload-panel');
        [...form.children].forEach(child => {
            if (child.id === 'business-realtime-panel' || child.id === 'business-upload-panel') return;
            uploadPanel?.appendChild(child);
        });
    }

    const actions = document.querySelector('#panel-business-analysis .business-head-actions');
    if (actions && !document.getElementById('business-realtime-crawl')) {
        actions.classList.add('business-action-cluster');
        actions.insertAdjacentHTML('afterbegin', `
            <button class="btn btn-primary" type="button" id="business-realtime-crawl"><span class="st-icon st-icon-refresh" aria-hidden="true"></span>Cào realtime</button>
            <button class="btn btn-secondary" type="button" id="business-refresh-dashboard"><span class="st-icon st-icon-trend-up" aria-hidden="true"></span>Cập nhật dashboard</button>
        `);
        const planButton = document.getElementById('business-open-plan');
        if (planButton) planButton.classList.remove('btn-primary');
        if (planButton) planButton.classList.add('btn-secondary');
        const rulesButton = document.getElementById('business-toggle-rules');
        if (planButton && rulesButton && planButton.nextElementSibling !== rulesButton) {
            actions.insertBefore(planButton, rulesButton);
        }
    }
}

function businessCrawlerFormValue(id, fallback = '') {
    return document.getElementById(id)?.value || document.getElementById(id.replace('business-crawler', 'tts-crawler'))?.value || fallback;
}

async function businessRefreshAnalysisDashboard() {
    const form = document.getElementById('business-analysis-form');
    if (!form) return;
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else document.getElementById('business-run-analysis')?.click();
}

async function businessRunRealtimeCrawler(event) {
    const button = event?.currentTarget || document.getElementById('business-realtime-crawl');
    const status = document.getElementById('business-realtime-status');
    const original = button?.innerHTML || '';
    const shopId = businessCrawlerFormValue('business-crawler-shop-id', 'little-apricot-hawaii-fashion');
    const sellerId = businessCrawlerFormValue('business-crawler-seller-id', '7494478078863902049');
    const cdpPort = Number(businessCrawlerFormValue('business-crawler-cdp-port', '58849') || 58849);
    const baseUrl = businessCrawlerFormValue('business-crawler-base-url', 'https://seller-vn.tiktok.com/homepage?shop_region=VN');
    const maxModules = Number(businessCrawlerFormValue('business-crawler-max-modules', '0') || 0);
    try {
        const beforeDb = await crawlerApi(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`).catch(() => ({}));
        const previousRunId = beforeDb?.sellerCenter?.runId || '';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="st-icon st-icon-refresh" aria-hidden="true"></span>Đang gửi job';
        }
        if (status) status.textContent = 'Đang gửi job cào realtime Seller Center...';
        setStatus('Đang cào realtime Seller Center...');
        await crawlerApi('/api/tiktokshop-crawler/crawl', {
            method: 'POST',
            body: {
                mode: 'seller-center',
                shopId,
                sellerId,
                cdpPort,
                baseUrl,
                dateRange: 'today',
                maxModules,
                force: true
            }
        });
        if (status) status.textContent = 'Job realtime đã bắt đầu. Đang đợi crawler ghi DB...';
        let latest = null;
        let freshRunSeen = false;
        for (let i = 0; i < 60; i += 1) {
            await new Promise(resolve => setTimeout(resolve, i < 3 ? 1600 : 3000));
            const data = await crawlerApi(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`);
            latest = data.sellerCenter;
            freshRunSeen = Boolean(latest?.runId && latest.runId !== previousRunId);
            if (status) status.textContent = `Realtime: ${freshRunSeen ? 'đã có run mới' : 'đang chờ run mới'}${latest?.runId ? ` | ${latest.runId}` : ''}`;
            if (freshRunSeen && latest?.status && latest.status !== 'running') break;
        }
        if (!freshRunSeen) throw new Error('Crawler chưa ghi run mới. Có thể job vẫn đang chạy hoặc CDP/cookie chưa phản hồi.');
        if (latest?.status === 'error') throw new Error(latest.error || 'Crawler realtime lỗi.');
        await businessRefreshAnalysisDashboard();
        setStatus('Đã cập nhật dashboard từ realtime crawler.');
        showToast('Đã cào realtime và cập nhật dashboard');
    } catch (error) {
        if (status) status.textContent = `Lỗi realtime: ${error.message || error}`;
        setStatus('Lỗi cào realtime Seller Center.');
        showToast('Lỗi realtime crawler: ' + (error.message || 'unknown'));
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original || '<span class="st-icon st-icon-refresh" aria-hidden="true"></span>Cào realtime';
        }
    }
}

function shopOverviewField(id, fallback = '') {
    return document.getElementById(id)?.value || fallback;
}

function syncShopOverviewFieldsToBusinessForm() {
    const pairs = [
        ['business-crawler-shop-id', 'shop-overview-shop-id'],
        ['business-crawler-seller-id', 'shop-overview-seller-id'],
        ['business-crawler-cdp-port', 'shop-overview-cdp-port'],
        ['business-crawler-max-modules', 'shop-overview-max-modules'],
        ['business-crawler-base-url', 'shop-overview-base-url'],
        ['tts-crawler-shop-id', 'shop-overview-shop-id'],
        ['tts-crawler-seller-id', 'shop-overview-seller-id'],
        ['tts-crawler-cdp-port', 'shop-overview-cdp-port'],
        ['tts-crawler-max-modules', 'shop-overview-max-modules'],
        ['tts-crawler-base-url', 'shop-overview-base-url']
    ];
    pairs.forEach(([targetId, sourceId]) => {
        const target = document.getElementById(targetId);
        const source = document.getElementById(sourceId);
        if (target && source) target.value = source.value;
    });
}

async function loadShopOverviewDashboard() {
    const target = document.getElementById('shop-overview-output');
    if (!target) return;
    target.innerHTML = '<div class="business-empty">Đang tải tổng quan shop từ crawler...</div>';
    try {
        const payload = {
            files: [],
            shopId: shopOverviewField('shop-overview-shop-id', 'little-apricot-hawaii-fashion'),
            crawlerShopId: shopOverviewField('shop-overview-shop-id', 'little-apricot-hawaii-fashion'),
            sellerId: shopOverviewField('shop-overview-seller-id', '7494478078863902049')
        };
        const response = await fetch(`${STRANGETTS_LOCAL_APP_API}/api/business/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) throw new Error(result.error || `Local app API ${response.status}`);
        target.innerHTML = businessRenderShopOverviewV2(result);
        target.classList.add('shop-overview-dashboard-cards');
        businessBindShopOverviewControls(target);
        setStatus('Đã tải tổng quan shop.');
    } catch (error) {
        target.innerHTML = `<div class="business-empty business-error">${businessEscapeHtml(error.message || String(error))}</div>`;
        setStatus('Lỗi tải tổng quan shop.');
    }
}

async function runShopOverviewRealtimeCrawler(event) {
    syncShopOverviewFieldsToBusinessForm();
    await businessRunRealtimeCrawler(event);
    await loadShopOverviewDashboard();
}

function initShopOverviewDashboard() {
    document.getElementById('shop-overview-refresh')?.addEventListener('click', loadShopOverviewDashboard);
    document.getElementById('shop-overview-realtime-crawl')?.addEventListener('click', runShopOverviewRealtimeCrawler);
    document.getElementById('shop-overview-open-crawler')?.addEventListener('click', () => switchMainTab('tiktok-crawler'));
}

function businessMergedRules(rules = {}) {
    return { ...DEFAULT_BUSINESS_RULES, ...(rules || {}) };
}

function businessPopulateRulesForm(rules = {}) {
    const form = document.getElementById('business-rules-form');
    if (!form) return;
    const merged = businessMergedRules(rules);
    merged.metricDefinitions = Array.isArray(merged.metricDefinitions) ? merged.metricDefinitions : [];
    for (const [key, value] of Object.entries(merged)) {
        const field = form.elements[key];
        if (!field) continue;
        if (field.type === 'checkbox') field.checked = Boolean(value);
        else field.value = value ?? '';
    }
    const analysisForm = document.getElementById('business-analysis-form');
    if (analysisForm) {
        const adsRatio = analysisForm.elements.adsCreditRatio;
        const growth = analysisForm.elements.targetGrowthPct;
        if (adsRatio && (!adsRatio.value || adsRatio.value === '50')) adsRatio.value = String(merged.adsCreditRatioPct);
        if (growth && (!growth.value || growth.value === '20')) growth.value = String(merged.targetGrowthPct);
    }
    businessRenderMetricEditor(merged.metricDefinitions);
}

function businessCollectRulesForm() {
    const form = document.getElementById('business-rules-form');
    if (!form) return businessMergedRules();
    const data = new FormData(form);
    const bool = name => Boolean(form.elements[name]?.checked);
    const number = name => Number(data.get(name) || 0);
    return {
        revenueMode: data.get('revenueMode') || 'auto',
        adsCreditRatioPct: number('adsCreditRatioPct'),
        includeProductCost: bool('includeProductCost'),
        includeAffiliateSampleCost: bool('includeAffiliateSampleCost'),
        includeAffiliateShipping: bool('includeAffiliateShipping'),
        includeAdsActualCost: bool('includeAdsActualCost'),
        marketplaceFeePct: number('marketplaceFeePct'),
        paymentFeePct: number('paymentFeePct'),
        operationFeePct: number('operationFeePct'),
        fixedCost: number('fixedCost'),
        targetGrowthPct: number('targetGrowthPct'),
        minRoiOverride: number('minRoiOverride'),
        skuProfitFeePct: number('skuProfitFeePct'),
        metricDefinitions: businessMetricDefinitions()
    };
}

function businessMetricDefinitions() {
    return Array.isArray(dashboardBusinessRules?.metricDefinitions)
        ? dashboardBusinessRules.metricDefinitions
        : [];
}

function businessSetMetricDefinitions(definitions = []) {
    dashboardBusinessRules = businessMergedRules(dashboardBusinessRules || {});
    dashboardBusinessRules.metricDefinitions = definitions;
    businessRenderMetricEditor(definitions);
}

function businessMetricField(id) {
    return document.getElementById(id);
}

function businessRenderPathInspector(definition = {}) {
    const body = document.getElementById('business-path-inspector-body');
    if (!body) return;
    const mode = businessMetricField('metric-mode')?.value || definition.mode || 'path';
    const path = String(businessMetricField('metric-path')?.value || definition.path || '').trim();
    if (mode !== 'path') {
        body.innerHTML = `
            <div class="business-path-line"><strong>Cách tính hiện tại:</strong> ${mode === 'formula' ? 'Công thức tự nhập' : 'Lấy trực tiếp từ cột/hàng file upload'}</div>
            <div class="business-path-note">Khung này chỉ giải thích các metric dùng kiểu <code>Lấy từ path sẵn có</code>.</div>
        `;
        return;
    }
    if (!path) {
        body.innerHTML = '<div class="business-path-note">Chưa nhập path. Ví dụ: <code>kpis.revenue</code>, <code>costs.totalCost</code>, <code>ads.gmvMax.roi</code>.</div>';
        return;
    }
    const doc = BUSINESS_BACKEND_PATH_DOCS[path];
    if (!doc) {
        body.innerHTML = `
            <div class="business-path-line"><strong>Path:</strong> <code>${businessEscapeHtml(path)}</code></div>
            <div class="business-path-note">Path này vẫn có thể chạy nếu backend có dữ liệu tương ứng, nhưng chưa có mô tả công thức trong thư viện hướng dẫn. Kiểm tra cấu trúc JSON kết quả phân tích trước khi dùng.</div>
        `;
        return;
    }
    body.innerHTML = `
        <div class="business-path-line"><strong>Path:</strong> <code>${businessEscapeHtml(path)}</code></div>
        <div class="business-path-line"><strong>Ý nghĩa:</strong> ${businessEscapeHtml(doc.title)}</div>
        <div class="business-path-line"><strong>Nguồn dữ liệu:</strong> ${businessEscapeHtml(doc.source)}</div>
        <div class="business-path-line"><strong>Công thức backend:</strong> <code>${businessEscapeHtml(doc.formula)}</code></div>
        ${doc.note ? `<div class="business-path-note">${businessEscapeHtml(doc.note)}</div>` : ''}
    `;
}

function businessMetricFormToDefinition(base = {}) {
    const valueColumns = String(businessMetricField('metric-value-columns')?.value || '')
        .split(/[,|\n]/)
        .map(item => item.trim())
        .filter(Boolean);
    return {
        ...base,
        key: businessMetricField('metric-key')?.value || base.key || `metric_${Date.now()}`,
        label: businessMetricField('metric-label')?.value || base.label || 'Metric mới',
        section: businessMetricField('metric-section')?.value || base.section || 'custom',
        sectionTitle: businessMetricField('metric-section-title')?.value || base.sectionTitle || 'Custom',
        sectionKind: businessMetricField('metric-section-kind')?.value || base.sectionKind || 'list',
        format: businessMetricField('metric-format')?.value || base.format || 'number',
        mode: businessMetricField('metric-mode')?.value || base.mode || 'path',
        visible: Boolean(businessMetricField('metric-visible')?.checked),
        path: businessMetricField('metric-path')?.value || '',
        fileType: businessMetricField('metric-file-type')?.value || 'orders',
        op: businessMetricField('metric-op')?.value || 'sum',
        valueColumns,
        rowStart: Number(businessMetricField('metric-row-start')?.value || 0),
        rowEnd: Number(businessMetricField('metric-row-end')?.value || 0),
        rowNumber: Number(businessMetricField('metric-row-number')?.value || 0),
        filterColumn: businessMetricField('metric-filter-column')?.value || '',
        filterContains: businessMetricField('metric-filter-contains')?.value || '',
        formula: businessMetricField('metric-formula')?.value || ''
    };
}

function businessPopulateMetricFields(definition = {}) {
    const set = (id, value) => {
        const field = businessMetricField(id);
        if (!field) return;
        if (field.type === 'checkbox') field.checked = Boolean(value);
        else field.value = value ?? '';
    };
    set('metric-key', definition.key || '');
    set('metric-label', definition.label || '');
    set('metric-section', definition.section || '');
    set('metric-section-title', definition.sectionTitle || '');
    set('metric-section-kind', definition.sectionKind || 'list');
    set('metric-format', definition.format || 'number');
    set('metric-mode', definition.mode || 'path');
    set('metric-visible', definition.visible !== false);
    set('metric-path', definition.path || '');
    set('metric-file-type', definition.fileType || 'orders');
    set('metric-op', definition.op || 'sum');
    set('metric-value-columns', Array.isArray(definition.valueColumns) ? definition.valueColumns.join(', ') : (definition.valueColumns || ''));
    set('metric-row-start', definition.rowStart || 0);
    set('metric-row-end', definition.rowEnd || 0);
    set('metric-row-number', definition.rowNumber || 0);
    set('metric-filter-column', definition.filterColumn || '');
    set('metric-filter-contains', definition.filterContains || '');
    set('metric-formula', definition.formula || '');
    businessRenderPathInspector(definition);
}

function businessRenderMetricEditor(definitions = []) {
    const select = document.getElementById('business-metric-select');
    if (!select) return;
    const current = select.value;
    select.innerHTML = definitions.map((item, index) => {
        const label = `${item.sectionTitle || item.section || 'Custom'} / ${item.label || item.key}`;
        return `<option value="${index}">${businessEscapeHtml(label)}</option>`;
    }).join('');
    if (definitions.length) {
        const idx = Math.max(0, Math.min(definitions.length - 1, Number(current || 0)));
        select.value = String(idx);
        businessPopulateMetricFields(definitions[idx]);
    } else {
        businessPopulateMetricFields({});
    }
}

function businessApplyMetricEditor() {
    const definitions = [...businessMetricDefinitions()];
    const select = document.getElementById('business-metric-select');
    const idx = Number(select?.value || 0);
    const base = definitions[idx] || {};
    const next = businessMetricFormToDefinition(base);
    if (definitions[idx]) definitions[idx] = next;
    else definitions.push(next);
    businessSetMetricDefinitions(definitions);
    if (select) select.value = String(Math.max(0, definitions.findIndex(item => item.key === next.key)));
}

async function businessLoadRules() {
    try {
        const response = await fetch(`${STRANGETTS_LOCAL_APP_API}/api/business/rules`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `Local app API ${response.status}`);
        dashboardBusinessRules = businessMergedRules(data.rules);
    } catch (error) {
        dashboardBusinessRules = businessMergedRules();
        showToast('Không tải được công thức, dùng mặc định');
    }
    businessPopulateRulesForm(dashboardBusinessRules);
    return dashboardBusinessRules;
}

async function businessSaveRules(rules) {
    const response = await fetch(`${STRANGETTS_LOCAL_APP_API}/api/business/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Local app API ${response.status}`);
    dashboardBusinessRules = businessMergedRules(data.rules);
    businessPopulateRulesForm(dashboardBusinessRules);
    return dashboardBusinessRules;
}

function businessFormatMetricValue(item = {}) {
    const value = item.value;
    if (item.format === 'text') return businessEscapeHtml(value ?? '');
    if (item.format === 'percent') return businessPct(value);
    if (item.format === 'decimal') return Number(value || 0).toFixed(2);
    if (item.format === 'number') return businessMoney(value);
    return businessMoney(value);
}

function uxMetricStatusText(status, value) {
    if (status === 'loading') return 'Đang cập nhật...';
    if (status === 'missing_file') return 'Cần nạp file';
    if (status === 'missing_mapping') return 'Cần kiểm tra mapping';
    if (status === 'not_applicable') return 'Không áp dụng';
    if (status === 'connection_error') return 'Cần kiểm tra kết nối';
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Chưa có dữ liệu';
    return '';
}

function uxDisplayMetric(value, format = 'number', status = '') {
    const friendly = uxMetricStatusText(status, value);
    if (friendly) return businessEscapeHtml(friendly);
    if (format === 'percent') return businessPct(value);
    if (format === 'decimal') return Number(value || 0).toFixed(2);
    if (format === 'text') return businessEscapeHtml(value ?? 'Chưa có dữ liệu');
    return businessMoney(value);
}

function uxToneForValue(value, options = {}) {
    if (options.status && options.status !== 'ok') return 'warning';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'neutral';
    if (options.negativeBad && n < 0) return 'danger';
    if (options.positiveGood && n > 0) return 'success';
    return 'neutral';
}

function uxMetricCard({ label, value, format = 'number', status = '', tone = 'neutral', tooltip = '', description = '' } = {}) {
    const missing = uxMetricStatusText(status, value);
    return `
        <article class="ux-metric-card tone-${businessEscapeHtml(tone)} ${missing ? 'is-missing' : ''}" title="${businessEscapeHtml(tooltip || description || label || '')}">
            <div class="ux-metric-top">
                <span>${businessEscapeHtml(label || 'Chỉ số')}</span>
                <span class="ux-help">?</span>
            </div>
            <strong>${uxDisplayMetric(value, format, status)}</strong>
            <small>${businessEscapeHtml(description || (missing ? missing : 'Đã có dữ liệu'))}</small>
        </article>
    `;
}

function uxDataHealthStepper(result = {}) {
    const files = result.fileSummary || [];
    const hasCrawler = Boolean(result.shopOverview?.ok || result.shopOverviews?.some?.(item => item.ok));
    const hasFiles = files.length > 0;
    const mappingWarnings = (result.warnings || []).some(item => /map|mapping|giá|sku/i.test(item));
    const hasPnl = Number.isFinite(Number(result.kpis?.revenue)) && hasFiles;
    const steps = [
        { label: 'Dữ liệu TikTok Shop', status: hasCrawler ? 'Đã có' : 'Thiếu dữ liệu', tone: hasCrawler ? 'success' : 'warning' },
        { label: 'File Ads / Cost / KOC', status: hasFiles ? 'Đã có' : 'Thiếu file', tone: hasFiles ? 'success' : 'warning' },
        { label: 'Mapping SKU / Giá vốn', status: mappingWarnings ? 'Cần kiểm tra' : (hasFiles ? 'Đã có' : 'Chưa sẵn sàng'), tone: mappingWarnings ? 'warning' : (hasFiles ? 'success' : 'neutral') },
        { label: 'Báo cáo Lãi/Lỗ', status: hasPnl ? 'Sẵn sàng' : 'Chưa đủ dữ liệu', tone: hasPnl ? 'success' : 'neutral' }
    ];
    return `
        <section class="ux-card">
            <div class="business-section-title"><strong>Tiến trình dữ liệu</strong><span>Hệ thống kiểm tra dữ liệu đầu vào trước khi tính P&L.</span></div>
            <div class="ux-stepper">
                ${steps.map((step, index) => `
                    <div class="ux-step tone-${step.tone}">
                        <span>${index + 1}</span>
                        <strong>${businessEscapeHtml(step.label)}</strong>
                        <small>${businessEscapeHtml(step.status)}</small>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

function uxSmartAlert(result = {}) {
    const warnings = result.warnings || [];
    const files = result.fileSummary || [];
    let message = warnings[0] || '';
    if (!message && !files.length) message = 'Chưa thể tính lãi/lỗ đầy đủ vì thiếu file Ads, giá vốn hoặc KOC/Creator.';
    if (!message && Number(result.kpis?.netProfitEstimate || 0) < 0) message = 'Lợi nhuận ước tính đang âm, cần kiểm tra chi phí Ads, giá vốn và nhóm SKU biên lợi nhuận thấp.';
    if (!message) message = 'Báo cáo đã sẵn sàng để xem và xuất cho team.';
    return `<section class="ux-smart-alert"><strong>Điểm cần chú ý</strong><span>${businessEscapeHtml(message)}</span></section>`;
}

function uxInsightPanel(result = {}) {
    const insights = [];
    if (Number.isFinite(Number(result.kpis?.revenue))) insights.push(`Doanh thu đã ghi nhận: ${businessMoney(result.kpis.revenue)}.`);
    if (!result.fileSummary?.length) insights.push('Chưa có file bổ sung nên ROI và biên lợi nhuận chưa đáng tin hoàn toàn.');
    if ((result.mapping?.missingCostRows || 0) > 0) insights.push(`${businessMoney(result.mapping.missingCostRows)} SKU/dòng cần kiểm tra giá vốn.`);
    if (Number(result.costs?.adsActualCost || 0) > 0) insights.push(`Chi phí Ads đã nhận diện: ${businessMoney(result.costs.adsActualCost)}.`);
    if (Number(result.kpis?.netMargin || 0) > 0) insights.push('Shop đang có biên lợi nhuận dương theo dữ liệu hiện có.');
    while (insights.length < 3) insights.push('Nạp thêm dữ liệu Ads, Cost hoặc KOC để báo cáo sâu và chắc hơn.');
    return `
        <section class="ux-card">
            <div class="business-section-title"><strong>Kết luận nhanh</strong><span>3-5 điểm quan trọng nhất từ dữ liệu hiện có.</span></div>
            <ul class="ux-insight-list">${insights.slice(0, 5).map(item => `<li>${businessEscapeHtml(item)}</li>`).join('')}</ul>
        </section>
    `;
}

function uxActionChecklist(result = {}) {
    const items = [
        { label: 'Nạp file Ads tháng hiện tại', done: Boolean(result.costs?.adsActualCost) },
        { label: 'Nạp file chi phí KOC/Creator nếu có', done: Boolean(result.affiliate?.sampleCost || result.affiliate?.shipping) },
        { label: 'Kiểm tra SKU chưa có giá vốn', done: !(result.mapping?.missingCostRows > 0) },
        { label: 'Kiểm tra campaign chưa match chi phí', done: !String(result.ads?.gmvMax?.costMatch || '').includes('pattern') },
        { label: 'Bấm “Cập nhật báo cáo” sau khi bổ sung file', done: Boolean(result.ok) },
        { label: 'Xuất báo cáo gửi team', done: false }
    ];
    return `
        <section class="ux-card">
            <div class="business-section-title"><strong>Việc cần làm tiếp theo</strong><span>Checklist vận hành trước khi chốt báo cáo.</span></div>
            <div class="ux-checklist">${items.map(item => `<label><input type="checkbox" ${item.done ? 'checked' : ''} disabled><span>${businessEscapeHtml(item.label)}</span></label>`).join('')}</div>
        </section>
    `;
}

function businessRenderMetricSections(result) {
    const sections = Array.isArray(result.metricSections) ? result.metricSections : [];
    const kpiItems = sections.filter(section => section.kind === 'kpi').flatMap(section => section.items || []);
    const listSections = sections.filter(section => section.kind !== 'kpi');
    const kpis = kpiItems.length ? kpiItems : [
        { label: 'Doanh thu', value: result.kpis?.revenue, format: 'money' },
        { label: 'Lợi nhuận ước tính', value: result.kpis?.netProfitEstimate, format: 'money' },
        { label: 'Net margin', value: result.kpis?.netMargin, format: 'percent' },
        { label: 'Ads thực tế', value: result.costs?.adsActualCost, format: 'money' },
        { label: 'Giá vốn', value: result.costs?.productCost, format: 'money' },
        { label: 'Mẫu + ship affiliate', value: Number(result.affiliate?.sampleCost || 0) + Number(result.affiliate?.shipping || 0), format: 'money' }
    ];
    const fallbackSections = listSections.length ? listSections : [];
    return `
        <div class="business-kpis">
            ${kpis.map(item => `<div><strong>${businessFormatMetricValue(item)}</strong><span>${businessEscapeHtml(item.label)}</span></div>`).join('')}
        </div>
        <div class="business-grid">
            ${fallbackSections.map(section => `
                <section class="business-card">
                    <h3>${businessEscapeHtml(section.title)}</h3>
                    <dl class="business-list">
                        ${(section.items || []).map(item => `<dt>${businessEscapeHtml(item.label)}</dt><dd>${businessFormatMetricValue(item)}</dd>`).join('')}
                    </dl>
                </section>
            `).join('')}
        </div>
    `;
}

function businessFormatOverviewValue(card = {}) {
    if (card.format === 'money') return businessMoney(card.value);
    return businessMoney(card.value);
}

function businessRenderDelta(card = {}) {
    if (card.deltaPct === null || card.deltaPct === undefined || !Number.isFinite(Number(card.deltaPct))) {
        return '<span class="shop-overview-delta neutral"><span class="st-icon st-icon-data" aria-hidden="true"></span>--</span>';
    }
    const pct = Number(card.deltaPct) * 100;
    const positive = pct >= 0;
    const icon = positive ? 'st-icon-trend-up' : 'st-icon-trend-down';
    return `<span class="shop-overview-delta ${positive ? 'up' : 'down'}"><span class="st-icon ${icon}" aria-hidden="true"></span>${positive ? '+' : ''}${pct.toFixed(1)}%</span>`;
}

function businessRenderShopOverview(result = {}) {
    const overview = result.shopOverview || {};
    const cards = Array.isArray(overview.cards) ? overview.cards : [];
    if (!cards.length) return '';
    const note = overview.ok
        ? `Crawler: ${businessEscapeHtml(overview.rangeLabel || '')}${overview.compareLabel ? ` so với ${businessEscapeHtml(overview.compareLabel)}` : ''}`
        : businessEscapeHtml((overview.notes || [])[0] || 'Chưa có dữ liệu crawler.');
    return `
        <section class="shop-overview-panel">
            <div class="shop-overview-head">
                <div>
                    <span class="business-kicker">Tổng quan shop</span>
                    <h3>${businessEscapeHtml(overview.shopId || 'Shop')}</h3>
                    <p>${note}${overview.updatedAt ? ` • Cập nhật ${businessEscapeHtml(overview.updatedAt)}` : ''}</p>
                </div>
                <div class="shop-overview-run">
                    <span>${overview.runId ? `Run ${businessEscapeHtml(overview.runId)}` : 'Chưa có run crawler'}</span>
                </div>
            </div>
            <div class="shop-overview-grid">
                ${cards.map(card => `
                    <article class="shop-overview-card" title="${businessEscapeHtml(card.note || card.source || '')}">
                        <div class="shop-overview-icon"><span class="st-icon ${businessEscapeHtml(card.icon || 'st-icon-data')}" aria-hidden="true"></span></div>
                        <div class="shop-overview-card-main">
                            <div class="shop-overview-label">${businessEscapeHtml(card.label)}</div>
                            <div class="shop-overview-value-row">
                                <strong>${businessFormatOverviewValue(card)}</strong>
                                ${businessRenderDelta(card)}
                            </div>
                            ${card.note ? `<div class="shop-overview-source">${businessEscapeHtml(card.note)}</div>` : ''}
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function businessFormatOverviewValueV2(card = {}) {
    if (card.available === false || card.value === null || card.value === undefined || card.value === '') return '--';
    if (card.format === 'text') return businessEscapeHtml(card.value ?? '--');
    if (card.format === 'percent') return businessPct(card.value);
    if (card.format === 'decimal') return Number(card.value || 0).toFixed(2);
    if (card.format === 'hours') return `${Number(card.value || 0).toFixed(2)}h`;
    if (card.format === 'money') return businessMoney(card.value);
    return businessMoney(card.value);
}

function businessRenderDeltaV2(card = {}) {
    if (card.available === false) {
        return '<span class="shop-overview-delta neutral"><span class="st-icon st-icon-data" aria-hidden="true"></span>Chưa có</span>';
    }
    if (card.deltaPct === null || card.deltaPct === undefined || !Number.isFinite(Number(card.deltaPct))) {
        return '<span class="shop-overview-delta neutral"><span class="st-icon st-icon-data" aria-hidden="true"></span>--</span>';
    }
    const pct = Number(card.deltaPct) * 100;
    const positive = pct >= 0;
    const icon = positive ? 'st-icon-trend-up' : 'st-icon-trend-down';
    return `<span class="shop-overview-delta ${positive ? 'up' : 'down'}"><span class="st-icon ${icon}" aria-hidden="true"></span>${positive ? '+' : ''}${pct.toFixed(1)}%</span>`;
}

function businessRenderOverviewCardV2(card = {}) {
    return `
        <article class="shop-overview-card ${card.available === false ? 'is-missing' : ''}" title="${businessEscapeHtml(card.note || card.source || '')}">
            <div class="shop-overview-icon"><span class="st-icon ${businessEscapeHtml(card.icon || 'st-icon-data')}" aria-hidden="true"></span></div>
            <div class="shop-overview-card-main">
                <div class="shop-overview-label">${businessEscapeHtml(card.label)}</div>
                <div class="shop-overview-value-row">
                    <strong>${businessFormatOverviewValueV2(card)}</strong>
                    ${businessRenderDeltaV2(card)}
                </div>
            </div>
        </article>
    `;
}

function businessRenderTaskPanelV2(range = {}) {
    const tasks = range.tasks || {};
    const items = Array.isArray(tasks.items) ? tasks.items : [];
    const remaining = items.filter(item => !item.done);
    if (!items.length) return '';
    return `
        <details class="shop-task-panel">
            <summary>Nhiệm vụ cửa hàng còn lại: ${remaining.length}</summary>
            <div class="shop-task-list">
                ${remaining.concat(items.filter(item => item.done)).slice(0, 40).map(item => `
                    <article class="shop-task-item ${item.done ? 'done' : ''}">
                        <strong>${businessEscapeHtml(item.title || item.key || 'Nhiệm vụ')}</strong>
                        <span>${businessEscapeHtml([item.key, item.status].filter(Boolean).join(' · ') || (item.done ? 'Đã hoàn thành' : 'Đang hiển thị'))}</span>
                    </article>
                `).join('')}
            </div>
        </details>
    `;
}

function businessRenderDetailMetricV2(metric = {}) {
    return `
        <div class="shop-detail-metric ${metric.available === false ? 'is-missing' : ''}">
            <span>${businessEscapeHtml(metric.label)}</span>
            <strong>${businessFormatOverviewValueV2(metric)}</strong>
        </div>
    `;
}

function businessRenderDetailSectionV2(section = {}) {
    const metrics = Array.isArray(section.metrics) ? section.metrics : [];
    const videos = Array.isArray(section.videos) ? section.videos : [];
    return `
        <section class="shop-detail-section">
            <h4>${businessEscapeHtml(section.title || section.key || 'Chi tiết')}</h4>
            <div class="shop-detail-grid">
                ${metrics.map(metric => businessRenderDetailMetricV2(metric)).join('')}
            </div>
            ${videos.length ? `
                <div class="shop-video-list">
                    <h5>List video hiệu quả nhất</h5>
                    ${videos.map(video => `
                        <article class="shop-video-row">
                            <div>
                                <strong>${businessEscapeHtml(video.name || 'Video')}</strong>
                                <span>${businessEscapeHtml(video.tag || '')}</span>
                            </div>
                            <div class="shop-video-metrics">
                                ${(video.metrics || []).map(metric => businessRenderDetailMetricV2(metric)).join('')}
                            </div>
                        </article>
                    `).join('')}
                </div>
            ` : ''}
        </section>
    `;
}

function businessRenderOneShopOverviewV2(overview = {}, index = 0) {
    const ranges = Array.isArray(overview.ranges) && overview.ranges.length ? overview.ranges : [{ key: overview.defaultRangeKey || 'last7', label: '7 ngày qua', cards: overview.cards || [], detailSections: [] }];
    const defaultKey = overview.defaultRangeKey || ranges[0]?.key || 'last7';
    const defaultRange = ranges.find(range => range.key === defaultKey) || ranges[0] || {};
    const cards = Array.isArray(defaultRange.cards) ? defaultRange.cards : [];
    if (!cards.length) return '';
    const minDate = overview.availableStartDate || ranges.map(range => range.startDate).filter(Boolean).sort()[0] || '';
    const maxDate = overview.availableEndDate || ranges.map(range => range.endDate).filter(Boolean).sort().at(-1) || '';
    const activeMonth = (defaultRange.startDate || maxDate || '').slice(0, 7);
    const note = overview.ok
        ? `Crawler: ${businessEscapeHtml(defaultRange.rangeLabel || overview.rangeLabel || '')}${defaultRange.compareLabel ? ` so với ${businessEscapeHtml(defaultRange.compareLabel)}` : ''}`
        : businessEscapeHtml((overview.notes || [])[0] || 'Chưa có dữ liệu crawler.');
    return `
        <section class="shop-overview-panel" data-shop-overview="${index}">
            <div class="shop-overview-head">
                <div>
                    <span class="business-kicker">Tổng quan shop</span>
                    <h3>${businessEscapeHtml(overview.shopId || 'Shop')}</h3>
                    <p>${note}${defaultRange.updatedAt ? ` • Cập nhật ${businessEscapeHtml(defaultRange.updatedAt)}` : ''}</p>
                </div>
                <div class="shop-overview-controls">
                    <label><span>Ngày</span><select class="shop-overview-range-select">${ranges.map(range => `<option value="${businessEscapeHtml(range.key)}" ${range.key === defaultKey ? 'selected' : ''}>${businessEscapeHtml(range.label)}</option>`).join('')}</select></label>
                    <label class="shop-overview-month-control"><span>Tháng</span><input type="month" value="${businessEscapeHtml(activeMonth)}" min="${businessEscapeHtml((minDate || '').slice(0, 7))}" max="${businessEscapeHtml((maxDate || '').slice(0, 7))}"></label>
                    <div class="shop-overview-custom-controls" style="display:none">
                        <label><span>Từ ngày</span><input type="date" min="${businessEscapeHtml(minDate)}" max="${businessEscapeHtml(maxDate)}" value="${businessEscapeHtml(defaultRange.startDate || minDate)}"></label>
                        <label><span>Đến ngày</span><input type="date" min="${businessEscapeHtml(minDate)}" max="${businessEscapeHtml(maxDate)}" value="${businessEscapeHtml(defaultRange.endDate || maxDate)}"></label>
                    </div>
                    <div class="shop-overview-run"><span>${overview.runId ? `Run ${businessEscapeHtml(overview.runId)}` : 'Chưa có run crawler'}</span></div>
                </div>
            </div>
            ${ranges.map(range => `
                <div class="shop-overview-range" data-range-key="${businessEscapeHtml(range.key)}" data-start-date="${businessEscapeHtml(range.startDate || '')}" data-end-date="${businessEscapeHtml(range.endDate || '')}" style="${range.key === defaultKey ? '' : 'display:none'}">
                    <div class="shop-overview-grid">
                        ${(range.cards || []).map(card => businessRenderOverviewCardV2(card)).join('')}
                    </div>
                    ${businessRenderTaskPanelV2(range)}
                    <button class="btn btn-secondary shop-detail-toggle" type="button">Xem Phân tích chi tiết</button>
                    <div class="shop-detail-panel" style="display:none">
                        ${(range.detailSections || []).map(section => businessRenderDetailSectionV2(section)).join('')}
                    </div>
                </div>
            `).join('')}
        </section>
    `;
}

function businessRenderShopOverviewV2(result = {}) {
    const overviews = Array.isArray(result.shopOverviews) && result.shopOverviews.length ? result.shopOverviews : [result.shopOverview].filter(Boolean);
    if (!overviews.length) return '';
    return `<div class="shop-overviews-list">${overviews.map((overview, index) => businessRenderOneShopOverviewV2(overview, index)).join('')}</div>`;
}

function businessBindShopOverviewControls(target) {
    if (!target) return;
    target.querySelectorAll('.shop-overview-range-select').forEach(select => {
        select.addEventListener('change', event => {
            const panel = event.target.closest('.shop-overview-panel');
            if (!panel) return;
            const selectedRange = panel.querySelector(`.shop-overview-range[data-range-key="${event.target.value}"]`);
            panel.querySelectorAll('.shop-overview-range').forEach(range => {
                range.style.display = range.dataset.rangeKey === event.target.value ? '' : 'none';
            });
            const customControls = panel.querySelector('.shop-overview-custom-controls');
            if (customControls) customControls.style.display = event.target.value === 'custom' ? 'grid' : 'none';
            const monthInput = panel.querySelector('.shop-overview-month-control input');
            const startInput = customControls?.querySelector('input[type="date"]:first-of-type');
            const endInput = customControls?.querySelector('input[type="date"]:last-of-type');
            const startDate = selectedRange?.dataset.startDate || '';
            const endDate = selectedRange?.dataset.endDate || '';
            if (monthInput && startDate) monthInput.value = startDate.slice(0, 7);
            if (startInput && startDate) startInput.value = startDate;
            if (endInput && endDate) endInput.value = endDate;
        });
        select.dispatchEvent(new Event('change'));
    });
    target.querySelectorAll('.shop-overview-month-control input[type="month"]').forEach(input => {
        input.addEventListener('change', event => {
            const panel = event.target.closest('.shop-overview-panel');
            if (!panel) return;
            const select = panel.querySelector('.shop-overview-range-select');
            const monthRange = [...panel.querySelectorAll('.shop-overview-range')].find(range => {
                return range.dataset.rangeKey === 'month' && String(range.dataset.startDate || '').slice(0, 7) === event.target.value;
            });
            if (select) {
                select.value = monthRange ? 'month' : 'custom';
                select.dispatchEvent(new Event('change'));
            }
            const custom = panel.querySelector('.shop-overview-custom-controls');
            const startInput = custom?.querySelector('input[type="date"]:first-of-type');
            const endInput = custom?.querySelector('input[type="date"]:last-of-type');
            if (!monthRange && startInput && endInput) {
                const [year, month] = String(event.target.value || '').split('-').map(Number);
                if (year && month) {
                    const start = `${year}-${String(month).padStart(2, '0')}-01`;
                    const last = new Date(year, month, 0).getDate();
                    const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
                    startInput.value = start < startInput.min ? startInput.min : start;
                    endInput.value = end > endInput.max ? endInput.max : end;
                }
            }
        });
    });
    target.querySelectorAll('.shop-detail-toggle').forEach(button => {
        button.addEventListener('click', event => {
            const detail = event.target.closest('.shop-overview-range')?.querySelector('.shop-detail-panel');
            if (!detail) return;
            const open = detail.style.display === 'none';
            detail.style.display = open ? '' : 'none';
            event.target.textContent = open ? 'Ẩn Phân tích chi tiết' : 'Xem Phân tích chi tiết';
        });
    });
}

function businessRenderLogicReport(result = {}) {
    const report = result.businessLogicReport || {};
    const steps = Array.isArray(report.steps) ? report.steps : [];
    if (!steps.length) return '';
    return `
        <section class="business-card business-card-wide business-logic-card">
            <h3>${businessEscapeHtml(report.title || 'Logic phân tích kinh doanh')}</h3>
            <div class="business-logic-flow">
                ${steps.map(step => `
                    <div class="business-logic-step">
                        <strong>${businessEscapeHtml(step.label)}</strong>
                        <span>${businessEscapeHtml(step.detail)}</span>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

function businessRenderFriendlyResult(result, mode = 'analysis') {
    dashboardBusinessResult = result;
    const targetId = mode === 'plan' ? 'business-plan-output' : 'business-analysis-output';
    const target = document.getElementById(targetId);
    if (!target) return;

    const topSkuRows = (result.orders?.topSkus || []).slice(0, 10).map(item => `
        <tr>
            <td>${businessEscapeHtml(item.skuName)}</td>
            <td class="num">${businessMoney(item.units)}</td>
            <td class="num">${businessMoney(item.revenue)}</td>
            <td class="num">${businessMoney(Number(item.revenue || 0) - Number(item.cost || 0))}</td>
        </tr>
    `).join('');
    const planRows = (result.plan?.focusSkus || []).map(item => `
        <tr>
            <td>${businessEscapeHtml(item.skuName)}</td>
            <td class="num">${businessMoney(item.revenue)}</td>
            <td class="num">${businessMoney(item.grossProfit)}</td>
        </tr>
    `).join('');
    const planActions = (result.plan?.actions || []).map(item => `<li>${businessEscapeHtml(item)}</li>`).join('');
    const fileRows = (result.fileSummary || []).map(file => `
        <tr><td>${businessEscapeHtml(file.name)}</td><td>${businessEscapeHtml(file.type)}</td><td>${businessMoney(file.rows)}</td></tr>
    `).join('');
    const warnings = (result.warnings || []).map(item => `<li>${businessEscapeHtml(item)}</li>`).join('');

    target.innerHTML = `
        ${uxSmartAlert(result)}
        ${uxDataHealthStepper(result)}
        <section class="ux-card">
            <div class="business-section-title">
                <strong>Bảng điều khiển kinh doanh</strong>
                <span>Các chỉ số được tổng hợp từ dữ liệu TikTok Shop, Ads và file vận hành đã nạp.</span>
            </div>
            <div class="ux-kpi-summary">
                ${uxMetricCard({ label: 'Doanh thu', value: result.kpis?.revenue, format: 'number', tone: uxToneForValue(result.kpis?.revenue, { positiveGood: true }), tooltip: 'Tổng doanh thu nhận diện từ file đơn hàng hoặc dữ liệu crawler.' })}
                ${uxMetricCard({ label: 'Lợi nhuận ước tính', value: result.kpis?.netProfitEstimate, format: 'number', tone: uxToneForValue(result.kpis?.netProfitEstimate, { negativeBad: true }), tooltip: 'Doanh thu trừ chi phí đã nhận diện như ads, giá vốn, mẫu và ship affiliate.' })}
                ${uxMetricCard({ label: 'Net margin', value: result.kpis?.netMargin, format: 'percent', tone: uxToneForValue(result.kpis?.netMargin, { negativeBad: true }), tooltip: 'Biên lợi nhuận ròng ước tính trên doanh thu.' })}
                ${uxMetricCard({ label: 'Chi phí Ads thực tế', value: result.costs?.adsActualCost, format: 'number', tone: 'warning', tooltip: 'Chi phí quảng cáo đã được nhận diện từ GMV Max hoặc file Ads.' })}
                ${uxMetricCard({ label: 'Giá vốn', value: result.costs?.productCost, format: 'number', tone: 'neutral', tooltip: 'Giá vốn hàng bán đã match theo SKU hoặc mapping.' })}
                ${uxMetricCard({ label: 'Mẫu + ship affiliate', value: Number(result.affiliate?.sampleCost || 0) + Number(result.affiliate?.shipping || 0), format: 'number', tone: 'neutral', tooltip: 'Chi phí mẫu và vận chuyển affiliate/KOC.' })}
            </div>
        </section>
        <div class="ux-two-column">
            ${uxInsightPanel(result)}
            ${uxActionChecklist(result)}
        </div>
        <section class="ux-card">
            <div class="business-section-title">
                <strong>Phân tích chi tiết</strong>
                <span>Chọn nhóm dữ liệu cần xem. Các bảng giữ nguyên số native để đối chiếu.</span>
            </div>
            <div class="ux-tabs">
                <input type="radio" name="${mode}-ux-tab" id="${mode}-ux-tab-sku" checked>
                <label for="${mode}-ux-tab-sku">SKU</label>
                <input type="radio" name="${mode}-ux-tab" id="${mode}-ux-tab-plan">
                <label for="${mode}-ux-tab-plan">Kế hoạch</label>
                <input type="radio" name="${mode}-ux-tab" id="${mode}-ux-tab-files">
                <label for="${mode}-ux-tab-files">File đầu vào</label>
                <div class="ux-tab-panel ux-tab-sku">
                    <table class="business-table"><thead><tr><th>SKU</th><th>SL</th><th>Doanh thu</th><th>Lãi gộp</th></tr></thead><tbody>${topSkuRows || '<tr><td colspan="4">Chưa có dữ liệu SKU.</td></tr>'}</tbody></table>
                </div>
                <div class="ux-tab-panel ux-tab-plan">
                    <div class="business-grid">
                        <section class="business-card">
                            <h3>Kế hoạch gợi ý</h3>
                            <dl class="business-list">
                                <dt>Mục tiêu doanh thu</dt><dd>${businessMoney(result.plan?.targetRevenue)}</dd>
                                <dt>Ngân sách ads gợi ý</dt><dd>${businessMoney(result.plan?.suggestedAdsBudget)}</dd>
                                <dt>ROI hòa vốn</dt><dd>${Number(result.plan?.breakEvenRoi || 0).toFixed(2)}</dd>
                                <dt>ROI hiện tại</dt><dd>${Number(result.plan?.currentRoi || 0).toFixed(2)}</dd>
                            </dl>
                            <ul class="business-plan-actions">${planActions || '<li>Chưa có hành động gợi ý.</li>'}</ul>
                        </section>
                        <section class="business-card">
                            <h3>SKU ưu tiên</h3>
                            <table class="business-table"><thead><tr><th>SKU</th><th>Doanh thu cũ</th><th>Lãi gộp ước tính</th></tr></thead><tbody>${planRows || '<tr><td colspan="3">Chưa có dữ liệu.</td></tr>'}</tbody></table>
                        </section>
                    </div>
                </div>
                <div class="ux-tab-panel ux-tab-files">
                    <table class="business-table"><thead><tr><th>File</th><th>Loại</th><th>Rows</th></tr></thead><tbody>${fileRows || '<tr><td colspan="3">Chưa nạp file bổ sung.</td></tr>'}</tbody></table>
                </div>
            </div>
        </section>
        <details class="business-card ux-advanced-only">
            <summary>Công thức, mapping và cảnh báo kỹ thuật</summary>
            ${warnings ? `<ul class="business-warn-list">${warnings}</ul>` : ''}
            ${businessRenderLogicReport(result)}
            ${businessRenderMetricSections(result)}
        </details>
        <div class="business-actions ux-primary-actions">
            <button class="btn btn-secondary" id="${mode}-business-show-analysis" type="button">Mở phân tích</button>
            <button class="btn btn-secondary" id="${mode}-business-show-plan" type="button">Mở kế hoạch</button>
            <button class="btn btn-secondary" id="${mode}-business-download-plan" type="button">Tải CSV</button>
            <button class="btn btn-secondary" id="${mode}-business-download-json" type="button">Tải JSON</button>
        </div>
    `;
    businessBindShopOverviewControls(target);
    document.getElementById(`${mode}-business-show-analysis`)?.addEventListener('click', () => switchMainTab('business-analysis'));
    document.getElementById(`${mode}-business-show-plan`)?.addEventListener('click', () => switchMainTab('business-plan'));
    document.getElementById(`${mode}-business-download-plan`)?.addEventListener('click', () => businessDownloadTextFile('strange-tts-ke-hoach.csv', businessExportPlanCsv(result), 'text/csv;charset=utf-8'));
    document.getElementById(`${mode}-business-download-json`)?.addEventListener('click', () => businessDownloadTextFile('strange-tts-phan-tich.json', JSON.stringify(result, null, 2), 'application/json;charset=utf-8'));
}

function businessRenderResult(result, mode = 'analysis') {
    if (!result?.__legacyRender) return businessRenderFriendlyResult(result, mode);
    dashboardBusinessResult = result;
    const targetId = mode === 'plan' ? 'business-plan-output' : 'business-analysis-output';
    const target = document.getElementById(targetId);
    if (!target) return;
    const warnings = (result.warnings || []).map(item => `<li>${businessEscapeHtml(item)}</li>`).join('');
    const fileRows = (result.fileSummary || []).map(file => `
        <tr><td>${businessEscapeHtml(file.name)}</td><td>${businessEscapeHtml(file.type)}</td><td>${businessMoney(file.rows)}</td></tr>
    `).join('');
    const topSkuRows = (result.orders?.topSkus || []).slice(0, 10).map(item => `
        <tr>
            <td>${businessEscapeHtml(item.skuName)}</td>
            <td class="num">${businessMoney(item.units)}</td>
            <td class="num">${businessMoney(item.revenue)}</td>
            <td class="num">${businessMoney(Number(item.revenue || 0) - Number(item.cost || 0))}</td>
        </tr>
    `).join('');
    const planRows = (result.plan?.focusSkus || []).map(item => `
        <tr>
            <td>${businessEscapeHtml(item.skuName)}</td>
            <td class="num">${businessMoney(item.revenue)}</td>
            <td class="num">${businessMoney(item.grossProfit)}</td>
        </tr>
    `).join('');
    const planActions = (result.plan?.actions || []).map(item => `<li>${businessEscapeHtml(item)}</li>`).join('');
    target.innerHTML = `
        ${warnings ? `<ul class="business-warn-list">${warnings}</ul>` : ''}
        ${businessRenderLogicReport(result)}
        ${businessRenderMetricSections(result)}
        <div class="business-grid">
            <section class="business-card business-card-wide">
                <h3>Top SKU</h3>
                <table class="business-table"><thead><tr><th>SKU</th><th>SL</th><th>DT</th><th>Lãi gộp</th></tr></thead><tbody>${topSkuRows || '<tr><td colspan="4">Chưa có dữ liệu</td></tr>'}</tbody></table>
            </section>
            <section class="business-card">
                <h3>Kế hoạch gợi ý</h3>
                <dl class="business-list">
                    <dt>Mục tiêu doanh thu</dt><dd>${businessMoney(result.plan?.targetRevenue)}</dd>
                    <dt>Ngân sách ads gợi ý</dt><dd>${businessMoney(result.plan?.suggestedAdsBudget)}</dd>
                    <dt>ROI hòa vốn</dt><dd>${Number(result.plan?.breakEvenRoi || 0).toFixed(2)}</dd>
                    <dt>ROI hiện tại</dt><dd>${Number(result.plan?.currentRoi || 0).toFixed(2)}</dd>
                </dl>
                <ul class="business-plan-actions">${planActions}</ul>
            </section>
        </div>
        <section class="business-card">
            <h3>SKU ưu tiên cho kế hoạch</h3>
            <table class="business-table"><thead><tr><th>SKU</th><th>Doanh thu cũ</th><th>Lãi gộp ước tính</th></tr></thead><tbody>${planRows || '<tr><td colspan="3">Chưa có dữ liệu</td></tr>'}</tbody></table>
        </section>
        <details class="business-card">
            <summary>File đã nhận diện</summary>
            <table class="business-table"><thead><tr><th>File</th><th>Loại</th><th>Rows</th></tr></thead><tbody>${fileRows}</tbody></table>
        </details>
        <div class="business-actions">
            <button class="btn btn-secondary" id="${mode}-business-show-analysis" type="button">Xem phân tích</button>
            <button class="btn btn-secondary" id="${mode}-business-show-plan" type="button">Xem kế hoạch</button>
            <button class="btn btn-secondary" id="${mode}-business-download-plan" type="button">Tải CSV</button>
            <button class="btn btn-secondary" id="${mode}-business-download-json" type="button">Tải JSON</button>
        </div>
    `;
    businessBindShopOverviewControls(target);
    document.getElementById(`${mode}-business-show-analysis`)?.addEventListener('click', () => switchMainTab('business-analysis'));
    document.getElementById(`${mode}-business-show-plan`)?.addEventListener('click', () => switchMainTab('business-plan'));
    document.getElementById(`${mode}-business-download-plan`)?.addEventListener('click', () => businessDownloadTextFile('strange-tts-ke-hoach.csv', businessExportPlanCsv(result), 'text/csv;charset=utf-8'));
    document.getElementById(`${mode}-business-download-json`)?.addEventListener('click', () => businessDownloadTextFile('strange-tts-phan-tich.json', JSON.stringify(result, null, 2), 'application/json;charset=utf-8'));
}

function businessRenderPlanPanel() {
    const target = document.getElementById('business-plan-output');
    if (!target) return;
    if (!dashboardBusinessResult) {
        target.innerHTML = '<div class="business-empty">Chưa có dữ liệu. Vào Phân tích KD, nạp file, sau đó quay lại Kế hoạch.</div>';
        return;
    }
    businessRenderResult(dashboardBusinessResult, 'plan');
}

function initUxRefactorControls() {
    document.querySelectorAll('.ux-mode-btn').forEach(button => {
        if (button.dataset.bound) return;
        button.dataset.bound = '1';
        button.addEventListener('click', () => {
            const target = document.getElementById(button.dataset.uxModeTarget || '');
            if (!target) return;
            const mode = button.dataset.uxMode || 'basic';
            target.dataset.uxMode = mode;
            target.querySelectorAll(`.ux-mode-btn[data-ux-mode-target="${button.dataset.uxModeTarget}"]`).forEach(item => {
                item.classList.toggle('active', item === button);
            });
        });
    });
    ['panel-business-analysis', 'panel-tiktok-crawler'].forEach(id => {
        const panel = document.getElementById(id);
        if (panel && !panel.dataset.uxMode) panel.dataset.uxMode = 'basic';
    });
    [
        'business-rules-form',
        'business-rules-status',
        'tts-crawler-seller-id',
        'tts-crawler-cdp-port',
        'tts-crawler-base-url',
        'tts-crawler-max-modules'
    ].forEach(id => {
        const el = document.getElementById(id);
        const wrap = el?.closest?.('.business-field') || el;
        wrap?.classList?.add('ux-advanced-only');
    });
}

function initBusinessDashboardTools() {
    initUxRefactorControls();
    businessEnsureRealtimeCrawlerUi();
    businessLoadRules();
    const form = document.getElementById('business-analysis-form');
    if (form && !form.dataset.bound) {
        form.dataset.bound = '1';
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const button = document.getElementById('business-run-analysis');
            const original = button?.textContent || 'Cập nhật dashboard phân tích';
            if (button) {
                button.disabled = true;
                button.textContent = 'Đang đọc file';
            }
            try {
                setStatus('Đang đọc file kinh doanh...');
                const payload = await businessBuildPayload(form);
                if (button) button.textContent = 'Đang tính KPI';
                setStatus('Đang tính KPI kinh doanh...');
                const response = await fetch(`${STRANGETTS_LOCAL_APP_API}/api/business/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.ok === false) throw new Error(result.error || `Local app API ${response.status}`);
                businessRenderResult(result, 'analysis');
                businessRenderPlanPanel();
                setStatus('Đã phân tích xong KPI kinh doanh.');
                showToast('Đã phân tích xong KPI kinh doanh');
            } catch (error) {
                const target = document.getElementById('business-analysis-output');
                if (target) target.innerHTML = `<div class="business-empty business-error">${businessEscapeHtml(error.message || String(error))}</div>`;
                setStatus('Lỗi phân tích KPI kinh doanh.');
                showToast('Lỗi phân tích KD: ' + (error.message || 'unknown'));
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = original;
                }
            }
        });
    }
    document.getElementById('business-open-plan')?.addEventListener('click', () => switchMainTab('business-plan'));
    document.getElementById('business-open-analysis')?.addEventListener('click', () => switchMainTab('business-analysis'));
    document.getElementById('business-refresh-dashboard')?.addEventListener('click', businessRefreshAnalysisDashboard);
    document.getElementById('business-realtime-crawl')?.addEventListener('click', businessRunRealtimeCrawler);
    document.getElementById('business-realtime-crawl-inline')?.addEventListener('click', businessRunRealtimeCrawler);
    document.getElementById('business-open-crawler-tab')?.addEventListener('click', () => switchMainTab('tiktok-crawler'));
    document.getElementById('business-toggle-rules')?.addEventListener('click', () => {
        const rulesForm = document.getElementById('business-rules-form');
        if (!rulesForm) return;
        rulesForm.style.display = rulesForm.style.display === 'none' ? 'grid' : 'none';
    });
    document.getElementById('business-rules-reset')?.addEventListener('click', () => {
        businessPopulateRulesForm(DEFAULT_BUSINESS_RULES);
        const status = document.getElementById('business-rules-status');
        if (status) status.textContent = 'Đã nạp mặc định, bấm Lưu công thức để áp dụng.';
    });
    document.getElementById('business-metric-select')?.addEventListener('change', event => {
        const definitions = businessMetricDefinitions();
        businessPopulateMetricFields(definitions[Number(event.target.value || 0)] || {});
    });
    ['metric-path', 'metric-mode'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => businessRenderPathInspector());
        document.getElementById(id)?.addEventListener('change', () => businessRenderPathInspector());
    });
    document.getElementById('business-metric-apply')?.addEventListener('click', () => {
        businessApplyMetricEditor();
        const status = document.getElementById('business-rules-status');
        if (status) status.textContent = 'Đã áp dụng metric vào form, bấm Lưu công thức để ghi vào máy.';
    });
    document.getElementById('business-metric-add')?.addEventListener('click', () => {
        const definitions = [...businessMetricDefinitions()];
        definitions.push({
            key: `custom_${Date.now()}`,
            section: 'custom',
            sectionTitle: 'Custom',
            sectionKind: 'list',
            label: 'Metric mới',
            format: 'money',
            mode: 'path',
            path: 'kpis.revenue',
            fileType: 'orders',
            op: 'sum',
            valueColumns: [],
            visible: true
        });
        businessSetMetricDefinitions(definitions);
        const select = document.getElementById('business-metric-select');
        if (select) {
            select.value = String(definitions.length - 1);
            businessPopulateMetricFields(definitions[definitions.length - 1]);
        }
    });
    document.getElementById('business-metric-delete')?.addEventListener('click', () => {
        const definitions = [...businessMetricDefinitions()];
        const select = document.getElementById('business-metric-select');
        const idx = Number(select?.value || 0);
        if (!definitions.length) return;
        definitions.splice(idx, 1);
        businessSetMetricDefinitions(definitions);
    });
    document.getElementById('business-metrics-reset')?.addEventListener('click', async () => {
        try {
            const saved = await businessSaveRules({ ...businessCollectRulesForm(), metricDefinitions: [] });
            const status = document.getElementById('business-rules-status');
            if (status) status.textContent = 'Đã reset bộ metric mặc định.';
            showToast('Đã reset metric mặc định');
            businessPopulateRulesForm(saved);
        } catch (error) {
            showToast('Lỗi reset metric: ' + (error.message || 'unknown'));
        }
    });
    const rulesForm = document.getElementById('business-rules-form');
    if (rulesForm && !rulesForm.dataset.bound) {
        rulesForm.dataset.bound = '1';
        rulesForm.addEventListener('submit', async event => {
            event.preventDefault();
            const button = document.getElementById('business-rules-save');
            const status = document.getElementById('business-rules-status');
            const original = button?.textContent || 'Lưu công thức';
            if (button) {
                button.disabled = true;
                button.textContent = 'Đang lưu';
            }
            if (status) status.textContent = '';
            try {
                businessApplyMetricEditor();
                const saved = await businessSaveRules(businessCollectRulesForm());
                if (status) status.textContent = `Đã lưu công thức lúc ${new Date(saved.updatedAt || Date.now()).toLocaleTimeString('vi-VN')}.`;
                showToast('Đã lưu công thức tính KPI');
            } catch (error) {
                if (status) status.textContent = 'Lỗi lưu công thức: ' + (error.message || 'unknown');
                showToast('Lỗi lưu công thức: ' + (error.message || 'unknown'));
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = original;
                }
            }
        });
    }
    document.getElementById('business-clear-result')?.addEventListener('click', () => {
        dashboardBusinessResult = null;
        const analysisOutput = document.getElementById('business-analysis-output');
        const planOutput = document.getElementById('business-plan-output');
        if (analysisOutput) analysisOutput.innerHTML = '<div class="business-empty">Bấm Cập nhật dashboard phân tích để xem dữ liệu crawler. Nạp thêm XLSX/CSV để bổ sung Ads, video, giá vốn và P&L.</div>';
        if (planOutput) planOutput.innerHTML = '<div class="business-empty">Chưa có dữ liệu. Vào Phân tích KD, nạp file, sau đó quay lại Kế hoạch.</div>';
        showToast('Đã xóa kết quả phân tích');
    });
}

// ===== STORAGE =====
function saveShops() {
    chrome.storage.local.set({ [STORAGE_KEY]: shops, 'strangetts_shop_order': shopOrder });
}

function normalizeStoredShopEntries(rawShops = {}) {
    const normalized = {};
    Object.keys(rawShops || {}).forEach(oldKey => {
        const shopObj = normalizeIncomingShopRecord(rawShops[oldKey] || {}, oldKey);
        const newKey = getShopCanonicalKey(shopObj, oldKey);
        if (!newKey || !shopObj.aadvid) return;
        const existingKey = Object.keys(normalized).find(k => getShopCanonicalKey(normalized[k], k) === newKey);
        const finalKey = existingKey || newKey;
        normalized[finalKey] = {
            ...(normalized[finalKey] || {}),
            ...shopObj,
            ads_accounts: normalizeAdsAccountsForShop(shopObj, [
                ...(normalized[finalKey]?.ads_accounts || []),
                ...(shopObj.ads_accounts || [])
            ]).filter(acc => acc.aadvid !== shopObj.aadvid)
        };
    });
    return normalized;
}

function loadShops(cb) {
    chrome.storage.local.get([STORAGE_KEY, 'strangetts_shop_order'], (data) => {
        let rawShops = normalizeStoredShopEntries(data[STORAGE_KEY] || {});
        
        // V40: key dashboard theo seller/oec identity, aadvid chỉ là ads account vận hành
        shops = rawShops;

        shopOrder = data['strangetts_shop_order'] || Object.keys(shops);
        
        // Đồng bộ lại shopOrder theo định danh mới
        let newOrder = [];
        shopOrder.forEach(id => {
            let foundKey = Object.keys(shops).find(k => k === id || shops[k].aadvid === id || shops[k].seller_id === id || shops[k].oec_seller_id === id);
            if (foundKey && !newOrder.includes(foundKey)) newOrder.push(foundKey);
        });
        shopOrder = newOrder;

        // Đảm bảo mọi shop đều có trong danh sách hiển thị
        Object.keys(shops).forEach(id => {
            if (!shopOrder.includes(id)) shopOrder.push(id);
        });

        saveShops(); // Lưu lại định danh chuẩn
        if (cb) cb();
    });
}

// ===== IMPORT =====
// ===== DELETE SHOP =====
function removeLocalShopState(shopKey) {
    let shop = shops[shopKey];
    const aadvid = shop?.aadvid;
    const dataKey = dashGetShopDataKey(shopKey, shop);
    delete shops[shopKey];
    delete shopData[shopKey];
    if (dataKey && dataKey !== shopKey) delete shopData[dataKey];
    if (aadvid && !dashAadvidIsShared(aadvid, shopKey)) delete shopData[aadvid];
    shopOrder = shopOrder.filter(id => id !== shopKey);
    if (typeof closeCampPanel === 'function' && activeShop === shopKey) closeCampPanel();
    chrome.storage.local.remove('strangetts_rp_data_' + dataKey);
}

async function removeShopsFromOwnCloud(shopKeys = []) {
    const sess = await checkDashAuth();
    if (!sess?.token) return { ok: false, error: 'Chưa đăng nhập' };
    return callBackend('/api/remove-shops', {
        token: sess.token,
        shop_keys: shopKeys
    });
}

async function deleteShopLocalOnly(shopKey, { confirmFirst = true, rerenderManage = false } = {}) {
    let shop = shops[shopKey];
    let name = shop?.shopRealName || shop?.name || shopKey;
    if (confirmFirst && !confirm('Chỉ xóa shop "' + name + '" khỏi máy này? Shop trên Cloud vẫn còn.')) return;
    removeLocalShopState(shopKey);
    saveShops();
    renderAll();
    if (rerenderManage) openManageShopsModal();
    showToast('🗑️ Đã xóa local: ' + name);
}

async function deleteShopCloudAndLocal(shopKey, { confirmFirst = true, rerenderManage = false } = {}) {
    let shop = shops[shopKey];
    let name = shop?.shopRealName || shop?.name || shopKey;
    if (confirmFirst && !confirm('Xóa shop "' + name + '" khỏi Cloud & máy này?')) return;

    showToast('⏳ Đang xóa shop trên Cloud...');
    const res = await removeShopsFromOwnCloud([shopKey]);
    if (!res.ok) {
        showToast('❌ Lỗi xóa Cloud: ' + (res.error || 'unknown'));
        return;
    }

    removeLocalShopState(shopKey);
    saveShops();
    renderAll();
    if (rerenderManage) openManageShopsModal();
    showToast('🗑️ Đã xóa ' + name + ' khỏi Cloud & máy');
}

function deleteShop(shopKey) {
    const shop = shops[shopKey] || {};
    const name = shop.shopRealName || shop.name || shopKey;
    const body = document.createElement('div');
    body.innerHTML = `
        <div style="font-size:13px;line-height:1.5;color:#cbd5e1;margin-bottom:12px">
            Chọn cách xóa shop <b style="color:#fff">${name}</b>.
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button id="delete-local-only" class="btn btn-secondary" style="font-size:12px">Chỉ máy</button>
            <button id="delete-cloud-local" class="btn btn-danger" style="font-size:12px;background:rgba(239,68,68,0.18);border-color:rgba(239,68,68,0.45);color:#fca5a5">Cloud & máy</button>
        </div>
    `;
    strangettsModal({
        title: 'Xóa Shop',
        body,
        icon: '🗑️',
        confirmText: 'Đóng',
        autoClose: true
    });
    setTimeout(() => {
        body.querySelector('#delete-local-only')?.addEventListener('click', () => {
            document.querySelector('.strangetts-modal-overlay')?.classList.remove('show');
            deleteShopLocalOnly(shopKey, { confirmFirst: false });
        });
        body.querySelector('#delete-cloud-local')?.addEventListener('click', () => {
            document.querySelector('.strangetts-modal-overlay')?.classList.remove('show');
            deleteShopCloudAndLocal(shopKey, { confirmFirst: false });
        });
    }, 0);
}

// ══════════════════════════════════════════════
// Strange TTS Solution & CRM TT AI AUTO-SYNC TRONG THỜI GIAN THỰC
// Theo dõi thay đổi Cookie để đẩy lên Cloud luôn
// ══════════════════════════════════════════════
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
        console.log('[Realtime] Phát hiện thay đổi dữ liệu shop (Cookie mới)...');
        // Cập nhật lại biến shops cục bộ
        const newShops = changes[STORAGE_KEY].newValue || {};
        shops = newShops;
        
        // === FIX: Chỉ auto-sync khi bật VÀ khi shops không rỗng (tránh ghi đè cloud khi xóa)
        if (configSyncEnabled && Object.keys(newShops).length > 0) {
            console.log('[Realtime] Đang tự động đẩy dữ liệu mới lên Cloud (Cookie update)...');
            doSyncCloud(true);
        } else if (configSyncEnabled && Object.keys(newShops).length === 0) {
            console.log('[Realtime] Bỏ qua auto-sync vì danh sách shop rỗng (tránh xóa Cloud).');
        }
    }
});

let s39CookieSignalTimer = null;
let s39CookieSignalBusy = false;

function applyCookieSignalUpdate(localKey, payload = {}) {
    const shop = shops[localKey];
    if (!shop || !payload.cookies || !payload.cookies.length) return false;
    const payloadShop = payload.shop || {};
    const preservedAccounts = mergeAdsAccountsPreservingSelection(
        shop,
        payloadShop.ads_accounts || payload.ads_accounts || [],
        shop.aadvid || payloadShop.aadvid || localKey
    );
    const merged = normalizeIncomingShopRecord({
        ...payload,
        shop: { ...shop, ...payloadShop, aadvid: shop.aadvid || payloadShop.aadvid, ads_accounts: preservedAccounts },
        cookies: payload.cookies,
        ads_accounts: preservedAccounts
    }, localKey, {
        source_username: payload.source_username || payload.owner_username || shop.source_username,
        source_shop_key: payload.source_shop_key || payload.shop_key || shop.source_shop_key
    });
    shops[localKey] = {
        ...shop,
        ...merged,
        aadvid: shop.aadvid || merged.aadvid,
        cookies: payload.cookies,
        cookieFingerprint: payload.cookieFingerprint || payload.cookie_signal || merged.cookieFingerprint,
        cookieUpdatedAt: payload.cookieUpdatedAt || merged.cookieUpdatedAt
    };
    return true;
}

async function checkAdminCookieSignalsOnce() {
    if (s39CookieSignalBusy) return;
    const sess = await checkDashAuth();
    if (!sess || sess.role !== 'admin') return;
    const linked = Object.keys(shops || {})
        .filter(k => shops[k]?.source_username || shops[k]?.owner_username)
        .map(k => ({
            key: k,
            local_key: k,
            target_username: shops[k].source_username || shops[k].owner_username,
            source_shop_key: shops[k].source_shop_key || '',
            canonical_shop_id: shops[k].canonical_shop_id || getShopCanonicalKey(shops[k], k),
            aadvid: shops[k].aadvid || '',
            seller_id: shops[k].seller_id || '',
            oec_seller_id: shops[k].oec_seller_id || '',
            cookieFingerprint: shops[k].cookieFingerprint || shops[k].cookie_signal || ''
        }));
    if (!linked.length) return;
    s39CookieSignalBusy = true;
    try {
        const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
        const resp = await fetch(`${syncUrl}/api/admin/check-cookie-signals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_token: sess.token, shops: linked })
        });
        const res = await resp.json();
        if (!res.ok || !res.updates) return;
        let changed = 0;
        Object.entries(res.updates).forEach(([key, payload]) => {
            if (applyCookieSignalUpdate(key, payload)) changed++;
        });
        if (changed > 0) {
            saveShops();
            renderAll();
            if (typeof syncShopsToBackground === 'function') syncShopsToBackground();
            showToast(`Cookie mới: đã nạp ${changed} shop từ user con`);
        }
    } catch (e) {
        console.warn('[V40] cookie signal check failed:', e.message);
    } finally {
        s39CookieSignalBusy = false;
    }
}

function startAdminCookieSignalPolling() {
    if (s39CookieSignalTimer) return;
    checkAdminCookieSignalsOnce();
    s39CookieSignalTimer = setInterval(checkAdminCookieSignalsOnce, 60 * 1000);
}

// ===== OPEN SHOP =====
async function openShopPage(shopKey) {
    let shop = shops[shopKey];
    if (!shop) return;
    showToast('🔄 Đang mở profile riêng cho shop...');
    try {
        await openIsolatedShopPage(shopKey, { pageType: 'seller' });
        showToast('✅ Đã mở profile riêng: ' + (shop.name || shopKey));
    } catch (error) {
        showToast('❌ Lỗi mở shop riêng: ' + (error.message || 'unknown'));
    }
}

// ===== FETCH DATA FOR ONE SHOP =====
function fetchShop(shopKey, opts = {}) {
    return new Promise((resolve) => {
        let shop = shops[shopKey];
        const silent = !!opts.silent;
        if (!shop) {
            if (!silent) showToast('❌ Lỗi tải: không tìm thấy shop');
            return resolve({ error: 'no shop' });
        }
        const shopName = shop.shopRealName || shop.name || shopKey;
        
        const aadvid = shop.aadvid;
        const dataKey = dashGetShopDataKey(shopKey, shop);
        if (!aadvid) {
            if (!silent) showToast(`❌ Lỗi tải ${shopName}: thiếu Ads Account ID`);
            return resolve({ error: 'no aadvid' });
        }

        shopData[dataKey] = shopData[dataKey] || {};
        shopData[dataKey].status = 'loading';
        renderShopCard(shopKey);
        if (!silent) showToast(`⏳ Đang tải dữ liệu ${shopName}...`);

        chrome.runtime.sendMessage({
            action: 'fetch_multi_shop',
            shop: buildRuntimeShopPayload(shop, shopKey)
        }, (response) => {
            if (chrome.runtime.lastError) {
                shopData[dataKey] = { status: 'error', error: chrome.runtime.lastError.message };
                if (!silent) showToast(`❌ Lỗi tải ${shopName}: ${chrome.runtime.lastError.message}`);
            } else if (response && response.status === 'ok') {
                // STRANGE TTS V31 FIX: Align mapping with background.js flattened result
                if (response.campaigns && Array.isArray(response.campaigns)) {
                    response.campaigns = response.campaigns.map(c => ({
                        ...c,
                        name: c.name || c.campaign_name || c.id || c.campaign_id || '',
                        cost: Number(c.cost || 0),
                        gmv: Number(c.gmv || 0),
                        roi: c.roi || '0',
                        orders: Number(c.orders || 0)
                    }));
                }

                // Lưu theo shop identity; aadvid có thể bị dùng chung giữa nhiều shop.
                shopData[dataKey] = response;
                shopData[shopKey] = response;

                // Đồng bộ Storage
                chrome.storage.local.set({ [`strangetts_rp_data_${dataKey}`]: response });

                // Check alerts
                processAdsAlerts(shopKey, response);
                if (!silent) {
                    const roi = response.roi || (response.totalCost > 0 ? (response.totalGmv / response.totalCost).toFixed(2) : '0');
                    showToast(`✅ Đã tải xong ${shopName}: GMV ${fmtDots(response.totalGmv || 0)} | Đơn ${fmtDots(response.totalOrders || 0)} | ROI ${roi}`);
                }
            } else {
                shopData[dataKey] = { status: 'error', error: (response && response.error) || 'unknown' };
                if (!silent) showToast(`❌ Lỗi tải ${shopName}: ${shopData[dataKey].error}`);
            }
            renderAll();
            if (activeShop === shopKey) renderCampPanelContent();
            // Lấy thêm thông tin Shop Name từ OEC API
            const oecId = shop.oec_seller_id || '';
            if (oecId) {
                const oecUrl = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/tt_list?locale=vi&language=vi&oec_seller_id=${oecId}`;
                fetch(oecUrl).then(r => {
                    if (!r.ok) {
                        console.error(`Fetch failed with status: ${r.status}`);
                        throw new Error(`HTTP error! status: ${r.status}`);
                    }
                    return r.json();
                }).then(oecRes => {
                    if (oecRes.code === 0 && oecRes.data) {
                        let info = (oecRes.data.tt_of_oec && oecRes.data.tt_of_oec[0]) || (oecRes.data.tt_of_bc && oecRes.data.tt_of_bc[0]);
                        if (info) {
                            // STRANGE TTS V30.2: Dùng shopKey (seller_id) làm key, không phải aadvid
                            shops[shopKey].shopRealName = info.name;
                            shops[shopKey].shopAvatar = info.avatar;
                            saveShops(); // Lưu lại vào storage
                            renderShopCard(shopKey); // Cập nhật card ngay để hiện avatar/tên mới
                        }
                    } else {
                        console.warn(`API returned an error: ${oecRes.msg}`);
                    }
                    resolve(shopData[dataKey]);
                }).catch(error => {
                    console.error("Error during fetch or processing:", error);
                    resolve(shopData[dataKey]);
                });
            } else {
                resolve(shopData[dataKey]);
            }
        });
    });
}

const strangettsFetchShopExtensionBackground = fetchShop;
fetchShop = function strangettsFetchShopHeadlessFirst(shopKey, opts = {}) {
    if (opts.forceExtensionBackground) return strangettsFetchShopExtensionBackground(shopKey, opts);
    const shop = shops[shopKey];
    const silent = !!opts.silent;
    if (!shop || !shop.aadvid) return strangettsFetchShopExtensionBackground(shopKey, opts);

    const shopName = shop.shopRealName || shop.name || shopKey;
    const dataKey = dashGetShopDataKey(shopKey, shop);
    shopData[dataKey] = shopData[dataKey] || {};
    shopData[dataKey].status = 'loading';
    renderShopCard(shopKey);
    if (!silent) showToast(`Headless: đang tải dữ liệu ${shopName}...`);

    return fetchShopViaLocalHeadless(shopKey, shop)
        .then(response => {
            if (response && response.status === 'ok') {
                if (response.campaigns && Array.isArray(response.campaigns)) {
                    response.campaigns = response.campaigns.map(c => ({
                        ...c,
                        name: c.name || c.campaign_name || c.id || c.campaign_id || '',
                        cost: Number(c.cost || 0),
                        gmv: Number(c.gmv || 0),
                        roi: c.roi || '0',
                        orders: Number(c.orders || 0)
                    }));
                }
                shopData[dataKey] = response;
                shopData[shopKey] = response;
                chrome.storage.local.set({ [`strangetts_rp_data_${dataKey}`]: response });
                processAdsAlerts(shopKey, response);
                if (!silent) {
                    const roi = response.roi || (response.totalCost > 0 ? (response.totalGmv / response.totalCost).toFixed(2) : '0');
                    showToast(`Headless OK ${shopName}: GMV ${fmtDots(response.totalGmv || 0)} | Don ${fmtDots(response.totalOrders || 0)} | ROI ${roi}`);
                }
            } else {
                shopData[dataKey] = { status: 'error', error: (response && response.error) || 'unknown' };
                if (!silent) showToast(`Headless loi ${shopName}: ${shopData[dataKey].error}`);
            }
            renderAll();
            if (activeShop === shopKey) renderCampPanelContent();
            return shopData[dataKey];
        })
        .catch(error => {
            const message = error?.message || String(error || 'headless_fetch_failed');
            console.warn('[STRANGE TTS] Headless fetch failed:', message);
            shopData[dataKey] = { status: 'error', error: `headless: ${message}` };
            renderAll();
            if (activeShop === shopKey) renderCampPanelContent();
            if (!silent) showToast(`Headless loi ${shopName}: ${message}`);
            return shopData[dataKey];
        });
};

// ===== FETCH ALL =====
async function fetchAll() {
    if (isFetchingAll) return;
    isFetchingAll = true;
    let keys = Object.keys(shops);
    if (keys.length === 0) {
        isFetchingAll = false;
        return;
    }

    setStatus(`⏳ Đang cập nhật dữ liệu cho ${keys.length} shop...`);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        setStatus(`⏳ [${i+1}/${keys.length}] Đang quét ${shops[key].name || key}...`);
        await fetchShop(key, { silent: true }); // Tải tất cả đã có status riêng, tránh spam toast từng shop
        await new Promise(r => setTimeout(r, 1000)); // Delay nhẹ 1s giữa các shop
    }

    setStatus('✅ Đã cập nhật xong dữ liệu!');
    isFetchingAll = false;
    setTimeout(() => setStatus('Sẵn sàng'), 5000);
}

// ===== EDIT CAMPAIGN =====
function editCampaign(aadvid, campId, newBudget, newRoi, btn) {
    let shopKey = shops[aadvid] ? aadvid : Object.keys(shops).find(k => shops[k]?.aadvid === aadvid);
    let shop = shops[shopKey];
    if (!shop) return;
    showToast('⏳ Đang sửa campaign...');
    chrome.runtime.sendMessage({
        action: 'edit_campaign_multi',
        shop: buildRuntimeShopPayload(shop, shopKey),
        campaignId: campId,
        newBudget: newBudget,
        newRoi: newRoi
    }, (response) => {
        globalSaveLock = false;
        if (response && response.success) {
            showToast('✅ Đã sửa! Budget: ' + fmtDots(response.budget) + ' | ROI: ' + response.roi);
            if (btn) { btn.textContent = '✅'; btn.style.background = '#16A34A'; }
            setTimeout(() => fetchShop(shopKey), 1000);
        } else {
            showToast('❌ Sửa thất bại: ' + ((response && response.error) || (response && response.msg) || 'unknown'));
            if (btn) { btn.textContent = '❌'; btn.disabled = false; }
        }
    });
}

// --- ADS ALERT PROCESSING ---
async function processAdsAlerts(shopKey, data) {
    const aadvid = data.aadvid;
    if (!aadvid) return;

    let shop = shops[shopKey] || {};
    if (!shop.alertSettings || !shop.alertSettings.alarm) return;
    if (!alertConfig) return;

    if (!alertHistory[aadvid]) {
        alertHistory[aadvid] = { lastStatus: 'ok', count: 0 };
    }
    const hist = alertHistory[aadvid];
    let shopName = shop.shopRealName || shop.name || shopKey;

    let alertMsg = "";
    let shouldNotify = false;

    // Billing types: 1 = Prepaid, 2 = Postpaid
    if (data.billingType === 1) {
        const total = (Number(data.balance) || 0) + (Number(data.credit) || 0);
        if (total === 0) {
            if (hist.lastStatus !== 'zero') {
                alertMsg = `⚠️ <b>CẢNH BÁO SỐ DƯ: 0đ</b>\n🏪 Shop: <b>${shopName}</b>\n💰 Tài khoản đã hết sạch tiền. Vui lòng nạp thêm để không gián đoạn quảng cáo.`;
                hist.lastStatus = 'zero';
                shouldNotify = true;
            }
        } else {
            hist.lastStatus = 'ok';
        }
    } else if (data.billingType === 2 && data.threshold > 0) {
        const spent = Number(data.thresholdSpent) || 0;
        const limit = Number(data.threshold) || 0;
        if (limit > 0 && spent >= limit) {
            hist.count = (hist.count || 0) + 1;
            if (hist.count >= 2 && hist.lastStatus !== 'threshold') {
                alertMsg = `⚠️ <b>CẢNH BÁO CHẠM NGƯỠNG (100%)</b>\n🏪 Shop: <b>${shopName}</b>\n💳 Đã tiêu: ${fmtDots(spent)} / ${fmtDots(limit)}\n🔔 Tài khoản đã đạt 100% ngưỡng thanh toán. Vui lòng kiểm tra để tránh bị dừng tài khoản.`;
                hist.lastStatus = 'threshold';
                shouldNotify = true;
            }
        } else {
            hist.count = 0;
            hist.lastStatus = 'ok';
        }
    }

    if (shouldNotify && alertMsg) {
        console.log(`[Alert] Sending notification for ${shopName}...`);
        sendAdsAlert(alertMsg);
        await chrome.storage.local.set({ [STORAGE_ALERT_HISTORY]: alertHistory });
    }
}
async function sendAdsAlert(msg) {
    if (!alertConfig) return;

    // Tự động lấy cấu hình từ Tab Report (rpConfig) nếu bên Alert chưa có
    const tgToken = alertConfig.tgToken || (typeof rpConfig !== 'undefined' ? rpConfig.__global_tg_token__ : '');
    const tgId1 = alertConfig.tgChatId || (typeof rpConfig !== 'undefined' ? rpConfig.__global_tg_chatid__ : '');
    const tgId2 = alertConfig.tgChatId2 || (typeof rpConfig !== 'undefined' ? rpConfig.__global_tg_chatid2__ : '');
    
    const zaloSrv = alertConfig.zaloServer || (typeof rpConfig !== 'undefined' ? (rpConfig.__server__ || rpConfig.__global_zalo_server__) : '');
    const zaloU = alertConfig.zaloUser || (typeof rpConfig !== 'undefined' ? rpConfig.__global_zalo_user__ : '');
    const zaloG = alertConfig.zaloGroup || (typeof rpConfig !== 'undefined' ? rpConfig.__global_zalo_group__ : '');

    // Telegram
    if (tgToken) {
        const targets = [];
        if (tgId1) targets.push(tgId1);
        if (tgId2) targets.push(tgId2);

        for (const cid of targets) {
            chrome.runtime.sendMessage({
                action: 'send_telegram',
                bot_token: tgToken,
                chat_id: cid,
                text: msg,
                parse_mode: 'HTML'
            });
        }
    }

    // Zalo
    if (zaloSrv) {
        const plainMsg = msg.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
        const payload = { message: plainMsg };
        if (zaloU) payload.user_id = zaloU;
        if (zaloG) payload.group_id = zaloG;

        fetch(`${zaloSrv}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error('[Alert] Zalo fetch error:', err));
    }
}

function normalizeRecapTimes(raw) {
    const seen = new Set();
    return String(raw || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
        .filter(s => {
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
        })
        .join(', ');
}

function renderQuickRecapLastState(lastState) {
    const el = document.getElementById('alert-recap-last-status');
    if (!el) return;
    if (!lastState || (!lastState.ts && !lastState.error)) {
        el.innerHTML = 'Chưa có lịch sử recap.';
        return;
    }

    const statusColor = lastState.skipped ? '#7dd3fc' : (lastState.ok ? '#86efac' : '#fca5a5');
    const failed = Array.isArray(lastState.failedDetails) ? lastState.failedDetails : [];
    const title = lastState.skipped
        ? 'Lần recap gần nhất: Bỏ qua'
        : (lastState.ok ? 'Lần recap gần nhất: OK' : 'Lần recap gần nhất: Có lỗi');
    const failedHtml = failed.length
        ? `<div style="margin-top:6px;color:#fca5a5"><b>Shop lỗi:</b><br>${failed.map(f => `• ${f.name}${f.error ? ` — ${f.error}` : ''}`).join('<br>')}</div>`
        : '';
    const channelLine = (lastState.telegram || lastState.zalo || lastState.telegramError || lastState.zaloError)
        ? `<div style="margin-top:4px">📨 TG: ${lastState.telegram ? 'OK' : (lastState.telegramError || 'skip')} | Zalo: ${lastState.zalo ? 'OK' : (lastState.zaloError || 'skip')}</div>`
        : '';
    const messageLine = (lastState.recapMessages || lastState.adsMessages || lastState.errorMessages)
        ? `<div style="margin-top:4px">🧾 Tin recap: ${lastState.recapMessages || 0}</div>`
        : '';

    el.innerHTML = `
        <div style="color:${statusColor};font-weight:800">${title}</div>
        <div style="margin-top:4px">⏰ ${lastState.ts || '—'}${lastState.slot ? ` | Slot: ${lastState.slot}` : ''}</div>
        <div style="margin-top:4px">🏪 ${lastState.sentShops || 0}/${lastState.totalShops || 0} shop${lastState.error ? ` | ${lastState.error}` : ''}</div>
        ${channelLine}
        ${messageLine}
        ${failedHtml}
    `;
}

// --- DAILY SIMPLE REPORT SCHEDULER ---
let _alertSchedulerRunning = false;
function startAlertScheduler() {
    if (_alertSchedulerRunning) return;
    _alertSchedulerRunning = true;
    console.log('[Alert] Popup quick recap scheduler disabled; background handles recap.');
}

function renderShopCard(shopKey) {
    let existing = document.getElementById('card-' + shopKey);
    if (!existing) return;
    let newCard = buildShopCard(shopKey);
    existing.replaceWith(newCard);
}

function buildShopCard(shopKey) {
    let shop = shops[shopKey] || {};
    let d = dashGetShopData(shopKey);
    let isOk = d.status === 'ok';
    let stats = getPerfStats(d.campaigns);
    
    // Financial formatting
    let totalBalanceVal = (Number(d.balance) || 0) + (Number(d.credit) || 0);
    let balanceStr = totalBalanceVal !== 0 ? fmtDots(totalBalanceVal) : '0';
    let gmvVal = Number(d.totalGmv) || 0;
    let costVal = Number(d.totalCost) || 0;
    let roiVal = costVal > 0 ? (gmvVal / costVal).toFixed(2) : '0.00';
    let cpoVal = (Number(d.totalOrders) || 0) > 0 ? Math.round(costVal / d.totalOrders) : 0;

    let billingBadge = '';
    if (d.billingType === 1) billingBadge = '<span class="v20-badge badge-prepaid">Trả trước</span>';
    if (d.billingType === 2) billingBadge = '<span class="v20-badge badge-postpaid">Trả sau</span>';

    let syncTime = d.fetchedAt ? new Date(d.fetchedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
    let isActive = activeShop === shopKey;
    let displayName = shop.shopRealName || shop.name || shopKey;
    let avatarHtml = shop.shopAvatar ? `<img src="${shop.shopAvatar}" class="v20-avatar" />` : `<div class="v20-shop-icon"><i class="fa-solid fa-shop"></i></div>`;

    let card = document.createElement('div');
    const aadvid = shop.aadvid || shopKey;
    card.className = 'shop-card' + (isActive ? ' active' : '');
    card.id = 'card-' + shopKey; // id theo shopKey để tránh conflict

    let shopStatusObj = { text: 'BÌNH THƯỜNG', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.05)' };
    if (stats.strong > 0 || stats.good_roi > 0) shopStatusObj = { text: 'TỐT', color: '#4ADE80', bg: 'rgba(74, 222, 128, 0.1)' };
    else if (stats.weak > 0 || stats.low_roi > 0) shopStatusObj = { text: 'CẦN THEO DÕI', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.1)' };
    else if (d.totalCost === 0 || d.totalCost == undefined) shopStatusObj = { text: 'KHÔNG HOẠT ĐỘNG', color: '#94a3b8', bg: 'rgba(255, 255, 255, 0.05)' };

    // Tên hiển thị phụ: ưu tiên seller_id rồi mới tên shop (không dùng aadvid)
    const subName = shop.seller_id || shop.name || aadvid;
    const sourceUser = shop.source_username || shop.owner_username || shop.owner || '';
    const sourceShopKey = shop.source_shop_key || shop.shop_key || shop.canonical_shop_id || shopKey;
    const sourceTitle = sourceUser ? `Nguồn cookie: ${sourceUser}${sourceShopKey ? ' / shop ' + sourceShopKey : ''}` : '';

    card.innerHTML = `
        <div class="v20-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
                ${avatarHtml}
                <div style="display: flex; flex-direction: column;">
                    <div class="v20-shop-name" title="${displayName}">${displayName}</div>
                    <div class="v20-ads-acc-name" title="${shop.name || shopKey}">${shop.name || shopKey}</div>
                    ${sourceUser ? `<div class="v20-ads-acc-name" style="color:#a78bfa" title="${sourceTitle}">Nguồn: ${sourceUser}</div>` : ''}
                </div>
            </div>
            <div class="v20-header-right">
                <div class="v20-shop-status" style="color: ${shopStatusObj.color}; background: ${shopStatusObj.bg};">${shopStatusObj.text}</div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
                    <div class="sync-time"><i class="fa-solid fa-rotate"></i> Quét: ${syncTime}</div>
                    ${shop.exportedAt ? `<div class="sync-time" style="color:#a78bfa" title="Lần cuối đẩy lên Cloud"><i class="fa-solid fa-cloud-arrow-up"></i> Cloud: ${new Date(shop.exportedAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>` : ''}
                </div>
            </div>
        </div>

        <div class="v20-grid">
            <div class="v20-cell" title="Chi phí hôm nay">
                <span class="v20-label"><i class="fa-solid fa-money-bill-transfer"></i> CHI TIÊU</span>
                <span class="v20-val orange" style="font-size: 13px">${isOk ? fmtDots(d.totalCost) : '—'}</span>
            </div>
            <div class="v20-cell" title="Doanh thu (GMV) hôm nay">
                <span class="v20-label"><i class="fa-solid fa-sack-dollar"></i> DOANH THU</span>
                <span class="v20-val green" style="font-size: 13px">${isOk ? fmtDots(d.totalGmv) : '—'}</span>
            </div>
            <div class="v20-cell" title="ROI hôm nay">
                <span class="v20-label"><i class="fa-solid fa-chart-line"></i> ROI</span>
                <span class="v20-val ${getRoiClass(roiVal)}" style="font-size: 18px">${isOk ? roiVal : '—'}</span>
            </div>
            <div class="v20-cell" title="Tổng số đơn hôm nay">
                <span class="v20-label"><i class="fa-solid fa-box-open"></i> ĐƠN</span>
                <span class="v20-val yellow" style="font-size: 18px">${isOk ? fmtDots(d.totalOrders) : '—'}</span>
            </div>
            <div class="v20-cell" title="Cost per Order">
                <span class="v20-label"><i class="fa-solid fa-bullseye"></i> CPO</span>
                <span class="v20-val orange" style="font-size: 13px">${isOk ? fmtDots(cpoVal) : '—'}</span>
            </div>
            <div class="v20-cell ${((Number(d.billingType) === 1 && d.balance < 200000) || ((Number(d.billingType) === 2 || d.threshold > 0) && d.threshold > 0 && (d.thresholdSpent / d.threshold) >= 0.8)) ? 'blink-red' : ''}" title="${(Number(d.billingType) === 2 || d.threshold > 0) ? 'Ngưỡng thanh toán (Đã tiêu / Hạn mức)' : 'Tổng số dư (Tiền mặt + Tín dụng)'}">
                <span class="v20-label">${(Number(d.billingType) === 2 || d.threshold > 0) ? '<i class="fa-solid fa-atm"></i> NGƯỠNG' : '<i class="fa-solid fa-wallet"></i> SỐ DƯ'}</span>
                <span class="v20-val ${(Number(d.billingType) === 2 || d.threshold > 0) ? '' : 'blue'}" style="font-size: ${(Number(d.billingType) === 2 || d.threshold > 0) ? '10px' : '20px'}">
                ${(Number(d.billingType) === 2 || d.threshold > 0) ? 
                    `<div class="v20-th-compact">
                        <div class="th-spent">${fmtDots(d.thresholdSpent || 0)}</div>
                        <div class="th-sep"></div>
                        <div class="th-limit">${fmtDots(d.threshold || 0)}</div>
                     </div>` : 
                    balanceStr
                }
                </span>
            </div>
        </div>

    <div class="v20-ads-stripe">
        <div class="v20-stripe-row v20-billing-row">
            <span title="Tiền mặt thực tế"><i class="fa-solid fa-money-bill-1"></i> TM: ${isOk ? fmtDots(d.balance || 0) : '—'}</span>
            <span title="Tín dụng"><i class="fa-solid fa-credit-card"></i> Tín: ${isOk ? fmtDots(d.credit || 0) : '—'}</span>
        </div>
        <div class="v20-stripe-row" style="margin-top: 8px; justify-content: space-around;">
            <span style="display: flex; gap: 4px; align-items: center; opacity: 0.8; font-size: 11px;">🔥 ${stats.near_budget}</span>
            <span style="display: flex; gap: 4px; align-items: center; opacity: 0.8; font-size: 11px;">📈 ${stats.good_roi}</span>
            <span style="display: flex; gap: 4px; align-items: center; opacity: 0.8; font-size: 11px;">🚀 ${stats.strong}</span>
            <span style="display: flex; gap: 4px; align-items: center; opacity: 0.8; font-size: 11px;">📉 ${stats.low_roi}</span>
            <span style="display: flex; gap: 4px; align-items: center; opacity: 0.8; font-size: 11px;">❄️ ${stats.weak}</span>
        </div>
    </div>

        <div class="v20-alert-controls">
            <span style="font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 700; margin-right: auto;">THÔNG BÁO:</span>
            <div class="v20-alert-item ${ (shop.alertSettings && shop.alertSettings.alarm) ? 'on' : 'off'}" data-type="alarm" title="Báo khi hết số dư / Chạm ngưỡng">
                <i class="fa-solid fa-bell"></i> Alarm
            </div>
            <div class="v20-alert-item ${ (shop.alertSettings && shop.alertSettings.report) ? 'on' : 'off'}" data-type="report" title="Báo cáo chi tiêu đơn giản hàng ngày">
                <i class="fa-solid fa-calendar-check"></i> Report
            </div>
        </div>

        <div class="v20-footer">
            <div class="v20-camp-count" style="display: flex; align-items: center; gap: 8px;">
                <span class="v20-badge mini ${(Number(d.billingType) === 2 || d.threshold > 0) ? 'badge-postpaid' : 'badge-prepaid'}">${(Number(d.billingType) === 2 || d.threshold > 0) ? 'Trả sau' : 'Trả trước'}</span>
                <span><i class="fa-solid fa-tv"></i> ${stats.total} Camp</span>
                ${(shop.ads_accounts && shop.ads_accounts.length > 0) ? `<span style="background:rgba(168,170,173,0.15);border:1px solid rgba(168,170,173,0.3);color:#a8aaad;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700">+${shop.ads_accounts.length} TK</span>` : ''}
            </div>
            <div class="v20-footer-actions">
                <button class="v20-action-btn safe" data-action="multi-acc" title="Quản lý TK Ads" style="font-size:10px;padding:2px 5px">📊 TK</button>
                <button class="v20-action-btn safe" data-action="login" title="Đăng nhập & Bơm Cookie"><i class="fas fa-key"></i></button>
                <button class="v20-action-btn safe" data-action="payment" title="Nạp tiền"><i class="fas fa-credit-card"></i></button>
                <button class="v20-action-btn" data-action="refresh" title="Tải lại data"><i class="fas fa-rotate"></i></button>
                <button class="v20-action-btn danger" data-action="delete" title="Xóa shop"><i class="fas fa-trash-can"></i></button>
            </div>
        </div>
    `;

    const perfIconClasses = ['st-icon-fire', 'st-icon-trend-up', 'st-icon-rocket', 'st-icon-trend-down', 'st-icon-snow'];
    card.querySelectorAll('.v20-ads-stripe .v20-stripe-row:nth-child(2) > span').forEach((item, index) => {
        const value = item.textContent.replace(/[^\d.-]/g, '').trim() || '0';
        item.innerHTML = `<span class="st-icon ${perfIconClasses[index] || 'st-icon-roi'}" aria-hidden="true"></span> ${value}`;
    });
    const multiAccBtn = card.querySelector('[data-action="multi-acc"]');
    if (multiAccBtn) {
        multiAccBtn.innerHTML = '<span class="st-icon st-icon-roi" aria-hidden="true"></span><span>TK</span>';
    }

    card.querySelectorAll('.v20-alert-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!shop.alertSettings) shop.alertSettings = { alarm: false, report: false };
            const type = item.dataset.type;
            shop.alertSettings[type] = !shop.alertSettings[type];
            item.classList.toggle('on', shop.alertSettings[type]);
            item.classList.toggle('off', !shop.alertSettings[type]);
            saveShops();
            showToast(`🔔 ${type === 'alarm' ? 'Alarm' : 'Report'} ${displayName}: ${shop.alertSettings[type] ? 'BẬT' : 'TẮT'}`);
        });
    });

    card.querySelectorAll('.v20-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            let act = btn.dataset.action;
            // STRANGE TTS V30.2: Tất cả actions dùng shopKey (seller_id) - fix nút TK/Refresh/Delete không hoạt động
            if (act === 'login') openShopPage(shopKey);
            else if (act === 'refresh') fetchShopMultiAccount(shopKey);
            else if (act === 'payment') openPaymentPage(shopKey);
            else if (act === 'delete') deleteShop(shopKey);
            else if (act === 'multi-acc') openMultiAccountModal(shopKey);
        });
    });

    card.addEventListener('click', () => selectShop(shopKey));

    return card;
}

async function openPaymentPage(shopKey) {
    let shop = shops[shopKey];
    if (!shop) return;
    const aadvid = shop.aadvid || shopKey;
    showToast('🔄 Đang mở trang Nạp tiền bằng profile riêng...');
    try {
        await openIsolatedShopPage(shopKey, {
            pageType: 'payment',
            targetUrl: `https://ads.tiktok.com/i18n/account/payment?aadvid=${encodeURIComponent(aadvid)}`
        });
        showToast('✅ Đã mở trang thanh toán riêng cho ' + (shop.name || shopKey));
    } catch (error) {
        showToast('❌ Lỗi mở thanh toán riêng: ' + (error.message || 'unknown'));
    }
}

// ==========================================================
// RENDER — SHOP CARDS
// ==========================================================
function renderAll() {
    renderShopCards();
    renderTable();
    updateStats();

    let keys = Object.keys(shops);
    let emptyState = document.getElementById('empty-state');
    let cardGrid   = document.getElementById('shop-cards-grid');
    let tableWrap  = document.getElementById('table-wrap');
    if (keys.length === 0) {
        emptyState.style.display = '';
        if (cardGrid)  cardGrid.style.display  = 'none';
        if (tableWrap) tableWrap.style.display = 'none';
        return;
    }
    emptyState.style.display = 'none';

    if (viewMode === 'cards') {
        if (cardGrid)  cardGrid.style.display  = '';
        if (tableWrap) tableWrap.style.display = 'none';
    } else {
        if (cardGrid)  cardGrid.style.display  = 'none';
        if (tableWrap) tableWrap.style.display = '';
    }
}

function renderShopCards() {
    let grid = document.getElementById('shop-cards-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Đảm bảo shopOrder chứa đủ các shop hiện có
    const allKeys = Object.keys(shops);
    allKeys.forEach(k => {
        if (!shopOrder.includes(k)) shopOrder.push(k);
    });
    shopOrder = shopOrder.filter(k => allKeys.includes(k));

    if (shopOrder.length === 0) {
        document.getElementById('empty-state').style.display = 'flex';
        return;
    } else {
        document.getElementById('empty-state').style.display = 'none';
    }

    let viewOrder = shopOrder.slice().sort(dashCompareByCurrentSort);
    viewOrder.forEach(aadvid => {
        let card = buildShopCard(aadvid);
        card.draggable = true;
        
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            
            // Cập nhật order sau khi kéo xong
            const newOrder = [];
            grid.querySelectorAll('.shop-card').forEach(el => {
                newOrder.push(el.id.replace('card-', ''));
            });
            if (currentDashSort !== 'name') {
                showToast('ℹ️ Đang bật sắp xếp theo dữ liệu, kéo thả không lưu thứ tự.');
                renderAll();
                return;
            }
            shopOrder = newOrder;
            saveShops();
        });

        grid.appendChild(card);
    });

    // Chỉ add sự kiện dragover một lần duy nhất lên grid
    if (!grid.dataset.dragInit) {
        grid.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(grid, e.clientX, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (!draggable) return;
            if (afterElement == null) {
                grid.appendChild(draggable);
            } else {
                grid.insertBefore(draggable, afterElement);
            }
        });
        grid.dataset.dragInit = 'true';
    }
}

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.shop-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Tính toán khoảng cách Euclidean đến trung tâm của thẻ
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;
        
        // Với grid 3 cột, ưu tiên Y rồi đến X
        const offset = y - centerY;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ==========================================================
// SHOP SELECTION & CAMPAIGN PANEL
// ==========================================================
let selectedShopId = null; // tracking for selection only

async function openVerificationCenter(aadvid) {
    let shopKey = shops[aadvid] ? aadvid : Object.keys(shops).find(k => shops[k]?.aadvid === aadvid);
    let shop = shops[shopKey];
    if (!shop) return;
    aadvid = shop.aadvid || aadvid;
    showToast('🔄 Đang mở Ads bằng profile riêng...');
    try {
        await openIsolatedShopPage(shopKey, {
            pageType: 'verification',
            targetUrl: `https://ads.tiktok.com/i18n/verification-center/setting?aadvid=${encodeURIComponent(aadvid)}`
        });
        showToast('✅ Đã mở trang Ads riêng cho ' + (shop.name || shopKey));
    } catch (error) {
        showToast('❌ Lỗi mở Ads riêng: ' + (error.message || 'unknown'));
    }
}

async function openShopAds(aadvid) {
    const shopKey = shops[aadvid] ? aadvid : Object.keys(shops).find(k => shops[k]?.aadvid === aadvid);
    const shop = shops[shopKey];
    const now = new Date();
    const startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const endTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const targetUrl = `https://ads.tiktok.com/i18n/ads-creation/dashboard?aadvid=${encodeURIComponent(aadvid)}&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${startTs}&list_end_date=${endTs}`;
    if (!shop) {
        chrome.tabs.create({ url: targetUrl, active: true });
        return;
    }
    showToast('🔄 Đang mở Ads dashboard bằng profile riêng...');
    try {
        await openIsolatedShopPage(shopKey, { pageType: 'ads-dashboard', targetUrl });
        showToast('✅ Đã mở Ads dashboard riêng cho ' + (shop.name || shopKey));
    } catch (error) {
        showToast('❌ Lỗi mở Ads dashboard riêng: ' + (error.message || 'unknown'));
    }
}

// STRANGE TTS V30.2: selectShop nhận shopKey (seller_id), tra aadvid nội bộ
function selectShop(shopKey) {
    if (activeShop === shopKey) {
        closeCampPanel();
        return;
    }
    // Deselect previous
    if (activeShop) {
        let prevCard = document.getElementById('card-' + activeShop);
        if (prevCard) prevCard.classList.remove('active');
    }
    activeShop = shopKey;
    let card = document.getElementById('card-' + shopKey);
    if (card) card.classList.add('active');

    let shop = shops[shopKey] || {};
    const dataKey = dashGetShopDataKey(shopKey, shop);
    const shopAadvid = shop.aadvid || shopKey;

    // STRANGE TTS V31 FIX: Nạp dữ liệu chiến dịch từ storage vào shopData trước khi render
    const rpDataKey = 'strangetts_rp_data_' + dataKey;
    const legacyRpDataKey = 'strangetts_rp_data_' + shopAadvid;
    chrome.storage.local.get([rpDataKey, legacyRpDataKey], (res) => {
        const shouldUseLegacy = !res[rpDataKey] && !dashAadvidIsShared(shopAadvid, shopKey);
        const stored = res[rpDataKey] || (shouldUseLegacy ? res[legacyRpDataKey] : null);
        if (stored) {
            let data = stored;
            
            // Safeguard flattening to match background.js structure
            if (data.campaigns && Array.isArray(data.campaigns)) {
                data.campaigns = data.campaigns.map(c => ({
                    ...c,
                    name: c.name || c.campaign_name || c.id || c.campaign_id || '',
                    cost: Number(c.cost || 0),
                    gmv: Number(c.gmv || 0),
                    orders: Number(c.orders || 0),
                    roi: c.roi || '0'
                }));
            }

            shopData[shopKey] = data;
            
            let stats = getPerfStats(data.campaigns || []);
            let summaryText = `${(data.campaigns || []).length} camp | ${stats.strong} scale | ${stats.weak} yếu | ${stats.near_budget} hết NS`;
            document.getElementById('camp-panel-status-summary').textContent = summaryText;
        }
        
        // Open panel UI
        let panel = document.getElementById('camp-panel');
        document.getElementById('camp-panel-shop-name').textContent = '📺 ' + (shop.shopRealName || shop.name || shopKey);

        let d = dashGetShopData(shopKey);
        let badge = document.getElementById('camp-panel-badge');
        if (d.billingType === 2) { badge.textContent = 'Trả sau'; badge.style.cssText = 'background:#7F1D1D;color:#FCA5A5;'; }
        else if (d.billingType === 1) { badge.textContent = 'Trả trước'; badge.style.cssText = 'background:#064E3B;color:#6EE7B7;'; }
        else { badge.textContent = ''; }

        panel.classList.add('open');
        renderCampPanelContent();
    });
}

function closeCampPanel() {
    if (activeShop) {
        let card = document.getElementById('card-' + activeShop);
        if (card) card.classList.remove('active');
    }
    activeShop = null;
    document.getElementById('camp-panel').classList.remove('open');
}

function setCampFilter(filter) {
    activePerfFilter = filter;
    renderCampPanelContent();
}

function openCampPanelFilter(shopKey, filter) {
    activePerfFilter = filter;
    if (activeShop !== shopKey) {
        selectShop(shopKey);
    } else {
        // Just refresh panel if already active
        let panel = document.getElementById('camp-panel');
        if (!panel.classList.contains('open')) panel.classList.add('open');
        renderCampPanelContent();
    }
}

function renderCampPanelContent() {
    const body = document.getElementById('camp-panel-body');
    if (!activeShop || !body) return;

    // === FIX: Thử tra cứu theo cả shopKey lẫn aadvid (tránh mismatch key)
    let d = dashGetShopData(activeShop);
    if (!d || !d.campaigns) {
        const shopObj = shops[activeShop];
        if (shopObj && shopObj.aadvid && !dashAadvidIsShared(shopObj.aadvid, activeShop)) {
            d = shopData[shopObj.aadvid] || shopData[shopObj.oec_seller_id] || shopData[shopObj.seller_id];
        }
    }
    if (!d || !d.campaigns || d.campaigns.length === 0) {
        body.innerHTML = '<div class="camp-panel-loading" style="padding:40px;color:rgba(255,255,255,0.4)">Không có dữ liệu chiến dịch.</div>';
        return;
    }

    let filtered = d.campaigns;
    if (activePerfFilter !== 'all') {
        filtered = d.campaigns.filter(c => {
            let spend = Number(c.cost) || 0;
            let budget = Number(c.budget) || 0;
            let roi = parseFloat(c.roi) || 0;
            let targetRoi = parseFloat(c.targetRoi) || 0;
            let orders = Number(c.orders) || 0;
            let spendPct = budget > 0 ? (spend / budget) * 100 : 0;

            if (activePerfFilter === 'near_budget') return spendPct >= 85 || (c.status || '').includes('OUT_OF_BUDGET');
            if (activePerfFilter === 'low_roi') return targetRoi > 0 && roi < targetRoi * 0.8;
            if (activePerfFilter === 'good_roi') return targetRoi > 0 && roi >= targetRoi;
            if (activePerfFilter === 'strong') return targetRoi > 0 && roi >= targetRoi && orders >= 10 && spendPct >= 50;
            if (activePerfFilter === 'weak') return spend >= 50000 && (orders === 0 || (targetRoi > 0 && roi < targetRoi * 0.6));
            if (activePerfFilter === 'testing') return spend > 0 && spend < 50000;
            return true;
        });
    }

    const stats = getPerfStats(d.campaigns);

    let html = `
        <div class="perf-filter-bar" id="camp-filter-bar">
            <div class="filter-btn ${activePerfFilter === 'all' ? 'active' : ''}" style="background:#4B5563" data-filter="all">Tất cả (${d.campaigns.length})</div>
            <div class="filter-btn perf-fire ${activePerfFilter === 'near_budget' ? 'active' : ''}" data-filter="near_budget">🔥 Gần hết NS (${stats.near_budget})</div>
            <div class="filter-btn perf-roi-up ${activePerfFilter === 'good_roi' ? 'active' : ''}" data-filter="good_roi">📈 ROI Ngon (${stats.good_roi})</div>
            <div class="filter-btn perf-muscle ${activePerfFilter === 'strong' ? 'active' : ''}" data-filter="strong">🚀 Scale/Khỏe (${stats.strong})</div>
            <div class="filter-btn perf-roi-down ${activePerfFilter === 'low_roi' ? 'active' : ''}" data-filter="low_roi">📉 ROI thấp (${stats.low_roi})</div>
            <div class="filter-btn perf-snow ${activePerfFilter === 'weak' ? 'active' : ''}" data-filter="weak">❄️ Yếu (${stats.weak})</div>
        </div>
        <div class="camp-row camp-row-head"><span>#</span><span>Campaign</span><span>Spend</span><span>GMV</span><span>ROI</span><span>Đơn</span><span>CPO</span><span>Status</span><span>Budget / ROI</span><span></span></div>
    `;

    filtered.sort((a,b) => (b.cost || 0) - (a.cost || 0)).forEach((c, i) => {
        let roiVal = parseFloat(c.roi) || 0;
        let roiClr = roiVal >= 3 ? '#4ADE80' : roiVal >= 2 ? '#FBBF24' : '#F87171';
        let statusOk = (c.status || '').includes('delivery_ok');
        let spendPct = c.budget > 0 ? Math.round((c.cost / c.budget) * 100) : 0;

        html += `
        <div class="camp-row">
            <span style="color:var(--text-dim)">${i + 1}</span>
            <span class="camp-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;display:block;cursor:default;" title="${(c.name || '').replace(/"/g, '')}">${c.name || c.id || '—'}</span>
            <span style="color:var(--orange)">${fmtDots(c.cost)} <small style="color:var(--text-dim)">${spendPct}%</small></span>
            <span style="color:var(--green)">${fmtDots(c.gmv)}</span>
            <span style="color:${roiClr};font-weight:700">${c.roi}</span>
            <span style="color:var(--yellow)">${c.orders}</span>
            <span style="color:var(--text-dim)">${c.cpo ? fmtDots(c.cpo) : '—'}</span>
            <span><span class="camp-status-dot ${statusOk ? 'ok' : 'off'}"></span></span>
            <div style="display:flex;gap:4px;align-items:center">
                <input type="text" class="camp-edit-input camp-edit-budget" value="${fmtDots(c.budget)}" />
                <input type="text" class="camp-edit-input camp-edit-roi" value="${c.targetRoi || ''}" style="width:40px;color:var(--purple-light)" />
                <button class="btn btn-sm btn-primary camp-save-btn" data-camp-id="${c.id}">Lưu</button>
            </div>
        </div>`;
    });

    body.innerHTML = html;

    // Attach filter listeners (CSP-safe)
    body.querySelectorAll('#camp-filter-bar .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setCampFilter(btn.dataset.filter);
        });
    });

    // Attach save listeners (CSP-safe)
    body.querySelectorAll('.camp-save-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            handleEditSave(activeShop, this.dataset.campId, this);
        });
    });

    body.querySelectorAll('.camp-edit-budget').forEach(input => {
        input.addEventListener('input', function() {
            let raw = this.value.replace(/[^\d]/g, '');
            if (raw) this.value = Number(raw).toLocaleString('vi-VN');
        });
    });
}

let expandedShop = null;
let globalSaveLock = false;

function handleEditSave(aadvid, campId, btn) {
    if (globalSaveLock) { showToast('⏳ Có một tiến trình lưu khác đang chạy, vui lòng chờ...'); return; }
    let row = btn.parentElement;
    let budgetInput = row.querySelector('.camp-edit-budget');
    let roiInput = row.querySelector('.camp-edit-roi');
    let rawBudget = parseInt(String(budgetInput.value).replace(/[^\d]/g, '')) || 0;
    let rawRoi = parseFloat(String(roiInput.value).replace(/,/g, '.')) || 0;
    if (rawBudget < 50000) { showToast('❌ Budget tối thiểu 50.000'); return; }
    if (rawRoi <= 0) { showToast('❌ ROI phải > 0'); return; }
    
    globalSaveLock = true;
    btn.textContent = '⏳'; btn.disabled = true;
    editCampaign(aadvid, campId, rawBudget, rawRoi, btn);
}

function renderTable() {
    let keys = Object.keys(shops);
    if (keys.length === 0) return;

    // Sắp xếp danh sách shop trong bảng
    let sorted = keys.slice().sort((a, b) => {
        let dA = dashGetShopData(a), dB = dashGetShopData(b);
        let vA, vB;
        if (sortCol === 'name') {
            vA = (shops[a]?.name || '').toLowerCase();
            vB = (shops[b]?.name || '').toLowerCase();
        } else if (sortCol === 'billingType') {
            vA = dA.billingType || 0; vB = dB.billingType || 0;
        } else {
            vA = Number(dA[sortCol]) || 0; vB = Number(dB[sortCol]) || 0;
        }
        if (vA < vB) return sortAsc ? -1 : 1;
        if (vA > vB) return sortAsc ? 1 : -1;
        return 0;
    });

    let tbody = document.getElementById('shop-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    sorted.forEach((key, idx) => {
        let tr = document.createElement('tr');
        tr.id = 'row-' + key;
        tr.innerHTML = buildRowHTML(key, idx + 1);
        tbody.appendChild(tr);
        attachRowListeners(tr, key);
    });

    // Dòng tổng kết cuối bảng
    let totals = calcTotals();
    let totalTr = document.createElement('tr');
    totalTr.className = 'total-row';
    totalTr.innerHTML =
        '<td></td><td class="shop-name">TỔNG CỘNG (' + keys.length + ' shops)</td><td></td>' +
        '<td class="num">' + fmt(totals.balance) + '</td><td class="num">' + fmt(totals.credit) + '</td><td></td>' +
        '<td class="num" style="color:var(--red)">' + fmt(totals.cost) + '</td>' +
        '<td class="num" style="color:var(--yellow)">' + fmt(totals.orders) + '</td>' +
        '<td class="num" style="color:var(--green)">' + fmt(totals.gmv) + '</td>' +
        '<td class="num ' + getRoiClass(totals.roi) + '">' + totals.roi + '</td>' +
        '<td class="num">' + fmt(totals.cpo) + '</td>' +
        '<td class="num">' + totals.campaigns + '</td><td></td><td></td>';
    tbody.appendChild(totalTr);
}

function buildRowHTML(aadvid, idx) {
    let shop = shops[aadvid] || {};
    let d = dashGetShopData(aadvid);
    let isLoading = d.status === 'loading';
    let isError = d.status === 'error';

    let billingBadge = d.billingType === 2 ? '<span class="badge badge-postpaid">Trả sau</span>' :
                       d.billingType === 1 ? '<span class="badge badge-prepaid">Trả trước</span>' : '—';
    let statusBadge = isLoading ? '<span class="badge badge-loading">⏳</span>' :
                      isError ? '<span class="badge badge-error">❌</span>' :
                      d.status === 'ok' ? '<span class="badge badge-ok">✅</span>' : '—';

    let thresholdStr = (d.billingType === 2 && d.threshold > 0) ?
        '<span style="color:var(--red)">' + fmtShort(d.thresholdSpent || 0) + '</span>/<span style="color:var(--green)">' + fmtShort(d.threshold) + '</span>' : '—';

    let roi = d.roi || '0';
    let campCount = d.campaignCount || (d.campaigns ? d.campaigns.length : 0);

    let displayName = shop.name || d.shopRealName || d.shop_name || aadvid.slice(-6);
    return '<td style="color:var(--text-dim)">' + idx + '</td>' +
        '<td class="shop-name" style="cursor:pointer" data-action="select">' + displayName + '</td>' +
        '<td>' + billingBadge + '</td>' +
        '<td class="num">' + (d.balance != null ? fmt(d.balance) : '—') + '</td>' +
        '<td class="num">' + (d.credit != null ? fmt(d.credit) : '—') + '</td>' +
        '<td class="num">' + thresholdStr + '</td>' +
        '<td class="num" style="color:var(--red)">' + (d.totalCost != null ? fmt(d.totalCost) : '—') + '</td>' +
        '<td class="num" style="color:var(--yellow)">' + (d.totalOrders != null ? d.totalOrders : '—') + '</td>' +
        '<td class="num" style="color:var(--green)">' + (d.totalGmv != null ? fmt(d.totalGmv) : '—') + '</td>' +
        '<td class="num ' + getRoiClass(roi) + '">' + (d.totalCost != null ? roi : '—') + '</td>' +
        '<td class="num">' + (d.cpo ? fmt(d.cpo) : '—') + '</td>' +
        '<td class="num">' + (campCount || '—') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td><div class="action-cell">' +
            '<button class="btn-icon" data-action="open" title="Truy cập shop">🔑</button>' +
            '<button class="btn-icon" data-action="refresh" title="Refresh">🔄</button>' +
            '<button class="btn-icon danger" data-action="delete" title="Xóa">🗑</button>' +
        '</div></td>';
}

function attachRowListeners(tr, aadvid) {
    let nameCell = tr.querySelector('[data-action="select"]');
    if (nameCell) nameCell.addEventListener('click', () => selectShop(aadvid));
    let openBtn = tr.querySelector('[data-action="open"]');
    if (openBtn) openBtn.addEventListener('click', () => openShopPage(aadvid));
    let refreshBtn = tr.querySelector('[data-action="refresh"]');
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchShopMultiAccount(aadvid));
    let deleteBtn = tr.querySelector('[data-action="delete"]');
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteShop(aadvid));
}

// ===== TOTALS & STATS =====
function calcTotals() {
    let cost = 0, orders = 0, gmv = 0, balance = 0, credit = 0, campaigns = 0;
    let tStrong = 0, tWeak = 0, tFire = 0, tGoodRoi = 0, tLowRoi = 0;
    let listStrong = [], listWeak = [], listFire = [], listGoodRoi = [], listLowRoi = [];

    // STRANGE TTS V30: Dùng Set để tránh tính trùng nếu 1 Seller ID xuất hiện ở nhiều hàng
    const seenSellers = new Set();

    Object.keys(shops).forEach(aadvid => {
        let d = dashGetShopData(aadvid);
        if (!d || d.status !== 'ok') return;
        let shop = shops[aadvid] || {};
        let name = shop.name || aadvid.slice(-6);

        // Khôi phục logic cũ: Cộng dồn trực tiếp tất cả shop dựa trên định danh Ads ID
        cost += Number(d.totalCost) || 0;
        orders += Number(d.totalOrders) || 0;
        gmv += Number(d.totalGmv) || 0;
        balance += Number(d.balance) || 0;
        credit += Number(d.credit) || 0;
        campaigns += Number(d.campaignCount) || 0;
        
        let s = getPerfStats(d.campaigns);
        tStrong += s.strong;
        tWeak += s.weak;
        tFire += s.near_budget;
        tGoodRoi += s.good_roi;
        tLowRoi += s.low_roi;

        if (s.strong > 0) listStrong.push({ name, count: s.strong });
        if (s.weak > 0) listWeak.push({ name, count: s.weak });
        if (s.near_budget > 0) listFire.push({ name, count: s.near_budget });
        if (s.good_roi > 0) listGoodRoi.push({ name, count: s.good_roi });
        if (s.low_roi > 0) listLowRoi.push({ name, count: s.low_roi });
    });
    let roi = cost > 0 ? (gmv / cost).toFixed(2) : '0';
    let cpo = orders > 0 ? Math.round(cost / orders) : 0;
    return { cost, orders, gmv, balance, credit, campaigns, roi, cpo, tStrong, tWeak, tFire, tGoodRoi, tLowRoi, listStrong, listWeak, listFire, listGoodRoi, listLowRoi };
}

function renderAdsDetail(list) {
    if (!list || list.length === 0) return '';
    list.sort((a, b) => b.count - a.count);
    return list.map(item => `<div><span class="list-count">${item.count}</span> ${item.name}</div>`).join('');
}

function updateStats() {
    let t = calcTotals();
    let shopCount = Object.keys(shops).length;
    document.getElementById('stat-shops').textContent = shopCount;
    document.getElementById('stat-cost').textContent = fmtDots(t.cost);
    document.getElementById('stat-orders').textContent = fmtDots(t.orders);
    document.getElementById('stat-gmv').textContent = fmtDots(t.gmv);
    let roiEl = document.getElementById('stat-roi');
    roiEl.textContent = t.roi;
    roiEl.className = 'stat-chip-val ' + getRoiClass(t.roi);
    document.getElementById('stat-cpo').textContent = fmtDots(t.cpo);
    
    // New stats with visible shop details (Sorted descending)
    document.getElementById('stat-total-strong').textContent = t.tStrong;
    document.getElementById('stat-detail-strong').innerHTML = renderAdsDetail(t.listStrong);

    document.getElementById('stat-total-weak').textContent = t.tWeak;
    document.getElementById('stat-detail-weak').innerHTML = renderAdsDetail(t.listWeak);

    document.getElementById('stat-total-fire').textContent = t.tFire;
    document.getElementById('stat-detail-fire').innerHTML = renderAdsDetail(t.listFire);

    document.getElementById('stat-total-good-roi').textContent = t.tGoodRoi;
    document.getElementById('stat-detail-good-roi').innerHTML = renderAdsDetail(t.listGoodRoi);

    document.getElementById('stat-total-low-roi').textContent = t.tLowRoi;
    document.getElementById('stat-detail-low-roi').innerHTML = renderAdsDetail(t.listLowRoi);
}

// ===== STATUS BAR =====
function setStatus(text) {
    document.getElementById('status-text').textContent = text;
    let now = new Date();
    document.getElementById('status-time').textContent =
        now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// ===== EVENT LISTENERS =====

// Sort (table view)
document.querySelector('#shop-table thead').addEventListener('click', (e) => {
    let th = e.target.closest('th');
    if (!th || !th.dataset.col || th.dataset.col === 'index') return;
    if (sortCol === th.dataset.col) sortAsc = !sortAsc;
    else { sortCol = th.dataset.col; sortAsc = false; }
    document.querySelectorAll('#shop-table th').forEach(h => h.classList.remove('sorted'));
    th.classList.add('sorted');
    renderTable();
});

// Drag & Drop
// Drag & Drop
let fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', (e) => {
    importFiles(e.target.files);
    e.target.value = '';
});

// Buttons
// Removed duplicate listener
document.getElementById('btn-refresh')?.addEventListener('click', () => fetchAll());

document.getElementById('btn-export')?.addEventListener('click', () => {
    let dataList = Object.values(shops);
    if (!dataList || dataList.length === 0) return showToast('❌ Không có dữ liệu cấu hình shop để export!');

    // Chuyển đổi dữ liệu PHẲNG (Flatten) thành dạng LỒNG (Nested Standard JSON) cho từng shop
    let nestedList = dataList.map(s => {
        return {
            version: s.version || '42',
            exportedAt: s.exportedAt || new Date().toISOString(),
            shop: {
                name: s.name || '',
                aadvid: s.aadvid || '',
                oec_seller_id: s.oec_seller_id || '',
                seller_id: s.seller_id || '',
                bc_id: s.bc_id || '',
                uid: s.uid || '',
                // Inlcude metrics in nested shop object if they were part of the flattened structure
                totalCost: s.totalCost,
                totalGmv: s.totalGmv,
                totalOrders: s.totalOrders,
                roi: s.roi,
                cpo: s.cpo,
                balance: s.balance,
                credit: s.credit,
                threshold: s.threshold
            },
            cookies: s.cookies || []
        };
    });

    let blob = new Blob([JSON.stringify(nestedList, null, 2)], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `strangetts_all_shops_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('📤 Đã export ' + nestedList.length + ' shop thành công!');
});

// Open Seller button
document.getElementById('btn-open-seller')?.addEventListener('click', async () => {
    const targetUrl = buildSellerAdsDashboardUrl();
    try {
        showToast('Đang mở Seller Ads bằng profile Strange TTS...');
        await openIsolatedShopPage('manual-seller', {
            shopOverride: {
                name: 'Seller Ads',
                shopRealName: 'Seller Ads',
                local_key: 'manual-seller',
                cookies: []
            },
            targetUrl,
            pageType: 'seller'
        });
    } catch (error) {
        showToast(`Không mở được Seller Ads: ${error.message}`);
    }
});

// View toggle
document.getElementById('btn-view-cards')?.addEventListener('click', () => {
    applyDashboardLayout('cards');
    chrome.storage.local.set({ [UI_LAYOUT_KEY]: 'cards' });
    renderAll();
});
document.getElementById('btn-view-table')?.addEventListener('click', () => {
    applyDashboardLayout('table');
    chrome.storage.local.set({ [UI_LAYOUT_KEY]: 'table' });
    renderAll();
});

// Campaign panel close & refresh
document.getElementById('camp-panel-close')?.addEventListener('click', () => closeCampPanel());
document.getElementById('camp-panel-refresh')?.addEventListener('click', () => {
    if (activeShop) fetchShop(activeShop);
});

// ===== AUTO-REFRESH =====
let autoRefreshMinutes = 0; // Mặc định TẮT — tránh nhảy shop khi inject cookie
function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (autoRefreshMinutes <= 0) return;
    refreshTimer = setInterval(() => {
        if (Object.keys(shops).length > 0) {
            console.log(`[Dashboard] Auto-refreshing (${autoRefreshMinutes}m)...`);
            fetchAll();
        }
    }, autoRefreshMinutes * 60 * 1000);
}

document.getElementById('sel-auto-refresh')?.addEventListener('change', (e) => {
    autoRefreshMinutes = parseInt(e.target.value) || 0;
    startAutoRefresh();
    if (autoRefreshMinutes > 0) {
        showToast(`✅ Đã bật Tự động tải lại: ${autoRefreshMinutes} phút`);
    } else {
        showToast('⏸ Đã tắt tự động tải lại');
    }
});

// ===== INIT =====
loadShops(() => {
    renderAll();
    setStatus('Sẵn sàng — ' + Object.keys(shops).length + ' shops — Bấm 🔄 để tải dữ liệu');

    // AUTO-FETCH TẮT mặc định: tránh inject cookie làm nhảy shop trên trang seller
    // Người dùng BẤM NÚT REFRESH để load thủ công
    // startAutoRefresh() cũng không chạy vì autoRefreshMinutes = 0

    // Auto-switch sang tab Report nếu URL có ?tab=report
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab');
    if (['report', 'shop-overview', 'business-analysis', 'tiktok-crawler', 'business-plan', 'admin'].includes(initialTab)) {
        switchMainTab(initialTab);
    }
});

// ══════════════════════════════════════════════
// Strange TTS Solution & CRM TT AI TAB SWITCHING SYSTEM
// ══════════════════════════════════════════════
// Listener cho tin nhắn từ Extension Popup (SSO/Auth)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'STRANGETTS_AUTH_UPDATED') {
        console.log('[DASH] 🔐 Auth updated, refreshing dashboard UI...');
        initDashAuth(); // Re-run auth check and hide overlay
    }
});

const TTS_PC_API_BASE = 'http://127.0.0.1:48731';

function crawlerMoney(value) {
    return Math.round(Number(value || 0)).toLocaleString('vi-VN');
}

function crawlerPct(value) {
    const n = Number(value || 0);
    return `${(n * 100).toFixed(1)}%`;
}

function crawlerEscape(value) {
    return String(value || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

async function crawlerApi(path, options = {}) {
    const res = await fetch(`${TTS_PC_API_BASE}${path}`, {
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'PC app API error');
    return data;
}

function renderTikTokCrawlerDbLegacy(database = {}) {
    const target = document.getElementById('tts-crawler-output');
    if (!target) return;
    const months = Object.keys(database.months || {}).sort();
    const activeMonth = months.at(-1);
    const month = activeMonth ? database.months[activeMonth] : null;
    const aggregate = month?.aggregate?.[0];
    const previousMonth = months[months.length - 2];
    const previous = previousMonth ? database.months[previousMonth]?.aggregate?.[0] : null;
    if (!aggregate) {
        target.innerHTML = '<div class="business-empty">Chưa có DB crawler. Bấm Crawl 04-05 để tạo dữ liệu.</div>';
        return;
    }
    const growth = previous?.totalGmv ? (aggregate.totalGmv - previous.totalGmv) / previous.totalGmv : 0;
    const affiliateShare = aggregate.totalGmv ? aggregate.affiliateTotalGmv / aggregate.totalGmv : 0;
    const videoShare = aggregate.totalGmv ? aggregate.contentVideoGmv / aggregate.totalGmv : 0;
    const rows = (month.daily || []).map(row => `
        <tr>
            <td>${crawlerEscape(row.startDate)}</td>
            <td>${crawlerMoney(row.totalGmv)}</td>
            <td>${crawlerMoney(row.contentVideoGmv)}</td>
            <td>${crawlerMoney(row.contentProductCardGmv)}</td>
            <td>${crawlerMoney(row.affiliateTotalGmv)}</td>
            <td>${crawlerMoney(row.affiliateVideoGmv)}</td>
            <td>${crawlerMoney(row.affiliateVideoDirectGmv)}</td>
            <td>${crawlerMoney(row.affiliateVideoIndirectGmv)}</td>
            <td>${crawlerMoney(row.rawFieldCount)}</td>
        </tr>
    `).join('');
    target.innerHTML = `
        <div class="business-kpi-grid">
            <div class="business-kpi"><strong>${crawlerMoney(aggregate.totalGmv)}</strong><span>GMV ${crawlerEscape(activeMonth)}</span></div>
            <div class="business-kpi"><strong>${previous ? crawlerPct(growth) : '-'}</strong><span>Tăng trưởng so với ${crawlerEscape(previousMonth || '')}</span></div>
            <div class="business-kpi"><strong>${crawlerPct(affiliateShare)}</strong><span>Tỷ trọng liên kết</span></div>
            <div class="business-kpi"><strong>${crawlerPct(videoShare)}</strong><span>Tỷ trọng video</span></div>
            <div class="business-kpi"><strong>${crawlerMoney(month.daily?.length || 0)}</strong><span>Dòng daily</span></div>
        </div>
        <div class="business-table-wrap">
            <table class="business-table">
                <thead><tr><th>Ngày</th><th>GMV</th><th>Video</th><th>Thẻ SP</th><th>Liên kết</th><th>LK Video</th><th>Trực tiếp</th><th>Gián tiếp</th><th>Raw</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

async function loadTikTokCrawlerDbLegacy() {
    const shopId = document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion';
    const target = document.getElementById('tts-crawler-output');
    if (target) target.innerHTML = '<div class="business-empty">Đang tải DB crawler...</div>';
    try {
        const data = await crawlerApi(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`);
        renderTikTokCrawlerDbLegacy(data.database);
    } catch (error) {
        if (target) target.innerHTML = `<div class="business-empty">Không đọc được PC app API: ${crawlerEscape(error.message)}</div>`;
    }
}

async function runTikTokCrawlerFromDashboardLegacy() {
    const target = document.getElementById('tts-crawler-output');
    const button = document.getElementById('tts-crawler-run');
    if (target) target.innerHTML = '<div class="business-empty">Đang crawl TikTok Compass, vui lòng chờ...</div>';
    if (button) button.disabled = true;
    try {
        const body = {
            shopId: document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion',
            sellerId: document.getElementById('tts-crawler-seller-id')?.value || '7494478078863902049',
            cdpPort: Number(document.getElementById('tts-crawler-cdp-port')?.value || 58849),
            months: String(document.getElementById('tts-crawler-months')?.value || '2026-04,2026-05').split(',').map(item => item.trim()).filter(Boolean)
        };
        await crawlerApi('/api/tiktokshop-crawler/crawl', { method: 'POST', body });
        await loadTikTokCrawlerDbLegacy();
    } catch (error) {
        if (target) target.innerHTML = `<div class="business-empty">Lỗi crawl: ${crawlerEscape(error.message)}</div>`;
    } finally {
        if (button) button.disabled = false;
    }
}

function renderTikTokCrawlerDbFriendly(database = {}, sellerCenter = {}) {
    const target = document.getElementById('tts-crawler-output');
    if (!target) return;
    const months = Object.keys(database.months || {}).sort();
    const activeMonth = months.at(-1);
    const month = activeMonth ? database.months[activeMonth] : null;
    const aggregate = month?.aggregate?.[0];
    const modules = Array.isArray(sellerCenter.modules) ? sellerCenter.modules : [];
    const okModules = modules.filter(item => item.status === 'ok' || item.status === 'done').length;
    const totalRows = Number(sellerCenter.summary?.normalizedRows || 0);
    const moduleRows = modules.map(item => `
        <tr>
            <td>${crawlerEscape(item.name)}</td>
            <td>${crawlerEscape(item.status || 'unknown')}</td>
            <td class="num">${crawlerMoney(item.apiCount)}</td>
            <td class="num">${crawlerMoney(item.exportCount)}</td>
            <td class="num">${crawlerMoney(item.rowCount)}</td>
            <td>${crawlerEscape(item.notes || '')}</td>
        </tr>
    `).join('');
    const dailyRows = (month?.daily || []).map(row => `
        <tr>
            <td>${crawlerEscape(row.startDate)}</td>
            <td class="num">${crawlerMoney(row.totalGmv)}</td>
            <td class="num">${crawlerMoney(row.contentVideoGmv)}</td>
            <td class="num">${crawlerMoney(row.contentProductCardGmv)}</td>
            <td class="num">${crawlerMoney(row.affiliateTotalGmv)}</td>
            <td class="num">${crawlerMoney(row.affiliateVideoGmv)}</td>
            <td class="num">${crawlerMoney(row.rawFieldCount)}</td>
        </tr>
    `).join('');
    const productModule = modules.find(item => /sản phẩm|product/i.test(item.name || ''));
    const analyticsModule = modules.find(item => /số liệu|analytics|compass/i.test(item.name || ''));
    const accountModule = modules.find(item => /tài khoản|account/i.test(item.name || ''));
    const marketingModule = modules.find(item => /marketing|chiến dịch|campaign/i.test(item.name || ''));

    target.innerHTML = `
        <section class="ux-card ux-crawler-status">
            <div>
                <span class="business-kicker">Trạng thái thu thập</span>
                <h3>${sellerCenter.runId ? 'Đã có dữ liệu Seller Center' : 'Chưa có dữ liệu Seller Center'}</h3>
                <p>${sellerCenter.runId ? `Run ${crawlerEscape(sellerCenter.runId)} · ${crawlerEscape(sellerCenter.outputDir || '')}` : 'Bấm “Lấy dữ liệu ngay” để tạo bộ dữ liệu mới theo cookie hiện tại.'}</p>
            </div>
            <span class="ux-status-pill ${sellerCenter.ok ? 'ok' : 'warn'}">${sellerCenter.ok ? 'Sẵn sàng' : 'Cần crawl'}</span>
        </section>
        <section class="ux-card">
            <div class="business-section-title">
                <strong>Tổng quan dữ liệu đã lấy</strong>
                <span>Ưu tiên raw JSON/CSV trước, sau đó mới chuẩn hóa để dùng cho phân tích.</span>
            </div>
            <div class="ux-kpi-summary">
                ${uxMetricCard({ label: 'API đã bắt', value: sellerCenter.summary?.apiEndpoints, tone: 'success', tooltip: 'Số endpoint Network nhận diện được trong phiên crawl.' })}
                ${uxMetricCard({ label: 'File raw', value: sellerCenter.summary?.rawFiles, tone: 'neutral', tooltip: 'Số file JSON/CSV thô đã lưu.' })}
                ${uxMetricCard({ label: 'Dòng chuẩn hóa', value: totalRows, tone: 'success', tooltip: 'Số dòng dữ liệu đã normalize để dashboard đọc được.' })}
                ${uxMetricCard({ label: 'Module hoàn tất', value: `${okModules}/${modules.length || 0}`, format: 'text', tone: okModules === modules.length && modules.length ? 'success' : 'warning', tooltip: 'Số module đã crawl thành công.' })}
                ${uxMetricCard({ label: `GMV ${activeMonth || ''}`, value: aggregate?.totalGmv, tone: 'success', tooltip: 'GMV từ dữ liệu Compass/tháng gần nhất trong DB.' })}
                ${uxMetricCard({ label: 'Ngày trong DB', value: month?.daily?.length || 0, tone: 'neutral', tooltip: 'Số dòng daily đang có trong DB crawler.' })}
            </div>
        </section>
        <div class="ux-data-groups">
            ${uxMetricCard({ label: 'Sản phẩm', value: productModule?.rowCount, tone: productModule ? 'success' : 'warning', description: productModule ? `${crawlerMoney(productModule.apiCount)} API` : 'Chưa có module' })}
            ${uxMetricCard({ label: 'Marketing', value: marketingModule?.rowCount, tone: marketingModule ? 'success' : 'warning', description: marketingModule ? `${crawlerMoney(marketingModule.apiCount)} API` : 'Chưa có module' })}
            ${uxMetricCard({ label: 'Số liệu phân tích', value: analyticsModule?.rowCount, tone: analyticsModule ? 'success' : 'warning', description: analyticsModule ? `${crawlerMoney(analyticsModule.apiCount)} API` : 'Chưa có module' })}
            ${uxMetricCard({ label: 'Tài khoản', value: accountModule?.rowCount, tone: accountModule ? 'success' : 'warning', description: accountModule ? `${crawlerMoney(accountModule.apiCount)} API` : 'Chưa có module' })}
        </div>
        <section class="ux-card">
            <div class="business-section-title">
                <strong>Dữ liệu Compass theo ngày</strong>
                <span>Dùng để đối chiếu nhanh GMV, video, thẻ sản phẩm và liên kết.</span>
            </div>
            <div class="business-table-wrap">
                <table class="business-table">
                    <thead><tr><th>Ngày</th><th>GMV</th><th>Video</th><th>Thẻ SP</th><th>Liên kết</th><th>LK Video</th><th>Raw</th></tr></thead>
                    <tbody>${dailyRows || '<tr><td colspan="7">Chưa có dữ liệu Compass.</td></tr>'}</tbody>
                </table>
            </div>
        </section>
        <details class="business-card ux-advanced-only">
            <summary>Nhật ký kỹ thuật theo module</summary>
            <div class="business-table-wrap">
                <table class="business-table">
                    <thead><tr><th>Module</th><th>Trạng thái</th><th>API</th><th>Export</th><th>Dòng</th><th>Ghi chú</th></tr></thead>
                    <tbody>${moduleRows || '<tr><td colspan="6">Chưa có report module.</td></tr>'}</tbody>
                </table>
            </div>
        </details>
    `;
}

function renderTikTokCrawlerDb(database = {}, sellerCenter = {}) {
    return renderTikTokCrawlerDbFriendly(database, sellerCenter);
    const target = document.getElementById('tts-crawler-output');
    if (!target) return;
    const months = Object.keys(database.months || {}).sort();
    const activeMonth = months.at(-1);
    const month = activeMonth ? database.months[activeMonth] : null;
    const aggregate = month?.aggregate?.[0];
    const moduleRows = (sellerCenter.modules || []).map(item => `
        <tr>
            <td>${crawlerEscape(item.name)}</td>
            <td>${crawlerEscape(item.status)}</td>
            <td>${crawlerMoney(item.apiCount)}</td>
            <td>${crawlerMoney(item.exportCount)}</td>
            <td>${crawlerMoney(item.rowCount)}</td>
            <td>${crawlerEscape(item.notes || '')}</td>
        </tr>
    `).join('');
    const unresolvedRows = (sellerCenter.unresolved || []).map(item => `
        <tr>
            <td>${crawlerEscape(item.module)}</td>
            <td colspan="5">${crawlerEscape(item.reason || '')}</td>
        </tr>
    `).join('');
    const dailyRows = (month?.daily || []).map(row => `
        <tr>
            <td>${crawlerEscape(row.startDate)}</td>
            <td>${crawlerMoney(row.totalGmv)}</td>
            <td>${crawlerMoney(row.contentVideoGmv)}</td>
            <td>${crawlerMoney(row.contentProductCardGmv)}</td>
            <td>${crawlerMoney(row.affiliateTotalGmv)}</td>
            <td>${crawlerMoney(row.affiliateVideoGmv)}</td>
            <td>${crawlerMoney(row.rawFieldCount)}</td>
        </tr>
    `).join('');
    target.innerHTML = `
        <div class="business-kpi-grid">
            <div class="business-kpi"><strong>${crawlerMoney(sellerCenter.summary?.apiEndpoints)}</strong><span>API Seller Center</span></div>
            <div class="business-kpi"><strong>${crawlerMoney(sellerCenter.summary?.rawFiles)}</strong><span>Raw files</span></div>
            <div class="business-kpi"><strong>${crawlerMoney(sellerCenter.summary?.exportRequests)}</strong><span>Lệnh export</span></div>
            <div class="business-kpi"><strong>${crawlerMoney(sellerCenter.summary?.normalizedRows)}</strong><span>Dòng normalize</span></div>
            <div class="business-kpi"><strong>${aggregate ? crawlerMoney(aggregate.totalGmv) : '-'}</strong><span>GMV ${crawlerEscape(activeMonth || '')}</span></div>
        </div>
        <div class="business-empty">${sellerCenter.runId ? `Seller Center ${crawlerEscape(sellerCenter.status || (sellerCenter.ok ? 'done' : 'unknown'))}: ${crawlerEscape(sellerCenter.runId)} | ${crawlerEscape(sellerCenter.outputDir || '')}` : 'Chưa có crawl Seller Center.'}</div>
        <div class="business-table-wrap">
            <table class="business-table">
                <thead><tr><th>Module</th><th>Trạng thái</th><th>API</th><th>Export</th><th>Dòng</th><th>Ghi chú</th></tr></thead>
                <tbody>${moduleRows || unresolvedRows || '<tr><td colspan="6">Chưa có report.</td></tr>'}</tbody>
            </table>
        </div>
        <div class="business-table-wrap">
            <table class="business-table">
                <thead><tr><th>Ngày</th><th>GMV</th><th>Video</th><th>Thẻ SP</th><th>Liên kết</th><th>LK Video</th><th>Raw</th></tr></thead>
                <tbody>${dailyRows || '<tr><td colspan="7">Chưa có dữ liệu Compass.</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

async function loadTikTokCrawlerDb() {
    const shopId = document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion';
    const target = document.getElementById('tts-crawler-output');
    if (target) target.innerHTML = '<div class="business-empty">Đang tải DB crawler...</div>';
    try {
        const data = await crawlerApi(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(shopId)}`);
        renderTikTokCrawlerDb(data.database, data.sellerCenter);
    } catch (error) {
        if (target) target.innerHTML = `<div class="business-empty">Không đọc được PC app API: ${crawlerEscape(error.message)}</div>`;
    }
}

async function runTikTokCrawlerFromDashboard(event) {
    const target = document.getElementById('tts-crawler-output');
    const button = event?.currentTarget || document.getElementById('tts-crawler-run');
    const mode = button?.dataset?.mode || 'compass';
    if (target) target.innerHTML = `<div class="business-empty">Đang crawl ${mode === 'seller-center' ? 'Seller Center full' : 'Compass'}, vui lòng chờ...</div>`;
    if (button) button.disabled = true;
    try {
        const body = {
            mode,
            shopId: document.getElementById('tts-crawler-shop-id')?.value || 'little-apricot-hawaii-fashion',
            sellerId: document.getElementById('tts-crawler-seller-id')?.value || '7494478078863902049',
            cdpPort: Number(document.getElementById('tts-crawler-cdp-port')?.value || 58849),
            baseUrl: document.getElementById('tts-crawler-base-url')?.value || 'https://seller-vn.tiktok.com/homepage?shop_region=VN',
            months: String(document.getElementById('tts-crawler-months')?.value || '2026-04,2026-05').split(',').map(item => item.trim()).filter(Boolean),
            dateRange: 'yesterday',
            maxModules: Number(document.getElementById('tts-crawler-max-modules')?.value || 0),
            force: true
        };
        const beforeDb = mode === 'seller-center'
            ? await crawlerApi(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(body.shopId)}`).catch(() => ({}))
            : {};
        const previousRunId = beforeDb?.sellerCenter?.runId || '';
        await crawlerApi('/api/tiktokshop-crawler/crawl', { method: 'POST', body });
        if (mode === 'seller-center') {
            let freshRunSeen = false;
            for (let i = 0; i < 60; i += 1) {
                await new Promise(resolve => setTimeout(resolve, i < 3 ? 1600 : 3000));
                const data = await crawlerApi(`/api/tiktokshop-crawler/db?shopId=${encodeURIComponent(body.shopId)}`);
                const latest = data.sellerCenter;
                freshRunSeen = Boolean(latest?.runId && latest.runId !== previousRunId);
                if (target) target.innerHTML = `<div class="business-empty">Seller Center: ${freshRunSeen ? 'đã có run mới' : 'đang chờ run mới'}${latest?.runId ? ` | ${crawlerEscape(latest.runId)}` : ''}</div>`;
                if (freshRunSeen && latest?.status && latest.status !== 'running') break;
            }
            if (!freshRunSeen) throw new Error('Crawler chưa ghi run mới. Kiểm tra CDP port/cookie hoặc trang Seller Center đang mở.');
        }
        await loadTikTokCrawlerDb();
    } catch (error) {
        if (target) target.innerHTML = `<div class="business-empty">Lỗi crawl: ${crawlerEscape(error.message)}</div>`;
    } finally {
        if (button) button.disabled = false;
    }
}

function switchMainTab(tabName) {
    console.log('[Dashboard] Switching to tab:', tabName);
    const panels = {
        'main': document.getElementById('panel-main'),
        'shop-overview': document.getElementById('panel-shop-overview'),
        'report': document.getElementById('panel-report'),
        'tiktok-crawler': document.getElementById('panel-tiktok-crawler'),
        'business-analysis': document.getElementById('panel-business-analysis'),
        'business-plan': document.getElementById('panel-business-plan'),
        'admin': document.getElementById('panel-admin')
    };
    const buttons = {
        'main': document.getElementById('tab-btn-main'),
        'shop-overview': document.getElementById('tab-btn-shop-overview'),
        'report': document.getElementById('tab-btn-report'),
        'tiktok-crawler': document.getElementById('tab-btn-tiktok-crawler'),
        'business-analysis': document.getElementById('tab-btn-business-analysis'),
        'business-plan': document.getElementById('tab-btn-business-plan'),
        'admin': document.getElementById('tab-btn-admin')
    };

    // Hide all panels, deactivate all buttons
    Object.values(panels).forEach(p => { if (p) p.style.display = 'none'; });
    Object.values(buttons).forEach(b => { if (b) b.classList.remove('active'); });

    // Show active
    if (panels[tabName]) panels[tabName].style.display = 'block';
    if (buttons[tabName]) buttons[tabName].classList.add('active');
    if (tabName === 'shop-overview') loadShopOverviewDashboard();
    if (tabName === 'business-plan') businessRenderPlanPanel();
    if (tabName === 'tiktok-crawler') loadTikTokCrawlerDb();

    // Show/hide search bar chỉ ở tab report
    const searchWrap = document.getElementById('rp-search-wrap');
    if (searchWrap) {
        if (tabName === 'report') {
            searchWrap.style.display = 'flex';
            // Cập nhật count khi vào tab
            setTimeout(() => {
                const cards = document.querySelectorAll('#rp-shop-list .shop-card');
                const countEl = document.getElementById('rp-search-count');
                if (countEl && cards.length) countEl.textContent = cards.length + ' shop';
            }, 200);
        } else {
            searchWrap.style.display = 'none';
            // Reset search khi rời tab
            const inp = document.getElementById('rp-shop-search');
            if (inp) { inp.value = ''; if (typeof rpFilterShops === 'function') rpFilterShops(''); }
        }
    }
}

document.getElementById('tab-btn-main')?.addEventListener('click', () => switchMainTab('main'));
document.getElementById('tab-btn-shop-overview')?.addEventListener('click', () => switchMainTab('shop-overview'));
document.getElementById('tab-btn-report')?.addEventListener('click', () => switchMainTab('report'));
document.getElementById('tab-btn-tiktok-crawler')?.addEventListener('click', () => switchMainTab('tiktok-crawler'));
document.getElementById('tab-btn-business-analysis')?.addEventListener('click', () => switchMainTab('business-analysis'));
document.getElementById('tab-btn-business-plan')?.addEventListener('click', () => switchMainTab('business-plan'));
document.getElementById('tab-btn-admin')?.addEventListener('click', () => {
    switchMainTab('admin');
    fetchAdminUserList();
});
initBusinessDashboardTools();
initShopOverviewDashboard();
document.getElementById('tts-crawler-reload')?.addEventListener('click', loadTikTokCrawlerDb);
document.getElementById('tts-crawler-run')?.addEventListener('click', runTikTokCrawlerFromDashboard);
document.getElementById('tts-crawler-seller-center-run')?.addEventListener('click', runTikTokCrawlerFromDashboard);

// Admin Tab Listeners
document.getElementById('btn-admin-refresh-users')?.addEventListener('click', fetchAdminUserList);
document.getElementById('btn-admin-add-user-toggle')?.addEventListener('click', () => {
    // Ported from login.js modal but into a strangettsModal for better UX
    strangettsModal({
        title: 'Thêm User Mới',
        body: 'Chỉ admin được tạo tài khoản Strange TTS mới trực tiếp vào hệ thống.',
        inputPlaceholder: 'Nhập username...',
        confirmText: 'Tiếp tục',
        onConfirm: (un) => {
            if (!un) return;
            strangettsModal({
                title: 'Mật khẩu & Quyền',
                body: `Cài đặt mật khẩu cho user: ${un}`,
                inputPlaceholder: 'Nhập mật khẩu...',
                onConfirm: (pw) => {
                    if (!pw) return;
                    // Phân quyền: Mặc định user, cho phép chọn admin
                    strangettsModal({
                        title: 'Chọn Phân Quyền',
                        body: `Chọn vai trò cho tài khoản ${un}:`,
                        confirmText: 'User (Mặc định)',
                        cancelText: 'Admin',
                        onConfirm: () => doAdminAddUser(un, pw, 'user'),
                        onCancel: () => doAdminAddUser(un, pw, 'admin')
                    });
                }
            });
        }
    });
});

// Nút Refresh All thủ công
document.getElementById('btn-refresh')?.addEventListener('click', () => {
    console.log('[Dashboard] Manual Refresh All triggered');
    fetchAll();
});

// ===== SORTING FUNCTIONS (DASHBOARD) =====
function dashGetShopData(key) {
    const shop = shops[key] || {};
    const dataKey = dashGetShopDataKey(key, shop);
    const aadvid = shop.aadvid || key;
    if (shopData[dataKey]) return shopData[dataKey];
    if (shopData[key]) return shopData[key];
    if (shopData[shop.oec_seller_id]) return shopData[shop.oec_seller_id];
    if (shopData[shop.seller_id]) return shopData[shop.seller_id];
    if (!dashAadvidIsShared(aadvid, key) && shopData[aadvid]) return shopData[aadvid];
    return {};
}

function dashGetShopMetrics(key) {
    const shop = shops[key] || {};
    const d = dashGetShopData(key);
    const cost = Number(d.totalCost) || 0;
    const gmv = Number(d.totalGmv) || 0;
    const orders = Number(d.totalOrders) || 0;
    const roi = Number(d.roi) || (cost > 0 ? gmv / cost : 0);
    const fetchedAt = Number(d.fetchedAt) || 0;
    const activeScore = (cost > 0 ? 1 : 0) * 1e12 + gmv * 10 + orders * 100000 + roi * 1000 + fetchedAt / 1e9;
    return {
        name: (shop.shopRealName || shop.name || key || '').toLowerCase(),
        hasData: d.status === 'ok',
        billingType: Number(d.billingType) || 0,
        balance: Number(d.balance) || 0,
        credit: Number(d.credit) || 0,
        threshold: Number(d.threshold) || 0,
        totalCost: cost,
        totalGmv: gmv,
        totalOrders: orders,
        roi,
        cpo: orders > 0 ? Math.round(cost / orders) : 0,
        active: activeScore
    };
}

function dashCompareByCurrentSort(a, b) {
    let mA = dashGetShopMetrics(a);
    let mB = dashGetShopMetrics(b);
    let criteria = currentDashSort || 'name';
    if (criteria === 'name') return mA.name.localeCompare(mB.name, 'vi');
    if (mA.hasData !== mB.hasData) return mA.hasData ? -1 : 1;
    if (!mA.hasData && !mB.hasData) return mA.name.localeCompare(mB.name, 'vi');
    if (criteria === 'active') return mB.active - mA.active || mA.name.localeCompare(mB.name, 'vi');
    if (criteria === 'gmv') return mB.totalGmv - mA.totalGmv || mA.name.localeCompare(mB.name, 'vi');
    if (criteria === 'roi') return mB.roi - mA.roi || mB.totalGmv - mA.totalGmv || mA.name.localeCompare(mB.name, 'vi');
    if (criteria === 'orders') return mB.totalOrders - mA.totalOrders || mB.totalGmv - mA.totalGmv || mA.name.localeCompare(mB.name, 'vi');
    return mA.name.localeCompare(mB.name, 'vi');
}

function dashSortBy(criteria) {
    console.log(`[Dashboard] Sorting by ${criteria}...`);
    currentDashSort = criteria;
    // Toggle active class on buttons
    ['name', 'active', 'gmv', 'roi', 'orders'].forEach(c => {
        document.getElementById(`btn-sort-${c}`)?.classList.toggle('active', c === criteria);
    });

    renderAll();
}

document.getElementById('btn-sort-name')?.addEventListener('click', () => dashSortBy('name'));
document.getElementById('btn-sort-active')?.addEventListener('click', () => dashSortBy('active'));
document.getElementById('btn-sort-activity')?.addEventListener('click', () => dashSortBy('active'));
document.getElementById('btn-sort-gmv')?.addEventListener('click', () => dashSortBy('gmv'));
document.getElementById('btn-sort-roi')?.addEventListener('click', () => dashSortBy('roi'));
document.getElementById('btn-sort-orders')?.addEventListener('click', () => dashSortBy('orders'));

// ===== SORTING FUNCTIONS (REPORT TAB) =====
let currentRpSort = 'name';
function rpSortBy(criteria) {
    console.log(`[Report] Sorting by ${criteria}...`);
    currentRpSort = criteria;
    // Toggle active class
    ['name', 'active', 'gmv', 'roi', 'orders'].forEach(c => {
        document.getElementById(`btn-rp-sort-${c}`)?.classList.toggle('active', c === criteria);
    });
    if (typeof renderReportShopList === 'function') renderReportShopList();
}

document.getElementById('btn-rp-sort-name')?.addEventListener('click', () => rpSortBy('name'));
document.getElementById('btn-rp-sort-active')?.addEventListener('click', () => rpSortBy('active'));
document.getElementById('btn-rp-sort-gmv')?.addEventListener('click', () => rpSortBy('gmv'));
document.getElementById('btn-rp-sort-roi')?.addEventListener('click', () => rpSortBy('roi'));
document.getElementById('btn-rp-sort-orders')?.addEventListener('click', () => rpSortBy('orders'));

function initializeDefaultURLs() {
    const defaultSheetURL = 'https://docs.google.com/spreadsheets/d/';
    const defaultTelegramURL = 'https://t.me/';
    const defaultZaloURL = 'https://zalo.me/';

    const elSheet = document.getElementById('sheet-url');
    const elTg = document.getElementById('telegram-url');
    const elZalo = document.getElementById('zalo-url');

    if (elSheet) elSheet.value = defaultSheetURL;
    if (elTg) elTg.value = defaultTelegramURL;
    if (elZalo) elZalo.value = defaultZaloURL;

    console.log('Default URLs initialization check complete.');
}

// --- ALERT SETTINGS LOGIC ---
async function openAlertSettingsModal() {
    const modal = document.getElementById('modal-alert-settings');
    if (!modal) return;

    // Load current config from storage to ensure we have latest
    const store = await chrome.storage.local.get([STORAGE_ALERT_CONFIG, STORAGE_QUICK_RECAP_LAST]);
    const savedAlert = store[STORAGE_ALERT_CONFIG] || {};

    alertConfig = { ...alertConfig, ...savedAlert };

    // Set UI values
    document.getElementById('alert-recap-enabled').checked = !!alertConfig.recapEnabled;
    document.getElementById('alert-recap-times').value = normalizeRecapTimes(alertConfig.recapTimes || '11:45, 23:15');
    document.getElementById('alert-tg-token').value = alertConfig.tgToken || '';
    document.getElementById('alert-tg-chatid').value = alertConfig.tgChatId || '';
    document.getElementById('alert-tg-chatid2').value = alertConfig.tgChatId2 || '';
    document.getElementById('alert-zalo-server').value = alertConfig.zaloServer || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
    document.getElementById('alert-zalo-user').value = alertConfig.zaloUser || '';
    document.getElementById('alert-zalo-group').value = alertConfig.zaloGroup || '';
    renderQuickRecapLastState(store[STORAGE_QUICK_RECAP_LAST]);

    modal.style.display = 'flex';
}

async function saveAlertSettings() {
    const recapTimes = normalizeRecapTimes(document.getElementById('alert-recap-times').value.trim());
    alertConfig = {
        ...alertConfig,
        recapEnabled: document.getElementById('alert-recap-enabled').checked,
        recapTimes,
        tgToken: document.getElementById('alert-tg-token').value.trim(),
        tgChatId: document.getElementById('alert-tg-chatid').value.trim(),
        tgChatId2: document.getElementById('alert-tg-chatid2').value.trim(),
        zaloServer: document.getElementById('alert-zalo-server').value.trim() || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788',
        zaloUser: document.getElementById('alert-zalo-user').value.trim(),
        zaloGroup: document.getElementById('alert-zalo-group').value.trim()
    };

    await chrome.storage.local.set({ [STORAGE_ALERT_CONFIG]: alertConfig });
    document.getElementById('modal-alert-settings').style.display = 'none';
    showToast('✅ Đã lưu cấu hình hạ tầng thông báo!');
}

async function sendQuickRecapNowFromDashboard() {
    const recapTimes = normalizeRecapTimes(document.getElementById('alert-recap-times')?.value || alertConfig.recapTimes || '');
    alertConfig = {
        ...alertConfig,
        recapEnabled: document.getElementById('alert-recap-enabled')?.checked || false,
        recapTimes,
        tgToken: document.getElementById('alert-tg-token')?.value.trim() || '',
        tgChatId: document.getElementById('alert-tg-chatid')?.value.trim() || '',
        tgChatId2: document.getElementById('alert-tg-chatid2')?.value.trim() || '',
        zaloServer: document.getElementById('alert-zalo-server')?.value.trim() || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788',
        zaloUser: document.getElementById('alert-zalo-user')?.value.trim() || '',
        zaloGroup: document.getElementById('alert-zalo-group')?.value.trim() || ''
    };
    await chrome.storage.local.set({ [STORAGE_ALERT_CONFIG]: alertConfig });

    showToast('⏳ Đang gửi quick recap...');
    chrome.runtime.sendMessage({ action: 'send_quick_recap_now' }, (response) => {
        if (chrome.runtime.lastError) {
            showToast(`❌ Lỗi: ${chrome.runtime.lastError.message}`);
            return;
        }
        if (response?.ok) {
            const channelWarn = [];
            if (!response.telegram && response.telegramError && response.telegramError !== 'Thiếu Telegram recap') {
                channelWarn.push(`TG lỗi: ${response.telegramError}`);
            }
            if (!response.zalo && response.zaloError && response.zaloError !== 'Thiếu Zalo recap') {
                channelWarn.push(`Zalo lỗi: ${response.zaloError}`);
            }
            if (channelWarn.length) {
                showToast(`⚠️ Recap có kênh lỗi: ${channelWarn.join(' | ')}`);
            } else {
                showToast(response.partial
                    ? `⚠️ Recap đã gửi, còn lỗi ${response.failedShops || 0} shop`
                    : `✅ Recap OK: ${response.sentShops || 0} shop`);
            }
        } else {
            showToast(`⚠️ ${response?.error || 'Không gửi được quick recap'}`);
        }
        chrome.storage.local.get(STORAGE_QUICK_RECAP_LAST, (data) => {
            renderQuickRecapLastState(data[STORAGE_QUICK_RECAP_LAST]);
        });
    });
}

window.onload = function() {
    initializeDefaultURLs();
};
// ══════════════════════════════════════════════
// Strange TTS Solution & CRM TT AI — QUẢN LÝ SHOP & SYNC CLOUD
// ══════════════════════════════════════════════

// 1. Quản lý hiển thị Shop
function openManageShopsModal() {
    const modal = document.getElementById('modal-manage-shops');
    const container = document.getElementById('manage-shops-list');
    if (!modal || !container) return;

    container.innerHTML = shopOrder.map(key => {
        const s = shops[key];
        if (!s) return '';
        return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(92,96,102,0.3);border-radius:10px;">
                <label style="flex:1;display:flex;align-items:center;gap:12px;cursor:pointer">
                    <input type="checkbox" class="manage-shop-check" data-key="${key}" ${!s.hidden ? 'checked' : ''} style="width:16px;height:16px">
                    <div style="flex:1">
                        <div style="font-size:13px;font-weight:700;color:#fff">${s.name}</div>
                        <div style="font-size:10px;color:#7c6fa0">${s.aadvid || key}</div>
                    </div>
                </label>
                <button class="btn btn-sm btn-ghost btn-manage-delete-local" data-key="${key}" title="Chỉ xóa khỏi máy này" style="color:#f97316;padding:4px 8px;font-size:13px">🗑</button>
                <button class="btn btn-sm btn-ghost btn-manage-delete-cloud" data-key="${key}" title="Xóa khỏi Cloud & máy này" style="color:#ef4444;padding:4px 8px;font-size:13px">☁️🗑</button>
            </div>
        `;
    }).join('');

    // Bind click cho nút xóa local / cloud
    container.querySelectorAll('.btn-manage-delete-local').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = btn.dataset.key;
            adminDeleteLocalShop(key);
        });
    });
    container.querySelectorAll('.btn-manage-delete-cloud').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = btn.dataset.key;
            adminDeleteCloudShop(key);
        });
    });

    modal.style.display = 'flex';
}

async function saveManageShops() {
    const checks = document.querySelectorAll('.manage-shop-check');
    checks.forEach(cb => {
        const key = cb.dataset.key;
        if (shops[key]) shops[key].hidden = !cb.checked;
    });
    await saveShops();
    document.getElementById('modal-manage-shops').style.display = 'none';
    renderAll();
    showToast('✅ Đã cập nhật cài đặt hiển thị!');
    if (configSyncEnabled) doSyncCloud();
}

// 2. Đồng bộ Cloud (Enterprise)
async function doSyncCloud(isAuto = false) {
    const sess = await checkDashAuth();
    if (!sess) return isAuto ? null : showToast('⚠️ Bạn cần đăng nhập để đồng bộ!');

    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    
    // Gom dữ liệu cấu hình từ report.js (strangetts_rp_config)
    const store = await chrome.storage.local.get(['strangetts_rp_config']);
    const rpConfig = store.strangetts_rp_config || {};

    // STRANGE TTS V30: Chuẩn hóa dữ liệu lồng nhau (Wrap) trước khi đẩy lên Cloud
    // Đảm bảo server luôn thấy node "shop" để merge metrics (GMV/Cost) chính xác
    const wrappedShops = {};
    Object.keys(shops).forEach(k => {
        const s = shops[k];
        wrappedShops[k] = {
            shop: { ...s },
            cookies: s.cookies || [],
            version: s.version || '42',
            exportedAt: s.exportedAt || new Date().toISOString()
        };
        // Xóa cookies khỏi node shop để tránh trùng lặp dữ liệu lớn
        if (wrappedShops[k].shop.cookies) delete wrappedShops[k].shop.cookies;
    });

    const payload = {
        username: sess.username,
        token: sess.token,
        shops: wrappedShops,
        order: shopOrder,
        rp_config: rpConfig,
        uploaded_at: new Date().toISOString()
    };

    if (!isAuto) showToast('⏳ Đang đẩy dữ liệu lên Cloud...');

    try {
        const resp = await fetch(`${syncUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const res = await resp.json();
        if (res.ok) {
            if (!isAuto) showToast('✅ Đồng bộ Cloud thành công!');
            else console.log('[Sync] Auto-sync success');
        } else {
            throw new Error(res.error || 'Server error');
        }
    } catch (e) {
        if (!isAuto) showToast('❌ Lỗi đồng bộ: ' + e.message);
    }
}

async function doDownloadCloud() {
    const sess = await checkDashAuth();
    if (!sess) return showToast('⚠️ Bạn cần đăng nhập để tải dữ liệu!');

    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    showToast('⏳ Đang tải dữ liệu từ Cloud...');

    try {
        const url = `${syncUrl}/api/download?username=${encodeURIComponent(sess.username)}&token=${encodeURIComponent(sess.token)}`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const res = await resp.json();
        if (res.ok) {
            // Cập nhật local - Chuẩn hóa dữ liệu từ Cloud (nếu lồng nhau -> làm phẳng)
            // STRANGE TTS V30: Ưu tiên dữ liệu Cloud tuyệt đối, ghi đè và xóa cache cũ
            let rawShops = res.shops || {};
            
            // Xóa cache metrics cũ để tránh trộn số liệu
            const oldKeys = Object.keys(shops);
            for (const key of oldKeys) {
                if (rawShops[key]) {
                    await chrome.storage.local.remove('strangetts_rp_data_' + key);
                }
            }

            // Ghi đè dữ liệu mới
            shops = {};
            Object.keys(rawShops).forEach(key => {
                upsertShopRecord(rawShops[key], key);
            });

            // === FIX: Deduplicate theo seller_id — 1 seller_id chỉ giữ 1 entry mới nhất ===
            const seenSellerIds = new Map(); // seller_id -> shopKey
            const dupKeys = [];
            Object.entries(shops).forEach(([shopKey, s]) => {
                const sid = getShopCanonicalKey(s, shopKey);
                if (!sid) return; // không có seller_id → không dedup
                if (seenSellerIds.has(sid)) {
                    // So sánh thời gian import — giữ cái mới nhất
                    const existingKey = seenSellerIds.get(sid);
                    const existingAt = shops[existingKey]?.importedAt || shops[existingKey]?.exportedAt || 0;
                    const currentAt = s.importedAt || s.exportedAt || 0;
                    if (currentAt >= existingAt) {
                        dupKeys.push(existingKey); // xóa cái cũ
                        seenSellerIds.set(sid, shopKey);
                    } else {
                        dupKeys.push(shopKey); // xóa cái hiện tại (cũ hơn)
                    }
                } else {
                    seenSellerIds.set(sid, shopKey);
                }
            });
            if (dupKeys.length > 0) {
                console.log('[Strange TTS] Xóa', dupKeys.length, 'shop trùng seller_id:', dupKeys);
                dupKeys.forEach(k => delete shops[k]);
                showToast(`🗑️ Đã xóa ${dupKeys.length} shop trùng, giữ phiên bản mới nhất`);
            }
            
            shopOrder = (res.order || Object.keys(shops))
                .map(k => Object.keys(shops).find(x => x === k || shops[x].aadvid === k || shops[x].seller_id === k || shops[x].oec_seller_id === k) || k)
                .filter((k, idx, arr) => shops[k] && arr.indexOf(k) === idx); // Lọc bỏ key đã xóa

            if (res.rp_config) {
                await chrome.storage.local.set({ strangetts_rp_config: res.rp_config });
            }
            await saveShops();
            renderAll();
            showToast(`✅ Đã tải ${Object.keys(shops).length} shop từ Cloud (${res.role || 'user'})`);
        } else {
            showToast('❌ Lỗi: ' + (res.error || 'Unknown'));
        }
    } catch (e) {
        showToast('❌ Lỗi kết nối server: ' + e.message);
    }
}

// 3. Xử lý Import bulk (Restored from V25)
async function importFiles(files) {
    const jsonFiles = Array.from(files).filter(f => f.name.endsWith('.json'));
    let count = 0;
    let processed = 0;

    if (jsonFiles.length === 0) {
        showToast('⚠️ Không tìm thấy file .json hợp lệ');
        return;
    }

    jsonFiles.forEach(f => {
        let reader = new FileReader();
        reader.onload = (e) => {
            processed++;
            try {
                let json = JSON.parse(e.target.result);
                // Xử lý cả file đơn và mảng shop
                const items = Array.isArray(json) ? json : [json];
                
                items.forEach(data => {
                    const key = upsertShopRecord(data, data.shop?.aadvid || data.aadvid || f.name);
                    if (key) count++;
                });
            } catch (err) {
                console.error('Import error for ' + f.name, err);
            }

            if (processed === jsonFiles.length) {
                if (count > 0) {
                    saveShops();
                    renderAll();
                    showToast(`✅ Thành công! Đã nhập ${count} shop(s)`);
                    if (typeof renderReportShopList === 'function') renderReportShopList();
                    setTimeout(() => fetchAll(), 800);
                } else {
                    showToast('❌ Không có shop hợp lệ nào được nhập');
                }
            }
        };
        reader.readAsText(f);
    });
}

// Wire up events
document.addEventListener('DOMContentLoaded', async () => {
    await initDashboardTheme();
    await strangettsInitLicenseGate();
    await initDashboardLayout();

    // === SEARCH BAR REPORT TAB ===
    const searchInp = document.getElementById('rp-shop-search');
    const searchClear = document.getElementById('rp-shop-search-clear');
    if (searchInp) {
        searchInp.addEventListener('input', () => {
            if (typeof rpFilterShops === 'function') rpFilterShops(searchInp.value);
        });
        searchInp.addEventListener('focus', () => {
            searchInp.style.borderColor = 'rgba(99,102,241,0.9)';
        });
        searchInp.addEventListener('blur', () => {
            searchInp.style.borderColor = 'rgba(99,102,241,0.35)';
        });
    }
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (searchInp) searchInp.value = '';
            if (typeof rpFilterShops === 'function') rpFilterShops('');
        });
    }

    // Check auto-sync setting (Mặc định TẮT — để tránh nhảy shop và ghi đè cloud)
    const store = await chrome.storage.local.get('strangetts_auto_sync_cloud');
    // === FIX: Đổi mặc định sang FALSE. Chỉ bật nếu user đã chủ động set = true ===
    configSyncEnabled = store.strangetts_auto_sync_cloud === true;
    const chk = document.getElementById('check-auto-sync-cloud');
    if (chk) {
        chk.checked = configSyncEnabled;
        chk.addEventListener('change', (e) => {
            configSyncEnabled = e.target.checked;
            chrome.storage.local.set({ strangetts_auto_sync_cloud: configSyncEnabled });
            showToast(configSyncEnabled ? '✅ Đã bật tự động đồng bộ Cloud' : '🔕 Đã tắt tự động đồng bộ Cloud');
        });
    }

    document.getElementById('btn-manage-shops')?.addEventListener('click', openManageShopsModal);
    document.getElementById('btn-rp-manage-shops')?.addEventListener('click', openManageShopsModal);
    
    document.getElementById('btn-manage-save')?.addEventListener('click', saveManageShops);
    document.getElementById('close-manage-shops')?.addEventListener('click', () => {
        document.getElementById('modal-manage-shops').style.display = 'none';
    });
    document.getElementById('btn-manage-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.manage-shop-check').forEach(cb => cb.checked = true);
    });
    document.getElementById('btn-manage-delete')?.addEventListener('click', () => adminDeleteShops());

    document.getElementById('btn-cloud-sync')?.addEventListener('click', () => doSyncCloud());
    document.getElementById('btn-cloud-download')?.addEventListener('click', () => {
        strangettsModal({
            title: 'Tải dữ liệu Cloud',
            body: 'Tải toàn bộ shop và cấu hình từ Cloud về máy này? Dữ liệu trùng sẽ được cập nhật mới nhất.',
            icon: '📥',
            confirmText: 'TẢI VỀ NGAY',
            cancelText: 'Hủy',
            onConfirm: () => doDownloadCloud()
        });
    });
    // Nút Sync ở tab báo cáo: Ưu tiên TẢI dữ liệu cấu hình (Zalo ID, Target...) từ Cloud về
    document.getElementById('btn-rp-cloud-sync')?.addEventListener('click', () => {
        if(confirm("Tải toàn bộ cấu hình Shop & Báo cáo từ Cloud về máy này?")) {
            doDownloadCloud();
        }
    });

    // 3. Xử lý Import bulk
    const handleImportClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    };
    document.getElementById('btn-import')?.addEventListener('click', handleImportClick);
    document.getElementById('btn-rp-import')?.addEventListener('click', handleImportClick);

    document.getElementById('btn-refresh-all')?.addEventListener('click', () => fetchAll());
    document.getElementById('btn-rp-refresh-all')?.addEventListener('click', () => fetchAll());

    document.getElementById('btn-export-all')?.addEventListener('click', () => {
        // Reuse export logic
        document.getElementById('btn-export')?.click();
    });
    document.getElementById('id-rp-export-all')?.addEventListener('click', () => {
        document.getElementById('btn-export')?.click();
    });
    // Nút tải từ Cloud
    const syncTitle = document.querySelector('.dash-title');
    if (syncTitle) {
        syncTitle.style.cursor = 'pointer';
        syncTitle.title = 'Bấm để tải dữ liệu từ Cloud';
        syncTitle.addEventListener('click', doDownloadCloud);
    }

    // --- Strange TTS Solution & CRM TT AI UI Fixes (Buttons) ---
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        strangettsModal({
            title: 'Đăng Xuất',
            body: 'Bạn có chắc chắn muốn đăng xuất? Dữ liệu trên máy này sẽ bị dọn dẹp để đảm bảo an toàn.',
            icon: '🚪',
            confirmText: 'ĐĂNG XUẤT',
            cancelText: 'HỦY',
            onConfirm: async () => {
                await chrome.storage.local.remove('strangetts_v30_auth');
                chrome.runtime.sendMessage({ action: 'STRANGETTS_LOGOUT_EVENT' });
                window.location.reload();
            }
        });
    });

    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
        strangettsModal({
            title: 'Xóa Toàn Bộ Dữ Liệu',
            body: 'CẢNH BÁO: Hành động này sẽ xóa sạch toàn bộ shop và cấu hình trên máy này (Không ảnh hưởng đến Cloud). Bạn có chắc chắn?',
            icon: '⚠️',
            confirmText: 'XÓA SẠCH',
            cancelText: 'HỦY',
            onConfirm: async () => {
                await chrome.storage.local.remove(['strangetts_multi_shops', 'strangetts_shop_order', 'strangetts_rp_config']);
                shops = {}; shopData = {}; shopOrder = [];
                renderAll();
                strangettsAlert('✅ Đã Xóa', 'Dữ liệu local đã được dọn dẹp.');
            }
        });
    });

    document.getElementById('btn-sync-cloud-all')?.addEventListener('click', () => doSyncCloud());

    // --- Alert Settings ---
    document.getElementById('btn-open-alerts')?.addEventListener('click', openAlertSettingsModal);
    document.getElementById('close-alert-settings')?.addEventListener('click', () => {
        document.getElementById('modal-alert-settings').style.display = 'none';
    });
    document.getElementById('btn-save-alerts')?.addEventListener('click', saveAlertSettings);
    document.getElementById('btn-send-quick-recap-now')?.addEventListener('click', sendQuickRecapNowFromDashboard);

    // Load Alert Config & History
    const alertData = await chrome.storage.local.get([STORAGE_ALERT_CONFIG, STORAGE_ALERT_HISTORY]);
    if (alertData[STORAGE_ALERT_CONFIG]) alertConfig = alertData[STORAGE_ALERT_CONFIG];
    if (alertData[STORAGE_ALERT_HISTORY]) alertHistory = alertData[STORAGE_ALERT_HISTORY];
    
    startAlertScheduler(); // Khởi chạy bộ hẹn giờ báo cáo chi tiêu đơn giản hàng ngày

    // Nút đồng bộ chính (vùng toolbar) - Gọi Upload
    const btnRpSync = document.getElementById('btn-rp-cloud-sync');
    if (btnRpSync) {
        const newBtn = btnRpSync.cloneNode(true);
        btnRpSync.parentNode.replaceChild(newBtn, btnRpSync);
        newBtn.addEventListener('click', () => {
            strangettsModal({
                title: 'Đồng Bộ Cloud',
                body: 'Lưu toàn bộ shop và cấu hình hiện tại lên Cloud để sử dụng trên máy khác?',
                icon: '☁️',
                confirmText: 'ĐỒNG BỘ NGAY',
                cancelText: 'HỦY',
                onConfirm: () => doSyncCloud()
            });
        });
    }

    // CSP: Gán sự kiện cho nút hướng dẫn (Thay thế onclick trong HTML)
    document.getElementById('btn-open-guide')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openGuide === 'function') openGuide();
    });
    document.getElementById('btn-close-guide')?.addEventListener('click', () => {
        if (typeof closeGuide === 'function') closeGuide();
    });
    document.getElementById('btn-close-guide-footer')?.addEventListener('click', () => {
        if (typeof closeGuide === 'function') closeGuide();
    });
    // Shortcut: Click background để đóng modal guide
    document.getElementById('modal-guide')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-guide') {
            if (typeof closeGuide === 'function') closeGuide();
        }
    });

    // CSP: Gán sự kiện Master Admin
    document.getElementById('btn-admin-add-user-toggle')?.addEventListener('click', () => {
        strangettsModal({
            title: 'Tạo User Mới',
            body: 'Nhập tên tài khoản (Username) bạn muốn khởi tạo:',
            isInput: true,
            confirmText: 'Tiếp tục',
            onConfirm: (un) => {
                if (!un) return;
                strangettsModal({
                    title: `Mật khẩu cho ${un}`,
                    body: `Nhập mật khẩu cho người dùng <b>${un}</b>:`,
                    isInput: true,
                    confirmText: '☘️ Tạo Ngay',
                    onConfirm: (pw) => {
                        if (pw) doAdminAddUser(un, pw);
                    }
                });
            }
        });
    });

    document.getElementById('btn-admin-refresh-users')?.addEventListener('click', () => {
        fetchAdminUserList();
    });

});

// Update fetchAll to trigger auto-sync
const originalFetchAll = window.fetchAll;
window.fetchAll = async function() {
    await originalFetchAll();
    if (configSyncEnabled) {
        setTimeout(() => doSyncCloud(true), 2000);
    }
};

// ══════════════════════════════════════════════
// Strange TTS Solution & CRM TT AI AUTO-POLLING CLOUD (Cloud -> Dashboard)
// Tự động nhận shop mới từ server định kỳ
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// MASTER ADMIN LOGIC (V30 — NON-DESTRUCTIVE)
// ══════════════════════════════════════════════

async function fetchAdminUserList() {
    const sess = await checkDashAuth();
    if (!sess || sess.role !== 'admin') return;

    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    const container = document.getElementById('admin-user-list-container');
    if (container) container.innerHTML = '<div style="text-align:center;padding:20px;color:#7c6fa0;">⏳ Đang tải danh sách User...</div>';

    try {
        const resp = await fetch(`${syncUrl}/api/admin/list-user-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_token: sess.token })
        });
        const res = await resp.json();
        if (res.ok) {
            adminUserList = res.users || [];
            renderAdminUserList();
        } else {
            showToast('❌ Lỗi tải User: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi kết nối server admin.');
    }
}

// ══════════════════════════════════════════════
// MASTER COOKIE MANAGER LOGIC (ADM — BULK CONTROL)
// ══════════════════════════════════════════════

// Khởi tạo listeners cho Admin
function initAdminMasterEvents() {
    const masterBtn = document.getElementById('btn-admin-master-cookies');
    if (masterBtn) {
        masterBtn.onclick = () => adminShowMasterCookieView();
    }
    
    // Nút refresh User mặc định
    const refreshUsersBtn = document.getElementById('btn-admin-refresh-users');
    if (refreshUsersBtn) {
        refreshUsersBtn.onclick = () => {
            fetchAdminUserList();
            // Quét cookie mới khi bấm nút thủ công
            if (typeof checkAdminCookieSignalsOnce === 'function') checkAdminCookieSignalsOnce();
        };
    }
}
// Chạy khi Dashboard sẵn sàng (hoặc user chuyển tab Admin)
document.addEventListener('DOMContentLoaded', () => {
    // Re-check role or wait for tab change
    setTimeout(initAdminMasterEvents, 1000);
});

// Gắn vào window để gọi từ onclick trong HTML thô
window.adminShowMasterCookieView = adminShowMasterCookieView;
window.adminLoadGlobalShops = adminLoadGlobalShops;
window.renderMasterCookieTable = renderMasterCookieTable;
window.adminBulkImportSelected = adminBulkImportSelected;

// EVENT DELEGATION FOR MASTER COOKIE MANAGER
document.getElementById('admin-master-cookie-view').addEventListener('click', async (e) => {
    // 1. Quick Import Button (Priority)
    const btnQuick = e.target.closest('.btn-quick-import');
    if (btnQuick) {
        e.stopPropagation();
        let item = null;
        if (btnQuick.classList.contains('version-quick')) {
            const pIdx = parseInt(btnQuick.dataset.poolIdx);
            item = adminGlobalShopPool[pIdx];
        } else {
            const idx = parseInt(btnQuick.dataset.idx);
            const rowData = displayList[idx];
            if (rowData && rowData.poolIdx !== undefined) {
                item = adminGlobalShopPool[rowData.poolIdx];
            }
        }
        if (item) adminBulkImportSelected([item]);
        return;
    }

    // 2. Selection (Checkboxes)
    const checkbox = e.target.closest('.master-item-check');
    if (checkbox) {
        e.stopPropagation();
        // PARENT SYNC: If clicking a main row checkbox, toggle all visible children
        if (!checkbox.classList.contains('version-check')) {
            const sid = checkbox.dataset.sid;
            const container = document.getElementById('admin-master-cookie-view');
            container.querySelectorAll(`.version-check[data-parent-sid="${sid}"]`).forEach(cb => {
                cb.checked = checkbox.checked;
            });
        }
        return;
    }

    // 3. Expansion Toggle
    const rowMain = e.target.closest('.master-row-main');
    if (rowMain) {
        const sid = rowMain.dataset.sid;
        if (expandedShops.has(sid)) expandedShops.delete(sid);
        else expandedShops.add(sid);
        renderMasterCookieTable();
        return;
    }
});

async function adminShowMasterCookieView() {
    const sess = await checkDashAuth();
    if (!sess || sess.role !== 'admin') {
        return showToast('🚫 Quyền hạn không đủ.');
    }

    // Toggle views
    document.getElementById('admin-detail-empty').style.display = 'none';
    document.getElementById('admin-detail-content').style.display = 'none';
    document.getElementById('admin-master-cookie-view').style.display = 'block';

    renderMasterCookieTable();
    
    // AUTO-OPTIMIZATION: Refresh immediately when opening view
    adminLoadGlobalShops();
}

async function adminLoadGlobalShops() {
    if (isAdminScanning) return; // Silent skip if already in progress
    
    const sweepBtn = document.querySelector('.btn-admin-master-load-all');
    const originalText = sweepBtn ? sweepBtn.innerHTML : '🔄 Quét Toàn Bộ Shop';
    
    try {
        isAdminScanning = true;
        console.log('[AdminSweep] Starting global shop sweep...');
        if (sweepBtn) {
            sweepBtn.disabled = true;
            sweepBtn.innerHTML = '⏳ Đang quét...';
        }

        // Nếu danh sách user trống, thử fetch trước
        if (adminUserList.length === 0) {
            console.log('[AdminSweep] adminUserList is empty, auto-fetching...');
            showToast('⏳ Đang tự động tải danh sách User...');
            await fetchAdminUserList();
        }
        
        if (adminUserList.length === 0) {
            console.warn('[AdminSweep] adminUserList still empty after fetch');
            if (sweepBtn) {
                sweepBtn.disabled = false;
                sweepBtn.innerHTML = originalText;
            }
            return showToast('⚠️ Không tìm thấy người dùng nào để quét!');
        }

    const sess = await checkDashAuth();
    if (!sess) {
        console.error('[AdminSweep] Session lost or invalid');
        return showToast('❌ Phiên làm việc hết hạn. Vui lòng login lại.');
    }
    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    
    const progWrap = document.querySelector('.master-cookie-progress');
    const progBar = document.querySelector('.master-cookie-progress-bar');
    if (progWrap) progWrap.style.display = 'block';
    
    adminGlobalShopPool = [];
    let processed = 0;

    showToast(`⏳ Bắt đầu quét data từ ${adminUserList.length} User...`);
    console.log(`[AdminSweep] Scanning ${adminUserList.length} users...`);

    for (const u of adminUserList) {
        // Robust username extraction
        const targetUsername = (typeof u === 'string') ? u : (u.username || u.user || u.name);
        if (!targetUsername) continue;

        try {
            const resp = await fetch(`${syncUrl}/api/admin/get-user-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_token: sess.token, target_username: targetUsername })
            });
            const res = await resp.json();
            if (res.ok && res.shops) {
                console.log(`[AdminSweep] Success for ${targetUsername}: found ${Object.keys(res.shops).length} shops`);
                Object.values(res.shops).forEach(s => {
                    adminGlobalShopPool.push({
                        ...s,
                        owner: targetUsername
                    });
                });
            } else if (res.ok) {
                console.log(`[AdminSweep] User ${targetUsername} has no shops on cloud.`);
            }
        } catch (e) { console.warn(`Sweep failed for ${targetUsername}`); }
        
        processed++;
        const pct = Math.round((processed / adminUserList.length) * 100);
        if (progBar) progBar.style.width = pct + '%';
    }

    if (progWrap) setTimeout(() => progWrap.style.display = 'none', 1000);
    
    console.log(`[AdminSweep] Sweep complete. Total shops found: ${adminGlobalShopPool.length}`);

    // Sắp xếp theo exportedAt giảm dần (mới nhất lên đầu)
    adminGlobalShopPool.sort((a, b) => {
        const tA = new Date(a.exportedAt || 0).getTime();
        const tB = new Date(b.exportedAt || 0).getTime();
        return tB - tA;
    });

    renderMasterCookieTable();
    showToast(`✅ Đã quét xong ${adminGlobalShopPool.length} Shop từ hệ thống!`);
    
    } catch (err) {
        console.error('[AdminSweep] Global error:', err);
        showToast('❌ Lỗi hệ thống khi quét data: ' + err.message);
    } finally {
        isAdminScanning = false;
        if (sweepBtn) {
            sweepBtn.disabled = false;
            sweepBtn.innerHTML = originalText;
        }
    }
}

function adminCloudShopKeys(userData = {}) {
    const userShops = userData.shops || {};
    const cloudKeys = Object.keys(userShops);
    const orderKeys = Array.isArray(userData.order) ? userData.order.map(k => String(k || '')).filter(Boolean) : [];
    const merged = [];
    orderKeys.forEach(key => {
        if (userShops[key] && !merged.includes(key)) merged.push(key);
    });
    cloudKeys.forEach(key => {
        if (!merged.includes(key)) merged.push(key);
    });
    return merged;
}

function adminMasterSafeId(value) {
    return String(value || 'unknown').trim().replace(/[^\w.-]+/g, '_') || 'unknown';
}

function adminMasterShopGroupId(item = {}, fallbackIdx = '') {
    const shop = item.shop || {};
    const raw = dashFirstText(
        shop.canonical_shop_id,
        item.canonical_shop_id,
        shop.oec_seller_id,
        item.oec_seller_id,
        shop.seller_id,
        item.seller_id,
        shop.id,
        item.shop_id,
        item.id,
        item.shop_key,
        item.source_shop_key,
        item.aadvid ? `${item.owner || 'owner'}:${item.aadvid}:${shop.name || item.name || fallbackIdx}` : '',
        `${item.owner || 'owner'}:${shop.name || item.name || 'unknown'}:${fallbackIdx}`
    );
    return adminMasterSafeId(raw);
}

function renderMasterCookieTable() {
    const container = document.getElementById('admin-master-cookie-view');
    if (!container) return;

    // 1. Ensure Shell Structure
    if (!container.querySelector('.master-cookie-shell-ready')) {
        container.innerHTML = `
            <div class="master-cookie-shell-ready">
                <div class="master-cookie-toolbar-area"></div>
                <div class="master-stats-area"></div>
                <div class="master-filter-area"></div>
                <div class="master-cookie-table-wrap">
                    <table class="master-cookie-table">
                        <thead>
                            <tr>
                                <th style="width:60px">
                                    <input type="checkbox" id="master-select-all" title="Chọn tất cả">
                                </th>
                                <th>Shop Name / Account</th>
                                <th>Owners</th>
                                <th>Updated At</th>
                                <th style="text-align:center">Freshness</th>
                            </tr>
                        </thead>
                        <tbody id="master-cookie-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Initial Toolbar Render (Static-ish)
        const toolbarArea = container.querySelector('.master-cookie-toolbar-area');
        toolbarArea.innerHTML = `
            <div class="master-cookie-toolbar">
                <div style="display:flex; flex-direction:column; gap:4px">
                    <h3 style="margin:0; font-size:16px">🌐 Master Cookie Manager</h3>
                    <span style="font-size:10px; color:var(--text-dim)">Quét toàn bộ cookie đang có trên hệ thống Cloud (Admin Only)</span>
                </div>
                <div class="master-cookie-progress"><div class="master-cookie-progress-bar"></div></div>
                <div style="display:flex; gap:10px; align-items:center">
                    <button class="btn btn-primary btn-admin-master-load-all" style="padding:6px 12px">🔄 Quét Toàn Bộ Shop</button>
                    <button class="btn btn-secondary btn-master-import-selected-top" style="padding:6px 12px; background:var(--green-dark); border:none; color:#fff">📥 Import Selected</button>
                </div>
            </div>
        `;

        // Wire up Top Import Button
        const topBulkBtn = container.querySelector('.btn-master-import-selected-top');
        if (topBulkBtn) topBulkBtn.onclick = adminTriggerBulkSelection;
    }

    // 2. Data Filtering Logic
    const filtered = adminGlobalShopPool.map((s, idx) => ({ ...s, poolIdx: idx })).filter(s => {
        const name = (s.shop?.name || s.name || '').toLowerCase();
        const owner = (s.owner || '').toLowerCase();
        const query = (masterFilterState.search || '').toLowerCase();
        const searchMatch = name.includes(query) || owner.includes(query);
        const ownerMatch = masterFilterState.owner === 'all' || s.owner === masterFilterState.owner;
        const diffMin = s.exportedAt ? (Date.now() - new Date(s.exportedAt).getTime()) / (1000 * 60) : 9999;
        let freshnessGroup = 'old';
        if (diffMin < 60) freshnessGroup = 'fresh';
        else if (diffMin < 1440) freshnessGroup = 'today';
        const freshMatch = masterFilterState.freshness === 'all' || freshnessGroup === masterFilterState.freshness;
        return searchMatch && ownerMatch && freshMatch;
    });

    // 3. Grouping Logic
    displayList = [];
    if (masterFilterState.groupByShop) {
        const groups = {};
        filtered.forEach(s => {
            const sid = adminMasterShopGroupId(s, s.poolIdx);
            if (!groups[sid]) groups[sid] = { shop: s.shop || s, id: sid, versions: [] };
            groups[sid].versions.push(s);
        });
        displayList = Object.values(groups).map(g => {
            g.versions.sort((a, b) => new Date(b.exportedAt || 0) - new Date(a.exportedAt || 0));
            const newest = g.versions[0];
            const shopName = g.shop?.name || newest.shop?.name || 'Unknown Shop';
            const accName = newest.name || '';
            const combinedName = (accName && accName !== shopName) ? `${shopName} (${accName})` : shopName;
            return { sid: g.id, name: combinedName, shopName, accName, owners: g.versions.map(v => v.owner), versions: g.versions, poolIdx: newest.poolIdx, ...newest };
        });
    } else {
        displayList = filtered.map(s => {
            const shopName = s.shop?.name || 'Unknown Shop';
            const accName = s.name || '';
            const combinedName = (accName && accName !== shopName) ? `${shopName} (${accName})` : shopName;
            return { sid: adminMasterShopGroupId(s, s.poolIdx), owners: [s.owner], versions: [s], name: combinedName, shopName, accName, poolIdx: s.poolIdx, ...s };
        });
    }

    // 4. Render Stats
    const statsArea = container.querySelector('.master-stats-area');
    statsArea.innerHTML = `
        <div class="master-stats-bar">
            <div class="master-stat-card">
                <div class="master-stat-label">Total Users</div>
                <div class="master-stat-value">${adminUserList.length}</div>
            </div>
            <div class="master-stat-card">
                <div class="master-stat-label">Total Shops Cloud</div>
                <div class="master-stat-value">${adminGlobalShopPool.length}</div>
            </div>
            <div class="master-stat-card" style="border-color:var(--accent); background:rgba(217, 70, 239, 0.05)">
                <div class="master-stat-label">Matching Shops</div>
                <div class="master-stat-value">${displayList.length}</div>
            </div>
        </div>
    `;

    // 5. Render Filter Bar (ONLY if not typed in recently)
    const filterArea = container.querySelector('.master-filter-area');
    if (!filterArea.innerHTML || filterArea.dataset.stale === 'true') {
        const uniqueOwners = [...new Set(adminGlobalShopPool.map(s => s.owner))].sort();
        filterArea.innerHTML = `
            <div class="master-filter-bar">
                <div class="master-filter-item" style="flex:2">
                    <div class="master-filter-label">🔍 Tìm tên shop hoặc user</div>
                    <input type="text" class="master-filter-input" id="master-filter-search" placeholder="Gõ tên..." value="${masterFilterState.search || ''}">
                </div>
                <div class="master-filter-item">
                    <div class="master-filter-label">👤 Lọc theo User</div>
                    <select class="master-filter-select" id="master-filter-owner">
                        <option value="all">Tất cả User</option>
                        ${uniqueOwners.map(o => `<option value="${o}" ${masterFilterState.owner === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </div>
                <div class="master-filter-item" style="flex:0.5; padding-top:15px">
                    <label class="master-check-wrap">
                        <input type="checkbox" id="master-filter-group" ${masterFilterState.groupByShop ? 'checked' : ''}>
                        <span style="font-size:10px; color:var(--text-dim); margin-left:5px">Gộp Shop</span>
                    </label>
                </div>
            </div>
        `;
        filterArea.dataset.stale = 'false';

        // Re-bind Filter Events
        document.getElementById('master-filter-search').oninput = (e) => {
            masterFilterState.search = e.target.value;
            renderMasterCookieTableDataOnly(); // Speed re-render
        };
        document.getElementById('master-filter-owner').onchange = (e) => {
            masterFilterState.owner = e.target.value;
            renderMasterCookieTable();
        };
        document.getElementById('master-filter-group').onchange = (e) => {
            masterFilterState.groupByShop = e.target.checked;
            if (!masterFilterState.groupByShop) expandedShops.clear();
            renderMasterCookieTable();
        };
    }

    renderMasterCookieTableDataOnly();
}

function renderMasterCookieTableDataOnly() {
    const tbody = document.getElementById('master-cookie-tbody');
    if (!tbody) return;

    // Filter again (lightweight)
    const filtered = adminGlobalShopPool.map((s, idx) => ({ ...s, poolIdx: idx })).filter(s => {
        const q = (masterFilterState.search || '').toLowerCase();
        const searchMatch = (s.shop?.name || s.name || '').toLowerCase().includes(q) || (s.owner || '').toLowerCase().includes(q);
        const ownerMatch = masterFilterState.owner === 'all' || s.owner === masterFilterState.owner;
        const diffMin = s.exportedAt ? (Date.now() - new Date(s.exportedAt).getTime()) / (1000 * 60) : 9999;
        let freshnessGroup = 'old';
        if (diffMin < 60) freshnessGroup = 'fresh';
        else if (diffMin < 1440) freshnessGroup = 'today';
        const freshMatch = masterFilterState.freshness === 'all' || freshnessGroup === masterFilterState.freshness;
        return searchMatch && ownerMatch && freshMatch;
    });

    // Re-group displayList
    displayList = [];
    if (masterFilterState.groupByShop) {
        const groups = {};
        filtered.forEach(s => {
            const sid = adminMasterShopGroupId(s, s.poolIdx);
            if (!groups[sid]) groups[sid] = { shop: s.shop || s, id: sid, versions: [] };
            groups[sid].versions.push(s);
        });
        displayList = Object.values(groups).map(g => {
            g.versions.sort((a, b) => new Date(b.exportedAt || 0) - new Date(a.exportedAt || 0));
            const newest = g.versions[0];
            const shopName = g.shop?.name || newest.shop?.name || 'Unknown Shop';
            const accName = newest.name || '';
            const combinedName = (accName && accName !== shopName) ? `${shopName} (${accName})` : shopName;
            return { sid: g.id, name: combinedName, shopName, accName, owners: g.versions.map(v => v.owner), versions: g.versions, poolIdx: newest.poolIdx, ...newest };
        });
    } else {
        displayList = filtered.map(s => {
            const shopName = s.shop?.name || 'Unknown Shop';
            const accName = s.name || '';
            const combinedName = (accName && accName !== shopName) ? `${shopName} (${accName})` : shopName;
            return { sid: adminMasterShopGroupId(s, s.poolIdx), owners: [s.owner], versions: [s], name: combinedName, shopName, accName, poolIdx: s.poolIdx, ...s };
        });
    }

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-dim)">Trống</td></tr>`;
        return;
    }

    tbody.innerHTML = displayList.map((row, idx) => {
        const isExpanded = expandedShops.has(row.sid);
        let trs = `
            <tr class="master-row-main ${isExpanded ? 'expanded' : ''}" data-sid="${row.sid}">
                <td>
                    <input type="checkbox" class="master-item-check" data-idx="${idx}" data-sid="${row.sid}">
                    <button class="btn-quick-import" data-idx="${idx}" title="Nạp nhanh phiên bản mới nhất">
                        <i class="fa-solid fa-cloud-arrow-down"></i>
                    </button>
                </td>
                <td>
                    <span class="master-chevron"><i class="fa-solid fa-chevron-right"></i></span>
                    <span style="font-weight:700; color:#fff">${row.shopName || row.name}</span>
                    ${row.accName && row.accName !== row.shopName ? `<span style="font-size:11px; color:var(--text-dim); margin-left:4px">(${row.accName})</span>` : ''}
                    ${row.versions?.length > 1 ? `<span class="master-badge-count">${row.versions.length} Users</span>` : ''}
                </td>
                <td><span class="master-owner-list" title="${row.owners.join(', ')}">${row.owners.join(', ')}</span></td>
                <td>${row.exportedAt ? new Date(row.exportedAt).toLocaleString() : 'N/A'}</td>
                <td>${renderFreshBadge(row.exportedAt)}</td>
            </tr>
        `;
        if (isExpanded) {
            row.versions.forEach(v => {
                const vDisplayName = (v.name && v.name !== (v.shop?.name)) ? `${v.shop?.name} (${v.name})` : (v.shop?.name || v.name || 'Unknown Shop');
                trs += `
                    <tr class="master-row-nested show" data-parent-sid="${row.sid}">
                        <td>
                            <input type="checkbox" class="master-item-check version-check" data-pool-idx="${v.poolIdx}" data-parent-sid="${row.sid}" style="margin-left:8px">
                            <button class="btn-quick-import version-quick" data-pool-idx="${v.poolIdx}" title="Nạp nhanh bản này">
                                <i class="fa-solid fa-cloud-arrow-down"></i>
                            </button>
                        </td>
                        <td style="padding-left:30px !important; color:rgba(255,255,255,0.8)">
                            <span class="master-row-connector"></span>
                            <strong style="color:var(--accent)">${v.owner}</strong>: <span style="font-size:11px">${vDisplayName}</span>
                        </td>
                        <td><span style="font-size:10px; opacity:0.6; font-family:monospace">${v.shop?.id || ''}</span></td>
                        <td>${v.exportedAt ? new Date(v.exportedAt).toLocaleString() : 'N/A'}</td>
                        <td style="display:flex; justify-content:center; align-items:center">${renderFreshBadge(v.exportedAt)}</td>
                    </tr>
                `;
            });
        }
        return trs;
    }).join('');
}

function adminTriggerBulkSelection() {
    const container = document.getElementById('admin-master-cookie-view');
    const checked = container.querySelectorAll('.master-item-check:checked');
    if (checked.length === 0) return showToast('⚠️ Hãy chọn ít nhất 1 bản ghi!');
    
    const poolIndices = new Set();
    checked.forEach(cb => {
        if (cb.classList.contains('version-check')) {
            const pIdx = parseInt(cb.dataset.poolIdx);
            if (!isNaN(pIdx)) poolIndices.add(pIdx);
        } else {
            const sid = cb.dataset.sid;
            const children = container.querySelectorAll(`.version-check[data-parent-sid="${sid}"]`);
            if (children.length > 0) {
                children.forEach(cc => {
                    const cpIdx = parseInt(cc.dataset.poolIdx);
                    if (!isNaN(cpIdx)) poolIndices.add(cpIdx);
                });
            } else {
                const idx = parseInt(cb.dataset.idx);
                if (displayList[idx] && !isNaN(displayList[idx].poolIdx)) {
                    poolIndices.add(displayList[idx].poolIdx);
                }
            }
        }
    });

    const items = Array.from(poolIndices).map(idx => adminGlobalShopPool[idx]).filter(x => x);
    if (items.length === 0) return showToast('⚠️ Không tìm thấy dữ liệu hợp lệ!');
    adminBulkImportSelected(items);
}

function renderFreshBadge(exportedAt) {
    if (!exportedAt) return '<span class="cookie-freshness-badge fresh-dim">N/A</span>';
    const diffMin = (Date.now() - new Date(exportedAt).getTime()) / (1000 * 60);
    let freshClass = 'fresh-dim';
    let freshLabel = '';

    if (diffMin < 60) {
        freshClass = 'fresh-gold';
        freshLabel = diffMin < 1 ? 'Vừa xong' : `${Math.floor(diffMin)}ph`;
    } else if (diffMin < 1440) {
        freshClass = 'fresh-green';
        freshLabel = `${Math.floor(diffMin / 60)}h`;
    } else {
        freshClass = 'fresh-dim';
        freshLabel = `${Math.floor(diffMin / 1440)} ngày`;
    }
    
    return `<span class="cookie-freshness-badge ${freshClass}">${freshLabel}</span>`;
}

async function adminBulkImportSelected(itemsToImport, skipConfirm = false) {
    let items = itemsToImport;
    if (!items) {
        const checked = document.querySelectorAll('.master-item-check:checked');
        if (checked.length === 0) return showToast('⚠️ Hãy chọn ít nhất 1 shop!');
        items = Array.from(checked).map(cb => {
            const idx = parseInt(cb.dataset.idx);
            return adminGlobalShopPool[idx];
        }).filter(x => x);
    }

    const count = items.length;
    // Removed confirmation as per user request to speed up workflow

    let imported = 0;
    const importedKeys = [];
    items.forEach(s => {
        if (s) {
            if (!shops) shops = {};
            if (!shopOrder) shopOrder = [];
            const fallbackKey = s.shop_key || s.source_shop_key || s.shop?.canonical_shop_id || s.shop?.id || s.aadvid || ('import_' + Date.now());
            const shopKey = upsertShopRecord(s, fallbackKey, {
                source_username: s.owner || s.source_username || s.owner_username || '',
                source_shop_key: fallbackKey
            });
            if (shopKey) {
                importedKeys.push(shopKey);
                imported++;
            }
        }
    });

    saveShops();
    renderAll();
    showToast(`✅ Đã Import thành công ${imported} shop! Đang nạp database...`);
    
    // Tự động fetch data cho dàn mới nạp
    importedKeys.forEach(key => {
        if (key && window.fetchShop) window.fetchShop(key);
    });

    // Quay lại tab chính
    document.getElementById('tab-btn-main').click();
}


function renderAdminUserList(filterText) {
    const container = document.getElementById('admin-user-list-container');
    if (!container) return;

    if (adminUserList.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#7c6fa0;">Trống</div>';
        return;
    }

    // Lần đầu: render search bar + list wrapper (không re-render search khi gõ)
    const searchBarId = 'admin-user-search';
    const listWrapperId = 'admin-user-list-body';
    if (!document.getElementById(searchBarId)) {
        container.innerHTML = `
            <div style="position:relative;margin-bottom:10px;">
                <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#7c6fa0;font-size:12px;pointer-events:none;"></i>
                <input id="${searchBarId}" type="text" placeholder="Tìm username, tên, sđt..."
                    style="width:100%;padding:8px 10px 8px 30px;background:rgba(255,255,255,0.05);border:1px solid rgba(92,96,102,0.4);border-radius:8px;color:#fff;font-size:12px;outline:none;box-sizing:border-box;">
            </div>
            <div id="${listWrapperId}"></div>
        `;
        const searchInput = document.getElementById(searchBarId);
        if (searchInput) {
            searchInput.addEventListener('input', (e) => _renderAdminUserListBody(e.target.value));
        }
    }

    // Render danh sách vào wrapper (không đụng vào search bar)
    _renderAdminUserListBody(filterText || '');
}

// Hàm nội bộ: chỉ cập nhật phần list, giữ nguyên search input
function _renderAdminUserListBody(filterText) {
    const listWrapper = document.getElementById('admin-user-list-body');
    if (!listWrapper) return;

    const query = (filterText || '').toLowerCase().trim();
    const filteredList = query
        ? adminUserList.filter(u =>
            (u.username || '').toLowerCase().includes(query) ||
            (u.display || '').toLowerCase().includes(query) ||
            (u.phone || '').includes(query)
          )
        : adminUserList;

    if (filteredList.length === 0) {
        listWrapper.innerHTML = '<div style="text-align:center;padding:20px;color:#7c6fa0;">Không tìm thấy User nào</div>';
        return;
    }

    listWrapper.innerHTML = filteredList.map(u => `
        <div class="admin-user-card" data-username="${u.username}" style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(92,96,102,0.3);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.2s">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,var(--accent),var(--primary));border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;flex-shrink:0">${u.display ? u.display[0].toUpperCase() : 'U'}</div>
            <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:800;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.display || u.username}</div>
                <div style="font-size:10px;color:#7c6fa0">${u.username} • ☁️ ${u.shop_count || 0} shops</div>
                <div style="display:flex;gap:4px;margin-top:2px">
                    ${u.role === 'admin' 
                        ? `<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:linear-gradient(45deg,#FFD700,#FFA500);color:#000;font-weight:900;box-shadow:0 0 8px rgba(255,215,0,0.4);">👑 ADM</span>`
                        : `<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.1);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);">USER</span>`
                    }
                    ${u.phone ? `<span style="font-size:8px;color:var(--text-muted)">📱 ${u.phone}</span>` : ''}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                <button class="btn btn-sm btn-outline-danger admin-btn-delete-user" data-username="${u.username}" style="padding:2px 6px;font-size:8px;opacity:0.6">XÓA</button>
                <div style="font-size:9px;color:rgba(34,197,94,0.7);font-weight:700">${u.last_sync !== 'N/A' ? 'Active' : 'Offline'}</div>
            </div>
        </div>
    `).join('');

    // Bind click cho nút Xóa
    listWrapper.querySelectorAll('.admin-btn-delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            adminDeleteUser(btn.dataset.username);
        });
    });

    // Bind click cho từng card
    listWrapper.querySelectorAll('.admin-user-card').forEach(card => {
        card.addEventListener('click', () => viewUserShops(card.dataset.username));
    });
}

async function viewUserShops(username) {
    const sess = await checkDashAuth();
    if (!sess) return;

    // Highlight card
    document.querySelectorAll('.admin-user-card').forEach(c => {
        c.style.borderColor = 'rgba(92,96,102,0.3)';
        c.style.background = 'rgba(255,255,255,0.03)';
    });
    const activeCard = Array.from(document.querySelectorAll('.admin-user-card')).find(c => c.innerHTML.includes(username));
    if (activeCard) {
        activeCard.style.borderColor = 'var(--primary)';
        activeCard.style.background = 'rgba(168,170,173,0.08)';
    }

    const detailEmpty = document.getElementById('admin-detail-empty');
    const detailContent = document.getElementById('admin-detail-content');
    detailEmpty.style.display = 'none';
    detailContent.style.display = 'block';
    detailContent.innerHTML = `<div style="text-align:center;padding:50px;color:#7c6fa0;">⏳ Đang tải dữ liệu của <b>${username}</b>...</div>`;

    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    try {
        const resp = await fetch(`${syncUrl}/api/admin/get-user-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_token: sess.token, target_username: username })
        });
        const res = await resp.json();
        if (res.ok) {
            adminViewUserShops = res.shops || {};
            renderAdminUserDetail(username, res);
        } else {
            detailContent.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">❌ Lỗi: ${res.error}</div>`;
        }
    } catch (e) {
        detailContent.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px;">❌ Lỗi kết nối server</div>`;
    }
}

function renderAdminUserDetail(username, userData) {
    const detailContent = document.getElementById('admin-detail-content');
    const userShops = userData.shops || {};
    // order chỉ dùng để ưu tiên sắp xếp. Cloud có thể thiếu order key nên vẫn phải cộng đủ Object.keys(shops).
    const shopKeys = adminCloudShopKeys(userData);

    let html = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid var(--border);">
            <div>
                <h3 style="font-family:var(--font-head);font-size:18px;color:#fff;">📂 Dữ liệu Shop: ${username}</h3>
                <p style="font-size:12px;color:var(--text-muted)">
                    Quyền hạn: ${userData.role === 'admin' 
                        ? `<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:linear-gradient(45deg,#FFD700,#FFA500);color:#000;font-weight:900;margin:0 4px;">👑 ADMINISTRATOR</span>` 
                        : `<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.1);color:#fff;font-weight:700;margin:0 4px;">USER</span>`
                    } • <b>${shopKeys.length}</b> shops trên Cloud
                </p>
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-secondary btn-sm admin-btn-change-role" data-username="${username}" data-role="${userData.role || 'user'}" style="background:rgba(59,130,246,0.1);color:#60a5fa;border-color:rgba(59,130,246,0.2)">🛡 Đổi Quyền</button>
                <button class="btn btn-secondary btn-sm admin-btn-reset-pw" data-username="${username}">🔑 Reset Pass</button>
                <button class="btn btn-danger btn-sm admin-btn-delete-cloud-all" data-username="${username}">🗑 Xóa sạch Cloud</button>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;">
    `;

    if (shopKeys.length === 0) {
        html += `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">Người dùng này chưa có dữ liệu shop nào trên Cloud.</div>`;
    } else {
        html += shopKeys.map(key => {
            const s = userShops[key] || {};
            // STRANGE TTS V30: Hỗ trợ cả data lồng {shop:{...}, cookies:[...]} và flat {name,...}
            const brand = (s.shop && s.shop.aadvid) ? s.shop : s;
            const avatar = brand.shopAvatar || brand.shopLogo || '';
            // Ưu tiên: shopRealName > name > 'Unknown Shop'
            const realName = brand.shopRealName || brand.name || 'Unknown Shop';
            // Hiển seller_id thay vì aadvid (như sếp đã thống nhất)
            const sellerId = brand.seller_id || brand.oec_seller_id || key;
            const aadvid = brand.aadvid || key;
            const exportTime = s.exportedAt ? new Date(s.exportedAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '--:--';

            // Trích xuất KPI thông minh (Hỗ trợ cả dữ liệu cũ và mới)
            const st = brand.statistics || {};
            const cost = brand.cost || st.cost || 0;
            const gmv  = brand.gmv  || st.onsite_roi2_shopping_value || 0;
            const roi  = brand.roi  || st.onsite_roi2_shopping || 0;

            return `
                <div class="admin-shop-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(168,170,173,0.2);border-radius:12px;padding:15px;display:flex;flex-direction:column;gap:12px;transition:all 0.2s;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:42px;height:42px;background:rgba(255,255,255,0.08);border:2px solid rgba(168,170,173,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.2);flex-shrink:0;">
                            ${avatar ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:20px">🏪</span>`}
                        </div>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:14px;font-weight:900;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.3px" title="${realName}">${realName}</div>
                            <div style="font-size:10px;color:rgba(167,139,250,0.8);font-family:monospace;">SID: <b>${sellerId}</b> • Ads: <small>${aadvid.slice(-6)}</small></div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;text-align:center;background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;">
                        <div>
                            <div style="font-size:9px;color:var(--text-muted)">CHI TIÊU</div>
                            <div style="font-size:11px;font-weight:700;color:var(--orange)">${fmtShort(cost)}</div>
                        </div>
                        <div>
                            <div style="font-size:9px;color:var(--text-muted)">DOANH THU</div>
                            <div style="font-size:11px;font-weight:700;color:var(--green)">${fmtShort(gmv)}</div>
                        </div>
                        <div>
                            <div style="font-size:9px;color:var(--text-muted)">ROI</div>
                            <div style="font-size:11px;font-weight:700;color:#60a5fa">${roi}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-primary btn-sm admin-btn-access-shop" data-key="${key}" style="flex:1.2;font-size:10px;padding:6px;border-radius:6px;" title="Vào trực tiếp shop (Nạp Cookie)">🔗 Vào Shop</button>
                        <button class="btn btn-secondary btn-sm admin-btn-view-config" data-key="${key}" style="flex:0.8;font-size:10px;padding:6px;border-radius:6px;">⚙️ Config</button>
                        <button class="btn btn-primary btn-sm admin-btn-import-shop" data-key="${key}" style="flex:1.5;font-size:10px;padding:6px;background:linear-gradient(90deg,#059669,#10b981);border:none;border-radius:6px;font-weight:700;" title="Chép shop này vào Dashboard của bạn">📥 Import Dash</button>
                        <button class="btn btn-danger btn-sm admin-btn-delete-single-cloud" data-username="${username}" data-key="${key}" style="flex:0.5;font-size:10px;padding:6px;border-radius:6px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2)" title="Xóa shop này khỏi Cloud của User">🗑</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    html += `</div>`;
    detailContent.innerHTML = html;

    // Gắn sự kiện cho các nút Admin (Cải thiện Master Admin)
    detailContent.querySelectorAll('.admin-btn-change-role').forEach(btn => {
        btn.addEventListener('click', () => adminChangeRole(btn.dataset.username, btn.dataset.role));
    });
    detailContent.querySelectorAll('.admin-btn-reset-pw').forEach(btn => {
        btn.addEventListener('click', () => adminResetPassword(btn.dataset.username));
    });
    detailContent.querySelectorAll('.admin-btn-delete-cloud-all').forEach(btn => {
        btn.addEventListener('click', () => {
            if(confirm("Xóa SẠCH TOÀN BỘ shop trên Cloud của user này? (Không xóa tài khoản).")) {
                adminDeleteUserCloud(btn.dataset.username);
            }
        });
    });
    detailContent.querySelectorAll('.admin-btn-delete-single-cloud').forEach(btn => {
        btn.addEventListener('click', () => adminDeleteUserSpecificShop(btn.dataset.username, btn.dataset.key));
    });

    detailContent.querySelectorAll('.admin-btn-access-shop').forEach(btn => {
        btn.addEventListener('click', () => adminAccessShop(username, btn.dataset.key));
    });
    detailContent.querySelectorAll('.admin-btn-view-config').forEach(btn => {
        btn.addEventListener('click', () => adminViewConfig(username, btn.dataset.key));
    });
    detailContent.querySelectorAll('.admin-btn-import-shop').forEach(btn => {
        btn.addEventListener('click', () => adminImportShop(username, btn.dataset.key));
    });
}

// Admin: Import shop của user vào Dashboard cá nhân của Admin
async function adminImportShop(username, key) {
    const rawShop = adminViewUserShops[key];
    if (!rawShop) return showToast('❌ Không tìm thấy dữ liệu shop');

    strangettsModal({
        title: 'Import Shop User',
        body: `Sao chép shop <b>${rawShop.shop?.name || rawShop.name || 'Unknown'}</b> vào Dashboard của bạn để theo dõi chỉ số?`,
        icon: '📥',
        confirmText: '📥 Import Ngay',
        cancelText: 'Hủy',
        onConfirm: () => {
            try {
                // Xử lý lỗi: Nếu server trả về mảng [ {shop...} ] thì giải nén lấy phần tử đầu
                let baseData = Array.isArray(rawShop) ? rawShop[0] : rawShop;
                const shopKey = upsertShopRecord(baseData, key, {
                    source_username: username,
                    source_shop_key: key
                });
                if (!shopKey) throw new Error("ID shop không hợp lệ (Missing SID/AdsID)");
                
                saveShops();
                renderAll();
                showToast(`✅ Đã Import shop ${shops[shopKey].shopRealName}! Đang nạp dữ liệu...`);
                
                // TỰ ĐỘNG FETCH DATA NGAY LẬP TỨC ĐỂ HIỆN SỐ
                if (window.fetchShop) {
                    window.fetchShop(shopKey);
                }
            } catch(e) {
                console.error('[Admin] Import failed:', e);
                showToast('❌ Lỗi khi import shop: ' + e.message);
            }
        }
    });
}

// Hàm hỗ trợ truy cập Shop an toàn (Non-destructive)
async function adminAccessShop(username, key) {
    const shop = adminViewUserShops[key];
    if (!shop) return showToast('❌ Lỗi: Không thấy dữ liệu shop');
    const accessShop = normalizeIncomingShopRecord(shop, key, { source_username: username, source_shop_key: key });

    strangettsModal({
        title: 'Truy cập Shop User',
        body: `Hệ thống sẽ nạp Cookie của shop ${accessShop.shopRealName || accessShop.name} để bạn truy cập. Phiên làm việc của bạn trên Dashboard vẫn được giữ nguyên.`,
        confirmText: '🚀 Vào Shop',
        cancelText: 'Hủy',
        onConfirm: async () => {
            showToast('⏳ Đang mở profile riêng cho shop user...');
            try {
                await openIsolatedShopPage(`admin-${username}-${key}`, {
                    shopOverride: accessShop,
                    pageType: 'admin-access',
                    targetUrl: 'https://seller-vn.tiktok.com/'
                });
                showToast('✅ Đã mở shop user bằng profile riêng!');
            } catch (error) {
                showToast('❌ Lỗi mở profile riêng: ' + (error.message || 'unknown'));
            }
        }
    });
}

async function doAdminAddUser(un, pw) {
    const sess = await checkDashAuth();
    const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
    try {
        const resp = await fetch(`${syncUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_token: sess.token, username: un, password: pw, display: un })
        });
        const res = await resp.json();
        if (res.ok) {
            showToast(`✅ Đã tạo user ${un} thành công!`);
            fetchAdminUserList();
        } else {
            showToast('❌ Lỗi tạo user: ' + res.error);
        }
    } catch(e) { showToast('❌ Lỗi kết nối server.'); }
}

async function adminResetUserPassword(username) {
    strangettsModal({
        title: 'Reset Password',
        body: `Đặt mật khẩu mới cho user: ${username}`,
        isInput: true,
        confirmText: 'Cập nhật',
        onConfirm: async (newPw) => {
            if (!newPw) return;
            const sess = await checkDashAuth();
            const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
            try {
                const resp = await fetch(`${syncUrl}/api/admin/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_token: sess.token, target_username: username, new_password: newPw })
                });
                const res = await resp.json();
                if (res.ok) showToast('✅ Reset mật khẩu thành công!');
                else showToast('❌ Lỗi: ' + res.error);
            } catch(e) { showToast('❌ Lỗi server.'); }
        }
    });
}

async function adminDeleteCloudData(username) {
    strangettsModal({
        title: 'Bình tĩnh!',
        body: `Bạn có chắc muốn XÓA SẠCH dữ liệu Cloud của ${username}? Thao tác này không thể hoàn tác.`,
        confirmText: '🔥 Xóa Ngay',
        cancelText: 'Hủy',
        onConfirm: async () => {
            const sess = await checkDashAuth();
            const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
            try {
                const resp = await fetch(`${syncUrl}/api/admin/delete-user-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_token: sess.token, target_username: username })
                });
                const res = await resp.json();
                if (res.ok) {
                    showToast('✅ Đã xóa sạch dữ liệu Cloud!');
                    fetchAdminUserList();
                    document.getElementById('admin-detail-empty').style.display = 'block';
                    document.getElementById('admin-detail-content').style.display = 'none';
                } else showToast('❌ Lỗi: ' + res.error);
            } catch(e) { showToast('❌ Lỗi server.'); }
        }
    });
}

setInterval(async () => {
    if (typeof configSyncEnabled !== 'undefined' && configSyncEnabled) {
        const sess = await checkDashAuth();
        if (!sess) return;
        
        try {
            const syncUrl = sess.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
            const url = `${syncUrl}/api/download?username=${encodeURIComponent(sess.username)}&token=${encodeURIComponent(sess.token)}`;
            const resp = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            const res = await resp.json();
            if (res.ok && res.shops) {
                const cloudIds = Object.keys(res.shops);
                const localIds = Object.keys(shops || {});
                
                // Chỉ cập nhật nếu có shop mới ở Cloud mà máy này chưa có
                const hasNew = cloudIds.some(id => !localIds.includes(id));
                if (hasNew) {
                    // Cập nhật local - Chuẩn hóa dữ liệu từ Cloud (Dùng key từ Cloud làm seller_id)
                    let rawShops = res.shops || {};
                    Object.keys(rawShops).forEach(key => {
                        upsertShopRecord(rawShops[key], key);
                    });
                    shopOrder = (res.order || Object.keys(shops))
                        .map(k => Object.keys(shops).find(x => x === k || shops[x].aadvid === k || shops[x].seller_id === k || shops[x].oec_seller_id === k) || k)
                        .filter((k, idx, arr) => shops[k] && arr.indexOf(k) === idx);
                    await saveShops();
                    renderAll();
                    showToast(`✨ CRM: Phát hiện ${cloudIds.length - localIds.length} shop mới từ Cloud!`);
                }
            }
        } catch (e) {
            console.error('[Sync] Polling error:', e);
        }
    }
}, 5 * 60 * 1000); // 5 phút quét 1 lần

// ===== MASTER ADMIN: FUNCTIONS =====

async function adminDeleteUser(username) {
    if (username === 'admin') return alert('Cấm xóa Master Admin');
    if (!confirm(`XÓA VĨNH VIỄN tài khoản "${username}" và TOÀN BỘ dữ liệu của họ? Hành động này không thể hoàn tác.`)) return;
    
    try {
        const sess = await checkDashAuth();
        const res = await callBackend('/api/admin/delete-user-data', { 
            admin_token: sess.token,
            target_username: username 
        });
        if (res.ok || res.success) {
            showToast('✅ Đã xóa vĩnh viễn user: ' + username);
            fetchAdminUserList();
            const modal = document.getElementById('modal-view-user-shops');
            if (modal) modal.style.display = 'none';
        } else {
            showToast('❌ Lỗi: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi server khi xóa user.');
    }
}

async function adminDeleteUserSpecificShop(username, key) {
    if (!confirm(`Xóa shop này khỏi tài khoản Cloud của user ${username}?`)) return;
    try {
        const sess = await checkDashAuth();
        const res = await callBackend('/api/admin/remove-shops', { 
            admin_token: sess.token,
            target_username: username,
            shop_keys: [key] 
        });
        if (res.ok || res.success) {
            showToast('✅ Đã xóa shop khỏi Cloud thành công!');
            viewUserShops(username); // Load lại danh sách shop của user đó
        } else {
            showToast('❌ Lỗi: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi kết nối: ' + e.message);
    }
}

async function adminDeleteUserCloud(username) {
    if (!confirm(`Xóa TẤT CẢ shop trên Cloud của user ${username}?`)) return;
    try {
        const sess = await checkDashAuth();
        const res = await callBackend('/api/admin/remove-shops', { 
            admin_token: sess.token,
            target_username: username,
            delete_all: true 
        });
        if (res.ok || res.success) {
            showToast('✅ Đã dọn sạch Cloud của ' + username);
            viewUserShops(username);
        } else {
            showToast('❌ Lỗi: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi server.');
    }
}

async function adminResetPassword(un) {
    const newPw = prompt(`Nhập mật khẩu MỚI cho user ${un}:`);
    if (!newPw) return;
    try {
        const sess = await checkDashAuth();
        const res = await callBackend('/api/admin/reset-password', { 
            admin_token: sess.token,
            target_username: un, 
            new_password: newPw
        });
        if (res.ok || res.success) {
            showToast(`✅ Đã đổi mật khẩu cho ${un}`);
        } else {
            showToast('❌ Lỗi: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi server.');
    }
}

async function adminChangeRole(username, currentRole) {
    const newRole = (currentRole || 'user') === 'admin' ? 'user' : 'admin';
    const actionLabel = newRole === 'admin' ? 'NÂNG CẤP LÊN ADMIN' : 'HẠ CẤP XUỐNG USER';
    if (!confirm(`XÁC NHẬN: ${actionLabel} cho tài khoản "${username}"?`)) return;
    try {
        const sess = await checkDashAuth();
        const res = await callBackend('/api/register', { 
            admin_token: sess.token,
            username: username, 
            role: newRole,
            update_role: true
        });
        if (res.ok || res.success) {
            showToast(`✅ Đã đổi quyền ${username} thành ${newRole.toUpperCase()}`);
            fetchAdminUserList();
            viewUserShops(username); 
        } else {
            showToast('❌ Lỗi: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi kết nối.');
    }
}

async function adminDeleteShops() {
    const selected = [];
    document.querySelectorAll('.manage-shop-check:checked').forEach(cb => selected.push(cb.dataset.key));
    if (selected.length === 0) return showToast('⚠️ Chọn ít nhất 1 shop để xóa');
    
    if (!confirm(`Xóa ${selected.length} shop đã chọn khỏi Cloud & Máy này?`)) return;

    try {
        const res = await removeShopsFromOwnCloud(selected);
        if (res.ok || res.success) {
            selected.forEach(k => {
                removeLocalShopState(k);
            });
            saveShops();
            renderAll();
            const modal = document.getElementById('modal-manage-shops');
            if (modal) modal.style.display = 'none';
            showToast(`✅ Đã xóa ${selected.length} shop(s)`);
        } else {
            showToast('❌ Lỗi: ' + res.error);
        }
    } catch (e) {
        showToast('❌ Lỗi: ' + e.message);
    }
}

async function adminDeleteLocalShop(key) {
    await deleteShopLocalOnly(key, { confirmFirst: true, rerenderManage: true });
}

async function adminDeleteCloudShop(key) {
    await deleteShopCloudAndLocal(key, { confirmFirst: true, rerenderManage: true });
}

// ===== REPORT TAB: SORTING =====
function renderReportShopList(filterText = '') {
    const container = document.getElementById('rp-shop-list');
    if (!container) return;

    let list = shopOrder.filter(k => shops[k]);
    if (filterText) {
        const query = filterText.toLowerCase();
        list = list.filter(k => (shops[k].name || '').toLowerCase().includes(query));
    }

    list.sort((a, b) => {
        let mA = dashGetShopMetrics(a), mB = dashGetShopMetrics(b);
        if (currentRpSort === 'name') return mA.name.localeCompare(mB.name, 'vi');
        if (currentRpSort === 'active') return mB.active - mA.active || mA.name.localeCompare(mB.name, 'vi');
        if (currentRpSort === 'gmv') return mB.totalGmv - mA.totalGmv || mA.name.localeCompare(mB.name, 'vi');
        if (currentRpSort === 'roi') return mB.roi - mA.roi || mB.totalGmv - mA.totalGmv;
        if (currentRpSort === 'orders') return mB.totalOrders - mA.totalOrders || mB.totalGmv - mA.totalGmv;
        return 0;
    });

    if (window.rpRenderManualList) window.rpRenderManualList(list);
}
window.renderReportShopList = renderReportShopList;

// ===== GUIDE MODAL =====
function openGuide() {
    const guideUrl = chrome.runtime.getURL('pages/guide.html');
    chrome.tabs.create({ url: guideUrl, active: true });
}
function closeGuide() {
    const modal = document.getElementById('modal-guide');
    if (modal) modal.style.display = 'none';
}
window.openGuide = openGuide; 
window.closeGuide = closeGuide;

/**
 * Utility: Gọi API Sync Server (Hỗ trợ Admin)
 */
async function callBackend(endpoint, body = {}) {
    try {
        const sess = await chrome.storage.local.get(STORAGE_AUTH_KEY);
        const auth = sess[STORAGE_AUTH_KEY] || {};
        const syncUrl = auth.syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
        
        const response = await fetch(`${syncUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            return { ok: false, error: err.error || 'Server error' };
        }
        return await response.json();
    } catch (e) {
        console.error('[callBackend] Error:', e);
        return { ok: false, error: 'Kết nối server thất bại' };
    }
}
