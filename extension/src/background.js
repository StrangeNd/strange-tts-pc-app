const STRANGETTS_DEFAULT_SYNC_URL = 'https://cartridges-warranty-management-incentive.trycloudflare.com';
const STRANGETTS_ADS_PAYMENT_URL = 'https://ads.tiktok.com/i18n/account/payment';
const STRANGETTS_ADS_WARMUP_SESSION_KEY = 'strangetts_ads_cookie_warmup_opened_this_profile_v1';
const STRANGETTS_TIKTOK_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const STRANGETTS_TIKTOK_FETCH_UA_RULE_ID = 420001;
const STRANGETTS_TIKTOK_POPUP_UA_RULE_ID = 420002;
let bgAdsWarmupProfileFallback = false;
let bgAdsWarmupInFlight = null;
const bgTikTokProductInFlight = new Map();
const bgTikTokProductMissUntil = new Map();
const bgTikTokProductCache = new Map();
let bgTikTokFetchUaReady = false;

try {
    importScripts('../vendor/strangetts_video/assets/index.ts-CgfWn4EP.js');
    console.log('[Strange TTS BG] Video tools loaded');
} catch (e) {
    console.warn('[Strange TTS BG] Video tools failed to load:', e?.message || e);
}

function bgFirstText(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
}

function bgCanonicalShopId(shop = {}) {
    const aadvid = bgFirstText(shop.aadvid);
    const canonical = bgFirstText(shop.canonical_shop_id);
    if (canonical && canonical !== aadvid) return canonical;
    return bgFirstText(shop.oec_seller_id, shop.seller_id, shop.shop_id, shop.id, aadvid);
}

function bgNormalizeAdsAccounts(accounts = [], primaryAadvid = '') {
    const map = new Map();
    const push = (acc, fallbackLabel = '') => {
        if (!acc) return;
        const aadvid = bgFirstText(acc.aadvid, acc.id, acc.advertiser_id, acc.adv_id);
        if (!aadvid) return;
        const existing = map.get(aadvid) || {};
        map.set(aadvid, {
            ...existing,
            ...acc,
            aadvid,
            label: bgFirstText(acc.label, acc.name, acc.advertiser_name, fallbackLabel, aadvid),
            name: bgFirstText(acc.name, acc.label, acc.advertiser_name, fallbackLabel, aadvid),
            enabled: acc.enabled !== false,
            isMain: aadvid === primaryAadvid
        });
    };
    (accounts || []).forEach(acc => push(acc));
    if (primaryAadvid) {
        if (map.has(primaryAadvid)) {
            map.set(primaryAadvid, { ...map.get(primaryAadvid), isMain: true });
        } else {
            push({ aadvid: primaryAadvid, enabled: true, isMain: true }, 'TK chính');
        }
    }
    return Array.from(map.values()).sort((a, b) => {
        if (a.aadvid === primaryAadvid) return -1;
        if (b.aadvid === primaryAadvid) return 1;
        return String(a.label || a.aadvid).localeCompare(String(b.label || b.aadvid));
    });
}

function bgMergeAdsAccountsPreservingSelection(shop = {}, incomingAccounts = [], primaryAadvid = '') {
    const mainAadvid = bgFirstText(primaryAadvid, shop.aadvid);
    const existingAccounts = bgNormalizeAdsAccounts(shop.ads_accounts || [], mainAadvid);
    const incomingNormalized = bgNormalizeAdsAccounts(incomingAccounts || [], mainAadvid);
    const enabledById = new Map(existingAccounts.map(acc => [acc.aadvid, acc.enabled !== false]));
    const mergedById = new Map();

    incomingNormalized.forEach(acc => mergedById.set(acc.aadvid, acc));
    existingAccounts.forEach(acc => {
        const incoming = mergedById.get(acc.aadvid);
        mergedById.set(acc.aadvid, incoming ? { ...acc, ...incoming } : acc);
    });

    return bgNormalizeAdsAccounts(Array.from(mergedById.values()).map(acc => ({
        ...acc,
        enabled: enabledById.has(acc.aadvid) ? enabledById.get(acc.aadvid) : acc.enabled !== false,
        isMain: acc.aadvid === mainAadvid
    })), mainAadvid);
}

async function bgGetCsrfTokenForUrl(url) {
    const names = ['csrf_session_id', 'csrftoken', 'tt_csrf_token'];
    try {
        const cookies = await bgCookiesGetAllSafe({ url }, 1000);
        const found = cookies.find(c => names.includes(c.name) && c.value);
        if (found) return found.value;
    } catch (e) { }
    return bgGetTikTokCsrfToken();
}

async function bgGetCookieValueForUrl(url, name) {
    try {
        const cookies = await bgCookiesGetAllSafe({ url }, 1000);
        const found = cookies.find(c => c.name === name && c.value);
        return found ? found.value : '';
    } catch (e) {
        return '';
    }
}

async function bgGetTikTokCsrfToken() {
    const names = ['csrf_session_id', 'csrftoken', 'tt_csrf_token'];
    const domains = ['https://seller-vn.tiktok.com', 'https://ads.tiktok.com'];
    for (const url of domains) {
        try {
            const cookies = await chrome.cookies.getAll({ url });
            const found = cookies.find(c => names.includes(c.name) && c.value);
            if (found) return found.value;
        } catch (e) { }
    }
    return '';
}

async function bgFetchJsonSafe(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn('[Strange TTS BG] metadata fetch failed:', url, e.message);
        return null;
    }
}

function bgWithTimeout(promise, ms, fallbackValue) {
    let timer = null;
    const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve(fallbackValue), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function bgDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function bgBuildAdsPaymentUrl(aadvid = '') {
    const id = String(aadvid || '').trim();
    return id ? `${STRANGETTS_ADS_PAYMENT_URL}?aadvid=${encodeURIComponent(id)}` : STRANGETTS_ADS_PAYMENT_URL;
}

async function bgFetchTikwmNoLogo(tiktokUrl) {
    if (!tiktokUrl) throw new Error('missing TikTok url');
    const body = new URLSearchParams({ url: tiktokUrl, hd: '1' });
    const res = await fetch('https://tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });
    if (!res.ok) throw new Error('tikwm HTTP ' + res.status);
    const json = await res.json();
    if (!json || json.code !== 0) throw new Error(json?.msg || 'tikwm API error');
    return json.data || {};
}

function bgNormalizeTikTokVideoUrl(rawUrl, opts = {}) {
    const value = String(rawUrl || '').trim();
    if (!value) throw new Error('missing TikTok url');
    const url = new URL(value);
    const videoId = (url.pathname.match(/\/video\/(\d+)/) || url.pathname.match(/\/v\/(\d+)/) || [])[1] || '';
    if (!videoId) return url.href;
    const author = (url.pathname.match(/^\/@[^/]+/) || [''])[0];
    const next = new URL(`https://www.tiktok.com${author || ''}/video/${videoId}`);
    ['shop_id', 'shop_region', 'region', 'lang'].forEach(key => {
        const v = url.searchParams.get(key);
        if (v) next.searchParams.set(key, v);
    });
    if (opts.probeHash) next.hash = 'strangetts_product_probe=1';
    return next.href;
}

async function bgSetTikTokMobileUaForTab(tabId) {
    if (!tabId || !chrome.declarativeNetRequest?.updateSessionRules) return 0;
    const ruleId = STRANGETTS_TIKTOK_POPUP_UA_RULE_ID;
    const rule = {
        id: ruleId,
        priority: 2,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [
                { header: 'User-Agent', operation: 'set', value: STRANGETTS_TIKTOK_MOBILE_UA }
            ]
        },
        condition: {
            tabIds: [tabId],
            urlFilter: '||tiktok.com/',
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'media', 'other']
        }
    };
    return new Promise(resolve => {
        try {
            chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [ruleId],
                addRules: [rule]
            }, () => {
                const err = chrome.runtime.lastError;
                if (err) {
                    console.warn('[Strange TTS BG] mobile UA rule failed:', err.message);
                    resolve(0);
                } else {
                    resolve(ruleId);
                }
            });
        } catch (e) {
            console.warn('[Strange TTS BG] mobile UA rule exception:', e.message);
            resolve(0);
        }
    });
}

function bgRemoveDnrRuleSafe(ruleId) {
    if (!ruleId || !chrome.declarativeNetRequest?.updateSessionRules) return;
    try {
        chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] }, () => void chrome.runtime.lastError);
    } catch (e) { }
}

function bgCleanupStaleTikTokProbeTabs() {
    try {
        chrome.tabs.query({}, tabs => {
            for (const tab of tabs || []) {
                if (tab.id && /(?:[?&]|#)strangetts_product_probe=1(?:&|$)/.test(tab.url || '')) {
                    try { chrome.tabs.remove(tab.id); } catch (e) { }
                }
            }
        });
    } catch (e) { }
}

async function bgEnsureTikTokFetchMobileUa() {
    if (bgTikTokFetchUaReady || !chrome.declarativeNetRequest?.updateSessionRules) return;
    const rule = {
        id: STRANGETTS_TIKTOK_FETCH_UA_RULE_ID,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [
                { header: 'User-Agent', operation: 'set', value: STRANGETTS_TIKTOK_MOBILE_UA }
            ]
        },
        condition: {
            tabIds: [-1],
            urlFilter: '||tiktok.com/',
            resourceTypes: ['xmlhttprequest', 'main_frame', 'sub_frame', 'other']
        }
    };
    await new Promise(resolve => {
        try {
            chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [STRANGETTS_TIKTOK_FETCH_UA_RULE_ID],
                addRules: [rule]
            }, () => {
                const err = chrome.runtime.lastError;
                if (err) console.warn('[Strange TTS BG] fetch mobile UA rule failed:', err.message);
                else bgTikTokFetchUaReady = true;
                resolve();
            });
        } catch (e) {
            console.warn('[Strange TTS BG] fetch mobile UA rule exception:', e.message);
            resolve();
        }
    });
}

async function bgWaitForTabComplete(tabId, timeoutMs = 6500) {
    await new Promise(resolve => {
        let done = false;
        let timer = null;
        const finish = () => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            try { chrome.tabs.onUpdated.removeListener(listener); } catch (e) { }
            resolve(true);
        };
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
        };
        try {
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.get(tabId, tab => {
                if (chrome.runtime.lastError || tab?.status === 'complete') finish();
            });
        } catch (e) {
            finish();
        }
        timer = setTimeout(finish, timeoutMs);
    });
    await bgDelay(500);
}

function bgWakeLiveTabs(reason = 'alarm') {
    try {
        chrome.tabs.query({ url: ['https://seller-vn.tiktok.com/*', 'https://shop.tiktok.com/*'] }, tabs => {
            for (const tab of tabs || []) {
                if (!tab.id) continue;
                chrome.tabs.sendMessage(tab.id, {
                    action: 'STRANGETTS_LIVE_WAKE_CHECK',
                    reason,
                    ts: Date.now()
                }, () => void chrome.runtime.lastError);
            }
        });
    } catch (e) {
        console.warn('[Strange TTS BG] live wake ping failed:', e.message);
    }
}

chrome.alarms.create('strangetts_live_wake_check', { periodInMinutes: 1 });
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('strangetts_live_wake_check', { periodInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('strangetts_live_wake_check', { periodInMinutes: 1 }));
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'strangetts_live_wake_check') bgWakeLiveTabs('background alarm');
});

function bgExtractTikTokProductInPage(timeoutMs = 4200) {
    const started = Date.now();
    const PRODUCT_FIELDS = [
        'commerceProductInfo',
        'commerce_product_info',
        'commerce_info',
        'commerceInfo',
        'tcm_anchor',
        'tcmAnchor',
        'videoEcomShoppingTagList',
        'video_ecom_shopping_tag_list',
        'ecomShoppingTagList',
        'ec_anchor_info',
        'ecAnchorInfo',
        'ecAnchor',
        'product_anchor',
        'productAnchor',
        'shop_info',
        'shopInfo',
        'productInfo',
        'product_info',
        'vmpAnchor',
        'vmp_anchor',
        'additionalAnchors',
        'additional_anchors',
        'eh_anchor',
        'ehAnchor'
    ];

    function badTitle(value) {
        return /(?:^|\s)(âm thanh gốc|am thanh goc|original sound|nhạc nền|nhac nen|music|sound)(?:\s|$|-)/i.test(String(value || ''));
    }

    function productLike(value) {
        return /\/shop\/|\/pdp\/|product_id|product%5Fid|tcm|ecommerce|ec_/i.test(String(value || ''));
    }

    function imageFrom(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value[0] || '';
        return (value.urlList && value.urlList[0]) || (value.url_list && value.url_list[0]) || value.url || '';
    }

    function slugify(value) {
        return String(value || 'tiktok-shop-product')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 90) || 'tiktok-shop-product';
    }

    function productIdFromSchema(schema) {
        if (typeof schema !== 'string') return '';
        const decoded = decodeNested(schema);
        const m = decoded.match(/product_id%22%3A%5B%22(\d+)%22/) ||
            decoded.match(/product_id["']?\s*[:=]\s*["']?(\d+)/) ||
            decoded.match(/product_id%3D(\d+)/) ||
            decoded.match(/[?&]product_id=(\d+)/) ||
            decoded.match(/\/pdp\/[^/?#]+\/(\d+)/);
        return m ? m[1] : '';
    }

    function decodeNested(value) {
        let text = String(value || '').replace(/\\\//g, '/');
        for (let i = 0; i < 3; i++) {
            try {
                const decoded = decodeURIComponent(text);
                if (decoded === text) break;
                text = decoded;
            } catch (e) {
                break;
            }
        }
        return text;
    }

    function directPdpUrl(value) {
        const decoded = decodeNested(value);
        const direct = decoded.match(/https:\/\/www\.tiktok\.com\/shop\/[^"' <>()]+\/pdp\/[^"' <>()]+\/\d+[^"' <>()]*/i) ||
            decoded.match(/\/shop\/[^"' <>()]+\/pdp\/[^"' <>()]+\/\d+[^"' <>()]*/i);
        if (direct) return new URL(direct[0], location.origin).href;
        try {
            const query = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
            const params = new URLSearchParams(query);
            for (const key of ['url', 'target_url', 'redirect_url', 'fallback_url', 'landing_url']) {
                const nested = params.get(key);
                const found = nested && directPdpUrl(nested);
                if (found) return found;
            }
        } catch (e) { }
        return '';
    }

    function chainKeyFromSchema(schema) {
        if (typeof schema !== 'string') return '';
        try {
            const query = schema.includes('?') ? schema.slice(schema.indexOf('?') + 1) : schema;
            const params = new URLSearchParams(query);
            const raw = params.get('visitReportParams');
            if (!raw) return '';
            const parsed = JSON.parse(raw);
            return typeof parsed.chain_key === 'string' ? parsed.chain_key : '';
        } catch (e) {
            return '';
        }
    }

    function buildProductUrl(rawUrl, id, title, schema) {
        const direct = typeof rawUrl === 'string' ? rawUrl : '';
        const pdp = directPdpUrl(direct) || directPdpUrl(schema);
        if (pdp) return pdp;
        if (/^https:\/\/www\.tiktok\.com\/shop\/[^/]+\/pdp\//i.test(direct)) return direct;
        if (/^\/shop\/[^/]+\/pdp\//i.test(direct)) return new URL(direct, location.origin).href;
        if (/^https?:\/\/[^/]+\/shop\/[^/]+\/pdp\//i.test(direct)) return direct;
        const productId = productIdFromSchema(schema) || productIdFromSchema(direct) || (String(id || '').match(/\d{8,}/) || [''])[0];
        if (!productId) return direct && /^https?:\/\//i.test(direct) ? direct : '';
        const chainKey = chainKeyFromSchema(schema || direct);
        return `https://www.tiktok.com/shop/vn/pdp/${slugify(title)}/${productId}${chainKey ? `?chain_key=${encodeURIComponent(chainKey)}` : ''}`;
    }

    function parseJson(value) {
        if (!value) return null;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (e) { return null; }
    }

    function normalizeProduct(product, via) {
        if (!product || typeof product !== 'object') return null;
        const title = product.title || product.product_name || product.productName || product.name || product.elastic_title || '';
        if (!title || badTitle(title)) return null;
        const rawUrl = product.url || product.product_link || product.productLink || product.detail_url || product.detailUrl || product.actionUrl || product.action_url || product.schema || '';
        const id = product.product_id || product.productId || product.id || product.spu_id || '';
        const url = buildProductUrl(rawUrl, id, title, product.schema || rawUrl);
        if (!url || !productLike(url)) return null;
        const price = product.price_str || product.format_price || product.formatPrice || product.price || '';
        const imageUrl = imageFrom(product.imageUrl || product.image_url || product.cover || product.image || product.icon || product.thumbnail);
        const shopName = product.shop_name || product.shopName || product.seller_name || product.sellerName || 'TikTok Shop';
        return {
            id: id ? String(id) : productIdFromSchema(url),
            title: String(title).replace(/\s+/g, ' ').trim().slice(0, 180),
            price: price ? String(price) : '',
            imageUrl: imageUrl ? String(imageUrl) : '',
            shopName: shopName ? String(shopName) : '',
            url,
            via
        };
    }

    function productFromPlainObject(obj, via, depth = 0, seen = new WeakSet()) {
        if (!obj || typeof obj !== 'object' || depth > 6) return null;
        if (seen.has(obj)) return null;
        seen.add(obj);
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = productFromPlainObject(item, via, depth + 1, seen);
                if (found) return found;
            }
            return null;
        }
        const product = obj.product && typeof obj.product === 'object' ? obj.product : {};
        const merged = Object.assign({}, product, obj, {
            title: obj.product_name || obj.productName || obj.title || obj.name || obj.elastic_title || product.title || product.product_name,
            price: obj.price_str || obj.format_price || obj.formatPrice || obj.price || product.price_str || product.format_price || product.price,
            imageUrl: imageFrom(obj.cover) || imageFrom(product.cover) || obj.cover_url || obj.coverUrl || obj.image_url || obj.imageUrl || obj.image || product.cover_url || product.image,
            url: obj.product_link || obj.productLink || obj.detail_url || obj.detailUrl || obj.actionUrl || obj.action_url || obj.schema || product.detail_url || product.product_link,
            product_id: obj.product_id || obj.productId || product.product_id || product.id || product.spu_id || obj.id,
            shopName: obj.shop_name || obj.shopName || obj.seller_name || obj.sellerName || product.shop_name || product.seller_name
        });
        const direct = normalizeProduct(merged, via);
        if (direct) return direct;
        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
                const found = productFromPlainObject(obj[key], via, depth + 1, seen);
                if (found) return found;
            }
        }
        return null;
    }

    function itemStructFromData(data) {
        const scope = data && data.__DEFAULT_SCOPE__;
        const candidates = [
            scope && scope['webapp.video-detail'] && scope['webapp.video-detail'].itemInfo && scope['webapp.video-detail'].itemInfo.itemStruct,
            scope && scope['webapp.reflow.video.detail'] && scope['webapp.reflow.video.detail'].itemStruct,
            scope && scope['webapp.reflow.video.detail'] && scope['webapp.reflow.video.detail'].itemInfo && scope['webapp.reflow.video.detail'].itemInfo.itemStruct,
            data && data.itemInfo && data.itemInfo.itemStruct
        ].filter(Boolean);
        if (data && data.ItemModule) candidates.push(...Object.values(data.ItemModule));
        return candidates;
    }

    function productFromAnchors(anchors, via) {
        if (!Array.isArray(anchors)) return null;
        for (const anchor of anchors) {
            if (!anchor || typeof anchor !== 'object') continue;
            const extra = parseJson(anchor.extra || anchor.extra_info || anchor.extraInfo) || {};
            const logExtra = parseJson(anchor.logExtra || anchor.log_extra) || {};
            const productLikePayload = extra.product_id || extra.product_name || extra.price_str || extra.price ||
                extra.shop_id || extra.seller_id || logExtra.product_id || logExtra.product_name;
            const type = String(anchor.type || anchor.anchorType || '');
            if (anchor.type === 35 || anchor.id === 35 || anchor.type === 47 || anchor.type === 50) continue;
            if (!['1', '2', '3', '4', '33', '106'].includes(type) && !productLikePayload) continue;
            const merged = Object.assign({}, logExtra, extra, {
                title: anchor.keyword || anchor.description || anchor.name || extra.title || extra.product_name,
                url: anchor.actionUrl || anchor.action_url || anchor.schema || extra.product_link || extra.detail_url,
                schema: anchor.schema || extra.schema,
                imageUrl: imageFrom(anchor.icon || anchor.thumbnail),
                product_id: extra.product_id || logExtra.product_id || anchor.product_id || anchor.id
            });
            const found = productFromPlainObject(merged, `${via}:anchor:${type}`);
            if (found) return found;
        }
        return null;
    }

    function productFromScripts() {
        const scripts = document.querySelectorAll('script[id*="UNIVERSAL_DATA"], script[id="__UNIVERSAL_DATA_FOR_REHYDRATION__"], script[id="SIGI_STATE"], script[id="__SIGI_STATE__"], script[type="application/json"]');
        for (const script of scripts) {
            const text = script.textContent || '';
            if (!text || text.length > 3500000) continue;
            if (!/anchor|commerce|product|shop|seller|pdp|tcm/i.test(text)) continue;
            let data;
            try { data = JSON.parse(text); } catch (e) { continue; }
            for (const item of itemStructFromData(data)) {
                const anchorProduct = productFromAnchors(item.anchors || item.descTextExtra, 'script');
                if (anchorProduct) return anchorProduct;
                for (const field of PRODUCT_FIELDS) {
                    const found = productFromPlainObject(item[field], `script:${field}`);
                    if (found) return found;
                }
                const commerce = item.commerce_info || item.commerceInfo;
                const commerceProduct = productFromPlainObject(commerce, 'script:commerceInfo');
                if (commerceProduct) return commerceProduct;
                const itemProduct = productFromPlainObject(item, 'script:item');
                if (itemProduct) return itemProduct;
            }
            const recursive = productFromPlainObject(data, 'script:recursive');
            if (recursive) return recursive;
        }
        return null;
    }

    function productFromDom() {
        const selectors = [
            'a[href*="/shop/"][href*="/pdp/"]',
            'a[href*="tiktok.com/shop"][href*="/pdp/"]',
            'a[href*="/product/"]',
            'a[href*="tcm"]',
            '[class*="DivProductAnchor"]',
            '[class*="EcomNameMobile"]',
            '[class*="DivEcomAnchorMobile"]',
            '[class*="EcomAnchor"]',
            '[data-e2e="product-anchor"]',
            '[data-e2e="anchor-product-link"]',
            '[data-e2e="anchor-name"]',
            '[data-e2e="video-product"]',
            '[class*="ProductAnchor"]',
            '[class*="ShoppingAnchor"]',
            '[class*="anchor-container"]',
            '[class*="DivAnchorView"]'
        ];
        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                const linkNode = el.tagName === 'A' ? el : el.querySelector('a[href*="/shop/"], a[href*="/pdp/"], a[href*="/product/"], a[href*="tcm"]');
                const link = linkNode && (linkNode.href || linkNode.getAttribute('href'));
                let title = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                const img = el.querySelector && el.querySelector('img');
                if (!title && img) title = img.getAttribute('alt') || '';
                if (!title || /^Shop$|^TikTok Shop$/i.test(title)) title = 'Xem sản phẩm TikTok Shop';
                const url = link ? new URL(link, location.href).href : '';
                const product = normalizeProduct({
                    title,
                    url,
                    imageUrl: img ? img.src : '',
                    product_id: productIdFromSchema(url)
                }, `dom:${sel}`);
                if (product) return product;
            }
        }
        const bodyText = (document.body && document.body.innerText) || '';
        const textMatch = bodyText.match(/Shop\s*[|｜]\s*([^\n|｜]{3,200})/i);
        if (textMatch) {
            const link = document.querySelector('a[href*="/shop/"][href*="/pdp/"], a[href*="/pdp/"], a[href*="tcm"]');
            const product = normalizeProduct({
                title: textMatch[1].trim(),
                url: link && link.href,
                product_id: link && productIdFromSchema(link.href)
            }, 'dom:text');
            if (product) return product;
        }
        return null;
    }

    function attempt() {
        return productFromScripts() || productFromDom();
    }

    return new Promise(resolve => {
        const tick = () => {
            const product = attempt();
            if (product) {
                resolve({ product, href: location.href });
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                resolve({ product: null, href: location.href });
                return;
            }
            setTimeout(tick, 250);
        };
        tick();
    });
}

function bgExtractTikTokProductFromUniversalData(data) {
    function badTitle(value) {
        return /(?:^|\s)(âm thanh gốc|am thanh goc|original sound|nhạc nền|nhac nen|music|sound)(?:\s|$|-)/i.test(String(value || ''));
    }
    function productLike(value) {
        return /\/shop\/|\/pdp\/|product_id|product%5Fid|tcm|ecommerce|ec_/i.test(String(value || ''));
    }
    function imageFrom(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value[0] || '';
        return (value.urlList && value.urlList[0]) || (value.url_list && value.url_list[0]) || value.url || '';
    }
    function slugify(value) {
        return String(value || 'tiktok-shop-product')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 90) || 'tiktok-shop-product';
    }
    function productIdFromSchema(schema) {
        if (typeof schema !== 'string') return '';
        const decoded = decodeNested(schema);
        const m = decoded.match(/product_id%22%3A%5B%22(\d+)%22/) ||
            decoded.match(/product_id["']?\s*[:=]\s*["']?(\d+)/) ||
            decoded.match(/product_id%3D(\d+)/) ||
            decoded.match(/[?&]product_id=(\d+)/) ||
            decoded.match(/\/pdp\/[^/?#]+\/(\d+)/);
        return m ? m[1] : '';
    }

    function decodeNested(value) {
        let text = String(value || '').replace(/\\\//g, '/');
        for (let i = 0; i < 3; i++) {
            try {
                const decoded = decodeURIComponent(text);
                if (decoded === text) break;
                text = decoded;
            } catch (e) {
                break;
            }
        }
        return text;
    }

    function directPdpUrl(value) {
        const decoded = decodeNested(value);
        const direct = decoded.match(/https:\/\/www\.tiktok\.com\/shop\/[^"' <>()]+\/pdp\/[^"' <>()]+\/\d+[^"' <>()]*/i) ||
            decoded.match(/\/shop\/[^"' <>()]+\/pdp\/[^"' <>()]+\/\d+[^"' <>()]*/i);
        if (direct) return new URL(direct[0], 'https://www.tiktok.com').href;
        try {
            const query = decoded.includes('?') ? decoded.slice(decoded.indexOf('?') + 1) : decoded;
            const params = new URLSearchParams(query);
            for (const key of ['url', 'target_url', 'redirect_url', 'fallback_url', 'landing_url']) {
                const nested = params.get(key);
                const found = nested && directPdpUrl(nested);
                if (found) return found;
            }
        } catch (e) { }
        return '';
    }
    function chainKeyFromSchema(schema) {
        if (typeof schema !== 'string') return '';
        try {
            const query = schema.includes('?') ? schema.slice(schema.indexOf('?') + 1) : schema;
            const params = new URLSearchParams(query);
            const raw = params.get('visitReportParams');
            if (!raw) return '';
            const parsed = JSON.parse(raw);
            return typeof parsed.chain_key === 'string' ? parsed.chain_key : '';
        } catch (e) {
            return '';
        }
    }
    function buildProductUrl(rawUrl, id, title, schema) {
        const direct = typeof rawUrl === 'string' ? rawUrl : '';
        const pdp = directPdpUrl(direct) || directPdpUrl(schema);
        if (pdp) return pdp;
        if (/^https:\/\/www\.tiktok\.com\/shop\/[^/]+\/pdp\//i.test(direct)) return direct;
        if (/^\/shop\/[^/]+\/pdp\//i.test(direct)) return new URL(direct, 'https://www.tiktok.com').href;
        if (/^https?:\/\/[^/]+\/shop\/[^/]+\/pdp\//i.test(direct)) return direct;
        const productId = productIdFromSchema(schema) || productIdFromSchema(direct) || (String(id || '').match(/\d{8,}/) || [''])[0];
        if (!productId) return direct && /^https?:\/\//i.test(direct) ? direct : '';
        const chainKey = chainKeyFromSchema(schema || direct);
        return `https://www.tiktok.com/shop/vn/pdp/${slugify(title)}/${productId}${chainKey ? `?chain_key=${encodeURIComponent(chainKey)}` : ''}`;
    }
    function parseJson(value) {
        if (!value) return null;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (e) { return null; }
    }
    function normalizeProduct(product, via) {
        if (!product || typeof product !== 'object') return null;
        const title = product.title || product.product_name || product.productName || product.name || product.elastic_title || '';
        if (!title || badTitle(title)) return null;
        const rawUrl = product.url || product.product_link || product.productLink || product.detail_url || product.detailUrl || product.actionUrl || product.action_url || product.schema || '';
        const id = product.product_id || product.productId || product.id || product.spu_id || '';
        const url = buildProductUrl(rawUrl, id, title, product.schema || rawUrl);
        if (!url || !productLike(url)) return null;
        const price = product.price_str || product.format_price || product.formatPrice || product.price || '';
        const imageUrl = imageFrom(product.imageUrl || product.image_url || product.cover || product.image || product.icon || product.thumbnail);
        const shopName = product.shop_name || product.shopName || product.seller_name || product.sellerName || 'TikTok Shop';
        return {
            id: id ? String(id) : productIdFromSchema(url),
            title: String(title).replace(/\s+/g, ' ').trim().slice(0, 180),
            price: price ? String(price) : '',
            imageUrl: imageUrl ? String(imageUrl) : '',
            shopName: shopName ? String(shopName) : '',
            url,
            via
        };
    }
    function fromAnchors(anchors) {
        if (!Array.isArray(anchors)) return null;
        for (const anchor of anchors) {
            if (!anchor || typeof anchor !== 'object') continue;
            if (anchor.type === 35 || anchor.id === 35 || anchor.type === 47 || anchor.type === 50) continue;
            const extra = parseJson(anchor.extra || anchor.extra_info || anchor.extraInfo) || {};
            const logExtra = parseJson(anchor.logExtra || anchor.log_extra) || {};
            const type = String(anchor.type || anchor.id || '');
            const productLikePayload = extra.product_id || extra.product_name || extra.price_str || extra.price ||
                extra.shop_id || extra.seller_id || logExtra.product_id || logExtra.product_name;
            if (!['1', '2', '3', '4', '33', '106'].includes(type) && !productLikePayload) continue;
            const product = normalizeProduct(Object.assign({}, logExtra, extra, {
                title: anchor.keyword || anchor.description || anchor.name || extra.product_name || logExtra.product_name,
                url: anchor.actionUrl || anchor.action_url || anchor.schema || extra.product_link || extra.detail_url,
                schema: anchor.schema || extra.schema,
                imageUrl: imageFrom(anchor.icon || anchor.thumbnail),
                product_id: extra.product_id || logExtra.product_id || anchor.product_id || anchor.id
            }), `anchor_type_${anchor.type || anchor.id || ''}`);
            if (product) return product;
        }
        return null;
    }
    function fromItemStruct(item) {
        if (!item || typeof item !== 'object') return null;
        const commerce = item.commerceProductInfo || item.commerce_product_info;
        if (commerce) {
            const products = commerce.products || commerce.product_list || (commerce.title ? [commerce] : []);
            const first = Array.isArray(products) ? products[0] : null;
            const product = normalizeProduct(first, 'commerceProductInfo');
            if (product) return product;
        }
        const anchorProduct = fromAnchors(item.anchors || item.descTextExtra);
        if (anchorProduct) return anchorProduct;
        const commerceProduct = normalizeProduct(item.commerce_info || item.commerceInfo, 'commerceInfo');
        if (commerceProduct) return commerceProduct;
        const json = JSON.stringify(item);
        const titleMatch = json.match(/"product_name"\s*:\s*"([^"]{3,200})"/) || json.match(/"title"\s*:\s*"([^"]{3,200})"[^}]*"price/);
        if (titleMatch) {
            const idMatch = json.match(/"product_id"\s*:\s*"?(\d{6,})"?/);
            const priceMatch = json.match(/"format_price"\s*:\s*"([^"]+)"/) || json.match(/"price_str"\s*:\s*"([^"]+)"/);
            const coverMatch = json.match(/"cover_url"\s*:\s*"([^"]+)"/);
            return normalizeProduct({
                title: titleMatch[1],
                product_id: idMatch && idMatch[1],
                price: priceMatch && priceMatch[1],
                imageUrl: coverMatch && coverMatch[1]
            }, 'regex_scan');
        }
        return null;
    }
    const scope = data && data.__DEFAULT_SCOPE__;
    const candidates = [
        scope && scope['webapp.video-detail'] && scope['webapp.video-detail'].itemInfo && scope['webapp.video-detail'].itemInfo.itemStruct,
        scope && scope['webapp.reflow.video.detail'] && scope['webapp.reflow.video.detail'].itemStruct,
        scope && scope['webapp.reflow.video.detail'] && scope['webapp.reflow.video.detail'].itemInfo && scope['webapp.reflow.video.detail'].itemInfo.itemStruct,
        data && data.itemInfo && data.itemInfo.itemStruct
    ].filter(Boolean);
    if (data && data.ItemModule) candidates.push(...Object.values(data.ItemModule));
    for (const item of candidates) {
        const product = fromItemStruct(item);
        if (product) return product;
    }
    return null;
}

async function bgFetchTikTokProductMobile(rawUrl) {
    await bgEnsureTikTokFetchMobileUa();
    const url = bgNormalizeTikTokVideoUrl(rawUrl);
    const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        redirect: 'follow',
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
            'User-Agent': STRANGETTS_TIKTOK_MOBILE_UA
        }
    });
    if (!res.ok) throw new Error('mobile fetch ' + res.status);
    const html = await res.text();
    const match = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    return bgExtractTikTokProductFromUniversalData(data);
}

async function bgHiddenTikTokProduct(rawUrl) {
    return null;
}

async function bgGetTikTokProduct(rawUrl) {
    return null;
}

function bgSafeDownloadFilename(name = 'strangetts-video.mp4') {
    return String(name || 'strangetts-video.mp4')
        .replace(/[\\:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || 'strangetts-video.mp4';
}

function bgCookiesGetAllSafe(details, timeoutMs = 1800) {
    return new Promise(resolve => {
        let settled = false;
        let timer = null;
        const finish = (cookies = []) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            resolve(Array.isArray(cookies) ? cookies : []);
        };
        timer = setTimeout(() => {
            console.warn('[Strange TTS BG] cookies.getAll timeout:', JSON.stringify(details));
            finish([]);
        }, timeoutMs);

        try {
            const maybePromise = chrome.cookies.getAll(details, cookies => {
                const err = chrome.runtime.lastError;
                if (err) console.warn('[Strange TTS BG] cookies.getAll callback error:', err.message, details);
                finish(cookies || []);
            });
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(finish).catch(err => {
                    console.warn('[Strange TTS BG] cookies.getAll promise error:', err?.message || err, details);
                    finish([]);
                });
            }
        } catch (err) {
            console.warn('[Strange TTS BG] cookies.getAll call error:', err?.message || err, details);
            try {
                const maybePromise = chrome.cookies.getAll(details);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(finish).catch(e => {
                        console.warn('[Strange TTS BG] cookies.getAll fallback error:', e?.message || e, details);
                        finish([]);
                    });
                } else {
                    finish([]);
                }
            } catch (e) {
                console.warn('[Strange TTS BG] cookies.getAll fallback call error:', e?.message || e, details);
                finish([]);
            }
        }
    });
}

async function bgCollectTikTokCookiesSafe() {
    const [sellerCookies, adsCookies, tiktokCookies, sellerRootCookies] = await Promise.all([
        bgCookiesGetAllSafe({ url: 'https://seller-vn.tiktok.com' }),
        bgCookiesGetAllSafe({ url: 'https://ads.tiktok.com' }),
        bgCookiesGetAllSafe({ domain: '.tiktok.com' }),
        bgCookiesGetAllSafe({ domain: 'seller-vn.tiktok.com' })
    ]);
    const allCookies = {};
    [...tiktokCookies, ...sellerCookies, ...adsCookies, ...sellerRootCookies].forEach(c => {
        if (!c || !c.name) return;
        allCookies[`${c.domain}|${c.path || '/'}|${c.name}`] = {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/'
        };
    });
    return Object.values(allCookies);
}

function bgMergeCookieArrays(...cookieSets) {
    const map = new Map();
    cookieSets.flat().forEach(c => {
        if (!c || !c.name || c.value == null) return;
        const domain = c.domain || '.tiktok.com';
        const path = c.path || '/';
        map.set(`${domain}|${path}|${c.name}`, {
            ...c,
            domain,
            path
        });
    });
    return Array.from(map.values());
}

function bgAdsCookieScore(cookies = []) {
    const important = new Set([
        'sessionid', 'sessionid_ss', 'sid_guard', 'uid_tt', 'uid_tt_ss',
        'sso_uid_tt', 'sso_uid_tt_ss', 'passport_csrf_token',
        'csrf_session_id', 'csrftoken', 'tt_csrf_token', 'msToken', 'odin_tt', 'ttwid'
    ]);
    const names = new Set((cookies || []).map(c => c?.name).filter(Boolean));
    let score = 0;
    important.forEach(name => { if (names.has(name)) score++; });
    return score;
}

async function bgGetAdsCookieSnapshot() {
    const [adsCookies, tiktokCookies] = await Promise.all([
        bgCookiesGetAllSafe({ url: 'https://ads.tiktok.com' }, 1800),
        bgCookiesGetAllSafe({ domain: '.tiktok.com' }, 1800)
    ]);
    const cookies = bgMergeCookieArrays(adsCookies, tiktokCookies);
    return {
        cookies,
        count: cookies.length,
        score: bgAdsCookieScore(cookies)
    };
}

async function bgAdsWarmupWasAttemptedThisProfile() {
    try {
        if (chrome.storage?.session) {
            const data = await chrome.storage.session.get(STRANGETTS_ADS_WARMUP_SESSION_KEY);
            return data?.[STRANGETTS_ADS_WARMUP_SESSION_KEY] === true;
        }
    } catch (e) { }
    return bgAdsWarmupProfileFallback === true;
}

async function bgMarkAdsWarmupAttemptedThisProfile() {
    bgAdsWarmupProfileFallback = true;
    try {
        if (chrome.storage?.session) {
            await chrome.storage.session.set({ [STRANGETTS_ADS_WARMUP_SESSION_KEY]: true });
        }
    } catch (e) { }
}

function bgCreateTabSafe(createProperties) {
    return new Promise(resolve => {
        try {
            chrome.tabs.create(createProperties, tab => {
                const err = chrome.runtime.lastError;
                if (err) console.warn('[Strange TTS BG] create warmup tab failed:', err.message);
                resolve(err ? null : tab);
            });
        } catch (e) {
            console.warn('[Strange TTS BG] create warmup tab exception:', e.message);
            resolve(null);
        }
    });
}

function bgReloadTabSafe(tabId) {
    return new Promise(resolve => {
        try {
            chrome.tabs.reload(tabId, {}, () => resolve(!chrome.runtime.lastError));
        } catch (e) {
            resolve(false);
        }
    });
}

function bgCloseTabSafe(tabId) {
    return new Promise(resolve => {
        try {
            chrome.tabs.remove(tabId, () => resolve(!chrome.runtime.lastError));
        } catch (e) {
            resolve(false);
        }
    });
}

function bgWaitForTabLoad(tabId, timeoutMs = 7000) {
    return new Promise(resolve => {
        let done = false;
        let timer = null;
        const finish = () => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            try { chrome.tabs.onUpdated.removeListener(listener); } catch (e) { }
            resolve(true);
        };
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && (changeInfo.status === 'complete' || changeInfo.status === 'loading')) {
                finish();
            }
        };
        try {
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.get(tabId, tab => {
                if (chrome.runtime.lastError || tab?.status === 'complete') finish();
            });
        } catch (e) {
            finish();
        }
        timer = setTimeout(finish, timeoutMs);
    });
}

