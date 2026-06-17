// Strange TTS Solution & CRM TT AI — Login Popup JS
// Auth token GIỐNG HỆT STRANGE TTS AI DATA/App.py:
//   sha256(username-SECRET-YYYY-MM-DD)[:16]
// + SSO: đọc URL tab STRANGE TTS AI DATA → tự đăng nhập
// + Đăng ký: gọi /api/register trên sync server
// =============================================

const AUTH_SECRET   = ''; // App build: no shared auth secret in client source.
const SESSION_TTL   = 7 * 24 * 60 * 60 * 1000;
const STORAGE_AUTH  = 'strangetts_v30_auth';
const SYNC_URL_KEY  = 'strangetts_v30_sync_url';
const SHOP_VIDEO_TOGGLE_KEY = 'strangetts_shop_video_enabled';
const VIDEO_TOOLS_SETTINGS_KEY = 'ext_settings';
const UI_THEME_KEY = 'strangetts_ui_theme';
const STRANGETTS_AI_DATA_URL = 'https://cartridges-warranty-management-incentive.trycloudflare.com';
const STRANGETTS_LOCAL_APP_MODE = true;
const STRANGETTS_LOCAL_SESSION_TTL = 365 * 24 * 60 * 60 * 1000;

function localAppSession() {
  return {
    username: 'local-admin',
    role: 'admin',
    display: 'Strange',
    token: `local-pc-app-${chrome.runtime.id || 'runtime'}`,
    syncUrl: 'https://cartridges-warranty-management-incentive.trycloudflare.com',
    serverAuth: true,
    localAppMode: true,
    expiry: Date.now() + STRANGETTS_LOCAL_SESSION_TTL,
    loginAt: Date.now()
  };
}

async function ensureLocalAppSession() {
  const sess = localAppSession();
  await chrome.storage.local.set({ [STORAGE_AUTH]: sess });
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'STRANGETTS_AUTH_UPDATED' }).catch(() => {});
    });
  });
  return sess;
}

// Token là UUID ngẫu nhiên do SERVER cấp khi login — không tự tính client-side
// (Giữ sha256 để SSO STRANGE TTS AI DATA compat)
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function getSession() {
  const store = await chrome.storage.local.get(STORAGE_AUTH);
  const sess = store[STORAGE_AUTH];
  if (!sess || !sess.username || !sess.token || !sess.expiry) {
    return STRANGETTS_LOCAL_APP_MODE ? ensureLocalAppSession() : null;
  }
  if (sess.serverAuth !== true) {
    await chrome.storage.local.remove(STORAGE_AUTH);
    return STRANGETTS_LOCAL_APP_MODE ? ensureLocalAppSession() : null;
  }
  if (Date.now() > sess.expiry) {
    await chrome.storage.local.remove(STORAGE_AUTH);
    return STRANGETTS_LOCAL_APP_MODE ? ensureLocalAppSession() : null;
  }
  // Token là UUID server-issued — chỉ kiểm tra expiry, không verify locally
  return sess;
}

async function setSession(username, role, display, serverToken, syncUrl) {
  // serverToken: UUID ngẫu nhiên do server cấp
  await chrome.storage.local.set({
    [STORAGE_AUTH]: {
      username, role, display,
      token: serverToken,   // UUID server-issued
      syncUrl: syncUrl || 'https://cartridges-warranty-management-incentive.trycloudflare.com',
      serverAuth: true,
      expiry: Date.now() + SESSION_TTL,
      loginAt: Date.now()
    }
  });
  // Notify content scripts
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'STRANGETTS_AUTH_UPDATED' }).catch(() => {});
    });
  });
}

async function clearSession() {
  // 1. Xóa session auth
  await chrome.storage.local.remove(STORAGE_AUTH);
  
  // 2. Xóa TOÀN BỘ dữ liệu shop để không bị lộ khi user khác log vào
  const keysToClear = [
    'strangetts_multi_shops', 'strangetts_shop_order', 'strangetts_rp_config', 
    'rpConfig', 'rp_config', 'shop_cache', 'strangetts_report_stats'
  ];
  await chrome.storage.local.remove(keysToClear);
  
  // 3. Thông báo cho các tab mở (Dashboard) để xóa RAM ngay lập tức
  chrome.runtime.sendMessage({ action: 'STRANGETTS_LOGOUT_EVENT' });
  
  console.log('[STRANGE TTS] Session & Data cleared — Broadcasted logout event');
}

// ── UI Helpers ───────────────────────────────────────────────────────────────
function showMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `msg msg-${type} show`;
}

/**
 * ── STRANGE TTS CUSTOM MODAL ──
 * Thay thế confirm() và alert() bằng giao diện Glassmorphism
 */
