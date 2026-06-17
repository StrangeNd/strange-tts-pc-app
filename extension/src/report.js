// Strange TTS Solution 1.0.0 — Report Tab
// 2-Section Design: ADS (period tabs) + SHOP (today/yesterday fixed)
// ==============================================

let rpData   = {};  // { aadvid: { status, today, yesterday, monthly, adsYesterday, adsMonth, stats7d, ads7d, balance, ... } }
let rpConfig = {};  // { aadvid: { groupId, targetRevenue, targetAdsPct, sendTime, autoSend, sheetsUrl } }
let rpPeriod = {};  // { aadvid: 'yd'|'7d'|'month' }
let rpZaloServer = 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
let rpPreviewShop = null;
let rpSentToday  = {};
let rpLogs       = {};  // { aadvid: { zalo: {ts, status, msg}, sheet: {ts, status, msg}, tg: {ts, status, msg} } }
let rpBatchDelay = 8;   // Delay (giây) giữa mỗi shop khi gửi hàng loạt
let rpAutoLoadBeforeSend = true; // Tự load mới data trước khi gửi hàng loạt

// Default values
const DEFAULT_SHEETS_URL = '';
const DEFAULT_TG_TOKEN   = '';
const DEFAULT_TG_CHAT_ID = '';
const DEFAULT_ZALO_SERVER = 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';

function maskStr(s, visible = 4) {
    if (!s) return '';
    if (s.length <= visible * 2) return s;
    return s.substring(0, visible) + '...' + s.substring(s.length - visible);
}

function rpMaskSensitiveValue(value) {
    const raw = String(value || '');
    if (!raw) return '';
    const visible = Math.max(1, Math.ceil(raw.length / 2));
    const hidden = Math.max(1, raw.length - visible);
    return `${'•'.repeat(Math.min(hidden, 12))}${raw.slice(-visible)}`;
}

function rpInputValue(input) {
    if (!input) return '';
    if (input.dataset?.rpSensitive === '1' && input.dataset.rawValue !== undefined) {
        return input.dataset.rawValue;
    }
    return input.value || '';
}

function rpCleanMoneyInput(value) {
    return String(value || '').replace(/[^\d]/g, '');
}

function rpCleanPctInput(value) {
    const normalized = String(value || '').replace(',', '.').replace(/[^\d.]/g, '');
    const parts = normalized.split('.');
    return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
}

function rpReadMoney(value) {
    return Number(rpCleanMoneyInput(value)) || 0;
}

function rpFormatMoneyInput(input) {
    if (!input) return;
    const raw = rpCleanMoneyInput(input.value);
    input.value = raw ? fmtDots(Number(raw)) : '';
    try {
        input.setSelectionRange(input.value.length, input.value.length);
    } catch (_) {}
}

function rpReadPct(value) {
    return Number(rpCleanPctInput(value)) || 0;
}