async function bgWarmAdsCookiesFromSeller(opts = {}) {
    const sessionOnce = opts.sessionOnce !== false && opts.force !== true && opts.active !== true;
    const reason = opts.reason || 'ads_cookie_warmup';
    if (!sessionOnce) return bgWarmAdsCookiesFromSellerUncached(opts);

    if (bgAdsWarmupInFlight) {
        console.log('[Strange TTS BG] Ads cookie warmup reuse in-flight session:', reason);
        return bgAdsWarmupInFlight;
    }

    if (await bgAdsWarmupWasAttemptedThisProfile()) {
        const snapshot = await bgGetAdsCookieSnapshot();
        console.log('[Strange TTS BG] Ads cookie warmup skipped, already attempted this Chrome profile:', {
            reason,
            aadvid: opts.aadvid || '(none)',
            cookies: snapshot.count,
            score: snapshot.score
        });
        return {
            ok: snapshot.count > 0,
            reason,
            opened: false,
            skipped: true,
            sessionOnce: true,
            before: snapshot,
            after: snapshot,
            cookies: snapshot.cookies
        };
    }

    await bgMarkAdsWarmupAttemptedThisProfile();
    bgAdsWarmupInFlight = bgWarmAdsCookiesFromSellerUncached(opts).finally(() => {
        bgAdsWarmupInFlight = null;
    });
    return bgAdsWarmupInFlight;
}

async function bgWarmAdsCookiesFromSellerUncached(opts = {}) {
    const aadvid = opts.aadvid || '';
    const reason = opts.reason || 'ads_cookie_warmup';
    const maxWaitMs = Math.max(6000, Math.min(Number(opts.maxWaitMs || 18000), 45000));
    const url = bgBuildAdsPaymentUrl(aadvid);
    const started = Date.now();
    const before = await bgGetAdsCookieSnapshot();
    const tab = await bgCreateTabSafe({ url, active: opts.active === true });
    if (!tab || !tab.id) {
        return { ok: false, reason, opened: false, before, after: before, cookies: [] };
    }

    let after = before;
    try {
        for (let round = 0; round < 4 && Date.now() - started < maxWaitMs; round++) {
            await bgWaitForTabLoad(tab.id, Math.min(7000, maxWaitMs));
            await bgDelay(Math.min(3500 + round * 1000, Math.max(1500, maxWaitMs - (Date.now() - started))));
            after = await bgGetAdsCookieSnapshot();
            if (after.score >= 3 || after.count > before.count + 1) break;
            if (round < 3 && Date.now() - started < maxWaitMs - 2500) {
                await bgReloadTabSafe(tab.id);
            }
        }
    } finally {
        if (opts.keepTab !== true) await bgCloseTabSafe(tab.id);
    }

    console.log('[Strange TTS BG] Ads cookie warmup:', {
        reason,
        aadvid: aadvid || '(none)',
        before: before.count,
        after: after.count,
        score: after.score,
        ms: Date.now() - started
    });
    return { ok: after.count > 0, reason, opened: true, before, after, cookies: after.cookies };
}

async function bgWarmAdsCookiesForShop(shop = {}, reason = 'ads_cookie_warmup', opts = {}) {
    const warm = await bgWarmAdsCookiesFromSeller({
        aadvid: shop.aadvid || opts.aadvid || '',
        reason,
        maxWaitMs: opts.maxWaitMs || 18000,
        active: opts.active === true,
        keepTab: opts.keepTab === true
    });
    if (!warm.cookies || warm.cookies.length === 0) return { shop, warm };

    const updatedShop = {
        ...shop,
        cookies: bgMergeCookieArrays(shop.cookies || [], warm.cookies),
        cookieUpdatedAt: new Date().toISOString(),
        adsCookieWarmupAt: new Date().toISOString(),
        __adsCookieWarmed: true
    };
    await bgPersistFreshCookieShop(updatedShop);
    return { shop: updatedShop, warm };
}

function bgBuildExportShopData(request, cookies, metadata = {}) {
    const { aadvid, oec_seller_id, seller_id, bc_id, shopName, uid, shopAvatar, shopRealName } = request;
    const sellerIdForExport = oec_seller_id || seller_id || '';
    const adsAccounts = bgNormalizeAdsAccounts([
        ...(metadata.adsAccounts || []),
        ...(request.ads_accounts || [])
    ], aadvid);
    const primaryAadvid = aadvid || adsAccounts[0]?.aadvid || '';
    const shopMeta = metadata.shopMeta || {};
    const canonicalShopId = bgFirstText(oec_seller_id, seller_id, sellerIdForExport);
    return {
        version: '42',
        exportedAt: new Date().toISOString(),
        shop: {
            name: shopMeta.shopRealName || shopRealName || shopName || 'Unknown Shop',
            aadvid: primaryAadvid,
            oec_seller_id: oec_seller_id || '',
            seller_id: seller_id || '',
            bc_id: bc_id || '',
            uid: uid || '',
            shopAvatar: shopAvatar || shopMeta.shopAvatar || '',
            shopRealName: shopMeta.shopRealName || shopRealName || shopName || '',
            canonical_shop_id: canonicalShopId,
            ads_accounts: adsAccounts.filter(acc => acc.aadvid !== primaryAadvid),
            mainAccountLabel: adsAccounts.find(acc => acc.aadvid === primaryAadvid)?.label || '',
            shopTimezone: shopMeta.shopTimezone || '',
            shopRegion: shopMeta.shopRegion || '',
            shopCode: shopMeta.shopCode || '',
            passportEmail: shopMeta.passportEmail || ''
        },
        shop_meta: {
            ...shopMeta,
            canonical_shop_id: canonicalShopId,
            ads_accounts_count: adsAccounts.length
        },
        ads_accounts: adsAccounts,
        cookies
    };
}

function bgIsBusinessCenterAccountNode(item = {}) {
    return !!(
        item.user_role ||
        item.adv_count_in_bc !== undefined ||
        item.user_count_in_bc !== undefined ||
        item.customer_record_type !== undefined ||
        item.billing_info_exist !== undefined ||
        String(item.role || '') === '99'
    );
}

function bgExtractAccountSwitchAdsAccounts(json) {
    const roots = json?.data?.data || json?.data?.list || json?.data || [];
    const map = new Map();
    const addAccount = (item = {}, parentBc = null) => {
        const aadvid = bgFirstText(item.aadvid, item.advertiser_id, item.adv_id, item.id);
        if (!/^\d{12,}$/.test(aadvid)) return;
        const label = bgFirstText(item.label, item.name, item.advertiser_name, item.account_name, aadvid);
        const prev = map.get(aadvid) || {};
        map.set(aadvid, {
            ...prev,
            aadvid,
            label,
            name: label,
            enabled: item.enabled !== false,
            status: item.status,
            role: item.role,
            country: item.country || prev.country || '',
            currency: item.currency || prev.currency || '',
            bc_id: bgFirstText(item.bc_id, item.business_center_id, item.parent_bc_id, parentBc?.id, prev.bc_id),
            bc_name: bgFirstText(item.bc_name, item.business_center_name, parentBc?.name, prev.bc_name),
            source: 'account_switch_list'
        });
    };
    const walk = (node, parentBc = null, depth = 0) => {
        if (!node || depth > 8) return;
        if (Array.isArray(node)) {
            node.forEach(item => walk(item, parentBc, depth + 1));
            return;
        }
        if (typeof node !== 'object') return;
        const isBc = bgIsBusinessCenterAccountNode(node);
        if (!isBc) addAccount(node, parentBc);
        const nextParent = isBc && node.id ? node : parentBc;
        if (Array.isArray(node.child)) {
            node.child.forEach(item => walk(item, nextParent, depth + 1));
        }
        Object.keys(node).forEach(k => {
            if (k === 'child' || /cookie|token|csrf|html|style|script/i.test(k)) return;
            const value = node[k];
            if (value && typeof value === 'object') walk(value, nextParent, depth + 1);
        });
    };
    walk(roots);
    return Array.from(map.values());
}

async function bgFetchAccountSwitchAdsAccounts(currentAadvid = '') {
    if (!currentAadvid) return [];
    const csrf = await bgGetCsrfTokenForUrl('https://ads.tiktok.com');
    const msToken = await bgGetCookieValueForUrl('https://ads.tiktok.com', 'msToken');
    const tokenPart = msToken ? `&msToken=${encodeURIComponent(msToken)}` : '';
    const url = `https://ads.tiktok.com/api/v2/i18n/account/account_switch_list/?aadvid=${encodeURIComponent(currentAadvid)}${tokenPart}`;
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'x-csrftoken': csrf,
        'trace-log-adv-id': currentAadvid
    };
    const referrer = `https://ads.tiktok.com/i18n/dashboard?aadvid=${encodeURIComponent(currentAadvid)}`;
    const json = await bgWithTimeout(
        bgFetchJsonSafe(url, { headers, credentials: 'include', referrer }),
        3500,
        null
    );
    if (!json || json.code !== 0) return [];
    const accounts = bgExtractAccountSwitchAdsAccounts(json);
    if (accounts.length) {
        console.log('[Strange TTS BG] account_switch_list ads accounts:', accounts.length);
    }
    return accounts;
}

async function bgFetchSellerExportMetadata(sellerId, currentAadvid = '') {
    if (!sellerId) return { adsAccounts: [], shopMeta: {} };
    const csrf = await bgGetTikTokCsrfToken();
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'x-csrftoken': csrf
    };
    const qs = `locale=vi&language=vi&oec_seller_id=${encodeURIComponent(sellerId)}`;
    const referrer = 'https://seller-vn.tiktok.com/ads-creation/dashboard?origin=SC_ads_tab_button_PC&mpa=1&type=product';

    const [advsRes, prefillRes, ttListRes, accountSwitchAccounts] = await Promise.all([
        bgFetchJsonSafe(`https://seller-vn.tiktok.com/oec_ads/shopping/v1/adv/get_user_own_advs?${qs}`, { headers, credentials: 'include', referrer }),
        bgFetchJsonSafe(`https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/get_bc_creation_prefill_info?${qs}`, { headers, credentials: 'include', referrer }),
        bgFetchJsonSafe(`https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/tt_list?${qs}`, { headers, credentials: 'include', referrer }),
        bgFetchAccountSwitchAdsAccounts(currentAadvid).catch(() => [])
    ]);

    const advs = advsRes?.code === 0 ? (advsRes.data?.user_own_advs || []) : [];
    const adsAccounts = bgNormalizeAdsAccounts([
        ...advs.map(a => ({
            aadvid: bgFirstText(a.id, a.aadvid, a.advertiser_id),
            label: bgFirstText(a.name, a.label),
            name: bgFirstText(a.name, a.label),
            enabled: true,
            source: 'get_user_own_advs'
        })),
        ...(accountSwitchAccounts || [])
    ], currentAadvid);

    const prefill = prefillRes?.code === 0 ? (prefillRes.data || {}) : {};
    const ttInfo = (ttListRes?.code === 0 && ttListRes.data)
        ? ((ttListRes.data.tt_of_oec && ttListRes.data.tt_of_oec[0]) || (ttListRes.data.tt_of_bc && ttListRes.data.tt_of_bc[0]) || {})
        : {};

    return {
        adsAccounts,
        shopMeta: {
            shopRealName: bgFirstText(prefill.shop_name, ttInfo.name),
            shopAvatar: bgFirstText(ttInfo.avatar, ttInfo.logo),
            shopTimezone: bgFirstText(prefill.shop_timezone),
            shopRegion: bgFirstText(prefill.shop_region),
            shopCode: bgFirstText(prefill.shop_code),
            passportEmail: bgFirstText(prefill.passport_email),
            source: 'seller_export_metadata'
        }
    };
}

async function bgGetSyncContext() {
    const store = await chrome.storage.local.get(['strangetts_v30_auth', 'strangetts_sync_url']);
    const auth = store.strangetts_v30_auth || {};
    return {
        auth,
        syncUrl: auth.syncUrl || store.strangetts_sync_url || STRANGETTS_DEFAULT_SYNC_URL
    };
}

function bgCookieRefreshQuery(shop = {}, force = false) {
    return {
        force: !!force,
        key: shop.local_key || shop.shop_key || bgCanonicalShopId(shop),
        target_username: shop.source_username || shop.owner_username || shop.owner || '',
        source_username: shop.source_username || shop.owner_username || shop.owner || '',
        source_shop_key: shop.source_shop_key || shop.shop_key || '',
        shop_key: shop.source_shop_key || shop.shop_key || '',
        canonical_shop_id: bgCanonicalShopId(shop),
        aadvid: shop.aadvid || '',
        seller_id: shop.seller_id || '',
        oec_seller_id: shop.oec_seller_id || '',
        cookieFingerprint: shop.cookieFingerprint || shop.cookie_signal || ''
    };
}

function bgIsCookiePayloadNewer(shop = {}, payload = {}, force = false) {
    if (!payload || !Array.isArray(payload.cookies) || payload.cookies.length === 0) return false;
    const nextFp = bgFirstText(payload.cookieFingerprint, payload.cookie_fingerprint, payload.shop?.cookieFingerprint, payload.shop?.cookie_signal);
    const curFp = bgFirstText(shop.cookieFingerprint, shop.cookie_fingerprint, shop.cookie_signal);
    if (nextFp && curFp && nextFp === curFp && !force) return false;
    const nextAt = Date.parse(bgFirstText(payload.cookieUpdatedAt, payload.cookie_updated_at, payload.exportedAt, payload.shop?.cookieUpdatedAt));
    const curAt = Date.parse(bgFirstText(shop.cookieUpdatedAt, shop.cookie_updated_at, shop.exportedAt));
    if (!force && nextAt && curAt && nextAt <= curAt && (!nextFp || !curFp)) return false;
    return true;
}

function bgMergeFreshCookiePayload(shop = {}, payload = {}) {
    const payloadShop = payload.shop || {};
    const nextAadvid = bgFirstText(shop.aadvid, payloadShop.aadvid);
    const mergedAccounts = bgMergeAdsAccountsPreservingSelection(
        shop,
        payloadShop.ads_accounts || payload.ads_accounts || [],
        nextAadvid
    );
    return {
        ...shop,
        name: bgFirstText(payloadShop.name, payloadShop.shopRealName, shop.name),
        shopRealName: bgFirstText(payloadShop.shopRealName, payloadShop.name, shop.shopRealName, shop.name),
        shopAvatar: bgFirstText(payloadShop.shopAvatar, payloadShop.shopLogo, shop.shopAvatar),
        aadvid: nextAadvid,
        oec_seller_id: bgFirstText(payloadShop.oec_seller_id, shop.oec_seller_id),
        seller_id: bgFirstText(payloadShop.seller_id, shop.seller_id),
        bc_id: bgFirstText(payloadShop.bc_id, shop.bc_id),
        uid: bgFirstText(payloadShop.uid, shop.uid),
        canonical_shop_id: bgFirstText(payloadShop.canonical_shop_id, payload.canonical_shop_id, shop.canonical_shop_id, bgCanonicalShopId(payloadShop), bgCanonicalShopId(shop)),
        source_username: bgFirstText(shop.source_username, payload.owner_username, payload.source_username),
        source_shop_key: bgFirstText(shop.source_shop_key, payload.shop_key, payload.source_shop_key),
        cookies: payload.cookies || shop.cookies || [],
        ads_accounts: mergedAccounts.filter(a => a.aadvid !== nextAadvid),
        cookieFingerprint: bgFirstText(payload.cookieFingerprint, payload.cookie_fingerprint, payloadShop.cookieFingerprint, shop.cookieFingerprint),
        cookieUpdatedAt: bgFirstText(payload.cookieUpdatedAt, payload.cookie_updated_at, payloadShop.cookieUpdatedAt, payload.exportedAt, shop.cookieUpdatedAt),
        exportedAt: bgFirstText(payload.exportedAt, shop.exportedAt),
        __cookieRefreshed: true
    };
}

function bgCookiePayloadShop(payload = {}) {
    const payloadShop = payload.shop || {};
    return {
        ...payloadShop,
        canonical_shop_id: bgFirstText(payloadShop.canonical_shop_id, payload.canonical_shop_id),
        source_shop_key: bgFirstText(payloadShop.source_shop_key, payload.shop_key, payload.source_shop_key),
        oec_seller_id: bgFirstText(payloadShop.oec_seller_id, payload.oec_seller_id),
        seller_id: bgFirstText(payloadShop.seller_id, payload.seller_id),
        shop_id: bgFirstText(payloadShop.shop_id, payload.shop_id),
        aadvid: bgFirstText(payloadShop.aadvid, payload.aadvid)
    };
}