function strangettsModal({ title, body, icon = '💡', confirmText = 'OK', cancelText = '', inputPlaceholder = '', inputType = 'password', onConfirm, onCancel }) {
  // 1. Tạo overlay nếu chưa có
  let overlay = document.querySelector('.strangetts-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'strangetts-modal-overlay';
    overlay.innerHTML = `
      <div class="strangetts-modal">
        <span class="strangetts-modal-icon"></span>
        <div class="strangetts-modal-title"></div>
        <div class="strangetts-modal-body"></div>
        <div class="strangetts-modal-input-container" style="display:none; margin:15px 0">
          <input type="password" class="strangetts-modal-input" style="width:100%; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:#fff; outline:none">
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
  const inputContainer = modal.querySelector('.strangetts-modal-input-container');
  const inputEl = modal.querySelector('.strangetts-modal-input');

  // 2. Set content
  modal.querySelector('.strangetts-modal-icon').textContent = icon;
  modal.querySelector('.strangetts-modal-title').textContent = title;
  modal.querySelector('.strangetts-modal-body').textContent = body;
  btnConfirm.textContent = confirmText;
  
  if (inputPlaceholder) {
    inputContainer.style.display = 'block';
    inputEl.type = inputType || 'text';
    inputEl.placeholder = inputPlaceholder;
    inputEl.value = '';
    inputEl.onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        modal.querySelector('.strangetts-modal-confirm')?.click();
      }
    };
    setTimeout(() => inputEl.focus(), 150);
  } else {
    inputContainer.style.display = 'none';
    inputEl.type = 'password';
    inputEl.onkeydown = null;
  }

  if (cancelText) {
    btnCancel.textContent = cancelText;
    btnCancel.style.display = 'flex';
  } else {
    btnCancel.style.display = 'none';
  }

  // 3. Show
  overlay.classList.add('show');

  // 4. Events
  const cleanup = () => {
    overlay.classList.remove('show');
    // Remove listeners to avoid memory leaks/double calls
    const newConfirm = btnConfirm.cloneNode(true);
    const newCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newCancel, btnCancel);
  };

  modal.querySelector('.strangetts-modal-confirm').onclick = () => {
    const result = inputPlaceholder ? inputEl.value : true;
    cleanup();
    if (onConfirm) onConfirm(result);
  };

  modal.querySelector('.strangetts-modal-cancel').onclick = () => {
    cleanup();
    if (onCancel) onCancel();
  };
}

function strangettsAlert(title, body, icon = 'ℹ️') {
  strangettsModal({ title, body, icon });
}

function popupBgMessage(payload) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(payload, res => {
        const err = chrome.runtime.lastError;
        if (err) resolve({ ok: false, error: err.message });
        else resolve(res || { ok: false, error: 'Không có phản hồi' });
      });
    } catch (err) {
      resolve({ ok: false, error: err?.message || String(err) });
    }
  });
}

function popupSafeFilePart(v, fallback = 'video') {
  return String(v || fallback)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || fallback;
}

function normalizeTikTokUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

function applyPopupTheme(theme) {
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

async function initPopupThemeToggle() {
  const store = await chrome.storage.local.get({ [UI_THEME_KEY]: 'dark' });
  applyPopupTheme(store[UI_THEME_KEY]);

  document.getElementById('btn-theme-toggle')?.addEventListener('click', async () => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const nextTheme = current === 'light' ? 'dark' : 'light';
    await chrome.storage.local.set({ [UI_THEME_KEY]: nextTheme });
    applyPopupTheme(nextTheme);
  });
}

// ── SSO: Đọc tab STRANGE TTS AI DATA đang mở, tự đăng nhập extension ─────────────
// STRANGE TTS AI DATA lưu auth vào URL: ?auth_user=USERNAME&token=TOKEN
// Token GIỐNG HỆT → chỉ cần verify là xong
async function trySSOFromWebTool() {
  // Server-only auth: extension không tự đăng nhập từ URL token nữa.
  // User phải đăng nhập qua /api/login để nhận server session UUID.
  return null;
}

// ── SSO: Sau khi login extension → mở STRANGE TTS AI DATA đã đăng nhập sẵn ───────
async function openStrangeTTSAiData(username) {
  let url = STRANGETTS_AI_DATA_URL;
  if (username) {
    const token = await legacyToken(username);
    url = `${STRANGETTS_AI_DATA_URL}/?auth_user=${encodeURIComponent(username)}&token=${token}`;
  }

  chrome.tabs.create({ url, active: true }, () => {
    if (chrome.runtime.lastError) {
      strangettsAlert('Không mở được STRANGE TTS AI DATA', chrome.runtime.lastError.message || 'Chrome chặn mở tab mới.', '⚠️');
      return;
    }
    window.close();
  });
}

// ── RENDER: Login Form ───────────────────────────────────────────────────────
function renderLogin() { showSection('section-login'); }

function renderTerms() { showSection('section-terms'); }

function setTermsAccepted(accepted) {
  const top = document.getElementById('terms-accept');
  const bottom = document.getElementById('terms-accept-bottom');
  if (top) top.checked = accepted;
  if (bottom) bottom.checked = accepted;
}

function isTermsAccepted() {
  return document.getElementById('terms-accept')?.checked === true;
}

// ── RENDER: Register Form ────────────────────────────────────────────────────
function renderRegister() {
  showSection('section-register');
  showMsg('reg-msg', 'Tính năng đăng ký trực tiếp đã tắt. Vui lòng liên hệ Telegram @my_telegram_bot để nhận tài khoản: https://t.me/my_telegram_bot', 'info');
}

// ── RENDER: Menu sau đăng nhập ────────────────────────────────────────────────
async function renderMenu(sess) {
  document.getElementById('menu-user-name').textContent = sess.display || sess.username;
  document.getElementById('menu-user-role').textContent = sess.role === 'admin' ? '👑 Admin' : '👤 User';
  document.getElementById('menu-avatar-letter').textContent = (sess.display || sess.username)[0].toUpperCase();

  const webBtn = document.getElementById('btn-open-web');
  if (webBtn) webBtn.style.display = '';

  const adminBtn = document.getElementById('btn-admin');
  if (adminBtn) adminBtn.style.display = 'none'; // V30: Always hide, moved to dash tab
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn && STRANGETTS_LOCAL_APP_MODE) logoutBtn.style.display = 'none';

  showSection('section-menu');
  
  // Điền dropdown shop sau khi hiện menu
  await renderShopDropdown();
}

// ── RENDER: Shop Dropdown (Chọn nhanh) ───────────────────────────────
async function renderShopDropdown() {
  const wrap = document.getElementById('shop-quick-select-wrap');
  const sel = document.getElementById('shop-quick-select');
  if (!wrap || !sel) return;

  const store = await chrome.storage.local.get(['strangetts_multi_shops', 'strangetts_shop_order']);
  const shops = store.strangetts_multi_shops || {};
  const order = store.strangetts_shop_order || Object.keys(shops);

  const keys = order.filter(k => shops[k]);
  if (keys.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  sel.innerHTML = '<option value="">—— Chọn Shop Để Mở ——</option>';
  keys.forEach(k => {
    const s = shops[k];
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = (s.name || s.shopRealName || k).slice(0, 40);
    sel.appendChild(opt);
  });

  // Xóa listener cũ, rồi add mới
  const newSel = sel.cloneNode(true);
  sel.parentNode.replaceChild(newSel, sel);
  newSel.addEventListener('change', async () => {
    const key = newSel.value;
    if (!key) return;
    newSel.value = ''; // reset về placeholder sau khi chọn

    const sh = shops[key];
    const sellerId = sh?.oec_seller_id || sh?.seller_id || '';
    if (!sellerId) {
      strangettsModal({ title: 'Thông báo', body: 'Shop này chưa có Seller ID.\nVui lòng xuất lại trên trang Seller Ads.', icon: '⚠️', confirmText: 'Đã hiểu' });
      return;
    }
    // Mở Seller Ads cho shop này
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const url = `https://seller-vn.tiktok.com/ads-creation/dashboard?shop_id=${sellerId}&type=product&shop_region=VN&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${s}&list_end_date=${e}`;
    chrome.tabs.create({ url, active: true });
    window.close();
  });
}