function rpFmtPct(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toFixed(digits).replace(/\.0$/, '')}%`;
}

function rpMaskSensitiveInput(input) {
    if (!input || input.dataset.rpSensitive !== '1') return;
    const raw = (input.dataset.rawValue !== undefined ? input.dataset.rawValue : input.value || '').trim();
    input.dataset.rawValue = raw;
    if (!raw || document.activeElement === input) return;
    input.value = rpMaskSensitiveValue(raw);
    input.dataset.masked = '1';
    input.classList.add('rp-sensitive-masked');
}

function rpBindSensitiveInput(input) {
    if (!input || input.dataset.rpSensitive !== '1' || input.dataset.rpMaskBound === '1') return;
    input.dataset.rpMaskBound = '1';
    input.addEventListener('focus', () => {
        if (input.dataset.masked === '1') {
            input.value = input.dataset.rawValue || '';
            input.dataset.masked = '0';
            input.classList.remove('rp-sensitive-masked');
        }
    });
    input.addEventListener('input', () => {
        input.dataset.rawValue = input.value;
        input.dataset.masked = '0';
        input.classList.remove('rp-sensitive-masked');
    });
    input.addEventListener('blur', () => {
        input.dataset.rawValue = input.value.trim();
        rpMaskSensitiveInput(input);
    });
    rpMaskSensitiveInput(input);
}

function rpMaskSensitiveInputs(root = document) {
    root.querySelectorAll?.('input[data-rp-sensitive="1"]').forEach(rpBindSensitiveInput);
}

// GLOBAL STATE FOR UI
let _bgLockActive = false; // cache để không read storage mỗi giây
let _bgLockCheck  = 0;     // timestamp lần check cuối

function updateRpClock() {
    const el = document.getElementById('rp-realtime-clock');
    const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    if (el) el.textContent = `${String(vn.getHours()).padStart(2,'0')}:${String(vn.getMinutes()).padStart(2,'0')}:${String(vn.getSeconds()).padStart(2,'0')}`;

    // Poll lock mỗi 1s — phát hiện background xử lý ngay lập tức
    const now = Date.now();
    if (now - _bgLockCheck > 1000) {
        _bgLockCheck = now;
        chrome.storage.local.get('strangetts_rp_lock', s => {
            const lock = s.strangetts_rp_lock;
            const BG_LOCK_TTL_MS = 10 * 60 * 1000;
            _bgLockActive = !!(lock && lock.running && (Date.now() - lock.startedAt) < BG_LOCK_TTL_MS);
        });
    }

    const countdownEl = document.getElementById('rp-next-run-countdown');
    if (countdownEl) {
        if (_bgLockActive) {
            countdownEl.innerHTML = `<span style="color:#fbbf24;font-weight:bold;animation:pulse 1s infinite">⚙️ Background đang gửi tự động...</span>`;
        } else if (_schedulerRunning) {
            countdownEl.innerHTML = `<span style="color:#fbbf24;font-weight:bold">🔁 Đang gửi tự động...</span>`;
        } else if (_batchRunning) {
            countdownEl.innerHTML = `<span style="color:#a855f7;font-weight:bold">🚀 Đang xử lý hàng loạt...</span>`;
        } else {
            // Tìm lần gửi tiếp theo sớm nhất từ tất cả shop + kênh đang bật
            // (khớp chính xác với logic scheduler background)
            const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
            let earliestNext = null;

            const findNext = (timeStr, days) => {
                if (!timeStr) return null;
                const [h2, m2] = timeStr.split(':').map(Number);
                if (isNaN(h2)) return null;
                const validDays = (days && days.length) ? days.map(String) : ['1','2','3','4','5','6','0'];
                for (let i = 0; i < 8; i++) {
                    let d = new Date(vn.getTime() + i * 86400000);
                    d.setHours(h2, m2, 0, 0);
                    if (d.getTime() <= vn.getTime()) continue;
                    if (validDays.includes(String(d.getDay()))) return d;
                }
                return null;
            };

            keys.forEach(k => {
                const cfg = rpConfig[k] || {};
                const candidates = [];
                if (cfg.autoSend)     candidates.push(findNext(cfg.sendTime   || '08:00', cfg.sendDays));
                if (cfg.autoSheets)   candidates.push(findNext(cfg.sheetsTime || '08:30', cfg.sheetsDays));
                if (cfg.autoTelegram) candidates.push(findNext(cfg.tgTime     || '09:00', cfg.tgDays));
                candidates.forEach(d => {
                    if (d && (!earliestNext || d < earliestNext)) earliestNext = d;
                });
            });

            // Fallback: nếu không có shop nào bật auto → dùng global time field
            if (!earliestNext) {
                const timeField = document.getElementById('rp-global-time');
                const time = timeField ? timeField.value : (rpConfig.__global_time__ || '08:00');
                const [h, m] = time.split(':').map(Number);
                if (!isNaN(h)) earliestNext = findNext(`${h}:${m}`, rpConfig.__global_days__);
            }

            if (earliestNext) {
                const diff = Math.floor((earliestNext.getTime() - vn.getTime()) / 1000);
                const hh = Math.floor(diff / 3600), mm = Math.floor((diff % 3600) / 60), ss = diff % 60;
                countdownEl.innerHTML = `<span style="color:#94a3b8;font-weight:normal">Gửi tiếp lúc ${String(earliestNext.getHours()).padStart(2,'0')}:${String(earliestNext.getMinutes()).padStart(2,'0')}:</span> <span style="color:#c084fc;font-weight:bold">${hh>0?hh+'h':''}${mm}m${ss}s</span>`;
            } else {
                countdownEl.innerHTML = `<span style="color:#ef4444">Chưa chọn ngày gửi</span>`;
            }
        }
    }
    updateRpCountdowns(vn);
}

function checkBgAlarmStatus() {
    const el = document.getElementById('rp-bg-alarm-status');
    if (!el) return;
    chrome.alarms.get('strangetts_rp_check', alarm => {
        if (alarm) {
            const nextSec = Math.max(0, Math.round((alarm.scheduledTime - Date.now()) / 1000));
            el.textContent = `⏰ Alarm 24/7: ĐANG CHẠY (next: ${nextSec}s)`;
            el.style.color = '#22c55e';
        } else {
            el.textContent = '⚠️ Alarm: CHƯA ĐĂNG KÝ — Reload extension!';
            el.style.color = '#f97316';
            chrome.alarms.create('strangetts_rp_check', { periodInMinutes: 1 });
        }
    });
}

function updateGlobalToggles() {
    const z = document.getElementById('check-rp-global-zalo');
    const s = document.getElementById('check-rp-global-sheet');
    const t = document.getElementById('check-rp-global-tg');
    if (z) z.checked = !!rpConfig.__global_zalo__;
    if (s) s.checked = !!rpConfig.__global_sheet__;
    if (t) t.checked = !!rpConfig.__global_tg__;
}

// ===== INIT =====
function initReportTab() {
    loadRpConfig(() => {
        renderReportShopList();
        
        // --- AUTO-FILL GLOBAL CONFIG ---
        // V30 dùng rp-global-zalo-server, legacy fallback rp-zalo-server
        const srv = document.getElementById('rp-global-zalo-server') || document.getElementById('rp-zalo-server');
        if (srv) {
            srv.value = rpConfig.__server__ || DEFAULT_ZALO_SERVER;
            srv.dataset.rawValue = srv.value;
        }

        const delayInput = document.getElementById('rp-global-delay');
        if (delayInput) {
            delayInput.value = rpConfig.__delay__ !== undefined ? rpConfig.__delay__ : 8;
            rpBatchDelay = Number(delayInput.value);
        }

        const autoLoadChk = document.getElementById('rp-auto-load-before-send');
        if (autoLoadChk) {
            autoLoadChk.checked = rpConfig.__autoLoad__ !== undefined ? rpConfig.__autoLoad__ : true;
            rpAutoLoadBeforeSend = autoLoadChk.checked;
        }

        const gSheetsUrl = document.getElementById('rp-global-sheets-url');
        if (gSheetsUrl && rpConfig.__global_sheets_url__) {
            gSheetsUrl.value = rpConfig.__global_sheets_url__;
            gSheetsUrl.dataset.rawValue = gSheetsUrl.value;
        }

        const gTgToken = document.getElementById('rp-global-tg-token');
        if (gTgToken && rpConfig.__global_tg_token__) {
            gTgToken.value = rpConfig.__global_tg_token__;
            gTgToken.dataset.rawValue = gTgToken.value;
        }

        const gTgChatId = document.getElementById('rp-global-tg-chatid');
        if (gTgChatId && rpConfig.__global_tg_chatid__) {
            gTgChatId.value = rpConfig.__global_tg_chatid__;
            gTgChatId.dataset.rawValue = gTgChatId.value;
        }

        const gTgChatId2 = document.getElementById('rp-global-tg-chatid2');
        if (gTgChatId2 && rpConfig.__global_tg_chatid2__) {
            gTgChatId2.value = rpConfig.__global_tg_chatid2__;
            gTgChatId2.dataset.rawValue = gTgChatId2.value;
        }

        const gZaloGroupOn = document.getElementById('rp-global-zalo-group-on');
        if (gZaloGroupOn) gZaloGroupOn.checked = rpConfig.__global_zalo_group_on__ !== false;
        const gZaloGroup = document.getElementById('rp-global-zalo-group');
        if (gZaloGroup && rpConfig.__global_zalo_group__) {
            gZaloGroup.value = rpConfig.__global_zalo_group__;
            gZaloGroup.dataset.rawValue = gZaloGroup.value;
        }

        const gZaloUserOn = document.getElementById('rp-global-zalo-user-on');
        if (gZaloUserOn) gZaloUserOn.checked = rpConfig.__global_zalo_user_on__ !== false;
        const gZaloUser = document.getElementById('rp-global-zalo-user');
        if (gZaloUser && rpConfig.__global_zalo_user__) {
            gZaloUser.value = rpConfig.__global_zalo_user__;
            gZaloUser.dataset.rawValue = gZaloUser.value;
        }
        
        const gTime = document.getElementById('rp-global-time');
        if (gTime && rpConfig.__global_time__) gTime.value = rpConfig.__global_time__;

        const gSendExtra = document.getElementById('rp-global-send-extra');
        if (gSendExtra && rpConfig.__global_send_extra__) gSendExtra.value = rpConfig.__global_send_extra__;

        const gSheetsTime = document.getElementById('rp-global-sheets-time');
        if (gSheetsTime && rpConfig.__global_sheets_time__) gSheetsTime.value = rpConfig.__global_sheets_time__;

        const gSheetsExtra = document.getElementById('rp-global-sheets-extra');
        if (gSheetsExtra && rpConfig.__global_sheets_extra__) gSheetsExtra.value = rpConfig.__global_sheets_extra__;

        const gTgTime = document.getElementById('rp-global-tg-time');
        if (gTgTime && rpConfig.__global_tg_time__) gTgTime.value = rpConfig.__global_tg_time__;

        const gTgExtra = document.getElementById('rp-global-tg-extra');
        if (gTgExtra && rpConfig.__global_tg_extra__) gTgExtra.value = rpConfig.__global_tg_extra__;

        // Restore global day pills
        if (rpConfig.__global_days__) {
            document.querySelectorAll('.global-day').forEach(btn => {
                const on = rpConfig.__global_days__.includes(btn.dataset.val);
                btn.classList.toggle('active', on);
                btn.style.background = on ? '#a855f7' : '#475569';
            });
        }

        updateGlobalToggles();
        rpMaskSensitiveInputs(document);
        initReportTabListeners();
        checkBgAlarmStatus();

        // Restore global timeout
        const gTimeout = document.getElementById('rp-global-timeout');
        if (gTimeout) gTimeout.value = rpConfig.__fetchTimeout__ !== undefined ? rpConfig.__fetchTimeout__ : 60;
        
        // Restore global Telegram toggles
        const gTgOn1 = document.getElementById('rp-global-tg-chatid-on');
        const gTgOn2 = document.getElementById('rp-global-tg-chatid2-on');
        if (gTgOn1) gTgOn1.checked = rpConfig.__global_tg_on1__ !== false;
        if (gTgOn2) gTgOn2.checked = rpConfig.__global_tg_on2__ !== false;


    });

    // Clock và Scheduler khởi chạy độc lập
    updateRpClock();
    setInterval(updateRpClock, 1000);
    startRpScheduler();

    // Nhật ký khởi chạy độc lập
    renderBgLogs();
    setInterval(renderBgLogs, 10000);
    setInterval(checkBgAlarmStatus, 30000);
}

function initReportTabListeners() {
    // 1. Tab switching
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const panelMain = document.getElementById('panel-main');
            const panelReport = document.getElementById('panel-report');
            if (tab === 'report') {
                if (panelMain) panelMain.classList.add('hide-on-report');
                if (panelReport) panelReport.style.display = 'block';
                document.body.classList.add('is-report-tab');
                renderReportShopList();
            } else {
                if (panelMain) panelMain.classList.remove('hide-on-report');
                if (panelReport) panelReport.style.display = 'none';
                document.body.classList.remove('is-report-tab');
            }
        });
    });

    // 2. Global Actions
    document.getElementById('btn-rp-fetch-all')?.addEventListener('click', rpFetchAll);
    document.getElementById('btn-rp-send-all')?.addEventListener('click', rpSendAll);
    document.getElementById('btn-rp-sheets-all')?.addEventListener('click', rpSheetsAll);
    document.getElementById('btn-rp-tele-all')?.addEventListener('click', rpTelegramAll);
    // V30 new toolbar buttons
    document.getElementById('btn-rp-refresh-all')?.addEventListener('click', () => {
        if (_batchRunning) { showToast('⚠️ Đang có tiến trình batch...'); return; }
        rpFetchAll();
    });
    document.getElementById('btn-rp-send-all-zalo')?.addEventListener('click', rpSendAllZalo);
    // Test server: dùng hàm mới đọc từ rp-global-zalo-server
    document.getElementById('btn-rp-test-server')?.addEventListener('click', rpTestZaloServer);

    // 3. Global Configuration Inputs (Persist on input)
    const bindInput = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', e => { rpConfig[key] = rpInputValue(e.target).trim(); saveRpConfig(); });
    };
    bindInput('rp-global-sheets-url', '__global_sheets_url__');
    bindInput('rp-global-tg-token',    '__global_tg_token__');
    bindInput('rp-global-tg-chatid',   '__global_tg_chatid__');
    bindInput('rp-global-tg-chatid2',  '__global_tg_chatid2__');
    bindInput('rp-global-zalo-group',  '__global_zalo_group__');
    bindInput('rp-global-zalo-user',   '__global_zalo_user__');
    
    document.getElementById('rp-global-time')?.addEventListener('change', e => {
        rpConfig.__global_time__ = e.target.value;
        saveRpConfig();
    });
    bindInput('rp-global-send-extra', '__global_send_extra__');
    bindInput('rp-global-sheets-time', '__global_sheets_time__');
    bindInput('rp-global-sheets-extra', '__global_sheets_extra__');
    bindInput('rp-global-tg-time', '__global_tg_time__');
    bindInput('rp-global-tg-extra', '__global_tg_extra__');

    // 4. Apply Global Buttons
    document.getElementById('btn-rp-apply-sheets-url')?.addEventListener('click', () => {
        const urlEl = document.getElementById('rp-global-sheets-url');
        const url   = rpInputValue(urlEl).trim();
        const time  = document.getElementById('rp-global-sheets-time')?.value || '08:30';
        const extra = document.getElementById('rp-global-sheets-extra')?.value.trim() || '';
        
        if (!url || !url.includes('script.google.com/macros')) { showToast('⚠️ Cần URL Apps Script Web App hợp lệ!'); return; }
        
        // Sync to global config
        rpConfig.__global_sheets_url__ = url;
        rpConfig.__global_sheets_time__ = time;
        rpConfig.__global_sheets_extra__ = extra;

        const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        keys.forEach(k => { 
            if (!rpConfig[k]) rpConfig[k] = {}; 
            rpConfig[k].sheetsUrl = url; 
            rpConfig[k].sheetsTime = time;
            rpConfig[k].sheetsExtra = extra;
        });
        saveRpConfig(); renderReportShopList({ captureInputs: false });
        showToast(`✅ Đã áp dụng Sheets URL & Giờ cho ${keys.length} shop!`);
    });

    document.getElementById('btn-rp-apply-tg')?.addEventListener('click', () => {
        const token   = rpInputValue(document.getElementById('rp-global-tg-token')).trim();
        const chatId  = rpInputValue(document.getElementById('rp-global-tg-chatid')).trim();
        const chatId2 = rpInputValue(document.getElementById('rp-global-tg-chatid2')).trim();
        const time    = document.getElementById('rp-global-tg-time')?.value || '09:00';
        const extra   = document.getElementById('rp-global-tg-extra')?.value.trim() || '';
        const on1     = document.getElementById('rp-global-tg-chatid-on')?.checked !== false;
        const on2     = document.getElementById('rp-global-tg-chatid2-on')?.checked !== false;

        if (!token || (!chatId && !chatId2)) { showToast('⚠️ Cần Bot Token và ít nhất 1 Chat ID!'); return; }
        
        // Sync to global config
        rpConfig.__global_tg_token__ = token;
        rpConfig.__global_tg_chatid__ = chatId;
        rpConfig.__global_tg_chatid2__ = chatId2;
        rpConfig.__global_tg_time__ = time;
        rpConfig.__global_tg_extra__ = extra;
        rpConfig.__global_tg_on1__ = on1;
        rpConfig.__global_tg_on2__ = on2;

        const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        keys.forEach(k => { 
            if (!rpConfig[k]) rpConfig[k] = {}; 
            rpConfig[k].tgToken = token; 
            rpConfig[k].tgChatId = chatId; 
            rpConfig[k].tgChatId2 = chatId2; 
            rpConfig[k].tgOn1 = on1;
            rpConfig[k].tgOn2 = on2;
            rpConfig[k].tgTime = time;
            rpConfig[k].tgExtra = extra;
        });
        saveRpConfig(); renderReportShopList({ captureInputs: false });
        showToast(`✅ Đã áp dụng Telegram cho ${keys.length} shop!`);
    });

    document.getElementById('btn-rp-apply-zalo')?.addEventListener('click', () => {
        const group    = rpInputValue(document.getElementById('rp-global-zalo-group')).trim();
        const personal = rpInputValue(document.getElementById('rp-global-zalo-user')).trim();
        const groupOn  = document.getElementById('rp-global-zalo-group-on')?.checked !== false;
        const userOn   = document.getElementById('rp-global-zalo-user-on')?.checked !== false;

        // Sync to global config
        rpConfig.__global_zalo_group__    = group;
        rpConfig.__global_zalo_user__     = personal;
        rpConfig.__global_zalo_group_on__ = groupOn;
        rpConfig.__global_zalo_user_on__  = userOn;

        const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        keys.forEach(k => {
            if (!rpConfig[k]) rpConfig[k] = {};
            if (group)    rpConfig[k].groupId    = group;
            if (personal) rpConfig[k].zaloUserId = personal;
            rpConfig[k].zaloGroupOn = groupOn;
            rpConfig[k].zaloUserOn  = userOn;
        });
        saveRpConfig(); renderReportShopList({ captureInputs: false });
        showToast(`✅ Đã áp dụng Zalo (Nhóm:${groupOn?'ON':'OFF'} / Cá nhân:${userOn?'ON':'OFF'}) cho ${keys.length} shop!`);
    });

    document.getElementById('btn-rp-apply-schedule')?.addEventListener('click', () => {
        const time  = document.getElementById('rp-global-time')?.value || '08:00';
        const extra = document.getElementById('rp-global-send-extra')?.value.trim() || '';
        const days  = Array.from(document.querySelectorAll('.global-day.active')).map(b => b.dataset.val);
        
        // Sync to global config
        rpConfig.__global_time__ = time;
        rpConfig.__global_send_extra__ = extra;
        rpConfig.__global_days__ = days; 

        const keys  = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        keys.forEach(k => { 
            if (!rpConfig[k]) rpConfig[k] = {}; 
            // Áp dụng cho cả 3 kênh: Zalo, Sheet, Telegram
            rpConfig[k].sendTime    = time;
            rpConfig[k].sendExtra   = extra;
            rpConfig[k].sendDays    = days;
            rpConfig[k].sheetsTime  = time;
            rpConfig[k].sheetsExtra = extra;
            rpConfig[k].sheetsDays  = days;
            rpConfig[k].tgTime      = time;
            rpConfig[k].tgExtra     = extra;
            rpConfig[k].tgDays      = days;
        });
        saveRpConfig(); renderReportShopList({ captureInputs: false });
        showToast(`✅ Đã áp dụng Lịch gửi (${time}) cho cả 3 kênh — ${keys.length} shop!`);
    });

    // 5. Global Toggles (AUTO Zalo/Sheet/Tele)
    const setupGlobalToggle = (id, configKey, shopKey) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onchange = (e) => {
            const val = e.target.checked;
            const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
            rpConfig[configKey] = val;
            keys.forEach(k => { if (!rpConfig[k]) rpConfig[k] = {}; rpConfig[k][shopKey] = val; });
            saveRpConfig(); renderReportShopList();
            showToast(`${val ? '🚀 ĐÃ KÍCH HOẠT' : '⏹️ ĐÃ TẮT'} TỰ ĐỘNG ${id.split('-').pop().toUpperCase()}`);
        };
    };
    setupGlobalToggle('check-rp-global-zalo',  '__global_zalo__',  'autoSend');
    setupGlobalToggle('check-rp-global-sheet', '__global_sheet__', 'autoSheets');
    setupGlobalToggle('check-rp-global-tg',    '__global_tg__',    'autoTelegram');

    // 6. Day Pills global behavior
    document.querySelectorAll('.global-day').forEach(btn => {
        btn.addEventListener('click', () => { 
            btn.classList.toggle('active'); 
            const on = btn.classList.contains('active');
            btn.style.background = on ? '#a855f7' : '#475569';
            
            // Lưu ngay vào config global
            const days = Array.from(document.querySelectorAll('.global-day.active')).map(b => b.dataset.val);
            rpConfig.__global_days__ = days;
            saveRpConfig();
            console.log('[Strange TTS RP] Global days updated:', days);
        });
    });

    // 7. Modal & Misc
    document.getElementById('rp-modal-close')?.addEventListener('click', closeRpModal);
    document.getElementById('rp-copy-msg')?.addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('rp-msg-preview').textContent).then(() => showToast('✅ Đã copy!'));
    });
    document.getElementById('rp-confirm-send')?.addEventListener('click', () => {
        if (rpPreviewShop) rpSendToZalo(rpPreviewShop);
        closeRpModal();
    });
    document.getElementById('rp-preview-modal')?.addEventListener('click', e => { if (e.target.id === 'rp-preview-modal') closeRpModal(); });
    document.getElementById('btn-rp-bulk-config')?.addEventListener('click', openRpBulkConfigModal);
    document.getElementById('rp-bulk-config-close')?.addEventListener('click', closeRpBulkConfigModal);
    document.getElementById('rp-bulk-config-refresh')?.addEventListener('click', renderRpBulkConfigTable);
    document.getElementById('rp-bulk-config-save')?.addEventListener('click', saveRpBulkConfigTable);
    document.getElementById('rp-bulk-config-export')?.addEventListener('click', exportRpBulkConfigXlsx);
    document.getElementById('rp-bulk-config-import')?.addEventListener('click', () => {
        document.getElementById('rp-bulk-config-file')?.click();
    });
    document.getElementById('rp-bulk-config-file')?.addEventListener('change', importRpBulkConfigFile);
    document.getElementById('rp-bulk-config-modal')?.addEventListener('click', e => {
        if (e.target.id === 'rp-bulk-config-modal') closeRpBulkConfigModal();
    });
    document.getElementById('rp-bulk-config-tbody')?.addEventListener('input', handleRpBulkConfigInput);
    
    // Server URL input (V30: id mới là rp-global-zalo-server)
    document.getElementById('rp-global-zalo-server')?.addEventListener('change', e => {
        rpZaloServer = rpInputValue(e.target).trim() || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
        rpConfig.__server__ = rpZaloServer; saveRpConfig();
        showToast('✅ Đã lưu Zalo Server URL');
    });
    // Legacy fallback (bản cũ dùng rp-zalo-server)
    document.getElementById('rp-zalo-server')?.addEventListener('change', e => {
        rpZaloServer = rpInputValue(e.target).trim() || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
        rpConfig.__server__ = rpZaloServer; saveRpConfig();
    });

    document.getElementById('btn-rp-clear-bg-logs')?.addEventListener('click', () => {
        chrome.storage.local.set({ strangetts_bg_logs: [] }, () => { renderBgLogs(); showToast('🗑️ Đã xóa nhật ký chạy ngầm'); });
    });

    document.getElementById('btn-rp-toggle-all-shop')?.addEventListener('click', () => {
        const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        if (!keys.length) return;
        const targetState = !rpConfig[keys[0]]?.showShopData;
        keys.forEach(k => { if (!rpConfig[k]) rpConfig[k] = {}; rpConfig[k].showShopData = targetState; });
        saveRpConfig(); renderReportShopList();
        showToast(targetState ? '👁️ Đã hiển thị tổng quan' : '🙈 Đã ẩn tổng quan');
    });

    // 8. Delay & Auto-load
    document.getElementById('rp-global-delay')?.addEventListener('change', e => {
        rpBatchDelay = Math.max(0, Number(e.target.value) || 0);
        rpConfig.__delay__ = rpBatchDelay; saveRpConfig();
        showToast(`⏱ Delay đã đặt: ${rpBatchDelay} giây`);
    });
    document.getElementById('rp-auto-load-before-send')?.addEventListener('change', e => {
        rpAutoLoadBeforeSend = e.target.checked;
        rpConfig.__autoLoad__ = rpAutoLoadBeforeSend; saveRpConfig();
        showToast(rpAutoLoadBeforeSend ? '✅ Sẽ tự load data trước khi gửi' : '⚠️ Tắt auto-load (dùng data hiện có)');
    });
    document.getElementById('rp-global-timeout')?.addEventListener('change', e => {
        const val = Math.max(10, Number(e.target.value) || 60);
        rpConfig.__fetchTimeout__ = val;
        saveRpConfig();
        showToast(`⏱ Timeout tải dữ liệu đặt: ${val} giây`);
    });
    document.getElementById('rp-global-tg-chatid-on')?.addEventListener('change', e => { rpConfig.__global_tg_on1__ = e.target.checked; saveRpConfig(); });
    document.getElementById('rp-global-tg-chatid2-on')?.addEventListener('change', e => { rpConfig.__global_tg_on2__ = e.target.checked; saveRpConfig(); });
    checkBgAlarmStatus();
    setInterval(checkBgAlarmStatus, 30000);

    // Initial sync
    syncShopsToBackground();
}

function updateGlobalToggles() {
    const z = document.getElementById('check-rp-global-zalo');
    const s = document.getElementById('check-rp-global-sheet');
    const t = document.getElementById('check-rp-global-tg');
    if (z) z.checked = !!rpConfig.__global_zalo__;
    if (s) s.checked = !!rpConfig.__global_sheet__;
    if (t) t.checked = !!rpConfig.__global_tg__;
}

function rpShopConfigAliases(shopKey) {
    const shop = shops?.[shopKey] || {};
    const aliases = [
        shopKey,
        shop.local_key,
        shop.canonical_shop_id,
        shop.oec_seller_id,
        shop.seller_id,
        shop.source_shop_key,
        shop.aadvid
    ];
    const seen = new Set();
    return aliases
        .map(v => String(v || '').trim())
        .filter(v => v && !seen.has(v) && seen.add(v));
}

function rpMergeMissingConfig(target, source) {
    let changed = false;
    Object.keys(source || {}).forEach(key => {
        const value = source[key];
        if (rpShouldUseAliasConfigValue(key, target[key], value)) {
            target[key] = Array.isArray(value) ? [...value] : value;
            changed = true;
        }
    });
    return changed;
}

function rpShouldUseAliasConfigValue(field, currentValue, nextValue) {
    if (nextValue === undefined || nextValue === null || nextValue === '') return false;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (field === 'tgToken' && currentValue === DEFAULT_TG_TOKEN && nextValue !== DEFAULT_TG_TOKEN) return true;
    if (field === 'tgChatId' && currentValue === DEFAULT_TG_CHAT_ID && nextValue !== DEFAULT_TG_CHAT_ID) return true;
    if (field === 'sheetsUrl' && currentValue === DEFAULT_SHEETS_URL && nextValue !== DEFAULT_SHEETS_URL) return true;
    return false;
}

function normalizeRpConfigForShopKey(shopKey) {
    if (!shopKey) return false;
    if (!rpConfig[shopKey]) rpConfig[shopKey] = {};
    let changed = false;
    rpShopConfigAliases(shopKey).forEach(alias => {
        if (alias === shopKey || !rpConfig[alias]) return;
        changed = rpMergeMissingConfig(rpConfig[shopKey], rpConfig[alias]) || changed;
    });
    return changed;
}

function normalizeAllRpConfigForShopKeys() {
    const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
    let changed = false;
    keys.forEach(k => {
        changed = normalizeRpConfigForShopKey(k) || changed;
    });
    return changed;
}

// ===== STORAGE =====
function loadRpConfig(cb) {
    chrome.storage.local.get(['strangetts_rp_config','strangetts_rp_sent','strangetts_rp_logs'], d => {
        rpConfig    = d.strangetts_rp_config || {};
        rpSentToday = d.strangetts_rp_sent   || {};
        rpLogs      = d.strangetts_rp_logs   || {};
        rpZaloServer = rpConfig.__server__ || DEFAULT_ZALO_SERVER;

        // Ensure defaults for configuration values
        if (!rpConfig.__delay__) rpConfig.__delay__ = 8;
        if (rpConfig.__autoLoad__ === undefined) rpConfig.__autoLoad__ = true;

        const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        let needsSave = false;
        keys.forEach(k => {
            if (normalizeRpConfigForShopKey(k)) needsSave = true;
            // Luôn populate default nếu thiếu — đảm bảo background alarm dùng được
            if (!rpConfig[k].sheetsUrl) { rpConfig[k].sheetsUrl = DEFAULT_SHEETS_URL; needsSave = true; }
            if (!rpConfig[k].tgToken)   { rpConfig[k].tgToken   = DEFAULT_TG_TOKEN;   needsSave = true; }
            if (!rpConfig[k].tgChatId)  { rpConfig[k].tgChatId  = DEFAULT_TG_CHAT_ID; needsSave = true; }
        });
        // LUÔN lưu để background alarm và các lần load sau đều có giá trị
        chrome.storage.local.set({ strangetts_rp_config: rpConfig });
        // Sync shops để background scheduler có dữ liệu ngay cả khi chưa mở tab report
        syncShopsToBackground();

        if (cb) cb();
    });
}
function saveRpConfig() {
    normalizeAllRpConfigForShopKeys();
    chrome.storage.local.set({ strangetts_rp_config: rpConfig });
    // Sync shops lên background để alarm 24/7 hoạt động kể cả khi popup đóng
    syncShopsToBackground();
}
function saveRpSent()   { chrome.storage.local.set({ strangetts_rp_sent: rpSentToday }); }
function saveRpLogs()   { chrome.storage.local.set({ strangetts_rp_logs: rpLogs }); }

// Đồng bộ danh sách shops lên storage để background scheduler đọc được
function syncShopsToBackground() {
    const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
    const shopsData = {};
    keys.forEach(k => {
        const s = shops[k] || {};
        // Chỉ lưu những gì cần thiết để fetch (không cần toàn bộ)
        shopsData[k] = {
            name: s.name,
            shopRealName: s.shopRealName || s.name,
            shopAvatar: s.shopAvatar || '',
            aadvid: s.aadvid,
            oec_seller_id: s.oec_seller_id,
            seller_id: s.seller_id,
            bc_id: s.bc_id,
            cookies: s.cookies || [],
            ads_accounts: s.ads_accounts || [],   // TK phụ cho bgMergeExtraAdsAccounts
            local_key: k,
            canonical_shop_id: s.canonical_shop_id || '',
            source_username: s.source_username || '',
            source_shop_key: s.source_shop_key || '',
            cookieFingerprint: s.cookieFingerprint || '',
            cookieUpdatedAt: s.cookieUpdatedAt || ''
        };
    });
    chrome.storage.local.set({
        strangetts_rp_shops: shopsData,
        strangetts_rp_shop_order: keys
    });
}

// Countdown logic
function calcRpNextRun(timeStr, days) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const validDays = (days && days.length) ? days.map(String) : ['1','2','3','4','5','6','0'];
    for (let i = 0; i < 8; i++) {
        let d = new Date(vnNow.getTime() + i * 86400000);
        d.setHours(h, m, 0, 0);
        if (d.getTime() <= vnNow.getTime()) continue;
        if (validDays.includes(String(d.getDay()))) return d;
    }
    return null;
}
function updateRpCountdowns(vnNow) {
    document.querySelectorAll('.rp-countdown').forEach(el => {
        const av = el.dataset.aadvid, type = el.dataset.type;

        // Nếu hệ thống đang xử lý toàn cục (tự động hoặc hàng loạt) -> DỪNG ĐẾM, hiện xử lý
        if (_schedulerRunning || _batchRunning) {
            el.textContent = _schedulerRunning ? '⏳ Đang tự động gửi...' : '🚀 Đang xử lý...';
            el.style.color = '#fbbf24';
            return;
        }

        const cfg = rpConfig[av] || {};
        const d   = rpData[av] || {};

        if (d.status === 'loading' || d.status === 'processing') {
            el.textContent = d.status === 'loading' ? `⏳ ${d.secondsLeft||20}s` : '🚀 Đang gửi...';
            el.style.color = '#fbbf24';
            return;
        }
        el.style.color = ''; // Reset color

        let timeStr = '', days = [];
        if (type === 'zalo') { if (!cfg.autoSend) return el.textContent = ''; timeStr = cfg.sendTime || '08:00'; days = cfg.sendDays; el.style.color = 'var(--accent)'; }
        if (type === 'sheet') { if (!cfg.autoSheets) return el.textContent = ''; timeStr = cfg.sheetsTime || '08:30'; days = cfg.sheetsDays; el.style.color = '#22c55e'; }
        if (type === 'tg') { if (!cfg.autoTelegram) return el.textContent = ''; timeStr = cfg.tgTime || '09:00'; days = cfg.tgDays; el.style.color = '#60a5fa'; }
        
        const next = calcRpNextRun(timeStr, days);
        if (!next) return el.textContent = '';
        const diff = Math.floor((next.getTime() - vnNow.getTime()) / 1000);
        if (diff < 0) return el.textContent = '';
        const hh = Math.floor(diff / 3600), mm = Math.floor((diff % 3600) / 60), ss = diff % 60;
        el.textContent = `(Còn ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')})`;
    });
}

// Helper: record log for a task
function recordRpLog(aadvid, channel, status, msg) {
    if (!rpLogs[aadvid]) rpLogs[aadvid] = {};
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const timeStr = `${String(vnNow.getHours()).padStart(2,'0')}:${String(vnNow.getMinutes()).padStart(2,'0')}`;
    rpLogs[aadvid][channel] = { ts: timeStr, status, msg };
    saveRpLogs();
    refreshRpCard(aadvid);
}

// ===== SCHEDULER =====
// ⚠️ UI scheduler CHỈ sync trạng thái từ background + refresh UI
// Background alarm (chrome.alarms) là nơi DUY NHẤT thực thi gửi tự động thật
let _schedulerInterval = null;
let _schedulerRunning  = false;
function startRpScheduler() {
    if (_schedulerInterval) clearInterval(_schedulerInterval);
    _schedulerInterval = setInterval(checkScheduler, 30000);
}
async function checkScheduler() {
    if (_schedulerRunning) return;
    _schedulerRunning = true;
    try {
        // Sync trạng thái sent từ background về UI
        const store = await chrome.storage.local.get('strangetts_rp_sent');
        if (store.strangetts_rp_sent) rpSentToday = store.strangetts_rp_sent;

        // Đọc data đã được background fetch — render card giống "Tải tất cả" thủ công
        const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
        if (keys.length) {
            const dataKeys = keys.map(k => `strangetts_rp_data_${k}`);
            const bgStore = await chrome.storage.local.get(dataKeys);
            let anyUpdated = false;
            keys.forEach(k => {
                const bgData = bgStore[`strangetts_rp_data_${k}`];
                if (bgData && bgData.status === 'ok' && bgData.fetchedAt) {
                    // Chỉ dùng nếu mới hơn data hiện tại (hoặc chưa có)
                    const curFetch = rpData[k]?.fetchedAt || 0;
                    if (bgData.fetchedAt > curFetch) {
                        rpData[k] = { ...bgData };
                        refreshRpCard(k);
                        anyUpdated = true;
                    }
                }
            });
            if (anyUpdated) console.log('[Strange TTS RP] UI cập nhật data từ background scheduler');
        }

        // Sync log từ background
        rpPollBackgroundLogs();
        renderBgLogs();
    } catch(err) {
        console.error('[Strange TTS RP] checkScheduler error:', err);
    } finally {
        _schedulerRunning = false;
    }
}