function bgNormalizeNameForIdentity(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function bgCookiePayloadMatchesRequestedShop(shop = {}, payload = {}) {
    const payloadShop = bgCookiePayloadShop(payload);
    const requestedStrong = bgStrongShopIdentityTokens(shop);
    const payloadStrong = bgStrongShopIdentityTokens(payloadShop);

    if (requestedStrong.size && payloadStrong.size) {
        for (const token of requestedStrong) {
            if (payloadStrong.has(token)) return true;
        }
        return false;
    }

    const requestSourceKey = String(shop.source_shop_key || shop.shop_key || '').trim();
    const payloadSourceKey = String(payloadShop.source_shop_key || payloadShop.shop_key || '').trim();
    if (requestSourceKey && payloadSourceKey && requestSourceKey !== payloadSourceKey) return false;

    const requestName = bgNormalizeNameForIdentity(shop.shopRealName || shop.name);
    const payloadName = bgNormalizeNameForIdentity(payloadShop.shopRealName || payloadShop.name);
    if (!requestedStrong.size && !payloadStrong.size && requestName && payloadName && requestName !== payloadName) return false;

    return true;
}

function bgStrongShopIdentityTokens(shop = {}, key = '') {
    const aadvid = String(shop.aadvid || '').trim();
    const tokens = [
        key,
        shop.local_key,
        shop.canonical_shop_id,
        shop.source_shop_key,
        shop.oec_seller_id,
        shop.seller_id,
        shop.shop_id,
        shop.id
    ]
        .map(v => String(v || '').trim())
        .filter(v => v && v !== aadvid);
    return new Set(tokens);
}

function bgShopIdentityHasStrongMatch(record = {}, key = '', shop = {}) {
    const recordTokens = bgStrongShopIdentityTokens(record, key);
    const shopTokens = bgStrongShopIdentityTokens(shop);
    for (const token of shopTokens) {
        if (recordTokens.has(token)) return true;
    }
    return false;
}

function bgIsAadvidSharedInBucket(bucket = {}, aadvid = '') {
    const id = String(aadvid || '').trim();
    if (!id) return false;
    let count = 0;
    Object.keys(bucket || {}).forEach(key => {
        const record = bucket[key] || {};
        if (String(record.aadvid || '') === id) count++;
    });
    return count > 1;
}

function bgShopRecordMatches(record = {}, key = '', shop = {}) {
    if (bgShopIdentityHasStrongMatch(record, key, shop)) return true;

    const recordAadvid = String(record.aadvid || '').trim();
    const shopAadvid = String(shop.aadvid || '').trim();
    const recordHasStrongId = bgStrongShopIdentityTokens(record, key).size > 0;
    const shopHasStrongId = bgStrongShopIdentityTokens(shop).size > 0;

    // aadvid is an Ads account id, not a shop id. Only use it as a last-resort
    // match when neither side has a stronger shop identity.
    return !!recordAadvid && recordAadvid === shopAadvid && !recordHasStrongId && !shopHasStrongId;
}

async function bgPersistFreshCookieShop(updatedShop) {
    try {
        const store = await chrome.storage.local.get(['strangetts_multi_shops', 'strangetts_rp_shops']);
        const patchBucket = (bucket = {}) => {
            let changed = false;
            const out = { ...bucket };
            const aadvidIsShared = bgIsAadvidSharedInBucket(out, updatedShop.aadvid);
            Object.keys(out).forEach(key => {
                const record = out[key] || {};
                if (!bgShopRecordMatches(record, key, updatedShop)) return;
                if (aadvidIsShared && !bgShopIdentityHasStrongMatch(record, key, updatedShop)) return;
                out[key] = {
                    ...record,
                    ...updatedShop,
                    local_key: record.local_key || key,
                    cookies: updatedShop.cookies,
                    ads_accounts: updatedShop.ads_accounts || record.ads_accounts || []
                };
                delete out[key].__cookieRefreshed;
                changed = true;
            });
            return { out, changed };
        };
        const multi = patchBucket(store.strangetts_multi_shops || {});
        const report = patchBucket(store.strangetts_rp_shops || {});
        const setObj = {};
        if (multi.changed) setObj.strangetts_multi_shops = multi.out;
        if (report.changed) setObj.strangetts_rp_shops = report.out;
        if (Object.keys(setObj).length) await chrome.storage.local.set(setObj);
        if (Object.keys(setObj).length && updatedShop.__adsCookieWarmed) {
            await bgUploadLocalShopsAfterCookieWarmup(updatedShop);
        }
    } catch (e) {
        console.warn('[Strange TTS BG] persist refreshed cookies failed:', e.message);
    }
}

async function bgUploadLocalShopsAfterCookieWarmup(updatedShop = {}) {
    try {
        const { auth, syncUrl } = await bgGetSyncContext();
        if (!auth || !auth.username || !auth.token || !syncUrl) return;
        if (auth.role === 'admin' && updatedShop.source_username && updatedShop.source_username !== auth.username) {
            console.log('[Strange TTS BG] Skip cloud upload for warmed Ads cookie from child shop:', updatedShop.source_username);
            return;
        }

        const store = await chrome.storage.local.get(['strangetts_multi_shops', 'strangetts_shop_order']);
        const shops = store.strangetts_multi_shops || {};
        if (!Object.keys(shops).length) return;
        const order = Array.isArray(store.strangetts_shop_order) ? store.strangetts_shop_order : Object.keys(shops);
        const resp = await fetch(`${syncUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: auth.username,
                token: auth.token,
                shops,
                order,
                uploaded_at: new Date().toISOString(),
                reason: 'ads_cookie_warmup'
            })
        });
        const payload = await resp.json().catch(() => null);
        if (!resp.ok || !payload?.ok) {
            console.warn('[Strange TTS BG] Ads cookie warmup cloud upload failed:', resp.status, payload?.error || payload?.msg || '');
            return;
        }
        console.log('[Strange TTS BG] Ads cookie warmup uploaded to cloud:', updatedShop.name || updatedShop.aadvid || '');
    } catch (e) {
        console.warn('[Strange TTS BG] Ads cookie warmup cloud upload exception:', e.message);
    }
}

async function bgRefreshShopCookiesFromServer(shop = {}, opts = {}) {
    const shopLabel = shop.name || shop.aadvid || '(unknown)';
    try {
        const { auth, syncUrl } = await bgGetSyncContext();
        if (!auth || auth.role !== 'admin' || !auth.token || !syncUrl) return shop;

        const query = bgCookieRefreshQuery(shop, !!opts.force);
        console.log(`[Strange TTS BG] 🍪 CookieRefresh [${shopLabel}] query:`, {
            reason: opts.reason || '?',
            target_username: query.target_username || '(empty!)',
            canonical_shop_id: query.canonical_shop_id || '(empty!)',
            cookieFingerprint: query.cookieFingerprint ? query.cookieFingerprint.slice(0, 12) + '...' : '(none)',
            force: query.force
        });

        const resp = await fetch(`${syncUrl}/api/admin/get-latest-shop-cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...query, admin_token: auth.token })
        });

        const payload = await resp.json().catch(() => null);

        if (!resp.ok || !payload) {
            console.warn(`[Strange TTS BG] 🍪 CookieRefresh [${shopLabel}] ❌ HTTP ${resp.status} hoặc parse lỗi`, payload);
            return shop;
        }
        if (!payload.ok) {
            console.warn(`[Strange TTS BG] 🍪 CookieRefresh [${shopLabel}] ❌ Server trả ok=false:`, payload.error || payload.msg || JSON.stringify(payload).slice(0, 120));
            return shop;
        }
        if (!bgCookiePayloadMatchesRequestedShop(shop, payload)) {
            const payloadShop = bgCookiePayloadShop(payload);
            console.warn(`[Strange TTS BG] 🍪 CookieRefresh [${shopLabel}] ⛔ Bỏ qua payload không khớp shop`, {
                requested: {
                    local_key: shop.local_key || '',
                    source_shop_key: shop.source_shop_key || '',
                    oec_seller_id: shop.oec_seller_id || '',
                    seller_id: shop.seller_id || '',
                    aadvid: shop.aadvid || '',
                    name: shop.shopRealName || shop.name || ''
                },
                received: {
                    source_shop_key: payloadShop.source_shop_key || '',
                    oec_seller_id: payloadShop.oec_seller_id || '',
                    seller_id: payloadShop.seller_id || '',
                    aadvid: payloadShop.aadvid || '',
                    name: payloadShop.shopRealName || payloadShop.name || ''
                }
            });
            return shop;
        }

        const isNewer = bgIsCookiePayloadNewer(shop, payload, !!opts.force);
        if (!isNewer) {
            const nextFp = bgFirstText(payload.cookieFingerprint, payload.cookie_fingerprint, payload.shop?.cookieFingerprint);
            const curFp  = bgFirstText(shop.cookieFingerprint, shop.cookie_fingerprint, shop.cookie_signal);
            const nextAt = bgFirstText(payload.cookieUpdatedAt, payload.cookie_updated_at, payload.exportedAt);
            const curAt  = bgFirstText(shop.cookieUpdatedAt, shop.cookie_updated_at, shop.exportedAt);
            console.log(`[Strange TTS BG] 🍪 CookieRefresh [${shopLabel}] ⏩ Bỏ qua — cookie không mới hơn`, {
                serverFP: nextFp ? nextFp.slice(0, 12) : '(none)',
                localFP: curFp ? curFp.slice(0, 12) : '(none)',
                serverAt: nextAt || '(none)',
                localAt: curAt || '(none)',
                serverCookieCount: Array.isArray(payload.cookies) ? payload.cookies.length : 0
            });
            return shop;
        }

        const updated = bgMergeFreshCookiePayload(shop, payload);
        await bgPersistFreshCookieShop(updated);
        console.log(`[Strange TTS BG] ✅ Cookie refreshed from server [${shopLabel}]:`, {
            cookieCount: (updated.cookies || []).length,
            updatedAt: updated.cookieUpdatedAt || '(none)',
            fingerprint: updated.cookieFingerprint ? updated.cookieFingerprint.slice(0, 12) + '...' : '(none)'
        });
        return updated;

    } catch (e) {
        console.warn(`[Strange TTS BG] 🍪 CookieRefresh [${shopLabel}] ❌ Exception:`, e.message);
        return shop;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'STRANGETTS_BG_HEALTH') {
        sendResponse({
            ok: true,
            version: '1.0.0',
            ts: Date.now()
        });
        return true;
    }
    if (request.action === 'STRANGETTS_TIKWM_FETCH') {
        bgFetchTikwmNoLogo(request.url)
            .then(data => sendResponse({ ok: true, data }))
            .catch(err => sendResponse({ ok: false, error: err?.message || String(err) }));
        return true;
    }
    if (request.action === 'STRANGETTS_DOWNLOAD_FILE') {
        try {
            const url = request.url || '';
            if (!url) {
                sendResponse({ ok: false, error: 'missing download url' });
                return true;
            }
            chrome.downloads.download({
                url,
                filename: bgSafeDownloadFilename(request.filename || 'strangetts-video.mp4'),
                saveAs: false,
                conflictAction: 'uniquify'
            }, downloadId => {
                const err = chrome.runtime.lastError;
                if (err) sendResponse({ ok: false, error: err.message });
                else sendResponse({ ok: true, downloadId });
            });
        } catch (err) {
            sendResponse({ ok: false, error: err?.message || String(err) });
        }
        return true;
    }
    // V30 Master Admin Access Handler
    if (request.action === 'ADMIN_ACCESS_SHOP') {
        const shop = request.shop;
        if (!shop || !shop.cookies) {
            sendResponse({ success: false, error: 'Dữ liệu shop không hợp lệ' });
            return true;
        }
        (async () => {
            const freshShop = await bgRefreshShopCookiesFromServer(shop, { force: false, reason: 'admin_access' });
            console.log('[Strange TTS BG] 👑 Admin Access Shop triggered for:', freshShop.name);
            await cleanTikTokCookies();
            await applyShopCookies(freshShop.cookies);
            chrome.tabs.create({ url: 'https://seller-vn.tiktok.com/', active: true });
            sendResponse({ success: true });
        })();
        return true;
    }
    if (request.action === 'keep_alive_ping') {
        if (Math.random() > 0.95) console.log('[Strange TTS BG] Heartbeat ping received');
        sendResponse({ ok: true });
        return true;
    }
    // Lắng nghe sự kiện LOGOUT để dọn dẹp tiến trình chạy ngầm
    if (request.action === 'STRANGETTS_LOGOUT_EVENT' || request.action === 'STRANGETTS_LOGOUT') {
        console.log('[Strange TTS BG] LOGOUT event received — Stopping scheduler and clearing lock');
        chrome.storage.local.remove('strangetts_rp_lock');
        chrome.alarms.clear('strangetts_rp_check');
        sendResponse({ ok: true });
        return true;
    }
    if (request.action === "open_perf_window") {
        let now = new Date();
        let startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
        let endTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
        let dashUrl = `https://seller-vn.tiktok.com/ads-creation/dashboard?type=product&shop_region=VN&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${startTs}&list_end_date=${endTs}`;
        chrome.windows.create({
            url: dashUrl,
            type: 'popup',
            width: 1200,
            height: 800,
            focused: true
        });
        sendResponse({ success: true });
        return true;
    }
    if (request.action === "open_tabs") {
        const urls = request.urls || [];
        urls.forEach(item => {
            if (typeof item === 'string') chrome.tabs.create({ url: item, active: true });
            else if (item && item.url) chrome.tabs.create({ url: item.url, active: item.active !== false });
        });
        sendResponse({ success: true });
        return true;
    }
    if (request.action === "activate_tab") {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.update(sender.tab.id, { active: true });
        }
        sendResponse({ success: true });
        return true;
    }
    if (request.action === "activate_parent_tab") {
        // Return to the tab that opened this edit tab (or first dashboard tab)
        if (sender.tab) {
            chrome.tabs.query({ windowId: sender.tab.windowId }, (tabs) => {
                // Find dashboard tab (not the current edit tab)
                let dashTab = tabs.find(t => t.id !== sender.tab.id && t.url && t.url.includes('/ads-creation/dashboard'));
                if (dashTab) {
                    chrome.tabs.update(dashTab.id, { active: true });
                } else if (tabs.length > 0) {
                    // Fallback: activate previous tab
                    let idx = tabs.findIndex(t => t.id === sender.tab.id);
                    let prevTab = tabs[Math.max(0, idx - 1)];
                    if (prevTab && prevTab.id !== sender.tab.id) chrome.tabs.update(prevTab.id, { active: true });
                }
            });
        }
        sendResponse({ success: true });
        return true;
    }
    if (request.action === "close_current_tab") {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
        sendResponse({ success: true });
        return true;
    }
    if (request.action === "toggle_panel") {
        sendResponse({ success: true });
        return true;
    }
    // Direct GMV Max API — fetch overview + all campaigns
    if (request.action === "fetch_gmv_api") {
        let { aadvid, oec_seller_id, bc_id } = request;
        if (!aadvid || !oec_seller_id) { sendResponse({ error: 'missing ids' }); return true; }

        let base = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat`;
        let params = `locale=vi&language=vi&oec_seller_id=${oec_seller_id}&aadvid=${aadvid}${bc_id ? '&bc_id=' + bc_id : ''}`;
        let hdrs = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json; charset=UTF-8' };

        // Build date range for today (Vietnam timezone)
        let now = new Date();
        let vnDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        let startTs = new Date(vnDate + 'T00:00:00+07:00').getTime();
        let endTs = new Date(vnDate + 'T23:59:59+07:00').getTime();

        // Overview stats body
        let overviewBody = {
            start_time: vnDate,
            end_time: vnDate,
            query_list: ["cost", "onsite_roi2_shopping_sku", "cost_per_onsite_roi2_shopping_sku", "onsite_roi2_shopping_value", "onsite_roi2_shopping"],
            campaign_shop_automation_type: 2,
            external_type_list: ["307", "304", "305"]
        };

        // Campaign list body
        let campaignBody = {
            query_list: [
                "campaign_eligible_status", "campaign_eligible_reject_reason", "campaign_eligible_roi",
                "campaign_opt_status", "campaign_name", "campaign_primary_status", "campaign_status",
                "campaign_target_roi_budget", "cost", "compensation_info", "gmax_advance_mode",
                "template_ad_schedule_type", "campaign_no_bid_budget", "campaign_additional_budget",
                "template_ad_roas_bid", "campaign_budget_mode", "campaign_create_channel",
                "template_ad_start_time", "template_ad_end_time", "billed_cost",
                "auto_increase_budget_effective_budget", "onsite_roi2_shopping_sku",
                "cost_per_onsite_roi2_shopping_sku", "onsite_roi2_shopping_value",
                "onsite_roi2_shopping", "basic_cost", "basic_onsite_roi2_shopping",
                "creative_nobid_cost", "session_info", "gmv_max_bid_type",
                "campaign_target_roi_budget_mode", "promotion_days_mode", "in_promotion_days",
                "promotion_days_roas_bid_multiplier", "promotion_days_budget_multiplier",
                "promotion_days_schedules", "all_boost_cost"
            ],
            campaign_shop_automation_type: 2,
            campaign_status: ["delivery_ok", "campaign_not_delivery"],
            start_time: vnDate,
            end_time: vnDate,
            external_type_list: ["307", "304", "305"],
            keyword: "",
            keyword_type: 0,
            order_field: "cost",
            order_type: 1,
            page: 1,
            page_size: 100
        };

        // Fetch overview + campaigns in parallel
        Promise.all([
            fetch(`${base}/post_overview_stat?${params}`, { method: 'POST', credentials: 'include', headers: hdrs, body: JSON.stringify(overviewBody) }).then(r => r.json()).catch(() => null),
            fetch(`${base}/post_campaign_list?${params}`, { method: 'POST', credentials: 'include', headers: hdrs, body: JSON.stringify(campaignBody) }).then(r => r.json()).catch(() => null)
        ]).then(async ([overview, campaigns]) => {
            let result = { overview: null, campaigns: [] };

            if (overview && overview.code === 0) result.overview = overview.data;

            if (campaigns && campaigns.code === 0 && campaigns.data) {
                result.campaigns = campaigns.data.table || [];
                // Handle pagination — fetch remaining pages
                let pagination = campaigns.data.pagination;
                if (pagination && pagination.page_count > 1) {
                    for (let p = 2; p <= pagination.page_count; p++) {
                        try {
                            let pageBody = { ...campaignBody, page: p };
                            let pageRes = await fetch(`${base}/post_campaign_list?${params}`, { method: 'POST', credentials: 'include', headers: hdrs, body: JSON.stringify(pageBody) });
                            let pageJson = await pageRes.json();
                            if (pageJson && pageJson.code === 0 && pageJson.data && pageJson.data.table) {
                                result.campaigns = result.campaigns.concat(pageJson.data.table);
                            }
                        } catch (e) { }
                    }
                }
            }

            sendResponse(result);
        }).catch(err => {
            sendResponse({ error: err.message });
        });
        return true;
    }
    // Fetch access token and use it for API calls
    if (request.action === "fetch_access_token") {
        let aadvid = request.aadvid;
        let uid = request.uid || '';
        if (!aadvid) { sendResponse({ error: 'no aadvid' }); return true; }

        let tokenUrl = `https://ads.tiktok.com/api/v1/self-serve/athena/access_token/?aadvid=${aadvid}&app_id=6&lib_token=ad_platform&country=VN${uid ? '&uid=' + uid : ''}&employee_id=0`;
        fetch(tokenUrl, { credentials: 'include', headers: { 'Accept': 'application/json' } })
            .then(res => res.json())
            .then(tokenJson => {
                if (!tokenJson || tokenJson.code !== 0) {
                    sendResponse({ error: 'token_error', msg: tokenJson?.msg });
                    return;
                }
                let token = tokenJson.data?.access_token || tokenJson.data?.token || '';
                sendResponse({ token: token, data: tokenJson.data });
            })
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
    // Direct API call for balance + billing type + threshold detection (all-in-one)
    if (request.action === "fetch_balance_api") {
        let aadvid = request.aadvid;
        if (!aadvid) { sendResponse({ error: 'no aadvid' }); return true; }
        (async () => {
            let result = await bgFetchBalanceApiPayload(aadvid, 'balance_api');
            if (result.error === 'balance_fail' || !result.data) {
                const sellerId = request.oec_seller_id || request.seller_id || '';
                const canWarmAds = sellerId ? await bgCheckSellerSessionAlive(sellerId, 5000) : true;
                if (canWarmAds) {
                    await bgWarmAdsCookiesFromSeller({
                        aadvid,
                        reason: 'fetch_balance_api_ads_fail',
                        maxWaitMs: request.adsWarmupMs || 18000,
                        active: request.showAdsWarmupTab === true
                    });
                    const retry = await bgFetchBalanceApiPayload(aadvid, 'balance_api_after_warmup');
                    if (retry && !retry.error) retry._adsCookieWarmup = true;
                    result = retry && (!retry.error || retry.data) ? retry : result;
                } else {
                    result.error = 'seller_cookie_expired';
                    result.msg = 'Seller cookie đã hết hạn, bỏ qua warm Ads';
                }
            }
            sendResponse(result);
        })().catch(err => sendResponse({ error: err.message }));
        return true;
    }
    // Detect prepaid vs postpay via query_payment_account API
    if (request.action === "fetch_billing_type") {
        let aadvid = request.aadvid;
        if (!aadvid) { sendResponse({ error: 'no aadvid' }); return true; }
        let apiUrl = `https://ads.tiktok.com/pa/api/spider/query_payment_account/?aadvid=${aadvid}`;
        fetch(apiUrl, { credentials: 'include', headers: { 'Accept': 'application/json' } })
            .then(r => r.json())
            .then(json => {
                if (json && json.code === 0 && json.data) {
                    let opts = json.data.billing_options || [];
                    let payType = opts.length > 0 ? opts[0].pay_method_type : 0;
                    // pay_method_type: 1 = prepaid (trả trước), 2 = postpaid (trả sau)
                    console.log('[Strange TTS BG] Payment account type:', payType, payType === 2 ? 'POSTPAY' : 'PREPAID');
                    sendResponse({ payMethodType: payType, data: json.data });
                } else {
                    sendResponse({ error: 'api_error', code: json?.code, msg: json?.msg });
                }
            })
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
    // Fetch postpay threshold + spent via due_date API
    if (request.action === "fetch_due_date") {
        let aadvid = request.aadvid;
        if (!aadvid) { sendResponse({ error: 'no aadvid' }); return true; }
        let apiUrl = `https://ads.tiktok.com/pa/api/common/show/payment/query_due_date?aadvid=${aadvid}`;
        fetch(apiUrl, { credentials: 'include', headers: { 'Accept': 'application/json' } })
            .then(r => r.json())
            .then(json => {
                if (json && json.code === 0 && json.data && json.data.due_date_items) {
                    let items = json.data.due_date_items;
                    let item = items.length > 0 ? items[0] : null;
                    if (item) {
                        sendResponse({
                            threshold: Number(item.bill_balance) || 0,
                            currentCost: Number(item.current_cost) || 0,
                            payMethod: item.pay_method,
                            currency: item.currency?.currency || 'VND',
                            startDate: json.data.start_date,
                            endDate: item.end_date
                        });
                    } else {
                        sendResponse({ error: 'no_items' });
                    }
                } else {
                    sendResponse({ error: 'api_error', code: json?.code });
                }
            })
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
    if (request.action === "fetch_balance") {
        let url = request.url;
        if (!url) { sendResponse({ error: 'no url' }); return true; }

        // Open hidden tab to scrape balance
        chrome.tabs.create({ url: url, active: false }, (tab) => {
            let tabId = tab.id;
            let checkCount = 0;
            let checker = setInterval(() => {
                checkCount++;
                if (checkCount > 20) { // 10s timeout
                    clearInterval(checker);
                    try { chrome.tabs.remove(tabId); } catch (e) { }
                    sendResponse({ cash: null, credit: null, error: 'timeout' });
                    return;
                }
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        // Detect login redirect — if page is not payment page, user needs to login
                        if (location.href.includes('/login') || location.href.includes('/sign') ||
                            document.querySelector('[data-testid="login-form"], form[action*="login"]')) {
                            return { error: 'login_required' };
                        }

                        // Helper: extract number from element text
                        function getNum(el) {
                            if (!el) return '';
                            return el.textContent.replace(/[^\d.,]/g, '').trim();
                        }

                        // === TRY PREPAID LAYOUT ===
                        let cashEl = document.querySelector('.payment-balance-left .valid, .payment-balance-item:first-child .valid');
                        let creditEl = document.querySelector('[data-testid="ad-credit"] .valid, .payment-balance-right .valid');

                        // === TRY POSTPAID LAYOUT ===
                        if (!cashEl && !creditEl) {
                            let allText = document.querySelectorAll('.payment-portfolio .valid, .payment-portfolio-card .valid, [class*="portfolio"] .valid');
                            if (allText.length === 0) {
                                let allDivs = document.querySelectorAll('div');
                                for (let d of allDivs) {
                                    let t = (d.textContent || '').trim();
                                    if (t.includes('Available cash balance') || t.includes('Số dư khả dụng') || t.includes('Số dư tiền mặt')) {
                                        let vals = d.parentElement.querySelectorAll('.valid, [class*="value"], [class*="amount"]');
                                        if (vals.length > 0) cashEl = vals[0];
                                    }
                                    if (t.includes('Available ad credit') || t.includes('Tín dụng')) {
                                        let vals = d.parentElement.querySelectorAll('.valid, [class*="value"], [class*="amount"]');
                                        if (vals.length > 0) creditEl = vals[0];
                                    }
                                }
                            } else {
                                cashEl = allText[0] || null;
                                creditEl = allText[1] || null;
                            }
                        }

                        // === BUDGET: Spent / Remaining ===
                        let spent = '', remaining = '';
                        let budgetSection = document.querySelector('.budget-section, [class*="budget"]');
                        if (budgetSection) {
                            let spentEl = budgetSection.querySelector('.spent .value, [class*="spent"] .value, .spent');
                            let remEl = budgetSection.querySelector('.remaining .value, [class*="remaining"] .value, .remaining');
                            if (spentEl) spent = getNum(spentEl);
                            if (remEl) remaining = getNum(remEl);
                        }
                        if (!spent && !remaining) {
                            let allSpans = document.querySelectorAll('div, span');
                            for (let s of allSpans) {
                                let t = (s.textContent || '').trim();
                                if (/^Spent$|^Đã chi$/i.test(t)) {
                                    let next = s.nextElementSibling || s.parentElement.querySelector('[class*="value"]');
                                    if (next) spent = getNum(next);
                                }
                                if (/^Remaining$|^Còn lại$/i.test(t)) {
                                    let next = s.nextElementSibling || s.parentElement.querySelector('[class*="value"]');
                                    if (next) remaining = getNum(next);
                                }
                            }
                        }

                        // === POSTPAY THRESHOLD (trả sau) ===
                        let threshold = '', thresholdSpent = '';
                        // Method 1: CSS selectors (specific TikTok classes)
                        let thresholdEl = document.querySelector('.otrade-next-billing-date-line-item-threshold-spend');
                        if (thresholdEl) {
                            let thresholdSpan = thresholdEl.querySelector('span[data-testid*="billing-date-span"]') || thresholdEl.querySelector('span');
                            if (thresholdSpan) threshold = getNum(thresholdSpan);
                        }
                        let thresholdSpentEl = document.querySelector('.otrade-next-billing-date-line-item-threshold-spending');
                        if (thresholdSpentEl) {
                            let spentSpan = thresholdSpentEl.querySelector('span[data-testid*="billing-date-span"]') || thresholdSpentEl.querySelector('span');
                            if (spentSpan) thresholdSpent = getNum(spentSpan);
                        }

                        // Method 2: Broader CSS selectors
                        if (!threshold) {
                            let allBillingItems = document.querySelectorAll('[class*="billing-date"], [class*="threshold"], [class*="next-billing"]');
                            for (let el of allBillingItems) {
                                let spans = el.querySelectorAll('span');
                                for (let s of spans) {
                                    let num = (s.textContent || '').replace(/[^\d]/g, '');
                                    if (num && Number(num) > 100000) {
                                        if (!threshold) threshold = s.textContent.trim();
                                        else if (!thresholdSpent) thresholdSpent = s.textContent.trim();
                                    }
                                }
                            }
                        }

                        // Method 3: Regex on page text (most robust fallback)
                        if (!threshold) {
                            let bodyText = document.body.innerText || '';
                            // English: "reaches 7,576,320 VND" or "reaches ₫7,576,320"
                            let matchEN = bodyText.match(/reaches\s+([\d,.\s]+)\s*(VND|₫|đ)/i);
                            // Vietnamese: "đạt 7.576.320 VND" or "đạt 7.576.320 đ"
                            let matchVI = bodyText.match(/đạt\s+([\d,.\s]+)\s*(VND|₫|đ)/i);
                            let matchGeneric = bodyText.match(/(?:threshold|ngưỡng)[^\d]*([\d,.\s]+)\s*(VND|₫|đ)/i);
                            let bestMatch = matchEN || matchVI || matchGeneric;
                            if (bestMatch) {
                                threshold = bestMatch[1].trim();
                            }
                            // Spent: "Spending to date: 762,637 VND" or "Chi tiêu tính đến nay: 762.637"
                            let spentEN = bodyText.match(/spending\s+to\s+date[^\d]*([\d,.\s]+)\s*(VND|₫|đ)/i);
                            let spentVI = bodyText.match(/chi\s+tiêu\s+tính\s+đến\s+nay[^\d]*([\d,.\s]+)\s*(VND|₫|đ)/i);
                            let spentMatch = spentEN || spentVI;
                            if (spentMatch && !thresholdSpent) {
                                thresholdSpent = spentMatch[1].trim();
                            }
                        }

                        if (!cashEl && !creditEl && !spent && !remaining && !threshold && !thresholdSpent) return null;
                        return {
                            cash: getNum(cashEl),
                            credit: getNum(creditEl),
                            spent: spent,
                            remaining: remaining,
                            threshold: threshold,
                            thresholdSpent: thresholdSpent
                        };
                    }
                }).then(results => {
                    if (results && results[0] && results[0].result) {
                        let data = results[0].result;
                        // Login required — close tab and report
                        if (data.error === 'login_required') {
                            clearInterval(checker);
                            try { chrome.tabs.remove(tabId); } catch (e) { }
                            sendResponse({ cash: null, credit: null, error: 'login_required' });
                            return;
                        }
                        clearInterval(checker);
                        try { chrome.tabs.remove(tabId); } catch (e) { }
                        sendResponse(data);
                    }
                }).catch(err => {
                    // Page not ready yet, keep trying
                });
            }, 500);
        });
        return true; // async
    }
    // === PROXY: Fetch from shop.tiktok.com for LIVE Level 3 APIs ===
    if (request.action === "fetch_shop_api") {
        let { url, method, body } = request;
        if (!url) { sendResponse({ error: 'no url' }); return true; }

        // Must manually get cookies — service worker has no cookie jar
        (async () => {
            try {
                // Get all cookies for shop.tiktok.com
                let cookies = await chrome.cookies.getAll({ url: 'https://shop.tiktok.com' });
                let cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
                let bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

                console.log('[STRANGE TTS BG] Request:', url.split('?')[0].split('/').slice(-2).join('/'),
                    'cookies:', cookies.length, 'bodyLen:', bodyStr.length);

                let resp = await fetch(url, {
                    method: method || 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'Content-Type': 'application/json',
                        'Cookie': cookieStr
                    },
                    body: bodyStr || undefined
                });

                let text = await resp.text();
                console.log('[STRANGE TTS BG] Response:', resp.status, 'len:', text.length, text.substring(0, 150));

                try {
                    let json = JSON.parse(text);
                    sendResponse({ success: true, data: json, status: resp.status });
                } catch (e) {
                    sendResponse({ error: 'non-JSON', status: resp.status, body: text.substring(0, 200) });
                }
            } catch (err) {
                console.warn('[STRANGE TTS BG] proxy error:', err.message);
                sendResponse({ error: err.message });
            }
        })();
        return true;
    }
    // === PROXY: Send Telegram message from background (guaranteed CORS) ===
    if (request.action === "send_telegram") {
        let { bot_token, chat_id, message_thread_id, text, parse_mode } = request;
        // Aggressive cleaning: Remove all spaces
        if (bot_token) bot_token = bot_token.replace(/\s/g, '');
        if (chat_id) chat_id = String(chat_id).replace(/\s/g, '');
        if (message_thread_id !== undefined && message_thread_id !== null) {
            message_thread_id = String(message_thread_id).replace(/\s/g, '');
            if (!message_thread_id) message_thread_id = undefined;
        }

        if (!bot_token || !chat_id || !text) {
            sendResponse({ ok: false, error: 'missing params' });
            return true;
        }
        const payload = { chat_id, text, parse_mode: parse_mode || 'HTML' };
        if (message_thread_id !== undefined) {
            const parsedThreadId = Number(message_thread_id);
            if (Number.isFinite(parsedThreadId) && parsedThreadId > 0) {
                payload.message_thread_id = parsedThreadId;
            }
        }
        fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(r => r.json())
            .then(json => {
                console.log('[STRANGE TTS BG] Telegram send:', json.ok ? 'OK' : 'FAIL', json.description || '');
                sendResponse(json);
            })
            .catch(err => {
                console.error('[STRANGE TTS BG] Telegram error:', err.message);
                sendResponse({ ok: false, error: err.message });
            });
        return true;
    }
    // === PROXY: Poll Telegram getUpdates from background ===
    if (request.action === "poll_telegram") {
        let { bot_token, offset } = request;
        if (!bot_token) { sendResponse({ ok: false }); return true; }
        let url = `https://api.telegram.org/bot${bot_token}/getUpdates?timeout=5&allowed_updates=["message"]`;
        if (offset) url += `&offset=${offset}`;
        fetch(url)
            .then(r => r.json())
            .then(json => sendResponse(json))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }
    if (request.action === 'send_quick_recap_now') {
        bgRunQuickRecap({ force: true }).then(sendResponse).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }
    // === RELAY: Poll backend for commands ===
    if (request.action === "poll_relay") {
        let { relay_url, device_id, secret } = request;
        if (!relay_url) { sendResponse({ ok: false, error: 'no relay_url' }); return true; }
        let url = `${relay_url}/commands/pull?device_id=${encodeURIComponent(device_id || 'default')}`;
        if (secret) url += `&secret=${encodeURIComponent(secret)}`;
        fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(r => r.json())
            .then(json => {
                if (json.commands?.length) console.log('[STRANGE TTS BG] Relay:', json.commands.length, 'command(s) received');
                sendResponse(json);
            })
            .catch(err => {
                console.error('[STRANGE TTS BG] Relay poll error:', err.message);
                sendResponse({ ok: false, error: err.message });
            });
        return true;
    }
    // === RELAY: Report command result to backend ===
    if (request.action === "report_result") {
        let { relay_url, secret, result } = request;
        if (!relay_url || !result) { sendResponse({ ok: false, error: 'missing params' }); return true; }
        fetch(`${relay_url}/commands/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Device-Secret': secret || '' },
            body: JSON.stringify({ ...result, secret })
        })
            .then(r => r.json())
            .then(json => {
                console.log('[STRANGE TTS BG] Relay result reported:', json.ok ? 'OK' : 'FAIL');
                sendResponse(json);
            })
            .catch(err => {
                console.error('[STRANGE TTS BG] Relay report error:', err.message);
                sendResponse({ ok: false, error: err.message });
            });
        return true;
    }
    // === EXPORT SHOP: Capture cookies + IDs for multi-shop dashboard ===
    if (request.action === "export_shop_plain_safe") {
        let { oec_seller_id, seller_id } = request;
        const sellerIdForExport = oec_seller_id || seller_id || '';
        if (!sellerIdForExport) { sendResponse({ success: false, error: 'no seller_id' }); return true; }
        (async () => {
            try {
                console.log('[Strange TTS BG] Safe plain export start:', sellerIdForExport);
                await bgWarmAdsCookiesFromSeller({
                    aadvid: request.aadvid || '',
                    reason: 'export_shop_plain_safe',
                    maxWaitMs: request.adsWarmupMs || 18000,
                    active: request.showAdsWarmupTab === true
                });
                const cookies = await bgCollectTikTokCookiesSafe();
                const metadata = { adsAccounts: [], shopMeta: { source: 'plain_safe_export' } };
                const shopData = bgBuildExportShopData(request, cookies, metadata);
                console.log('[Strange TTS BG] Safe plain export done:', shopData.shop.name, '| cookies:', cookies.length);
                sendResponse({ success: true, data: shopData, plainSafe: true });
            } catch (err) {
                console.error('[Strange TTS BG] Safe plain export error:', err);
                sendResponse({ success: false, error: err.message || 'Lỗi lấy Cookie safe' });
            }
        })();
        return true;
    }
    if (request.action === "export_shop") {
        let { aadvid, oec_seller_id, seller_id, bc_id, shopName, uid, shopAvatar, shopRealName } = request;
        const sellerIdForExport = oec_seller_id || seller_id || '';
        if (!sellerIdForExport) { sendResponse({ error: 'no seller_id' }); return true; }
        (async () => {
            try {
                console.log('[Strange TTS BG] Export shop start:', sellerIdForExport, '| skipMetadata:', !!request.skipMetadata);
                await bgWarmAdsCookiesFromSeller({
                    aadvid,
                    reason: 'export_shop',
                    maxWaitMs: request.adsWarmupMs || 18000,
                    active: request.showAdsWarmupTab === true
                });
                const cookies = await bgCollectTikTokCookiesSafe();
                const emptyMetadata = { adsAccounts: [], shopMeta: { source: 'metadata_skipped_or_timeout' } };
                const metadata = request.skipMetadata
                    ? emptyMetadata
                    : await bgWithTimeout(bgFetchSellerExportMetadata(sellerIdForExport, aadvid), 3500, emptyMetadata);
                const shopData = bgBuildExportShopData(request, cookies, metadata);
                console.log('[Strange TTS BG] Export shop:', shopData.shop.name, '| seller:', sellerIdForExport, '| ads_accounts:', shopData.ads_accounts.length, '| cookies:', shopData.cookies.length);
                sendResponse({ success: true, data: shopData });
            } catch (err) {
                console.error('[Strange TTS BG] Export error:', err);
                sendResponse({ success: false, error: err.message || 'Lỗi lấy Cookie' });
            }
        })();
        return true;
    }
    if (request.action === "fetch_multi_shop") {
        let { shop } = request;
        if (!shop || !shop.aadvid) { sendResponse({ error: 'no shop data' }); return true; }
        const needAccountInfo = request.fetchOptions?.needAccountInfo !== false;
        let cookies = shop.cookies || [];
        let aadvid = shop.aadvid;
        let sellerId = shop.oec_seller_id || shop.seller_id || '';
        let bcId = shop.bc_id || '';
        if (!sellerId) console.warn(`[Strange TTS BG] ⚠️ Shop ${shop.name}: oec_seller_id rỗng → không thể fetch camp data`);

        (async () => {
            try {
                shop = await bgRefreshShopCookiesFromServer(shop, { force: false, reason: 'fetch_multi_shop' });
                cookies = shop.cookies || [];
                aadvid = shop.aadvid || aadvid;
                sellerId = shop.oec_seller_id || shop.seller_id || sellerId;
                bcId = shop.bc_id || bcId;
                // Auto-clean before each fetch to ensure fresh context
                await cleanTikTokCookies();
                // === STEP 1: Inject stored cookies into browser cookie jar ===
                // Cookie header is FORBIDDEN in fetch() — browsers strip it silently.
                // We must inject cookies via chrome.cookies.set() then use credentials:'include'
                let injected = 0;
                for (let c of cookies) {
                    try {
                        let cookieDomain = c.domain || '.tiktok.com';
                        // Determine the URL for this cookie
                        let scheme = 'https';
                        let cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
                        let url = `${scheme}://${cleanDomain}${c.path || '/'}`;

                        await chrome.cookies.set({
                            url: url,
                            name: c.name,
                            value: c.value,
                            domain: cookieDomain,
                            path: c.path || '/',
                            secure: true,
                            sameSite: 'no_restriction'
                        });
                        injected++;
                    } catch (e) {
                        // Some cookies may fail (httpOnly restrictions etc) — skip
                    }
                }
                console.log(`[Strange TTS BG] Injected ${injected}/${cookies.length} cookies for ${shop.name}`);

                // === STEP 2: Fetch data with credentials:'include' ===
                let now = new Date();
                let vnDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
                let hdrs = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json' };

                let balanceUrl = `https://ads.tiktok.com/api/v3/i18n/statistics/transaction/balance/query/?aadvid=${aadvid}&source=3&req_src=bidding`;
                let billingUrl = `https://ads.tiktok.com/pa/api/spider/query_payment_account/?aadvid=${aadvid}`;
                let dueDateUrl = `https://ads.tiktok.com/pa/api/common/show/payment/query_due_date?aadvid=${aadvid}`;
                let overviewUrl = sellerId ? `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_overview_stat?locale=vi&language=vi&oec_seller_id=${sellerId}&aadvid=${aadvid}${bcId ? '&bc_id=' + bcId : ''}` : null;
                let campaignUrl = sellerId ? `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_campaign_list?locale=vi&language=vi&oec_seller_id=${sellerId}&aadvid=${aadvid}${bcId ? '&bc_id=' + bcId : ''}` : null;

                let overviewBody = {
                    // API TikTok trả đúng số với same-date range (xác nhận thực tế)
                    start_time: vnDate, end_time: vnDate,
                    query_list: ["cost", "onsite_roi2_shopping_sku", "cost_per_onsite_roi2_shopping_sku", "onsite_roi2_shopping_value", "onsite_roi2_shopping"],
                    campaign_shop_automation_type: 2,
                    external_type_list: ["307", "304", "305"]
                };
                let campaignBody = {
                    query_list: ["campaign_name", "campaign_primary_status", "campaign_status", "campaign_target_roi_budget", "cost",
                        "template_ad_roas_bid", "onsite_roi2_shopping_sku", "cost_per_onsite_roi2_shopping_sku",
                        "onsite_roi2_shopping_value", "onsite_roi2_shopping", "billed_cost"],
                    campaign_shop_automation_type: 2,
                    // delivery_ok = đang chạy, campaign_not_delivery = gồm frozen/schedule/budget_exceed
                    // Không trỳn sub-status vào đây — API chỉ nhận 2 giá trị này
                    campaign_status: ["delivery_ok", "campaign_not_delivery"],
                    start_time: vnDate, end_time: vnDate,
                    external_type_list: ["307", "304", "305"],
                    keyword: "", keyword_type: 0, order_field: "cost", order_type: 1,
                    page: 1, page_size: 200  // Tăng lên 200 — dự phòng shop có ~100 camp
                };

                const accountInfoTimeoutMs = 12000;
                let fetches = [
                    needAccountInfo ? bgFetchJsonWithTimeout(balanceUrl, { headers: hdrs, credentials: 'include' }, accountInfoTimeoutMs, `dashboard_balance:${aadvid}`) : Promise.resolve(null),
                    // STRANGE TTS V30.2: GET request cho query_payment_account (khác với POST của billing cũ)
                    needAccountInfo ? bgFetchJsonWithTimeout(billingUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'include' }, accountInfoTimeoutMs, `dashboard_payment_account:${aadvid}`) : Promise.resolve(null),
                    needAccountInfo ? bgFetchJsonWithTimeout(dueDateUrl, { method: 'POST', headers: { ...hdrs, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } }) }, accountInfoTimeoutMs, `dashboard_duedate:${aadvid}`) : Promise.resolve(null),
                ];
                if (overviewUrl) {
                    fetches.push(fetch(overviewUrl, { method: 'POST', headers: hdrs, credentials: 'include', body: JSON.stringify(overviewBody) }).then(r => r.json()).catch(e => ({ error: e.message })));
                }
                if (campaignUrl) {
                    fetches.push(fetch(campaignUrl, { method: 'POST', headers: hdrs, credentials: 'include', body: JSON.stringify(campaignBody) }).then(r => r.json()).catch(e => ({ error: e.message })));
                    // Also fetch LIVE campaigns
                    let liveCampBody = { ...campaignBody, external_type_list: ["306"] };
                    fetches.push(fetch(campaignUrl, { method: 'POST', headers: hdrs, credentials: 'include', body: JSON.stringify(liveCampBody) }).then(r => r.json()).catch(e => ({ error: e.message })));
                }

                let results = await Promise.allSettled(fetches);
                let result = { shopName: shop.name, aadvid: aadvid };
                const sellerSessionOk = [3, 4, 5].some(idx => {
                    const payload = results[idx]?.status === 'fulfilled' ? results[idx].value : null;
                    return bgIsTikTokApiOk(payload);
                });

                // Số dư/ngưỡng chỉ lấy từ TK chính. TK phụ khi gọi fetch_multi_shop sẽ truyền needAccountInfo=false.
                let bal = results[0]?.status === 'fulfilled' ? results[0].value : null;
                let bill = results[1]?.status === 'fulfilled' ? results[1].value : null;
                let dd = results[2]?.status === 'fulfilled' ? results[2].value : null;
                bgApplyAdsAccountFinanceInfo(result, bgParseAdsAccountFinanceInfo({
                    balanceJson: bal,
                    dueDateJson: dd,
                    paymentAccountJson: bill
                }));
                if (needAccountInfo && !result._balanceLoaded) {
                    const retryInfo = await bgFetchAdsAccountFinanceInfo(aadvid, hdrs, 12000, 'dashboard_account_retry');
                    bgApplyAdsAccountFinanceInfo(result, retryInfo);
                }
                if (needAccountInfo && !result._balanceLoaded) {
                    if (!sellerSessionOk) {
                        console.warn(`[Strange TTS BG] Seller session also failed for ${shop.name}; skip Ads cookie warmup.`);
                        result._warnAccount = 'Seller cookie hết hạn, bỏ qua phục hồi Ads cookie';
                    } else {
                        console.warn(`[Strange TTS BG] Ads finance fail for ${shop.name}, warming ads.tiktok.com cookies...`);
                        const warmed = await bgWarmAdsCookiesForShop(shop, 'fetch_multi_shop_ads_fail', { maxWaitMs: 18000 });
                        shop = warmed.shop || shop;
                        cookies = shop.cookies || cookies;
                        const warmRetryInfo = await bgFetchAdsAccountFinanceInfo(aadvid, hdrs, 12000, 'dashboard_account_after_ads_warmup');
                        bgApplyAdsAccountFinanceInfo(result, warmRetryInfo);
                        if (warmRetryInfo._accountInfoLoaded) result._adsCookieWarmup = true;
                    }
                }

                // Overview stats — dùng statistics.cost làm nguồn chính xác cho CHI TIÊU
                // (campaign list chỉ có delivery_ok → bỏ sót campaign đã pause nhưng vẫn có chi tiêu)
                if (results[3]) {
                    let ov = results[3]?.status === 'fulfilled' ? results[3].value : null;
                    if (ov && ov.code === 0 && ov.data) {
                        result.overview = ov.data;
                        // Lấy luôn tổng cost/gmv/orders từ overview (chính xác nhất)
                        let st = ov.data.statistics || {};
                        result.totalCost = Number(st.cost || 0);
                        result.totalGmv = Number(st.onsite_roi2_shopping_value || 0);
                        result.totalOrders = Number(st.onsite_roi2_shopping_sku || 0);
                    }
                }

                // Campaigns (product) — có pagination loop để load hết
                if (results[4]) {
                    let camp = results[4]?.status === 'fulfilled' ? results[4].value : null;
                    if (camp && camp.code === 0 && camp.data) {
                        if (result.totalCost == null) { result.totalCost = 0; result.totalGmv = 0; result.totalOrders = 0; }
                        result.campaigns = [];

                        // Helper map campaigns table
                        const mapCamp = (c, type) => {
                            let cost = Number(c.cost || 0);
                            let gmv = Number(c.onsite_roi2_shopping_value || 0);
                            let orders = Number(c.onsite_roi2_shopping_sku || 0);
                            return {
                                id: c.campaign_id || c.id || '',
                                name: (type === 'live' ? '📺 ' : '') + (c.campaign_name || c.campaign_id || c.id || ''),
                                status: c.campaign_primary_status || c.campaign_status || '',
                                cost, gmv, orders,
                                roi: cost > 0 ? (gmv / cost).toFixed(2) : '0',
                                cpo: orders > 0 ? Math.round(cost / orders) : 0,
                                budget: Number(c.campaign_target_roi_budget || 0),
                                targetRoi: Number(c.template_ad_roas_bid || 0),
                                billedCost: Number(c.billed_cost || 0),
                                type
                            };
                        };

                        (camp.data.table || []).forEach(c => result.campaigns.push(mapCamp(c, 'product')));

                        // === Pagination: tải thêm nếu có nhiều trang ===
                        let pagination = camp.data.pagination;
                        if (pagination && pagination.page_count > 1 && campaignUrl) {
                            for (let p = 2; p <= pagination.page_count; p++) {
                                try {
                                    let pageBody = { ...campaignBody, page: p };
                                    let pageRes = await fetch(campaignUrl, { method: 'POST', headers: hdrs, credentials: 'include', body: JSON.stringify(pageBody) });
                                    let pageJson = await pageRes.json();
                                    if (pageJson && pageJson.code === 0 && pageJson.data && pageJson.data.table) {
                                        pageJson.data.table.forEach(c => result.campaigns.push(mapCamp(c, 'product')));
                                    }
                                } catch (e) { console.warn('[Strange TTS] Campaign pagination error p' + p, e.message); }
                            }
                        }
                    }
                }
                // Campaigns (LIVE) — cộng thêm vào result.campaigns
                if (results[5]) {
                    let camp = results[5]?.status === 'fulfilled' ? results[5].value : null;
                    if (camp && camp.code === 0 && camp.data) {
                        if (!result.campaigns) result.campaigns = [];
                        if (result.totalCost == null) { result.totalCost = 0; result.totalGmv = 0; result.totalOrders = 0; }
                        (camp.data.table || []).forEach(c => {
                            let cost = Number(c.cost || 0);
                            let gmv = Number(c.onsite_roi2_shopping_value || 0);
                            let orders = Number(c.onsite_roi2_shopping_sku || 0);
                            result.totalCost += cost;
                            result.totalGmv += gmv;
                            result.totalOrders += orders;
                            result.campaigns.push({
                                id: c.campaign_id || c.id || '',
                                name: '📺 ' + (c.campaign_name || c.campaign_id || c.id || ''),
                                status: c.campaign_primary_status || c.campaign_status || '',
                                cost, gmv, orders,
                                roi: cost > 0 ? (gmv / cost).toFixed(2) : '0',
                                cpo: orders > 0 ? Math.round(cost / orders) : 0,
                                budget: Number(c.campaign_target_roi_budget || 0),
                                targetRoi: Number(c.template_ad_roas_bid || 0),
                                billedCost: Number(c.billed_cost || 0),
                                type: 'live'
                            });
                        });
                    }
                }
                // Finalize totals
                if (result.totalCost != null) {
                    result.roi = result.totalCost > 0 ? (result.totalGmv / result.totalCost).toFixed(2) : '0';
                    result.cpo = result.totalOrders > 0 ? Math.round(result.totalCost / result.totalOrders) : 0;
                    result.campaignCount = (result.campaigns || []).length;
                }

                result.fetchedAt = Date.now();
                result.status = (result.balance != null || result.totalCost != null) ? 'ok' : 'error';
                if (!sellerId) result.missingIds = 'oec_seller_id (cần xuất lại trên trang Ads)';
                if (result.status === 'error') result.error = 'API không trả data — cookie có thể đã hết hạn';
                console.log('[Strange TTS BG] Multi-shop fetch:', shop.name, result.status, `(injected ${injected} cookies, sellerId=${sellerId || 'EMPTY'})`);
                sendResponse(result);
            } catch (err) {
                console.error('[Strange TTS BG] Multi-shop error:', err);
                sendResponse({ status: 'error', error: err.message });
            }
        })();
        return true;
    }
    // === FETCH SHOP REPORT DATA (Báo cáo doanh thu Zalo) ===
    // === REFACTORED: UNIFIED SHOP FETCH HANDLER ===
    if (request.action === "fetch_shop_report") {
        // isManual=true: Báo scheduler biết đang có người dùng load thủ công → scheduler sẽ bỏ qua
        executeCompleteShopFetch(request.shop, request.timeoutMs, true, request.fetchOptions || { needCampaigns: false }).then(sendResponse);
        return true;
    }

    // === PUSH DATA TO GOOGLE SHEETS VIA APPS SCRIPT ===
    if (request.action === 'push_to_sheets') {
        const { url, payload } = request;
        if (!url) { sendResponse({ ok: false, error: 'no url' }); return true; }
        (async () => {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const text = await res.text();
                let json; try { json = JSON.parse(text); } catch { json = { ok: true, raw: text }; }
                sendResponse(json);
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    }

    // === EDIT CAMPAIGN FROM MULTI-SHOP DASHBOARD ===

    if (request.action === "edit_campaign_multi") {
        let { shop, campaignId, newBudget, newRoi } = request;
        if (!shop || !shop.aadvid || !campaignId) { sendResponse({ error: 'missing params' }); return true; }
        let cookies = shop.cookies || [];
        let aadvid = shop.aadvid;
        let sellerId = shop.oec_seller_id || shop.seller_id || '';
        let bcId = shop.bc_id || '';
        if (!sellerId) { sendResponse({ error: 'missing oec_seller_id' }); return true; }

        (async () => {
            try {
                shop = await bgRefreshShopCookiesFromServer(shop, { force: false, reason: 'edit_campaign' });
                cookies = shop.cookies || [];
                aadvid = shop.aadvid || aadvid;
                sellerId = shop.oec_seller_id || shop.seller_id || sellerId;
                bcId = shop.bc_id || bcId;
                // === STEP 0: Clear ALL existing TikTok cookies first ===
                let domains = ['https://seller-vn.tiktok.com', 'https://seller.tiktok.com', 'https://ads.tiktok.com', 'https://business.tiktok.com', 'https://shop.tiktok.com'];
                let cleared = 0;
                for (let domainUrl of domains) {
                    try {
                        let existing = await chrome.cookies.getAll({ url: domainUrl });
                        for (let c of existing) {
                            try { await chrome.cookies.remove({ url: domainUrl + c.path, name: c.name }); cleared++; } catch (e) { }
                        }
                    } catch (e) { }
                }
                try {
                    let dotCookies = await chrome.cookies.getAll({ domain: '.tiktok.com' });
                    for (let c of dotCookies) {
                        try {
                            let cUrl = `https://${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}${c.path || '/'}`;
                            await chrome.cookies.remove({ url: cUrl, name: c.name }); cleared++;
                        } catch (e) { }
                    }
                } catch (e) { }
                console.log(`[Strange TTS BG] 🧹 Cleared ${cleared} old cookies before editing ${shop.name}`);

                // Step 1: Inject cookies
                for (let c of cookies) {
                    try {
                        let cookieDomain = c.domain || '.tiktok.com';
                        let cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
                        let url = `https://${cleanDomain}${c.path || '/'}`;
                        await chrome.cookies.set({
                            url: url, name: c.name, value: c.value,
                            domain: cookieDomain, path: c.path || '/',
                            secure: true, sameSite: 'no_restriction'
                        });
                    } catch (e) { }
                }

                // Add a small delay for cookies to propagate
                await new Promise(r => setTimeout(r, 800));

                // Step 2: Fetch campaign detail to get full payload
                let detailUrl = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/creation/all_ad_data/detail?locale=vi&language=vi&oec_seller_id=${sellerId}&aadvid=${aadvid}&campaign_id=${campaignId}${bcId ? '&bc_id=' + bcId : ''}`;
                let detailRes = await fetch(detailUrl, {
                    method: 'GET', credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });

                let detailText = await detailRes.text();
                let detailJson;
                try {
                    detailJson = JSON.parse(detailText);
                } catch (e) {
                    sendResponse({ error: 'detail_fail', msg: 'Not JSON: ' + detailText });
                    return;
                }

                if (!detailJson || detailJson.code !== 0 || !detailJson.data) {
                    sendResponse({ error: 'detail_fail', msg: detailJson?.msg || 'Unknown API Error' });
                    return;
                }

                // Step 3: Build update payload from detail
                let rawBody = detailJson.data;
                let ci = rawBody.campaign_info || {};
                let ai = rawBody.ad_info || {};

                let finalBudget = newBudget != null ? newBudget : Number(ai.budget || ci.budget || 0);
                let finalRoi = newRoi != null ? newRoi : Number(ai.roas_bid || 0);
                let finalBudgetNum = parseInt(String(finalBudget || '').replace(/[^\d]/g, ''), 10) || 0;
                let finalRoiNum = parseFloat(String(finalRoi || '').replace(/,/g, '.')) || 0;

                // Rebuild Campaign Name logic like content.js:
                // new format = first 50 chars of product name + API-E tag + suffix.
                let oldName = ci.campaign_name || ci.name || '';
                const STRANGETTS_NAME_SUFFIX_BG = ' - By Strange TTSAgency.vn';
                const STRANGETTS_PRODUCT_NAME_PREFIX_MAX_BG = 50;

                let strangettsShortVN = (num) => {
                    if (!num || num <= 0) return '-';
                    if (num >= 1000000) {
                        let tr = Math.floor(num / 1000000);
                        let remainder = Math.round((num % 1000000) / 100000);
                        return remainder > 0 ? tr + 'tr' + remainder : tr + 'tr';
                    }
                    if (num >= 1000) return Math.round(num / 1000) + 'K';
                    return Math.round(num).toString();
                };
                let cleanProductName = (name) => {
                    let s = String(name || '').replace(/\s+/g, ' ').trim();
                    s = s.replace(/\s*-?\s*By Strange TTSAgency\.vn\s*$/i, '').trim();
                    s = s.replace(/\s*\[API-[SE]-[^\]]+\]\s*/gi, ' ').replace(/\s+/g, ' ').trim();
                    s = s.replace(/^ST\.?\s*AI?\s*/i, '');
                    s = s.replace(/^[\d.]+\s+/, '');
                    s = s.replace(/\s*(ED\s+)?(up\s+)?\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/gi, ' ');
                    return s.replace(/\s+/g, ' ').replace(/^[\s\-–—|·]+|[\s\-–—|·]+$/g, '').trim();
                };
                let smartTruncate = (text, maxLen) => {
                    text = String(text || '').replace(/\s+/g, ' ').trim();
                    if (text.length <= maxLen) return text;
                    return text.substring(0, maxLen).trim();
                };

                let now = new Date();
                let dd = String(now.getDate()).padStart(2, '0');
                let mm = String(now.getMonth() + 1).padStart(2, '0');
                let hh = String(now.getHours()).padStart(2, '0');
                let mi = String(now.getMinutes()).padStart(2, '0');

                let budgetTag = strangettsShortVN(finalBudgetNum);
                let roundRoi = Math.round(finalRoiNum * 10) / 10;
                let spMatch = oldName.match(/\[API-[SE]-[^\]]*?-(\d+SP)-[^\]]*\]/i);
                let spCountPart = spMatch ? `-${spMatch[1]}` : '';
                let tag = `[API-E-${budgetTag}-R${roundRoi}${spCountPart}-${dd}/${mm} ${hh}:${mi}]`;
                let spName = smartTruncate(cleanProductName(oldName) || 'Sản phẩm', STRANGETTS_PRODUCT_NAME_PREFIX_MAX_BG);
                let newCampName = `${spName} ${tag}${STRANGETTS_NAME_SUFFIX_BG}`;

                rawBody.campaign_info = {
                    campaign_id: String(campaignId),
                    campaign_name: newCampName,
                    budget_mode: ci.budget_mode != null ? ci.budget_mode : -1,
                    budget: String(finalBudgetNum || finalBudget),
                    shop_automation_type: ci.shop_automation_type || 2
                };

                ai.name = newCampName;
                ai.roas_bid = String(finalRoiNum || finalRoi);
                ai.budget = String(finalBudgetNum || finalBudget);
                ai.campaign_id = String(campaignId);
                ai.external_type = 0;
                ai.external_action = 0;
                if (ai.schedule_type !== 2) delete ai.end_time;
                delete ai.classify;
                delete ai.shopping_identity_list;
                delete ai.custom_anchor_video_ref_id;
                delete ai.gmv_max_flow_type;
                if (ai.product_bid_type == null) ai.product_bid_type = 0;
                if (ai.product_specific_type == null) ai.product_specific_type = 3;
                if (ai.product_source == null) ai.product_source = 2;
                if (!ai.custom_anchor_videos) ai.custom_anchor_videos = [];
                if (!ai.shop_video_filters) ai.shop_video_filters = [];
                if (!ai.pre_item_list) ai.pre_item_list = [];
                // Sync promotion_days_setting
                if (ai.promotion_days_setting) {
                    let pds = ai.promotion_days_setting;
                    pds.benchmark_roas_bid = finalRoiNum || finalRoi;
                    let budgetMul = parseInt(pds.budget_multiplier) || 100;
                    pds.adjusted_budget = Math.round((finalBudgetNum || finalBudget) * budgetMul / 100);
                    if (pds.roas_bid_multiplier) {
                        let roasMul = parseInt(pds.roas_bid_multiplier) || 100;
                        pds.adjusted_roas_bid = parseFloat(((finalRoiNum || finalRoi) * roasMul / 100).toFixed(1));
                    }
                }
                if (ai.gmax_budget_adjust_setting) {
                    ai.gmax_budget_adjust_setting.effective_budget = finalBudgetNum || finalBudget;
                }
                rawBody.ad_info = ai;
                if (!rawBody.risk_info) {
                    rawBody.risk_info = {
                        cookie_enabled: true, screen_width: 1680, screen_height: 1050,
                        browser_language: "vi-VN", browser_platform: "MacIntel",
                        browser_name: "Mozilla", browser_version: "5.0",
                        browser_online: true, timezone_name: "Asia/Ho_Chi_Minh"
                    };
                }

                // Step 4: Send update
                let updateUrl = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/creation/all_ad_data/update?locale=vi&language=vi&oec_seller_id=${sellerId}&aadvid=${aadvid}${bcId ? '&bc_id=' + bcId : ''}`;
                let updateRes = await fetch(updateUrl, {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(rawBody)
                });
                let updateText = await updateRes.text();
                let updateJson;
                try {
                    updateJson = JSON.parse(updateText);
                } catch (e) {
                    sendResponse({ error: 'update_fail', msg: 'Not JSON: ' + updateText });
                    return;
                }

                if (updateJson.code === 0) {
                    try {
                        let stored = await new Promise(r => chrome.storage.local.get(['tt_campaign_name_edit_times'], r));
                        let editMap = stored.tt_campaign_name_edit_times || {};
                        editMap[String(campaignId)] = { ts: Date.now(), name: newCampName, savedAt: Date.now(), source: 'dashboard' };
                        await new Promise(r => chrome.storage.local.set({ tt_campaign_name_edit_times: editMap }, r));
                    } catch (e) { console.warn('[Strange TTS BG] save edit time failed:', e); }
                    console.log('[Strange TTS BG] ✅ Campaign edited:', campaignId, 'budget:', finalBudgetNum || finalBudget, 'roi:', finalRoiNum || finalRoi);
                    sendResponse({ success: true, budget: finalBudgetNum || finalBudget, roi: finalRoiNum || finalRoi, name: newCampName });
                } else {
                    console.error('[Strange TTS BG] ❌ Edit failed:', updateJson);
                    sendResponse({ error: 'update_fail', code: updateJson.code, msg: updateJson.msg });
                }
            } catch (err) {
                console.error('[Strange TTS BG] Edit error:', err);
                sendResponse({ error: err.message });
            }
        })();
        return true;
    }
    // === OPEN SHOP DASHBOARD: Inject cookies + open seller page ===
    if (request.action === "open_shop_dash") {
        let { shop } = request;
        if (!shop || !shop.aadvid) { sendResponse({ error: 'no shop' }); return true; }
        let cookies = shop.cookies || [];
        (async () => {
            try {
                shop = await bgRefreshShopCookiesFromServer(shop, { force: false, reason: 'open_shop' });
                cookies = shop.cookies || [];
                await cleanTikTokCookies();
                // === STEP 1: Inject new shop cookies ===

                // === STEP 1: Inject new shop cookies ===
                let injected = 0;
                for (let c of cookies) {
                    try {
                        let cookieDomain = c.domain || '.tiktok.com';
                        let cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
                        let url = `https://${cleanDomain}${c.path || '/'}`;
                        await chrome.cookies.set({
                            url: url, name: c.name, value: c.value,
                            domain: cookieDomain, path: c.path || '/',
                            secure: true, sameSite: 'no_restriction'
                        });
                        injected++;
                    } catch (e) { }
                }
                console.log(`[Strange TTS BG] Injected ${injected} cookies for ${shop.name}, opening seller page...`);

                // Open seller-vn ads dashboard or targetUrl
                let now = new Date();
                let startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
                let endTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
                let dashUrl = request.targetUrl || `https://seller-vn.tiktok.com/ads-creation/dashboard?type=product&shop_region=VN&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${startTs}&list_end_date=${endTs}`;

                chrome.tabs.create({ url: dashUrl, active: request.noFocus ? false : true }, (tab) => {
                    if (tab && request.noFocus) {
                        // Store the tabId so we can close it later
                        if (!globalThis.warmupTabs) globalThis.warmupTabs = {};
                        globalThis.warmupTabs[shop.aadvid] = tab.id;
                    }
                });
                sendResponse({ success: true, injected });
            } catch (err) {
                sendResponse({ error: err.message });
            }
        })();
        return true;
    }
    // === CLOSE SHOP TAB after warmup ===
    if (request.action === "close_shop_tab") {
        let { aadvid } = request;
        if (globalThis.warmupTabs && globalThis.warmupTabs[aadvid]) {
            chrome.tabs.remove(globalThis.warmupTabs[aadvid]);
            delete globalThis.warmupTabs[aadvid];
        } else {
            // Fallback: search for tabs with this aadvid in URL
            chrome.tabs.query({}, (tabs) => {
                let target = tabs.find(t => t.url && t.url.includes(aadvid));
                if (target) chrome.tabs.remove(target.id);
            });
        }
        sendResponse({ success: true });
        return true;
    }
    async function strangettsOpenPcDashboardApp(extensionPage = 'pages/dashboard.html') {
        try {
            const res = await fetch('http://127.0.0.1:48731/api/extension/open-dashboard-app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileName: 'default', extensionPage })
            });
            const json = await res.json().catch(() => ({}));
            return Boolean(res.ok && json && json.ok);
        } catch {
            return false;
        }
    }

    function strangettsOpenDashboardTabFallback(extensionPage = 'pages/dashboard.html') {
        const dashUrl = chrome.runtime.getURL(extensionPage);
        chrome.tabs.query({}, (allTabs) => {
            const found = allTabs.find(t => t.url && t.url.includes('dashboard.html'));
            if (found) chrome.tabs.update(found.id, { active: true, url: dashUrl });
            else chrome.tabs.create({ url: dashUrl, active: true });
        });
    }

    // === OPEN DASHBOARD ===
    if (request.action === "open_dashboard") {
        (async () => {
            const opened = await strangettsOpenPcDashboardApp('pages/dashboard.html');
            if (!opened) strangettsOpenDashboardTabFallback('pages/dashboard.html');
            sendResponse({ success: true, appWindow: opened });
        })();
        return true;
    }
});