// ── RENDER: Admin Panel ──────────────────────────────────────────────────────
// --- Master Admin Logic moved to dashboard.js in V30 ---


// ── RENDER: Admin Panel (stub — moved to dashboard in V30) ─────────────────
async function renderAdminPanel() {
  // Admin panel đã được chuyển vào dashboard.js
  // Popup chỉ giữ stub này để tránh crash khi doAddUser gọi
  console.log('[Strange TTS] renderAdminPanel: noop in V30 popup');
}

// ── RENDER: Cloud Sync Panel ─────────────────────────────────────────────────
async function renderSyncPanel() {
  showSection('section-sync');
  const url = (await chrome.storage.local.get(SYNC_URL_KEY))[SYNC_URL_KEY] || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
  const inp = document.getElementById('sync-url');
  if (inp && url) inp.value = url;

  // Điền trạng thái auto-sync toggle
  const store = await chrome.storage.local.get('strangetts_auto_sync_cloud');
  const toggle = document.getElementById('popup-auto-sync-toggle');
  if (toggle) {
    toggle.checked = store.strangetts_auto_sync_cloud === true;
    toggle.addEventListener('change', async (e) => {
      await chrome.storage.local.set({ strangetts_auto_sync_cloud: e.target.checked });
      console.log('[Popup] Auto-sync:', e.target.checked ? 'BẬT' : 'TẮT');
    });
  }
}