/**
 * Hiển thị nhật ký hoạt động ngầm (VPS Diagnostics)
 */
function renderBgLogs() {
    const el = document.getElementById('rp-bg-logs-content');
    if (!el) return;

    chrome.storage.local.get('strangetts_bg_logs', d => {
        const logs = d.strangetts_bg_logs || [];
        if (!logs.length) {
            el.innerHTML = '<div style="padding:10px;color:var(--text-dim);text-align:center">Chưa có nhật ký hoạt động ngầm...</div>';
            return;
        }

        let html = '';
        logs.forEach(lg => {
            const shopName = lg.aadvid === 'system' ? 'SYSTEM' : (shops[lg.aadvid]?.name || lg.aadvid);
            const statusCls = lg.status || 'idle';
            html += `
                <div class="rp-bg-log-item ${statusCls}">
                    <div class="rp-bg-log-ts">${lg.ts}</div>
                    <div class="rp-bg-log-type">${lg.type}</div>
                    <div class="rp-bg-log-msg"><b>[${shopName}]</b> ${lg.msg}</div>
                </div>
            `;
        });
        el.innerHTML = html;
    });
}

// Helper: check if rpData is fresh enough (loaded within last 30 minutes)
function _isFresh(aadvid) {
    const d = rpData[aadvid];
    const shop = shops[aadvid] || {};
    const currentMainAadvid = String(shop.aadvid || '');
    const dataMainAadvid = String(d?._mainAadvid || d?.aadvid || '');
    if (currentMainAadvid && dataMainAadvid && currentMainAadvid !== dataMainAadvid) return false;
    return d && d.status === 'ok' && d.fetchedAt && (Date.now() - new Date(d.fetchedAt).getTime() < 1800000);
}
async function _ensureFreshData(aadvid, forceRefresh = false) {
    const d = rpData[aadvid] || {};
    
    // Nếu ĐANG LOAD, đợi nó load xong (polling — không gửi request trùng)
    if (d.status === 'loading') {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (rpData[aadvid]?.status !== 'loading') {
                    clearInterval(check);
                    resolve(rpData[aadvid]?.status === 'ok');
                }
            }, 500);
            setTimeout(() => { clearInterval(check); resolve(false); }, 90000); // Safety 90s
        });
    }

    if (!forceRefresh && _isFresh(aadvid)) return true; // Data còn mới, skip

    return new Promise(resolve => {
        // Set trạng thái loading — hiển thị spinner trên card
        rpData[aadvid] = { status: 'loading', secondsLeft: null };
        refreshRpCard(aadvid);

        // Animated dots để user biết đang load
        let dot = 0;
        const dotTimer = setInterval(() => {
            if (rpData[aadvid]?.status !== 'loading') { clearInterval(dotTimer); return; }
            rpData[aadvid].loadMsg = ['⏳ Đang tải.', '⏳ Đang tải..', '⏳ Đang tải...'][dot++ % 3];
            refreshRpCard(aadvid);
        }, 600);

        const timeoutMs = (Number(rpConfig.__fetchTimeout__) || 60) * 1000;
        chrome.runtime.sendMessage({ action: 'fetch_shop_report', shop: buildShopPayload(aadvid), timeoutMs }, async response => {
            clearInterval(dotTimer);
            if (chrome.runtime.lastError) {
                console.warn('[RP] _ensureFreshData runtime error:', chrome.runtime.lastError.message);
                rpData[aadvid] = { status: 'error', error: 'Background không phản hồi — thử reload extension' };
                refreshRpCard(aadvid);
                resolve(false);
                return;
            }
            if (response && response.status === 'ok') {
                rpData[aadvid] = { ...response, fetchedAt: Date.now(), status: 'ok', _mainAadvid: shops[aadvid]?.aadvid || response.aadvid || '' };
                // await để đảm bảo merge xong trước khi resolve (giống rpFetchShop)
                const merged = await _mergeExtraAdsAccounts(aadvid, rpData[aadvid]);
                rpData[aadvid] = merged;
                refreshRpCard(aadvid);
                resolve(true);
            } else {
                rpData[aadvid] = { status: 'error', error: (response && response.error) || 'Lỗi tải dữ liệu (Timeout?)' };
                refreshRpCard(aadvid);
                resolve(false);
            }
        });
    });
}
async function rpAutoRun(aadvid) {
    const shop = (shops[aadvid]||{});
    showToast(`⏰ Auto Zalo: ${shop.shopRealName||shop.name||aadvid}...`);
    recordRpLog(aadvid, 'zalo', 'idle', 'Đang load dữ liệu mới...');
    await _ensureFreshData(aadvid, true); // LUÔN force-refresh khi auto-send
    if (rpData[aadvid].status !== 'ok') { 
        recordRpLog(aadvid, 'zalo', 'error', 'Lỗi tải dữ liệu');
        showToast(`❌ Auto Zalo lỗi fetch: ${shop.name||aadvid}`); 
        return; 
    }
    const cfg = rpConfig[aadvid] || {};
    if (cfg.groupId) await rpSendToZalo(aadvid);
    else recordRpLog(aadvid, 'zalo', 'error', 'Thiếu Group ID');
}
async function rpAutoSheetRun(aadvid) {
    const cfg = rpConfig[aadvid] || {};
    const shop = (shops[aadvid]||{});
    if (!cfg.sheetsUrl) {
        recordRpLog(aadvid, 'sheet', 'error', 'Thiếu URL Sheets');
        return;
    }
    showToast(`⏰ Auto Sheet: ${shop.shopRealName||shop.name||aadvid}...`);
    recordRpLog(aadvid, 'sheet', 'idle', 'Kiểm tra dữ liệu...');
    if (!_isFresh(aadvid)) await _ensureFreshData(aadvid, true);
    if (rpData[aadvid].status !== 'ok') { 
        recordRpLog(aadvid, 'sheet', 'error', 'Lỗi tải dữ liệu');
        showToast(`❌ Auto Sheet lỗi fetch: ${shop.name||aadvid}`); 
        return; 
    }
    await rpPushToSheets(aadvid);
}

// ===== CAPTURE ALL INPUTS (chống reset ID khi re-render) =====
// Gọi trước mọi lần render lại để đảm bảo giá trị người dùng đang gõ không bị mất
function captureAllCardsInputs() {
    const list = document.getElementById('rp-shop-list');
    if (!list) return;
    list.querySelectorAll('[data-aadvid-card]').forEach(cardEl => {
        const av = cardEl.dataset.aadvid_card || cardEl.dataset.aadvidCard;
        if (!av) return;
        _captureOneCard(cardEl, av);
    });
    // Fallback: scan tất cả input có data-aadvid trong list
    const avSeen = new Set();
    list.querySelectorAll('[data-aadvid]').forEach(el => {
        const av = el.dataset.aadvid;
        if (!av || avSeen.has(av)) return;
        avSeen.add(av);
        const card = document.getElementById('rp-card-' + av);
        if (card) _captureOneCard(card, av);
    });
}

function _captureOneCard(cardEl, av) {
    if (!cardEl || !av) return;
    if (!rpConfig[av]) rpConfig[av] = {};
    const g = cls => {
        const el = cardEl.querySelector(cls);
        return el ? rpInputValue(el) : null;
    };
    const set = (key, val) => { if (val !== null && val !== '') rpConfig[av][key] = val.trim(); };
    set('groupId',        g('.rp-group-id'));
    set('zaloUserId',     g('.rp-zalo-user-id'));
    set('tgToken',        g('.rp-tg-token'));
    set('tgChatId',       g('.rp-tg-chatid'));
    set('tgThreadId',     g('.rp-tg-threadid'));
    set('tgChatId2',      g('.rp-tg-chatid2'));
    set('sheetsUrl',      g('.rp-sheets-url'));
    set('sendTime',       g('.rp-send-time'));
    set('sendExtra',      g('.rp-send-extra'));
    set('sheetsTime',     g('.rp-sheets-time'));
    set('sheetsExtra',    g('.rp-sheets-extra'));
    set('tgTime',         g('.rp-tg-time'));
    set('tgExtra',        g('.rp-tg-extra'));
    const rev = g('.rp-target-rev');
    if (rev !== null) rpConfig[av].targetRevenue = rpCleanMoneyInput(rev);
    const adsPct = g('.rp-target-ads-pct');
    if (adsPct !== null) rpConfig[av].targetAdsPct = rpCleanPctInput(adsPct);
}

// ===== RENDER =====
let _rpRenderRetryCount = 0;
function getRpSortMetrics(aadvid) {
    const shop = shops[aadvid] || {};
    const key = shop.aadvid || aadvid;
    const sharedAadvid = key && Object.keys(shops || {}).some(k => k !== aadvid && String(shops[k]?.aadvid || '') === String(key));
    const d = rpData[aadvid] || (!sharedAadvid ? rpData[key] : null) || {};
    const adsToday = d.adsToday || {};
    const today = d.today || {};
    const monthly = d.monthly || {};
    const cost = Number(adsToday.cost) || 0;
    const adsGmv = Number(adsToday.gmv) || 0;
    const shopGmv = Number(today.revenue) || 0;
    const orders = Number(today.orders) || Number(adsToday.orders) || 0;
    const roi = Number(adsToday.roi) || (cost > 0 ? adsGmv / cost : 0);
    const gmv = shopGmv || adsGmv || Number(monthly.revenue) || 0;
    const fetchedAt = Number(d.fetchedAt) || 0;
    return {
        name: (shop.shopRealName || shop.name || aadvid || '').toLowerCase(),
        hasData: d.status === 'ok',
        active: (cost > 0 ? 1 : 0) * 1e12 + gmv * 10 + orders * 100000 + roi * 1000 + fetchedAt / 1e9,
        gmv,
        roi,
        orders
    };
}

function renderReportShopList(options = {}) {
    if (options.captureInputs !== false) {
        captureAllCardsInputs(); // Bảo vệ giá trị đang nhập trước re-render
    }
    const el = document.getElementById('rp-shop-list');
    if (!el) return;
    const keys = (typeof shopOrder !== 'undefined' ? shopOrder : [])
        .filter(k => shops && shops[k])
        .slice()
        .sort((a, b) => {
            const sortKey = typeof currentRpSort !== 'undefined' ? currentRpSort : 'name';
            const mA = getRpSortMetrics(a);
            const mB = getRpSortMetrics(b);
            if (sortKey === 'name') return mA.name.localeCompare(mB.name, 'vi');
            if (mA.hasData !== mB.hasData) return mA.hasData ? -1 : 1;
            if (!mA.hasData && !mB.hasData) return mA.name.localeCompare(mB.name, 'vi');
            if (sortKey === 'active') return mB.active - mA.active || mA.name.localeCompare(mB.name, 'vi');
            if (sortKey === 'gmv') return mB.gmv - mA.gmv || mA.name.localeCompare(mB.name, 'vi');
            if (sortKey === 'roi') return mB.roi - mA.roi || mB.gmv - mA.gmv;
            if (sortKey === 'orders') return mB.orders - mA.orders || mB.gmv - mA.gmv;
            return 0;
        });
    
    // Nếu chưa có shop và có thể do chưa load xong — retry tối đa 10 lần
    if (!keys.length) {
        const hasShopsInMemory = typeof shops !== 'undefined' && Object.keys(shops).length > 0;
        if (!hasShopsInMemory && _rpRenderRetryCount < 10) {
            _rpRenderRetryCount++;
            el.innerHTML = '<div class="rp-empty" style="color:#fbbf24">⏳ Đang chờ tải danh sách shop... (thử lại ' + _rpRenderRetryCount + '/10)</div>';
            setTimeout(renderReportShopList, 800);
            return;
        }
        _rpRenderRetryCount = 0;
        el.innerHTML = '<div class="rp-empty">⚠️ Chưa có shop nào. Import shop từ tab Quản lý Shop trước.</div>'; return;
    }
    _rpRenderRetryCount = 0;
	    el.innerHTML = '';
	    syncShopsToBackground(); // Sync mỗi lần render để cập nhật cookies mới nhất
	    keys.forEach(aadvid => el.appendChild(buildRpShopCard(aadvid)));
	    rpMaskSensitiveInputs(el);
	    const q = document.getElementById('rp-shop-search')?.value || '';
	    if (q && typeof rpFilterShops === 'function') rpFilterShops(q);
	}

function getRpShopKeys() {
    return (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
}

function escapeRpHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRpShopDisplayName(aadvid) {
    const shop = shops[aadvid] || {};
    return shop.shopRealName || shop.name || aadvid;
}

function openRpBulkConfigModal() {
    captureAllCardsInputs();
    renderRpBulkConfigTable();
    const modal = document.getElementById('rp-bulk-config-modal');
    if (modal) modal.style.display = 'flex';
}

function closeRpBulkConfigModal() {
    const modal = document.getElementById('rp-bulk-config-modal');
    if (modal) modal.style.display = 'none';
}

function renderRpBulkConfigTable() {
    captureAllCardsInputs();
    const body = document.getElementById('rp-bulk-config-tbody');
    const count = document.getElementById('rp-bulk-config-count');
    if (!body) return;

    const keys = getRpShopKeys();
    if (count) count.textContent = `${keys.length} shop`;
    if (!keys.length) {
        body.innerHTML = '<tr><td colspan="9" class="rp-bulk-config-empty">Chưa có shop để cấu hình</td></tr>';
        return;
    }

    const input = (aadvid, field, value, placeholder = '', mono = true) => `
        <input
            type="text"
            class="rp-bulk-config-input ${mono ? 'mono' : ''}"
            data-aadvid="${escapeRpHtml(aadvid)}"
            data-field="${escapeRpHtml(field)}"
            value="${escapeRpHtml(value || '')}"
            placeholder="${escapeRpHtml(placeholder)}"
        />`;

    body.innerHTML = keys.map((aadvid, index) => {
        const shop = shops[aadvid] || {};
        const cfg = rpConfig[aadvid] || {};
        const displayName = getRpShopDisplayName(aadvid);
        const subName = shop.name && shop.name !== displayName ? shop.name : aadvid;
        return `
            <tr data-aadvid="${escapeRpHtml(aadvid)}">
                <td class="rp-bulk-config-index-col" style="color:var(--text-dim);font-weight:800">${index + 1}</td>
                <td class="rp-bulk-config-shop-col">
                    <div class="rp-bulk-config-shop">
                        <div class="rp-bulk-config-shop-name" title="${escapeRpHtml(displayName)}">${escapeRpHtml(displayName)}</div>
                        <div class="rp-bulk-config-shop-id" title="${escapeRpHtml(subName)}">${escapeRpHtml(subName)}</div>
                    </div>
                </td>
                <td>${input(aadvid, 'tgToken', cfg.tgToken, 'BotFather token')}</td>
                <td>${input(aadvid, 'tgChatId', cfg.tgChatId, 'ID cá nhân/nhóm')}</td>
                <td>${input(aadvid, 'tgChatId2', cfg.tgChatId2, 'ID phụ nếu có')}</td>
                <td>${input(aadvid, 'tgThreadId', cfg.tgThreadId, 'topic id')}</td>
                <td>${input(aadvid, 'groupId', cfg.groupId, 'Zalo Group ID')}</td>
                <td>${input(aadvid, 'zaloUserId', cfg.zaloUserId, 'Zalo User ID')}</td>
                <td>${input(aadvid, 'sheetsUrl', cfg.sheetsUrl, 'https://script.google.com/...', false)}</td>
            </tr>
        `;
    }).join('');
}

function setRpBulkConfigValue(aadvid, field, value) {
    if (!aadvid || !field) return;
    if (!rpConfig[aadvid]) rpConfig[aadvid] = {};
    const compactFields = new Set(['tgToken', 'tgChatId', 'tgChatId2', 'tgThreadId']);
    const normalized = compactFields.has(field) ? String(value || '').replace(/\s/g, '') : String(value || '').trim();
    rpConfig[aadvid][field] = normalized;
}

let rpBulkConfigSaveTimer = null;
function handleRpBulkConfigInput(e) {
    const input = e.target;
    if (!input || !input.classList.contains('rp-bulk-config-input')) return;
    setRpBulkConfigValue(input.dataset.aadvid, input.dataset.field, input.value);
    if (rpBulkConfigSaveTimer) clearTimeout(rpBulkConfigSaveTimer);
    rpBulkConfigSaveTimer = setTimeout(() => saveRpConfig(), 600);
}

function saveRpBulkConfigTable() {
    document.querySelectorAll('#rp-bulk-config-tbody .rp-bulk-config-input').forEach(input => {
        setRpBulkConfigValue(input.dataset.aadvid, input.dataset.field, input.value);
    });
    saveRpConfig();
    renderReportShopList({ captureInputs: false });
    showToast(`✅ Đã lưu bảng cấu hình cho ${getRpShopKeys().length} shop`);
}

const RP_BULK_CONFIG_COLUMNS = [
    { key: 'oec_seller_id', label: 'oec_seller_id' },
    { key: 'seller_id', label: 'seller_id' },
    { key: 'aadvid', label: 'aadvid_ref' },
    { key: 'shop', label: 'shop' },
    { key: 'tgToken', label: 'bot_token' },
    { key: 'tgChatId', label: 'tele_id_1' },
    { key: 'tgChatId2', label: 'tele_id_2' },
    { key: 'tgThreadId', label: 'topic_id' },
    { key: 'groupId', label: 'zalo_group_id' },
    { key: 'zaloUserId', label: 'zalo_user_id' },
    { key: 'sheetsUrl', label: 'sheet_url' }
];

function rpXmlEscape(value) {
    return String(value ?? '').replace(/[<>&'"]/g, ch => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;'
    }[ch]));
}

function rpXlsxColName(index) {
    let name = '';
    let n = index + 1;
    while (n > 0) {
        const r = (n - 1) % 26;
        name = String.fromCharCode(65 + r) + name;
        n = Math.floor((n - 1) / 26);
    }
    return name || 'A';
}

function rpXlsxColIndex(ref) {
    const letters = String(ref || '').match(/^[A-Z]+/i)?.[0] || 'A';
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
    return Math.max(0, n - 1);
}

const RP_CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
    }
    return table;
})();

function rpCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = RP_CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function rpU16(value) {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value, true);
    return out;
}

function rpU32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value >>> 0, true);
    return out;
}

function rpBytes(text) {
    return new TextEncoder().encode(String(text ?? ''));
}

function rpConcatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function rpDosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    };
}