// Context menu: Mở Dashboard
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'open-dashboard',
        title: '📊 Mở Dashboard Strange TTS Solution',
        contexts: ['action']
    });
    chrome.contextMenus.create({
        id: 'strangetts_open_seller',
        title: '🛒 Mở Seller Ads (Hôm nay)',
        contexts: ['action']
    });
    chrome.contextMenus.create({
        id: 'strangetts_open_report',
        title: '📩 Send reports',
        contexts: ['action']
    });
});

async function strangettsOpenPcDashboardAppFromContext(extensionPage = 'pages/dashboard.html') {
    try {
        const res = await fetch('http://127.0.0.1:48731/api/extension/open-dashboard-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileName: 'default', extensionPage })
        });
        const json = await res.json().catch(() => ({}));
        return Boolean(res.ok && json && json.ok);
    } catch {
        return false;
    }
}

function strangettsOpenDashboardTabFallbackFromContext(extensionPage = 'pages/dashboard.html') {
    const dashUrl = chrome.runtime.getURL(extensionPage);
    chrome.tabs.query({}, (allTabs) => {
        const found = allTabs.find(t => t.url && t.url.includes('dashboard.html'));
        if (found) chrome.tabs.update(found.id, { active: true, url: dashUrl });
        else chrome.tabs.create({ url: dashUrl, active: true });
    });
}

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'open-dashboard') {
        strangettsOpenPcDashboardAppFromContext('pages/dashboard.html').then(opened => {
            if (!opened) strangettsOpenDashboardTabFallbackFromContext('pages/dashboard.html');
        });
    } else if (info.menuItemId === 'strangetts_open_seller') {
        strangettsOpenSellerAdsToday();
    } else if (info.menuItemId === 'strangetts_open_report') {
        // Mở dashboard và auto-switch sang tab Báo Cáo
        strangettsOpenPcDashboardAppFromContext('pages/dashboard.html?tab=report').then(opened => {
            if (!opened) strangettsOpenDashboardTabFallbackFromContext('pages/dashboard.html?tab=report');
        });
    }
});


