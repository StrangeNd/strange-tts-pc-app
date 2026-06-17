import{g as tt,D as ot,t as Pe}from"./i18n-a5_SKMfx.js";let ge=null,y=ot,De=location.href,w="idle",P=!1,Ce=()=>{},J="",j=null,te="",H=!1;const it=new Map,nt=e=>new Promise(t=>setTimeout(t,e)),p=(...e)=>{},Y="__strangetts_video_product_card",T="__strangetts_video_injected_player",Re="__strangetts_video_play_button",Ee=chrome.runtime.getURL("vendor/strangetts_video/icons/product-bag.svg"),Ae=["View in app","Watch in app","Mở trong ứng dụng","Xem trong ứng dụng","View in the TikTok app","Open in the TikTok app","View TikTok Shop videos in the TikTok app","View TikTok Shop videos in TikTok app","Xem video TikTok Shop trong ung dung","Xem video TikTok Shop trong ứng dụng","Xem video TikTok Shop trong TikTok app"],$e=/view in.{0,4}app|watch in.{0,4}app|m[ởơ] trong ứng dụng|xem trong ứng dụng|view\s+tiktok\s+shop\s+videos[\s\S]{0,80}tiktok\s+app|xem\s+video\s+tiktok\s+shop[\s\S]{0,80}(?:tiktok\s+app|ung\s+dung|ứng\s+dụng)/i,me="__strangetts_video_blocker_hide_style";function E(){var e;try{return!!((e=chrome==null?void 0:chrome.runtime)!=null&&e.id)}catch{return!1}}const Oe=e=>Pe[y.language].content[e];function K(e){return/\/video\/\d+/.test(e)}function V(e){const t=e.match(/\/video\/(\d+)/);return t?t[1]:""}function rt(e){return e.replace(/"/g,"&quot;").replace(/</g,"&lt;")}const Ve=rt;function re(e){var s;const t=e||document,o=Array.from(t.querySelectorAll("video"));if(!o.length)return null;const n=window.innerHeight/2,i=o.filter(c=>!c.closest("#"+T));return i.length&&((s=i.map(c=>{const a=c.getBoundingClientRect(),r=Math.max(0,Math.min(a.bottom,window.innerHeight)-Math.max(a.top,0)),l=Math.max(0,Math.min(a.right,window.innerWidth)-Math.max(a.left,0)),d=r*l,g=Math.abs((a.top+a.bottom)/2-n),u=d===0?2e6:0,b=(c.paused?0:1e6)+(c.readyState>=2?1e5:0)+d-g-u;return{video:c,score:b}}).sort((c,a)=>a.score-c.score)[0])==null?void 0:s.video)||null}function at(e){const t=re(e);if(!t)return!1;const o=t.currentSrc||t.src;return!(!o||o==="about:blank"||t.error||!t.videoWidth||t.videoWidth<50||!t.duration||isNaN(t.duration)||t.duration<2)}function st(){const e=document.querySelectorAll("div, span, button, a, p");for(const t of e){const o=(t.textContent||"").trim();if(!(!o||o.length>220)&&($e.test(o)||Ae.some(n=>o.includes(n))))return t}return null}function ct(e){let t=e,o=e;for(let s=0;s<10&&o;s++){const c=getComputedStyle(o).position;if(c==="absolute"||c==="fixed"){t=o;break}o=o.parentElement}const n=t.parentElement;if(!n)return null;const i=n.getBoundingClientRect();return i.width<150||i.height<200?null:{overlay:t,container:n}}function Ne(){if(!document.getElementById(me)){const t=document.createElement("style");t.id=me,t.textContent=`
      [class*="RegionBlock"], [class*="ShopBlock"], [class*="ShopVideoBlocker"],
      [class*="DivShopVideoOverlay"], [class*="video-region-block"],
      [data-e2e*="shop-video-blocker"], [data-e2e*="region-block"] {
        display: none !important;
      }
    `,(document.head||document.documentElement).appendChild(t)}const e=st();if(e){const t=ct(e);t?t.overlay.style.setProperty("display","none","important"):e.style.setProperty("display","none","important")}}function de(e){var g,u;const t=e.getBoundingClientRect();if(t.width<300||t.height<300||t.bottom<=0||t.top>=window.innerHeight||t.right<=0||t.left>=window.innerWidth)return!1;const o=getComputedStyle(e);if(o.display==="none"||o.visibility==="hidden"||Number(o.opacity)===0)return!1;const n=t.left+t.width/2;if(n>window.innerWidth*.95||t.width>window.innerWidth*.9&&t.height>window.innerHeight*.9||e.querySelector('[data-e2e*="comment"], [class*="CommentContainer"], [class*="CommentList"], [class*="EmptyStateWrapper"]'))return!1;const i=((u=(g=e.className)==null?void 0:g.toString)==null?void 0:u.call(g))||"";if(/\bDivVideoContainer\b/.test(i)||/\bDivBasicPlayer\b/.test(i)||/\bDivBrowserModeContainer\b/.test(i)||/\bDivVideoContainerForDetail\b/.test(i)||/\bxgplayer\b/.test(i))return!0;const c=!!e.querySelector("video"),a=e.textContent||"",r=$e.test(a)||Ae.some(b=>a.includes(b)),l=o.backgroundColor||"",d=K(location.href)&&t.width>=420&&t.width<=window.innerWidth*.78&&t.height>=420&&t.height<=window.innerHeight*.98&&n<window.innerWidth*.6&&a.length<260&&(l.includes("0, 0, 0")||l==="black"||!!e.querySelector('button, [role="button"], svg'));return!(!c&&!r&&!d)}function oe(){let e=null;const t=['[data-e2e="feed-video"]','[data-e2e="browse-video-player"]','[data-e2e="video-player-wrapper"]','[data-e2e="feed-video-player"]','[data-e2e="video-detail-player"]','[data-e2e="video-player"]',"xg-video-container",'[class*="xgplayer"]:not([class*="skin"])','[class*="DivBasicPlayer"]','[class*="DivVideoContainerForDetail"]','[class*="SectionMediaCardContainer"]','[class*="DivVideoContainer"]:not([class*="Wrapper"])','[data-e2e="browse-video"]','[data-e2e="video-item"]','[class*="DivVideoWrapper"]','[class*="DivPlayerContainer"]','[class*="DivBrowserModeContainer"] [class*="DivVideoWrapper"]','[role="dialog"] [class*="DivVideoWrapper"]','[data-e2e="recommend-list-item-container"]',".video-container"],o=window.innerHeight/2;for(const n of t){const i=Array.from(document.querySelectorAll(n)).filter(s=>de(s));if(i.length){i.sort((s,c)=>{const a=s.getBoundingClientRect(),r=c.getBoundingClientRect();return Math.abs((a.top+a.bottom)/2-o)-Math.abs((r.top+r.bottom)/2-o)}),e={el:i[0],strategy:`selector ${n}`};break}}if(!e){const n=re();if(n){const i=window.innerWidth*.75;let s=n.parentElement,c=null,a=0;for(let r=0;r<8&&s;r++){if(de(s)){const l=s.getBoundingClientRect();if(l.width<=i){const d=l.width*l.height;d>a&&(c=s,a=d)}}s=s.parentElement}c&&(e={el:c,strategy:"walk-up from <video>"})}}if(!e&&K(location.href)){const n=Array.from(document.querySelectorAll("div, section")).filter(i=>{const s=i.getBoundingClientRect();return s.width>=400&&s.height>=400&&s.height>s.width&&de(i)});n.sort((i,s)=>{const c=i.getBoundingClientRect(),a=s.getBoundingClientRect();return a.width*a.height-c.width*c.height}),n[0]&&(e={el:n[0],strategy:"portrait-fallback"})}return e?(p('[Strange TTS Video] ✔ Container "'+e.strategy+'":',Math.round(e.el.getBoundingClientRect().width)+"×"+Math.round(e.el.getBoundingClientRect().height),"@ ("+Math.round(e.el.getBoundingClientRect().left)+", "+Math.round(e.el.getBoundingClientRect().top)+")",e.el),e.el):null}let pe=!1;function lt(){const e=re();!e||e===ge||(ge=e,e.addEventListener("ended",dt),e.addEventListener("timeupdate",pt))}function dt(){y.autoScroll&&Ge()}function pt(){if(!y.autoScroll)return;const e=ge;e&&e.duration&&e.currentTime>0&&e.duration-e.currentTime<.2&&Ge()}function Ge(e){if(pe)return;pe=!0,setTimeout(()=>{pe=!1},2e3);const t=document.querySelector('[data-e2e="arrow-right"], [data-e2e="arrow-down"], button[data-e2e="video-switch-next"]');if(t){t.click();return}(document.querySelector('[data-e2e="recommend-list-item-container"]')||document.getElementById("app")||document.documentElement).dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",code:"ArrowDown",keyCode:40,which:40,bubbles:!0,cancelable:!0,composed:!0,view:window})),setTimeout(()=>window.scrollBy({top:window.innerHeight,behavior:"smooth"}),150)}function ze(){try{window.dispatchEvent(new CustomEvent("__strangetts_video_settings__",{detail:{backgroundPlay:y.backgroundPlay,autoPiP:y.autoPiP,volumeNormalizer:y.volumeNormalizer,playbackSpeed:y.playbackSpeed}}))}catch{}}const Ue="__strangetts_video_clean_style";function ue(e){const t=document.getElementById(Ue);if(!e){t==null||t.remove();return}if(t)return;const o=document.createElement("style");o.id=Ue,o.textContent=`
    [class*="DivSideNavContainer"],
    [class*="DivLeftContainer"],
    [class*="DivHeaderTopContainer"],
    [class*="DivCommentContainer"],
    [class*="DivVideoActionBarV2"],
    [data-e2e="like-icon"],
    [data-e2e="comment-icon"],
    [data-e2e="share-icon"],
    [data-e2e="bookmark-icon"] {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 0.3s !important;
    }
    [class*="DivSideNavContainer"]:hover,
    [class*="DivLeftContainer"]:hover {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  `,document.head.appendChild(o)}function ye(){var t;const e=((t=document.body)==null?void 0:t.innerText)||"";return!!($e.test(e)||Ae.some(o=>e.includes(o))||document.querySelector('[class*="RegionBlock"], [class*="ShopBlock"], [class*="ShopVideoBlocker"], [class*="DivShopVideoOverlay"], [class*="video-region-block"], [data-e2e*="shop-video-blocker"], [data-e2e*="region-block"]'))}async function ut(e,t){const o=Date.now();for(;Date.now()-o<e;){if(ye())return!1;if(at(t))return!0;await nt(250)}return!1}function Fe(){return!!(/security check|verify/i.test(document.title)||document.querySelector('#captcha-verify-container, [class*="captcha_verify_container"], [id*="captcha-verify"], [class*="CaptchaVerifyContainer"]'))}async function be(){var d,g;if(!E()||!y.unlockShopVideo||!K(location.href)||w==="checking"||w==="injected"||document.getElementById(T))return;if(Fe()){w="idle";return}w="checking";const e=ye(),t=oe(),o=!!(t!=null&&t.querySelector("video")),n=!document.querySelector("video"),i=e?800:t&&!o?1e3:n?2500:1500,s=location.href,c=(async()=>{try{return await new Promise(b=>{chrome.runtime.sendMessage({type:"GET_TIKTOK_METADATA",url:s},A=>{if(chrome.runtime.lastError){b(null);return}b(A)})})}catch{return null}})();if(await ut(i,t)){ye()&&Ne(),w="native";return}const r=await c;if(p("unlock/tikwm result",{success:!!(r!=null&&r.success),hasVideoUrl:!!((d=r==null?void 0:r.data)!=null&&d.videoUrl),error:(r==null?void 0:r.error)||null}),!(r!=null&&r.success)||!((g=r==null?void 0:r.data)!=null&&g.videoUrl)){w="idle";return}const l=oe();if(!l){w="idle";return}if(Fe()){w="idle";return}Ne(),ft(l,r.data.videoUrl,r.data.coverUrl,r.data.title)}function ft(e,t,o,n){if(document.getElementById(T))return;const i=e.getBoundingClientRect();if(i.width<100||i.height<100){p(`[Strange TTS Video] Container size too small (${Math.round(i.width)}×${Math.round(i.height)}), skip inject — sẽ retry`),w="idle";return}p(`[Strange TTS Video] Injecting player into container (${Math.round(i.width)}×${Math.round(i.height)})`);const s=document.querySelector("video");getComputedStyle(e).position==="static"&&e.style.setProperty("position","relative","important");const a=document.createElement("div");a.id=T,a.style.cssText=`
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 2147483646 !important;
    background: #000 !important;
    border-radius: inherit;
    overflow: hidden;
    box-shadow: inset 0 0 0 2px rgba(34,211,238,0.5), 0 0 30px rgba(34,211,238,0.3);
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  `,a.innerHTML=`
    <style>
      #${T}:fullscreen,
      #${T}:-webkit-full-screen {
        position: fixed !important; inset: 0 !important;
        width: 100vw !important; height: 100vh !important;
        border-radius: 0 !important; box-shadow: none !important; background: #000 !important;
      }
      #${T}:fullscreen video,
      #${T}:-webkit-full-screen video,
      #${T} video:fullscreen,
      #${T} video:-webkit-full-screen {
        width: 100vw !important; height: 100vh !important;
        max-width: none !important; max-height: none !important;
        object-fit: contain !important; background: #000 !important;
      }
    </style>
    <video src="${Ve(t)}"
      ${o?`poster="${Ve(o)}"`:""}
      controls autoplay loop playsinline
      style="width:100%;height:100%;object-fit:contain;background:#000;display:block;"
    ></video>
    <button id="${Re}" type="button" aria-label="Play" style="
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      z-index: 4; width: 74px; height: 74px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.34);
      background: linear-gradient(135deg, rgba(34,211,238,0.78), rgba(217,70,239,0.78));
      box-shadow: 0 12px 36px rgba(0,0,0,0.45), 0 0 30px rgba(34,211,238,0.35);
      backdrop-filter: blur(14px) saturate(180%);
      -webkit-backdrop-filter: blur(14px) saturate(180%);
      cursor: pointer; display: none; align-items: center; justify-content: center;
      padding: 0; color: white;
    ">
      <span style="display:inline-block;width:0;height:0;
        border-top:14px solid transparent;border-bottom:14px solid transparent;
        border-left:22px solid white;margin-left:5px;"></span>
    </button>
    <div id="__strangetts_video_unmute_hint" style="
      position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%);
      padding: 6px 12px; border-radius: 999px;
      background: rgba(0,0,0,0.55); color: #fff; font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none; opacity: 0; display:none; user-select: none;
      transition: opacity 0.3s;
    ">${Oe("clickToUnmute")}</div>
    <div style="
      position: absolute; left: 10px; top: 10px; z-index: 3;
      padding: 4px 10px; border-radius: 999px;
      background: rgba(0,0,0,0.55); color: #fff; font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none;
    ">${Oe("unlocked")}</div>
  `,e.appendChild(a),w="injected";const r=a.querySelector("video"),l=a.querySelector("#"+Re),d=a.querySelector("#__strangetts_video_unmute_hint");p("inject/video src",t.slice(0,100)+"..."),r&&(r.muted=false,r.volume=1,r.addEventListener("loadedmetadata",()=>p("inject/video loadedmetadata",JSON.stringify({duration:r.duration,width:r.videoWidth,height:r.videoHeight}))),r.addEventListener("loadeddata",()=>p("inject/video loadeddata")),r.addEventListener("canplay",()=>p("inject/video canplay")),r.addEventListener("playing",()=>p("inject/video playing")),r.addEventListener("waiting",()=>p("inject/video waiting")),r.addEventListener("pause",()=>{l&&(l.style.display="flex")}),r.addEventListener("play",()=>{l&&(l.style.display="none")}),setTimeout(()=>{p("inject/video status@2s",JSON.stringify({rs:r.readyState,ns:r.networkState,paused:r.paused,ct:Math.round(r.currentTime*100)/100,size:i.width+"x"+i.height,vw:r.videoWidth,vh:r.videoHeight,muted:r.muted,visible:a.offsetParent!==null}))},2e3),setTimeout(()=>{const u=a.getBoundingClientRect();p("inject/visibility@3000ms",JSON.stringify({wrapper:{size:Math.round(u.width)+"x"+Math.round(u.height)},injectedVideo:{rs:r.readyState,ct:r.currentTime,muted:r.muted}}))},3e3)),l&&l.addEventListener("click",()=>{r==null||r.play().catch(()=>{})});const g=()=>{r&&(r.muted=!1,d&&(d.style.opacity="0"),setTimeout(()=>d==null?void 0:d.remove(),400),a.removeEventListener("click",g))};a.addEventListener("click",g),y.productViewer&&setTimeout(()=>{E()&&ae()},100),Je()}function qe(){var e,t;(e=document.getElementById(T))==null||e.remove(),(t=document.getElementById(me))==null||t.remove(),w="idle"}function Je(){const e=["View TikTok Shop videos in the TikTok app","Xem video TikTok Shop trong ứng dụng"];document.querySelectorAll("div").forEach(t=>{if(t.children.length>2)return;const o=(t.textContent||"").trim();!o||o.length>120||e.some(n=>o.includes(n))&&(t.style.display="none",p("[Strange TTS Video] TOAST REMOVED: "+o.slice(0,80)))})}function ht(){const e=document.querySelector("script#__UNIVERSAL_DATA_FOR_REHYDRATION__, script#SIGI_STATE");if(!e)return null;try{return JSON.parse(e.textContent||"{}")}catch{return null}}function ve(){var n,i,s;const e=ht();if(!e)return null;const t=(s=(i=(n=e==null?void 0:e.__DEFAULT_SCOPE__)==null?void 0:n["webapp.video-detail"])==null?void 0:i.itemInfo)==null?void 0:s.itemStruct;if(t)return t;const o=e==null?void 0:e.ItemModule;if(o&&typeof o=="object"){const c=Object.keys(o);if(c.length)return o[c[0]]}return null}function gt(e){if(!e||typeof e!="object")return{};const t=(i,s)=>{for(const c of s){const a=i==null?void 0:i[c];if(typeof a=="string"&&a.trim())return a;if(typeof a=="number"&&a>0)return String(a)}},o=t(e,["format_price","price_format","sale_price_format","price_str","current_price"]),n=t(e,["origin_price_format","market_price_format","original_price_str","market_price"]);return{price:o,originalPrice:n}}function mt(e){var t,o,n,i,s,c;if(!(!e||typeof e!="object"))return e.cover_url||e.image||((o=(t=e.cover)==null?void 0:t.url_list)==null?void 0:o[0])||((i=(n=e.thumbnail)==null?void 0:n.url_list)==null?void 0:i[0])||((c=(s=e.icon)==null?void 0:s.url_list)==null?void 0:c[0])||e.product_image}function yt(e,t){if(!Array.isArray(e))return null;p("[Strange TTS Video] Anchors ("+e.length+") — first sample:",JSON.stringify(e[0]||{}).slice(0,500)),p("[Strange TTS Video] Anchor types:",JSON.stringify(e.map(o=>o==null?void 0:o.type)));for(const o of e){if(!o||typeof o!="object"||o.type!==33&&o.type!==106)continue;const n=o.extra||o.extra_info||{},i=o.keyword||o.description||n.elastic_title||n.title;if(!i)continue;if(/capcut|edit like|editing made|try this effect|template/i.test(String(i))){p("[Strange TTS Video] Rejected non-shop keyword on type "+o.type+": "+i);continue}const s=String(o.id||n.product_id||n.id||"");let c=String(o.schema||o.action_url||n.detail_url||n.product_link||"");c&&!/tiktok\.com\/shop\//i.test(c)&&(c="");const{price:a,originalPrice:r}=gt(n),l=mt(n),d=n.shop_name||n.seller_name||n.brand||"TikTok Shop",g={id:s,title:String(i).slice(0,200),price:a,originalPrice:r,imageUrl:l,shopName:d,url:c};return(t==null?void 0:t.isECVideo)===1||(t==null||t.isECVideo),g}return null}function bt(e){if(!e)return;const o=(Array.isArray(e.anchors)?e.anchors.map(n=>n==null?void 0:n.type):[]).some(n=>n===33||n===106);p(`[Strange TTS Video] isECVideo=${e.isECVideo}, AnchorTypes=${JSON.stringify(e.AnchorTypes)}, hasCommerceProductInfo=${!!e.commerceProductInfo}`),(e.isECVideo===1||e.isECVideo===!0||o)&&e.commerceProductInfo;try{const n=String(e.id||"");if(n&&!He.has(n)){He.add(n);const i=[],s=(a,r,l)=>{if(!(!a||typeof a!="object"||l>3))for(const d of Object.keys(a)){const g=a[d],u=r?r+"."+d:d;if(typeof g=="string"){const b=g.trim();b.length>=3&&b.length<=80&&!/^https?:|^\/|^\d+$|^[#@]/.test(b)&&i.push({path:u,value:b})}else typeof g=="object"&&g!==null&&l<3&&s(g,u,l+1)}};Array.isArray(e.anchors)&&e.anchors.forEach((a,r)=>{if(!a)return;let l=a.extra||a.extra_info||{};try{typeof a.extraInfo=="string"&&(l=JSON.parse(a.extraInfo))}catch{}let d={};try{d=typeof a.logExtra=="string"?JSON.parse(a.logExtra):a.logExtra||{}}catch{}s({...a,extra:void 0,extra_info:void 0,extraInfo:void 0,logExtra:void 0},`anchor[${r}](t=${a.type})`,0),s(l,`anchor[${r}].extra`,0),s(d,`anchor[${r}].logExtra`,0)});const c=e.commerceProductInfo||e.commerce_product_info;c&&s(c,"cpi",0),p("[Strange TTS Video] SHORT-FIELD DUMP for "+n+":",JSON.stringify(i.slice(0,60)))}}catch{}}const He=new Set;function Ye(e){if(!e)return"";const t=i=>{if(typeof i!="string")return"";const s=i.trim();return s.length<3||s.length>80||/capcut|edit like|editing made|template|effect/i.test(s)||/^[\s#@][\s#@\w-]*$/.test(s)?"":s};let o="";const n=[];if(Array.isArray(e.anchors))for(const i of e.anchors){if(!i||i.type!==33&&i.type!==106)continue;let s={};try{s=typeof i.extraInfo=="string"?JSON.parse(i.extraInfo):i.extraInfo||i.extra||i.extra_info||{}}catch{s=i.extra||{}}let c={};try{c=typeof i.logExtra=="string"?JSON.parse(i.logExtra):i.logExtra||{}}catch{}const a=[["anchor.keyword",i.keyword],["anchor.description",i.description],["anchor.name",i.name],["anchor.extra.elastic_title",s.elastic_title],["anchor.extra.elasticTitle",s.elasticTitle],["anchor.extra.marketing_words",Array.isArray(s.marketing_words)?s.marketing_words[0]:s.marketing_words],["anchor.extra.title",s.title],["anchor.extra.short_title",s.short_title],["anchor.extra.display_title",s.display_title],["anchor.logExtra.elastic_title",c.elastic_title],["anchor.logExtra.marketing_words",Array.isArray(c.marketing_words)?c.marketing_words[0]:c.marketing_words]];for(const[r,l]of a){const d=t(l);d&&(n.push({from:r,value:d}),o||(o=d))}if(o)break}if(!o){const i=e.commerceProductInfo||e.commerce_product_info;if(i&&typeof i=="object"){const s=(Array.isArray(i.products)?i.products[0]:i)||{},c=[["cpi.elastic_title",i.elastic_title],["cpi.marketing_words",Array.isArray(i.marketing_words)?i.marketing_words[0]:i.marketing_words],["cpi.products[0].elastic_title",s.elastic_title],["cpi.products[0].marketing_words",Array.isArray(s.marketing_words)?s.marketing_words[0]:s.marketing_words],["cpi.products[0].short_title",s.short_title],["cpi.products[0].display_title",s.display_title]];for(const[a,r]of c){const l=t(r);if(l&&(n.push({from:a,value:l}),!o)){o=l;break}}}}if(!o&&Array.isArray(e.suggestedWords))for(const i of e.suggestedWords){const s=t(typeof i=="string"?i:i==null?void 0:i.word);if(s){o=s,n.push({from:"suggestedWords",value:s});break}}return p("[Strange TTS Video] marketingTitle resolved:",o||"(none)","candidates:",JSON.stringify(n)),o}function vt(){var n,i;const e=ve();if(!e)return null;bt(e);const t=Ye(e),o=e.commerceProductInfo||e.commerce_product_info;if(o&&typeof o=="object"){const c=(Array.isArray(o.products)?o.products:o.title?[o]:[])[0];if(c&&(c.title||c.product_name||c.name)){const a=String(c.title||c.product_name||c.name||"");return{id:String(c.product_id||c.id||""),title:t||a,price:String(c.price_str||c.format_price||c.price||""),originalPrice:String(c.market_price_str||c.origin_price_str||c.market_price||""),imageUrl:String(((i=(n=c.cover)==null?void 0:n.urlList)==null?void 0:i[0])||c.cover_url||c.image||""),shopName:String(c.shop_name||c.seller_name||"TikTok Shop"),url:String(c.product_link||c.detail_url||"")}}}if(Array.isArray(e.anchors)){const s=yt(e.anchors,e);if(s)return s}return null}function kt(e){if(!e)return!1;if(Array.isArray(e.anchors)){for(const s of e.anchors)if(s&&s.type===54)return!1}const t=Array.isArray(e.anchors)&&e.anchors.length>0,o=!!(e.commerceProductInfo||e.commerce_product_info),n=e.isECVideo===1||e.isECVideo===!0,i=Array.isArray(e.AnchorTypes)&&(e.AnchorTypes.includes(33)||e.AnchorTypes.includes(106));return!(!t&&!o&&!n&&!i)}function wt(e){if(!E())return;const t=V(e);if(!t||te===t||H||P||we.has(t))return;const o=ve();if(!kt(o))return;const n=Array.isArray(o==null?void 0:o.anchors)&&o.anchors.some(a=>{if(!a||a.type!==33&&a.type!==106)return!1;const r=a.extra||a.extra_info||a.extraInfo;return!!(a.keyword||a.description||a.schema||a.actionUrl||r&&(typeof r=="string"?r.length>2:Object.keys(r).length))}),i=!!(o!=null&&o.commerceProductInfo||o!=null&&o.commerce_product_info),s=x.has(t),c=n||i||s;te=t,H=!0,queueMicrotask(()=>{if(P){H=!1;return}if(V(location.href)!==t){H=!1;return}chrome.runtime.sendMessage({type:"GET_TIKTOK_PRODUCT",url:e,strongSignal:c},a=>{if(H=!1,chrome.runtime.lastError){p("[Strange TTS Video] BG message error:",chrome.runtime.lastError.message);return}if(!(a!=null&&a.success)){p("[Strange TTS Video] Mobile fetch failed:",a==null?void 0:a.error);return}if(a.debug)try{p("[Strange TTS Video] Mobile fetch debug JSON:",JSON.stringify(a.debug))}catch{p("[Strange TTS Video] Mobile fetch debug:",a.debug)}const r=a.data;if(!r||!r.title)return;if(/^(security check|please verify|verify to continue|please complete|access denied|too many requests)$/i.test(String(r.title).trim())){p("[Strange TTS Video] Captcha-shaped product title → skip render",r.title);return}if(r.id&&/^\d{6,}$/.test(String(r.id))&&(!r.url||!/tiktok\.com\/shop\//.test(r.url))){const b=(r.title||"product").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"product";r.url=`https://www.tiktok.com/shop/vn/pdp/${b}/${r.id}`,p("[Strange TTS Video] Synthesized PDP URL from product_id:",r.url)}if(!r.url||!/tiktok\.com\/shop\//.test(r.url)||V(location.href)!==t||P)return;const l=(r.title||"").trim(),d=l.length>0&&l.length<=80,g=Ye(ve());Ke({title:d?l:g||l,price:r.price,shopName:r.shopName,imageUrl:r.imageUrl,url:r.url,originalPrice:r.originalPrice,soldCount:r.soldCount,rating:r.rating,reviewCount:r.reviewCount,tags:r.tags,description:r.description}),P=!0})})}async function je(){y=await tt(),ze(),ue(y.cleanVideoMode),xt(),chrome.storage.onChanged.addListener((o,n)=>{var a;if(n!=="sync")return;const i=(a=o.ext_settings)==null?void 0:a.newValue;if(!i)return;const s=y.unlockShopVideo,c=y.productViewer;y={...y,...i},ze(),ue(y.cleanVideoMode),y.unlockShopVideo&&!s&&(w="idle",be()),!y.unlockShopVideo&&s&&qe(),y.productViewer&&!c&&(P=!1,ae(),Se()),!y.productViewer&&c&&(ie(),Z(),v==null||v.disconnect(),v=null,R="")});const e=new MutationObserver(()=>{if(!E()){e.disconnect();return}w==="injected"&&!document.getElementById(T)&&(w="idle",y.unlockShopVideo&&K(location.href)&&setTimeout(()=>{E()&&be()},200)),fe()});e.observe(document.body,{childList:!0,subtree:!0});const t=setInterval(()=>{if(!E()){clearInterval(t);return}const o=V(location.href),n=V(De);o!==n?(n&&Je(),De=location.href,w="idle",P=!1,J="",te="",H=!1,it.clear(),j&&(clearTimeout(j),j=null),qe(),ie(),setTimeout(fe,100),Se()):(et(),Ce("url-watch"))},500);fe(),ue(y.cleanVideoMode)}function fe(){lt(),et(),Ce("dom-change"),y.unlockShopVideo&&be(),y.productViewer&&ae(),y.productViewer&&Se()}function xt(){Ce=e=>{y.autoPiP}}let We="";function _t(){if(We===location.href)return;We=location.href;const e=Array.from(document.querySelectorAll('a[href*="shop"], a[href*="/pdp/"], a[href*="tcm"]'));p(`[Strange TTS Video] Shop-like <a> count: ${e.length}`),e.slice(0,10).forEach((n,i)=>{var a,r;const s=n.getBoundingClientRect(),c=s.width>0&&s.height>0&&s.bottom>0&&s.top<window.innerHeight;p(`  [a-${i}]`,c?"VISIBLE":"hidden",`${Math.round(s.width)}x${Math.round(s.height)}`,"href=",n.href.slice(0,100),"text=",(n.textContent||"").trim().slice(0,80),"class=",(((r=(a=n.className)==null?void 0:a.toString)==null?void 0:r.call(a))||"").slice(0,80))});const t=Array.from(document.querySelectorAll('[class*="nchor" i], [class*="Product" i], [class*="ShopAnchor" i], [class*="ShopCard" i], [class*="ProductCard" i], [class*="adge" i]'));p(`[Strange TTS Video] Anchor/product/card-like elements: ${t.length}`),t.slice(0,15).forEach((n,i)=>{var r,l,d;const s=n.getBoundingClientRect(),c=(n.textContent||"").trim().slice(0,80),a=n.innerHTML.slice(0,120).replace(/\s+/g," ");p(`  [c-${i}] <${n.tagName.toLowerCase()}>`,`${Math.round(s.width)}x${Math.round(s.height)} @ (${Math.round(s.left)}, ${Math.round(s.top)})`,"class=",(((l=(r=n.className)==null?void 0:r.toString)==null?void 0:l.call(r))||"").slice(0,120),"data-e2e=",n.getAttribute("data-e2e")||"","href=",n.href||((d=n.querySelector("a"))==null?void 0:d.getAttribute("href"))||"","text=",c,"html=",a)});const o=Array.from(document.querySelectorAll('[data-e2e*="shop" i], [data-e2e*="product" i], [data-e2e*="anchor" i]'));p(`[Strange TTS Video] data-e2e shop/product/anchor: ${o.length}`),o.slice(0,10).forEach((n,i)=>{const s=n.getBoundingClientRect();p(`  [e-${i}]`,n.getAttribute("data-e2e"),`${Math.round(s.width)}x${Math.round(s.height)}`,"tag=",n.tagName.toLowerCase(),"text=",(n.textContent||"").trim().slice(0,60))})}function ae(){if(!E()||P||!K(location.href)||J===location.href)return;const e=vt(),t=!!(e!=null&&e.url)&&/tiktok\.com\/shop\//i.test(e.url);if(!e||!t){wt(location.href),_t(),J=location.href,j&&clearTimeout(j),j=window.setTimeout(()=>{P||(J="")},3500);return}Ke(e),P=!0}function Tt(){const e=document.querySelectorAll('[class*="DivAnchorTagWrapper"], [class*="DivAnchorTag"], [class*="ShopAnchor"], [data-e2e*="anchor"]');for(const t of e){const o=t.getBoundingClientRect();if(o.height<10||o.width<40)continue;const n=(t.innerText||t.textContent||"").trim();if(!n||/capcut|try this effect|edit like|editing made|template/i.test(n)||n.length>80)continue;const i=n.replace(/^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+/u,"").trim();if(i.length>=3)return i}return""}function Ke(e){var k,B;(k=document.getElementById(Y))==null||k.remove();const t=e.url||"";if(p("renderProductCard called",{hasUrl:!!t,title:e.title,layout:{vw:window.innerWidth,vh:window.innerHeight}}),!t)return;const o=Date.now(),n=V(location.href),i=Tt(),s=(e.title||"").trim();let a=(!!i&&(!s||i.length<s.length*.8&&i.length<=60)?i:s)||(y.language==="vi"?"Xem sản phẩm TikTok Shop":"View TikTok Shop product");if(a.length>40){const h=a.match(/^(.{8,45}?)\s*[\|\u00b7\u2022\u2013\u2014\-\u2013\u2014]\s+/);h&&(a=h[1].trim())}if(a.length>40){const h=a.slice(0,38),S=h.lastIndexOf(" ");a=(S>=20?h.slice(0,S):h).trim()+"…"}oe();const r=document.createElement("div");r.id=Y,r.dataset.videoId=n;const l="position: fixed; bottom: 90px; left: 24px; opacity: 0; visibility: hidden;";r.style.cssText=`
    ${l}
    z-index: 2147483647;
    background: linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 999px;
    padding: 8px 14px 8px 8px;
    box-shadow:
      0 8px 28px rgba(0,0,0,0.45),
      0 0 18px rgba(34,211,238,0.18),
      inset 0 1px 0 rgba(255,255,255,0.22),
      inset 0 -1px 0 rgba(217,70,239,0.10);
    min-width: min(240px, calc(100% - 32px));
    max-width: min(380px, calc(100% - 24px));
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'DM Sans', sans-serif;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s;
    animation: tpProductSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  `;const d=`
    <div style="
      width:32px;height:32px;border-radius:50%;
      background:#fff;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;border:1px solid rgba(255,255,255,0.75);
      box-shadow: 0 2px 8px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(217,70,239,0.12);
      overflow:hidden;
    ">
      <img src="${Ee}" alt="" style="width:24px;height:24px;object-fit:contain;display:block;" />
    </div>
  `;if(r.innerHTML=`
    ${d}
    <div title="${m(a)}" style="
      flex:1; min-width:0; font-size:13px; font-weight:700; line-height:1.3;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      overflow:hidden; text-overflow:ellipsis; word-break:break-word;
      max-height:2.7em;
    ">${m(a)}</div>
    <button id="__strangetts_video_product_close" style="
      background:transparent;border:none;color:rgba(255,255,255,0.45);cursor:pointer;
      padding:2px 4px;font-size:14px;line-height:1;flex-shrink:0;font-weight:600;
    ">&times;</button>
  `,!document.getElementById("__strangetts_video_product_keyframes")){const h=document.createElement("style");h.id="__strangetts_video_product_keyframes",h.textContent=`
      @keyframes tpProductSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #${Y}:hover {
        transform: translateY(-2px);
        border-color: rgba(217,70,239,0.5);
        background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%);
        box-shadow:
          0 12px 36px rgba(0,0,0,0.55),
          0 0 28px rgba(217,70,239,0.35),
          inset 0 1px 0 rgba(255,255,255,0.3),
          inset 0 -1px 0 rgba(34,211,238,0.15);
      }
    `,document.head.appendChild(h)}r.addEventListener("click",h=>{h.target.id!=="__strangetts_video_product_close"&&(h.preventDefault(),h.stopPropagation(),$t(e,r))},{capture:!0}),(B=r.querySelector("#__strangetts_video_product_close"))==null||B.addEventListener("click",h=>{h.stopPropagation(),r.remove()}),document.body.appendChild(r);const g=()=>{var $,W;if(!r.isConnected)return;let h=null,S="";const I=oe();if(I&&(h=I.getBoundingClientRect(),S=`container:${(((W=($=I.className)==null?void 0:$.toString)==null?void 0:W.call($))||"").slice(0,80)}`),!h||h.width<50){const L=document.getElementById(T);L&&(h=L.getBoundingClientRect(),S="injected-wrapper")}if(!h||h.width<50){const L=re();if(L){const z=L.getBoundingClientRect();z.width>=300&&z.height>=300&&(h=z,S="best-video")}}if(!h||h.width<50){r.style.visibility!=="hidden"&&(r.style.visibility="hidden",r.style.opacity="0"),Date.now()-o>8e3&&r.remove();return}let N=Math.max(8,h.left+12),M=Math.max(8,window.innerHeight-h.bottom+80);h.bottom>window.innerHeight&&(M=80),h.left>window.innerWidth&&(N=16),r.style.left=`${Math.round(N)}px`,r.style.bottom=`${Math.round(M)}px`,r.style.right="",r.style.top="",r.style.visibility==="hidden"&&(r.style.visibility="visible",r.style.opacity="1"),p("positionCart",{src:S,rect:{l:Math.round(h.left),t:Math.round(h.top),w:Math.round(h.width),h:Math.round(h.height),b:Math.round(h.bottom)},placed:{left:Math.round(N),bottom:Math.round(M)},vp:{w:window.innerWidth,h:window.innerHeight},zoom:Math.round(window.devicePixelRatio*100)/100})};requestAnimationFrame(g);const u=()=>g();window.addEventListener("resize",u),window.addEventListener("scroll",u,!0);let b=null;try{b=new ResizeObserver(()=>g()),b.observe(document.body)}catch{}const A=new MutationObserver(()=>{r.isConnected||(window.removeEventListener("resize",u),window.removeEventListener("scroll",u,!0),b==null||b.disconnect(),A.disconnect())});A.observe(document.body,{childList:!0,subtree:!0})}function ie(){var e;(e=document.getElementById(Y))==null||e.remove(),P=!1}const ke="__strangetts_video_profile_shop_badge",x=new Set,we=new Set;let R="",G="",v=null;function St(e){try{const o=new URL(e).pathname.match(/^\/@([^/]+)(?:\/|$)/);return o?o[1]:null}catch{return null}}function se(e){try{const t=new URL(e);return/^\/@[^/]+\/?$/.test(t.pathname)}catch{return!1}}function Xe(e){try{const o=new URL(e).pathname.match(/^\/@([^/]+)\/?$/);return o?o[1]:null}catch{return null}}const ne=new Set;window.addEventListener("message",e=>{if(e.source!==window)return;const t=e.data;if((t==null?void 0:t.type)==="__STRANGETTS_VIDEO_PROBE_URL__"){p("[Strange TTS Video] probe url:",t.url);return}if(!t||t.type!=="__STRANGETTS_VIDEO_PROFILE_POSTS__")return;const o=Array.isArray(t.shopIds)?t.shopIds:[];if(Array.isArray(t.nonShopIds)){let i=0;for(const s of t.nonShopIds)we.has(s)||(we.add(s),i++);i&&p("[Strange TTS Video] hook delivered",t.nonShopIds.length,"non-shop ids (",i,"new)")}if(Array.isArray(t.sample))try{p("[Strange TTS Video] sample item shape:",JSON.stringify(t.sample))}catch{p("[Strange TTS Video] sample item shape (object):",t.sample)}if(!o.length){p("[Strange TTS Video] hook delivered 0 shop ids (",t.total,"total items)");return}if(!se(location.href))return;let n=0;for(const i of o)x.has(i)||(x.add(i),n++);p("[Strange TTS Video] hook delivered",o.length,"shop ids (",n,"new) /",t.total,"total items"),n&&(O(),setTimeout(()=>Ze(),400))});function Pt(e){if(!ne.has(e)){ne.add(e);try{chrome.runtime.sendMessage({type:"GET_PROFILE_SHOP_VIDEOS",username:e},t=>{if(chrome.runtime.lastError){p("[Strange TTS Video] BG error:",chrome.runtime.lastError.message);return}if(!(t!=null&&t.success)){p("[Strange TTS Video] BG returned failure:",t==null?void 0:t.error);return}const o=t.shopVideoIds||[];if(p("[Strange TTS Video] BG returned",o.length,"shop ids /",t.totalScanned,"scanned"),Xe(location.href)!==e){p("[Strange TTS Video] User navigated away, skipping apply");return}o.forEach(n=>x.add(n)),O()})}catch(t){p("[Strange TTS Video] sendMessage threw:",t.message)}}}function xe(e,t,o=3,n=""){const i=[];if(!e||typeof e!="object"||t>o)return i;if(Array.isArray(e))return i.push(`${n}Array(${e.length})${e[0]&&typeof e[0]=="object"?" of obj":""}`),i;const s=Object.keys(e).slice(0,25);for(const c of s){const a=e[c];if(Array.isArray(a))i.push(`${n}${c}: Array(${a.length})`),a.length&&typeof a[0]=="object"&&a[0]&&(a[0].id||a[0].aweme_id)&&i.push(`${n}  → sample keys: ${Object.keys(a[0]).slice(0,20).join(",")}`);else if(a&&typeof a=="object"){const r=Object.keys(a).slice(0,10);i.push(`${n}${c}: { ${r.join(", ")} }`),t<o&&i.push(...xe(a,t+1,o,n+"  "))}}return i}function Ct(){const e=new Set,t=document.querySelectorAll('script#__UNIVERSAL_DATA_FOR_REHYDRATION__, script#SIGI_STATE, script[id*="UNIVERSAL_DATA"]');if(p("[Strange TTS Video] SIGI nodes found:",t.length,Array.from(t).map(n=>n.id)),t.length)try{const n=JSON.parse(t[0].textContent||"{}"),i=(n==null?void 0:n.__DEFAULT_SCOPE__)||n,s=i==null?void 0:i["webapp.user-detail"];s&&p("[Strange TTS Video] webapp.user-detail tree:",xe(s,0,4).join(`