function rpCreateStoredZip(files) {
    const localParts = [];
    const centralParts = [];
    const { date, time } = rpDosDateTime();
    let offset = 0;
    for (const file of files) {
        const nameBytes = rpBytes(file.name);
        const data = file.data instanceof Uint8Array ? file.data : rpBytes(file.data);
        const crc = rpCrc32(data);
        const localHeader = rpConcatBytes([
            rpU32(0x04034b50), rpU16(20), rpU16(0x0800), rpU16(0), rpU16(time), rpU16(date),
            rpU32(crc), rpU32(data.length), rpU32(data.length), rpU16(nameBytes.length), rpU16(0),
            nameBytes
        ]);
        localParts.push(rpConcatBytes([localHeader, data]));
        centralParts.push(rpConcatBytes([
            rpU32(0x02014b50), rpU16(20), rpU16(20), rpU16(0x0800), rpU16(0), rpU16(time), rpU16(date),
            rpU32(crc), rpU32(data.length), rpU32(data.length), rpU16(nameBytes.length), rpU16(0), rpU16(0),
            rpU16(0), rpU16(0), rpU32(0), rpU32(offset), nameBytes
        ]));
        offset += localHeader.length + data.length;
    }
    const centralStart = offset;
    const central = rpConcatBytes(centralParts);
    const eocd = rpConcatBytes([
        rpU32(0x06054b50), rpU16(0), rpU16(0), rpU16(files.length), rpU16(files.length),
        rpU32(central.length), rpU32(centralStart), rpU16(0)
    ]);
    return new Blob([rpConcatBytes([...localParts, central, eocd])], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

function rpBuildBulkConfigXlsxBlob(rows) {
    const now = new Date().toISOString();
    const lastCol = rpXlsxColName(Math.max(0, (rows[0]?.length || 1) - 1));
    const dimension = rows.length ? `A1:${lastCol}${rows.length}` : 'A1';
    const widths = [22, 22, 22, 30, 52, 18, 18, 14, 24, 24, 90];
    const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const sheetRows = rows.map((row, rIndex) => {
        const rowNum = rIndex + 1;
        const cells = row.map((value, cIndex) => {
            const ref = `${rpXlsxColName(cIndex)}${rowNum}`;
            const style = rIndex === 0 ? 1 : 2;
            return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${rpXmlEscape(value)}</t></is></c>`;
        }).join('');
        return `<row r="${rowNum}">${cells}</row>`;
    }).join('');
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${sheetRows}</sheetData>
<autoFilter ref="${dimension}"/>
</worksheet>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="@"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report IDs" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>STRANGE TTS</dc:creator><cp:lastModifiedBy>STRANGE TTS</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>STRANGE TTS</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Report IDs</vt:lpstr></vt:vector></TitlesOfParts></Properties>`;
    return rpCreateStoredZip([
        { name: '[Content_Types].xml', data: contentTypes },
        { name: '_rels/.rels', data: rootRels },
        { name: 'docProps/core.xml', data: coreXml },
        { name: 'docProps/app.xml', data: appXml },
        { name: 'xl/workbook.xml', data: workbookXml },
        { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
        { name: 'xl/styles.xml', data: stylesXml },
        { name: 'xl/worksheets/sheet1.xml', data: sheetXml }
    ]);
}

async function rpInflateZipBytes(bytes) {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('Trình duyệt chưa hỗ trợ đọc XLSX nén');
    }
    try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (err) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }
}

async function rpReadZipTextFiles(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const decoder = new TextDecoder();
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('File XLSX không hợp lệ');
    const entryCount = view.getUint16(eocd + 10, true);
    let pos = view.getUint32(eocd + 16, true);
    const files = {};
    for (let i = 0; i < entryCount; i++) {
        if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Central directory XLSX lỗi');
        const method = view.getUint16(pos + 10, true);
        const compressedSize = view.getUint32(pos + 20, true);
        const nameLen = view.getUint16(pos + 28, true);
        const extraLen = view.getUint16(pos + 30, true);
        const commentLen = view.getUint16(pos + 32, true);
        const localOffset = view.getUint32(pos + 42, true);
        const nameStart = pos + 46;
        const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLen));
        if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Local header XLSX lỗi');
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);
        let data;
        if (method === 0) data = compressed;
        else if (method === 8) data = await rpInflateZipBytes(compressed);
        else throw new Error(`XLSX dùng kiểu nén chưa hỗ trợ: ${method}`);
        files[name] = decoder.decode(data);
        pos = nameStart + nameLen + extraLen + commentLen;
    }
    return files;
}

function rpParseXml(text) {
    return new DOMParser().parseFromString(String(text || ''), 'application/xml');
}

function rpNormalizeXlsxPath(baseDir, target) {
    if (!target) return '';
    if (target.startsWith('/')) return target.slice(1);
    const parts = `${baseDir}/${target}`.split('/');
    const out = [];
    for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') out.pop();
        else out.push(part);
    }
    return out.join('/');
}

function rpResolveXlsxSheetPath(files) {
    const workbookXml = files['xl/workbook.xml'];
    const relsXml = files['xl/_rels/workbook.xml.rels'];
    if (workbookXml && relsXml) {
        const workbookDoc = rpParseXml(workbookXml);
        const sheet = workbookDoc.getElementsByTagName('sheet')[0];
        const relId = sheet?.getAttribute('r:id') || sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        const relsDoc = rpParseXml(relsXml);
        const rel = Array.from(relsDoc.getElementsByTagName('Relationship')).find(item => item.getAttribute('Id') === relId);
        const target = rel?.getAttribute('Target');
        const resolved = rpNormalizeXlsxPath('xl', target);
        if (resolved && files[resolved]) return resolved;
    }
    return Object.keys(files).find(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) || 'xl/worksheets/sheet1.xml';
}

function rpExtractXlsxSharedStrings(files) {
    const xml = files['xl/sharedStrings.xml'];
    if (!xml) return [];
    const doc = rpParseXml(xml);
    return Array.from(doc.getElementsByTagName('si')).map(si =>
        Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join('')
    );
}

function rpXlsxCellText(cell, sharedStrings) {
    const type = cell.getAttribute('t') || '';
    if (type === 'inlineStr') {
        return Array.from(cell.getElementsByTagName('t')).map(t => t.textContent || '').join('');
    }
    const v = cell.getElementsByTagName('v')[0];
    const raw = v ? (v.textContent || '') : '';
    if (type === 's') return sharedStrings[Number(raw)] ?? '';
    return raw;
}

async function rpParseXlsxRows(arrayBuffer) {
    const files = await rpReadZipTextFiles(arrayBuffer);
    const sheetPath = rpResolveXlsxSheetPath(files);
    const sheetXml = files[sheetPath];
    if (!sheetXml) throw new Error('Không tìm thấy sheet trong XLSX');
    const sharedStrings = rpExtractXlsxSharedStrings(files);
    const sheetDoc = rpParseXml(sheetXml);
    const rows = Array.from(sheetDoc.getElementsByTagName('row')).map(rowNode => {
        const row = [];
        Array.from(rowNode.getElementsByTagName('c')).forEach(cell => {
            row[rpXlsxColIndex(cell.getAttribute('r'))] = rpXlsxCellText(cell, sharedStrings);
        });
        return row.map(v => v ?? '');
    });
    return rows.filter(row => row.some(v => String(v || '').trim() !== ''));
}

async function rpReadBulkConfigRowsFromFile(file) {
    if (/\.xlsx$/i.test(file.name || '') || /spreadsheetml\.sheet/i.test(file.type || '')) {
        return rpParseXlsxRows(await file.arrayBuffer());
    }
    return rpParseBulkConfigRows(await file.text());
}

function rpDetectCsvDelimiter(raw) {
    const firstLine = String(raw || '').split(/\r?\n/).find(line => line.trim()) || '';
    const candidates = [',', ';', '\t'];
    return candidates
        .map(delimiter => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
        .sort((a, b) => b.count - a.count)[0]?.delimiter || ',';
}

function rpParseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const raw = String(text || '').replace(/^\uFEFF/, '');
    const delimiter = rpDetectCsvDelimiter(raw);
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        const next = raw[i + 1];
        if (quoted) {
            if (ch === '"' && next === '"') {
                cell += '"';
                i++;
            } else if (ch === '"') {
                quoted = false;
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === delimiter) {
            row.push(cell);
            cell = '';
        } else if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else if (ch !== '\r') {
            cell += ch;
        }
    }
    row.push(cell);
    rows.push(row);
    return rows.filter(r => r.some(v => String(v || '').trim() !== ''));
}

function rpParseBulkConfigRows(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '');
    if (/<table[\s>]/i.test(raw) || /<html[\s>]/i.test(raw)) {
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        const table = doc.querySelector('table');
        if (table) {
            return Array.from(table.querySelectorAll('tr'))
                .map(tr => Array.from(tr.children)
                    .filter(cell => /^(td|th)$/i.test(cell.tagName))
                    .map(cell => String(cell.textContent || '').trim()))
                .filter(row => row.some(v => v !== ''));
        }
    }
    return rpParseCsv(raw);
}

function rpCleanImportedCell(value) {
    let text = String(value ?? '').replace(/\u00a0/g, ' ').trim();
    const formulaText = text.match(/^=\s*"([\s\S]*)"$/);
    if (formulaText) text = formulaText[1].replace(/""/g, '"').trim();
    if (text.startsWith("'")) text = text.slice(1).trim();
    return text;
}

function captureRpBulkConfigTableInputs() {
    document.querySelectorAll('#rp-bulk-config-tbody .rp-bulk-config-input').forEach(input => {
        setRpBulkConfigValue(input.dataset.aadvid, input.dataset.field, input.value);
    });
}