// ── ACTION: Đăng nhập ──────────────────────────────────────────────────────
async function doLogin() {
  const user = document.getElementById('inp-user')?.value.trim().toLowerCase();
  const pass = document.getElementById('inp-pass')?.value;
  if (!user || !pass) return showMsg('login-msg', '⚠️ Vui lòng nhập đầy đủ!', 'error');
  if (!isTermsAccepted()) return showMsg('login-msg', '⚠️ Vui lòng đọc và đồng ý Điều khoản sử dụng trước khi đăng nhập.', 'error');

  const syncUrl = (await chrome.storage.local.get(SYNC_URL_KEY))[SYNC_URL_KEY] || 'https://cartridges-warranty-management-incentive.trycloudflare.com';

  try {
    showMsg('login-msg', '⏳ Đang xác thực trên server...', 'info');
    const resp = await fetch(`${syncUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
      signal: AbortSignal.timeout(30000)
    });
    if (!resp.ok) {
      if (resp.status === 401) {
        const json = await resp.json().catch(() => ({}));
        return showMsg('login-msg', `❌ ${json.error || 'Sai tài khoản hoặc mật khẩu!'}`, 'error');
      }
      return showMsg('login-msg', `❌ Lỗi máy chủ đường truyền (Mã lỗi mạng: ${resp.status}). Vui lòng báo Admin bật lại Server.`, 'error');
    }
    const json = await resp.json().catch(() => ({}));
    if (json.ok && json.token) {
      await setSession(user, json.role || 'user', json.display || json.username || user, json.token, syncUrl);
      await chrome.storage.local.remove('strangetts_v30_credentials');
      showMsg('login-msg', '✅ Đăng nhập thành công!', 'success');
      chrome.runtime.sendMessage({ action: 'STRANGETTS_LOGIN_SUCCESS', username: user });
      setTimeout(() => renderMenu({ username: user, role: json.role || 'user', display: json.display || user }), 400);
      return;
    }
    return showMsg('login-msg', `❌ Lỗi dữ liệu trả về từ server!`, 'error');
  } catch (e) {
    if (e.name === 'TimeoutError') {
      return showMsg('login-msg', `❌ Không kết nối được server (Quá hạn thời gian chờ đường truyền)`, 'error');
    }
    return showMsg('login-msg', `❌ Không kết nối được server: ${e.message}`, 'error');
  }
}

// ── ACTION: Đăng ký ──────────────────────────────────────────────────────────
async function doRegister() {
  showMsg('reg-msg', 'Tính năng đăng ký trực tiếp đã tắt. Vui lòng liên hệ Telegram @my_telegram_bot để nhận tài khoản: https://t.me/my_telegram_bot', 'info');
}

// ── ACTION: Đăng xuất ────────────────────────────────────────────────────────
async function doLogout() {
  strangettsModal({
    title: 'Đăng Xuất',
    body: 'Bạn có chắc chắn muốn đăng xuất và XÓA TOÀN BỘ dữ liệu shop trên máy này để bảo mật?',
    icon: '🚪',
    confirmText: 'ĐĂNG XUẤT',
    cancelText: 'HỦY',
    onConfirm: async () => {
      await clearSession(); 
      renderLogin();
    }
  });
}

// ── ACTION: Mở Seller Ads ────────────────────────────────────────────────────
function openSellerAds() {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
  const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
  chrome.tabs.create({ url: `https://seller-vn.tiktok.com/ads-creation/dashboard?type=product&shop_region=VN&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${s}&list_end_date=${e}`, active: true });
  window.close();
}

async function openGuide() {
  const guideUrl = chrome.runtime.getURL('pages/guide.html');
  const tabs = await chrome.tabs.query({});
  const found = tabs.find(t => t.url && t.url.startsWith(guideUrl));
  if (found) {
    chrome.tabs.update(found.id, { active: true });
    chrome.windows.update(found.windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: guideUrl, active: true });
  }
  window.close();
}

function popupDownloadErrorText(err) {
  const msg = String(err || '').trim();
  if (!msg) return 'Strange TTS chưa lấy được video này.';
  if (/tikwm|api|http/i.test(msg)) return 'Strange TTS chưa lấy được video này, thử lại sau hoặc đổi link.';
  return msg;
}

async function downloadTikTokVideoByUrl(rawUrl) {
  const full = normalizeTikTokUrl(rawUrl);
  if (!full || !/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(full)) {
    strangettsAlert('Thiếu link TikTok', 'Dán link TikTok hợp lệ rồi thử lại.', '⚠️');
    return;
  }

  strangettsAlert('Strange TTS đang tải video', 'Strange TTS đang tải video của bạn...', '⏳');
  const fetchRes = await popupBgMessage({ action: 'STRANGETTS_TIKWM_FETCH', url: full });
  if (!fetchRes?.ok || !fetchRes.data) {
    strangettsAlert('Không lấy được video', popupDownloadErrorText(fetchRes?.error), '❌');
    return;
  }

  const d = fetchRes.data || {};
  const downloadUrl = d.hdplay || d.play;
  if (!downloadUrl) {
    strangettsAlert('Không có link tải', 'Strange TTS chưa lấy được video no-logo cho link này.', '❌');
    return;
  }

  const id = d.id || (full.match(/\/video\/(\d+)/)?.[1]) || Date.now();
  const title = popupSafeFilePart(d.title || id, 'tiktok-video');
  const filename = `STRANGETTS_Downloads/${id}_${title}.mp4`;
  const dlRes = await popupBgMessage({ action: 'STRANGETTS_DOWNLOAD_FILE', url: downloadUrl, filename });
  if (!dlRes?.ok) {
    strangettsAlert('Tải thất bại', dlRes?.error || 'Chrome không nhận lệnh tải.', '❌');
    return;
  }
  strangettsAlert('Đã gửi lệnh tải', 'Video đang được tải trong Chrome Downloads.', '✅');
}

function openVideoDownloadPrompt() {
  strangettsModal({
    title: 'Tải video TikTok',
    body: 'Dán link video TikTok cần tải không logo.',
    icon: '⬇️',
    confirmText: 'Tải video',
    cancelText: 'Hủy',
    inputPlaceholder: 'https://www.tiktok.com/@.../video/...',
    inputType: 'url',
    onConfirm: downloadTikTokVideoByUrl
  });
}

// ── ACTION: Thêm user (Admin) ────────────────────────────────────────────────
async function doAddUser() {
  showMsg('admin-msg', 'Quản lý tài khoản chỉ thực hiện trên server/admin dashboard.', 'info');
}


// ── Legacy token helper (tương thích server cũ) ───────────────────────────────
async function legacyToken(username) {
  if (!AUTH_SECRET) return '';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  return (await sha256(`${username}-${AUTH_SECRET}-${today}`)).slice(0, 16);
}

// ── ACTION: Cloud Sync Upload ─────────────────────────────────────────────────
async function doSyncUpload() {
  const syncUrl = document.getElementById('sync-url')?.value.trim();
  if (!syncUrl) return showMsg('sync-msg', '⚠️ Chưa nhập Server URL!', 'error');
  const sess = await getSession();
  if (!sess) return showMsg('sync-msg', '⚠️ Chưa đăng nhập!', 'error');

  const btn = document.getElementById('btn-sync-upload');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang upload...'; }

  await chrome.storage.local.set({ [SYNC_URL_KEY]: syncUrl });
  const store = await chrome.storage.local.get(['strangetts_multi_shops', 'strangetts_shop_order']);
  const shops = store.strangetts_multi_shops || {};
  const order = store.strangetts_shop_order || Object.keys(shops);

  if (Object.keys(shops).length === 0) {
    if (btn) { btn.disabled = false; btn.textContent = '☁️ Upload lên Cloud'; }
    return showMsg('sync-msg', '⚠️ Không có shop nào để upload!', 'error');
  }

  setSyncStatus('syncing', 'Đang upload...');
  showMsg('sync-msg', '☁️ Đang gửi dữ liệu lên cloud...', 'info');
  try {
    let resp = await fetch(`${syncUrl}/api/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: sess.username, 
        token: sess.token, 
        shops, order, 
        uploaded_at: new Date().toISOString() 
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.ok) {
      setSyncStatus('ok', `OK lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      showMsg('sync-msg', `✅ Đã upload ${Object.keys(shops).length} shop(s)!`, 'success');
    } else throw new Error(json.error || 'Server từ chối');
  } catch (e) {
    setSyncStatus('err', 'Lỗi');
    showMsg('sync-msg', `❌ Upload thất bại: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '☁️ Upload lên Cloud'; }
  }
}

// ── ACTION: Cloud Sync Download ───────────────────────────────────────────────
async function doSyncDownload() {
  const syncUrl = document.getElementById('sync-url')?.value.trim();
  if (!syncUrl) return showMsg('sync-msg', '⚠️ Chưa nhập Server URL!', 'error');
  const sess = await getSession();
  if (!sess) return showMsg('sync-msg', '⚠️ Chưa đăng nhập!', 'error');

  await chrome.storage.local.set({ [SYNC_URL_KEY]: syncUrl });

  const btn = document.getElementById('btn-sync-download');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải...'; }

  setSyncStatus('syncing', 'Đang tải...');
  showMsg('sync-msg', '⬇️ Đang tải dữ liệu từ cloud...', 'info');
  try {
    const resp = await fetch(
      `${syncUrl}/api/download?username=${encodeURIComponent(sess.username)}&token=${encodeURIComponent(sess.token)}`
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Không có dữ liệu');

    const { shops, order } = json;
    if (!shops || !Object.keys(shops).length) {
      if (btn) { btn.disabled = false; btn.textContent = '⬇️ Tải từ Cloud'; }
      return showMsg('sync-msg', '⚠️ Cloud chưa có dữ liệu!', 'error');
    }

    // Sửa lỗi: Nếu order rỗng [] thì phải lấy Object.keys để hiện shop
    const finalOrder = (order && order.length > 0) ? order : Object.keys(shops);
    await chrome.storage.local.set({ strangetts_multi_shops: shops, strangetts_shop_order: finalOrder });
    setSyncStatus('ok', `OK lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    showMsg('sync-msg', `✅ Đã tải ${Object.keys(shops).length} shop(s) từ cloud!`, 'success');

    // Cập nhật lại dropdown shop
    await renderShopDropdown();
  } catch (e) {
    setSyncStatus('err', 'Lỗi');
    showMsg('sync-msg', `❌ Download thất bại: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇️ Tải từ Cloud'; }
  }
}

// ── ACTION: Xóa dữ liệu trên Cloud ────────────────────────────────────
async function doSyncDelete() {
  const syncUrl = document.getElementById('sync-url')?.value.trim();
  if (!syncUrl) return showMsg('sync-msg', '⚠️ Chưa nhập Server URL!', 'error');
  const sess = await getSession();
  if (!sess) return showMsg('sync-msg', '⚠️ Chưa đăng nhập!', 'error');

  strangettsModal({
    title: 'Xóa dữ liệu Cloud',
    body: 'Bạn có chắc muốn XÓA TOÀN BỘ shop data trên cloud?\nHành động này KHÔNG thể hoàn tác.',
    icon: '🗑️',
    confirmText: 'XÓA CLOUD',
    cancelText: 'HỦY',
    onConfirm: async () => {
      const btn = document.getElementById('btn-sync-delete');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xóa...'; }
      showMsg('sync-msg', '🗑️ Đang xóa dữ liệu cloud...', 'info');
      try {
        const resp = await fetch(`${syncUrl}/api/remove-shops`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: sess.token,
            delete_all: true
          })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (json.ok) {
          setSyncStatus('ok', 'Cloud đã xóa');
          showMsg('sync-msg', '✅ Đã xóa toàn bộ dữ liệu trên cloud!', 'success');
        } else throw new Error(json.error || 'Server từ chối');
      } catch (e) {
        showMsg('sync-msg', `❌ Xóa thất bại: ${e.message}`, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🗑️ Xóa toàn bộ dữ liệu trên Cloud'; }
      }
    }
  });
}

function setSyncStatus(type, text) {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-status-text');
  if (dot) dot.className = `sync-dot ${type}`;
  if (txt) txt.textContent = text;
}

async function setShopVideoToggleUI(enabled) {
  const btn = document.getElementById('btn-shop-video-toggle');
  const txt = document.getElementById('shop-video-toggle-text');
  const icon = document.getElementById('shop-video-toggle-icon');
  if (!btn) return;
  btn.classList.toggle('is-on', !!enabled);
  btn.classList.toggle('is-off', !enabled);
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  btn.title = enabled
    ? 'Đang bật: module xem video TikTok Shop gắn giỏ cũ của STRANGE TTS'
    : 'Đang tắt: module xem video TikTok Shop gắn giỏ cũ của STRANGE TTS';
  if (txt) txt.textContent = `Xem video gắn giỏ STRANGE TTS: ${enabled ? 'Bật' : 'Tắt'}`;
  if (icon) {
    icon.textContent = '';
    icon.className = `icon st-icon ${enabled ? 'st-icon-video' : 'st-icon-delete'}`;
  }
}

async function initShopVideoToggle() {
  const btn = document.getElementById('btn-shop-video-toggle');
  if (!btn) return;
  const store = await chrome.storage.local.get({ [SHOP_VIDEO_TOGGLE_KEY]: false });
  let enabled = store[SHOP_VIDEO_TOGGLE_KEY] !== false;
  await setShopVideoToggleUI(enabled);
  btn.addEventListener('click', async () => {
    enabled = !enabled;
    await chrome.storage.local.set({ [SHOP_VIDEO_TOGGLE_KEY]: enabled });
    await setShopVideoToggleUI(enabled);
    chrome.tabs.query({ url: ['*://*.tiktok.com/*'] }, tabs => {
      tabs.forEach(tab => {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'STRANGETTS_SHOP_VIDEO_TOGGLE', enabled }).catch(() => {});
      });
    });
  });
}

function videoToolsDefaultSettings() {
  return {
    autoScroll: false,
    backgroundPlay: true,
    autoPiP: false,
    unlockShopVideo: true,
    productViewer: true,
    volumeNormalizer: false,
    cleanVideoMode: false,
    playbackSpeed: 1,
    kocEnabled: false,
    aiProvider: 'deepseek-flash',
    aiApiKey: '',
    theme: 'dark',
    language: 'vi'
  };
}

async function getVideoToolsSettings() {
  const store = await chrome.storage.sync.get(VIDEO_TOOLS_SETTINGS_KEY);
  return { ...videoToolsDefaultSettings(), ...(store[VIDEO_TOOLS_SETTINGS_KEY] || {}) };
}

async function setProductViewerToggleUI(enabled) {
  const btn = document.getElementById('btn-product-viewer-toggle');
  const txt = document.getElementById('product-viewer-toggle-text');
  const icon = document.getElementById('product-viewer-toggle-icon');
  if (!btn) return;
  btn.classList.toggle('is-on', !!enabled);
  btn.classList.toggle('is-off', !enabled);
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  btn.title = enabled
    ? 'Đang bật: hiện tên, giá và link sản phẩm trên video TikTok'
    : 'Đang tắt: bấm để bật hiển thị sản phẩm trên video TikTok';
  if (txt) txt.textContent = `Xem sản phẩm: ${enabled ? 'Bật' : 'Tắt'}`;
  if (icon) {
    icon.textContent = '';
    icon.className = `icon st-icon ${enabled ? 'st-icon-tag' : 'st-icon-delete'}`;
  }
}

async function initProductViewerToggle() {
  const btn = document.getElementById('btn-product-viewer-toggle');
  if (!btn) return;
  let settings = await getVideoToolsSettings();
  let enabled = settings.productViewer !== false;
  await setProductViewerToggleUI(enabled);
  btn.addEventListener('click', async () => {
    enabled = !enabled;
    settings = { ...(await getVideoToolsSettings()), productViewer: enabled };
    await chrome.storage.sync.set({ [VIDEO_TOOLS_SETTINGS_KEY]: settings });
    await setProductViewerToggleUI(enabled);
  });
}

function videoToolSwitch(label, key, settings) {
  const checked = settings[key] !== false;
  return `
    <button type="button" class="video-setting-row" data-setting="${key}" aria-pressed="${checked ? 'true' : 'false'}">
      <span>${label}</span>
      <span class="video-setting-switch ${checked ? 'on' : ''}"><i></i></span>
    </button>
  `;
}

async function openVideoToolsSettings() {
  let overlay = document.querySelector('.video-tools-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'video-tools-overlay';
    overlay.innerHTML = `
      <div class="video-tools-modal">
        <div class="video-tools-head">
          <div>
            <div class="video-tools-title">Cài đặt xem video</div>
            <div class="video-tools-sub">STRANGE TTS</div>
          </div>
          <button type="button" class="video-tools-close" aria-label="Đóng">×</button>
        </div>
        <div class="video-tools-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.video-tools-close')) {
        overlay.classList.remove('show');
      }
    });
  }

  const settings = await getVideoToolsSettings();
  const body = overlay.querySelector('.video-tools-body');
  const speeds = [0.5, 1, 1.25, 1.5, 2, 3];
  body.innerHTML = `
    <section class="video-tools-card">
      <div class="video-tools-section">Tính năng</div>
      ${videoToolSwitch('Tự cuộn video', 'autoScroll', settings)}
      ${videoToolSwitch('Chạy nền khi đổi tab', 'backgroundPlay', settings)}
      ${videoToolSwitch('Tự bật Picture-in-Picture', 'autoPiP', settings)}
      ${videoToolSwitch('Ẩn giao diện TikTok', 'cleanVideoMode', settings)}
      ${videoToolSwitch('Mở video gắn giỏ', 'unlockShopVideo', settings)}
      ${videoToolSwitch('Xem sản phẩm', 'productViewer', settings)}
      ${videoToolSwitch('Cân bằng âm lượng', 'volumeNormalizer', settings)}
    </section>
    <section class="video-tools-card">
      <div class="video-tools-section video-tools-speed-head">
        <span>Tốc độ phát</span>
        <b>${settings.playbackSpeed || 1}x</b>
      </div>
      <div class="video-speed-grid">
        ${speeds.map(v => `<button type="button" class="${Number(settings.playbackSpeed || 1) === v ? 'active' : ''}" data-speed="${v}">${v}x</button>`).join('')}
      </div>
    </section>
  `;

  body.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.setting;
      const latest = await getVideoToolsSettings();
      latest[key] = latest[key] === false;
      await chrome.storage.sync.set({ [VIDEO_TOOLS_SETTINGS_KEY]: latest });
      if (key === 'productViewer') await setProductViewerToggleUI(latest[key] !== false);
      openVideoToolsSettings();
    });
  });

  body.querySelectorAll('[data-speed]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const latest = await getVideoToolsSettings();
      latest.playbackSpeed = Number(btn.dataset.speed) || 1;
      await chrome.storage.sync.set({ [VIDEO_TOOLS_SETTINGS_KEY]: latest });
      openVideoToolsSettings();
    });
  });

  overlay.classList.add('show');
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initPopupThemeToggle();

  // 1. Kiểm tra session cũ
  let sess = await getSession();

  // 2. Nếu chưa login → thử SSO từ tab STRANGE TTS AI DATA đang mở
  if (!sess) {
    sess = await trySSOFromWebTool();
    if (sess) showMsg('login-msg', `✅ Tự đăng nhập qua Web Tool!`, 'success');
  }

  if (sess) renderMenu(sess);
  else renderLogin();

  // Load sync URL đã lưu (Mặc định: localhost)
  const savedUrl = (await chrome.storage.local.get(SYNC_URL_KEY))[SYNC_URL_KEY] || 'https://cartridges-warranty-management-incentive.trycloudflare.com';
  if (savedUrl) { const inp = document.getElementById('sync-url'); if (inp) inp.value = savedUrl; }

  // ── Binding: Login ────────────────────────────────────────────────────────
  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('inp-user')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inp-pass')?.focus(); });
  document.getElementById('inp-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('btn-go-register')?.addEventListener('click', renderRegister);
  document.getElementById('btn-open-terms')?.addEventListener('click', e => {
    e.preventDefault();
    renderTerms();
  });
  document.getElementById('terms-accept')?.addEventListener('change', e => setTermsAccepted(e.target.checked));
  document.getElementById('terms-accept-bottom')?.addEventListener('change', e => setTermsAccepted(e.target.checked));
  document.getElementById('btn-back-terms')?.addEventListener('click', renderLogin);
  document.getElementById('btn-terms-done')?.addEventListener('click', () => {
    setTermsAccepted(true);
    renderLogin();
  });

  // ── Binding: Register ─────────────────────────────────────────────────────
  document.getElementById('btn-register')?.addEventListener('click', doRegister);
  document.getElementById('btn-go-login')?.addEventListener('click', renderLogin);
  document.getElementById('reg-pass2')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

  // ── Binding: Menu ─────────────────────────────────────────────────────────
  document.getElementById('btn-seller')?.addEventListener('click', openSellerAds);
  document.getElementById('btn-video-download')?.addEventListener('click', openVideoDownloadPrompt);
  initShopVideoToggle();
  initProductViewerToggle();
  document.getElementById('btn-video-tools-settings')?.addEventListener('click', openVideoToolsSettings);
  // Master Admin moved to dashboard
  document.getElementById('btn-sync-menu')?.addEventListener('click', renderSyncPanel);
  document.getElementById('btn-logout')?.addEventListener('click', doLogout);
  document.getElementById('btn-open-web')?.addEventListener('click', async () => {
    const s = await getSession();
    await openStrangeTTSAiData(s?.username || '');
  });

  // ── Binding: Guide ────────────────────────────────────────────────────────
  document.getElementById('btn-open-guide-login')?.addEventListener('click', openGuide);
  document.getElementById('btn-open-guide-menu')?.addEventListener('click', openGuide);

  // ── Binding: Admin (Obsolete in Popup for V30) ──

  // ── Binding: Sync ─────────────────────────────────────────────────────────
  document.getElementById('btn-back-sync')?.addEventListener('click', async () => { const s = await getSession(); if (s) renderMenu(s); });
  document.getElementById('btn-sync-upload')?.addEventListener('click', doSyncUpload);
  document.getElementById('btn-sync-download')?.addEventListener('click', doSyncDownload);
  document.getElementById('btn-sync-delete')?.addEventListener('click', doSyncDelete);
  document.getElementById('btn-sync-test')?.addEventListener('click', async () => {
    const url = document.getElementById('sync-url')?.value.trim();
    if (!url) return showMsg('sync-msg', '⚠️ Chưa nhập URL!', 'error');
    setSyncStatus('syncing', 'Đang kiểm tra...');
    try {
      // Server root trả HTML, không có /api/health JSON — chỉ check HTTP 200
      const resp = await fetch(`${url}/`, { signal: AbortSignal.timeout(30000) });
      if (resp.ok || resp.status === 200) {
        setSyncStatus('ok', 'Kết nối OK');
        showMsg('sync-msg', `✅ Server phản hồi! (HTTP ${resp.status})`, 'success');
      } else throw new Error(`HTTP ${resp.status}`);
    } catch (e) { setSyncStatus('err', 'Lỗi'); showMsg('sync-msg', `❌ Không kết nối: ${e.message}`, 'error'); }
  });
  document.getElementById('sync-url')?.addEventListener('blur', async () => {
    const url = document.getElementById('sync-url')?.value.trim();
    if (url) {
      await chrome.storage.local.set({ [SYNC_URL_KEY]: url });
      // Hiện nút STRANGE TTS AI DATA sau khi có URL
      const webBtn = document.getElementById('btn-open-web');
      if (webBtn) webBtn.style.display = '';
    }
  });

  // ── Global Password Toggle ────────────────────────────────────────────────
  document.addEventListener('click', e => {
    if (e.target.classList.contains('pw-toggle')) {
      const targetId = e.target.dataset.target;
      const input = document.getElementById(targetId) || e.target.previousElementSibling;
      if (input) {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        e.target.textContent = isPass ? '🙈' : '👁️';
      }
    }
  });
});