async function strangettsOpenSellerAdsViaLocalApp(sellerUrl) {
    try {
        const res = await fetch('http://127.0.0.1:48731/api/runtime/open-shop-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shopKey: 'manual-seller',
                shop: { name: 'Seller Ads', shopRealName: 'Seller Ads', local_key: 'manual-seller', cookies: [] },
                targetUrl: sellerUrl,
                pageType: 'seller'
            })
        });
        const json = await res.json().catch(() => ({}));
        return Boolean(res.ok && json?.ok);
    } catch {
        return false;
    }
}

function strangettsOpenSellerAdsToday(focusTab) {
    let now = new Date();
    let startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    let endTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    let sellerUrl = `https://seller-vn.tiktok.com/ads-creation/dashboard?type=product&shop_region=VN&list_order_field=cost&list_order_type=descend&list_status=delivery_ok&list_start_date=${startTs}&list_end_date=${endTs}`;
    strangettsOpenSellerAdsViaLocalApp(sellerUrl).then(opened => {
        if (opened) return;
        chrome.tabs.query({ url: '*://seller-vn.tiktok.com/*' }, (tabs) => {
            if (tabs && tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true, url: sellerUrl });
            } else {
                chrome.tabs.create({ url: sellerUrl, active: true });
            }
        });
    });
}

// V30: Đã chuyển sang dùng default_popup (login.html)
// chrome.action.onClicked không dùng khi có default_popup
// Người dùng bấm icon → hiện login popup → chọn Dashboard hoặc Seller Ads từ menu

async function applyShopCookies(cookies) {
    if (!cookies || !Array.isArray(cookies)) return;
    for (let c of cookies) {
        try {
            let cookieDomain = c.domain || '.tiktok.com';
            let cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
            let url = `https://${cleanDomain}${c.path || '/'}`;
            await chrome.cookies.set({
                url,
                name: c.name,
                value: c.value,
                domain: cookieDomain,
                path: c.path || '/',
                secure: true,
                sameSite: 'no_restriction'
            });
        } catch (e) { }
    }
}

async function cleanTikTokCookies() {
    let domains = ['https://seller-vn.tiktok.com', 'https://seller.tiktok.com', 'https://ads.tiktok.com', 'https://business.tiktok.com', 'https://shop.tiktok.com'];
    let cleared = 0;
    for (let domainUrl of domains) {
        try {
            let existing = await chrome.cookies.getAll({ url: domainUrl });
            for (let c of existing) {
                try { await chrome.cookies.remove({ url: domainUrl + c.path, name: c.name }); cleared++; } catch (e) { }
            }
        } catch (e) { }
    }
    try {
        let dotCookies = await chrome.cookies.getAll({ domain: '.tiktok.com' });
        for (let c of dotCookies) {
            try {
                let cUrl = `https://${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}${c.path || '/'}`;
                await chrome.cookies.remove({ url: cUrl, name: c.name }); cleared++;
            } catch (e) { }
        }
    } catch (e) { }
    console.log(`[Strange TTS BG] 🧹 Total cleared: ${cleared} cookies`);
    // Đợi 300ms để trình duyệt đồng bộ trạng thái cookie trống
    await new Promise(r => setTimeout(r, 300));
    return cleared;
}

// ============================================================
// STRANGE TTS REPORT BACKGROUND SCHEDULER (24/7 — chrome.alarms)
// ============================================================

// Khi extension cài/khởi động: tạo alarm kiểm tra mỗi phút
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('strangetts_rp_check', { periodInMinutes: 1 });
    console.log('[Strange TTS BG] ✅ strangetts_rp_check alarm registered');
});
chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('strangetts_rp_check', { periodInMinutes: 1 });
    console.log('[Strange TTS BG] ✅ strangetts_rp_check alarm re-registered on startup');
});

// Listener xử lý alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'strangetts_rp_check') return;
    await bgRpCheckScheduler();
});

// DANH SÁCH MẶC ĐỊNH (SYNC VỚI report.js)
const DEFAULT_SHEETS_URL = '';
const DEFAULT_TG_TOKEN = '';
const DEFAULT_TG_CHAT_ID = '';
const DEFAULT_ZALO_SERVER = 'https://cartridges-warranty-management-incentive.trycloudflare.com:7788';
const STORAGE_ALERT_CONFIG = 'strangetts_alert_config';
const STORAGE_QUICK_RECAP_LAST = 'strangetts_quick_recap_last';
const QUICK_RECAP_WINDOW_SEC = 30 * 60;

// ============================================================
// SCHEDULER V2: Persistent Lock + Giờ cài đặt = Giờ BẮT ĐẦU LOAD
// Lock lưu vào storage (tồn tại qua SW restart), TTL 10 phút
// Luồng: đến giờ → load → xác nhận OK → gửi → shop tiếp theo
// ============================================================
async function bgRpCheckScheduler() {
    // === BƯỚC 0a: Kiểm tra MANUAL BATCH lock (người dùng đang load/gửi thủ công) ===
    // Lock này do report.js set vào storage, tồn tại qua SW restart, TTL 15 phút
    // Khi lock này active: scheduler bỏ qua honàn toàn để tab report được ưu tiên
    const manualLockStore = await chrome.storage.local.get('strangetts_manual_batch_lock');
    const manualLock = manualLockStore.strangetts_manual_batch_lock;
    const MANUAL_LOCK_TTL = 15 * 60 * 1000;
    if (manualLock && manualLock.running && (Date.now() - manualLock.startedAt) < MANUAL_LOCK_TTL) {
        console.log('[Strange TTS BG] Scheduler: Manual batch từ UI đang chạy, bỏ qua lượt này.');
        return;
    }
    // === BƯỚC 0b: Kiểm tra in-memory manual count (real-time guard) ===
    if (_manualFetchCount > 0) {
        console.log('[Strange TTS BG] Scheduler: Đang có manual fetch chạy, bỏ qua lượt này.');
        return;
    }
    // === BƯỚC 0c: Kiểm tra persistent scheduler lock từ storage ===
    // Nâng lên 10 phút vì nếu nhiều shop, quá trình fetch và gửi có thể lâu
    const BG_LOCK_TTL_MS = 10 * 60 * 1000;
    const lockStore = await chrome.storage.local.get('strangetts_rp_lock');
    const lock = lockStore.strangetts_rp_lock;

    if (lock && lock.running && (Date.now() - lock.startedAt) < BG_LOCK_TTL_MS) {
        return;
    }

    // Đăng ký lock
    await chrome.storage.local.set({
        strangetts_rp_lock: { running: true, startedAt: Date.now(), shopName: 'Initializing...' }
    });

    try {
        await bgLog('system', 'scheduler', 'idle', '🔄 Bắt đầu kiểm tra lịch gửi báo cáo tự động...');

        const store = await chrome.storage.local.get([
            'strangetts_rp_config',
            'strangetts_rp_sent',
            'strangetts_rp_shops',
            'strangetts_rp_shop_order',
            'strangetts_multi_shops',
            'strangetts_shop_order',
            STORAGE_ALERT_CONFIG
        ]);

        const rpConfig = store.strangetts_rp_config || {};
        const rpSentToday = store.strangetts_rp_sent || {};
        const { shops, keys } = bgGetManagedShopsFromStore(store);
        if (!keys.length) {
            await bgLog('system', 'scheduler', 'warn', '⚠️ Không tìm thấy danh sách Shop để kiểm tra.');
            return;
        }

        const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const today = vnNow.toLocaleDateString('en-CA');
        const dow = String(vnNow.getDay());
        const dayOk = (days) => !days || !days.length || days.map(String).includes(dow);

        // Giây hiện tại kể từ 00:00:00
        const nowSec = vnNow.getHours() * 3600 + vnNow.getMinutes() * 60 + vnNow.getSeconds();

        // TIME WINDOW 30 phút: Cho phép retry nếu có lỗi mạng hoặc treo Service Worker
        const WINDOW_SEC = 30 * 60;

        const shouldRun = (scheduledTime, extraTimesStr, fieldKey, aadvid) => {
            // Collect all slots: primary time + comma-separated extra times
            const slots = [scheduledTime || '08:00'];
            if (extraTimesStr) {
                const extras = extraTimesStr.split(',').map(s => s.trim()).filter(s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
                slots.push(...extras);
            }

            for (const slot of slots) {
                const sentKey = `${aadvid}${fieldKey}_${slot}`;
                if (rpSentToday[sentKey] === today) continue; // This specific slot already sent

                const [sh, sm] = slot.split(':').map(Number);
                const scheduledSec = sh * 3600 + sm * 60;

                if (nowSec >= scheduledSec && nowSec < scheduledSec + WINDOW_SEC) {
                    return slot; // Return the specific slot that triggered
                }
            }
            return null;
        };

        let reportTriggered = false;
        for (let i = 0; i < keys.length; i++) {
            const aadvid = keys[i];
            const shop = shops[aadvid];
            const cfg = bgResolveReportConfig(rpConfig, aadvid, shop);

            const slotZalo = cfg.autoSend && dayOk(cfg.sendDays) ? shouldRun(cfg.sendTime || '08:00', cfg.sendExtra, '_zalo', aadvid) : null;
            const slotSheet = cfg.autoSheets && dayOk(cfg.sheetsDays) ? shouldRun(cfg.sheetsTime || '08:30', cfg.sheetsExtra, '_sheet', aadvid) : null;
            const slotTele = cfg.autoTelegram && dayOk(cfg.tgDays) ? shouldRun(cfg.tgTime || '09:00', cfg.tgExtra, '_tg', aadvid) : null;

            if (!slotZalo && !slotSheet && !slotTele) continue;
            reportTriggered = true;

            // Heartbeat lock cho shop hiện tại
            await chrome.storage.local.set({
                strangetts_rp_lock: { running: true, startedAt: Date.now(), shopName: shop.name || aadvid }
            });

            const channels = [slotZalo && 'Zalo', slotSheet && 'Sheets', slotTele && 'Telegram'].filter(Boolean).join(', ');
            await bgLog(aadvid, 'scheduler', 'idle', `🚀 Kích hoạt gửi [${channels}] cho shop: ${shop.name}`);
            const fetchTimeoutMs = bgGetFetchBudgetMs((Number(rpConfig.__fetchTimeout__) || 60) * 1000);

            // BƯỚC 1: Tải dữ liệu TK chính
            let data = await executeCompleteShopFetch(shop, fetchTimeoutMs, false, { needDailyAds: !!slotSheet, needCampaigns: false });

            if (!data || data.status !== 'ok') {
                const errMsg = data?.error || 'Lỗi tải dữ liệu từ TikTok';
                await bgLog(aadvid, 'fetch', 'error', `❌ ${shop.name}: ${errMsg}`);
                continue;
            }

            // BƯỚC 1b: Cộng tổng Ads từ TK phụ (nếu có)
            data = await bgMergeExtraAdsAccounts(shop, data, fetchTimeoutMs);
            if (data._warn || data._warnAccount || data._warnDailyAds || data._fetchTimedOut) {
                const warnMsg = [data._warn, data._warnAccount, data._warnDailyAds, data._fetchTimedOut ? 'Fetch chạm deadline, gửi dữ liệu tốt nhất hiện có' : '']
                    .filter(Boolean)
                    .join(' | ');
                if (warnMsg) await bgLog(aadvid, 'fetch', 'warn', `⚠️ ${shop.name}: ${warnMsg}`);
            }

            // Lưu cache data
            data.fetchedAt = Date.now();
            data._mainAadvid = shop.aadvid || data.aadvid || '';
            await chrome.storage.local.set({ [`strangetts_rp_data_${aadvid}`]: data });

            // BƯỚC 2: Gửi từng kênh
            const updatedSent = { ...rpSentToday };
            let anySuccess = false;

            if (slotZalo) {
                const ok = await bgRpAutoZalo(aadvid, shop, cfg, data);
                if (ok) { updatedSent[`${aadvid}_zalo_${slotZalo}`] = today; anySuccess = true; }
            }
            if (slotSheet) {
                const ok = await bgRpAutoSheet(aadvid, shop, cfg, data);
                if (ok) { updatedSent[`${aadvid}_sheet_${slotSheet}`] = today; anySuccess = true; }
            }
            if (slotTele) {
                const ok = await bgRpAutoTelegram(aadvid, shop, cfg, data);
                if (ok) { updatedSent[`${aadvid}_tg_${slotTele}`] = today; anySuccess = true; }
            }

            if (anySuccess) {
                await chrome.storage.local.set({ strangetts_rp_sent: updatedSent });
                // Cập nhật biến local để các shop tiếp theo không check đè
                Object.assign(rpSentToday, updatedSent);
            }

            // Delay nhỏ giữa các shop
            const delay = Number(rpConfig.__delay__ || 8);
            if (i < keys.length - 1 && delay > 0) await new Promise(r => setTimeout(r, delay * 1000));
        }

        if (!reportTriggered) {
            const enabledCount = keys.reduce((count, aadvid) => {
                const cfg = bgResolveReportConfig(rpConfig, aadvid, shops[aadvid]);
                return count + ((cfg.autoSend || cfg.autoSheets || cfg.autoTelegram) ? 1 : 0);
            }, 0);
            const nowStr = `${String(vnNow.getHours()).padStart(2, '0')}:${String(vnNow.getMinutes()).padStart(2, '0')}`;
            await bgLog(
                'system',
                'scheduler',
                enabledCount ? 'idle' : 'warn',
                enabledCount
                    ? `⏳ Alarm OK ${nowStr}: chưa tới khung giờ report của ${enabledCount}/${keys.length} shop.`
                    : `⚠️ Alarm OK ${nowStr}: chưa bật kênh report tự động cho shop nào.`
            );
        }

        await bgRunQuickRecap({
            preloadedStore: store,
            skipBecauseReport: reportTriggered,
            ignoreLockCheck: true
        });

        await bgLog('system', 'scheduler', 'success', '✅ Hoàn thành kiểm tra lịch gửi.');

    } catch (err) {
        console.error('[Strange TTS BG] Scheduler Error:', err);
        await bgLog('system', 'scheduler', 'error', `🔴 Lỗi hệ thống: ${err.message}`);
    } finally {
        // Giải phóng lock
        await chrome.storage.local.remove('strangetts_rp_lock');
    }
}

// Ghi log vào storage
async function bgRpLog(aadvid, channel, status, msg) {
    // Gọi sang hàm log mới để tập trung dữ liệu
    await bgLog(aadvid, channel, status, msg);

    // Vẫn giữ lại bảng log cũ cho UI hiện tại (card report.js)
    try {
        const store = await chrome.storage.local.get('strangetts_rp_logs');
        const logs = store.strangetts_rp_logs || {};
        if (!logs[aadvid]) logs[aadvid] = {};
        const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const ts = `${String(vnNow.getHours()).padStart(2, '0')}:${String(vnNow.getMinutes()).padStart(2, '0')}`;
        logs[aadvid][channel] = { ts, status, msg };
        await chrome.storage.local.set({ strangetts_rp_logs: logs });
    } catch (e) { }
}

/**
 * Ghi nhật ký chạy ngầm tập trung (Background Logs)
 * @param {string} aadvid - ID Shop hoặc 'system'
 * @param {string} type - 'scheduler'|'fetch'|'zalo'|'sheet'|'tg'|'offscreen'
 * @param {string} status - 'success'|'error'|'warn'|'idle'
 * @param {string} msg - Nội dung thông báo
 */
async function bgLog(aadvid, type, status, msg) {
    try {
        const store = await chrome.storage.local.get('strangetts_bg_logs');
        let logs = store.strangetts_bg_logs || [];

        const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const timeStr = vnNow.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = vnNow.toLocaleDateString('vi-VN');

        logs.unshift({
            ts: `${dateStr} ${timeStr}`,
            aadvid,
            type,
            status,
            msg
        });

        // Giữ tối đa 200 log gần nhất
        if (logs.length > 200) logs = logs.slice(0, 200);

        await chrome.storage.local.set({ strangetts_bg_logs: logs });
    } catch (e) {
        console.error('[Strange TTS BG] bgLog Error:', e);
    }
}

function bgGetManagedShopsFromStore(store) {
    let rawShops = store.strangetts_rp_shops || {};
    let rawOrder = store.strangetts_rp_shop_order || Object.keys(rawShops);
    if (!Object.keys(rawShops).length && store.strangetts_multi_shops) {
        rawShops = store.strangetts_multi_shops;
        rawOrder = store.strangetts_shop_order || Object.keys(rawShops);
    }

    const shops = {};
    const keyMap = {};
    Object.keys(rawShops || {}).forEach((oldKey) => {
        const raw = rawShops[oldKey] || {};
        const base = (raw.shop && typeof raw.shop === 'object') ? raw.shop : raw;
        const normalized = {
            ...base,
            name: base.name || raw.name || base.shopRealName || raw.shopRealName || oldKey,
            shopRealName: base.shopRealName || raw.shopRealName || base.name || raw.name || oldKey,
            shopAvatar: base.shopAvatar || raw.shopAvatar || '',
            aadvid: base.aadvid || raw.aadvid || '',
            oec_seller_id: base.oec_seller_id || raw.oec_seller_id || '',
            seller_id: base.seller_id || raw.seller_id || '',
            bc_id: base.bc_id || raw.bc_id || '',
            cookies: raw.cookies || base.cookies || [],
            ads_accounts: raw.ads_accounts || base.ads_accounts || [],
            canonical_shop_id: base.canonical_shop_id || raw.canonical_shop_id || '',
            local_key: base.local_key || raw.local_key || oldKey,
            source_username: base.source_username || raw.source_username || raw.owner_username || '',
            source_shop_key: base.source_shop_key || raw.source_shop_key || '',
            cookieFingerprint: raw.cookieFingerprint || base.cookieFingerprint || '',
            cookieUpdatedAt: raw.cookieUpdatedAt || base.cookieUpdatedAt || ''
        };
        const newKey = bgReportShopKey(oldKey, normalized);
        shops[newKey] = normalized;
        keyMap[oldKey] = newKey;
        [normalized.local_key, normalized.canonical_shop_id, normalized.oec_seller_id, normalized.seller_id, normalized.source_shop_key, normalized.aadvid]
            .filter(Boolean)
            .forEach(alias => { keyMap[alias] = newKey; });
    });

    const shopOrder = [];
    (rawOrder || Object.keys(rawShops || {})).forEach((key) => {
        const mapped = keyMap[key] || key;
        if (shops[mapped] && !shopOrder.includes(mapped)) shopOrder.push(mapped);
    });
    Object.keys(shops).forEach((key) => {
        if (!shopOrder.includes(key)) shopOrder.push(key);
    });

    return {
        shops,
        shopOrder,
        keys: (shopOrder || Object.keys(shops)).filter(k => shops && shops[k])
    };
}

function bgReportShopKey(oldKey, shop = {}) {
    const canonical = bgCanonicalShopId(shop);
    const aadvid = bgFirstText(shop.aadvid);
    return String(
        shop.oec_seller_id ||
        shop.seller_id ||
        (canonical && canonical !== aadvid ? canonical : '') ||
        shop.local_key ||
        oldKey ||
        aadvid ||
        ''
    ).trim();
}

function bgReportConfigAliases(shopKey, shop = {}) {
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

function bgFindReportConfig(rpConfig, shopKey, shop = {}) {
    const root = rpConfig || {};
    const aliases = bgReportConfigAliases(shopKey, shop);
    const merged = {};
    aliases.forEach((key, index) => {
        if (!Object.prototype.hasOwnProperty.call(root, key)) return;
        const cfg = root[key] || {};
        Object.keys(cfg).forEach(field => {
            const value = cfg[field];
            if (index === 0 || bgShouldUseAliasConfigValue(field, merged[field], value)) {
                merged[field] = Array.isArray(value) ? [...value] : value;
            }
        });
    });
    return merged;
}

function bgShouldUseAliasConfigValue(field, currentValue, nextValue) {
    if (nextValue === undefined || nextValue === null || nextValue === '') return false;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (field === 'tgToken' && currentValue === DEFAULT_TG_TOKEN && nextValue !== DEFAULT_TG_TOKEN) return true;
    if (field === 'tgChatId' && currentValue === DEFAULT_TG_CHAT_ID && nextValue !== DEFAULT_TG_CHAT_ID) return true;
    if (field === 'sheetsUrl' && currentValue === DEFAULT_SHEETS_URL && nextValue !== DEFAULT_SHEETS_URL) return true;
    return false;
}

function bgPickConfigValue(shopCfg, globalCfg, shopKey, globalKey, fallback) {
    const value = shopCfg ? shopCfg[shopKey] : undefined;
    if (value !== undefined && value !== null && value !== '') return value;
    const globalValue = globalCfg ? globalCfg[globalKey] : undefined;
    if (globalValue !== undefined && globalValue !== null && globalValue !== '') return globalValue;
    return fallback;
}

function bgPickConfigBool(shopCfg, globalCfg, shopKey, globalKey, fallback = false) {
    const value = shopCfg ? shopCfg[shopKey] : undefined;
    if (value !== undefined && value !== null) return !!value;
    const globalValue = globalCfg ? globalCfg[globalKey] : undefined;
    if (globalValue !== undefined && globalValue !== null) return !!globalValue;
    return fallback;
}

function bgResolveReportConfig(rpConfig, aadvid, shop = {}) {
    const root = rpConfig || {};
    const cfg = bgFindReportConfig(root, aadvid, shop);
    return {
        ...cfg,
        autoSend: bgPickConfigBool(cfg, root, 'autoSend', '__global_zalo__', false),
        autoSheets: bgPickConfigBool(cfg, root, 'autoSheets', '__global_sheet__', false),
        autoTelegram: bgPickConfigBool(cfg, root, 'autoTelegram', '__global_tg__', false),
        groupId: bgPickConfigValue(cfg, root, 'groupId', '__global_zalo_group__', ''),
        zaloUserId: bgPickConfigValue(cfg, root, 'zaloUserId', '__global_zalo_user__', ''),
        zaloServer: bgPickConfigValue(cfg, root, 'zaloServer', '__server__', DEFAULT_ZALO_SERVER),
        sendTime: bgPickConfigValue(cfg, root, 'sendTime', '__global_time__', '08:00'),
        sendExtra: bgPickConfigValue(cfg, root, 'sendExtra', '__global_send_extra__', ''),
        sendDays: bgPickConfigValue(cfg, root, 'sendDays', '__global_days__', undefined),
        sheetsUrl: bgPickConfigValue(cfg, root, 'sheetsUrl', '__global_sheets_url__', DEFAULT_SHEETS_URL),
        sheetsTime: bgPickConfigValue(cfg, root, 'sheetsTime', '__global_sheets_time__', '08:30'),
        sheetsExtra: bgPickConfigValue(cfg, root, 'sheetsExtra', '__global_sheets_extra__', ''),
        sheetsDays: bgPickConfigValue(cfg, root, 'sheetsDays', '__global_days__', undefined),
        tgToken: bgPickConfigValue(cfg, root, 'tgToken', '__global_tg_token__', DEFAULT_TG_TOKEN),
        tgChatId: bgPickConfigValue(cfg, root, 'tgChatId', '__global_tg_chatid__', DEFAULT_TG_CHAT_ID),
        tgChatId2: bgPickConfigValue(cfg, root, 'tgChatId2', '__global_tg_chatid2__', ''),
        tgTime: bgPickConfigValue(cfg, root, 'tgTime', '__global_tg_time__', '09:00'),
        tgExtra: bgPickConfigValue(cfg, root, 'tgExtra', '__global_tg_extra__', ''),
        tgDays: bgPickConfigValue(cfg, root, 'tgDays', '__global_days__', undefined),
        tgOn1: cfg.tgOn1 !== undefined ? cfg.tgOn1 : root.__global_tg_on1__,
        tgOn2: cfg.tgOn2 !== undefined ? cfg.tgOn2 : root.__global_tg_on2__,
        zaloGroupOn: cfg.zaloGroupOn !== undefined ? cfg.zaloGroupOn : root.__global_zalo_group_on__,
        zaloUserOn: cfg.zaloUserOn !== undefined ? cfg.zaloUserOn : root.__global_zalo_user_on__
    };
}

function bgNormalizeTimeSlots(raw) {
    const seen = new Set();
    return String(raw || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
        .filter(s => {
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
        });
}

function bgCompactMoney(num) {
    const n = Math.max(0, Math.round(Number(num) || 0));
    if (n >= 1e9) {
        const ty = Math.floor(n / 1e9);
        const dec = Math.floor((n % 1e9) / 1e8);
        return dec > 0 ? `${ty}ty${dec}` : `${ty}ty`;
    }
    if (n >= 1e6) {
        const tr = Math.floor(n / 1e6);
        const dec = Math.floor((n % 1e6) / 1e5);
        return dec > 0 ? `${tr}tr${dec}` : `${tr}tr`;
    }
    if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
    return String(n);
}

function bgCompactMoneyReadable(num) {
    const n = Math.max(0, Number(num) || 0);
    if (n >= 1e9) {
        const ty = Math.floor(n / 1e9);
        const dec = Math.floor((n % 1e9) / 1e8);
        return dec > 0 ? `${ty}.${dec}ty` : `${ty}ty`;
    }
    if (n >= 1e6) {
        const tr = Math.floor(n / 1e6);
        const dec = Math.floor((n % 1e6) / 1e5);
        return dec > 0 ? `${tr}.${dec}tr` : `${tr}tr`;
    }
    if (n >= 1e3) {
        const k = Math.floor(n / 1e3);
        const dec = Math.floor((n % 1e3) / 1e2);
        return dec > 0 ? `${k}.${dec}k` : `${k}k`;
    }
    return String(Math.round(n));
}

function bgReadMoney(value) {
    return Number(String(value || '').replace(/[^\d]/g, '')) || 0;
}

function bgReadPct(value) {
    const normalized = String(value || '').replace(',', '.').replace(/[^\d.]/g, '');
    const parts = normalized.split('.');
    const clean = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
    return Number(clean) || 0;
}

function bgFmtPct(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toFixed(digits).replace(/\.0$/, '')}%`;
}

function bgFormatPctAds(cost, revenue) {
    const rev = Number(revenue) || 0;
    const ads = Number(cost) || 0;
    if (rev <= 0) return ads > 0 ? '100%' : '0%';
    return `${Math.round((ads / rev) * 100)}%`;
}

function bgFormatRoi(revenue, cost) {
    const rev = Number(revenue) || 0;
    const ads = Number(cost) || 0;
    if (ads <= 0) return rev > 0 ? '∞' : '0';
    return (rev / ads).toFixed(2);
}

function bgFormatQuickCount(num) {
    return Math.round(Number(num) || 0).toLocaleString('vi-VN');
}

function bgGetPerfStats(campaigns) {
    const stats = { total: (campaigns || []).length, near_budget: 0, low_roi: 0, good_roi: 0, strong: 0, weak: 0, testing: 0, totalBudget: 0 };
    (campaigns || []).forEach(c => {
        const spend = Number(c.cost) || 0;
        const budget = Number(c.budget) || 0;
        const roi = parseFloat(c.roi) || 0;
        const targetRoi = parseFloat(c.targetRoi) || 0;
        const orders = Number(c.orders) || 0;
        const spendPct = budget > 0 ? (spend / budget) * 100 : 0;

        stats.totalBudget += budget;
        if (spendPct >= 85 || String(c.status || '').includes('OUT_OF_BUDGET')) stats.near_budget++;
        if (targetRoi > 0 && roi < targetRoi * 0.8) stats.low_roi++;
        if (targetRoi > 0 && roi >= targetRoi) stats.good_roi++;
        if (targetRoi > 0 && roi >= targetRoi && orders >= 10 && spendPct >= 50) stats.strong++;
        if (spend >= 50000 && (orders === 0 || (targetRoi > 0 && roi < targetRoi * 0.6))) stats.weak++;
        if (spend > 0 && spend < 50000) stats.testing++;
    });
    return stats;
}

function bgShortShopName(name, maxLen = 18) {
    const s = String(name || '').trim();
    if (s.length <= maxLen) return s;
    return `${s.slice(0, Math.max(6, maxLen - 1)).trim()}…`;
}

function bgQuickRecapTs() {
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    return `${String(vnNow.getDate()).padStart(2, '0')}/${String(vnNow.getMonth() + 1).padStart(2, '0')} ${String(vnNow.getHours()).padStart(2, '0')}:${String(vnNow.getMinutes()).padStart(2, '0')}`;
}

function bgNormalizeQuickRecapErrorReason(error) {
    const text = String(error || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Lỗi khác';
    if (/chưa đăng nhập|ban chua dang nhap/i.test(text)) return 'Login lỗi';
    if (/cookie/i.test(text)) return 'Cookie lỗi';
    if (/seller_id|aadvid/i.test(text)) return 'Thiếu ID shop ads';
    if (/timeout|deadline/i.test(text)) return 'Timeout lấy dữ liệu';
    return 'Lỗi khác';
}

function bgBuildQuickRecapErrorSummary(failedDetails = []) {
    const groups = new Map();
    failedDetails.forEach((item) => {
        const reason = bgNormalizeQuickRecapErrorReason(item.error);
        const names = groups.get(reason) || [];
        names.push(bgShortShopName(item.name, 30));
        groups.set(reason, names);
    });
    const lines = [];
    Array.from(groups.entries()).forEach(([reason, names]) => {
        lines.push(`⚠ ${reason}: ${names.length} shop`);
        names.forEach(name => lines.push(`- ${name}`));
    });
    return lines;
}

async function bgSaveQuickRecapState(payload = {}) {
    const state = {
        ts: payload.ts || bgQuickRecapTs(),
        slot: payload.slot || '',
        ok: !!payload.ok,
        skipped: !!payload.skipped,
        sentShops: Number(payload.sentShops) || 0,
        totalShops: Number(payload.totalShops) || 0,
        failedDetails: Array.isArray(payload.failedDetails) ? payload.failedDetails : [],
        error: payload.error || '',
        telegram: !!payload.telegram,
        zalo: !!payload.zalo,
        telegramError: payload.telegramError || '',
        zaloError: payload.zaloError || '',
        recapMessages: Number(payload.recapMessages) || 0,
        adsMessages: Number(payload.adsMessages) || 0,
        errorMessages: Number(payload.errorMessages) || 0
    };
    await chrome.storage.local.set({ [STORAGE_QUICK_RECAP_LAST]: state });
    return state;
}

function bgChunkQuickRecapMessages(header, lines, footer = '') {
    const maxLen = 3300;
    const messages = [];
    let current = header;

    lines.forEach((line) => {
        const next = current ? `${current}\n${line}` : line;
        if (next.length > maxLen && current) {
            messages.push(current);
            current = `${header} (tiếp ${messages.length + 1})\n${line}`;
        } else {
            current = next;
        }
    });

    if (footer) {
        const next = current ? `${current}\n${footer}` : footer;
        if (next.length > maxLen && current) {
            messages.push(current);
            current = `${header} (tiếp ${messages.length + 1})\n${footer}`;
        } else {
            current = next;
        }
    }

    if (current) messages.push(current);
    return messages;
}

function bgBuildQuickRecapMessages(rows, failedDetails = []) {
    const stamp = bgQuickRecapTs();
    const totalRevenue = rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    const totalOrders = rows.reduce((sum, row) => sum + (Number(row.orders) || 0), 0);
    const totalCost = rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
    const totalRemaining = rows.reduce((sum, row) => sum + (Number(row.remaining) || 0), 0);
    const allRemainingKnown = rows.length > 0 && rows.every(row => row.remainingKnown);
    const header = `⚡ RECAP ${stamp}`;
    const lines = [
        `Tổng: ${rows.length} shop`,
        `DT ${bgCompactMoneyReadable(totalRevenue)} · ${bgFormatQuickCount(totalOrders)} đơn`,
        `Ads ${bgCompactMoneyReadable(totalCost)} · ROI ${bgFormatRoi(totalRevenue, totalCost)}${allRemainingKnown ? ` · Dư ${bgCompactMoneyReadable(totalRemaining)}` : ''}`,
        ''
    ];

    rows.forEach((row, idx) => {
        const stats = row.stats || bgGetPerfStats(row.campaigns || []);
        const extras = [];
        if (stats.good_roi > 0) extras.push(`ROI ngon ${stats.good_roi}`);
        if (stats.low_roi > 0) extras.push(`ROI thấp ${stats.low_roi}`);
        if (stats.weak > 0) extras.push(`Yếu ${stats.weak}`);
        if (stats.near_budget > 0) extras.push(`Hết NS ${stats.near_budget}`);
        if (stats.strong > 0) extras.push(`Scale ${stats.strong}`);

        lines.push(`${idx + 1}. ${bgShortShopName(row.name, 32)}`);
        lines.push(`DT ${bgCompactMoneyReadable(row.revenue)} · ${bgFormatQuickCount(row.orders)} đơn · Ads ${bgCompactMoneyReadable(row.cost)}`);
        lines.push(`ROI ${bgFormatRoi(row.revenue, row.cost)}${row.remainingKnown ? ` · Dư ${bgCompactMoneyReadable(row.remaining)}` : ''}`);
        if (extras.length) lines.push(`Camp: ${extras.join(' · ')}`);
        lines.push('');
    });

    const errorLines = bgBuildQuickRecapErrorSummary(failedDetails);
    if (errorLines.length) {
        errorLines.forEach(line => lines.push(line));
    }

    const recapMessages = bgChunkQuickRecapMessages(header, lines, '');
    return {
        recapMessages,
        adsMessages: [],
        errorMessages: [],
        messages: recapMessages
    };
}

function bgGetDueQuickRecapSlot(alertConfig, sentMap, today, nowSec) {
    if (!alertConfig?.recapEnabled) return null;
    const slots = bgNormalizeTimeSlots(alertConfig.recapTimes || '');
    for (const slot of slots) {
        const sentKey = `__quick_recap_${slot}`;
        if (sentMap[sentKey] === today) continue;
        const [h, m] = slot.split(':').map(Number);
        const scheduledSec = h * 3600 + m * 60;
        if (nowSec >= scheduledSec && nowSec < scheduledSec + QUICK_RECAP_WINDOW_SEC) {
            return slot;
        }
    }
    return null;
}

async function bgSendQuickRecapToTelegram(alertConfig, messages) {
    const token = String(alertConfig.tgToken || '').trim();
    const targets = [];
    if (alertConfig.tgChatId) {
        targets.push(String(alertConfig.tgChatId).trim());
    }
    if (alertConfig.tgChatId2) {
        targets.push(String(alertConfig.tgChatId2).trim());
    }
    if (!token || !targets.length) {
        return { ok: false, error: 'Thiếu Telegram recap' };
    }

    let successCount = 0;
    let lastError = '';
    for (const chatId of targets) {
        for (const text of messages) {
            try {
                const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text })
                });
                const json = await res.json();
                if (json.ok) successCount++;
                else lastError = json.description || 'Lỗi Telegram API';
            } catch (e) {
                lastError = e.message;
            }
            await new Promise(r => setTimeout(r, 350));
        }
    }

    return {
        ok: successCount > 0,
        successCount,
        targetCount: targets.length,
        error: lastError
    };
}

async function bgSendQuickRecapToZalo(alertConfig, messages) {
    const server = String(alertConfig.zaloServer || DEFAULT_ZALO_SERVER).trim();
    const targets = [];
    if (alertConfig.zaloUser) {
        targets.push({ label: 'user', payload: { user_id: String(alertConfig.zaloUser).trim() } });
    }
    if (alertConfig.zaloGroup) {
        targets.push({ label: 'group', payload: { group_id: String(alertConfig.zaloGroup).trim() } });
    }
    if (!server || !targets.length) {
        return { ok: false, error: 'Thiếu Zalo recap' };
    }

    let successCount = 0;
    let lastError = '';
    for (const target of targets) {
        for (const message of messages) {
            try {
                const res = await fetch(`${server}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...target.payload, message })
                });
                let json = {};
                try { json = await res.json(); } catch (_) { json = {}; }
                if (json.ok || json.success) successCount++;
                else lastError = `${target.label}: ${json.message || json.error || `HTTP ${res.status}`}`;
            } catch (e) {
                lastError = `${target.label}: ${e.message}`;
            }
            await new Promise(r => setTimeout(r, 350));
        }
    }

    return {
        ok: successCount > 0,
        successCount,
        targetCount: targets.length,
        error: lastError
    };
}