function exportRpBulkConfigXlsx() {
    captureRpBulkConfigTableInputs();
    saveRpConfig();
    const keys = getRpShopKeys();
    if (!keys.length) {
        showToast('⚠️ Chưa có shop để xuất file');
        return;
    }
    const header = RP_BULK_CONFIG_COLUMNS.map(col => col.label);
    const rows = keys.map(aadvid => {
        const shop = shops[aadvid] || {};
        const cfg = rpConfig[aadvid] || {};
        return RP_BULK_CONFIG_COLUMNS.map(col => {
            if (col.key === 'aadvid') return aadvid;
            if (col.key === 'oec_seller_id') return shop.oec_seller_id || '';
            if (col.key === 'seller_id') return shop.seller_id || '';
            if (col.key === 'shop') return getRpShopDisplayName(aadvid);
            return cfg[col.key] || '';
        });
    });
    const blob = rpBuildBulkConfigXlsxBlob([header, ...rows]);
    const url = URL.createObjectURL(blob);
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })).toLocaleDateString('en-CA');
    const a = document.createElement('a');
    a.href = url;
    a.download = `strangetts-report-id-template-${today}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`✅ Đã xuất file XLSX cho ${keys.length} shop`);
}

async function importRpBulkConfigFile(e) {
    const fileInput = e.target;
    const file = fileInput?.files?.[0];
    if (!file) return;
    try {
        const rows = await rpReadBulkConfigRowsFromFile(file);
        if (rows.length < 2) {
            showToast('⚠️ File Excel chưa có dữ liệu');
            return;
        }
        const header = rows[0].map(h => rpCleanImportedCell(h).toLowerCase());
        const colIndex = (labels) => labels.map(l => header.indexOf(l)).find(i => i >= 0);
        const idx = {
            oec_seller_id: colIndex(['oec_seller_id', 'oic_seller_id']),
            seller_id: colIndex(['seller_id']),
            aadvid: colIndex(['aadvid_ref', 'aadvid', 'shop_id']),
            shop: colIndex(['shop', 'shop_name']),
            tgToken: colIndex(['bot_token', 'tg_token', 'telegram_token']),
            tgChatId: colIndex(['tele_id_1', 'tg_chat_id', 'telegram_id_1']),
            tgChatId2: colIndex(['tele_id_2', 'tg_chat_id_2', 'telegram_id_2']),
            tgThreadId: colIndex(['topic_id', 'thread_id', 'tg_thread_id']),
            groupId: colIndex(['zalo_group_id', 'group_id']),
            zaloUserId: colIndex(['zalo_user_id', 'user_id']),
            sheetsUrl: colIndex(['sheet_url', 'sheets_url', 'apps_script_url'])
        };
        if (idx.oec_seller_id < 0 && idx.seller_id < 0 && idx.aadvid < 0 && idx.shop < 0) {
            showToast('⚠️ File thiếu cột oec_seller_id / seller_id / aadvid_ref');
            return;
        }
        const shopNameToKey = new Map();
        const aadvidToKey = new Map();
        const oecSellerToKey = new Map();
        const sellerToKey = new Map();
        getRpShopKeys().forEach(key => {
            const shop = shops[key] || {};
            shopNameToKey.set(getRpShopDisplayName(key).trim().toLowerCase(), key);
            aadvidToKey.set(String(key || '').trim(), key);
            if (shop.aadvid) aadvidToKey.set(String(shop.aadvid).trim(), key);
            if (shop.oec_seller_id) oecSellerToKey.set(String(shop.oec_seller_id).trim(), key);
            if (shop.seller_id) sellerToKey.set(String(shop.seller_id).trim(), key);
        });
        let imported = 0;
        let updated = 0;
        rows.slice(1).forEach(row => {
            const rawOecSellerId = idx.oec_seller_id >= 0 ? rpCleanImportedCell(row[idx.oec_seller_id]) : '';
            const rawSellerId = idx.seller_id >= 0 ? rpCleanImportedCell(row[idx.seller_id]) : '';
            const rawAadvid = idx.aadvid >= 0 ? rpCleanImportedCell(row[idx.aadvid]) : '';
            const rawShop = idx.shop >= 0 ? rpCleanImportedCell(row[idx.shop]).toLowerCase() : '';
            const aadvid = oecSellerToKey.get(rawOecSellerId) || sellerToKey.get(rawSellerId) || aadvidToKey.get(rawAadvid) || shopNameToKey.get(rawShop);
            if (!aadvid) return;
            ['tgToken', 'tgChatId', 'tgChatId2', 'tgThreadId', 'groupId', 'zaloUserId', 'sheetsUrl'].forEach(field => {
                const i = idx[field];
                const value = i >= 0 ? rpCleanImportedCell(row[i]) : '';
                if (value) {
                    setRpBulkConfigValue(aadvid, field, value);
                    updated++;
                }
            });
            imported++;
        });
        saveRpConfig();
        renderRpBulkConfigTable();
        renderReportShopList({ captureInputs: false });
        showToast(imported ? `✅ Đã nhập ${updated} ô cấu hình cho ${imported} shop` : '⚠️ Không khớp shop nào trong file');
    } catch (err) {
        console.error('[Strange TTS RP] Import bulk config file error:', err);
        showToast(`❌ Lỗi đọc file Excel: ${err.message}`);
    } finally {
        if (fileInput) fileInput.value = '';
    }
}
function buildShopPayload(aadvid) {
    const s = shops[aadvid] || {};
    return {
        name: s.name,
        aadvid: s.aadvid,
        oec_seller_id: s.oec_seller_id,
        seller_id: s.seller_id,
        bc_id: s.bc_id,
        cookies: s.cookies,
        ads_accounts: s.ads_accounts || [],
        local_key: aadvid,
        canonical_shop_id: s.canonical_shop_id || '',
        source_username: s.source_username || '',
        source_shop_key: s.source_shop_key || '',
        cookieFingerprint: s.cookieFingerprint || '',
        cookieUpdatedAt: s.cookieUpdatedAt || ''
    };
}

// ===== MULTI-ACCOUNT ADS MERGE =====
// Gọi SAU KHI fetch TK chính xong (status ok).
// Fetch thêm Ads (hôm nay, hôm qua, 7 ngày, tháng) cho từng TK phụ rồi cộng tổng.
// Data Shop (revenue, orders) KHÔNG thay đổi vì đó là data của cả shop.
async function _mergeExtraAdsAccounts(aadvid, mainResult) {
    const shop = shops[aadvid] || {};
    const mainAadvid = String(shop.aadvid || aadvid || '');
    const extraAccounts = (shop.ads_accounts || [])
        .filter(a => a.aadvid && String(a.aadvid) !== mainAadvid && a.enabled !== false);

    if (extraAccounts.length === 0) return mainResult; // Không có TK phụ → trả nguyên

    console.log(`[Strange TTS RP] "${shop.name}" có ${extraAccounts.length} TK phụ, fetch Ads tuần tự...`);

    const merged = { ...mainResult };

    // Helper: cộng 1 period ads (cost, gmv, orders) từ src vào merged
    const addAds = (field, src) => {
        if (!src || !src[field]) return;
        if (!merged[field]) merged[field] = { cost: 0, gmv: 0, orders: 0, roi: 0 };
        merged[field].cost   = (merged[field].cost   || 0) + (src[field].cost   || 0);
        merged[field].gmv    = (merged[field].gmv    || 0) + (src[field].gmv    || 0);
        merged[field].orders = (merged[field].orders || 0) + (src[field].orders || 0);
    };

    // FETCH TUẦN TỰ (for...of, không song song):
    // - Background inject cookie từng shop → song song sẽ ghi đè cookie nhau
    // - Dùng fetch_shop_report (không phải fetch_multi_shop) vì nó trả đủ
    //   adsToday, adsYesterday, ads7d, adsMonth cho tất cả các period cần báo cáo
    for (const acc of extraAccounts) {
        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    action: 'fetch_shop_report',
                    shop: {
                        name: shop.name,
                        aadvid: acc.aadvid,
                        oec_seller_id: shop.oec_seller_id,
                        seller_id: shop.seller_id,
                        bc_id: shop.bc_id,
                        cookies: shop.cookies,
                        local_key: aadvid,
                        canonical_shop_id: shop.canonical_shop_id || '',
                        source_username: shop.source_username || '',
                        source_shop_key: shop.source_shop_key || '',
                        cookieFingerprint: shop.cookieFingerprint || '',
                        cookieUpdatedAt: shop.cookieUpdatedAt || ''
                    },
                    fetchOptions: { needDailyAds: false, needCampaigns: false, needAccountInfo: false }
                }, res => resolve(res));
            });

            if (!response || response.status !== 'ok') {
                console.warn(`[Strange TTS RP] TK phụ ${acc.aadvid} (${acc.label||''}): lỗi fetch, bỏ qua`);
                continue;
            }

            // Cộng 4 period Ads — KHÔNG đụng today/yesterday/monthly/stats7d (data shop)
            addAds('adsToday',     response);
            addAds('adsYesterday', response);
            addAds('ads7d',        response);
            addAds('adsMonth',     response);
            // Số dư/ngưỡng chỉ lấy từ TK chính; TK phụ chỉ cộng Ads metrics.
            console.log(`[Strange TTS RP] ✅ Cộng TK phụ "${acc.label||acc.aadvid}": hôm nay=${response.adsToday?.cost||0}, hôm qua=${response.adsYesterday?.cost||0}, tháng=${response.adsMonth?.cost||0}`);
        } catch (e) {
            console.warn(`[Strange TTS RP] TK phụ ${acc.aadvid}: exception, bỏ qua —`, e.message);
        }
    }

    // Tính lại ROI cho từng period sau khi cộng tổng
    ['adsToday','adsYesterday','ads7d','adsMonth'].forEach(field => {
        if (merged[field] && merged[field].cost > 0) {
            merged[field].roi = parseFloat((merged[field].gmv / merged[field].cost).toFixed(2));
        }
    });

    merged._multiAccount = true; // Debug flag
    return merged;
}

// Lấy ads data theo period được chọn
function getAdsByPeriod(aadvid) {
    const d = rpData[aadvid] || {};
    const p = rpPeriod[aadvid] || 'yd';
    let adsData = {};
    if (p === 'yd')    adsData = d.adsYesterday || {};
    if (p === '7d')    adsData = d.ads7d        || {};
    if (p === 'month') adsData = d.adsMonth     || {};
    return adsData;
}

function buildRpShopCard(aadvid) {
    const shop = shops[aadvid] || {};
    const cfg  = rpConfig[aadvid] || {};
    const d    = rpData[aadvid]   || {};
    const isLoaded  = d.status === 'ok';
    const isLoading = d.status === 'loading';
    const displayName = shop.shopRealName || shop.name || aadvid;
    const avatarHtml = shop.shopAvatar
        ? `<img src="${shop.shopAvatar}" class="v20-avatar" style="width:40px;height:40px;border-radius:10px">`
        : `<div class="v20-shop-icon" style="width:40px;height:40px;border-radius:10px;font-size:18px"><i class="fa-solid fa-shop"></i></div>`;

    const p = rpPeriod[aadvid] || 'yd'; // giữ cho scheduler biết

    // ADS data — cả 4 periods (today, yesterday, 7d, month)
    const adsTd    = d.adsToday     || {};
    const adsYd    = d.adsYesterday || {};
    const ads7     = d.ads7d        || {};
    const adsMo    = d.adsMonth     || {};

    // SHOP data — hôm nay + hôm qua + 7 ngày + tháng này
    const tod    = d.today     || {};
    const yd     = d.yesterday || {};
    const w7shop = d.stats7d   || {};
    const todRev = tod.revenue || 0;
    const todOrd = tod.orders  || 0;
    const ydRev  = yd.revenue  || 0;
    const ydOrd  = yd.orders   || 0;
    const w7Rev  = w7shop.revenue || 0;
    const w7Ord  = w7shop.orders  || 0;

    // Monthly
    const target   = rpReadMoney(cfg.targetRevenue);
    const moRev    = (d.monthly || {}).revenue || 0;
    const moOrd    = (d.monthly || {}).orders  || 0;
    const progress = target > 0 ? (moRev / target * 100).toFixed(1) : null;

    // ROI tổng = DT cửa hàng / Chi phí Ads
    const roiTodShop = adsTd.cost > 0 ? (todRev / adsTd.cost) : 0;
    const roiYdShop  = adsYd.cost > 0 ? (ydRev  / adsYd.cost) : 0;
    const roiW7Shop  = ads7.cost  > 0 ? (w7Rev  / ads7.cost)  : 0;
    const roiMoShop  = adsMo.cost > 0 ? (moRev  / adsMo.cost) : 0;
    const roiColor   = (roi) => roi >= 5 ? '#22c55e' : roi >= 3 ? '#a3e635' : roi >= 2 ? '#facc15' : '#f97316';

    // Balance
    const balance   = d.balance   || 0;
    const credit    = d.credit    || 0;
    const threshold = d.threshold || 0;
    const thSpent   = d.thresholdSpent || 0;
    const hasAccountFlags = ('_balanceLoaded' in d) || ('_billingLoaded' in d) || ('_dueDateLoaded' in d) || ('_accountInfoLoaded' in d);
    const balanceKnown = hasAccountFlags ? !!d._balanceLoaded : (d.balance != null || d.credit != null);
    const thresholdKnown = hasAccountFlags ? (!!d._dueDateLoaded || threshold > 0) : (threshold > 0 || d.billingType === 2);
    const isPrepay = !((d.billingType === 2) || (d.threshold > 0));
    const isPostpay = !isPrepay;
    const blinkCls  = isPostpay && threshold > 0 && (thSpent / threshold) >= 0.8 ? 'blink-red' : '';

    // Status
    let statusColor = '#64748b', statusBg = 'rgba(100,116,139,0.15)', statusText = 'CHƯA TẢI';
    if (d.status === 'processing') { 
        statusColor = '#a855f7'; statusBg = 'rgba(168,85,247,0.15)'; statusText = 'ĐANG GỬI'; 
    } else if (d.status === 'loading') { 
        statusColor = '#fbbf24'; statusBg = 'rgba(251,191,36,0.15)'; 
        statusText = `⏳ ${d.secondsLeft || 20}s`; 
    } else if (d.status === 'ok') { 
        statusColor = '#22c55e'; statusBg = 'rgba(34,197,94,0.15)'; 
        statusText = new Date(d.fetchedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}); 
    } else if (d.status === 'error') { 
        statusColor = '#ef4444'; statusBg = 'rgba(239,68,68,0.15)'; statusText = 'LỖI'; 
    }

    const vnNow = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}));
    const todayKey = vnNow.toLocaleDateString('en-CA');
    const autoSentToday = rpSentToday[aadvid] === todayKey;

    // Balance cell
    let balHtml = '';
    if (!isLoaded) balHtml = '<span class="v20-val blue" style="font-size:20px">—</span>';
    else if (isPostpay && thresholdKnown && threshold > 0) {
        const pct = (thSpent / threshold * 100).toFixed(0);
        balHtml = `<div class="v20-th-compact">
            <span class="th-spent">${fmtM(thSpent)}đ</span>
            <div class="th-sep"></div>
            <span class="th-limit">${fmtM(threshold)}đ</span>
            <span style="font-size:10px;color:${pct>=80?'#ef4444':'#94a3b8'}">${pct}%</span>
        </div>`;
    } else if (isPostpay && !thresholdKnown) {
        balHtml = `<span class="v20-val blue" style="font-size:12px">Chưa tải ngưỡng</span>`;
    } else if (!balanceKnown) {
        balHtml = `<span class="v20-val blue" style="font-size:12px">Chưa tải số dư</span>`;
    } else {
        balHtml = `<span class="v20-val blue" style="font-size:14px">${fmtM(balance+credit)}đ</span>`;
    }

    // Helper: render 1 cột ADS (chi phí, dt ads, roi)
    const adsCol = (label, labelColor, borderColor, bgColor, ads) => {
        const cost = ads.cost || 0;
        const gmv  = ads.gmv  || 0;
        const roi  = parseFloat(ads.roi || 0);
        return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:10px 12px">
          <div style="font-size:10px;color:${labelColor};font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
          <div style="margin-bottom:5px">
            <div style="font-size:9px;color:var(--text-dim)">💸 Chi phí Ads</div>
            <div style="font-size:12px;font-weight:700;color:#f97316">${isLoaded?fmtDots(cost)+'đ':isLoading?'…':'—'}</div>
          </div>
          <div style="margin-bottom:5px">
            <div style="font-size:9px;color:var(--text-dim)">💰 DT qua Ads</div>
            <div style="font-size:12px;font-weight:700;color:#22c55e">${isLoaded?fmtDots(gmv)+'đ':isLoading?'…':'—'}</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--text-dim)">📈 ROI Ads</div>
            <div style="font-size:18px;font-weight:800;color:${roiColor(roi)}">${isLoaded?roi.toFixed(2):isLoading?'…':'—'}</div>
          </div>
        </div>`;
    };

    // Helper: render 1 cột SHOP (Dùng cho phần Cửa hàng tổng khi click Xem Thêm)
    const shopCol = (label, labelColor, borderColor, bgColor, rev, ord, roiShop) => {
        return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:8px 10px">
          <div style="font-size:9px;color:${labelColor};font-weight:700;margin-bottom:6px;text-transform:uppercase">${label}</div>
          <div style="margin-bottom:4px">
            <div style="font-size:8px;color:var(--text-dim)">💰 GMV</div>
            <div style="font-size:11px;font-weight:700;color:#e2e8f0">${isLoaded?fmtDots(rev)+'đ':isLoading?'…':'—'}</div>
          </div>
          <div style="margin-bottom:4px">
            <div style="font-size:8px;color:var(--text-dim)">📦 Đơn</div>
            <div style="font-size:11px;font-weight:700;color:#facc15">${isLoaded?fmtDots(ord):isLoading?'…':'—'}</div>
          </div>
          <div>
            <div style="font-size:8px;color:var(--text-dim)">📈 ROI</div>
            <div style="font-size:11px;font-weight:700;color:${roiColor(roiShop)}">${isLoaded?roiShop.toFixed(2):isLoading?'…':'—'}</div>
          </div>
        </div>`;
    };

    const card = document.createElement('div');
    card.className = 'shop-card';
    card.id        = 'rp-card-' + aadvid;
    card.dataset.shopName = displayName.toLowerCase();
    card.innerHTML = `
      <!-- HEADER -->
      <div class="v20-card-header">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          ${avatarHtml}
          <div style="min-width:0">
            <div class="v20-shop-name" title="${displayName}">${displayName}</div>
            <div class="v20-ads-acc-name" title="${shop.name||aadvid}">${shop.name||aadvid}</div>
          </div>
        </div>
        <div class="v20-header-right">
          <div class="v20-shop-status" style="color:${statusColor};background:${statusBg}">${statusText}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
            ${cfg.autoSend ? `<span style="font-size:10px;color:var(--accent);font-weight:700">⏰ ${cfg.sendTime||'08:00'} ${autoSentToday?'✅':''}</span>` : ''}
            <i class="fa-solid fa-rotate" style="cursor:pointer;color:var(--text-dim);font-size:12px" id="rp-sync-${aadvid}"></i>
          </div>
        </div>
      </div>

      <!-- ACTIONS ONLY -->
      <div class="v20-ads-stripe" style="padding:8px 16px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.05)">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
          <div style="display:flex;gap:8px;align-items:center">
            <span class="v20-badge mini ${isPostpay?'badge-postpaid':'badge-prepaid'}">${isPostpay?'Trả sau':'Trả trước'}</span>
            <span style="font-size:11px;color:#94a3b8">Dư: <b style="color:#60a5fa">${fmtDots(balance+credit)}đ</b></span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary rp-btn-fetch" data-aadvid="${aadvid}" style="padding:4px 12px;font-size:11px;font-weight:700">⬇️ TẢI LẠI</button>
            <button class="btn btn-sm btn-ghost rp-btn-preview" data-aadvid="${aadvid}" ${!isLoaded?'disabled':''} style="padding:4px 12px;font-size:11px;font-weight:700">👁️ XEM TRƯỚC</button>
          </div>
        </div>
      </div>

      <!-- DETAILED SECTIONS -->
      <div id="rp-details-${aadvid}">
        <!-- SECTION: ADS — 3 cột (QUẢNG CÁO) -->
        <div style="padding:10px 16px 4px; border-top: 1px solid rgba(255,255,255,0.05)">
          <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#f97316;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span style="width:3px;height:14px;background:#f97316;border-radius:2px;display:inline-block"></span>
            📣 QUẢNG CÁO
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">
            ${adsCol('📅 Hôm nay',   '#22c55e', 'rgba(34,197,94,0.25)',    'rgba(34,197,94,0.05)',    adsTd)}
            ${adsCol('📅 Hôm qua',   '#94a3b8', 'rgba(100,116,139,0.25)', 'rgba(100,116,139,0.08)', adsYd)}
            ${adsCol('🔹 7 Ngày',    '#60a5fa', 'rgba(96,165,250,0.25)',   'rgba(96,165,250,0.05)',   ads7)}
            ${adsCol('🗓️ Tháng này','#c084fc', 'rgba(192,132,252,0.25)', 'rgba(192,132,252,0.05)', adsMo)}
          </div>
        </div>

        <!-- SECTION: CỬA HÀNG TỔNG -->
        <div id="rp-shop-stats-${aadvid}" style="padding:4px 16px 8px; display: grid">
          <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#22c55e;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span style="width:3px;height:14px;background:#22c55e;border-radius:2px;display:inline-block"></span>
            🏪 CỬA HÀNG TỔNG
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">
            ${shopCol('📅 Hôm nay',   '#22c55e', 'rgba(34,197,94,0.25)',    'rgba(34,197,94,0.05)',    todRev, todOrd, roiTodShop)}
            ${shopCol('📅 Hôm qua',   '#94a3b8', 'rgba(100,116,139,0.25)', 'rgba(100,116,139,0.08)', ydRev,  ydOrd,  roiYdShop)}
            ${shopCol('🔹 7 Ngày',    '#60a5fa', 'rgba(96,165,250,0.25)',   'rgba(96,165,250,0.06)',   w7Rev,  w7Ord,  roiW7Shop)}
            ${shopCol('🗓️ Tháng này','#c084fc', 'rgba(192,132,252,0.25)', 'rgba(192,132,252,0.05)', moRev,  moOrd,  roiMoShop)}
          </div>
        </div>

        <!-- FOOTER: Config (Zalo/Tele/Sheets) -->
        <div class="v20-footer" style="flex-direction:column;gap:12px;padding:12px 20px; border-top: 1px solid rgba(255,255,255,0.05)">
        <!-- ROW 2a: Zalo IDs cạnh nhau -->
        <div style="display:flex;gap:10px;width:100%;margin-bottom:8px">
          <div style="flex:1;min-width:130px">
            <div style="font-size:10px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase;display:flex;align-items:center;gap:6px">
              <input type="checkbox" class="rp-zalo-group-on" data-aadvid="${aadvid}" ${cfg.zaloGroupOn !== false ? 'checked' : ''} style="width:12px;height:12px;cursor:pointer;accent-color:#a855f7" />
              🔷 Zalo Nhóm
            </div>
	            <input type="text" class="rp-input rp-group-id" data-rp-sensitive="1" placeholder="ID nhóm Zalo..." value="${cfg.groupId||''}" data-aadvid="${aadvid}" style="width:100%;opacity:${cfg.zaloGroupOn === false ? '0.4' : '1'}" />
            <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${maskStr(cfg.groupId, 6)}</div>
          </div>
          <div style="flex:1;min-width:130px">
            <div style="font-size:10px;color:#60a5fa;font-weight:700;margin-bottom:4px;text-transform:uppercase;display:flex;align-items:center;gap:6px">
              <input type="checkbox" class="rp-zalo-user-on" data-aadvid="${aadvid}" ${cfg.zaloUserOn !== false ? 'checked' : ''} style="width:12px;height:12px;cursor:pointer;accent-color:#60a5fa" />
              👤 Zalo Cá Nhân
            </div>
	            <input type="text" class="rp-input rp-zalo-user-id" data-rp-sensitive="1" placeholder="ID cá nhân Zalo..." value="${cfg.zaloUserId||''}" data-aadvid="${aadvid}" style="width:100%;opacity:${cfg.zaloUserOn === false ? '0.4' : '1'}" />
            <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${maskStr(cfg.zaloUserId, 6)}</div>
          </div>
	        </div>

	        <!-- ROW 2a.1: Auto Zalo Schedule -->
	        <div style="width:100%;padding:8px 0;border-top:1px solid rgba(168,85,247,0.15);border-bottom:1px solid rgba(168,85,247,0.08);margin-bottom:4px">
	          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
	            <div style="font-size:10px;color:#a855f7;font-weight:700;text-transform:uppercase;white-space:nowrap">⏰ Auto Zalo <span class="rp-countdown" data-aadvid="${aadvid}" data-type="zalo" style="font-size:9px;color:#a855f7;margin-left:6px;font-weight:bold"></span></div>
	            <label class="rp-toggle-wrap" title="Bật/tắt tự động gửi Zalo">
	              <input type="checkbox" class="rp-auto-toggle" data-aadvid="${aadvid}" ${cfg.autoSend?'checked':''} />
	              <span class="rp-toggle" style="background:${cfg.autoSend?'#a855f7':''};">AUTO ZALO</span>
	            </label>
	            <div style="display:flex;gap:2px;flex-wrap:wrap">
	              <button class="rp-day-pill all" data-field="sendDays" data-aadvid="${aadvid}" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#94a3b8;cursor:pointer">ALL</button>
	              ${['T2','T3','T4','T5','T6','T7','CN'].map((d,i)=>{const v=['1','2','3','4','5','6','0'][i];const on=(cfg.sendDays||['1','2','3','4','5','6','0']).includes(v);return `<button class="rp-day-pill" data-field="sendDays" data-val="${v}" data-aadvid="${aadvid}" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid ${on?'#a855f7':'#475569'};background:${on?'#a855f7':'#1e293b'};color:${on?'#fff':'#94a3b8'};cursor:pointer">${d}</button>`;}).join('')}
	            </div>
	          </div>
	          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
	            <input type="time" class="rp-input rp-send-time" value="${cfg.sendTime||'08:00'}" data-aadvid="${aadvid}" style="width:105px" />
	            <input type="text" class="rp-input rp-send-extra" placeholder="Lặp lại: 12:00, 18:00..." value="${cfg.sendExtra||''}" data-aadvid="${aadvid}" style="flex:1;min-width:120px;font-size:10px" />
	          </div>
	        </div>

        <!-- ROW 2b: Target Tháng + Buttons -->
        <div style="display:flex;gap:10px;align-items:flex-end;width:100%;margin-bottom:4px">
          <div style="flex:1;min-width:260px;display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:8px">
            <div>
              <div style="font-size:10px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase">🎯 Target doanh thu tháng</div>
              <input type="text" class="rp-input rp-target-rev" placeholder="300.000.000" value="${cfg.targetRevenue ? fmtDots(rpReadMoney(cfg.targetRevenue)) : ''}" data-aadvid="${aadvid}" style="width:100%" />
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase">💸 Ads mục tiêu %</div>
              <input type="text" class="rp-input rp-target-ads-pct" placeholder="30" value="${cfg.targetAdsPct || ''}" data-aadvid="${aadvid}" style="width:100%" />
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;padding-bottom:2px">
            <button class="v20-action-btn rp-btn-load" data-aadvid="${aadvid}" title="Tải dữ liệu mới ngay" style="background:linear-gradient(135deg,#8A8D91,#A1A4A8);color:white;font-size:10px;padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-weight:700;" ${isLoading?'disabled':''}>${isLoading?'⏳...':'🔄 Tải'}</button>
            <button class="v20-action-btn rp-btn-zalo-now" data-aadvid="${aadvid}" title="Gửi Zalo ngay" ${!isLoaded?'disabled':''} style="background:linear-gradient(135deg,#a855f7,#8A8D91);color:white;font-size:10px;padding:6px 14px;border-radius:6px;border:none;cursor:pointer;font-weight:700;white-space:nowrap">📤 Gửi Zalo</button>
          </div>
        </div>

        <!-- ROW 3: Telegram Config (Moved Up) -->
        <div style="display:flex;gap:10px;align-items:start;width:100%;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(96,165,250,0.15)">
          <div style="font-size:10px;color:#60a5fa;font-weight:700;text-transform:uppercase;white-space:nowrap;margin-top:4px">📨 Telegram</div>
          <div style="flex:2;min-width:180px">
            <div style="font-size:9px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase;display:flex;align-items:center;gap:6px">📨 Bot Token <button class="rp-tg-eye" data-field="token" data-aadvid="${aadvid}" style="background:none;border:none;cursor:pointer;color:#64748b;font-size:11px;padding:0">👁</button></div>
	            <input type="text" class="rp-input rp-tg-token" data-rp-sensitive="1" placeholder="Bot Token..." value="${cfg.tgToken || DEFAULT_TG_TOKEN}" data-aadvid="${aadvid}" style="width:100%;font-size:10px" />
          </div>
          <div style="flex:3;min-width:220px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <div style="font-size:9px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase"><input type="checkbox" class="rp-tg-on1" data-aadvid="${aadvid}" ${cfg.tgOn1 !== false ? 'checked' : ''} /> ID 1</div>
	              <input type="text" class="rp-input rp-tg-chatid" data-rp-sensitive="1" placeholder="ID 1..." value="${cfg.tgChatId || DEFAULT_TG_CHAT_ID}" data-aadvid="${aadvid}" style="width:100%" />
              <div style="font-size:9px;color:var(--text-dim);font-weight:700;margin:6px 0 4px;text-transform:uppercase">Topic ID</div>
              <div style="display:flex;gap:6px;align-items:center">
	                <input type="text" class="rp-input rp-tg-threadid" data-rp-sensitive="1" placeholder="Topic ID..." value="${cfg.tgThreadId || ''}" data-aadvid="${aadvid}" style="width:100%" />
                <button class="v20-action-btn rp-btn-tg-topic" data-aadvid="${aadvid}" title="Lấy Topic ID từ Telegram updates. Hãy gửi /id trong topic rồi bấm nút này.">🧭</button>
              </div>
            </div>
            <div>
              <div style="font-size:9px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase"><input type="checkbox" class="rp-tg-on2" data-aadvid="${aadvid}" ${cfg.tgOn2 !== false ? 'checked' : ''} /> ID 2</div>
	              <input type="text" class="rp-input rp-tg-chatid2" data-rp-sensitive="1" placeholder="ID 2..." value="${cfg.tgChatId2 || ''}" data-aadvid="${aadvid}" style="width:100%" />
            </div>
          </div>
          <div style="display:flex;gap:4px;margin-top:14px">
            <button class="v20-action-btn rp-btn-tg-preview" data-aadvid="${aadvid}" title="Preview Telegram" ${!isLoaded?'disabled':''}>👁️</button>
            <button class="v20-action-btn rp-btn-tg-send" data-aadvid="${aadvid}" title="Gửi Telegram ngay" ${!isLoaded?'disabled':''}>📨</button>
          </div>
        </div>
        <!-- ROW 3b: Auto Telegram Schedule -->
        <div style="width:100%;padding-bottom:6px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            <div style="font-size:10px;color:#60a5fa;font-weight:700;text-transform:uppercase;white-space:nowrap">⏰ Auto Tele <span class="rp-countdown" data-aadvid="${aadvid}" data-type="tg" style="font-size:9px;color:#60a5fa;margin-left:6px;font-weight:bold"></span></div>
            <label class="rp-toggle-wrap" title="Bật/tắt tự động gửi Telegram">
              <input type="checkbox" class="rp-auto-tg-toggle" data-aadvid="${aadvid}" ${cfg.autoTelegram?'checked':''} />
              <span class="rp-toggle" style="background:${cfg.autoTelegram?'#3b82f6':''};">AUTO TG</span>
            </label>
            <div style="display:flex;gap:2px;flex-wrap:wrap">
              <button class="rp-day-pill all" data-field="tgDays" data-aadvid="${aadvid}" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#94a3b8;cursor:pointer">ALL</button>
              ${['T2','T3','T4','T5','T6','T7','CN'].map((d,i)=>{const v=['1','2','3','4','5','6','0'][i];const on=(cfg.tgDays||['1','2','3','4','5','6','0']).includes(v);return `<button class="rp-day-pill" data-field="tgDays" data-val="${v}" data-aadvid="${aadvid}" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid ${on?'#3b82f6':'#475569'};background:${on?'#3b82f6':'#1e293b'};color:${on?'#fff':'#94a3b8'};cursor:pointer">${d}</button>`;}).join('')}
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <input type="time" class="rp-input rp-tg-time" value="${cfg.tgTime||'09:00'}" data-aadvid="${aadvid}" style="width:105px" />
            <input type="text" class="rp-input rp-tg-extra" placeholder="Lặp lại: 11:00, 15:00..." value="${cfg.tgExtra||''}" data-aadvid="${aadvid}" style="flex:1;min-width:120px;font-size:10px" />
          </div>
        </div>

        <!-- ROW 4: Sheets URL -->
        <div style="width:100%;padding-top:8px;border-top:1px solid rgba(34,197,94,0.15)">
          <div style="font-size:10px;color:var(--text-dim);font-weight:700;margin-bottom:4px;text-transform:uppercase">📊 Google Sheets URL</div>
	          <input type="text" class="rp-input rp-sheets-url" data-rp-sensitive="1" placeholder="Apps Script URL..." value="${cfg.sheetsUrl || DEFAULT_SHEETS_URL}" data-aadvid="${aadvid}" style="width:100%" />
        </div>
        <div style="width:100%;padding-bottom:6px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            <div style="font-size:10px;color:#22c55e;font-weight:700;text-transform:uppercase;white-space:nowrap">⏰ Auto Sheet <span class="rp-countdown" data-aadvid="${aadvid}" data-type="sheet" style="font-size:9px;color:#22c55e;margin-left:6px;font-weight:bold"></span></div>
            <label class="rp-toggle-wrap" title="Bật/tắt tự động gửi Sheet">
              <input type="checkbox" class="rp-auto-sheets-toggle" data-aadvid="${aadvid}" ${cfg.autoSheets?'checked':''} />
              <span class="rp-toggle" style="background:${cfg.autoSheets?'#22c55e':''};">AUTO SHEET</span>
            </label>
            <div style="display:flex;gap:2px;flex-wrap:wrap">
              <button class="rp-day-pill all" data-field="sheetsDays" data-aadvid="${aadvid}" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#94a3b8;cursor:pointer">ALL</button>
              ${['T2','T3','T4','T5','T6','T7','CN'].map((d,i)=>{const v=['1','2','3','4','5','6','0'][i];const on=(cfg.sheetsDays||['1','2','3','4','5','6','0']).includes(v);return `<button class="rp-day-pill" data-field="sheetsDays" data-val="${v}" data-aadvid="${aadvid}" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid ${on?'#22c55e':'#475569'};background:${on?'#22c55e':'#1e293b'};color:${on?'#fff':'#94a3b8'};cursor:pointer">${d}</button>`;}).join('')}
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <input type="time" class="rp-input rp-sheets-time" value="${cfg.sheetsTime||'08:30'}" data-aadvid="${aadvid}" style="width:105px" />
            <input type="text" class="rp-input rp-sheets-extra" placeholder="Lặp lại: 10:00, 14:00..." value="${cfg.sheetsExtra||''}" data-aadvid="${aadvid}" style="flex:1;min-width:120px;font-size:10px" />
            <button class="v20-action-btn rp-btn-sheets" data-aadvid="${aadvid}" title="Đẩy lên Google Sheets" ${!isLoaded?'disabled':''} style="white-space:nowrap">📊 Gửi Sheet</button>
          </div>
        </div>

	        <!-- ROW 5: Log Area -->
        <div class="rp-log-area" style="border-top:1px solid rgba(139,92,246,0.15)">
          <div class="rp-log-item">
            <span class="rp-log-label">Zalo:</span>
            <span class="rp-log-status ${(rpLogs[aadvid]?.zalo?.status)||'idle'}"><span class="rp-status-dot ${(rpLogs[aadvid]?.zalo?.status)||'idle'}"></span> ${(rpLogs[aadvid]?.zalo?.ts)||'--:--'} ${(rpLogs[aadvid]?.zalo?.msg)||'Chưa chạy'}</span>
          </div>
          <div class="rp-log-item">
            <span class="rp-log-label">Sheet:</span>
            <span class="rp-log-status ${(rpLogs[aadvid]?.sheet?.status)||'idle'}"><span class="rp-status-dot ${(rpLogs[aadvid]?.sheet?.status)||'idle'}"></span> ${(rpLogs[aadvid]?.sheet?.ts)||'--:--'} ${(rpLogs[aadvid]?.sheet?.msg)||'Chưa chạy'}</span>
          </div>
          <div class="rp-log-item">
            <span class="rp-log-label">Tele:</span>
            <span class="rp-log-status ${(rpLogs[aadvid]?.tg?.status)||'idle'}"><span class="rp-status-dot ${(rpLogs[aadvid]?.tg?.status)||'idle'}"></span> ${(rpLogs[aadvid]?.tg?.ts)||'--:--'} ${(rpLogs[aadvid]?.tg?.msg)||'Chưa chạy'}</span>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;width:100%;flex-wrap:wrap;padding-top:2px;border-top:1px solid rgba(139,92,246,0.15)">
            <div style="font-size:10px;color:#a78bfa;font-weight:700;text-transform:uppercase">⚙️ CẤU HÌNH</div>
            <button class="btn-rp-save" data-aadvid="${aadvid}"><i class="fa-solid fa-floppy-disk"></i> LƯU CẤU HÌNH</button>
        </div>
      </div> <!-- End rp-details -->
    `;

    // ===== Bind events =====
    // Handler chung: lưu config khi input thay đổi (dùng cả 'change' lẫn 'input' cho tg fields)
    function handleRpInputChange(e) {
        const av = e.target.dataset.aadvid;
        if (!av) return;
        if (!rpConfig[av]) rpConfig[av] = {};
        const input = e.target;
        const value = rpInputValue(input);
        if (input.classList.contains('rp-group-id'))     rpConfig[av].groupId      = value.trim();
        if (input.classList.contains('rp-zalo-user-id')) rpConfig[av].zaloUserId   = value.trim();
        if (input.classList.contains('rp-target-rev')) {
            rpFormatMoneyInput(input);
            rpConfig[av].targetRevenue = rpCleanMoneyInput(input.value);
        }
        if (input.classList.contains('rp-target-ads-pct')) rpConfig[av].targetAdsPct = rpCleanPctInput(input.value);
        if (input.classList.contains('rp-send-time'))    rpConfig[av].sendTime     = input.value;
        if (input.classList.contains('rp-send-extra'))   rpConfig[av].sendExtra    = input.value.trim();
        if (input.classList.contains('rp-sheets-url'))   rpConfig[av].sheetsUrl    = value.trim();
        if (input.classList.contains('rp-sheets-time'))  rpConfig[av].sheetsTime   = input.value;
        if (input.classList.contains('rp-sheets-extra')) rpConfig[av].sheetsExtra  = input.value.trim();
        if (input.classList.contains('rp-tg-token'))     rpConfig[av].tgToken      = value.replace(/\s/g, '') || DEFAULT_TG_TOKEN;
        if (input.classList.contains('rp-tg-chatid'))    rpConfig[av].tgChatId     = value.replace(/\s/g, '') || DEFAULT_TG_CHAT_ID;
        if (input.classList.contains('rp-tg-threadid'))  rpConfig[av].tgThreadId   = value.replace(/\s/g, '');
        if (input.classList.contains('rp-tg-chatid2'))   rpConfig[av].tgChatId2    = value.replace(/\s/g, '');
        if (input.classList.contains('rp-tg-time'))      rpConfig[av].tgTime       = input.value;
        if (input.classList.contains('rp-tg-extra'))     rpConfig[av].tgExtra      = input.value.trim();
        saveRpConfig();
    }

    // Bind checkbox change cho Telegram ID toggles
    card.querySelectorAll('.rp-tg-on1, .rp-tg-on2').forEach(cb => {
        cb.addEventListener('change', e => {
            const av = e.target.dataset.aadvid;
            if (!rpConfig[av]) rpConfig[av] = {};
            if (e.target.classList.contains('rp-tg-on1')) rpConfig[av].tgOn1 = e.target.checked;
            if (e.target.classList.contains('rp-tg-on2')) rpConfig[av].tgOn2 = e.target.checked;
            saveRpConfig();
        });
    });

    // Bind 'change' cho tất cả (lưu khi blur)
    card.querySelectorAll('.rp-group-id,.rp-zalo-user-id,.rp-target-rev,.rp-target-ads-pct,.rp-send-time,.rp-send-extra,.rp-sheets-url,.rp-sheets-time,.rp-sheets-extra,.rp-tg-token,.rp-tg-chatid,.rp-tg-threadid,.rp-tg-chatid2,.rp-tg-time,.rp-tg-extra').forEach(input => {
        input.addEventListener('change', handleRpInputChange);
        // Thêm 'input' listener cho tg-token và tg-chatid để capture ngay khi gõ
        if (input.classList.contains('rp-target-rev') || input.classList.contains('rp-tg-token') || input.classList.contains('rp-tg-chatid') || input.classList.contains('rp-tg-threadid') || input.classList.contains('rp-tg-chatid2') || input.classList.contains('rp-zalo-user-id')) {
            input.addEventListener('input', handleRpInputChange);
        }
    });

    // Toggle hiện/ẩn token (click vào nút 👁)
    card.querySelectorAll('.rp-tg-eye').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const field = btn.dataset.field;
            const targetInput = card.querySelector(field === 'token' ? '.rp-tg-token' : '.rp-tg-chatid');
            if (!targetInput) return;
            // Toggle letter-spacing để giả ẩn (không dùng type=password để tránh browser clear)
            const isHidden = targetInput.dataset.hidden === '1';
            if (isHidden) {
                targetInput.style.letterSpacing = '1px';
                targetInput.dataset.hidden = '0';
                btn.textContent = '🙈';
            } else {
                targetInput.style.letterSpacing = '4px';
                targetInput.style.fontFamily = 'monospace';
                targetInput.dataset.hidden = '1';
                btn.textContent = '👁';
            }
        });
    });
    // === Helper: lưu tất cả giá trị input hiện tại vào rpConfig TRƯỚC khi re-render ===
    function captureCardInputs(cardEl, av) {
        if (!rpConfig[av]) rpConfig[av] = {};
        const g = (cls) => {
            const input = cardEl.querySelector(cls);
            const value = rpInputValue(input).trim();
            return value || undefined;
        };
        const v = g('.rp-group-id'); if (v !== undefined) rpConfig[av].groupId = v;
        const u = g('.rp-zalo-user-id'); if (u !== undefined) rpConfig[av].zaloUserId = u;
        const targetRevInput = cardEl.querySelector('.rp-target-rev');
        if (targetRevInput) rpConfig[av].targetRevenue = rpCleanMoneyInput(rpInputValue(targetRevInput));
        const targetAdsInput = cardEl.querySelector('.rp-target-ads-pct');
        if (targetAdsInput) rpConfig[av].targetAdsPct = rpCleanPctInput(rpInputValue(targetAdsInput));
        const st = g('.rp-send-time'); if (st !== undefined) rpConfig[av].sendTime = st;
        const se = g('.rp-send-extra'); if (se !== undefined) rpConfig[av].sendExtra = se;
        const su = g('.rp-sheets-url'); if (su !== undefined) rpConfig[av].sheetsUrl = su;
        const sht = g('.rp-sheets-time'); if (sht !== undefined) rpConfig[av].sheetsTime = sht;
        const she = g('.rp-sheets-extra'); if (she !== undefined) rpConfig[av].sheetsExtra = she;
        const tok = g('.rp-tg-token'); if (tok !== undefined) rpConfig[av].tgToken = tok;
        const cid = g('.rp-tg-chatid'); if (cid !== undefined) rpConfig[av].tgChatId = cid;
        const tid = g('.rp-tg-threadid'); if (tid !== undefined) rpConfig[av].tgThreadId = tid;
        const cid2 = g('.rp-tg-chatid2'); if (cid2 !== undefined) rpConfig[av].tgChatId2 = cid2;
        const tgt = g('.rp-tg-time'); if (tgt !== undefined) rpConfig[av].tgTime = tgt;
        const tge = g('.rp-tg-extra'); if (tge !== undefined) rpConfig[av].tgExtra = tge;
    }

    card.querySelectorAll('.rp-zalo-group-on').forEach(cb => {
        cb.addEventListener('change', e => {
            const av = e.target.dataset.aadvid;
            captureCardInputs(card, av);
            rpConfig[av].zaloGroupOn = e.target.checked;
            saveRpConfig(); refreshRpCard(av);
            showToast(e.target.checked ? '✅ Bật gửi Zalo Nhóm' : '🔕 Tắt gửi Zalo Nhóm');
        });
    });
    card.querySelectorAll('.rp-zalo-user-on').forEach(cb => {
        cb.addEventListener('change', e => {
            const av = e.target.dataset.aadvid;
            captureCardInputs(card, av);
            rpConfig[av].zaloUserOn = e.target.checked;
            saveRpConfig(); refreshRpCard(av);
            showToast(e.target.checked ? '✅ Bật gửi Zalo Cá nhân' : '🔕 Tắt gửi Zalo Cá nhân');
        });
    });
    card.querySelectorAll('.rp-auto-toggle').forEach(cb => {
        cb.addEventListener('change', e => {
            const av = e.target.dataset.aadvid;
            captureCardInputs(card, av);
            rpConfig[av].autoSend = e.target.checked;
            saveRpConfig(); refreshRpCard(av);
            showToast(e.target.checked ? `⏰ Auto Zalo ON lúc ${rpConfig[av].sendTime||'08:00'}` : '🔕 Tắt auto Zalo');
        });
    });
    card.querySelectorAll('.rp-auto-sheets-toggle').forEach(cb => {
        cb.addEventListener('change', e => {
            const av = e.target.dataset.aadvid;
            captureCardInputs(card, av);
            rpConfig[av].autoSheets = e.target.checked;
            saveRpConfig(); refreshRpCard(av);
            showToast(e.target.checked ? `📊 Auto Sheet ON lúc ${rpConfig[av].sheetsTime||'08:30'}` : '📊 Tắt auto Sheet');
        });
    });
    card.querySelectorAll('.rp-auto-tg-toggle').forEach(cb => {
        cb.addEventListener('change', e => {
            const av = e.target.dataset.aadvid;
            captureCardInputs(card, av);
            rpConfig[av].autoTelegram = e.target.checked;
            saveRpConfig(); refreshRpCard(av);
            showToast(e.target.checked ? `📨 Auto Telegram ON lúc ${rpConfig[av].tgTime||'09:00'}` : '📨 Tắt auto Telegram');
        });
    });
    // Day picker pills
    card.querySelectorAll('.rp-day-pill').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const av = btn.dataset.aadvid, field = btn.dataset.field, val = btn.dataset.val;
            captureCardInputs(card, av);
            if (!rpConfig[av]) rpConfig[av] = {};
            
            if (btn.classList.contains('all')) {
                const current = rpConfig[av][field] || [];
                if (current.length === 7) rpConfig[av][field] = [];
                else rpConfig[av][field] = ['1','2','3','4','5','6','0'];
            } else {
                const days = rpConfig[av][field] ? [...rpConfig[av][field]] : ['1','2','3','4','5','6','0'];
                const idx = days.indexOf(val);
                if (idx >= 0) days.splice(idx, 1); else days.push(val);
                rpConfig[av][field] = days;
            }
            saveRpConfig(); refreshRpCard(av);
        });
    });
    // Save button
    card.querySelector('.btn-rp-save')?.addEventListener('click', e => {
        const av = e.target.dataset.aadvid;
        const btn = e.target;
        captureCardInputs(card, av);
        btn.classList.add('saving');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG LƯU...';
        saveRpConfig();
        setTimeout(() => {
            btn.classList.remove('saving');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ĐÃ LƯU XONG';
            showToast(`✅ Đã lưu cấu hình shop ${(shops[av]||{}).name}`);
            setTimeout(() => {
                if (btn) btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> LƯU CẤU HÌNH';
            }, 2000);
        }, 800);
    });
    card.querySelector('.rp-btn-fetch')?.addEventListener('click', e => { e.stopPropagation(); rpFetchShop(aadvid); });
    card.querySelector('.rp-btn-preview')?.addEventListener('click', e => { e.stopPropagation(); rpShowPreview(aadvid); });

    // Nút "🔄 Tải" thủ công — luôn hoạt động dù chưa có data
    card.querySelector('.rp-btn-load')?.addEventListener('click', async e => {
        e.stopPropagation();
        const btn = e.currentTarget;
        btn.textContent = '⏳...'; btn.disabled = true;
        showToast(`⏳ Đang tải dữ liệu: ${(shops[aadvid]||{}).name||aadvid}...`);
        const ok = await _ensureFreshData(aadvid, true);
        btn.textContent = '🔄 Tải'; btn.disabled = false;
        if (ok) {
            showToast(`✅ Đã tải xong: ${(shops[aadvid]||{}).name||aadvid}`);
        } else {
            showToast(`❌ Lỗi tải dữ liệu — kiểm tra kết nối`);
        }
    });

    
    card.querySelector('.rp-btn-send')?.addEventListener('click', async e => {
        e.stopPropagation();
        // Nếu chưa có data → load trước, nếu đã có → gửi ngay
        if (!_isFresh(aadvid)) {
            showToast('⏳ Đang tải dữ liệu...');
            await _ensureFreshData(aadvid, false);
        }
        if (rpData[aadvid]?.status === 'ok') {
            rpShowPreview(aadvid, true);
        } else {
            showToast('❌ Chưa có dữ liệu — hãy bấm 🔄 Tải trước!');
        }
    });

    card.querySelector('.rp-btn-zalo-now')?.addEventListener('click', async e => {
        e.stopPropagation();
        const btn = e.currentTarget;
        const oldText = btn.innerHTML;
        btn.innerHTML = '⏳...'; btn.disabled = true;
        
        await rpSendToZalo(aadvid);
        
        btn.innerHTML = oldText; btn.disabled = false;
    });

    card.querySelector('.rp-btn-sheets')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (!_isFresh(aadvid)) {
            showToast('⏳ Đang tải dữ liệu...');
            await _ensureFreshData(aadvid, false);
        }
        if (rpData[aadvid]?.status === 'ok') {
            await rpPushToSheets(aadvid);
        } else {
            showToast('❌ Chưa có dữ liệu — hãy bấm 🔄 Tải trước!');
        }
    });

    card.querySelector('.rp-btn-tg-preview')?.addEventListener('click', e => { e.stopPropagation(); rpShowPreview(aadvid); });

    card.querySelector('.rp-btn-tg-topic')?.addEventListener('click', async e => {
        e.stopPropagation();
        captureCardInputs(card, aadvid);
        await rpDetectTelegramTopicId(aadvid);
    });

    card.querySelector('.rp-btn-tg-send')?.addEventListener('click', async e => {
        e.stopPropagation();
        if (!_isFresh(aadvid)) {
            showToast('⏳ Đang tải dữ liệu...');
            await _ensureFreshData(aadvid, false);
        }
        if (rpData[aadvid]?.status === 'ok') {
            await rpSendToTelegram(aadvid);
        } else {
            showToast('❌ Chưa có dữ liệu — hãy bấm 🔄 Tải trước!');
        }
    });

    card.querySelector(`#rp-sync-${aadvid}`)?.addEventListener('click', e => { e.stopPropagation(); rpFetchShop(aadvid); });

    return card;
}

