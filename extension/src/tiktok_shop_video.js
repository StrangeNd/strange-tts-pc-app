(function () {
    const host = location.hostname || '';
    if (!/(^|\.)tiktok\.com$/i.test(host)) return;
    if (/seller|ads|business|shop/i.test(host)) return;
    if (new URLSearchParams(location.search).get('strangetts_product_probe') === '1' || location.hash === '#strangetts_product_probe=1') return;

    const SHOP_VIDEO_TOGGLE_KEY = 'strangetts_shop_video_enabled';
    const PLAYER_ID = 'strangetts-shop-video-player';
    const PRODUCT_CARD_ID = 'strangetts-shop-product-card';
    const BLOCKER_STYLE_ID = 'strangetts-shop-video-blocker-style';
    const PRODUCT_ICON = '🛒';
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

    let shopVideoEnabled = false;
    let scheduled = false;
    let lastVideoKey = currentVideoId() || location.pathname;
    let forceShopFallbackUntil = 0;
    let unlockState = 'idle';
    let injectedPayload = null;
    let reinjectTimer = null;
    const fetching = new WeakSet();
    const videoState = new Map();
    const productCache = new Map();
    const productFetchInFlight = new Map();
    const productMissUntil = new Map();
    let productRetryToken = '';

    function safeText(v) {
        return String(v || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function isBadProductTitle(value) {
        return /(?:^|\s)(âm thanh gốc|am thanh goc|original sound|nhạc nền|nhac nen|music|sound)(?:\s|$|-)/i.test(String(value || ''));
    }

    function isProductLikeUrl(value) {
        return /\/shop\/|\/pdp\/|product_id|product%5Fid|tcm|ecommerce|ec_/i.test(String(value || ''));
    }

    function productLog(...args) {
        try { console.info('[STRANGE TTS Product]', ...args); } catch (e) { }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function currentVideoId(url = location.href) {
        const m = String(url || '').match(/\/video\/(\d+)/) || String(url || '').match(/\/v\/(\d+)/);
        return m ? m[1] : '';
    }

    function isVideoPage(url = location.href) {
        return /\/video\/\d+|\/v\/\d+/i.test(url);
    }

    function isNearViewport(el) {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > -600 && r.top < window.innerHeight + 600;
    }

    function isPhotoPost(wrapper) {
        const html = wrapper.innerHTML || '';
        return wrapper.querySelector('[class*="DivImageContainer"]') || /\/photo\//i.test(location.href) || /photo/i.test(html);
    }

    function activeVideo(root = document) {
        const videos = Array.from(root.querySelectorAll('video'));
        if (!videos.length) return null;
        const mid = window.innerHeight / 2;
        return videos.map(video => {
            const r = video.getBoundingClientRect();
            const visibleH = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
            const visibleW = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
            const area = visibleH * visibleW;
            const centerGap = Math.abs((r.top + r.bottom) / 2 - mid);
            const score = (video.paused ? 0 : 1000000) + (video.readyState >= 2 ? 100000 : 0) + area - centerGap;
            return { video, score };
        }).sort((a, b) => b.score - a.score)[0].video;
    }

    function findVideoUrl(wrapper) {
        const container = wrapper.closest('[data-e2e="recommend-list-item-container"], [class*="DivItemContainer"], article') || wrapper;
        const anchors = [
            container.querySelector('a[href*="/video/"], a[href*="/v/"]'),
            document.querySelector('a[href*="/video/"], a[href*="/v/"]')
        ];
        for (const a of anchors) {
            if (a && a.href) return a.href;
        }
        if (isVideoPage(location.href)) return location.href;
        return '';
    }

    function hasBlockerText(el) {
        const text = (el && el.innerText) || '';
        return /View\s+TikTok\s+Shop\s+videos[\s\S]{0,90}TikTok\s+app|Xem\s+video\s+TikTok\s+Shop[\s\S]{0,90}(?:TikTok\s+app|ứng\s+dụng|ung\s+dung)|TikTok Shop[\s\S]{0,90}(?:không khả dụng|bị giới hạn|unavailable|restricted|not available)/i.test(text);
    }

    function hasCompactBlockerText(el) {
        const text = ((el && el.innerText) || '').trim();
        return text.length > 0 && text.length <= 260 && hasBlockerText(el);
    }

    function pageHasBlockerText() {
        return hasBlockerText(document.body);
    }

    function looksBlocked(wrapper, vid) {
        if (isPhotoPost(wrapper) && !vid) return false;
        const noSource = !vid || (!vid.src && !vid.currentSrc && !vid.querySelector('source')) || (vid.readyState === 0 && !vid.getAttribute('src'));
        return noSource || hasBlockerText(wrapper);
    }

    function findPlayerContainer() {
        const selectors = [
            '[data-e2e="feed-video"]',
            '[data-e2e="browse-video-player"]',
            '[data-e2e="video-player-wrapper"]',
            '[data-e2e="feed-video-player"]',
            '[data-e2e="video-detail-player"]',
            '[data-e2e="video-player"]',
            '[class*="DivBasicPlayer"]',
            '[class*="DivVideoContainerForDetail"]',
            '[class*="SectionMediaCardContainer"]',
            '[class*="DivVideoContainer"]:not([class*="Wrapper"])',
            '[class*="DivVideoWrapper"]',
            '[class*="DivPlayerContainer"]',
            '[data-e2e="recommend-list-item-container"]',
            '.video-container'
        ];
        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                const r = el.getBoundingClientRect();
                if (r.width >= 250 && r.height >= 250 && r.bottom > 0 && r.top < window.innerHeight) return el;
            }
        }
        const video = activeVideo();
        let p = video && video.parentElement;
        for (let i = 0; p && i < 8; i++, p = p.parentElement) {
            const r = p.getBoundingClientRect();
            if (r.width >= 250 && r.height >= 250 && r.width <= window.innerWidth * 0.9) return p;
        }
        return null;
    }

    function isGoodUnlockContainer(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 300 || r.height < 300 || r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const centerX = r.left + r.width / 2;
        if (centerX > window.innerWidth * 0.95) return false;
        if (r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9) return false;
        if (el.querySelector('[data-e2e*="comment"], [class*="CommentContainer"], [class*="CommentList"], [class*="EmptyStateWrapper"]')) return false;
        const className = (el.className && el.className.toString ? el.className.toString() : '');
        if (/\bDivVideoContainer\b|\bDivBasicPlayer\b|\bDivBrowserModeContainer\b|\bDivVideoContainerForDetail\b|\bxgplayer\b/.test(className)) return true;
        const hasVideo = !!el.querySelector('video');
        const hasBlock = hasBlockerText(el);
        const text = el.textContent || '';
        const isLikelyMainVideo = isVideoPage() &&
            r.width >= 420 &&
            r.width <= window.innerWidth * 0.78 &&
            r.height >= 420 &&
            r.height <= window.innerHeight * 0.98 &&
            centerX < window.innerWidth * 0.6 &&
            text.length < 260 &&
            ((style.backgroundColor || '').includes('0, 0, 0') || style.backgroundColor === 'black' || !!el.querySelector('button,[role="button"],svg'));
        return hasVideo || hasBlock || isLikelyMainVideo;
    }

    function blockerContainerFromText() {
        const nodes = document.querySelectorAll('div,span,button,a,p');
        for (const node of nodes) {
            if (!hasCompactBlockerText(node)) continue;
            let overlay = node;
            let cur = node;
            for (let i = 0; i < 10 && cur; i++, cur = cur.parentElement) {
                const style = getComputedStyle(cur);
                if (style.position === 'absolute' || style.position === 'fixed') {
                    overlay = cur;
                    break;
                }
            }
            const parent = overlay.parentElement;
            if (parent && parent.getBoundingClientRect().width >= 150 && parent.getBoundingClientRect().height >= 200) return parent;
        }
        return null;
    }

    function findUnlockContainer() {
        const selectors = [
            '[data-e2e="feed-video"]',
            '[data-e2e="browse-video-player"]',
            '[data-e2e="video-player-wrapper"]',
            '[data-e2e="feed-video-player"]',
            '[data-e2e="video-detail-player"]',
            '[data-e2e="video-player"]',
            'xg-video-container',
            '[class*="xgplayer"]:not([class*="skin"])',
            '[class*="DivBasicPlayer"]',
            '[class*="DivVideoContainerForDetail"]',
            '[class*="SectionMediaCardContainer"]',
            '[class*="DivVideoContainer"]:not([class*="Wrapper"])',
            '[data-e2e="browse-video"]',
            '[data-e2e="video-item"]',
            '[class*="DivVideoWrapper"]',
            '[class*="DivPlayerContainer"]',
            '[class*="DivBrowserModeContainer"] [class*="DivVideoWrapper"]',
            '[role="dialog"] [class*="DivVideoWrapper"]',
            '[data-e2e="recommend-list-item-container"]',
            '.video-container'
        ];
        for (const selector of selectors) {
            for (const el of document.querySelectorAll(selector)) {
                if (isGoodUnlockContainer(el)) return el;
            }
        }

        const video = activeVideo();
        if (video) {
            let node = video.parentElement;
            let best = null;
            let bestArea = 0;
            for (let i = 0; node && i < 8; i++, node = node.parentElement) {
                if (isGoodUnlockContainer(node)) {
                    const r = node.getBoundingClientRect();
                    if (r.width <= window.innerWidth * 0.75 && r.width * r.height > bestArea) {
                        best = node;
                        bestArea = r.width * r.height;
                    }
                }
            }
            if (best) return best;
        }

        const fromBlocker = blockerContainerFromText();
        if (fromBlocker && isGoodUnlockContainer(fromBlocker)) return fromBlocker;

        let best = null;
        let bestArea = 0;
        for (const el of document.querySelectorAll('div,section,article')) {
            if (!isGoodUnlockContainer(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width > window.innerWidth * 0.75 || r.height > window.innerHeight * 1.5) continue;
            const cls = (el.className && el.className.toString ? el.className.toString() : '').toLowerCase();
            const e2e = (el.getAttribute('data-e2e') || '').toLowerCase();
            if (cls.includes('usercontainer') || cls.includes('basebody') || cls.includes('sharelayout') || e2e === 'user-page' || e2e === 'recommend-list-container') continue;
            const area = r.width * r.height;
            if (area > bestArea) {
                best = el;
                bestArea = area;
            }
        }
        if (best) return best;

        if (isVideoPage() && video) {
            let node = video.parentElement;
            for (let i = 0; node && i < 8; i++, node = node.parentElement) {
                const r = node.getBoundingClientRect();
                if (r.width >= 300 && r.height >= 400 && r.width <= window.innerWidth * 0.75 && r.bottom > 0 && r.top < window.innerHeight) return node;
            }
        }
        return null;
    }

    function isPortraitSurface(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 240 || r.height < 300 || r.bottom <= 0 || r.top >= window.innerHeight) return false;
        const ratio = r.width / r.height;
        if (ratio < 0.35 || ratio > 0.9) return false;
        const text = (el.innerText || '').trim();
        if (text.length > 500 && !hasBlockerText(el)) return false;
        return true;
    }

    function findCompactVideoSurface(base, oldVideo) {
        let best = null;
        let bestArea = 0;
        let node = oldVideo && oldVideo.parentElement;
        for (let i = 0; node && i < 10; i++, node = node.parentElement) {
            if (isPortraitSurface(node)) {
                const r = node.getBoundingClientRect();
                const area = r.width * r.height;
                if (area > bestArea) {
                    best = node;
                    bestArea = area;
                }
            }
            if (node === base) break;
        }
        const candidates = (base || document).querySelectorAll('div,section,article,[data-e2e*="video" i],[class*="Video" i],[class*="Player" i]');
        for (const el of candidates) {
            if (!isPortraitSurface(el)) continue;
            const hasVideo = !!el.querySelector('video');
            const hasBlock = hasBlockerText(el);
            if (!hasVideo && !hasBlock) continue;
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            if (area > bestArea) {
                best = el;
                bestArea = area;
            }
        }
        return best;
    }

    function hideBlocker() {
        if (!document.getElementById(BLOCKER_STYLE_ID)) {
            const style = document.createElement('style');
            style.id = BLOCKER_STYLE_ID;
            style.textContent = [
                '[class*="RegionBlock"],[class*="ShopBlock"],[class*="ShopVideoBlocker"],',
                '[class*="DivShopVideoOverlay"],[class*="video-region-block"],',
                '[data-e2e*="shop-video-blocker"],[data-e2e*="region-block"]{display:none!important;}'
            ].join('');
            document.head.appendChild(style);
        }
        document.querySelectorAll('div,span,button,a,p').forEach(el => {
            if (!hasCompactBlockerText(el)) return;
            const pop = el.closest('[data-floating-ui-portal], .TUXToast');
            if (pop) pop.style.setProperty('display', 'none', 'important');
            else el.style.setProperty('display', 'none', 'important');
        });
    }

    function isNativeVideoPlayable(video) {
        if (!video) return false;
        const src = video.currentSrc || video.src;
        return !!(src && src !== 'about:blank' && !video.error && video.videoWidth >= 50 && video.duration && !isNaN(video.duration) && video.duration >= 2);
    }

    async function nativeProbe(timeoutMs) {
        const end = Date.now() + timeoutMs;
        while (Date.now() < end) {
            if (pageHasBlockerText()) return false;
            const video = activeVideo();
            if (video) {
                const r = video.getBoundingClientRect();
                const shapeOk = r.width >= 300 && r.height >= 300 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
                if (shapeOk && isNativeVideoPlayable(video)) {
                const before = video.currentTime || 0;
                if (video.paused) {
                    try { await video.play(); } catch (e) { return false; }
                }
                    await sleep(700);
                    return !video.paused && video.currentTime > before + 0.15;
                }
            }
            await sleep(250);
        }
        return false;
    }

    async function nativeCanPlay(video) {
        if (!video) return false;
        const r = video.getBoundingClientRect();
        const hasShape = r.width >= 250 && r.height >= 250 && r.bottom > 0 && r.top < window.innerHeight;
        const hasSrc = !!(video.currentSrc || video.src || video.querySelector('source'));
        if (!hasShape || !hasSrc || video.error) return false;
        if (video.readyState < 2 || !video.duration || isNaN(video.duration)) return false;
        const before = video.currentTime || 0;
        try {
            await video.play();
        } catch (e) {
            return false;
        }
        await sleep(450);
        return !video.paused && video.currentTime >= before;
    }

    function makeLoader() {
        const loader = document.createElement('div');
        loader.className = 'strangetts-shop-video-loader';
        loader.style.cssText = [
            'position:absolute', 'inset:0', 'z-index:2147483000',
            'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
            'background:rgba(0,0,0,.86)', 'color:white', 'font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
            'backdrop-filter:blur(2px)', 'border-radius:8px', 'text-align:center', 'padding:12px'
        ].join(';');
        loader.innerHTML = [
            '<div style="width:34px;height:34px;border:4px solid rgba(255,255,255,.18);border-top-color:#fe2c55;border-radius:50%;animation:strangetts-shop-spin 1s linear infinite"></div>',
            '<style>@keyframes strangetts-shop-spin{to{transform:rotate(360deg)}}</style>',
            '<div style="margin-top:12px;font-size:13px;font-weight:700">Strange TTS đang mở video Shop...</div>'
        ].join('');
        return loader;
    }

    function rememberPlayerState(videoUrl, video) {
        if (!videoUrl || !video || !Number.isFinite(video.currentTime) || video.currentTime < 0.5) return;
        videoState.set(videoUrl, {
            currentTime: video.currentTime,
            muted: video.muted,
            volume: video.volume,
            ts: Date.now()
        });
        if (videoState.size > 30) videoState.delete(videoState.keys().next().value);
    }

    function restorePlayerState(videoUrl, video) {
        const state = videoState.get(videoUrl);
        if (!state) return;
        const apply = () => {
            try {
                video.currentTime = state.currentTime || 0;
                video.muted = false;
                video.volume = Number.isFinite(state.volume) ? state.volume : video.volume;
            } catch (e) { }
        };
        if (video.readyState >= 1) apply();
        else video.addEventListener('loadedmetadata', apply, { once: true });
    }

    function armSoundUnlock(video) {
        const unlock = () => {
            try {
                video.muted = false;
                video.volume = 1;
                video.play().catch(() => { });
            } catch (e) { }
        };
        ['click', 'pointerdown', 'keydown', 'touchstart'].forEach(type => {
            document.addEventListener(type, unlock, { once: true, capture: true, passive: true });
        });
    }

    function startInjectedVideo(video, preferSound = false) {
        if (preferSound) {
            video.muted = false;
            video.volume = 1;
        }
        const run = () => {
            try {
                video.play().catch(() => {
                    if (!preferSound) return;
                    video.muted = true;
                    video.play().catch(() => { });
                    armSoundUnlock(video);
                });
            } catch (e) { }
        };
        run();
        setTimeout(run, 120);
        setTimeout(run, 450);
        setTimeout(run, 1100);
    }

    function injectVideo(wrapper, oldVideo, realUrl, coverUrl) {
        const existing = document.getElementById(PLAYER_ID);
        if (existing) {
            const old = existing.querySelector('video');
            rememberPlayerState(existing.dataset.videoUrl, old);
            existing.remove();
        }

        if (getComputedStyle(wrapper).position === 'static') wrapper.style.setProperty('position', 'relative', 'important');
        const frame = document.createElement('div');
        frame.id = PLAYER_ID;
        frame.dataset.videoUrl = realUrl;
        frame.style.cssText = [
            'position:absolute!important', 'top:0!important', 'left:0!important', 'right:0!important', 'bottom:0!important', 'z-index:2147482999!important',
            'background:#000!important', 'border-radius:8px', 'overflow:hidden',
            'box-shadow:0 0 0 1px rgba(251,146,60,.28),0 18px 50px rgba(0,0,0,.22)', 'display:block!important',
            'visibility:visible!important', 'opacity:1!important', 'pointer-events:auto!important'
        ].join(';');

        const video = document.createElement('video');
        video.src = realUrl;
        if (coverUrl) video.poster = coverUrl;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.muted = false;
        video.volume = 1;
        video.crossOrigin = 'anonymous';
        video.dataset.strangettsShopVideo = '1';
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block;';

        const badge = document.createElement('div');
        badge.textContent = 'STRANGE TTS Agency';
        badge.style.cssText = [
            'position:absolute', 'top:14px', 'left:14px', 'z-index:4',
            'display:inline-flex', 'align-items:center', 'gap:7px',
            'padding:7px 12px', 'border-radius:10px',
            'background:linear-gradient(135deg,rgba(17,24,39,.84),rgba(67,20,7,.74))',
            'border:1px solid rgba(251,146,60,.62)',
            'box-shadow:0 10px 28px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.12)',
            'color:#FDBA74', 'font:800 12px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
            'letter-spacing:.04em', 'text-transform:uppercase',
            'text-shadow:0 1px 2px rgba(0,0,0,.45)', 'pointer-events:none'
        ].join(';');
        const badgeDot = document.createElement('span');
        badgeDot.style.cssText = [
            'width:7px', 'height:7px', 'border-radius:999px',
            'background:#34D399', 'box-shadow:0 0 12px rgba(52,211,153,.9)',
            'display:inline-block', 'flex:0 0 auto'
        ].join(';');
        badge.prepend(badgeDot);

        frame.appendChild(video);
        frame.appendChild(badge);
        wrapper.appendChild(frame);
        if (oldVideo && oldVideo.parentNode && !oldVideo.dataset.strangettsShopVideo) oldVideo.style.opacity = '0';
        wrapper.dataset.strangettsShopVideoFixed = '1';
        restorePlayerState(realUrl, video);
        startInjectedVideo(video, true);
        scheduleProductRetries('inject');
    }

    function startReinjectWatch(container) {
        if (reinjectTimer) return;
        reinjectTimer = setInterval(() => {
            if (unlockState !== 'injected') {
                clearInterval(reinjectTimer);
                reinjectTimer = null;
                return;
            }
            if (!document.getElementById(PLAYER_ID) && injectedPayload) {
                const target = document.body.contains(container) ? container : findUnlockContainer();
                if (target) injectVideo(target, activeVideo(), injectedPayload.videoUrl, injectedPayload.coverUrl);
            }
        }, 1000);
    }

    function sendMessage(payload) {
        return new Promise(resolve => {
            try {
                chrome.runtime.sendMessage(payload, res => {
                    const err = chrome.runtime.lastError;
                    if (err) resolve({ ok: false, error: err.message });
                    else resolve(res || { ok: false, error: 'no response' });
                });
            } catch (e) {
                resolve({ ok: false, error: e && e.message ? e.message : String(e) });
            }
        });
    }

    async function processWrapper(wrapper) {
        if (!shopVideoEnabled) return;
        if (!wrapper || fetching.has(wrapper)) return;
        if (!isNearViewport(wrapper)) return;

        const oldVideo = wrapper.querySelector('video:not([data-strangetts-shop-video])');
        const hasOwnInjectedPlayer = !!wrapper.querySelector('#' + PLAYER_ID);
        const pageBlockedNow = pageHasBlockerText() || Date.now() < forceShopFallbackUntil;
        const blockedNow = looksBlocked(wrapper, oldVideo) || pageBlockedNow;

        if (wrapper.dataset.strangettsShopVideoFixed) {
            if (hasOwnInjectedPlayer) {
                const injectedVideo = wrapper.querySelector('#' + PLAYER_ID + ' video');
                if (injectedVideo) startInjectedVideo(injectedVideo);
                if (blockedNow) hideBlocker();
                return;
            }
            if (!blockedNow && oldVideo && (oldVideo.currentSrc || oldVideo.src) && oldVideo.readyState >= 2) return;
            delete wrapper.dataset.strangettsShopVideoFixed;
        }

        if (!blockedNow) return;

        const targetUrl = findVideoUrl(wrapper);
        if (!targetUrl) return;

        fetching.add(wrapper);
        try {
            if (!pageBlockedNow && await nativeCanPlay(oldVideo)) {
                hideBlocker();
                wrapper.dataset.strangettsShopVideoFixed = '1';
                return;
            }

            const surface = findCompactVideoSurface(wrapper, oldVideo) || wrapper;
            if (getComputedStyle(surface).position === 'static') surface.style.position = 'relative';
            const loader = makeLoader();
            surface.appendChild(loader);
            const res = await sendMessage({ action: 'STRANGETTS_TIKWM_FETCH', url: targetUrl });
            if (res && res.ok && res.data && (res.data.hdplay || res.data.play)) {
                hideBlocker();
                injectVideo(surface, oldVideo, res.data.hdplay || res.data.play, res.data.cover || res.data.origin_cover || '');
                wrapper.dataset.strangettsShopVideoFixed = '1';
                loader.remove();
            } else {
                loader.innerHTML = '<div style="color:#fb7185;font-size:13px;font-weight:800">Không mở được video này</div>';
                setTimeout(() => loader.remove(), 2200);
            }
        } catch (e) {
            // Retry on the next scan; TikTok often re-renders the blocked player.
        } finally {
            fetching.delete(wrapper);
        }
    }

    async function ensureShopVideoUnlock() {
        if (!shopVideoEnabled || !isVideoPage() || unlockState !== 'idle') return;
        unlockState = 'checking';

        const blockerAtStart = pageHasBlockerText() || Date.now() < forceShopFallbackUntil;
        const tikwmPromise = sendMessage({ action: 'STRANGETTS_TIKWM_FETCH', url: location.href });
        const primary = document.querySelector('[class*="DivVideoContainer"]:not([class*="Wrapper"]), [class*="DivBasicPlayer"], [class*="DivBrowserModeContainer"]');
        const hasVideoInPrimary = !!(primary && primary.querySelector('video'));
        const noVideo = !document.querySelector('video');
        const nativeTimeout = blockerAtStart ? 800 : (primary && !hasVideoInPrimary ? 1000 : (primary || noVideo ? 1500 : 2500));

        if (await nativeProbe(nativeTimeout)) {
            if (pageHasBlockerText()) hideBlocker();
            unlockState = 'native';
            return;
        }

        const container = findUnlockContainer();
        if (!container) {
            unlockState = 'idle';
            setTimeout(scheduleScan, 900);
            return;
        }

        hideBlocker();
        try {
            const res = await tikwmPromise;
            const videoUrl = res && res.ok && res.data && (res.data.hdplay || res.data.play);
            if (videoUrl) {
                const coverUrl = res.data.cover || res.data.origin_cover || '';
                injectedPayload = { videoUrl, coverUrl };
                injectVideo(container, activeVideo(), videoUrl, coverUrl);
                unlockState = 'injected';
                startReinjectWatch(container);
            } else {
                unlockState = 'idle';
            }
        } catch (e) {
            unlockState = 'idle';
        }
    }

    function scanShopVideos() {
        if (!shopVideoEnabled) return;
        if (pageHasBlockerText()) {
            forceShopFallbackUntil = Date.now() + 5000;
            hideBlocker();
            if (unlockState === 'native') unlockState = 'idle';
        }
        if (!isVideoPage()) return;
        if (unlockState === 'injected') {
            const player = document.getElementById(PLAYER_ID);
            if (player) {
                return;
            }
            unlockState = 'idle';
        }
        ensureShopVideoUnlock();
    }

    function productFromPlainObject(obj) {
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = productFromPlainObject(item);
                if (found) return found;
            }
            return null;
        }

        const product = obj.product && typeof obj.product === 'object' ? obj.product : {};
        const title = obj.product_name || obj.productName || obj.title || obj.name || obj.elastic_title || product.title || product.product_name;
        const price = obj.price_str || obj.format_price || obj.formatPrice || obj.price || product.price_str || product.format_price || product.price;
        const imageUrl = imageFrom(obj.cover) || imageFrom(product.cover) || obj.cover_url || obj.coverUrl || obj.image_url || obj.imageUrl || obj.image || product.cover_url || product.image;
        const rawUrl = obj.product_link || obj.productLink || obj.detail_url || obj.detailUrl || obj.actionUrl || obj.action_url || obj.schema || product.detail_url || product.product_link;
        const id = obj.product_id || obj.productId || product.product_id || product.id || product.spu_id || obj.id;
        const url = buildProductUrl(rawUrl, id, title, obj.schema || product.schema);
        const shopName = obj.shop_name || obj.shopName || obj.seller_name || obj.sellerName || product.shop_name || product.seller_name || 'TikTok Shop';

        if (title && !isBadProductTitle(title) && (url || price || imageUrl) && (isProductLikeUrl(url) || String(id || '').match(/\d{8,}/) || obj.product_id || obj.productId)) {
            return {
                id: id ? String(id) : '',
                title: String(title).slice(0, 180),
                price: price ? String(price) : '',
                imageUrl: imageUrl ? String(imageUrl) : '',
                shopName: shopName ? String(shopName) : '',
                url
            };
        }

        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
                const found = productFromPlainObject(obj[key]);
                if (found) return found;
            }
        }
        return null;
    }

    function imageFrom(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value[0] || '';
        return (value.urlList && value.urlList[0]) || (value.url_list && value.url_list[0]) || value.url || '';
    }

    function parseJson(value) {
        if (!value) return null;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (e) { return null; }
    }

    function productFromAnchors(anchors) {
        if (!Array.isArray(anchors)) return null;
        for (const anchor of anchors) {
            if (!anchor || typeof anchor !== 'object') continue;
            const extra = parseJson(anchor.extra || anchor.extra_info || anchor.extraInfo) || {};
            const logExtra = parseJson(anchor.logExtra || anchor.log_extra) || {};
            const type = String(anchor.type || anchor.id || anchor.anchorType || '');
            const productLikePayload = extra.product_id || extra.product_name || extra.price_str || extra.price ||
                extra.shop_id || extra.seller_id || logExtra.product_id || logExtra.product_name;
            if (anchor.type === 35 || anchor.id === 35 || anchor.type === 47 || anchor.type === 50) continue;
            if (!['1', '2', '3', '4', '33', '106'].includes(type) && !productLikePayload) continue;
            const merged = Object.assign({}, logExtra, extra, {
                title: anchor.keyword || anchor.description || anchor.name || extra.title || extra.product_name,
                actionUrl: anchor.actionUrl || anchor.action_url || anchor.schema,
                icon: anchor.icon || anchor.thumbnail
            });
            const found = productFromPlainObject(merged);
            if (found) return found;
            if ((anchor.keyword || anchor.description) && !isBadProductTitle(anchor.keyword || anchor.description)) {
                const url = buildProductUrl(anchor.schema || anchor.actionUrl || extra.product_link || extra.detail_url, extra.product_id || logExtra.product_id || anchor.id, anchor.keyword || anchor.description, anchor.schema);
                if (!isProductLikeUrl(url)) continue;
                return {
                    id: String(extra.product_id || logExtra.product_id || anchor.id || ''),
                    title: String(anchor.keyword || anchor.description || 'TikTok Shop Product').slice(0, 180),
                    price: String(extra.price_str || extra.format_price || extra.price || ''),
                    imageUrl: imageFrom(anchor.icon || anchor.thumbnail) || extra.cover_url || '',
                    shopName: String(extra.shop_name || logExtra.shop_name || 'TikTok Shop'),
                    url
                };
            }
        }
        return null;
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
        const raw = String(value || '').replace(/\\\//g, '/');
        const decoded = decodeNested(raw);
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
        const productId = productIdFromSchema(schema) || productIdFromSchema(direct) || (String(id || '').match(/\d{8,}/) || [''])[0];
        if (!productId) return direct && /^https?:\/\//i.test(direct) ? direct : '';
        const chainKey = chainKeyFromSchema(schema || direct);
        return `https://www.tiktok.com/shop/vn/pdp/${slugify(title)}/${productId}${chainKey ? `?chain_key=${encodeURIComponent(chainKey)}` : ''}`;
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

    function productFromItemStruct(item) {
        if (!item || typeof item !== 'object') return null;
        for (const field of PRODUCT_FIELDS) {
            const found = productFromPlainObject(item[field]);
            if (found) return found;
        }
        const anchorProduct = productFromAnchors(item.anchors || item.descTextExtra);
        if (anchorProduct) return anchorProduct;
        const commerceProduct = productFromPlainObject(item.commerce_info || item.commerceInfo);
        if (commerceProduct) return commerceProduct;
        return productFromPlainObject(item);
    }

    function findProductFromScripts() {
        const videoId = currentVideoId();
        const scripts = document.querySelectorAll('script[id*="UNIVERSAL_DATA"], script[id="__UNIVERSAL_DATA_FOR_REHYDRATION__"], script[id="SIGI_STATE"], script[id="__SIGI_STATE__"], script[type="application/json"]');
        for (const script of scripts) {
            const text = script.textContent || '';
            if (!text || text.length > 2500000) continue;
            if (!/anchor|commerce|product|shop|seller|pdp/i.test(text)) continue;
            let data;
            try { data = JSON.parse(text); } catch (e) { continue; }
            for (const item of itemStructFromData(data)) {
                const id = String(item.id || (item.video && item.video.id) || '');
                if (videoId && id && id !== videoId) continue;
                const product = productFromItemStruct(item);
                if (product && product.title && product.url) return product;
            }
            const recursive = productFromPlainObject(data);
            if (recursive && recursive.title && recursive.url) return recursive;
        }
        return null;
    }

    function findProductFromDom() {
        const selectors = [
            'a[href*="/shop/"][href*="/pdp/"]',
            'a[href*="tiktok.com/shop"][href*="/pdp/"]',
            'a[href*="/shop/"]',
            'a[href*="tiktok.com/shop"]',
            'a[href*="tcm"]',
            '[data-e2e="video-anchor-container"]',
            '[data-e2e="anchor-product-link"]',
            '[data-e2e="anchor-name"]',
            '[data-e2e*="shop" i]',
            '[data-e2e*="anchor" i]',
            '[data-e2e*="product" i]',
            '[class*="Ecom" i]',
            '[class*="Anchor" i]',
            '[class*="ProductAnchor"]',
            '[class*="ShoppingAnchor"]',
            '[class*="DivProductCard"]',
            '[class*="DivShopAnchor"]',
            '[class*="DivAnchorView"]'
        ];
        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                const r = el.getBoundingClientRect();
                if (r.width < 1 && r.height < 1 && !isVideoPage()) continue;
                const linkNode = el.tagName === 'A' ? el : el.querySelector('a[href*="/pdp/"], a[href*="/shop/"], a[href*="tcm"]');
                const link = linkNode && (linkNode.href || linkNode.getAttribute('href'));
                let title = (el.innerText || el.textContent || '').trim();
                const img = el.querySelector('img');
                if (!title && img) title = img.getAttribute('alt') || '';
                title = title.replace(/\s+/g, ' ').slice(0, 160);
                if (isBadProductTitle(title)) continue;
                if (!title || /^Shop$|^TikTok Shop$/i.test(title)) {
                    if (!link) continue;
                    title = 'Xem sản phẩm TikTok Shop';
                }
                let url = link ? new URL(link, location.href).href : '';
                const productId = productIdFromSchema(url);
                if (!url && productId) url = buildProductUrl('', productId, title, '');
                if (!url || !isProductLikeUrl(url)) continue;
                return {
                    id: productId || '',
                    title,
                    price: '',
                    imageUrl: img ? img.src : '',
                    shopName: 'TikTok Shop',
                    url
                };
            }
        }
        const bodyText = (document.body && document.body.innerText) || '';
        const textMatch = bodyText.match(/(?:🛒|Shop)\s*[|｜]?\s*([^\n|｜]{4,160})/i);
        if (textMatch) {
            const title = textMatch[1].trim();
            if (isBadProductTitle(title)) return null;
            const link = document.querySelector('a[href*="/shop/"], a[href*="/pdp/"], a[href*="tcm"]');
            if (link && link.href && isProductLikeUrl(link.href)) {
                return {
                    id: productIdFromSchema(link.href) || '',
                    title,
                    price: '',
                    imageUrl: '',
                    shopName: 'TikTok Shop',
                    url: new URL(link.href, location.href).href
                };
            }
        }
        return null;
    }

    function renderProductCard(product) {
        const old = document.getElementById(PRODUCT_CARD_ID);
        if (old) old.remove();
    }

    function scheduleProductRetries(reason = '') {
        productRetryToken = '';
    }

    async function fetchProductByCurrentPage() {
        return null;
    }

    function scanProductCard() {
        const card = document.getElementById(PRODUCT_CARD_ID);
        if (card) card.remove();
    }

    function scheduleScan() {
        if (!shopVideoEnabled || scheduled) return;
        scheduled = true;
        setTimeout(() => {
            scheduled = false;
            scanShopVideos();
            scanProductCard();
        }, 250);
    }

    function cleanupInjected() {
        document.querySelectorAll('.strangetts-shop-video-loader').forEach(el => el.remove());
        const player = document.getElementById(PLAYER_ID);
        if (player) player.remove();
        const product = document.getElementById(PRODUCT_CARD_ID);
        if (product) product.remove();
        const style = document.getElementById(BLOCKER_STYLE_ID);
        if (style) style.remove();
        document.querySelectorAll('[data-strangetts-shop-video-fixed]').forEach(el => delete el.dataset.strangettsShopVideoFixed);
        unlockState = 'idle';
        injectedPayload = null;
        if (reinjectTimer) {
            clearInterval(reinjectTimer);
            reinjectTimer = null;
        }
    }

    function setShopVideoEnabled(enabled) {
        shopVideoEnabled = enabled !== false;
        if (!shopVideoEnabled) {
            cleanupInjected();
            return;
        }
        scheduleScan();
    }

    function watchUrlChange() {
        const nextVideoKey = currentVideoId() || location.pathname;
        if (nextVideoKey === lastVideoKey) return;
        const oldPlayer = document.getElementById(PLAYER_ID);
        if (oldPlayer) rememberPlayerState(oldPlayer.dataset.videoUrl, oldPlayer.querySelector('video'));
        lastVideoKey = nextVideoKey;
        document.getElementById(PLAYER_ID)?.remove();
        document.getElementById(PRODUCT_CARD_ID)?.remove();
        document.querySelectorAll('[data-strangetts-shop-video-fixed]').forEach(el => delete el.dataset.strangettsShopVideoFixed);
        unlockState = 'idle';
        injectedPayload = null;
        if (reinjectTimer) {
            clearInterval(reinjectTimer);
            reinjectTimer = null;
        }
        scheduleScan();
    }

    try {
        chrome.storage.local.get({ [SHOP_VIDEO_TOGGLE_KEY]: false }, res => {
            setShopVideoEnabled(res[SHOP_VIDEO_TOGGLE_KEY] !== false);
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes[SHOP_VIDEO_TOGGLE_KEY]) {
                setShopVideoEnabled(changes[SHOP_VIDEO_TOGGLE_KEY].newValue !== false);
            }
        });
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg && msg.action === 'STRANGETTS_SHOP_VIDEO_TOGGLE') {
                setShopVideoEnabled(msg.enabled !== false);
            }
        });
    } catch (e) {
        setShopVideoEnabled(false);
    }

    setInterval(() => {
        watchUrlChange();
        scanShopVideos();
        scanProductCard();
    }, 1500);
    new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
})();