async function bgFetchDashOverviewForAadvid(shop, aadvid) {
    const sellerId = shop.oec_seller_id || shop.seller_id || '';
    if (!sellerId || !aadvid) {
        return { status: 'error', error: 'Thiếu seller_id hoặc aadvid' };
    }

    const bcPart = shop.bc_id ? `&bc_id=${encodeURIComponent(shop.bc_id)}` : '';
    const url = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_overview_stat?locale=vi&language=vi&oec_seller_id=${encodeURIComponent(sellerId)}&aadvid=${encodeURIComponent(aadvid)}${bcPart}`;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const body = {
        start_time: todayStr,
        end_time: todayStr,
        query_list: ['cost', 'onsite_roi2_shopping_sku', 'onsite_roi2_shopping_value', 'onsite_roi2_shopping'],
        campaign_shop_automation_type: 2,
        external_type_list: ['307', '304', '305']
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (json?.code !== 0 || !json.data?.statistics) {
            return { status: 'error', error: json?.msg || 'Overview API lỗi' };
        }
        const st = json.data.statistics || {};
        const totalCost = Number(st.cost || 0);
        const totalGmv = Number(st.onsite_roi2_shopping_value || 0);
        const totalOrders = Number(st.onsite_roi2_shopping_sku || 0);
        return {
            status: 'ok',
            totalCost,
            totalGmv,
            totalOrders,
            roi: totalCost > 0 ? Number((totalGmv / totalCost).toFixed(2)) : 0
        };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
}

async function bgFetchDashCampaignList(url, headers, body) {
    try {
        const table = [];
        const fetchPage = async (page) => {
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({ ...body, page })
            });
            return res.json();
        };

        const first = await fetchPage(1);
        if (first?.code !== 0 || !first.data) {
            return { status: 'error', error: first?.msg || 'Campaign API lỗi' };
        }

        table.push(...(first.data.table || []));
        const pageCount = Number(first.data.pagination?.page_count || 1);
        for (let page = 2; page <= pageCount; page++) {
            const next = await fetchPage(page);
            if (next?.code === 0 && next.data?.table) {
                table.push(...next.data.table);
            }
            await new Promise(r => setTimeout(r, 180));
        }

        return { status: 'ok', table };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
}

async function bgFetchDashAccountSummaryForAadvid(aadvid) {
    if (!aadvid) return { status: 'error', error: 'Thiếu aadvid' };
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
    };

    try {
        const result = {
            status: 'ok',
            balance: 0,
            credit: 0,
            threshold: 0,
            thresholdSpent: 0,
            billingType: 0,
            remaining: 0,
            remainingKnown: false
        };
        const financeInfo = await bgFetchAdsAccountFinanceInfo(aadvid, headers, 12000, 'dash_summary');
        bgApplyAdsAccountFinanceInfo(result, financeInfo);

        if (result.billingType === 2 && result.threshold > 0) {
            result.remaining = Math.max(0, result.threshold - result.thresholdSpent);
            result.remainingKnown = true;
        } else if (result.balance > 0 || result.credit > 0 || result.billingType === 1) {
            result.remaining = Math.max(0, result.balance + result.credit);
            result.remainingKnown = true;
        }

        if (!result.remainingKnown && !result.billingType && !result._accountInfoLoaded) {
            return { status: 'error', error: 'Không lấy được số dư/ngưỡng ads' };
        }
        return result;
    } catch (e) {
        return { status: 'error', error: e.message };
    }
}

async function bgFetchDashRecapForAadvid(shop, aadvid, options = {}) {
    const sellerId = shop.oec_seller_id || shop.seller_id || '';
    if (!sellerId || !aadvid) {
        return { status: 'error', error: 'Thiếu seller_id hoặc aadvid' };
    }

    const bcPart = shop.bc_id ? `&bc_id=${encodeURIComponent(shop.bc_id)}` : '';
    const baseParams = `locale=vi&language=vi&oec_seller_id=${encodeURIComponent(sellerId)}&aadvid=${encodeURIComponent(aadvid)}${bcPart}`;
    const overviewUrl = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_overview_stat?${baseParams}`;
    const campaignUrl = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_campaign_list?${baseParams}`;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
    };

    const overviewBody = {
        start_time: todayStr,
        end_time: todayStr,
        query_list: ['cost', 'onsite_roi2_shopping_sku', 'onsite_roi2_shopping_value', 'onsite_roi2_shopping'],
        campaign_shop_automation_type: 2,
        external_type_list: ['307', '304', '305']
    };
    const campaignBaseBody = {
        query_list: [
            'campaign_name', 'campaign_primary_status', 'campaign_status', 'campaign_target_roi_budget',
            'cost', 'template_ad_roas_bid', 'onsite_roi2_shopping_sku',
            'onsite_roi2_shopping_value', 'onsite_roi2_shopping', 'billed_cost'
        ],
        campaign_shop_automation_type: 2,
        campaign_status: ['delivery_ok', 'campaign_not_delivery'],
        start_time: todayStr,
        end_time: todayStr,
        keyword: '',
        keyword_type: 0,
        order_field: 'cost',
        order_type: 1,
        page: 1,
        page_size: 200
    };

    try {
        const needAccountInfo = options.needAccountInfo !== false;
        const [overviewRes, productRes, liveRes, accountRes] = await Promise.all([
            bgFetchDashOverviewForAadvid(shop, aadvid),
            bgFetchDashCampaignList(campaignUrl, headers, { ...campaignBaseBody, external_type_list: ['307', '304', '305'] }),
            bgFetchDashCampaignList(campaignUrl, headers, { ...campaignBaseBody, external_type_list: ['306'] }),
            needAccountInfo
                ? bgFetchDashAccountSummaryForAadvid(aadvid)
                : Promise.resolve({ status: 'ok', remaining: 0, remainingKnown: false, _accountInfoSkipped: true })
        ]);

        const result = { status: 'ok', totalCost: 0, totalGmv: 0, totalOrders: 0, campaigns: [], remaining: 0, remainingKnown: false };
        const hasOverview = overviewRes?.status === 'ok';
        if (hasOverview) {
            result.totalCost = Number(overviewRes.totalCost || 0);
            result.totalGmv = Number(overviewRes.totalGmv || 0);
            result.totalOrders = Number(overviewRes.totalOrders || 0);
        }

        const appendCampaigns = (items, type, addToTotals) => {
            (items || []).forEach(c => {
                const cost = Number(c.cost || 0);
                const gmv = Number(c.onsite_roi2_shopping_value || 0);
                const orders = Number(c.onsite_roi2_shopping_sku || 0);
                if (addToTotals) {
                    result.totalCost += cost;
                    result.totalGmv += gmv;
                    result.totalOrders += orders;
                }
                result.campaigns.push({
                    id: c.campaign_id || c.id || '',
                    name: `${type === 'live' ? '📺 ' : ''}${c.campaign_name || c.name || c.campaign_id || c.id || ''}`,
                    status: c.campaign_primary_status || c.campaign_status || '',
                    cost,
                    gmv,
                    orders,
                    roi: cost > 0 ? (gmv / cost).toFixed(2) : '0',
                    budget: Number(c.campaign_target_roi_budget || 0),
                    targetRoi: Number(c.template_ad_roas_bid || c.campaign_target_roi || 0),
                    billedCost: Number(c.billed_cost || 0)
                });
            });
        };

        const productOk = productRes?.status === 'ok';
        const liveOk = liveRes?.status === 'ok';
        appendCampaigns(productOk ? productRes.table : [], 'product', !hasOverview);
        appendCampaigns(liveOk ? liveRes.table : [], 'live', true);

        if (!hasOverview && !productOk && !liveOk) {
            return {
                status: 'error',
                error: [overviewRes?.error, productRes?.error, liveRes?.error].filter(Boolean).join(' | ') || 'Không lấy được snapshot Dashboard'
            };
        }

        if (accountRes?.status === 'ok') {
            result.remaining = Number(accountRes.remaining || 0);
            result.remainingKnown = !!accountRes.remainingKnown;
            result.balance = Number(accountRes.balance || 0);
            result.credit = Number(accountRes.credit || 0);
            result.threshold = Number(accountRes.threshold || 0);
            result.thresholdSpent = Number(accountRes.thresholdSpent || 0);
            result.billingType = Number(accountRes.billingType || 0);
        }

        result.roi = result.totalCost > 0 ? Number((result.totalGmv / result.totalCost).toFixed(2)) : 0;
        result.campaignCount = result.campaigns.length;
        return result;
    } catch (e) {
        return { status: 'error', error: e.message };
    }
}

async function bgFetchQuickRecapSnapshot(shop) {
    shop = await bgRefreshShopCookiesFromServer(shop, { force: false, reason: 'quick_recap' });
    const accounts = [];
    const seen = new Set();
    const pushAccount = (account) => {
        const aadvid = String(typeof account === 'string' ? account : account?.aadvid || '').trim();
        if (!aadvid || seen.has(aadvid)) return;
        seen.add(aadvid);
        accounts.push(typeof account === 'string' ? { aadvid, bc_id: shop.bc_id || '' } : { ...account, aadvid });
    };

    pushAccount({ aadvid: shop.aadvid, bc_id: shop.bc_id || '', label: shop.mainAccountLabel || shop.name });
    (shop.ads_accounts || []).filter(acc => acc && acc.enabled !== false).forEach(acc => pushAccount(acc));

    if (!accounts.length) {
        return { status: 'error', error: 'Thiếu aadvid để lấy snapshot' };
    }

    await cleanTikTokCookies();
    await applyShopCookies(shop.cookies || []);
    await new Promise(r => setTimeout(r, 1200));

    const mainAadvid = String(shop.aadvid || '');
    const merged = { status: 'ok', totalCost: 0, totalGmv: 0, totalOrders: 0, campaigns: [], remaining: 0, remainingKnown: false };
    let okCount = 0;
    const accountErrors = [];

    for (const acc of accounts) {
        const aadvid = acc.aadvid;
        const snapShop = { ...shop, bc_id: acc.bc_id || shop.bc_id || '' };
        const isMainAccount = String(aadvid) === mainAadvid;
        const snap = await bgFetchDashRecapForAadvid(snapShop, aadvid, { needAccountInfo: isMainAccount });
        if (snap.status === 'ok') {
            okCount++;
            merged.totalCost += snap.totalCost || 0;
            merged.totalGmv += snap.totalGmv || 0;
            merged.totalOrders += snap.totalOrders || 0;
            merged.campaigns = merged.campaigns.concat(snap.campaigns || []);
            if (isMainAccount) {
                merged.remaining = Number(snap.remaining || 0);
                merged.remainingKnown = !!snap.remainingKnown;
            }
        } else {
            accountErrors.push({ aadvid, label: acc.label || acc.name || '', error: snap.error || 'Lỗi snapshot dashboard' });
        }
        await new Promise(r => setTimeout(r, 250));
    }

    if (!okCount) {
        return {
            status: 'error',
            error: accountErrors.map(item => `${item.aadvid}: ${item.error}`).join(' | ') || 'Không lấy được snapshot dashboard'
        };
    }

    merged.roi = merged.totalCost > 0 ? Number((merged.totalGmv / merged.totalCost).toFixed(2)) : 0;
    merged.fetchedAt = Date.now();
    merged.accountErrors = accountErrors;
    return merged;
}

async function bgRunQuickRecap({ force = false, preloadedStore = null, skipBecauseReport = false, ignoreLockCheck = false } = {}) {
    if (!ignoreLockCheck) {
        const lockStore = await chrome.storage.local.get(['strangetts_manual_batch_lock', 'strangetts_rp_lock']);
        const manualLock = lockStore.strangetts_manual_batch_lock;
        const reportLock = lockStore.strangetts_rp_lock;
        const manualLockActive = !!(manualLock && manualLock.running && (Date.now() - manualLock.startedAt) < (15 * 60 * 1000));
        const reportLockActive = !!(reportLock && reportLock.running && (Date.now() - reportLock.startedAt) < (10 * 60 * 1000));
        if (manualLockActive || reportLockActive || _manualFetchCount > 0) {
            await bgSaveQuickRecapState({
                ok: false,
                skipped: true,
                slot: force ? 'manual' : '',
                error: 'Report đang chạy, quick recap tạm dừng'
            });
            return { ok: false, error: 'Report đang chạy, quick recap tạm dừng' };
        }
    }

    const store = preloadedStore || await chrome.storage.local.get([
        'strangetts_rp_config',
        'strangetts_rp_sent',
        'strangetts_rp_shops',
        'strangetts_rp_shop_order',
        'strangetts_multi_shops',
        'strangetts_shop_order',
        STORAGE_ALERT_CONFIG
    ]);
    const sentMap = store.strangetts_rp_sent || {};
    const alertConfig = store[STORAGE_ALERT_CONFIG] || {};
    const { shops, keys } = bgGetManagedShopsFromStore(store);

    if (!keys.length) {
        await bgSaveQuickRecapState({ ok: false, error: 'Không có shop để recap', totalShops: 0, sentShops: 0 });
        return { ok: false, error: 'Không có shop để recap' };
    }

    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const today = vnNow.toLocaleDateString('en-CA');
    const nowSec = vnNow.getHours() * 3600 + vnNow.getMinutes() * 60 + vnNow.getSeconds();
    const slot = force ? 'manual' : bgGetDueQuickRecapSlot(alertConfig, sentMap, today, nowSec);

    if (!force && !slot) return { ok: false, skipped: true, reason: 'not_due' };
    if (!force && skipBecauseReport) {
        await bgLog('system', 'recap', 'idle', `⏸ Quick recap ${slot} tạm dừng vì Report đang chạy`);
        await bgSaveQuickRecapState({
            ok: false,
            skipped: true,
            slot,
            totalShops: keys.length,
            sentShops: 0,
            error: 'Bị bỏ qua vì Report đang chạy'
        });
        return { ok: false, skipped: true, reason: 'report_running' };
    }

    await bgLog('system', 'recap', 'idle', force ? '🚀 Gửi quick recap thủ công...' : `⚡ Bắt đầu quick recap slot ${slot}...`);

    const rows = [];
    const failedDetails = [];
    for (const key of keys) {
        const shop = shops[key];
        if (!shop) continue;
        const shopName = shop.shopRealName || shop.name || key;
        const snap = await bgFetchQuickRecapSnapshot(shop);
        if (snap.status === 'ok') {
            if (Array.isArray(snap.accountErrors) && snap.accountErrors.length) {
                await bgLog(shop.aadvid || key, 'recap', 'warn', `⚠️ ${shopName}: thiếu ${snap.accountErrors.length} tài khoản ads khi recap`);
            }
            rows.push({
                name: shopName,
                revenue: snap.totalGmv || 0,
                orders: snap.totalOrders || 0,
                cost: snap.totalCost || 0,
                remaining: snap.remaining || 0,
                remainingKnown: !!snap.remainingKnown,
                stats: bgGetPerfStats(snap.campaigns || [])
            });
        } else {
            const detail = {
                name: shopName,
                error: snap.error || 'Không lấy được snapshot Dashboard'
            };
            failedDetails.push(detail);
            await bgLog(shop.aadvid || key, 'recap', 'warn', `⚠️ ${shopName}: ${detail.error}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    if (!rows.length) {
        const err = failedDetails.length
            ? `Không lấy được dữ liệu (${failedDetails.map(item => item.name).join(', ')})`
            : 'Không lấy được dữ liệu shop nào';
        await bgLog('system', 'recap', 'error', err);
        await bgSaveQuickRecapState({
            ok: false,
            slot,
            totalShops: keys.length,
            sentShops: 0,
            failedDetails,
            error: err
        });
        return { ok: false, error: err };
    }

    rows.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    const built = bgBuildQuickRecapMessages(rows, failedDetails);
    const messages = built.messages;

    const [tgResult, zaloResult] = await Promise.all([
        bgSendQuickRecapToTelegram(alertConfig, messages),
        bgSendQuickRecapToZalo(alertConfig, messages)
    ]);

    if (!tgResult.ok && !zaloResult.ok) {
        const err = [tgResult.error, zaloResult.error].filter(Boolean).join(' | ') || 'Chưa có kênh recap nào được cấu hình';
        await bgLog('system', 'recap', 'error', err);
        await bgSaveQuickRecapState({
            ok: false,
            slot,
            totalShops: keys.length,
            sentShops: rows.length,
            failedDetails,
            error: err,
            telegramError: tgResult.error || '',
            zaloError: zaloResult.error || '',
            recapMessages: built.recapMessages.length,
            adsMessages: built.adsMessages.length,
            errorMessages: built.errorMessages.length
        });
        return { ok: false, error: err, sentShops: rows.length };
    }

    if (!force && slot !== 'manual') {
        const nextSent = { ...sentMap, [`__quick_recap_${slot}`]: today };
        await chrome.storage.local.set({ strangetts_rp_sent: nextSent });
    }

    await bgSaveQuickRecapState({
        ok: failedDetails.length === 0,
        slot,
        totalShops: keys.length,
        sentShops: rows.length,
        failedDetails,
        error: failedDetails.length ? `Thiếu dữ liệu ${failedDetails.length} shop` : '',
        telegram: tgResult.ok,
        zalo: zaloResult.ok,
        telegramError: tgResult.error || '',
        zaloError: zaloResult.error || '',
        recapMessages: built.recapMessages.length,
        adsMessages: built.adsMessages.length,
        errorMessages: built.errorMessages.length
    });

    await bgLog(
        'system',
        'recap',
        'success',
        `✅ Quick recap ${force ? 'manual' : slot}: ${rows.length}/${keys.length} shop | TG ${tgResult.ok ? 'OK' : 'skip'} | Zalo ${zaloResult.ok ? 'OK' : 'skip'}`
    );
    return {
        ok: true,
        partial: failedDetails.length > 0,
        sentShops: rows.length,
        failedShops: failedDetails.length,
        telegram: tgResult.ok,
        zalo: zaloResult.ok,
        telegramError: tgResult.error || '',
        zaloError: zaloResult.error || ''
    };
}

function bgBuildReportMessage(data, cfg, shopName) {
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const timeStr = `${String(vnNow.getHours()).padStart(2, '0')}:${String(vnNow.getMinutes()).padStart(2, '0')}`;
    const ydDate = new Date(vnNow.getTime() - 86400000);
    const ydDateStr = `${String(ydDate.getDate()).padStart(2, '0')}/${String(ydDate.getMonth() + 1).padStart(2, '0')}`;
    const todayFull = `${String(vnNow.getDate()).padStart(2, '0')}/${String(vnNow.getMonth() + 1).padStart(2, '0')}/${vnNow.getFullYear()}`;
    const monthStr = `${String(vnNow.getMonth() + 1).padStart(2, '0')}/${vnNow.getFullYear()}`;

    const fmt = (n) => { if (!n || n === 0) return '0'; return Math.round(Number(n)).toLocaleString('vi-VN'); };
    const pct = (cost, rev) => rev > 0 ? (cost / rev * 100).toFixed(0) + '%' : '—';
    const roi = (rev, cost) => cost > 0 ? (rev / cost).toFixed(2) : '—';
    const roiEmoji = (rev, cost) => {
        if (!cost || cost === 0) return '';
        const r = rev / cost;
        if (r >= 5) return ' 🔥';
        if (r >= 3) return ' 📈';
        if (r >= 2) return ' 📊';
        if (r < 1) return ' ⚠️';
        return '';
    };

    const td = data.today || {}, tdAds = data.adsToday || {}, yd = data.yesterday || {}, ydAds = data.adsYesterday || {}, w7 = data.stats7d || {}, w7Ads = data.ads7d || {}, mo = data.monthly || {}, moAds = data.adsMonth || {};
    const hasAccountFlags = ('_balanceLoaded' in data) || ('_billingLoaded' in data) || ('_dueDateLoaded' in data) || ('_accountInfoLoaded' in data);
    const balanceKnown = hasAccountFlags ? !!data._balanceLoaded : (data.balance != null || data.credit != null);
    const thresholdKnown = hasAccountFlags ? (!!data._dueDateLoaded || (data.threshold || 0) > 0) : ((data.threshold || 0) > 0 || data.billingType === 2);

    const tdRev = td.revenue || 0;
    const ydRev = yd.revenue || 0;
    const w7Rev = w7.revenue || 0;
    const moRev = mo.revenue || 0;
    const tdCost = tdAds.cost || 0;
    const ydCost = ydAds.cost || 0;
    const w7Cost = w7Ads.cost || 0;
    const moCost = moAds.cost || 0;
    const SEP = '─────────────────────';
    const targetRev = bgReadMoney(cfg.targetRevenue);
    const targetAdsPct = bgReadPct(cfg.targetAdsPct);
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
        if (forecastRev >= targetRev) return ` (✅ đạt ${bgFmtPct(ratio)} mục tiêu)`;
        return ` (⚠️ mới đạt ${bgFmtPct(ratio)} mục tiêu)`;
    })();
    const adsTargetStatus = (() => {
        if (targetAdsPct <= 0 || forecastAdsPct === null) return '';
        const diff = Math.abs(forecastAdsPct - targetAdsPct) / targetAdsPct * 100;
        if (forecastAdsPct <= targetAdsPct) return ` (✅ thấp hơn mục tiêu ${bgFmtPct(diff)})`;
        return ` (⚠️ vượt mục tiêu ${bgFmtPct(diff)})`;
    })();

    let msg = `📋 BÁO CÁO DỮ LIỆU VẬN HÀNH\n`;
    msg += `🛍️ ${shopName}\n`;
    msg += `🕐 Cập nhật lúc: ${timeStr} · ${todayFull}\n`;
    msg += `${SEP}\n\n`;

    // HÔM NAY
    msg += `☀️ HÔM NAY\n`;
    msg += `   Đơn: ${fmt(td.orders || 0)}  |  Doanh thu: ${fmt(tdRev)}đ\n`;
    msg += `   Ads: ${fmt(tdCost)}đ  |  ROI: ${roi(tdRev, tdCost)}${roiEmoji(tdRev, tdCost)}  (${pct(tdCost, tdRev)})\n\n`;

    // HÔM QUA
    msg += `🌙 HÔM QUA (${ydDateStr})\n`;
    msg += `   Đơn: ${fmt(yd.orders || 0)}  |  Doanh thu: ${fmt(ydRev)}đ\n`;
    msg += `   Ads: ${fmt(ydCost)}đ  |  ROI: ${roi(ydRev, ydCost)}${roiEmoji(ydRev, ydCost)}  (${pct(ydCost, ydRev)})\n\n`;

    // 7 NGÀY
    msg += `🗃 7 NGÀY QUA\n`;
    msg += `   Đơn: ${fmt(w7.orders || 0)}  |  Doanh thu: ${fmt(w7Rev)}đ\n`;
    msg += `   Ads: ${fmt(w7Cost)}đ  |  ROI: ${roi(w7Rev, w7Cost)}${roiEmoji(w7Rev, w7Cost)}  (${pct(w7Cost, w7Rev)})\n\n`;

    // THÁNG
    msg += `📅 THÁNG ${monthStr}\n`;
    msg += `   Đơn: ${fmt(mo.orders || 0)}  |  Doanh thu: ${fmt(moRev)}đ\n`;
    msg += `   Ads: ${fmt(moCost)}đ  |  ROI: ${roi(moRev, moCost)}${roiEmoji(moRev, moCost)}  (${pct(moCost, moRev)})\n`;

    // NGÂN SÁCH
    msg += `\n${SEP}\n`;
    const isPostpay = data.billingType === 2 || (data.threshold || 0) > 0;
    if (isPostpay) {
        const threshold = data.threshold || 0;
        const used = data.thresholdSpent || 0;
        const usedPct = threshold > 0 ? (used / threshold * 100) : 0;
        msg += `💳 Tài khoản: Trả sau\n`;
        if (thresholdKnown) {
            msg += `   Ngưỡng: ${fmt(threshold)}đ · Đã tiêu: ${fmt(used)}đ (${usedPct.toFixed(1)}%)\n`;
        } else {
            msg += `   Ngưỡng: chưa tải được\n`;
        }
        if (balanceKnown) {
            msg += `   Số dư: ${fmt((data.balance || 0) + (data.credit || 0))}đ (TM: ${fmt(data.balance || 0)} + Tín: ${fmt(data.credit || 0)})`;
        } else {
            msg += `   Số dư: chưa tải được`;
        }
        if (thresholdKnown && usedPct > 60) {
            msg += `\n⚠️ Anh chị vui lòng kiểm tra số dư thẻ hoặc chủ động thanh toán cho TIKTOK tránh gián đoạn quá trình chạy!`;
        }
    } else {
        msg += `💳 Tài khoản: Trả trước\n`;
        if (balanceKnown) {
            const total = (data.balance || 0) + (data.credit || 0);
            msg += `   Số dư: ${fmt(total)}đ · TM: ${fmt(data.balance || 0)} + Tín: ${fmt(data.credit || 0)}`;
            if (total < 500000) {
                msg += `\n⚠️ Anh chị vui lòng kiểm tra số dư thẻ hoặc nạp thêm tiền tránh gián đoạn quá trình chạy!`;
            }
        } else {
            msg += `   Số dư: chưa tải được`;
        }
    }
    msg += `\n\n${SEP}\n`;
    msg += `🎯 Mục tiêu tháng này\n`;
    msg += `   Doanh thu: ${targetRev > 0 ? fmt(targetRev) + 'đ' : 'chưa đặt'}  |  Ads: ${targetAdsPct > 0 ? bgFmtPct(targetAdsPct) : 'chưa đặt'}\n`;
    msg += `🔮 Dự kiến đạt\n`;
    msg += `   Doanh thu: ${fmt(forecastRev)}đ${revTargetStatus}\n`;
    msg += `   Ads: ${forecastAdsPct === null ? 'chưa đủ dữ liệu' : bgFmtPct(forecastAdsPct) + ' doanh thu'}${adsTargetStatus}`;
    return msg;
}