function refreshRpCard(aadvid) {
    const el = document.getElementById('rp-card-' + aadvid);
    if (!el) return;
    // capture giá trị đang nhập TRƯỚC khi xóa/vẽ lại card
    _captureOneCard(el, aadvid);
    if ((typeof currentRpSort !== 'undefined' ? currentRpSort : 'name') !== 'name') {
        renderReportShopList({ captureInputs: false });
        const q = document.getElementById('rp-shop-search')?.value || '';
        if (typeof rpFilterShops === 'function') rpFilterShops(q);
        return;
    }
    el.replaceWith(buildRpShopCard(aadvid));
}

// Format helpers
function fmtDots(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    return Number(n).toLocaleString('vi-VN');
}

function fmtM(n) {
    if (!n || n === 0) return '0';
    if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    return fmtDots(Math.round(n));
}

// ===== FETCH =====
function rpFetchShop(aadvid) {
    const shop = shops[aadvid]; if (!shop) return;
    rpData[aadvid] = { status: 'loading' };
    refreshRpCard(aadvid);
    showToast(`⏳ Đang tải: ${shop.shopRealName || shop.name}...`);
    chrome.runtime.sendMessage({ action: 'fetch_shop_report', shop: buildShopPayload(aadvid) }, async response => {
        if (response && response.status === 'ok') {
            rpData[aadvid] = { ...response, fetchedAt: Date.now(), _mainAadvid: shop.aadvid || response.aadvid || '' };
            rpData[aadvid] = await _mergeExtraAdsAccounts(aadvid, rpData[aadvid]);
            refreshRpCard(aadvid);
            showToast(`✅ Xong: ${shop.shopRealName||shop.name}`);
        } else {
            rpData[aadvid] = { status: 'error', error: (response&&response.error)||'unknown' };
            refreshRpCard(aadvid);
            showToast(`❌ Lỗi: ${rpData[aadvid].error}`);
        }
    });
}
async function rpFetchAll() {
    // Ngăn chạy đồng thời với batch gửi khác
    if (_batchRunning) { showToast('⚠️ Đang có batch khác chạy, chờ xong rồi thử lại!'); return; }
    _batchRunning = true;

    const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops[k]);
    if (!keys.length) { _batchRunning = false; showToast('⚠️ Không có shop'); return; }

    // === SET MANUAL BATCH LOCK vào storage ===
    // Scheduler đọc lock này và BỎ QUA hoàn toàn khi lock active
    // Lock tồn tại ngay cả khi Service Worker restart, TTL 15 phút
    await new Promise(r => chrome.storage.local.set({
        strangetts_manual_batch_lock: { running: true, startedAt: Date.now(), total: keys.length }
    }, r));

    setStatus(`⏳ Tải báo cáo ${keys.length} shop...`);
    try {
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const shopName = (shops[k]||{}).shopRealName || (shops[k]||{}).name || k;
            setStatus(`⏳ [${i+1}/${keys.length}] Đang tải: ${shopName}...`);
            showToast(`⏳ [${i+1}/${keys.length}] Đang tải: ${shopName}...`);

            await new Promise(res => {
                let done = false;
                // Timeout 90s cho VPS chậm
                const t = setTimeout(() => { if (!done) { done = true; res(); } }, 90000);
                rpData[k] = { status: 'loading' };
                refreshRpCard(k);
                chrome.runtime.sendMessage({ action: 'fetch_shop_report', shop: buildShopPayload(k) }, async response => {
                    if (!done) {
                        done = true;
                        clearTimeout(t);
                        if (response && response.status === 'ok') {
                            rpData[k] = { ...response, fetchedAt: Date.now(), _mainAadvid: shops[k]?.aadvid || response.aadvid || '' };
                            // Merge TK phụ (tuần tự, await để đảm bảo xong trước khi tiếp tục)
                            rpData[k] = await _mergeExtraAdsAccounts(k, rpData[k]);
                            // Ghi storage sau khi đã merge đủ data
                            chrome.storage.local.set({ [`strangetts_rp_data_${k}`]: rpData[k] });
                            refreshRpCard(k);
                            showToast(`✅ [${i+1}/${keys.length}] Xong: ${shopName}`);
                        } else {
                            rpData[k] = { status: 'error', error: (response && response.error) || 'Timeout hoặc lỗi không xác định' };
                            refreshRpCard(k);
                            showToast(`❌ [${i+1}/${keys.length}] Lỗi: ${shopName} — ${rpData[k].error||''}`);
                        }
                        // Chờ 2 giây: đủ để cookie cũ của shop này được giải phóng
                        // trước khi background inject cookie shop tiếp theo
                        setTimeout(res, 2000);
                    }
                });
            });

        }
        setStatus('✅ Hoàn tất tất cả!');
        setTimeout(() => setStatus('Sẵn sàng'), 5000);
    } finally {
        _batchRunning = false;
        // LUÔN clear lock kể cả khi có lỗi giữa chừng
        chrome.storage.local.remove('strangetts_manual_batch_lock');
    }
}