`));for(const c of Object.keys(i||{}))/post|item|video|feed/i.test(c)&&p(`[Strange TTS Video] SIGI scope ${c}:`,xe(i[c],0,3).join(`
`))}catch{}let o=0;for(const n of t){let i=function(a,r){if(!(!a||typeof a!="object"||r>12)&&!c.has(a)){if(c.add(a),Array.isArray(a)){for(const l of a){if(!l||typeof l!="object")continue;const d=l.id||l.video_id||l.aweme_id||l.itemId;if(d&&/^\d{6,}$/.test(String(d))){let g=!1;if(Array.isArray(l.anchors))for(const k of l.anchors){if(!k||k.type!==33)continue;const B=String(k.schema||k.action_url||""),h=k.extra||{},S=typeof k.keyword=="string"?k.keyword:"",I=/capcut|edit like|editing made|template|effect/i.test(S);if(/\/shop\//.test(B)||!!h.product_id||!!h.shop_id||S&&!I){g=!0;break}}const u=!!l.commerceProductInfo||!!l.ecCommerceInfo,b=Array.isArray(l.anchors)&&l.anchors.some(k=>k&&k.type===54),A=(l.isECVideo===!0||l.isECVideo===1)&&!b;(g||u||A)&&e.add(String(d))}i(l,r+1)}return}for(const l of Object.keys(a))i(a[l],r+1)}},s;try{s=JSON.parse(n.textContent||"{}")}catch(a){p("[Strange TTS Video] SIGI parse fail",a.message);continue}o++;const c=new WeakSet;i(s,0),p("[Strange TTS Video] SIGI scope keys:",Object.keys((s==null?void 0:s.__DEFAULT_SCOPE__)||s||{}).slice(0,20))}return p("[Strange TTS Video] SIGI scanned",o,"roots → shop ids:",e.size),e}function Et(e,t){if(!x.has(t)||e.querySelector("."+ke))return;getComputedStyle(e).position==="static"&&(e.style.position="relative");const n=document.createElement("div");if(n.className=ke,n.style.cssText=`
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    width: 30px !important;
    height: 30px !important;
    border-radius: 50% !important;
    background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.86) 100%) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 2147483640 !important;
    box-shadow:
      0 2px 8px rgba(0,0,0,0.35),
      0 0 12px rgba(217,70,239,0.25),
      inset 0 0 0 1px rgba(217,70,239,0.18) !important;
    pointer-events: none !important;
    animation: tpProfileBadgeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    opacity: 1 !important;
    visibility: visible !important;
  `,n.innerHTML=`<img src="${Ee}" alt="" style="width:20px;height:20px;object-fit:contain;display:block;" />`,e.appendChild(n),!document.getElementById("__strangetts_video_profile_badge_keyframes")){const i=document.createElement("style");i.id="__strangetts_video_profile_badge_keyframes",i.textContent=`
      @keyframes tpProfileBadgeIn {
        from { opacity: 0; transform: scale(0.6); }
        to   { opacity: 1; transform: scale(1); }
      }
    `,document.head.appendChild(i)}}function O(){if(!x.size)return;const e=document.querySelectorAll('a[href*="/video/"]'),t=new Map;let o=0,n=0;for(const i of e){const s=i.href.match(/\/video\/(\d+)/);if(!s)continue;const c=s[1];if(!x.has(c))continue;o++;let a=i,r=null;for(let d=0;d<6&&a;d++){const g=a.getBoundingClientRect(),u=!!a.querySelector("img");if(g.width>=140&&g.width<=480&&g.height>=180&&g.height<=900&&u){r=a;break}if(g.width>480)break;a=a.parentElement}if(!r)continue;const l=`${c}@${Math.round(r.getBoundingClientRect().left)},${Math.round(r.getBoundingClientRect().top)}`;t.has(l)||(t.set(l,r),Et(r,c),n++)}p("[Strange TTS Video] scan: anchors=",e.length," shopAnchors=",o," badged=",n)}function Z(){document.querySelectorAll("."+ke).forEach(e=>e.remove())}let _e=0;function Qe(){if(!se(location.href)||Date.now()-_e<4e3)return;_e=Date.now();const e=window.scrollY,t=[400,1200,2400,4e3];t.forEach((o,n)=>{setTimeout(()=>window.scrollTo({top:e+o,behavior:"auto"}),n*250)}),setTimeout(()=>window.scrollTo({top:e,behavior:"auto"}),t.length*250+120)}let Te=0;function Ze(){if(!se(location.href)||Te>=3)return;const e=new Set;document.querySelectorAll('a[href*="/video/"]').forEach(n=>{const i=n.href.match(/\/video\/(\d+)/);i&&e.add(i[1])});let t=0;e.forEach(n=>{x.has(n)&&t++});const o=e.size-t;o>4&&(Te++,p("[Strange TTS Video] DOM has",e.size,"unique ids,",t,"in cache,",o,"missing → nudge again"),_e=0,Qe())}function Se(){const e=se(location.href),t=St(location.href);if(p("[Strange TTS Video] ensureProfileShopBadges",{url:location.href,isProfile:e,lastUrl:R,lastUser:G,currentUser:t,idsCached:x.size}),!e&&t&&t===G){v&&(v.disconnect(),v=null),Z();return}if(!e){R&&(v==null||v.disconnect(),v=null,x.clear(),ne.clear(),G="",Z(),R="");return}if(e&&t&&t===G&&x.size>0){R=location.href,p("[Strange TTS Video] returning to same profile, re-scan with cached ids:",x.size),O(),Ze(),v||(v=new MutationObserver(()=>{if(!E()){v==null||v.disconnect(),v=null;return}O()}),v.observe(document.body,{childList:!0,subtree:!0}));return}if(R!==location.href){R=location.href,G=t||"",x.clear(),ne.clear(),Te=0,Z();const o=n=>{const i=Ct();if(p("[Strange TTS Video] extract attempt",n,"→ SIGI ids:",i.size),i.size)i.forEach(s=>x.add(s)),p("[Strange TTS Video] Profile shop video ids (SIGI):",x.size),O();else if(n<2)setTimeout(()=>o(n+1),500);else{const s=Xe(location.href);s&&Pt(s),Qe()}};o(0)}else O();v||(v=new MutationObserver(()=>{if(!E()){v==null||v.disconnect(),v=null;return}O()}),v.observe(document.body,{childList:!0,subtree:!0}))}const F="__strangetts_video_product_popover",At=340,q=8,he=16;function $t(e,t){var L,z,Ie,Be;(L=document.getElementById(F))==null||L.remove();const o=Pe[y.language].content,n=y.language==="vi"?"Sản phẩm":"Product",i=o.modalTitle||"PRODUCT INFO",s=o.modalReload||"Reload",c=o.modalClose||"Close",a=o.modalProductLabel||"Product",r=o.modalSoldLabel||"Sold",l=o.modalOpenShop||"Open on TikTok Shop →",d=document.createElement("div");d.id=F,d.style.cssText=`
    position: fixed; inset: 0; z-index: 2147483647;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    animation: tpPopoverFadeIn 0.15s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'DM Sans', sans-serif;
  `;const g=Ee,u=document.createElement("div");u.dataset.side="top",u.style.cssText=`
    position: fixed; left: 0; top: 0; visibility: hidden;
    width: ${At}px; max-width: calc(100vw - ${he*2}px);
    max-height: calc(100vh - ${he*2}px); overflow: hidden;
    background: linear-gradient(180deg, rgba(20,20,28,0.97) 0%, rgba(10,10,15,0.97) 100%);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(34,211,238,0.25);
    border-radius: 16px;
    box-shadow:
      0 24px 64px rgba(0,0,0,0.6),
      0 0 30px rgba(34,211,238,0.18),
      inset 0 1px 0 rgba(255,255,255,0.08);
    color: #fff;
    display: flex; flex-direction: column;
    transform-origin: top left;
  `;const b=e.price||e.originalPrice?`
    <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
      ${e.price?`<div style="font-size: 22px; font-weight: 800; color: #f472b6; line-height:1.1;">${m(e.price)}</div>`:""}
      ${e.originalPrice?`<div style="font-size: 12px; opacity: 0.55; text-decoration: line-through;">${m(e.originalPrice)}</div>`:""}
    </div>`:"",A=e.tags&&e.tags.length?`
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
      ${e.tags.slice(0,4).map(f=>`<span style="
        display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 4px;
        background: linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08));
        border: 1px solid rgba(34,197,94,0.35); color: #4ade80;
        font-size: 10px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
      ">${m(f)}</span>`).join("")}
    </div>`:"",k=[];e.rating&&k.push(`★ ${m(e.rating)}${e.reviewCount?` <span style="opacity:0.6;">(${m(e.reviewCount)})</span>`:""}`),e.soldCount&&k.push(`${m(e.soldCount)} ${m(r.toLowerCase())}`);const B=k.length?`
    <div style="display:flex; align-items:center; gap:10px; font-size: 12px; opacity: 0.85; margin-top: 8px;">
      ${k.join('<span style="opacity:0.4;">|</span>')}
    </div>`:"",h=!!e.imageUrl,S=(e.shopName||"").trim().toLowerCase(),I=!!e.shopName&&S!=="tiktok shop",ce=h?`
    <div style="aspect-ratio: 1/1; width: 100%; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
      <img src="${m(e.imageUrl)}" alt="" style="width:100%; height:100%; object-fit:contain; display:block;" referrerpolicy="no-referrer" />
    </div>`:`
    <div style="
      width: 100%; padding: 22px 12px; display:flex; align-items:center; gap:10px;
      background: linear-gradient(135deg, rgba(34,211,238,0.10) 0%, rgba(236,72,153,0.10) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    ">
      <img src="${g}" alt="" style="width:34px;height:34px;border-radius:999px;background:#fff;padding:6px;box-sizing:border-box;flex-shrink:0;" />
      <div style="flex:1; min-width:0;">
        <div style="font-size:11px; opacity:0.65;">${m(a)}</div>
        <div style="font-size:13px; font-weight:600; line-height:1.3; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${m(e.title||n)}
        </div>
      </div>
    </div>`;u.innerHTML=`
    <!-- Header -->
    <div style="display:flex; align-items:center; gap:8px; padding:11px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;">
      <img src="${g}" alt="" style="width:18px;height:18px;border-radius:999px;background:#fff;padding:3px;box-sizing:border-box;" />
      <span style="font-weight:700; font-size:11px; letter-spacing:0.6px;">${m(i.toUpperCase())}</span>
      <div style="flex:1;"></div>
      <button id="__tpp_reload" type="button" aria-label="${m(s)}" style="
        padding: 3px 9px; border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06); color: #fff;
        font-size: 10px; cursor: pointer; line-height: 1;
        display: inline-flex; align-items: center; gap: 4px;
      ">⟳ ${m(s)}</button>
      <button id="__tpp_close" type="button" aria-label="${m(c)}" style="
        width: 24px; height: 24px; border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06); color: #fff;
        font-size: 12px; cursor: pointer; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
      ">✕</button>
    </div>

    <!-- Scrollable body -->
    <div style="overflow-y: auto; -webkit-overflow-scrolling: touch;">
      ${ce}

      ${h?`
      <!-- Body (shown when there's an image; otherwise the image-block already
           contains the title) -->
      <div style="padding: 12px 14px;" data-tpp-body="1">
        <div style="font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; opacity: 0.55; margin-bottom: 4px;">${m(a)}</div>
        ${b}
        ${A}
        <div style="font-size: 13px; font-weight: 600; line-height: 1.4; margin-bottom: 4px; word-break: break-word;">
          ${m(e.title||n)}
        </div>
        ${I?`<div style="font-size: 11px; opacity: 0.7;">by ${m(e.shopName)}</div>`:""}
        ${B}
        ${e.description?`
          <div style="font-size: 11px; line-height: 1.55; opacity: 0.8; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); word-break: break-word; max-height: 6em; overflow-y: auto;">
            ${m(e.description.slice(0,400))}
          </div>`:""}
      </div>`:`
      ${b||A||B||e.description||I?`
      <!-- Compact body for no-image case: only render if there's something
           non-trivial to show beyond title. -->
      <div style="padding: 10px 14px;" data-tpp-body="1">
        ${b}
        ${A}
        ${I?`<div style="font-size: 11px; opacity: 0.7;">by ${m(e.shopName)}</div>`:""}
        ${B}
        ${e.description?`
          <div style="font-size: 11px; line-height: 1.55; opacity: 0.8; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); word-break: break-word; max-height: 6em; overflow-y: auto;">
            ${m(e.description.slice(0,400))}
          </div>`:""}
      </div>`:""}`}
    </div>

    <!-- CTA footer -->
    <div style="padding: 10px 12px 12px; flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06);">
      <button id="__tpp_open" type="button" style="
        width: 100%; padding: 11px 16px; border: none; border-radius: 999px;
        background: linear-gradient(135deg, #22d3ee 0%, #ec4899 100%);
        color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
        box-shadow: 0 6px 20px rgba(236,72,153,0.4), inset 0 1px 0 rgba(255,255,255,0.25);
        transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
      ">${m(l)}</button>
    </div>
  `,d.appendChild(u),document.body.appendChild(d);const N=()=>{const f=t==null?void 0:t.getBoundingClientRect(),_=u.getBoundingClientRect(),X=window.innerWidth,U=window.innerHeight,C=he;let le=f?f.left:(X-_.width)/2;le=Math.max(C,Math.min(le,X-_.width-C));let D,Q="top";if(f){const Me=f.top-q-C,Le=U-f.bottom-q-C;Me>=_.height?D=f.top-q-_.height:Le>=_.height?(D=f.bottom+q,Q="bottom"):Me>=Le?D=Math.max(C,f.top-q-_.height):(D=Math.min(U-_.height-C,f.bottom+q),Q="bottom")}else D=(U-_.height)/2;D=Math.max(C,Math.min(D,U-_.height-C)),u.style.left=`${Math.round(le)}px`,u.style.top=`${Math.round(D)}px`,u.style.visibility="visible",u.dataset.side=Q,u.style.animation=Q==="top"?"tpPopoverSlideUp 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)":"tpPopoverSlideDown 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)"};requestAnimationFrame(N);const M=()=>{document.body.contains(d)&&N()};window.addEventListener("resize",M),window.addEventListener("scroll",M,!0);const $=()=>{document.body.contains(d)&&(u.style.animation=u.dataset.side==="top"?"tpPopoverSlideDown 0.15s ease-in reverse":"tpPopoverSlideUp 0.15s ease-in reverse",d.style.animation="tpPopoverFadeIn 0.15s ease-in reverse",setTimeout(()=>{d.remove(),window.removeEventListener("resize",M),window.removeEventListener("scroll",M,!0),document.removeEventListener("keydown",W,!0)},130))},W=f=>{f.key==="Escape"&&(f.stopPropagation(),$())};if(document.addEventListener("keydown",W,!0),d.addEventListener("click",f=>{f.target===d&&$()}),(z=u.querySelector("#__tpp_close"))==null||z.addEventListener("click",f=>{f.stopPropagation(),$()}),(Ie=u.querySelector("#__tpp_reload"))==null||Ie.addEventListener("click",f=>{f.stopPropagation(),J="",te="",P=!1,ie(),$(),setTimeout(()=>{E()&&ae()},50)}),(Be=u.querySelector("#__tpp_open"))==null||Be.addEventListener("click",f=>{if(f.stopPropagation(),e.url)try{chrome.runtime.sendMessage({type:"OPEN_PRODUCT_TAB",url:e.url})}catch{window.open(e.url,"_blank","noopener,noreferrer")}$()}),!document.getElementById("__tpp_keyframes")){const f=document.createElement("style");f.id="__tpp_keyframes",f.textContent=`
      @keyframes tpPopoverFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes tpPopoverSlideUp {
        from { opacity: 0; transform: translateY(8px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes tpPopoverSlideDown {
        from { opacity: 0; transform: translateY(-8px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      #${F} #__tpp_open:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 26px rgba(236,72,153,0.5), inset 0 1px 0 rgba(255,255,255,0.3);
        filter: brightness(1.05);
      }
      #${F} #__tpp_reload:hover,
      #${F} #__tpp_close:hover {
        background: rgba(255,255,255,0.12);
      }
      #${F} .tpp-skeleton {
        display: inline-block;
        height: 12px; min-width: 60px; border-radius: 4px;
        background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 100%);
        background-size: 200% 100%;
        animation: tppShimmer 1.4s ease-in-out infinite;
      }
      @keyframes tppShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `,document.head.appendChild(f)}if(e.url&&/\/shop\/[^/]+\/pdp\//.test(e.url)&&!(e.price&&e.rating&&e.soldCount)&&(It(u),E()))try{chrome.runtime.sendMessage({type:"GET_TIKTOK_PDP_INFO",url:e.url},f=>{var C;if(!document.body.contains(u))return;if(chrome.runtime.lastError){p("[Strange TTS Video] PDP fetch BG error:",chrome.runtime.lastError.message),ee(u);return}if(!(f!=null&&f.success)||!f.data){p("[Strange TTS Video] PDP fetch returned no data:",f==null?void 0:f.error),ee(u);return}p("[Strange TTS Video] PDP info",JSON.stringify(f.data));const _=f.data.title,X=!!_&&_.length>(((C=e.title)==null?void 0:C.length)||0)+10,U={...e,title:X?_:e.title,price:e.price||f.data.price,originalPrice:e.originalPrice||f.data.originalPrice,soldCount:e.soldCount||f.data.soldCount,rating:e.rating||f.data.rating,reviewCount:e.reviewCount||f.data.reviewCount,tags:e.tags&&e.tags.length?e.tags:f.data.tags,description:e.description||f.data.description,imageUrl:e.imageUrl||f.data.imageUrl};Mt(u,U)})}catch{ee(u)}}function It(e,t){if(e.querySelector('[data-tpp-skeleton="1"]'))return;const o=e.querySelector('[data-tpp-body="1"]')??Bt(e);if(!o)return;const n=document.createElement("div");n.dataset.tppSkeleton="1",n.style.cssText=`
    display:flex; gap:10px; align-items:center; margin-top:8px;
    padding-top:8px; border-top: 1px solid rgba(255,255,255,0.06);
  `,n.innerHTML=`
    <span class="tpp-skeleton" style="min-width:90px;"></span>
    <span class="tpp-skeleton" style="min-width:50px;"></span>
    <span class="tpp-skeleton" style="min-width:70px;"></span>
  `,o.appendChild(n)}function ee(e){var t;(t=e.querySelector('[data-tpp-skeleton="1"]'))==null||t.remove()}function Bt(e){const t=e.querySelectorAll('div[style*="padding"]');return t[t.length-1]||null}function Mt(e,t){ee(e);const o=e.querySelector('[data-tpp-body="1"]');if(!o)return;const n=Pe[y.language].content,i=n.modalSoldLabel||"Sold",s=n.modalProductLabel||"Product",c=y.language==="vi"?"Sản phẩm":"Product",a=!!t.shopName&&t.shopName.trim().toLowerCase()!=="tiktok shop",r=t.price||t.originalPrice?`
    <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
      ${t.price?`<div style="font-size: 22px; font-weight: 800; color: #f472b6; line-height:1.1;">${m(t.price)}</div>`:""}
      ${t.originalPrice?`<div style="font-size: 12px; opacity: 0.55; text-decoration: line-through;">${m(t.originalPrice)}</div>`:""}
    </div>`:"",l=t.tags&&t.tags.length?`
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
      ${t.tags.slice(0,4).map(u=>`<span style="
        display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 4px;
        background: linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08));
        border: 1px solid rgba(34,197,94,0.35); color: #4ade80;
        font-size: 10px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
      ">${m(u)}</span>`).join("")}
    </div>`:"",d=[];t.rating&&d.push(`★ ${m(t.rating)}${t.reviewCount?` <span style="opacity:0.6;">(${m(t.reviewCount)})</span>`:""}`),t.soldCount&&d.push(`${m(t.soldCount)} ${m(i.toLowerCase())}`);const g=d.length?`
    <div style="display:flex; align-items:center; gap:10px; font-size: 12px; opacity: 0.85; margin-top: 8px;">
      ${d.join('<span style="opacity:0.4;">|</span>')}
    </div>`:"";o.innerHTML=`
    <div style="font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; opacity: 0.55; margin-bottom: 4px;">${m(s)}</div>
    ${r}
    ${l}
    <div style="font-size: 13px; font-weight: 600; line-height: 1.4; margin-bottom: 4px; word-break: break-word;">
      ${m(t.title||c)}
    </div>
    ${a?`<div style="font-size: 11px; opacity: 0.7;">by ${m(t.shopName)}</div>`:""}
    ${g}
    ${t.description?`
      <div style="font-size: 11px; line-height: 1.55; opacity: 0.8; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); word-break: break-word; max-height: 6em; overflow-y: auto;">
        ${m(t.description.slice(0,400))}
      </div>`:""}
  `}function et(){const e=document.getElementById(Y);if(!e){P=!1;return}const t=V(location.href),o=e.dataset.videoId||"";t&&o&&t!==o&&ie()}function m(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}document.readyState==="complete"||document.readyState==="interactive"?je():document.addEventListener("DOMContentLoaded",je);