function bgGetFetchBudgetMs(customTimeoutMs) {
    const n = Number(customTimeoutMs);
    if (Number.isFinite(n) && n > 0) return Math.max(20000, n);
    return 45000;
}

function bgRemainingMs(deadlineAt) {
    return Math.max(0, deadlineAt - Date.now());
}

function bgAllocateTimeout(deadlineAt, preferredMs, minMs = 3000) {
    const remaining = bgRemainingMs(deadlineAt);
    if (remaining <= 1500) return 0;
    return Math.max(minMs, Math.min(preferredMs, Math.max(1500, remaining - 250)));
}

async function bgFetchJsonWithTimeout(url, options = {}, timeoutMs = 10000, label = '') {
    if (!timeoutMs || timeoutMs <= 0) {
        return { _timeout: true, _label: label || url, _reason: 'deadline_exceeded' };
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    try {
        const fetchPromise = fetch(url, {
            ...options,
            signal: controller ? controller.signal : options.signal
        });
        const response = await Promise.race([
            fetchPromise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    try { if (controller) controller.abort(); } catch (e) { }
                    const err = new Error(`timeout:${label || url}`);
                    err.name = 'AbortError';
                    reject(err);
                }, timeoutMs);
            })
        ]);
        return await response.json();
    } catch (err) {
        return {
            _timeout: err?.name === 'AbortError',
            _label: label || url,
            _reason: err?.message || 'fetch_failed'
        };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function bgIsTikTokApiOk(payload) {
    return payload && Number(payload.code) === 0 && payload.data !== undefined;
}

async function bgCheckSellerSessionAlive(sellerId = '', timeoutMs = 5000) {
    const id = String(sellerId || '').trim();
    if (!id) return false;
    const url = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/tt_list?locale=vi&language=vi&oec_seller_id=${encodeURIComponent(id)}`;
    const res = await bgFetchJsonWithTimeout(
        url,
        { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' }, credentials: 'include' },
        timeoutMs,
        `seller_session_check:${id}`
    );
    return bgIsTikTokApiOk(res);
}

function bgParseAdsAccountFinanceInfo({ balanceJson = null, dueDateJson = null, billingJson = null, paymentAccountJson = null } = {}) {
    const info = {};
    const isApiOk = (payload) => payload && Number(payload.code) === 0;
    if (isApiOk(balanceJson) && balanceJson.data) {
        const d = balanceJson.data;
        info._balanceLoaded = true;
        info.balance = Number(d.cash_balance_valid || d.valid_account_balance || d.cash_balance || d.available_cash_balance || 0);
        info.credit = Number(d.ad_credit_valid || d.cashback_coupon_total_balance || d.ad_credit_balance || d.credit_balance || 0);
        info.currency = d.currency || d.currency_code || 'VND';
    } else {
        info._balanceLoaded = false;
    }

    if (isApiOk(dueDateJson)) {
        info._dueDateLoaded = true;
        const item = dueDateJson.data?.due_date_items?.[0];
        if (item) {
            info.threshold = Number(item.bill_balance) || 0;
            info.thresholdSpent = Number(item.current_cost) || 0;
        }
    } else {
        info._dueDateLoaded = false;
    }

    const billingData = isApiOk(billingJson) ? billingJson.data : null;
    const paymentData = isApiOk(paymentAccountJson) ? paymentAccountJson.data : null;
    const opts = billingData?.current_billing_option ||
        billingData?.billing_options ||
        paymentData?.billing_options ||
        paymentData?.current_billing_option ||
        [];
    info._billingLoaded = !!(billingData || paymentData);
    if (opts.length > 0) {
        info.billingType = opts[0].pay_method_type || 0;
        if (info.billingType === 2 && opts[0].threshold_payment_info) {
            info.threshold = Number(opts[0].threshold_payment_info.threshold_amount) || info.threshold || 0;
            info.thresholdSpent = Number(opts[0].threshold_payment_info.current_order_amount) || info.thresholdSpent || 0;
        }
        if (!info.billingType && opts[0].threshold_payment_info) info.billingType = 2;
    }

    if (info.threshold > 0) info.billingType = 2;
    else if ((info.billingType === 0 || !info.billingType) && (info.balance > 0 || info.credit > 0)) {
        info.billingType = 1;
    }
    info._accountInfoLoaded = !!(info._balanceLoaded || info._billingLoaded || info._dueDateLoaded);
    return info;
}

function bgApplyAdsAccountFinanceInfo(target, info = {}) {
    if (!target || !info) return target;
    if (info._balanceLoaded) {
        target.balance = info.balance || 0;
        target.credit = info.credit || 0;
        target.currency = info.currency || target.currency || 'VND';
    }
    if (info._billingLoaded && info.billingType) {
        target.billingType = info.billingType;
    }
    if (info._dueDateLoaded || (info.threshold || 0) > 0) {
        target.threshold = info.threshold || target.threshold || 0;
        target.thresholdSpent = info.thresholdSpent || target.thresholdSpent || 0;
    }
    target._balanceLoaded = !!(target._balanceLoaded || info._balanceLoaded);
    target._billingLoaded = !!(target._billingLoaded || info._billingLoaded);
    target._dueDateLoaded = !!(target._dueDateLoaded || info._dueDateLoaded);
    target._accountInfoLoaded = !!(target._accountInfoLoaded || info._accountInfoLoaded);
    if (target.threshold > 0) target.billingType = 2;
    else if ((target.billingType === 0 || !target.billingType) && (target.balance > 0 || target.credit > 0)) {
        target.billingType = 1;
    }
    return target;
}

async function bgFetchAdsAccountFinanceInfo(aadvid, headers = {}, timeoutMs = 12000, labelPrefix = 'account') {
    const encoded = encodeURIComponent(aadvid);
    const commonHeaders = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        ...headers
    };
    const balanceUrl = `https://ads.tiktok.com/api/v3/i18n/statistics/transaction/balance/query/?aadvid=${encoded}&source=3&req_src=bidding`;
    const dueDateUrl = `https://ads.tiktok.com/pa/api/common/show/payment/query_due_date?aadvid=${encoded}`;
    const billingUrl = `https://ads.tiktok.com/pa/api/common/query/payment/query_available_billing_options?aadvid=${encoded}`;
    const paymentAccountUrl = `https://ads.tiktok.com/pa/api/spider/query_payment_account/?aadvid=${encoded}`;
    const [balanceRes, dueDateRes, billingRes, paymentAccountRes] = await Promise.allSettled([
        bgFetchJsonWithTimeout(balanceUrl, { headers: commonHeaders, credentials: 'include' }, timeoutMs, `${labelPrefix}:balance:${aadvid}`),
        bgFetchJsonWithTimeout(dueDateUrl, { method: 'POST', headers: { ...commonHeaders, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } }) }, timeoutMs, `${labelPrefix}:duedate:${aadvid}`),
        bgFetchJsonWithTimeout(billingUrl, { method: 'POST', headers: { ...commonHeaders, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } }) }, timeoutMs, `${labelPrefix}:billing_options:${aadvid}`),
        bgFetchJsonWithTimeout(paymentAccountUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'include' }, timeoutMs, `${labelPrefix}:payment_account:${aadvid}`)
    ]);
    return bgParseAdsAccountFinanceInfo({
        balanceJson: balanceRes.status === 'fulfilled' ? balanceRes.value : null,
        dueDateJson: dueDateRes.status === 'fulfilled' ? dueDateRes.value : null,
        billingJson: billingRes.status === 'fulfilled' ? billingRes.value : null,
        paymentAccountJson: paymentAccountRes.status === 'fulfilled' ? paymentAccountRes.value : null
    });
}

async function bgFetchBalanceApiPayload(aadvid, labelPrefix = 'balance_api') {
    const encoded = encodeURIComponent(aadvid);
    const hdrs = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    const balanceUrl = `https://ads.tiktok.com/api/v3/i18n/statistics/transaction/balance/query/?aadvid=${encoded}&source=3&req_src=bidding`;
    const billingUrl = `https://ads.tiktok.com/pa/api/common/query/payment/query_available_billing_options?aadvid=${encoded}`;
    const dueDateUrl = `https://ads.tiktok.com/pa/api/common/show/payment/query_due_date?aadvid=${encoded}`;

    const [balanceResult, billingResult, dueDateResult] = await Promise.allSettled([
        bgFetchJsonWithTimeout(balanceUrl, { credentials: 'include', headers: { 'Accept': 'application/json' } }, 12000, `${labelPrefix}:balance:${aadvid}`),
        bgFetchJsonWithTimeout(billingUrl, {
            method: 'POST',
            credentials: 'include',
            headers: hdrs,
            body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } })
        }, 12000, `${labelPrefix}:billing:${aadvid}`),
        bgFetchJsonWithTimeout(dueDateUrl, {
            method: 'POST',
            credentials: 'include',
            headers: hdrs,
            body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } })
        }, 12000, `${labelPrefix}:duedate:${aadvid}`)
    ]);

    const balanceJson = balanceResult.status === 'fulfilled' ? balanceResult.value : null;
    const billingJson = billingResult.status === 'fulfilled' ? billingResult.value : null;
    const dueDateJson = dueDateResult.status === 'fulfilled' ? dueDateResult.value : null;
    let result = {};

    if (balanceJson?.code === 0) {
        result = balanceJson;
        console.log('[Strange TTS BG] Balance OK');
    } else {
        result.error = 'balance_fail';
        console.error('[Strange TTS BG] Balance FAILED:', balanceJson || balanceResult.reason?.message);
    }

    console.log('[Strange TTS BG] Billing options response:', JSON.stringify({ code: billingJson?.code, msg: billingJson?.msg }));
    if (billingJson?.code === 0 && billingJson.data) {
        const opts = billingJson.data.current_billing_option || billingJson.data.billing_options || [];
        const payType = opts.length > 0 ? opts[0].pay_method_type : 0;
        result.billingType = payType;
        console.log('[Strange TTS BG] Billing type:', payType, payType === 2 ? 'POSTPAY' : 'PREPAID');
    }

    console.log('[Strange TTS BG] DueDate response:', JSON.stringify({ code: dueDateJson?.code, hasItems: !!(dueDateJson?.data?.due_date_items?.length) }));
    if (dueDateJson?.code === 0 && dueDateJson.data?.due_date_items?.length > 0) {
        const item = dueDateJson.data.due_date_items[0];
        result.postpay = {
            threshold: Number(item.bill_balance) || 0,
            currentCost: Number(item.current_cost) || 0,
            payMethod: item.pay_method,
            currency: item.currency?.currency || 'VND',
            endDate: item.end_date
        };
        console.log('[Strange TTS BG] POSTPAY threshold:', result.postpay);
    }

    return result;
}

// ===== BG MULTI-ACCOUNT ADS MERGE =====
// Fetch tuần tự từng TK phụ (ads_accounts) và cộng tổng 4 period Ads vào data chính.
// Chỉ cộng Ads — shop revenue/orders giữ nguyên.
async function bgMergeExtraAdsAccounts(shop, mainData, customTimeoutMs = null) {
    const mainAadvid = String(shop.aadvid || '');
    const extraAccounts = (shop.ads_accounts || [])
        .filter(a => a.aadvid && String(a.aadvid) !== mainAadvid && a.enabled !== false);

    if (extraAccounts.length === 0) return mainData;

    console.log(`[Strange TTS BG] "${shop.name}" có ${extraAccounts.length} TK phụ, fetch Ads tuần tự...`);
    const merged = { ...mainData };
    const extraTimeoutMs = customTimeoutMs ? Math.max(15000, Math.floor(customTimeoutMs * 0.6)) : null;

    const addAds = (field, src) => {
        if (!src || !src[field]) return;
        if (!merged[field]) merged[field] = { cost: 0, gmv: 0, orders: 0, roi: 0 };
        merged[field].cost = (merged[field].cost || 0) + (src[field].cost || 0);
        merged[field].gmv = (merged[field].gmv || 0) + (src[field].gmv || 0);
        merged[field].orders = (merged[field].orders || 0) + (src[field].orders || 0);
    };

    for (const acc of extraAccounts) {
        try {
            // executeCompleteShopFetch dùng globalFetchLock → tự động tuần tự, không xung đột cookie
            const res = await executeCompleteShopFetch({
                name: shop.name,
                aadvid: acc.aadvid,
                oec_seller_id: shop.oec_seller_id,
                seller_id: shop.seller_id,
                bc_id: acc.bc_id || shop.bc_id,
                cookies: shop.cookies,
                source_username: shop.source_username,
                source_shop_key: shop.source_shop_key,
                canonical_shop_id: shop.canonical_shop_id,
                cookieFingerprint: shop.cookieFingerprint,
                cookieUpdatedAt: shop.cookieUpdatedAt
            }, extraTimeoutMs, false, { needDailyAds: false, needCampaigns: false, needAccountInfo: false });
            if (!res || res.status !== 'ok') {
                console.warn(`[Strange TTS BG] TK phụ ${acc.aadvid}: lỗi fetch, bỏ qua`);
                continue;
            }
            addAds('adsToday', res);
            addAds('adsYesterday', res);
            addAds('ads7d', res);
            addAds('adsMonth', res);
            // Số dư/ngưỡng chỉ lấy từ TK chính; TK phụ chỉ cộng Ads metrics.
            console.log(`[Strange TTS BG] ✅ Cộng TK phụ "${acc.label || acc.aadvid}": hôm nay=${res.adsToday?.cost || 0}, tháng=${res.adsMonth?.cost || 0}`);
        } catch (e) {
            console.warn(`[Strange TTS BG] TK phụ ${acc.aadvid}: exception, bỏ qua —`, e.message);
        }
    }

    ['adsToday', 'adsYesterday', 'ads7d', 'adsMonth'].forEach(field => {
        if (merged[field] && merged[field].cost > 0) {
            merged[field].roi = parseFloat((merged[field].gmv / merged[field].cost).toFixed(2));
        }
    });

    merged._multiAccount = true;
    return merged;
}

// === HẬU CẦN TẢI DỮ LIỆU TUẦN TỰ (GLOBAL LOCK) ===
let globalFetchLock = Promise.resolve();
// Đếm số lượt manual fetch đang hoạt động (>0 = scheduler nên chờ)
let _manualFetchCount = 0;

async function executeCompleteShopFetch(shop, customTimeoutMs = null, isManual = false, fetchOptions = {}) {
    const aadvid = shop.aadvid;
    console.log(`[Strange TTS BG] ➕ Đưa shop ${shop.name} vào hàng đợi fetch tuần tự... (manual=${isManual})`);

    // Nếu là manual fetch: tăng biến đếm để block scheduler
    if (isManual) _manualFetchCount++;

    // Xếp hàng: Phải đợi các shop trước hoàn thành mới được chạy
    const result = await (globalFetchLock = globalFetchLock.then(async () => {
        return await _internalAtomicFetch(shop, customTimeoutMs, fetchOptions);
    }).catch(e => {
        console.error(`[Strange TTS BG] ❌ Lỗi trong hàng đợi fetch:`, e);
        return { status: 'error', error: e.message, aadvid };
    }));

    // Giải phóng manual lock
    if (isManual) _manualFetchCount = Math.max(0, _manualFetchCount - 1);

    return result;
}