// ===== BUILD MESSAGE =====
function buildReportMessage(aadvid) {
    const shop = shops[aadvid] || {};
    const d    = rpData[aadvid] || {};
    const cfg  = rpConfig[aadvid] || {};
    const displayName = shop.shopRealName || shop.name || aadvid;

    // Time helpers
    const vnNow  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const timeStr   = `${String(vnNow.getHours()).padStart(2,'0')}:${String(vnNow.getMinutes()).padStart(2,'0')}`;
    const ydDate    = new Date(vnNow.getTime() - 86400000);
    const ydDateStr = `${String(ydDate.getDate()).padStart(2,'0')}/${String(ydDate.getMonth()+1).padStart(2,'0')}`;
    const todayFull = `${String(vnNow.getDate()).padStart(2,'0')}/${String(vnNow.getMonth()+1).padStart(2,'0')}/${vnNow.getFullYear()}`;
    const monthStr  = `${String(vnNow.getMonth()+1).padStart(2,'0')}/${vnNow.getFullYear()}`;

    // Data sources
    const td    = d.today        || {};
    const tdAds = d.adsToday     || {};
    const yd    = d.yesterday    || {};
    const ydAds = d.adsYesterday || {};
    const w7    = d.stats7d      || {};
    const w7Ads = d.ads7d        || {};
    const mo    = d.monthly      || {};
    const moAds = d.adsMonth     || {};

    const pct = (cost, rev) => rev > 0 ? (cost / rev * 100).toFixed(0) + '%' : '—';
    const roi = (rev, cost)  => cost > 0 ? (rev / cost).toFixed(2) : '—';
    const roiEmoji = (rev, cost) => {
        if (!cost || cost === 0) return '';
        const r = rev / cost;
        if (r >= 5) return ' 🔥';
        if (r >= 3) return ' 📈';
        if (r >= 2) return ' 📊';
        if (r < 1)  return ' ⚠️';
        return '';
    };

    const tdRev  = td.revenue  || 0;  const tdOrd  = td.orders   || 0;  const tdCost = tdAds.cost  || 0;
    const ydRev  = yd.revenue  || 0;  const ydOrd  = yd.orders   || 0;  const ydCost = ydAds.cost  || 0;
    const w7Rev  = w7.revenue  || 0;  const w7Ord  = w7.orders   || 0;  const w7Cost = w7Ads.cost  || 0;
    const moRev  = mo.revenue  || 0;  const moOrd  = mo.orders   || 0;  const moCost = moAds.cost  || 0;

    const fmt = (n) => { if (!n || n === 0) return '0'; return Math.round(Number(n)).toLocaleString('vi-VN'); };
    const SEP = '─────────────────────';
    const targetRev = rpReadMoney(cfg.targetRevenue);
    const targetAdsPct = rpReadPct(cfg.targetAdsPct);
    const daysInMonth = new Date(vnNow.getFullYear(), vnNow.getMonth() + 1, 0).getDate();
    const elapsedDays = Math.min(Math.max(vnNow.getDate(), 1), daysInMonth);
    const remainingDays = Math.max(daysInMonth - elapsedDays, 0);
    const dayProgress = Math.min(Math.max((vnNow.getHours() * 60 + vnNow.getMinutes()) / 1440, 0.25), 1);
    const sevenDayWindow = Math.max(1, Math.min(7, elapsedDays));
    const weightedAvg = (items) => {
        const valid = items.filter(item => Number(item.value) > 0 && Number(item.weight) > 0);
        const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
        if (!totalWeight) return 0;
        return valid.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
    };
    const todayProjectedRev = tdRev > 0 ? tdRev / dayProgress : 0;
    const todayProjectedCost = tdCost > 0 ? tdCost / dayProgress : 0;
    const recentRevAvg = weightedAvg([
        { value: ydRev, weight: 0.55 },
        { value: todayProjectedRev, weight: 0.45 }
    ]);
    const recentCostAvg = weightedAvg([
        { value: ydCost, weight: 0.55 },
        { value: todayProjectedCost, weight: 0.45 }
    ]);
    const dailyRevForecast = weightedAvg([
        { value: moRev / elapsedDays, weight: 0.50 },
        { value: w7Rev / sevenDayWindow, weight: 0.30 },
        { value: recentRevAvg, weight: 0.20 }
    ]);
    const dailyCostForecast = weightedAvg([
        { value: moCost / elapsedDays, weight: 0.40 },
        { value: w7Cost / sevenDayWindow, weight: 0.40 },
        { value: recentCostAvg, weight: 0.20 }
    ]);
    const forecastRev = Math.round(moRev + dailyRevForecast * remainingDays);
    const forecastAds = Math.round(moCost + dailyCostForecast * remainingDays);
    const forecastAdsPct = forecastRev > 0 ? (forecastAds / forecastRev * 100) : null;
    const revTargetStatus = (() => {
        if (targetRev <= 0) return '';
        const ratio = forecastRev / targetRev * 100;
        if (forecastRev >= targetRev) return ` (✅ đạt ${rpFmtPct(ratio)} mục tiêu)`;
        return ` (⚠️ mới đạt ${rpFmtPct(ratio)} mục tiêu)`;
    })();
    const adsTargetStatus = (() => {
        if (targetAdsPct <= 0 || forecastAdsPct === null) return '';
        const diff = Math.abs(forecastAdsPct - targetAdsPct) / targetAdsPct * 100;
        if (forecastAdsPct <= targetAdsPct) return ` (✅ thấp hơn mục tiêu ${rpFmtPct(diff)})`;
        return ` (⚠️ vượt mục tiêu ${rpFmtPct(diff)})`;
    })();

    let msg  = `📋 BÁO CÁO DỮ LIỆU VẬN HÀNH\n`;
    msg     += `🛍️ ${displayName}\n`;
    msg     += `🕐 Cập nhật lúc: ${timeStr} · ${todayFull}\n`;
    msg     += `${SEP}\n\n`;

    // HÔM NAY
    msg += `☀️ HÔM NAY\n`;
    msg += `   Đơn: ${fmt(tdOrd)}  |  Doanh thu: ${fmt(tdRev)}đ\n`;
    msg += `   Ads: ${fmt(tdCost)}đ  |  ROI: ${roi(tdRev,tdCost)}${roiEmoji(tdRev,tdCost)}  (${pct(tdCost,tdRev)})\n\n`;

    // HÔM QUA
    msg += `🌙 HÔM QUA (${ydDateStr})\n`;
    msg += `   Đơn: ${fmt(ydOrd)}  |  Doanh thu: ${fmt(ydRev)}đ\n`;
    msg += `   Ads: ${fmt(ydCost)}đ  |  ROI: ${roi(ydRev,ydCost)}${roiEmoji(ydRev,ydCost)}  (${pct(ydCost,ydRev)})\n\n`;

    // 7 NGÀY
    msg += `🗃 7 NGÀY QUA\n`;
    msg += `   Đơn: ${fmt(w7Ord)}  |  Doanh thu: ${fmt(w7Rev)}đ\n`;
    msg += `   Ads: ${fmt(w7Cost)}đ  |  ROI: ${roi(w7Rev,w7Cost)}${roiEmoji(w7Rev,w7Cost)}  (${pct(w7Cost,w7Rev)})\n\n`;

    // THÁNG
    msg += `📅 THÁNG ${monthStr}\n`;
    msg += `   Đơn: ${fmt(moOrd)}  |  Doanh thu: ${fmt(moRev)}đ\n`;
    msg += `   Ads: ${fmt(moCost)}đ  |  ROI: ${roi(moRev,moCost)}${roiEmoji(moRev,moCost)}  (${pct(moCost,moRev)})\n`;

    // NGÂN SÁCH
    msg += `\n${SEP}\n`;
    const hasAccountFlags = ('_balanceLoaded' in d) || ('_billingLoaded' in d) || ('_dueDateLoaded' in d) || ('_accountInfoLoaded' in d);
    const balanceKnown = hasAccountFlags ? !!d._balanceLoaded : (d.balance != null || d.credit != null);
    const thresholdKnown = hasAccountFlags ? (!!d._dueDateLoaded || (d.threshold || 0) > 0) : ((d.threshold || 0) > 0 || d.billingType === 2);
    const isPostpay = d.billingType === 2 || (d.threshold || 0) > 0;
    if (isPostpay) {
        const threshold = d.threshold || 0;
        const used      = d.thresholdSpent || 0;
        const usedPct   = threshold > 0 ? (used / threshold * 100) : 0;
        msg += `💳 Tài khoản: Trả sau\n`;
        if (thresholdKnown) msg += `   Ngưỡng: ${fmt(threshold)}đ · Đã tiêu: ${fmt(used)}đ (${usedPct.toFixed(1)}%)\n`;
        else msg += `   Ngưỡng: chưa tải được\n`;
        if (balanceKnown) msg += `   Số dư: ${fmt((d.balance||0)+(d.credit||0))}đ (TM: ${fmt(d.balance||0)} + Tín: ${fmt(d.credit||0)})`;
        else msg += `   Số dư: chưa tải được`;
        if (thresholdKnown && usedPct > 60) msg += `\n⚠️ Vui lòng kiểm tra/thanh toán tránh gián đoạn!`;
    } else {
        msg += `💳 Tài khoản: Trả trước\n`;
        if (balanceKnown) {
            const total = (d.balance || 0) + (d.credit || 0);
            msg += `   Số dư: ${fmt(total)}đ · TM: ${fmt(d.balance||0)} + Tín: ${fmt(d.credit||0)}`;
            if (total < 500000) msg += `\n⚠️ Vui lòng nạp thêm tránh gián đoạn!`;
        } else {
            msg += `   Số dư: chưa tải được`;
        }
    }

    msg += `\n\n${SEP}\n`;
    msg += `🎯 Mục tiêu tháng này\n`;
    msg += `   Doanh thu: ${targetRev > 0 ? fmt(targetRev) + 'đ' : 'chưa đặt'}  |  Ads: ${targetAdsPct > 0 ? rpFmtPct(targetAdsPct) : 'chưa đặt'}\n`;
    msg += `🔮 Dự kiến đạt\n`;
    msg += `   Doanh thu: ${fmt(forecastRev)}đ${revTargetStatus}\n`;
    msg += `   Ads: ${forecastAdsPct === null ? 'chưa đủ dữ liệu' : rpFmtPct(forecastAdsPct) + ' doanh thu'}${adsTargetStatus}`;
    return msg;
}

// ===== PREVIEW =====
function rpShowPreview(aadvid) {
    const d = rpData[aadvid];
    if (!d || d.status !== 'ok') { 
        showToast('⚠️ Chưa có dữ liệu — bấm 🔄 Tải trước!'); 
        return; 
    }
    rpPreviewShop = aadvid;
    document.getElementById('rp-modal-shop-name').textContent = `Preview: ${(shops[aadvid]||{}).shopRealName || (shops[aadvid]||{}).name}`;
    document.getElementById('rp-msg-preview').textContent = buildReportMessage(aadvid);
    document.getElementById('rp-preview-modal').style.display = 'flex';
}
function closeRpModal() {
    document.getElementById('rp-preview-modal').style.display = 'none';
    rpPreviewShop = null;
}

// ===== GỬI ZALO =====
async function rpSendToZalo(aadvid) {
    // Caller (button handler / scheduler) đã đảm bảo data mới → chỉ load nếu stale
    const ok = await _ensureFreshData(aadvid, false);
    if (!ok) { showToast('❌ Bỏ qua — Lỗi tải dữ liệu'); return; }

    const cfg = rpConfig[aadvid] || {};
    const sendGroup = cfg.zaloGroupOn !== false && cfg.groupId;
    const sendUser  = cfg.zaloUserOn  !== false && cfg.zaloUserId;
    if (!sendGroup && !sendUser) { showToast('⚠️ Chưa nhập ID hoặc đang tắt cả hai kếnh Zalo!'); return; }
    const server = rpConfig.__server__ || rpZaloServer || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
    try {
        const payload = {
            message: buildReportMessage(aadvid)
        };
        if (sendGroup) payload.group_id = cfg.groupId;
        if (sendUser)  payload.user_id = cfg.zaloUserId;

        const res  = await fetch(`${server}/send`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        const ok = json.ok || json.success;
        
        if (ok) {
            recordRpLog(aadvid, 'zalo', 'success', 'Thành công');
            // Reset countdown: đánh dấu đã gửi hôm nay → bộ đếm ngược tự reset về ngyà mai
            const _vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
            const _today = _vnNow.toLocaleDateString('en-CA');
            rpSentToday[aadvid + '_zalo'] = _today;
            chrome.storage.local.set({ strangetts_rp_sent: rpSentToday });
            let dests = [];
            if (sendGroup) dests.push('Nhóm');
            if (sendUser)  dests.push('Cá nhân');
            showToast(`✅ Zalo (${dests.join('+​')}): ${(shops[aadvid]||{}).name}`);
        } else {
            recordRpLog(aadvid, 'zalo', 'error', json.message || json.error || 'Lỗi server');
            showToast(`❌ Zalo: ${json.message || json.error || '?'}`);
        }
    } catch(e) { 
        recordRpLog(aadvid, 'zalo', 'error', e.message);
        showToast(`❌ Server: ${e.message}`);
    }
}

// ===== GỬI TẤT CẢ ZALO NGAY =====
async function rpSendAllZalo() {
    const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops[k]);
    if (!keys.length) { showToast('⚠️ Không có shop để gửi'); return; }
    if (!confirm(`🚀 Bắt đầu gửi báo cáo Zalo cho ${keys.length} shop?`)) return;
    setStatus(`🚀 Đang chuẩn bị gửi ${keys.length} báo cáo Zalo...`);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        setStatus(`🚀 [${i+1}/${keys.length}] Đang gửi Zalo cho ${shops[k].name}...`);
        await rpSendToZalo(k);
        await new Promise(r => setTimeout(r, 1500));
    }
    setStatus('✅ Đã hoàn thành gửi báo cáo tất cả shop.');
    setTimeout(() => setStatus('Sẵn sàng'), 5000);
}

// ===== TEST SERVER =====
async function rpTestZaloServer() {
    const server = document.getElementById('rp-global-zalo-server')?.value.trim() || rpZaloServer || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
    showToast(`⏳ Đang kiểm tra kết nối: ${server}...`);
    try {
        const res = await fetch(`${server}/status`, { method: 'GET' });
        const json = await res.json();
        if (res.ok && (json.ok || json.success || json.status === 'ready')) {
            showToast('✅ Kết nối Server Zalo OK!');
        } else {
            showToast('❌ Server phản hồi nhưng lỗi trạng thái');
        }
    } catch(e) {
        showToast(`❌ Không thể kết nối Server: ${e.message}`);
    }
}

