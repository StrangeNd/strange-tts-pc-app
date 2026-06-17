(function () {
  if (window.__STRANGETTS_POST_CAMPAIGN_LIST_SNIFFER__) return;
  window.__STRANGETTS_POST_CAMPAIGN_LIST_SNIFFER__ = true;

  function isHit(url) {
    return /post_campaign_list|campaign_list|oec\/stat\/post_campaign_list/i.test(String(url || ''));
  }
  function isShopInfoHit(url) {
    let s = String(url || '');
    return /get_seller_base_info|get_shop_info|ads-creation\/dashboard|get_seller_info/i.test(s)
      && !/tea\.|log\.|analytics|slardar|monitor/i.test(s);
  }
  function isChatHit(url) {
    return /message\/chat/i.test(String(url || ''));
  }
  let __strangetts_chat_key = null;
  function postChatKey(reqBody) {
    try {
      let b = typeof reqBody === 'string' ? JSON.parse(reqBody) : reqBody;
      let key = b?.meta?.ec_streamer_key;
      if (key && key !== __strangetts_chat_key) {
        __strangetts_chat_key = key;
        console.log('%c[STRANGE TTS] 💬 CHAT KEY CAPTURED: ' + key, 'color:#FBBF24; font-size:14px; font-weight:bold;');
        window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'CHAT_KEY_CAPTURED', ec_streamer_key: key }, '*');
      }
    } catch(e) {}
  }
  function isAadvidHit(url) {
    return /marketing_account_identity_list/i.test(String(url || ''));
  }
  function isAdsAccountListHit(url) {
    let s = String(url || '');
    return /account_switch_list|get_user_own_advs|user_own_advs|marketing_account_identity_list|advertiser.*list|ad[_-]?account.*list|account.*switch|adv.*list|bc.*account/i.test(s)
      && !/tea\.|log\.|analytics|slardar|monitor|pixel|collect|report|balance|due_date|post_campaign_list|post_overview_stat|product|spu|material|creative/i.test(s);
  }
  function isBalanceHit(url) {
    return /\/balance\/query/i.test(String(url || ''));
  }
  function isDueDateHit(url) {
    return /query_due_date/i.test(String(url || ''));
  }
  // Detect product list API calls — broad match to discover the endpoint
  function isProductListHit(url) {
    let s = String(url || '');
    // Match product/spu/item list endpoints, exclude tracking/analytics
    return /product.*(list|query|search)|spu.*(list|query)|item.*(list|query)|goods.*(list|query)|\/creation\/.*product/i.test(s)
      && !/tea\.|log\.|analytics|slardar|monitor/i.test(s);
  }
  function isFlashSaleHit(url) {
    let s = String(url || '');
    return /\/api\/v[12]\/promotion\/(search_products|flash_sale\/create|calc_future_seller_promotion_price|list|destroy)/i.test(s)
      && !/tea\.|log\.|analytics|slardar|monitor/i.test(s);
  }
  function postFlashSale(url, method, reqBody, resBody) {
    console.log('%c[STRANGE TTS] ⚡ FLASH SALE API CAPTURED', 'color:#FFB020; font-size:14px; font-weight:bold;');
    console.log('[STRANGE TTS] ⚡ URL:', url);
    console.log('[STRANGE TTS] ⚡ METHOD:', method);
    console.log('[STRANGE TTS] ⚡ REQUEST:', JSON.stringify(reqBody, null, 2));
    console.log('[STRANGE TTS] ⚡ RESPONSE:', JSON.stringify(resBody, null, 2));
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'FLASH_SALE_API_CAPTURED', url, method, reqBody, resBody }, '*');
  }
  // Detect suggest/recommend/bid/edit API calls — broad match for research
  function isSuggestHit(url) {
    let s = String(url || '');
    return /suggest|recommend|bid_range|bid_hint|roas.*query|budget.*query|optimization.*goal|ad_data.*get|ad_data.*update|ad_data.*edit|campaign.*update|campaign.*edit|batch_update|batch_status|performance.*query/i.test(s)
      && !/tea\.|log\.|analytics|slardar|monitor|pixel/i.test(s);
  }
  // Detect LIVE Dashboard API calls
  function isLiveDashboardHit(url) {
    let s = String(url || '');
    return /insights\/workbench\/live|live\/detail\/core\/stats|live\/detail\/product|live\/overview.*stat/i.test(s)
      && !/tea\.|log\.|analytics|slardar|monitor|pixel/i.test(s);
  }
  function postLiveDashboard(url, payload) {
    console.log('%c[STRANGE TTS] 📺 LIVE DASHBOARD API CAPTURED', 'color:#22D3EE; font-size:14px; font-weight:bold;');
    console.log('[STRANGE TTS] 📺 URL:', url);
    console.log('[STRANGE TTS] 📺 DATA:', payload);
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'LIVE_DASHBOARD_DATA', url, payload }, '*');
  }
  // Detect campaign creation/publish API calls — only actual creation endpoint
  let __strangetts_create_counter = 0;
  function isCampaignCreateHit(url, method, body) {
    if (method && method.toUpperCase() !== 'POST') return false;
    // Must be the actual creation endpoint URL
    let urlStr = String(url || '');
    if (!urlStr.includes('/all_ad_data/create')) return false;
    // Also verify body has campaign_info + ad_info
    let bodyStr = typeof body === 'string' ? body : JSON.stringify(body || '');
    return bodyStr.includes('campaign_info') && bodyStr.includes('ad_info');
  }

  // === CAMPAIGN EDIT/UPDATE SNIFFER ===
  // Broad matcher: catches ANY POST to ads/shopping API that looks like an edit/update/save
  let __strangetts_edit_counter = 0;
  function isCampaignEditHit(url, method, body) {
    if (method && method.toUpperCase() !== 'POST') return false;
    let u = String(url || '');
    // Skip known non-edit endpoints
    if (/tea\.|log\.|analytics|slardar|monitor|pixel|collect|report|recommendation|suggest|brief|search_query|chatbot|post_campaign_list|post_overview_stat|balance|due_date|allow_list|marketing_account/i.test(u)) return false;
    // Match broadly: any oec_ads endpoint with update/edit/save/submit/modify/all_ad_data in URL
    if (/oec_ads.*?(update|edit|save|submit|modify|all_ad_data|batch_update|batch_status|campaign_opt)/i.test(u)) return true;
    // Also match if body contains campaign_id + budget/roas fields (fallback for unknown URLs)
    if (/oec_ads|shopping/i.test(u)) {
      let bodyStr = typeof body === 'string' ? body : JSON.stringify(body || '');
      if (/campaign_id/i.test(bodyStr) && (/budget|roas_bid|campaign_info|ad_info/i.test(bodyStr))) return true;
    }
    return false;
  }
  function postCampaignEdit(url, method, reqBody, resBody, headers) {
    __strangetts_edit_counter++;
    console.log('%c[STRANGE TTS] ✏️ CAMPAIGN EDIT/UPDATE API CAPTURED! (#' + __strangetts_edit_counter + ')', 'color:#FF00FF; font-size:18px; font-weight:bold; background:#1a1a2e; padding:4px 8px;');
    console.log('%c[STRANGE TTS] ✏️ URL: ' + url, 'color:#FF00FF; font-weight:bold;');
    console.log('%c[STRANGE TTS] ✏️ METHOD: ' + method, 'color:#FF00FF; font-weight:bold;');
    console.log('[STRANGE TTS] ✏️ REQUEST BODY:', JSON.stringify(reqBody, null, 2));
    console.log('[STRANGE TTS] ✏️ RESPONSE:', JSON.stringify(resBody, null, 2));
    if (headers && Object.keys(headers).length > 0) console.log('[STRANGE TTS] ✏️ HEADERS:', headers);
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'CAMPAIGN_EDIT_CAPTURED', url, method, reqBody, resBody, headers }, '*');
  }

  function postHit(url, body, payload) {
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'POST_CAMPAIGN_LIST', url, body, payload }, '*');
  }
  function postAadvid(url, aadvid, accountInfo) {
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'AADVID_FOUND', url, aadvid, accountInfo: accountInfo || null }, '*');
  }
  function isBusinessCenterAccountNode(item) {
    return !!(item && typeof item === 'object' && (
      item.user_role ||
      item.adv_count_in_bc !== undefined ||
      item.user_count_in_bc !== undefined ||
      item.customer_record_type !== undefined ||
      item.billing_info_exist !== undefined ||
      String(item.role || '') === '99'
    ));
  }
  function normalizeAdsAccountCandidate(item, url, parentBc) {
    if (!item || typeof item !== 'object') return null;
    const source = String(url || '');
    const isSwitchList = /account_switch_list/i.test(source);
    const isBcNode = isBusinessCenterAccountNode(item);
    if (isSwitchList && isBcNode && !parentBc) return null;
    const aadvid = String(
      item.aadvid ||
      item.advertiser_id ||
      item.adv_id ||
      item.ad_account_id ||
      item.advertiser_account_id ||
      ((/account_switch_list|get_user_own_advs|user_own_advs|marketing_account|advertiser|adv/i.test(source)) ? item.id : '') ||
      ''
    ).trim();
    if (!/^\d{12,}$/.test(aadvid)) return null;
    const label = String(
      item.label ||
      item.name ||
      item.advertiser_name ||
      item.account_name ||
      item.identity_name ||
      item.display_name ||
      aadvid
    ).trim();
    return {
      aadvid,
      label,
      name: label,
      enabled: true,
      status: item.status,
      role: item.role,
      country: item.country || '',
      currency: item.currency || '',
      bc_id: String(item.bc_id || item.business_center_id || item.parent_bc_id || parentBc?.id || '').trim(),
      bc_name: String(item.bc_name || item.business_center_name || parentBc?.name || '').trim(),
      source: isSwitchList ? 'account_switch_list' : 'page_sniffer'
    };
  }
  function extractAdsAccountsFromJson(json, url) {
    const map = {};
    const scan = (node, depth, parentBc) => {
      if (!node || depth > 7) return;
      if (Array.isArray(node)) {
        node.forEach(item => scan(item, depth + 1, parentBc));
        return;
      }
      if (typeof node !== 'object') return;
      const isBcNode = isBusinessCenterAccountNode(node);
      const acc = normalizeAdsAccountCandidate(node, url, parentBc);
      if (acc) map[acc.aadvid] = { ...(map[acc.aadvid] || {}), ...acc };
      const nextParent = isBcNode && node.id ? node : parentBc;
      if (Array.isArray(node.child)) {
        node.child.forEach(item => scan(item, depth + 1, nextParent));
      }
      Object.keys(node).forEach(k => {
        if (k === 'child' || /cookie|token|csrf|html|style|script/i.test(k)) return;
        scan(node[k], depth + 1, nextParent);
      });
    };
    scan(json, 0, null);
    return Object.values(map);
  }
  function postAdsAccounts(url, payload) {
    const accounts = extractAdsAccountsFromJson(payload, url);
    if (!accounts.length) return;
    console.log('%c[STRANGE TTS] 📣 ADS ACCOUNTS CAPTURED: ' + accounts.length, 'color:#22C55E; font-size:14px; font-weight:bold;', accounts);
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'ADS_ACCOUNTS_FOUND', url, accounts }, '*');
  }
  function postBalance(url, payload) {
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'BALANCE_DATA', url, payload }, '*');
  }
  function postDueDate(url, payload) {
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'DUE_DATE_DATA', url, payload }, '*');
  }
  function postIds(ids) {
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'STRANGETTS_IDS_FOUND', ids }, '*');
  }
  function postCampaignCreate(url, reqBody, resBody, headers) {
    __strangetts_create_counter++;
    console.log('%c[STRANGE TTS] 🎯 CAMPAIGN CREATE API CAPTURED! (#' + __strangetts_create_counter + ')', 'color:#00FF00; font-size:16px; font-weight:bold;');
    console.log('[STRANGE TTS] URL:', url);
    // Log key user-entered values prominently
    let ci = reqBody?.campaign_info || {};
    let ai = reqBody?.ad_info || {};
    console.log('%c[STRANGE TTS] 📋 NAME: ' + ci.campaign_name, 'color:#FFD700; font-weight:bold;');
    console.log('%c[STRANGE TTS] 💰 BUDGET: ' + ci.budget, 'color:#FFD700; font-weight:bold;');
    console.log('%c[STRANGE TTS] 📊 ROI (roas_bid): ' + ai.roas_bid, 'color:#FFD700; font-weight:bold;');
    console.log('[STRANGE TTS] REQUEST BODY:', JSON.stringify(reqBody, null, 2));
    console.log('[STRANGE TTS] RESPONSE:', JSON.stringify(resBody, null, 2));
    console.log('[STRANGE TTS] HEADERS:', headers);
    window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'CAMPAIGN_CREATE_CAPTURED', url, reqBody, resBody, headers }, '*');
  }

  function extractAadvid(url) {
    try {
      let m = String(url).match(/aadvid=(\d+)/);
      return m ? m[1] : null;
    } catch(e) { return null; }
  }

  // Extract all known IDs from any URL
  function extractAllIds(url) {
    let s = String(url || '');
    let ids = {};
    let m;
    if ((m = s.match(/aadvid=(\d+)/))) ids.aadvid = m[1];
    if ((m = s.match(/oec_seller_id=(\d+)/))) ids.oec_seller_id = m[1];
    if ((m = s.match(/[?&]seller_id=(\d+)/))) ids.seller_id = m[1];
    if ((m = s.match(/bc_id=(\d+)/))) ids.bc_id = m[1];
    if ((m = s.match(/org_id=(\d+)/))) ids.org_id = m[1];
    if ((m = s.match(/advertiser_id=(\d+)/))) ids.advertiser_id = m[1];
    if ((m = s.match(/[?&]uid=(\d+)/))) ids.uid = m[1];
    return Object.keys(ids).length > 0 ? ids : null;
  }

  // Auto-capture room_id from API URLs/bodies. LIVE room_id changes per session,
  // so body capture helps refresh the current session instead of reusing storage.
  let __strangetts_room_id_captured = null;
  function checkRoomId(source) {
    let s = String(source || '');
    if (!s) return;
    let patterns = [
      /[?&]room_id=(\d{10,})/i,
      /["']room_id["']\s*:\s*["']?(\d{10,})["']?/i,
      /["']roomId["']\s*:\s*["']?(\d{10,})["']?/i,
      /["']live_room_id["']\s*:\s*["']?(\d{10,})["']?/i
    ];
    for (let p of patterns) {
      let m = s.match(p);
      if (m && m[1] && m[1] !== __strangetts_room_id_captured) {
        __strangetts_room_id_captured = m[1];
        console.log('%c[STRANGE TTS] 🔑 ROOM ID AUTO-CAPTURED: ' + m[1], 'color:#22D3EE; font-size:16px; font-weight:bold;');
        window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'ROOM_ID_FOUND', room_id: m[1] }, '*');
        return;
      }
    }
  }

  // Global ID store — accumulate across all requests
  let collectedIds = {};

  // === FETCH HOOK ===
  const rawFetch = window.fetch;
  window.fetch = async function (...args) {
    const input = args[0]; const init = args[1] || {};
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    let body = init.body || null;
    const method = init.method || (typeof input === 'object' ? input.method : 'GET') || 'GET';
    if (!body && input && typeof input.clone === 'function') {
      try { body = await input.clone().text(); } catch(e) {}
    }
    const res = await rawFetch.apply(this, args);
    try {
      // Sniff IDs from every request URL
      let foundIds = extractAllIds(url);
      if (foundIds) {
        let hasNew = false;
        for (let k in foundIds) { if (!collectedIds[k]) { hasNew = true; collectedIds[k] = foundIds[k]; } }
        if (hasNew) postIds({...collectedIds});
      }
      // Auto-capture room_id
      checkRoomId(url);
      if (body) checkRoomId(body);
      // Auto-capture ec_streamer_key from chat requests
      if (isChatHit(url) && body) {
        postChatKey(body);
        // Also capture message_id from RESPONSE for auto-pin
        try {
          const chatClone = res.clone();
          chatClone.json().then(json => {
            let msgId = json?.data?.message_id || json?.data?.msg_id || json?.message_id || json?.msg_id;
            if (msgId) {
              window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'CHAT_MSG_SENT', message_id: String(msgId) }, '*');
            }
          }).catch(()=>{});
        } catch(e) {}
      }
      // === CAMPAIGN CREATE SNIFFER ===
      if (isCampaignCreateHit(url, method, body)) {
        try {
          const clone = res.clone();
          let reqBody = body;
          try { reqBody = JSON.parse(body); } catch(e) {}
          clone.json().then(resBody => {
            let headers = {};
            try {
              for (let [k, v] of (init.headers instanceof Headers ? init.headers.entries() : Object.entries(init.headers || {}))) {
                headers[k] = v;
              }
            } catch(e) {}
            postCampaignCreate(url, reqBody, resBody, headers);
          }).catch(()=>{});
        } catch(e) {}
      }
      // === CAMPAIGN EDIT SNIFFER (fetch) ===
      if (isCampaignEditHit(url, method, body)) {
        try {
          const clone = res.clone();
          let reqBody = body;
          try { reqBody = JSON.parse(body); } catch(e) {}
          clone.json().then(resBody => {
            let headers = {};
            try {
              for (let [k, v] of (init.headers instanceof Headers ? init.headers.entries() : Object.entries(init.headers || {}))) {
                headers[k] = v;
              }
            } catch(e) {}
            postCampaignEdit(url, method, reqBody, resBody, headers);
          }).catch(()=>{});
        } catch(e) {}
      }
      if (isHit(url)) {
        const clone = res.clone();
        const ct = clone.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          clone.json().then(json => postHit(url, body, json)).catch(()=>{});
        }
      }
      if (isShopInfoHit(url)) {
        try {
          const clone = res.clone();
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            clone.json().then(json => {
              let seller = json?.data?.seller || json?.data?.seller_base_info?.global_seller || json?.data;
              if (seller && (seller.shop_name || seller.seller_name)) {
                let sInfo = {
                  seller_id: seller.seller_id || seller.global_seller_id || '',
                  shop_name: seller.shop_name || seller.seller_name || '',
                  logo: seller.logo?.url_list?.[0] || seller.avatar?.url_list?.[0] || seller.avatar || ''
                };
                console.log('%c[STRANGE TTS] 🛒 SHOP INFO CAPTURED (fetch): ' + sInfo.shop_name, 'color:#10B981; font-weight:bold;', sInfo);
                window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'STRANGETTS_SHOP_INFO', info: sInfo }, '*');
              }
            }).catch(()=>{});
          }
        } catch(e) {}
      }

      // Intercept marketing_account_identity_list for aadvid + account info
      if (isAadvidHit(url)) {
        let aadvid = extractAadvid(url);
        if (aadvid) {
          // Also get account name from response
          try {
            const clone2 = res.clone();
            const ct2 = clone2.headers.get('content-type') || '';
            if (ct2.includes('application/json')) {
              clone2.json().then(json => {
                let acctName = '';
                let acctId = aadvid;
                // Try to find account name in response
                let list = json?.data?.list || json?.data?.identity_list || json?.data || [];
                if (Array.isArray(list)) {
                  for (let item of list) {
                    if (String(item.advertiser_id || item.aadvid || item.id) === aadvid) {
                      acctName = item.name || item.advertiser_name || item.identity_name || '';
                      break;
                    }
                    if (!acctName) acctName = item.name || item.advertiser_name || item.identity_name || '';
                  }
                }
                postAadvid(url, aadvid, { name: acctName, id: acctId });
              }).catch(() => postAadvid(url, aadvid, null));
            } else {
              postAadvid(url, aadvid, null);
            }
          } catch(e) {
            postAadvid(url, aadvid, null);
          }
        }
      }
      if (isAdsAccountListHit(url)) {
        try {
          const accClone = res.clone();
          const accCt = accClone.headers.get('content-type') || '';
          if (accCt.includes('application/json')) {
            accClone.json().then(json => postAdsAccounts(url, json)).catch(()=>{});
          }
        } catch(e) {}
      }
      // Intercept balance query
      if (isBalanceHit(url)) {
        const clone = res.clone();
        const ct = clone.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          clone.json().then(json => postBalance(url, json)).catch(()=>{});
        }
      }
      // Intercept query_due_date for postpay threshold
      if (isDueDateHit(url)) {
        const clone = res.clone();
        const ct = clone.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          clone.json().then(json => postDueDate(url, json)).catch(()=>{});
        }
      }
      // === SUGGEST/RECOMMEND/BID SNIFFER (fetch) ===
      if (isSuggestHit(url)) {
        try {
          const clone = res.clone();
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            let reqBody = body;
            try { reqBody = JSON.parse(body); } catch(e) {}
            clone.json().then(resBody => {
              console.log('%c[STRANGE TTS] 🎯 SUGGEST/EDIT API DETECTED (fetch)', 'color:#FF4500; font-size:14px; font-weight:bold;');
              window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'SUGGEST_API_CAPTURED', url, method, reqBody, resBody }, '*');
            }).catch(()=>{});
          }
        } catch(e) {}
      }
      // === PRODUCT LIST SNIFFER (fetch) ===
      if (isProductListHit(url)) {
        try {
          const clone = res.clone();
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            let reqBody = body;
            try { reqBody = JSON.parse(body); } catch(e) {}
            clone.json().then(resBody => {
              console.log('%c[STRANGE TTS] 🛒 PRODUCT API DETECTED (fetch)', 'color:#FF69B4; font-size:14px; font-weight:bold;');
              window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'PRODUCT_LIST_CAPTURED', url, method, reqBody, resBody }, '*');
            }).catch(()=>{});
          }
        } catch(e) {}
      }
      if (isFlashSaleHit(url)) {
        try {
          const clone = res.clone();
          let reqBody = body;
          try { reqBody = JSON.parse(body); } catch(e) {}
          clone.text().then(text => {
            try { postFlashSale(url, method, reqBody, JSON.parse(text)); } catch(e) {}
          }).catch(()=>{});
        } catch(e) {}
      }
      // === LIVE DASHBOARD SNIFFER (fetch) ===
      if (isLiveDashboardHit(url)) {
        try {
          const clone = res.clone();
          const ct = clone.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            clone.json().then(json => postLiveDashboard(url, json)).catch(()=>{});
          }
        } catch(e) {}
      }
    } catch (e) {}
    return res;
  };

  // === XHR HOOK ===
  const rawOpen = XMLHttpRequest.prototype.open;
  const rawSend = XMLHttpRequest.prototype.send;
  const rawSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  // Capture x-csrftoken từ mọi XHR request của TikTok
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (name && name.toLowerCase() === 'x-csrftoken' && value) {
      window.__STRANGETTS_CSRF__ = value;
    }
    return rawSetRequestHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.__strangetts_url = url; this.__strangetts_method = method; return rawOpen.call(this, method, url, ...rest); };
  XMLHttpRequest.prototype.send = function (body) {
    this.__strangetts_body = body;
    this.addEventListener('load', function () {
      try {
        const url = this.__strangetts_url || '';
        const method = this.__strangetts_method || '';
        const ct = this.getResponseHeader('content-type') || '';

        // Sniff IDs from XHR
        let foundIds = extractAllIds(url);
        if (foundIds) {
          let hasNew = false;
          for (let k in foundIds) { if (!collectedIds[k]) { hasNew = true; collectedIds[k] = foundIds[k]; } }
          if (hasNew) postIds({...collectedIds});
        }
        // Auto-capture room_id from XHR
        checkRoomId(url);
        if (this.__strangetts_body) checkRoomId(this.__strangetts_body);
        // Auto-capture ec_streamer_key from XHR chat
        if (isChatHit(url) && this.__strangetts_body) postChatKey(this.__strangetts_body);

        // === CAMPAIGN CREATE SNIFFER (XHR) ===
        if (isCampaignCreateHit(url, method, this.__strangetts_body) && ct.includes('application/json')) {
          try {
            let reqBody = this.__strangetts_body;
            try { reqBody = JSON.parse(reqBody); } catch(e) {}
            let resBody = JSON.parse(this.responseText);
            postCampaignCreate(url, reqBody, resBody, {});
          } catch(e) {}
        }
        // === CAMPAIGN EDIT SNIFFER (XHR) ===
        if (isCampaignEditHit(url, method, this.__strangetts_body) && ct.includes('application/json')) {
          try {
            let reqBody = this.__strangetts_body;
            try { reqBody = JSON.parse(reqBody); } catch(e) {}
            let resBody = JSON.parse(this.responseText);
            postCampaignEdit(url, method, reqBody, resBody, {});
          } catch(e) {}
        }

        // Campaign list
        if (isHit(url) && ct.includes('application/json')) {
          try { postHit(url, this.__strangetts_body, JSON.parse(this.responseText)); } catch(e) {}
        }
        // === PRODUCT LIST SNIFFER (XHR) ===
        if (isProductListHit(url) && ct.includes('application/json')) {
          try {
            let reqBody = this.__strangetts_body;
            try { reqBody = JSON.parse(reqBody); } catch(e) {}
            let resBody = JSON.parse(this.responseText);
            console.log('%c[STRANGE TTS] 🛒 PRODUCT API DETECTED (XHR)', 'color:#FF69B4; font-size:14px; font-weight:bold;');
            console.log('[STRANGE TTS] 🛒 URL:', url);
            console.log('[STRANGE TTS] 🛒 METHOD:', method);
            console.log('[STRANGE TTS] 🛒 REQ BODY:', JSON.stringify(reqBody, null, 2));
            console.log('[STRANGE TTS] 🛒 RESPONSE:', JSON.stringify(resBody, null, 2));
            window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'PRODUCT_LIST_CAPTURED', url, method, reqBody, resBody }, '*');
          } catch(e) {}
        }
        if (isFlashSaleHit(url)) {
          try {
            let reqBody = this.__strangetts_body;
            try { reqBody = JSON.parse(reqBody); } catch(e) {}
            postFlashSale(url, method, reqBody, JSON.parse(this.responseText));
          } catch(e) {}
        }
        // === SUGGEST/RECOMMEND/BID SNIFFER (XHR) ===
        if (isSuggestHit(url) && ct.includes('application/json')) {
          try {
            let reqBody = this.__strangetts_body;
            try { reqBody = JSON.parse(reqBody); } catch(e) {}
            let resBody = JSON.parse(this.responseText);
            console.log('%c[STRANGE TTS] 🎯 SUGGEST/EDIT API DETECTED (XHR)', 'color:#FF4500; font-size:14px; font-weight:bold;');
            console.log('[STRANGE TTS] 🎯 URL:', url);
            console.log('[STRANGE TTS] 🎯 METHOD:', method);
            console.log('[STRANGE TTS] 🎯 REQ BODY:', JSON.stringify(reqBody, null, 2));
            console.log('[STRANGE TTS] 🎯 RESPONSE:', JSON.stringify(resBody, null, 2));
            window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'SUGGEST_API_CAPTURED', url, method, reqBody, resBody }, '*');
          } catch(e) {}
        }
        // Aadvid from marketing_account_identity_list
        if (isAadvidHit(url)) {
          let aadvid = extractAadvid(url);
          if (aadvid) {
            try {
              let json = JSON.parse(this.responseText);
              let acctName = '';
              let list = json?.data?.list || json?.data?.identity_list || json?.data || [];
              if (Array.isArray(list)) {
                for (let item of list) {
                  if (String(item.advertiser_id || item.aadvid || item.id) === aadvid) {
                    acctName = item.name || item.advertiser_name || item.identity_name || '';
                    break;
                  }
                  if (!acctName) acctName = item.name || item.advertiser_name || item.identity_name || '';
                }
              }
              postAadvid(url, aadvid, { name: acctName, id: aadvid });
            } catch(e) {
              postAadvid(url, aadvid, null);
            }
          }
        }
        if (isAdsAccountListHit(url) && ct.includes('application/json')) {
          try { postAdsAccounts(url, JSON.parse(this.responseText)); } catch(e) {}
        }
        // Balance query
        if (isBalanceHit(url) && ct.includes('application/json')) {
          try { postBalance(url, JSON.parse(this.responseText)); } catch(e) {}
        }
        // Due date / threshold query
        if (isDueDateHit(url) && ct.includes('application/json')) {
          try { postDueDate(url, JSON.parse(this.responseText)); } catch(e) {}
        }
        // === LIVE DASHBOARD SNIFFER (XHR) ===
        if (isLiveDashboardHit(url) && ct.includes('application/json')) {
          try { postLiveDashboard(url, JSON.parse(this.responseText)); } catch(e) {}
        }
        // === SHOP INFO SNIFFER (XHR) ===
        if (isShopInfoHit(url) && ct.includes('application/json')) {
          try {
            let json = JSON.parse(this.responseText);
            let seller = json?.data?.seller || json?.data?.seller_base_info?.global_seller || json?.data;
            if (seller && (seller.shop_name || seller.seller_name)) {
              let sInfo = {
                seller_id: seller.seller_id || seller.global_seller_id || '',
                shop_name: seller.shop_name || seller.seller_name || '',
                logo: seller.logo?.url_list?.[0] || seller.avatar?.url_list?.[0] || seller.avatar || ''
              };
              console.log('%c[STRANGE TTS] 🛒 SHOP INFO CAPTURED (XHR): ' + sInfo.shop_name, 'color:#10B981; font-weight:bold;', sInfo);
              window.postMessage({ source: 'STRANGETTS_PAGE_SNIFFER', type: 'STRANGETTS_SHOP_INFO', info: sInfo }, '*');
            }
          } catch(e) {}
        }
      } catch (e) {}
    });
    return rawSend.apply(this, arguments);
  };
})();