async function _internalAtomicFetch(shop, customTimeoutMs, fetchOptions = {}) {
    let activeShop = await bgRefreshShopCookiesFromServer(shop, { force: false, reason: 'complete_fetch' });
    let aadvid = activeShop.aadvid;
    let cookies = activeShop.cookies || [];
    let sellerId = activeShop.oec_seller_id || activeShop.seller_id || '';
    let attempt = 0;
    const maxAttempts = 2;
    let result = { shopName: activeShop.name || aadvid, aadvid, sellerId, fetchedAt: Date.now() };
    const totalBudgetMs = bgGetFetchBudgetMs(customTimeoutMs);
    const shopDeadlineAt = Date.now() + totalBudgetMs;
    const hasMeaningfulData = (r) => (r.today?.revenue > 0) || (r.yesterday?.revenue > 0) ||
        (r.monthly?.revenue > 0) ||
        (r.adsToday?.cost > 0) || (r.adsYesterday?.cost > 0) ||
        (r.ads7d?.cost > 0) || (r.adsMonth?.cost > 0);
    const finishWithCurrentResult = (message) => {
        const finalResult = { ...result, fetchedAt: Date.now(), aadvid, sellerId };
        if (hasMeaningfulData(finalResult)) {
            finalResult.status = 'ok';
            finalResult._fetchTimedOut = true;
            finalResult._warn = finalResult._warn ? `${finalResult._warn} | ${message}` : message;
            return finalResult;
        }
        return { ...finalResult, status: 'error', error: message };
    };

    console.log(`[Strange TTS BG] 🔒 Bắt đầu tải Shop: ${activeShop.name} (SellerID: ${sellerId})`);

    while (attempt < maxAttempts) {
        attempt++;
        try {
            aadvid = activeShop.aadvid;
            cookies = activeShop.cookies || [];
            sellerId = activeShop.oec_seller_id || activeShop.seller_id || '';
            const remainingAtAttemptStart = bgRemainingMs(shopDeadlineAt);
            if (remainingAtAttemptStart <= 5000) {
                return finishWithCurrentResult(`Quá thời gian tải dữ liệu shop (${Math.round(totalBudgetMs / 1000)}s)`);
            }
            const waitTime = Math.min(attempt === 1 ? 600 : 2000, Math.max(0, remainingAtAttemptStart - 4000));
            await new Promise(r => setTimeout(r, waitTime));

            // 1. Dọn dẹp cookie TikTok cũ
            await cleanTikTokCookies();
            // 2. Nạp cookie mới của shop này
            await applyShopCookies(cookies);

            // Đợi cookie ngấm — 1500ms để đảm bảo browser sync xong trước khi gọi API
            await new Promise(r => setTimeout(r, 1500));

            const hdrs = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'x-tt-oec-region': 'VN' };
            const needAccountInfo = fetchOptions.needAccountInfo !== false;
            const statsUrl = `https://seller-vn.tiktok.com/api/v2/insights/seller/shop/overview/performance/stats`;
            // API riêng cho hôm nay + hôm qua (real-time, scenario:2)
            const todayStatsUrl = `https://seller-vn.tiktok.com/api/v2/insights/seller/shop/overview/performance/today/stats?app_name=i18n_ecom_shop&device_platform=web&use_content_type_definition=1&aid=4068&oec_seller_id=${sellerId}&seller_id=${sellerId}&locale=vi-VN&language=vi-VN&timezone_name=Asia%2FHo_Chi_Minh`;
            const balUrl = `https://ads.tiktok.com/api/v3/i18n/statistics/transaction/balance/query/?aadvid=${aadvid}&source=3&req_src=bidding`;
            const billingUrl = `https://ads.tiktok.com/pa/api/common/query/payment/query_available_billing_options?aadvid=${aadvid}`;
            const ddUrl = `https://ads.tiktok.com/pa/api/common/show/payment/query_due_date?aadvid=${aadvid}`;
            const adsBase = `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_overview_stat?locale=vi&language=vi&oec_seller_id=${sellerId}&aadvid=${aadvid}`;
            const campUrl = sellerId ? `https://seller-vn.tiktok.com/oec_ads/shopping/v1/oec/stat/post_campaign_list?locale=vi&language=vi&oec_seller_id=${sellerId}&aadvid=${aadvid}` : null;

            const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
            const todayStr = vnNow.toLocaleDateString('en-CA');
            const ydStr = new Date(vnNow.getTime() - 86400000).toLocaleDateString('en-CA');
            const tomorrowStr = new Date(vnNow.getTime() + 86400000).toLocaleDateString('en-CA');
            const dayB4YdStr = new Date(vnNow.getTime() - 2 * 86400000).toLocaleDateString('en-CA');
            const mStart = `${vnNow.getFullYear()}-${String(vnNow.getMonth() + 1).padStart(2, '0')}-01`;
            const d7Start = new Date(vnNow.getTime() - 7 * 86400000).toLocaleDateString('en-CA'); // 7 ngày trước + hôm nay = 8 ngày như TikTok
            const coreStatsTimeoutMs = bgAllocateTimeout(shopDeadlineAt, Math.min(18000, Math.floor(totalBudgetMs * 0.4)), 8000);
            const accountTimeoutMs = bgAllocateTimeout(shopDeadlineAt, Math.min(12000, Math.floor(totalBudgetMs * 0.25)), 4000);
            const adsTimeoutMs = bgAllocateTimeout(shopDeadlineAt, Math.min(15000, Math.floor(totalBudgetMs * 0.35)), 6000);
            const campaignTimeoutMs = bgAllocateTimeout(shopDeadlineAt, Math.min(15000, Math.floor(totalBudgetMs * 0.3)), 6000);

            // Fetch hôm nay + hôm qua: /today/stats scenario:2 + with_previous_period
            const fetchTodayStats = () => {
                const body = JSON.stringify({ request: { params: [{ time_descriptor: { start: todayStr, end: tomorrowStr + 'T00:00:00', scenario: 2, with_previous_period: true, granularity: '1D' }, stats_types: [1, 10, 11, 12, 20] }] } });
                return bgFetchJsonWithTimeout(todayStatsUrl, { method: 'POST', headers: hdrs, credentials: 'include', body }, coreStatsTimeoutMs, `today_stats:${aadvid}`);
            };

            // Fetch tháng/per-day lịch sử: /stats scenario:10 — LUÔN dùng granularity '1D'
            const fetchStat = (start, end, desc) => {
                const body = JSON.stringify({ request: { params: [{ time_descriptor: { start, end, timezone_offset: 25200, scenario: 10, granularity: '1D' }, stats_types: [1, 10, 12, 20] }] } });
                return bgFetchJsonWithTimeout(statsUrl, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body }, coreStatsTimeoutMs, `stat:${desc || aadvid}`);
            };

            // Fetch 7 ngày cửa hàng: scenario:4 (=TikTok dashboard) — aggregate 7D + per-day 1D trong 1 call
            const statsUrlWithId = sellerId
                ? `${statsUrl}?app_name=i18n_ecom_shop&device_platform=web&use_content_type_definition=1&aid=4068&oec_seller_id=${sellerId}&seller_id=${sellerId}&locale=vi-VN&language=vi-VN&timezone_name=Asia%2FHo_Chi_Minh`
                : statsUrl;
            const fetchShop7d = () => {
                const body = JSON.stringify({
                    request: {
                        params: [
                            { time_descriptor: { start: d7Start, end: todayStr, timezone_offset: 25200, scenario: 4, granularity: '7D', with_previous_period: true }, stats_types: [1, 4, 7, 10, 11, 12, 13, 14, 15, 20] },
                            { time_descriptor: { start: d7Start, end: todayStr, timezone_offset: 25200, scenario: 4, granularity: '1D' }, stats_types: [1, 4, 7, 10, 11, 12, 13, 14, 15, 20] }
                        ]
                    }
                });
                return bgFetchJsonWithTimeout(statsUrlWithId, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body }, coreStatsTimeoutMs, `shop7d:${aadvid}`);
            };

            // === FETCH THÁNG ===
            // TikTok dùng EXCLUSIVE end: end='ydStr'(Apr5) → data đến Apr4(today-2) ← ĐÚNG
            //                            end='dayB4YdStr'(Apr4) → data đến Apr3(today-3) ← THIẾU 1 NGÀY!
            // 1M aggregate: cho monthly total chính xác (khớp TikTok UI)
            // 1D per-day:   cho dailyStats breakdown (Google Sheets)
            const fetchShopMonth = () => {
                const body = JSON.stringify({
                    request: {
                        params: [
                            { time_descriptor: { start: mStart, end: ydStr, timezone_offset: 25200, scenario: 10, granularity: '1M', with_previous_period: true }, stats_types: [1, 4, 7, 10, 11, 12, 13, 14, 15, 20] },
                            { time_descriptor: { start: mStart, end: ydStr, timezone_offset: 25200, scenario: 10, granularity: '1D' }, stats_types: [1, 4, 7, 10, 11, 12, 13, 14, 15, 20] }
                        ]
                    }
                });
                return bgFetchJsonWithTimeout(statsUrlWithId, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body }, coreStatsTimeoutMs, `shopMonth:${aadvid}`);
            };

            const fetchAdsAccountInfo = async () => {
                if (!needAccountInfo) return {};
                const retryAccountTimeoutMs = bgAllocateTimeout(shopDeadlineAt, Math.min(15000, Math.floor(totalBudgetMs * 0.25)), 6000);
                return bgFetchAdsAccountFinanceInfo(aadvid, hdrs, retryAccountTimeoutMs, 'report_account_retry');
            };


            const [todayYdRes, stats7Res, statsMonRes, balRes, ddRes, billingRes, adsTodayRes, adsYdRes, ads7dRes, adsMonRes, campProdRes, campLiveRes] = await Promise.allSettled([
                fetchTodayStats(),                  // hôm nay + hôm qua từ /today/stats
                fetchShop7d(),                     // 7 ngày shop: scenario:4 giống TikTok dashboard (aggregate 7D + per-day 1D)
                fetchShopMonth(),                  // tháng shop: scenario:10 1M aggregate giống TikTok compass (1M = tổng tháng, 1D = per-day Sheets)
                needAccountInfo ? bgFetchJsonWithTimeout(balUrl, { headers: hdrs, credentials: 'include' }, accountTimeoutMs, `balance:${aadvid}`) : Promise.resolve(null),
                needAccountInfo ? bgFetchJsonWithTimeout(ddUrl, { method: 'POST', headers: { ...hdrs, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } }) }, accountTimeoutMs, `duedate:${aadvid}`) : Promise.resolve(null),
                needAccountInfo ? bgFetchJsonWithTimeout(billingUrl, { method: 'POST', headers: { ...hdrs, 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include', body: JSON.stringify({ Context: { platform: 1, adv_id: aadvid } }) }, accountTimeoutMs, `billing:${aadvid}`) : Promise.resolve(null),
                // Ads HÔM NAY (start=today, end=tomorrow)
                bgFetchJsonWithTimeout(adsBase, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body: JSON.stringify({ query_list: ['cost', 'onsite_roi2_shopping_sku', 'onsite_roi2_shopping_value', 'onsite_roi2_shopping'], start_time: todayStr, end_time: tomorrowStr, campaign_shop_automation_type: 2, external_type_list: ['307', '304', '305'] }) }, adsTimeoutMs, `ads_today:${aadvid}`),
                // Ads HÔM QUA (start=yesterday, end=yesterday — API TikTok inclusive nên end=ydStr để tránh gộp hôm nay)
                bgFetchJsonWithTimeout(adsBase, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body: JSON.stringify({ query_list: ['cost', 'onsite_roi2_shopping_sku', 'onsite_roi2_shopping_value', 'onsite_roi2_shopping'], start_time: ydStr, end_time: ydStr, campaign_shop_automation_type: 2, external_type_list: ['307', '304', '305'] }) }, adsTimeoutMs, `ads_yesterday:${aadvid}`),
                // Ads 7 NGÀY (start=d7Start, end=today)
                bgFetchJsonWithTimeout(adsBase, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body: JSON.stringify({ query_list: ['cost', 'onsite_roi2_shopping_sku', 'onsite_roi2_shopping_value', 'onsite_roi2_shopping'], start_time: d7Start, end_time: todayStr, campaign_shop_automation_type: 2, external_type_list: ['307', '304', '305'] }) }, adsTimeoutMs, `ads_7d:${aadvid}`),
                // Ads THÁNG: end=dayB4YdStr (today-2, inclusive) → API trả data từ mStart đến today-3.
                // Sau đó sẽ cộng adsYesterday (today-1) + adsToday vào để ra tổng tháng chính xác (không double count)
                bgFetchJsonWithTimeout(adsBase, { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body: JSON.stringify({ query_list: ['cost', 'onsite_roi2_shopping_sku', 'onsite_roi2_shopping_value', 'onsite_roi2_shopping'], start_time: mStart, end_time: dayB4YdStr, campaign_shop_automation_type: 2, external_type_list: ['307', '304', '305'] }) }, adsTimeoutMs, `ads_month:${aadvid}`),
                // Campaigns (Product)
                (campUrl && fetchOptions.needCampaigns !== false) ? bgFetchJsonWithTimeout(campUrl, { method: 'POST', headers: hdrs, credentials: 'include', body: JSON.stringify({ query_list: ["campaign_target_roi_budget"], campaign_shop_automation_type: 2, campaign_status: ["delivery_ok"], start_time: todayStr, end_time: tomorrowStr, external_type_list: ["307", "304", "305"], page: 1, page_size: 100 }) }, campaignTimeoutMs, `camp_prod:${aadvid}`) : Promise.resolve(null),
                // Campaigns (LIVE)
                (campUrl && fetchOptions.needCampaigns !== false) ? bgFetchJsonWithTimeout(campUrl, { method: 'POST', headers: hdrs, credentials: 'include', body: JSON.stringify({ query_list: ["campaign_target_roi_budget"], campaign_shop_automation_type: 2, campaign_status: ["delivery_ok"], start_time: todayStr, end_time: tomorrowStr, external_type_list: ["306"], page: 1, page_size: 100 }) }, campaignTimeoutMs, `camp_live:${aadvid}`) : Promise.resolve(null)
            ]);

            // Parse hôm nay + hôm qua từ /today/stats (1 response chứa cả 2)
            const tyS = todayYdRes.status === 'fulfilled' ? todayYdRes.value : null;
            if (tyS?.code === 0 && tyS.data?.segments) {
                // Gom tất cả timed_stats từ mọi segment
                const allTs = tyS.data.segments.flatMap(seg => seg.timed_stats || []);
                // Hôm nay: entry có start chứa todayStr
                const tdEntry = allTs.find(t => t.start && t.start.startsWith(todayStr));
                // Hôm qua: entry có start chứa ydStr
                const ydEntry = allTs.find(t => t.start && t.start.startsWith(ydStr));
                if (tdEntry) result.today = { revenue: Number(tdEntry.stats.revenue?.amount || 0), orders: tdEntry.stats.item_sold_cnt || 0 };
                if (ydEntry) result.yesterday = { revenue: Number(ydEntry.stats.revenue?.amount || 0), orders: ydEntry.stats.item_sold_cnt || 0 };
                console.log(`[Strange TTS BG] /today/stats → today=${result.today?.revenue || 0}, yesterday=${result.yesterday?.revenue || 0}`);
            } else {
                console.warn('[Strange TTS BG] /today/stats failed, code:', tyS?.code, tyS?.message);
            }

            result.stats7d = { revenue: 0, orders: 0 };
            const s7 = stats7Res.status === 'fulfilled' ? stats7Res.value : null;
            if (s7?.code === 0 && s7.data?.segments) {
                const seg7d = s7.data.segments.find(seg => seg.time_descriptor?.granularity === '7D');
                if (seg7d?.timed_stats?.[1]) {
                    result.stats7d.revenue = Number(seg7d.timed_stats[1].stats.revenue?.amount || 0);
                    result.stats7d.orders = Number(seg7d.timed_stats[1].stats.item_sold_cnt || 0);
                }
            }

            // === PARSE THÁNG ===
            // monthly.revenue/orders: lấy từ 1M aggregate (chính xác, khớp TikTok UI)
            // dailyStats: lấy từ 1D per-day (cho Google Sheets breakdown)
            // end=ydStr → data đến today-2, cộng thêm yesterday + today từ /today/stats
            result.monthly = { revenue: 0, orders: 0 };

            result.dailyStats = [];
            const mS = statsMonRes.status === 'fulfilled' ? statsMonRes.value : null;
            if (mS?.code === 0 && mS.data?.segments) {
                // 1M aggregate: timed_stats[0] = tháng trước, timed_stats[1] = tháng hiện tại đến today-2
                const seg1m = mS.data.segments.find(seg => seg.time_descriptor?.granularity === '1M');
                if (seg1m?.timed_stats) {
                    // Lấy segment của tháng hiện tại (start = mStart)
                    const curMonSeg = seg1m.timed_stats.find(t => (t.start || '').startsWith(mStart)) ||
                        seg1m.timed_stats[seg1m.timed_stats.length - 1];
                    if (curMonSeg) {
                        result.monthly.revenue = Number(curMonSeg.stats.revenue?.amount || 0);
                        result.monthly.orders = Number(curMonSeg.stats.item_sold_cnt || 0);
                        console.log(`[Strange TTS BG] 1M aggregate: revenue=${result.monthly.revenue}, start=${curMonSeg.start}`);
                    }
                }
                // 1D per-day: từng ngày từ mStart đến today-2 cho dailyStats
                const seg1d = mS.data.segments.find(seg => seg.time_descriptor?.granularity === '1D');
                if (seg1d?.timed_stats) {
                    seg1d.timed_stats.forEach(t => {
                        const rev = Number(t.stats.revenue?.amount || 0);
                        const ord = Number(t.stats.item_sold_cnt || 0);
                        const dateKey = (t.start || '').substring(0, 10);
                        if (dateKey) result.dailyStats.push({ date: dateKey, revenue: rev, orders: ord });
                    });
                }
            } else {
                console.warn('[Strange TTS BG] fetchShopMonth failed:', mS?.code, mS?.message);
            }
            // Cộng yesterday + today vào monthly (API chỉ có đến today-2, /today/stats có today & yd)
            if (result.yesterday) {
                result.monthly.revenue += result.yesterday.revenue || 0;
                result.monthly.orders += result.yesterday.orders || 0;
            }
            if (result.today) {
                result.monthly.revenue += result.today.revenue || 0;
                result.monthly.orders += result.today.orders || 0;
            }
            console.log(`[Strange TTS BG] Monthly FINAL (1M+yd+today): revenue=${result.monthly.revenue}, orders=${result.monthly.orders}, dailyDays=${result.dailyStats.length}`);

            // Thêm yesterday và today vào dailyStats (để Google Sheets có đủ data)
            if (result.yesterday) result.dailyStats.push({ date: ydStr, revenue: result.yesterday.revenue || 0, orders: result.yesterday.orders || 0 });
            if (result.today) result.dailyStats.push({ date: todayStr, revenue: result.today.revenue || 0, orders: result.today.orders || 0 });
            const seenDates = new Set();
            result.dailyStats = result.dailyStats
                .filter(s => { if (seenDates.has(s.date)) return false; seenDates.add(s.date); return true; })
                .sort((a, b) => a.date.localeCompare(b.date));

            // === DAILY ADS PER-DAY (cho Google Sheets — giống backup) ===
            if (fetchOptions.needDailyAds !== false && result.dailyStats.length > 0) {
                const remainingForDailyAds = bgRemainingMs(shopDeadlineAt);
                if (remainingForDailyAds > 7000) {
                    const dayList = result.dailyStats.map(s => s.date);
                    const dailyAdsTimeoutMs = bgAllocateTimeout(shopDeadlineAt, Math.min(6000, Math.floor(totalBudgetMs * 0.15)), 2500);
                    const dayAdsResults = await Promise.allSettled(
                        dayList.map(day => {
                            const nextDay = new Date(day + 'T00:00:00+07:00');
                            nextDay.setDate(nextDay.getDate() + 1);
                            const nextDayStr = nextDay.toLocaleDateString('en-CA');
                            const body = JSON.stringify({
                                query_list: ['cost', 'onsite_roi2_shopping_sku'],
                                start_time: day, end_time: nextDayStr,
                                campaign_shop_automation_type: 2,
                                external_type_list: ['307', '304', '305']
                            });
                            return bgFetchJsonWithTimeout(
                                adsBase,
                                { method: 'POST', headers: { ...hdrs, 'x-csrftoken': '' }, credentials: 'include', body },
                                dailyAdsTimeoutMs,
                                `daily_ads:${aadvid}:${day}`
                            );
                        })
                    );
                    result.dailyAds = dayList.map((day, i) => {
                        const r = dayAdsResults[i]?.status === 'fulfilled' ? dayAdsResults[i].value : null;
                        const cost = r?.code === 0 ? Number(r.data?.statistics?.cost || 0) : 0;
                        const orders = r?.code === 0 ? Number(r.data?.statistics?.onsite_roi2_shopping_sku || 0) : 0;
                        return { date: day, cost, orders };
                    });
                    console.log(`[Strange TTS BG] Daily ads/day: ${result.dailyAds.length} ngày`);
                } else {
                    result._warnDailyAds = 'Bỏ qua daily ads do gần hết ngân sách thời gian';
                }
            }

            // Parse ads hôm nay
            const adsTd = adsTodayRes.status === 'fulfilled' ? adsTodayRes.value : null;
            if (adsTd?.code === 0 && adsTd.data?.statistics) { let s = adsTd.data.statistics; result.adsToday = { cost: Number(s.cost || 0), orders: Number(s.onsite_roi2_shopping_sku || 0), gmv: Number(s.onsite_roi2_shopping_value || 0), roi: parseFloat(s.onsite_roi2_shopping || 0) }; }
            // Parse ads hôm qua
            const adsY = adsYdRes.status === 'fulfilled' ? adsYdRes.value : null;
            if (adsY?.code === 0 && adsY.data?.statistics) { let s = adsY.data.statistics; result.adsYesterday = { cost: Number(s.cost || 0), orders: Number(s.onsite_roi2_shopping_sku || 0), gmv: Number(s.onsite_roi2_shopping_value || 0), roi: parseFloat(s.onsite_roi2_shopping || 0) }; }
            // Parse ads 7 ngày
            const ads7d = ads7dRes.status === 'fulfilled' ? ads7dRes.value : null;
            if (ads7d?.code === 0 && ads7d.data?.statistics) { let s = ads7d.data.statistics; result.ads7d = { cost: Number(s.cost || 0), orders: Number(s.onsite_roi2_shopping_sku || 0), gmv: Number(s.onsite_roi2_shopping_value || 0), roi: parseFloat(s.onsite_roi2_shopping || 0) }; }
            // Parse ads tháng (end=ydStr exclusive → data đến today-2, cộng today+yd sau)
            const adsM = adsMonRes.status === 'fulfilled' ? adsMonRes.value : null;
            if (adsM?.code === 0 && adsM.data?.statistics) {
                let s = adsM.data.statistics;
                // Bắt đầu từ API đến today-2
                let monthCost = Number(s.cost || 0);
                let monthOrders = Number(s.onsite_roi2_shopping_sku || 0);
                let monthGmv = Number(s.onsite_roi2_shopping_value || 0);
                // Cộng thêm yesterday và today (đã lấy riêng ở adsToday/adsYesterday)
                monthCost += (result.adsToday?.cost || 0) + (result.adsYesterday?.cost || 0);
                monthOrders += (result.adsToday?.orders || 0) + (result.adsYesterday?.orders || 0);
                monthGmv += (result.adsToday?.gmv || 0) + (result.adsYesterday?.gmv || 0);
                result.adsMonth = {
                    cost: monthCost,
                    orders: monthOrders,
                    gmv: monthGmv,
                    roi: monthCost > 0 ? parseFloat((monthGmv / monthCost).toFixed(2)) : 0
                };
                console.log(`[Strange TTS BG] Ads Month (API+today+yd): cost=${result.adsMonth.cost}`);
            }

            // Parse finance from TK chính only. Extra accounts are merged later for Ads metrics only.
            let bal = balRes?.status === 'fulfilled' ? balRes.value : null;
            let dd = ddRes?.status === 'fulfilled' ? ddRes.value : null;
            let bill = billingRes?.status === 'fulfilled' ? billingRes.value : null;
            bgApplyAdsAccountFinanceInfo(result, bgParseAdsAccountFinanceInfo({ balanceJson: bal, dueDateJson: dd, billingJson: bill }));

            // Milestone (Total Budget) calculation & Campaign collection (Flattened for Dashboard)
            result.totalBudget = 0;
            result.campaigns = [];
            [campProdRes, campLiveRes].forEach(res => {
                let camp = res?.status === 'fulfilled' ? res.value : null;
                if (camp?.code === 0 && camp.data?.table) {
                    camp.data.table.forEach(c => {
                        result.totalBudget += Number(c.campaign_target_roi_budget || 0);
                        let costVal = Number(c.cost || 0);
                        let gmvVal = Number(c.onsite_roi2_shopping_value || 0);
                        let ordersVal = Number(c.onsite_roi2_shopping_sku || 0);
                        let roiVal = costVal > 0 ? (gmvVal / costVal).toFixed(2) : '0';

                        result.campaigns.push({
                            id: c.campaign_id || c.id || '',
                            name: c.campaign_name || c.name || '',
                            status: c.campaign_primary_status || c.campaign_status || '',
                            cost: costVal,
                            gmv: gmvVal,
                            orders: ordersVal,
                            roi: roiVal,
                            budget: Number(c.campaign_target_roi_budget || 0),
                            targetRoi: Number(c.template_ad_roas_bid || c.campaign_target_roi || 0),
                            billedCost: Number(c.billed_cost || 0)
                        });
                    });
                }
            });

            const tdRev = result.today?.revenue || 0;
            const ydRev = result.yesterday?.revenue || 0;
            const comboMin = tdRev + ydRev;
            const s7Rev = result.stats7d.revenue;
            const moRev = result.monthly.revenue;
            const sellerSessionOk = [tyS, s7, mS].some(bgIsTikTokApiOk);

            // Kiểm tra nhất quán CHỈ retry nếu có dữ liệu hoàn toàn sai (không block khi store chưa cập nhật)
            let isInconsistent = false;
            if (comboMin > 0 && (s7Rev < comboMin || moRev < comboMin)) { isInconsistent = true; }

            let missingBalanceInfo = needAccountInfo && !result._balanceLoaded;
            let missingThresholdInfo = needAccountInfo && result.billingType === 2 && !result._dueDateLoaded && !(result.threshold > 0);
            const canRetryFullAttempt = () => attempt < maxAttempts && bgRemainingMs(shopDeadlineAt) > 12000;

            // Retry lần 2 nếu inconsistent (TikTok API glitch)
            if (isInconsistent && canRetryFullAttempt()) {
                console.warn(`[Strange TTS BG] ⚠️ Inconsistent data attempt ${attempt}, retrying...`);
                continue;
            }
            if (missingBalanceInfo || missingThresholdInfo) {
                console.warn(`[Strange TTS BG] ⚠️ Account info missing after primary fetch for ${shop.name}, retrying account endpoints once...`, {
                    balanceLoaded: result._balanceLoaded,
                    billingLoaded: result._billingLoaded,
                    dueDateLoaded: result._dueDateLoaded,
                    billingType: result.billingType || 0
                });
                await new Promise(r => setTimeout(r, 1200));
                try {
                    const accountRetry = await fetchAdsAccountInfo();
                    if (accountRetry._balanceLoaded) {
                        result.balance = accountRetry.balance || 0;
                        result.credit = accountRetry.credit || 0;
                        result.currency = accountRetry.currency || result.currency || 'VND';
                    }
                    if (accountRetry._billingLoaded && accountRetry.billingType) {
                        result.billingType = accountRetry.billingType;
                    }
                    if (accountRetry._dueDateLoaded || (accountRetry.threshold || 0) > 0) {
                        result.threshold = accountRetry.threshold || result.threshold || 0;
                        result.thresholdSpent = accountRetry.thresholdSpent || result.thresholdSpent || 0;
                    }
                    result._balanceLoaded = !!(result._balanceLoaded || accountRetry._balanceLoaded);
                    result._billingLoaded = !!(result._billingLoaded || accountRetry._billingLoaded);
                    result._dueDateLoaded = !!(result._dueDateLoaded || accountRetry._dueDateLoaded);
                    result._accountInfoLoaded = !!(result._accountInfoLoaded || accountRetry._accountInfoLoaded);
                    if (result.threshold > 0) result.billingType = 2;
                    else if ((result.billingType === 0 || !result.billingType) && (result.balance > 0 || result.credit > 0)) {
                        result.billingType = 1;
                    }
                } catch (retryErr) {
                    console.warn(`[Strange TTS BG] Account info retry failed for ${shop.name}:`, retryErr.message);
                }
                missingBalanceInfo = needAccountInfo && !result._balanceLoaded;
                missingThresholdInfo = needAccountInfo && result.billingType === 2 && !result._dueDateLoaded && !(result.threshold > 0);
            }
            if ((missingBalanceInfo || missingThresholdInfo) && needAccountInfo && sellerSessionOk && bgRemainingMs(shopDeadlineAt) > 12000) {
                console.warn(`[Strange TTS BG] Ads account info still missing for ${shop.name}, warming ads.tiktok.com cookies...`, {
                    balanceLoaded: result._balanceLoaded,
                    billingLoaded: result._billingLoaded,
                    dueDateLoaded: result._dueDateLoaded,
                    billingType: result.billingType || 0
                });
                const warmed = await bgWarmAdsCookiesForShop(activeShop, 'complete_fetch_ads_fail', {
                    maxWaitMs: bgAllocateTimeout(shopDeadlineAt, 18000, 8000)
                });
                activeShop = warmed.shop || activeShop;
                cookies = activeShop.cookies || cookies;
                try {
                    const warmRetry = await fetchAdsAccountInfo();
                    bgApplyAdsAccountFinanceInfo(result, warmRetry);
                    if (warmRetry._accountInfoLoaded) result._adsCookieWarmup = true;
                } catch (warmErr) {
                    console.warn(`[Strange TTS BG] Account info retry after ads warmup failed for ${shop.name}:`, warmErr.message);
                }
                missingBalanceInfo = needAccountInfo && !result._balanceLoaded;
                missingThresholdInfo = needAccountInfo && result.billingType === 2 && !result._dueDateLoaded && !(result.threshold > 0);
            } else if ((missingBalanceInfo || missingThresholdInfo) && needAccountInfo && !sellerSessionOk) {
                result._warnAccount = 'Seller cookie hết hạn, bỏ qua phục hồi Ads cookie';
                console.warn(`[Strange TTS BG] Seller session also failed for ${shop.name}; skip Ads cookie warmup.`);
            }
            if ((missingBalanceInfo || missingThresholdInfo) && canRetryFullAttempt()) {
                console.warn(`[Strange TTS BG] ⚠️ Missing account info attempt ${attempt} for ${shop.name}, retrying...`, {
                    balanceLoaded: result._balanceLoaded,
                    billingLoaded: result._billingLoaded,
                    dueDateLoaded: result._dueDateLoaded,
                    billingType: result.billingType || 0
                });
                continue;
            }

            // hasAnyData: có ít nhất 1 dữ liệu hợp lệ (shop hoặc ads bất kỳ kỳ)
            const hasAnyData = (result.today?.revenue > 0) || (result.yesterday?.revenue > 0) ||
                (result.monthly?.revenue > 0) ||
                (result.adsToday?.cost > 0) || (result.adsYesterday?.cost > 0) ||
                (result.ads7d?.cost > 0) || (result.adsMonth?.cost > 0);

            if (!hasAnyData) {
                if (attempt < maxAttempts) {
                    const refreshed = await bgRefreshShopCookiesFromServer(activeShop, { force: true, reason: 'complete_fetch_empty_retry' });
                    if (refreshed && refreshed.__cookieRefreshed) {
                        activeShop = refreshed;
                        result = { shopName: activeShop.name || activeShop.aadvid, aadvid: activeShop.aadvid, sellerId: activeShop.oec_seller_id || activeShop.seller_id || '', fetchedAt: Date.now() };
                        console.warn(`[Strange TTS BG] Cookie cũ không trả dữ liệu, đã nạp cookie mới và retry: ${activeShop.name}`);
                        continue;
                    }
                }
                result.status = 'error';
                result.error = 'Không lấy được dữ liệu — cookie có thể hết hạn';
            } else {
                // Có dữ liệu → OK dù có thể inconsistent một phần (vẫn gửi báo cáo)
                if (isInconsistent) {
                    result._warn = 'Dữ liệu có thể chưa đầy đủ (TikTok API)';
                    console.warn(`[Strange TTS BG] ⚠️ Sending with partial data for ${shop.name}`);
                }
                if (missingBalanceInfo || missingThresholdInfo) {
                    result._warnAccount = 'Thiếu dữ liệu số dư/ngưỡng ads';
                }
                result.status = 'ok';
            }

            if (result.status === 'ok') {
                const store = await chrome.storage.local.get('strangetts_rp_data');
                const rpData = store.strangetts_rp_data || {};
                rpData[aadvid] = { ...result, fetchedAt: Date.now(), status: 'ok', _mainAadvid: aadvid };
                await chrome.storage.local.set({ strangetts_rp_data: rpData });
            }

            console.log(`[Strange TTS BG] 🔓 Hoàn thành & Mở khóa cho shop: ${shop.name}`);
            return result;

        } catch (err) {
            console.error(`[Strange TTS BG] Fetch failed (Attempt ${attempt}):`, err);
            if (attempt < maxAttempts) {
                const refreshed = await bgRefreshShopCookiesFromServer(activeShop, { force: true, reason: 'complete_fetch_exception_retry' });
                if (refreshed && refreshed.__cookieRefreshed) {
                    activeShop = refreshed;
                    continue;
                }
            }
            if (attempt >= maxAttempts) return { status: 'error', error: err.message, aadvid };
        }
    }
}

// ===== BG AUTO SEND FUNCTIONS =====

async function bgRpAutoZalo(aadvid, shop, cfg, data) {
    const groupId = cfg.zaloGroupOn !== false ? cfg.groupId : '';
    const userId = cfg.zaloUserOn !== false ? cfg.zaloUserId : '';
    if (!groupId && !userId) {
        await bgRpLog(aadvid, 'zalo', 'error', 'Thiếu Group/User ID Zalo hoặc đang tắt cả hai đích');
        return false;
    }
    const server = cfg.zaloServer || DEFAULT_ZALO_SERVER;
    const msg = bgBuildReportMessage(data, cfg, shop.shopRealName || shop.name);
    try {
        await bgRpLog(aadvid, 'zalo', 'idle', '📤 Đang gửi Zalo...');
        const payload = { message: msg };
        if (groupId) payload.group_id = groupId;
        if (userId) payload.user_id = userId;
        const res = await fetch(`${server}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.ok || json.success) {
            await bgRpLog(aadvid, 'zalo', 'success', '✅ Gửi Zalo thành công');
            return true;
        } else {
            await bgRpLog(aadvid, 'zalo', 'error', json.message || json.error || 'Lỗi server Zalo');
            return false;
        }
    } catch (e) {
        await bgRpLog(aadvid, 'zalo', 'error', `Lỗi kết nối: ${e.message}`);
        return false;
    }
}

async function bgRpAutoSheet(aadvid, shop, cfg, data) {
    const url = cfg.sheetsUrl || DEFAULT_SHEETS_URL;
    if (!url || !url.includes('script.google.com/macros')) {
        await bgRpLog(aadvid, 'sheet', 'error', 'Thiếu/sai URL Sheets');
        return false;
    }
    const shopName = shop.shopRealName || shop.name;
    const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const todayStr2 = vnNow.toLocaleDateString('en-CA');
    const ydStr = new Date(vnNow.getTime() - 86400000).toLocaleDateString('en-CA');

    // Account info (gửi một lần như accountDataRow trong Apps Script)
    const isPostpay = data.billingType === 2 || (data.threshold || 0) > 0;
    const accountInfo = {
        billingType: isPostpay ? 'Trả sau' : 'Trả trước',
        balanceTotal: (data.balance || 0) + (data.credit || 0),
        cash: data.balance || 0,
        credit: data.credit || 0,
        threshold: data.threshold || 0,
        thresholdSpent: data.thresholdSpent || 0
    };

    // Ưu tiên dailyStats (per-day cả tháng), fallback về yesterday+today
    let rows = [];
    const dailyStats = data.dailyStats || [];
    const dailyAdsArr = data.dailyAds || [];
    const hasDailyAds = dailyAdsArr.length > 0;
    const dailyAdsMap = {};
    dailyAdsArr.forEach(a => { dailyAdsMap[a.date] = a; });
    const ydAdsCost = data.adsYesterday?.cost || 0;

    if (dailyStats.length > 0) {
        rows = dailyStats
            .filter(s => (s.revenue > 0 || s.orders > 0) && s.date <= todayStr2)
            .map(s => {
                const [y, m, d] = s.date.split('-');
                let adsForDay;
                if (hasDailyAds) {
                    adsForDay = dailyAdsMap[s.date]?.cost || 0;
                } else {
                    adsForDay = (s.date === ydStr) ? ydAdsCost
                        : (s.date === todayStr2) ? (data.adsToday?.cost || 0) : 0;
                }
                return {
                    date: `${d}/${m}/${y}`,
                    revenue: s.revenue,
                    orders: s.orders,
                    adsCost: adsForDay,
                    adsPct: s.revenue > 0 ? parseFloat((adsForDay / s.revenue * 100).toFixed(2)) : 0,
                    ...accountInfo
                };
            });
    } else {
        if (data.yesterday) {
            const [y, m, d] = ydStr.split('-');
            rows.push({ date: `${d}/${m}/${y}`, revenue: data.yesterday.revenue || 0, orders: data.yesterday.orders || 0, adsCost: ydAdsCost, adsPct: data.yesterday.revenue > 0 ? parseFloat((ydAdsCost / data.yesterday.revenue * 100).toFixed(2)) : 0, ...accountInfo });
        }
    }

    if (!rows.length) {
        await bgRpLog(aadvid, 'sheet', 'error', 'Không có dữ liệu để gửi');
        return false;
    }

    const payload = { shop: shopName, rows };
    try {
        await bgRpLog(aadvid, 'sheet', 'idle', `📊 Đang gửi ${rows.length} dòng lên Sheets...`);
        // Từ SW: dùng redirect:'follow' + application/json — SW bypass CORS tự động
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });
        let json = {};
        try { json = await res.json(); } catch { json = {}; }
        const isOk = json.ok === true || json.success === true || (json.rows_written > 0) || (res.status === 200 && !json.error);
        if (isOk) {
            await bgRpLog(aadvid, 'sheet', 'success', `✅ Sheets OK: ${json.rows_written || rows.length} dòng`);
            return true;
        } else {
            const errDetail = json.error || `HTTP ${res.status}`;
            await bgRpLog(aadvid, 'sheet', 'error', `Lỗi: ${errDetail}`);
            return false;
        }
    } catch (e) {
        await bgRpLog(aadvid, 'sheet', 'error', `Lỗi kết nối: ${e.message}`);
        return false;
    }
}

async function bgRpAutoTelegram(aadvid, shop, cfg, data) {
    const token = cfg.tgToken || DEFAULT_TG_TOKEN;
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
        await bgRpLog(aadvid, 'tg', 'idle', '— Tắt hoặc thiếu ID Telegram');
        return false;
    }

    const msg = bgBuildReportMessage(data, cfg, shop.shopRealName || shop.name);
    let successCount = 0;
    let lastError = '';

    for (const target of targets) {
        const cid = target.chatId;
        const threadId = target.threadId;
        try {
            const payload = { chat_id: cid.trim(), text: msg, parse_mode: 'HTML' };
            if (threadId) {
                const parsedThreadId = Number(threadId);
                if (Number.isFinite(parsedThreadId) && parsedThreadId > 0) payload.message_thread_id = parsedThreadId;
            }
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.ok) {
                successCount++;
            } else {
                lastError = json.description || 'Lỗi API';
            }
        } catch (e) {
            lastError = e.message;
        }
        await new Promise(r => setTimeout(r, 1000)); // Delay chống spam
    }

    if (successCount > 0) {
        await bgRpLog(aadvid, 'tg', 'success', `✅ Gửi Telegram thành công (${successCount} mục tiêu)`);
        return true;
    } else {
        await bgRpLog(aadvid, 'tg', 'error', `❌ Thất bại: ${lastError}`);
        return false;
    }
}

async function bgFetchShopReport(shop) {
    return executeCompleteShopFetch(shop);
}

// ==============================================
// 24/7 PERSISTENCE: OFFSCREEN MANAGEMENT
// ==============================================
let creatingOffscreen; // A global promise to avoid race conditions creating multiple offscreen documents

async function setupOffscreen() {
    if (!chrome.runtime.getContexts || !chrome.offscreen || !chrome.offscreen.createDocument) {
        console.warn('[Strange TTS BG] Offscreen API unavailable; skip keep-alive setup.');
        return;
    }
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        return;
    }

    // Create offscreen document
    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: 'pages/offscreen.html',
            // AUDIO_PLAYBACK is the most robust reason for 24/7 background persistence
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Keep service worker alive 24/7 for automated reporting on VPS'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
        console.log('[Strange TTS BG] Offscreen (Audio) created successfully.');
        await bgLog('system', 'offscreen', 'success', '🔈 Đã kích hoạt Offscreen Audio (Keep Alive 24/7)');
    }
}

function safeSetupOffscreen() {
    try {
        setupOffscreen().catch(err => {
            console.warn('[Strange TTS BG] Offscreen setup skipped:', err?.message || err);
            creatingOffscreen = null;
        });
    } catch (err) {
        console.warn('[Strange TTS BG] Offscreen setup unavailable:', err?.message || err);
        creatingOffscreen = null;
    }
}

// Initial setup on startup
chrome.runtime.onStartup.addListener(() => {
    safeSetupOffscreen();
});

// Setup on installation/update
chrome.runtime.onInstalled.addListener(() => {
    safeSetupOffscreen();
    // Ensure alarm is created
    chrome.alarms.create('strangetts_rp_check', { periodInMinutes: 1 });
});

// Removed redundant onMessage listener (moved keep_alive_ping to main listener)

// Periodically check if offscreen is still there (e.g. every 5 mins via alarm)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'strangetts_rp_check') {
        safeSetupOffscreen();
    }
});

// Attempt to setup offscreen immediately when this script loads
setTimeout(safeSetupOffscreen, 1000);