let _batchRunning = false;
// ===== BATCH SEND ALL (per-shop: load → Zalo → Sheet → Tele → next shop) =====
async function rpSendAll() {
    if (_batchRunning) return;
    _batchRunning = true;
    try {
        const allKeys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops[k]);
        if (!allKeys.length) { showToast('⚠️ Không có shop!'); return; }
        if (!confirm(`Gửi báo cáo Zalo cho ${allKeys.length} shop?\n(Sẽ tải mới dữ liệu trước khi gửi)`)) return;
        await _runBatchPerShop(allKeys, { zalo: true, sheet: false, tele: false }, 'Zalo');
    } catch(e) {
        console.error('[Strange TTS RP] rpSendAll error:', e);
        showToast(`❌ Lỗi: ${e.message}`);
    } finally { _batchRunning = false; }
}
async function rpTestServer() {
    const server = document.getElementById('rp-zalo-server').value.trim() || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
    rpConfig.__server__ = server; rpZaloServer = server; saveRpConfig();
    try {
        const json = await fetch(`${server}/status`, { signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined }).then(r => r.json());
        showToast(json.ok ? `✅ Server OK: ${server}` : `⚠️ ${JSON.stringify(json)}`);
    } catch(e) { showToast(`❌ Không kết nối: ${e.message}`); }
}

// ===== GOOGLE SHEETS =====
async function rpPushToSheets(aadvid) {
    const shop = shops[aadvid]; if (!shop) return;
    const cfg  = rpConfig[aadvid] || {};
    // Đảm bảo data mới và đã merge TK phụ (giống rpSendToZalo / rpSendToTelegram)
    const freshOk = await _ensureFreshData(aadvid, false);
    if (!freshOk) { showToast('❌ Bỏ qua Sheets — Lỗi tải dữ liệu'); return; }
    const d    = rpData[aadvid] || {};
    if (d.status !== 'ok') { showToast('⚠️ Chưa có dữ liệu — bấm 🔄 Tải trước!'); return; }
    const shopDisplayName = shop.shopRealName || shop.name || aadvid;

    const sheetsUrlToUse = cfg.sheetsUrl || DEFAULT_SHEETS_URL;
    if (!sheetsUrlToUse || !sheetsUrlToUse.includes('script.google.com/macros')) {
        showToast('❌ Sai URL! Dùng Apps Script Web App URL (script.google.com/macros/s/...)');
        return;
    }
    showToast(`⏳ Gửi dữ liệu shop ${shopDisplayName} lên Sheets...`);

    // Compute yesterday string in VN time
    const vnNow2       = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const ydDate2      = new Date(vnNow2.getTime() - 86400000);
    const yesterdayStr = ydDate2.toLocaleDateString('en-CA'); // 'YYYY-MM-DD'

    // Account info (per-shop, same for all rows)
    const isPostpay2   = d.billingType === 2 || (d.threshold || 0) > 0;
    const accountInfo  = {
        billingType:  isPostpay2 ? 'Trả sau' : 'Trả trước',
        balanceTotal: (d.balance || 0) + (d.credit || 0),
        cash:          d.balance   || 0,
        credit:        d.credit    || 0,
        threshold:     d.threshold || 0,
        thresholdSpent: d.thresholdSpent || 0
    };

    // Build rows — ưu tiên dailyStats, fallback về yesterday/today nếu không có
    const dailyStats  = d.dailyStats || [];
    const ydAdsCost   = d.adsYesterday?.cost || 0;
    const dailyAdsArr = d.dailyAds || [];
    const hasDailyAds = dailyAdsArr.length > 0;
    const dailyAdsMap = {};
    dailyAdsArr.forEach(a => { dailyAdsMap[a.date] = a; });

    let statsToPush = dailyStats.filter(s => s.revenue > 0 || s.orders > 0).map(s => {
        let adsCost = hasDailyAds ? (dailyAdsMap[s.date]?.cost || 0) : (s.date === yesterdayStr ? ydAdsCost : 0);
        const adsPct = s.revenue > 0 ? parseFloat((adsCost / s.revenue * 100).toFixed(2)) : 0;
        const [y, m, dd] = s.date.split('-');
        return { date: `${dd}/${m}/${y}`, revenue: s.revenue, orders: s.orders, adsCost, adsPct, ...accountInfo };
    });

    // Fallback: nếu không có dailyStats thì dùng dữ liệu hôm qua + hôm nay
    if (!statsToPush.length) {
        if (d.yesterday?.revenue > 0 || d.yesterday?.orders > 0) {
            const [y, m, dd] = yesterdayStr.split('-');
            statsToPush.push({ date:`${dd}/${m}/${y}`, revenue:d.yesterday.revenue||0, orders:d.yesterday.orders||0, adsCost:ydAdsCost, adsPct: d.yesterday.revenue>0?parseFloat((ydAdsCost/d.yesterday.revenue*100).toFixed(2)):0, ...accountInfo });
        }
        const vnNow3 = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}));
        const todayStr2 = vnNow3.toLocaleDateString('en-CA');
        if (d.today?.revenue > 0 || d.today?.orders > 0) {
            const [y2,m2,dd2] = todayStr2.split('-');
            statsToPush.push({ date:`${dd2}/${m2}/${y2}`, revenue:d.today.revenue||0, orders:d.today.orders||0, adsCost:d.adsToday?.cost||0, adsPct:0, ...accountInfo });
        }
    }

    if (!statsToPush.length) { showToast('⚠️ Không có dữ liệu để gửi Sheets!'); return; }
    showToast(`⏳ Gửi ${statsToPush.length} dòng lên Sheets...`);

    // Direct fetch với redirect: 'manual' để bắt 302 trước khi browser đổi POST→GET
    try {
        const body = JSON.stringify({ shop: shopDisplayName, rows: statsToPush });
        const headers = { 'Content-Type': 'text/plain' };

        // Bước 1: POST với redirect manual để lấy location URL thực sự
        let res = await fetch(sheetsUrlToUse, { method: 'POST', headers, body, redirect: 'manual' });

        // Nếu Apps Script trả 302 → POST lại đến location đúng
        if (res.type === 'opaqueredirect' || (res.status >= 301 && res.status <= 308)) {
            const loc = res.headers.get('location');
            if (loc) res = await fetch(loc, { method: 'POST', headers, body });
        }

        const json = await res.json().catch(() => ({}));
        const ok = json.ok || (res.status === 200 && json.status === 'success');
        if (ok) {
            recordRpLog(aadvid, 'sheet', 'success', 'Thành công');
            // Reset countdown
            const _vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
            rpSentToday[aadvid + '_sheet'] = _vnNow.toLocaleDateString('en-CA');
            chrome.storage.local.set({ strangetts_rp_sent: rpSentToday });
            showToast(`✅ Sheets OK: ${shopDisplayName} (${statsToPush.length} dòng)`);
        } else {
            recordRpLog(aadvid, 'sheet', 'error', json.error || 'Lỗi Sheets');
            showToast(`❌ Sheets lỗi: ${json.error || res.status}`);
        }
    } catch(e) { 
        recordRpLog(aadvid, 'sheet', 'error', e.message);
        showToast(`❌ Sheets lỗi: ${e.message}`); 
    }
}

async function rpSheetsAll() {
    if (_batchRunning) return;
    _batchRunning = true;
    try {
        const allKeys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops[k]);
        if (!allKeys.length) { showToast('⚠️ Không có shop!'); return; }
        if (!confirm(`Đẩy dữ liệu ${allKeys.length} shop lên Google Sheets?\n(Sẽ tải mới dữ liệu trước khi gửi)`)) return;
        await _runBatchPerShop(allKeys, { zalo: false, sheet: true, tele: false }, 'Sheets');
    } catch(e) {
        console.error('[Strange TTS RP] rpSheetsAll error:', e);
        showToast(`❌ Lỗi: ${e.message}`);
    } finally { _batchRunning = false; }
}

// ===== TELEGRAM =====
async function rpDetectTelegramTopicId(aadvid) {
    const cfg = rpConfig[aadvid] || {};
    const token = (cfg.tgToken || DEFAULT_TG_TOKEN || '').trim();
    const chatId = String(cfg.tgChatId || DEFAULT_TG_CHAT_ID || '').trim();
    if (!token || !chatId) {
        showToast('⚠️ Cần nhập Bot Token và Chat ID trước');
        return;
    }

    showToast('🧭 Đang tìm Topic ID... Hãy gửi /id trong topic rồi bấm lại nếu chưa thấy');

    const updates = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: 'poll_telegram', bot_token: token },
            (json) => resolve(json || { ok: false, error: 'no response' })
        );
    });

    if (!updates || !updates.ok) {
        const err = updates?.description || updates?.error || 'Không đọc được Telegram updates';
        showToast(`❌ ${err}`);
        return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const candidates = (updates.result || [])
        .map(upd => upd.message || upd.edited_message)
        .filter(Boolean)
        .filter(msg => String(msg.chat?.id || '') === chatId)
        .filter(msg => !!msg.message_thread_id)
        .filter(msg => (nowSec - Number(msg.date || 0)) <= 1800)
        .filter(msg => {
            const text = String(msg.text || '').trim();
            return /^\/(?:id|chatid|strangettsid|topicid)(?:@\w+)?(?:\s|$)/i.test(text) || !text.startsWith('/');
        })
        .sort((a, b) => Number(b.date || 0) - Number(a.date || 0));

    const match = candidates[0];
    if (!match) {
        showToast('⚠️ Chưa thấy topic gần đây trong group này. Hãy gửi /id trong đúng topic rồi bấm lại.');
        return;
    }

    if (!rpConfig[aadvid]) rpConfig[aadvid] = {};
    rpConfig[aadvid].tgThreadId = String(match.message_thread_id || '').trim();
    saveRpConfig();

    const card = document.getElementById('rp-card-' + aadvid);
    const input = card?.querySelector('.rp-tg-threadid');
    if (input) input.value = rpConfig[aadvid].tgThreadId;

    const shopName = (shops[aadvid] || {}).shopRealName || (shops[aadvid] || {}).name || aadvid;
    showToast(`✅ ${shopName}: Topic ID = ${rpConfig[aadvid].tgThreadId}`);
}

async function rpSendToTelegram(aadvid) {
    // Đảm bảo data mới và đã merge TK phụ (giống rpSendToZalo)
    const ok = await _ensureFreshData(aadvid, false);
    if (!ok) { showToast('❌ Bỏ qua — Lỗi tải dữ liệu'); return; }
    const cfg = rpConfig[aadvid] || {};
    const token = cfg.tgToken || DEFAULT_TG_TOKEN;
    const msg   = buildReportMessage(aadvid);
    const targets = [];
    if (cfg.tgOn1 !== false && (cfg.tgChatId || DEFAULT_TG_CHAT_ID)) {
        targets.push({
            chatId: cfg.tgChatId || DEFAULT_TG_CHAT_ID,
            threadId: (cfg.tgThreadId || '').trim()
        });
    }
    if (cfg.tgOn2 !== false && cfg.tgChatId2) {
        targets.push({
            chatId: cfg.tgChatId2,
            threadId: ''
        });
    }

    if (!token || !targets.length) { 
        showToast('⚠️ Không có mục tiêu Telegram nào được chọn hoặc thiếu ID!'); 
        return; 
    }

    recordRpLog(aadvid, 'tg', 'idle', `Đang gửi đến ${targets.length} nơi...`);
    
    for (const target of targets) {
        const chatId = target.chatId;
        const threadId = target.threadId;
        await new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    action: 'send_telegram',
                    bot_token: token,
                    chat_id: chatId.trim(),
                    message_thread_id: threadId || undefined,
                    text: msg,
                    parse_mode: 'HTML'
                },
                (json) => {
                    if (chrome.runtime.lastError) {
                        const err = chrome.runtime.lastError.message;
                        recordRpLog(aadvid, 'tg', 'error', `ID: ${maskStr(chatId,2)}${threadId ? ` / Topic ${threadId}` : ''} - ${err}`);
                    } else if (json && json.ok) {
                        recordRpLog(aadvid, 'tg', 'success', `ID: ${maskStr(chatId,2)}${threadId ? ` / Topic ${threadId}` : ''} - OK`);
                    } else {
                        const errMsg = json?.description || json?.error || 'Lỗi gửi';
                        recordRpLog(aadvid, 'tg', 'error', `ID: ${maskStr(chatId,2)}${threadId ? ` / Topic ${threadId}` : ''} - ${errMsg}`);
                    }
                    resolve();
                }
            );
        });
        // Delay 300ms giữa các ID để tránh spam
        await new Promise(r => setTimeout(r, 300));
    }
    
    const _vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    rpSentToday[aadvid + '_tg'] = _vnNow.toLocaleDateString('en-CA');
    chrome.storage.local.set({ strangetts_rp_sent: rpSentToday });
    showToast(`✅ Telegram: ${(shops[aadvid]||{}).shopRealName || (shops[aadvid]||{}).name}`);
}
async function rpTelegramAll() {
    if (_batchRunning) return;
    _batchRunning = true;
    try {
        const allKeys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops[k]);
        if (!allKeys.length) { showToast('⚠️ Không có shop!'); return; }
        if (!confirm(`Gửi Telegram cho ${allKeys.length} shop?\n(Sẽ tải mới dữ liệu trước khi gửi)`)) return;
        await _runBatchPerShop(allKeys, { zalo: false, sheet: false, tele: true }, 'Telegram');
    } catch(e) {
        console.error('[Strange TTS RP] rpTelegramAll error:', e);
        showToast(`❌ Lỗi: ${e.message}`);
    } finally { _batchRunning = false; }
}

// ===== CORE: PER-SHOP BATCH (đúng thứ tự: 1 shop → all channels → next shop) =====
async function _runBatchPerShop(keys, channels, label) {
    const delay = rpBatchDelay > 0 ? rpBatchDelay * 1000 : 1000;
    setStatus(`🚀 Batch ${label}: ${keys.length} shop...`);

    // Set manual batch lock để scheduler không chen ngang
    await new Promise(r => chrome.storage.local.set({
        strangetts_manual_batch_lock: { running: true, startedAt: Date.now(), total: keys.length, label }
    }, r));

    try {
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const shopName = (shops[k]||{}).shopRealName || (shops[k]||{}).name || k;
            setStatus(`⏳ [${i+1}/${keys.length}] Load data: ${shopName}...`);

            // BƯỚC 1: Load data mới (bắt buộc)
            recordRpLog(k, 'zalo', 'idle', '⏳ Đang tải dữ liệu...');
            recordRpLog(k, 'sheet', 'idle', '⏳ Đang tải dữ liệu...');
            recordRpLog(k, 'tg', 'idle', '⏳ Đang tải dữ liệu...');
            const ok = await _ensureFreshData(k, true);

            if (!ok) {
                if (channels.zalo)  recordRpLog(k, 'zalo',  'error', '❌ Lỗi tải data');
                if (channels.sheet) recordRpLog(k, 'sheet', 'error', '❌ Lỗi tải data');
                if (channels.tele)  recordRpLog(k, 'tg',    'error', '❌ Lỗi tải data');
                showToast(`⚠️ Bỏ qua ${shopName} — lỗi tải data`);
            } else {
                setStatus(`⏳ [${i+1}/${keys.length}] Gửi: ${shopName}...`);

                // BƯỚC 2: Gửi từng kênh tuần tự TRONG CÙNG SHOP
                if (channels.zalo) {
                    const cfg = rpConfig[k] || {};
                    const server = rpConfig.__server__ || rpZaloServer || 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
                    if (cfg.groupId || cfg.zaloUserId) {
                        try {
                            const res = await fetch(`${server}/send`, { method:'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify(Object.assign({ message: buildReportMessage(k) }, cfg.groupId ? {group_id:cfg.groupId} : {}, cfg.zaloUserId ? {user_id:cfg.zaloUserId} : {})) });
                            const json = await res.json();
                            if (json.ok || json.success) {
                                recordRpLog(k, 'zalo', 'success', '✅ Thành công');
                                rpSentToday[k+'_zalo'] = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'})).toLocaleDateString('en-CA');
                                chrome.storage.local.set({ strangetts_rp_sent: rpSentToday });
                            } else { recordRpLog(k, 'zalo', 'error', json.error||'Server error'); }
                        } catch(e) { recordRpLog(k, 'zalo', 'error', e.message); }
                    } else { recordRpLog(k, 'zalo', 'idle', '— Không có Group/User ID'); }
                }

                if (channels.sheet) await rpPushToSheets(k);

                if (channels.tele) {
                    await rpSendToTelegram(k);
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            if (i < keys.length - 1 && delay > 0)
                await new Promise(r => setTimeout(r, delay));
        }
        setStatus(`✅ Hoàn tất ${label}!`);
        setTimeout(() => setStatus('Sẵn sàng'), 5000);
    } finally {
        // LUÔN clear lock kể cả khi lỗi giữa chừng
        chrome.storage.local.remove('strangetts_manual_batch_lock');
    }
}

async function rpAutoTelegramRun(aadvid) {
    const cfg = rpConfig[aadvid] || {};
    const tokenToUse  = cfg.tgToken || DEFAULT_TG_TOKEN;
    const chatIdToUse = cfg.tgChatId || DEFAULT_TG_CHAT_ID;
    if (!tokenToUse || !chatIdToUse) {
        recordRpLog(aadvid, 'tg', 'error', 'Thiếu Token/ChatID');
        return;
    }
    showToast(`⏰ Auto Telegram: ${(shops[aadvid]||{}).name || aadvid}...`);
    recordRpLog(aadvid, 'tg', 'idle', 'Đang load dữ liệu mới...');
    await _ensureFreshData(aadvid, true);
    if (rpData[aadvid].status !== 'ok') {
        recordRpLog(aadvid, 'tg', 'error', 'Lỗi tải dữ liệu');
        return;
    }
    await rpSendToTelegram(aadvid);
}

// ===== BOOTSTRAP =====
document.addEventListener('DOMContentLoaded', () => { setTimeout(initReportTab, 250); });

// Reload logs từ storage (để nhận cập nhật từ background alarm)
function rpPollBackgroundLogs() {
    chrome.storage.local.get('strangetts_rp_logs', d => {
        const newLogs = d.strangetts_rp_logs || {};
        let changed = false;
        Object.keys(newLogs).forEach(av => {
            const old = rpLogs[av] || {};
            const neo = newLogs[av] || {};
            ['zalo','sheet','tg'].forEach(ch => {
                if (neo[ch] && JSON.stringify(neo[ch]) !== JSON.stringify(old[ch])) changed = true;
            });
        });
        if (changed) {
            rpLogs = newLogs;
            // Refresh tất cả cards để hiển thị log mới nhất từ background
            const keys = (typeof shopOrder !== 'undefined' ? shopOrder : []).filter(k => shops && shops[k]);
            keys.forEach(k => refreshRpCard(k));
        }
    });
}
// Poll mỗi 15 giây để cập nhật log từ background khi popup đang mở
setInterval(rpPollBackgroundLogs, 15000);

// ═══════════════════════════════════════════════════
// TÌM KIẾM SHOP TRONG TAB REPORT
// ═══════════════════════════════════════════════════
function rpFilterShops(query) {
    const q = (query || '').trim().toLowerCase();
    const cards = document.querySelectorAll('#rp-shop-list .shop-card');
    let visible = 0;
    cards.forEach(card => {
        const name = (card.dataset.shopName || card.querySelector('.rp-shop-name')?.textContent || '').toLowerCase();
        const match = !q || name.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
    });
    const countEl = document.getElementById('rp-search-count');
    if (countEl) {
        countEl.textContent = q ? `${visible}/${cards.length} shop` : `${cards.length} shop`;
        countEl.style.color = (q && visible === 0) ? '#f87171' : '#64748b';
    }
}
