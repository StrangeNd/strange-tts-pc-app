import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { getActiveExtensionDir } from './extension-library.mjs';

const WIN_CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

const WIN_EDGE_CANDIDATES = [
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

function playwrightChromiumCandidates() {
  if (process.platform !== 'win32') return [];
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  if (!base || !fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^chromium-/i.test(entry.name))
    .map(entry => path.join(base, entry.name, 'chrome-win64', 'chrome.exe'))
    .filter(candidate => fs.existsSync(candidate))
    .sort()
    .reverse();
}

function safeProfileName(value) {
  return String(value || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'default';
}

export function getRuntimePaths(rootDir, { profileName = 'default' } = {}) {
  const base =
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'StrangeTTSPcApp')
      : path.join(os.homedir(), '.strange-tts-pc-app');
  const profile = safeProfileName(profileName);

  return {
    sourceExtensionDir: path.join(rootDir, 'extension'),
    runtimeBase: base,
    runtimeExtensionDir: path.join(base, 'extension-runtime'),
    profilesBase: path.join(base, 'profiles'),
    profileName: profile,
    chromeProfileDir: path.join(base, 'profiles', profile)
  };
}

export function findChromeExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }

  if (process.platform === 'win32') {
    const localChrome = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
      : null;
    const localEdge = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe')
      : null;
    const candidates = localChrome
      ? [localEdge, ...WIN_EDGE_CANDIDATES, localChrome, ...WIN_CHROME_CANDIDATES, ...playwrightChromiumCandidates()]
      : [localEdge, ...WIN_EDGE_CANDIDATES, ...WIN_CHROME_CANDIDATES, ...playwrightChromiumCandidates()];
    const found = candidates.filter(Boolean).find(candidate => fs.existsSync(candidate));
    if (found) return found;
  }

  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return 'google-chrome';
}

function shellQuotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stopChromeForProfile(profileDir) {
  if (process.platform !== 'win32') return { stopped: 0, reason: 'unsupported-platform' };
  const resolved = path.resolve(profileDir);
  const script = [
    `$profile = ${shellQuotePowerShell(resolved)}`,
    "$needle = $profile.ToLowerInvariant()",
    "function Get-ProfileBrowser {",
    "  Get-CimInstance Win32_Process |",
    "    Where-Object {",
    "      ($_.Name -ieq 'chrome.exe' -or $_.Name -ieq 'msedge.exe') -and",
    "      $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($needle)",
    "    }",
    "}",
    "$stopped = 0",
    "for ($i = 0; $i -lt 30; $i++) {",
    "  $processes = @(Get-ProfileBrowser)",
    "  if ($processes.Count -eq 0) { break }",
    "  foreach ($process in $processes) {",
    "    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue",
    "    $stopped++",
    "  }",
    "  Start-Sleep -Milliseconds 150",
    "}",
    "Write-Output $stopped"
  ].join('\n');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stopped = Number.parseInt(String(result.stdout || '').trim(), 10) || 0;
  return { stopped, status: result.status };
}

function readJsonIfExists(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function ensureChromeProfileDefaults(profileDir) {
  const defaultDir = path.join(profileDir, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true, mode: 0o700 });
  const preferencesFile = path.join(defaultDir, 'Preferences');
  const preferences = readJsonIfExists(preferencesFile, {});
  preferences.extensions ||= {};
  preferences.extensions.ui ||= {};
  preferences.extensions.ui.developer_mode = true;
  preferences.extensions.settings ||= {};
  fs.writeFileSync(preferencesFile, JSON.stringify(preferences, null, 2), { mode: 0o600 });
  return preferencesFile;
}

export function syncExtensionToRuntime(rootDir, { profileName = 'default' } = {}) {
  const paths = getRuntimePaths(rootDir, { profileName });
  const activeExtensionDir = getActiveExtensionDir(rootDir);
  const manifest = path.join(activeExtensionDir, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    throw new Error(`Extension manifest not found: ${manifest}`);
  }

  fs.mkdirSync(paths.runtimeBase, { recursive: true, mode: 0o700 });
  fs.rmSync(paths.runtimeExtensionDir, { recursive: true, force: true });
  fs.cpSync(activeExtensionDir, paths.runtimeExtensionDir, { recursive: true });
  fs.mkdirSync(paths.chromeProfileDir, { recursive: true, mode: 0o700 });
  ensureChromeProfileDefaults(paths.chromeProfileDir);
  return { ...paths, activeExtensionDir };
}

async function discoverExtensionId(cdp) {
  for (let i = 0; i < 40; i += 1) {
    const result = await cdp.send('Target.getTargets');
    const targets = (result.targetInfos || []).filter(info => /chrome-extension:\/\/[^/]+\//.test(info.url || ''));
    const target =
      targets.find(info => info.type === 'service_worker' && /\/(?:src\/background|service_worker)\.js$/i.test(info.url || ''))
      || targets.find(info => /Strange TTS/i.test(info.title || '') && /\/pages\/offscreen\.html(?:$|[?#])/i.test(info.url || ''))
      || targets.find(info => /\/pages\/(?:login|dashboard|guide)\.html(?:$|[?#])/i.test(info.url || '') && /Strange TTS/i.test(info.title || ''));
    const match = target?.url?.match(/chrome-extension:\/\/([^/]+)\//);
    if (match?.[1]) return match[1];
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return '';
}

async function openExtensionPage(cdp, extensionId, page = 'pages/login.html') {
  if (!extensionId) return '';
  const cleanPage = String(page || 'pages/login.html').replace(/^\/+/, '');
  const url = `chrome-extension://${extensionId}/${cleanPage}`;
  await cdp.send('Target.createTarget', { url });
  return url;
}

async function closeTargetsByUrl(cdp, urlToClose) {
  if (!urlToClose) return 0;
  const targets = await cdp.send('Target.getTargets');
  const matches = (targets.targetInfos || [])
    .filter(info => info.type === 'page' && info.url === urlToClose);
  for (const target of matches) {
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
  }
  return matches.length;
}

async function closeOtherPageTargets(cdp, keepUrl) {
  if (!keepUrl) return 0;
  const targets = await cdp.send('Target.getTargets');
  const matches = (targets.targetInfos || [])
    .filter(info => info.type === 'page' && info.url !== keepUrl);
  for (const target of matches) {
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
  }
  return matches.length;
}

async function closeOtherPageTargetsById(cdp, keepTargetId) {
  if (!keepTargetId) return 0;
  const targets = await cdp.send('Target.getTargets');
  const matches = (targets.targetInfos || [])
    .filter(info => info.type === 'page' && info.targetId !== keepTargetId);
  for (const target of matches) {
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
  }
  return matches.length;
}

async function closeBlankPageTargets(cdp) {
  const targets = await cdp.send('Target.getTargets');
  const matches = (targets.targetInfos || [])
    .filter(info => info.type === 'page' && /^(about:blank|chrome:\/\/newtab\/?)/i.test(info.url || ''));
  for (const target of matches) {
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
  }
  return matches.length;
}

async function navigateFirstPageTarget(cdp, url) {
  const targets = await cdp.send('Target.getTargets');
  const target =
    (targets.targetInfos || []).find(info => info.type === 'page' && /^(about:blank|chrome:\/\/newtab\/?)/i.test(info.url || ''))
    || (targets.targetInfos || []).find(info => info.type === 'page');
  if (!target?.targetId) return false;
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  await cdp.send('Page.enable', {}, attached.sessionId).catch(() => {});
  await cdp.send('Page.navigate', { url }, attached.sessionId);
  return true;
}

async function waitForExtensionRuntimeTarget(cdp, extensionId) {
  const prefix = `chrome-extension://${extensionId}/`;
  for (let i = 0; i < 60; i += 1) {
    const targets = await cdp.send('Target.getTargets');
    const targetInfos = targets.targetInfos || [];
    const target =
      targetInfos.find(info => info.type === 'page' && String(info.url || '').startsWith(prefix))
      || targetInfos.find(info => info.type === 'background_page' && String(info.url || '').startsWith(prefix))
      || targetInfos.find(info => (
      String(info.url || '').startsWith(prefix) &&
      info.type === 'service_worker'
    ));
    if (target?.targetId) return target;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
}

async function openExtensionRuntimeMessagePage(cdp, extensionId) {
  const url = `chrome-extension://${extensionId}/pages/login.html`;
  const created = await cdp.send('Target.createTarget', { url });
  await new Promise(resolve => setTimeout(resolve, 500));
  const targets = await cdp.send('Target.getTargets');
  return (targets.targetInfos || []).find(info => info.targetId === created.targetId)
    || (targets.targetInfos || []).find(info => info.type === 'page' && info.url === url)
    || null;
}

function commonChromeArgs(paths, debugPort) {
  return [
    `--user-data-dir=${paths.chromeProfileDir}`,
    `--disable-extensions-except=${paths.runtimeExtensionDir}`,
    `--load-extension=${paths.runtimeExtensionDir}`,
    `--remote-debugging-port=${debugPort}`,
    '--remote-allow-origins=*',
    '--enable-extensions',
    '--disable-infobars',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--high-dpi-support=1'
  ];
}

function extensionIdCachePath(paths) {
  return path.join(paths.runtimeBase, 'extension-id.json');
}

function readCachedExtensionId(paths) {
  try {
    const data = readJsonIfExists(extensionIdCachePath(paths), null);
    return typeof data?.extensionId === 'string' ? data.extensionId : '';
  } catch {
    return '';
  }
}

function writeCachedExtensionId(paths, extensionId) {
  if (!extensionId) return;
  fs.mkdirSync(paths.runtimeBase, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    extensionIdCachePath(paths),
    JSON.stringify({ extensionId, updatedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 }
  );
}

async function setExtensionLocalStorage(cdp, extensionId, values) {
  if (!extensionId || !values || typeof values !== 'object') return false;
  const prefix = `chrome-extension://${extensionId}/`;
  let targets = await cdp.send('Target.getTargets');
  let targetInfo = (targets.targetInfos || []).find(info => (
    String(info.url || '').startsWith(prefix) &&
    ['page', 'background_page', 'service_worker'].includes(info.type)
  ));
  let createdTargetId = '';
  if (!targetInfo?.targetId) {
    const created = await cdp.send('Target.createTarget', { url: `${prefix}pages/login.html` });
    createdTargetId = created.targetId;
    await new Promise(resolve => setTimeout(resolve, 350));
    targets = await cdp.send('Target.getTargets');
    targetInfo = (targets.targetInfos || []).find(info => info.targetId === createdTargetId);
  }
  if (!targetInfo?.targetId) return false;

  const attached = await cdp.send('Target.attachToTarget', { targetId: targetInfo.targetId, flatten: true });
  try {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => new Promise(resolve => {
        try {
          if (!globalThis.chrome?.storage?.local) return resolve(false);
          chrome.storage.local.set(${JSON.stringify(values)}, () => resolve(!chrome.runtime.lastError));
        } catch {
          resolve(false);
        }
      }))()`,
      awaitPromise: true,
      returnByValue: true
    }, attached.sessionId);
    return Boolean(result?.result?.value);
  } finally {
    if (createdTargetId) {
      await cdp.send('Target.closeTarget', { targetId: createdTargetId }).catch(() => {});
    }
  }
}

async function discoverExtensionIdWithHiddenWindow(rootDir, { profileName = 'default' } = {}) {
  const paths = syncExtensionToRuntime(rootDir, { profileName });
  const chrome = findChromeExecutable();
  stopChromeForProfile(paths.chromeProfileDir);
  const debugPort = await getFreePort();
  const args = [
    ...commonChromeArgs(paths, debugPort),
    '--window-position=-32000,-32000',
    '--window-size=800,600',
    'about:blank'
  ];
  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  const debuggerInfo = await waitForDebugger(debugPort);
  const cdp = await createCdpClient(debuggerInfo.webSocketDebuggerUrl);
  try {
    const extensionId = await discoverExtensionId(cdp);
    writeCachedExtensionId(paths, extensionId);
    return extensionId;
  } finally {
    cdp.close();
    stopChromeForProfile(paths.chromeProfileDir);
  }
}

export async function launchChrome(rootDir, {
  appUrl = 'http://127.0.0.1:48731',
  profileName = 'default',
  extensionPage = '',
  closeInitialPage = false,
  closeOtherPages = false,
  stopExistingProfile = true
} = {}) {
  const paths = syncExtensionToRuntime(rootDir, { profileName });
  const chrome = findChromeExecutable();
  if (stopExistingProfile) stopChromeForProfile(paths.chromeProfileDir);
  const debugPort = await getFreePort();
  const args = [...commonChromeArgs(paths, debugPort), appUrl];

  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();

  const debuggerInfo = await waitForDebugger(debugPort);
  const cdp = await createCdpClient(debuggerInfo.webSocketDebuggerUrl);
  let extensionId = '';
  let extensionPageUrl = '';
  try {
    extensionId = await discoverExtensionId(cdp);
    if (extensionPage) extensionPageUrl = await openExtensionPage(cdp, extensionId, extensionPage);
    if (extensionPageUrl && closeInitialPage) await closeTargetsByUrl(cdp, appUrl);
    if (extensionPageUrl && closeOtherPages) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await closeOtherPageTargets(cdp, extensionPageUrl);
      await new Promise(resolve => setTimeout(resolve, 250));
      await closeOtherPageTargets(cdp, extensionPageUrl);
    }
  } finally {
    cdp.close();
  }

  return {
    chrome,
    args,
    debugPort,
    extensionId,
    extensionPageUrl,
    runtimeExtensionDir: paths.runtimeExtensionDir,
    activeExtensionDir: paths.activeExtensionDir,
    chromeProfileDir: paths.chromeProfileDir,
    profileName: paths.profileName
  };
}

export async function launchChromeAppWindow(rootDir, {
  profileName = 'default',
  extensionPage = 'pages/dashboard.html',
  stopExistingProfile = true
} = {}) {
  const paths = syncExtensionToRuntime(rootDir, { profileName });
  const chrome = findChromeExecutable();
  if (stopExistingProfile) stopChromeForProfile(paths.chromeProfileDir);
  const cleanPage = String(extensionPage || 'pages/dashboard.html').replace(/^\/+/, '');
  let extensionId = readCachedExtensionId(paths);
  if (!extensionId) {
    extensionId = await discoverExtensionIdWithHiddenWindow(rootDir, { profileName });
  }
  if (!extensionId) throw new Error('Extension runtime did not load in the managed app window.');
  writeCachedExtensionId(paths, extensionId);
  let extensionPageUrl = `chrome-extension://${extensionId}/${cleanPage}`;
  const debugPort = await getFreePort();
  const args = [
    ...commonChromeArgs(paths, debugPort),
    `--app=${extensionPageUrl}`
  ];
  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();

  const debuggerInfo = await waitForDebugger(debugPort);
  const cdp = await createCdpClient(debuggerInfo.webSocketDebuggerUrl);
  try {
    const liveExtensionId = await discoverExtensionId(cdp) || extensionId;
    if (liveExtensionId !== extensionId) {
      extensionId = liveExtensionId;
      writeCachedExtensionId(paths, extensionId);
      extensionPageUrl = `chrome-extension://${extensionId}/${cleanPage}`;
    }
    await navigateFirstPageTarget(cdp, extensionPageUrl);
  } finally {
    cdp.close();
  }
  return {
    chrome,
    args,
    debugPort,
    extensionId,
    extensionPageUrl,
    runtimeExtensionDir: paths.runtimeExtensionDir,
    activeExtensionDir: paths.activeExtensionDir,
    chromeProfileDir: paths.chromeProfileDir,
    profileName: paths.profileName,
    appWindow: true
  };
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForDebugger(port) {
  const url = `http://127.0.0.1:${port}/json/version`;
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // Chrome is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Chrome DevTools endpoint did not start on port ${port}. Close existing windows for this shop profile and try again.`);
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();

    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}, sessionId) {
          const msgId = ++id;
          const payload = sessionId ? { id: msgId, method, params, sessionId } : { id: msgId, method, params };
          ws.send(JSON.stringify(payload));
          return new Promise((res, rej) => pending.set(msgId, { res, rej, method }));
        },
        close() {
          ws.close();
        }
      });
    });

    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.rej(new Error(`${item.method}: ${message.error.message}`));
      else item.res(message.result || {});
    });

    ws.addEventListener('error', reject);
  });
}

function normalizeSameSite(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('strict')) return 'Strict';
  if (text.includes('lax')) return 'Lax';
  if (text.includes('none') || text.includes('no_restriction')) return 'None';
  return undefined;
}

function normalizeCdpCookies(cookies) {
  return (cookies || []).map(cookie => {
    const out = {
      name: String(cookie.name),
      value: String(cookie.value),
      domain: cookie.domain || '.tiktok.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: Boolean(cookie.httpOnly)
    };
    const sameSite = normalizeSameSite(cookie.sameSite);
    if (sameSite) out.sameSite = sameSite;
    const expires = Number(cookie.expires || cookie.expirationDate || 0);
    if (Number.isFinite(expires) && expires > 0) {
      out.expires = expires > 10_000_000_000 ? Math.floor(expires / 1000) : expires;
    }
    return out;
  });
}

export async function launchChromeWithCookies(rootDir, {
  appUrl = 'http://127.0.0.1:48731',
  profileName = 'default',
  cookies = [],
  extensionPage = '',
  shopContext = null,
  appWindow = false,
  stopExistingProfile = true
} = {}) {
  const paths = syncExtensionToRuntime(rootDir, { profileName });
  const chrome = findChromeExecutable();
  if (stopExistingProfile) stopChromeForProfile(paths.chromeProfileDir);
  const debugPort = await getFreePort();
  const bootstrapUrl = 'about:blank';
  const startupUrl = appWindow ? appUrl : bootstrapUrl;
  const args = [
    ...commonChromeArgs(paths, debugPort),
    appWindow ? `--app=${startupUrl}` : bootstrapUrl
  ].filter(Boolean);

  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.unref();

  const debuggerInfo = await waitForDebugger(debugPort);
  const cdp = await createCdpClient(debuggerInfo.webSocketDebuggerUrl);
  let cookiesApplied = 0;
  let extensionId = '';
  let extensionPageUrl = '';
  try {
    extensionId = await discoverExtensionId(cdp) || readCachedExtensionId(paths);
    const targets = await cdp.send('Target.getTargets');
    const existingPage = (targets.targetInfos || []).find(info => (
      info.type === 'page' &&
      (info.url === startupUrl || info.url === appUrl || info.url === bootstrapUrl || /^about:blank/.test(info.url || ''))
    )) || (appWindow ? (targets.targetInfos || []).find(info => info.type === 'page') : null);
    const target = existingPage?.targetId
      ? { targetId: existingPage.targetId }
      : await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    if (shopContext && extensionId) {
      await setExtensionLocalStorage(cdp, extensionId, { strangetts_active_shop_context: shopContext });
    }
    await cdp.send('Network.enable', {}, attached.sessionId);
    const cdpCookies = normalizeCdpCookies(cookies);
    if (cdpCookies.length) {
      await cdp.send('Network.setCookies', { cookies: cdpCookies }, attached.sessionId);
      cookiesApplied = cdpCookies.length;
    }
    if (appWindow) {
      await cdp.send('Page.reload', { ignoreCache: true }, attached.sessionId)
        .catch(() => cdp.send('Page.navigate', { url: appUrl }, attached.sessionId));
    } else {
      await cdp.send('Page.navigate', { url: appUrl }, attached.sessionId);
    }
    if (appWindow) {
      await new Promise(resolve => setTimeout(resolve, 700));
      await closeBlankPageTargets(cdp);
      await closeOtherPageTargetsById(cdp, target.targetId);
      await new Promise(resolve => setTimeout(resolve, 250));
      await closeOtherPageTargetsById(cdp, target.targetId);
    }
    if (extensionPage) extensionPageUrl = await openExtensionPage(cdp, extensionId, extensionPage);
  } finally {
    cdp.close();
  }

  return {
    chrome,
    args,
    debugPort,
    extensionId,
    extensionPageUrl,
    cookiesApplied,
    runtimeExtensionDir: paths.runtimeExtensionDir,
    activeExtensionDir: paths.activeExtensionDir,
    chromeProfileDir: paths.chromeProfileDir,
    profileName: paths.profileName
  };
}

export async function fetchShopDataHeadless(rootDir, {
  profileName = 'default',
  shop = {},
  cookies = [],
  fetchOptions = {},
  timeoutMs = 90000,
  stopExistingProfile = true
} = {}) {
  const paths = syncExtensionToRuntime(rootDir, { profileName });
  const chrome = findChromeExecutable();
  if (stopExistingProfile) stopChromeForProfile(paths.chromeProfileDir);

  const debugPort = await getFreePort();
  const args = [
    ...commonChromeArgs(paths, debugPort),
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank'
  ];
  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  const startedAt = Date.now();
  const debuggerInfo = await waitForDebugger(debugPort);
  const cdp = await createCdpClient(debuggerInfo.webSocketDebuggerUrl);
  let cookiesApplied = 0;
  let extensionId = '';
  try {
    extensionId = await discoverExtensionId(cdp) || readCachedExtensionId(paths);
    if (!extensionId) throw new Error('Extension runtime did not load in headless mode.');
    writeCachedExtensionId(paths, extensionId);
    cookiesApplied = Array.isArray(cookies) ? cookies.length : 0;

    let runtimeTarget = await openExtensionRuntimeMessagePage(cdp, extensionId);
    if (!runtimeTarget?.targetId) runtimeTarget = await waitForExtensionRuntimeTarget(cdp, extensionId);
    if (!runtimeTarget?.targetId) {
      throw new Error('Extension runtime target did not start in headless mode.');
    }
    const attached = await cdp.send('Target.attachToTarget', { targetId: runtimeTarget.targetId, flatten: true });
    const timeout = Math.max(15000, Math.min(Number(timeoutMs) || 90000, 180000));
    const request = {
      action: 'fetch_multi_shop',
      shop: { ...shop, cookies },
      fetchOptions
    };
    const expression = `new Promise(resolve => {
      const timer = setTimeout(() => resolve({ status: 'error', error: 'headless_fetch_timeout' }), ${timeout});
      try {
        chrome.runtime.sendMessage(${JSON.stringify(request)}, response => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve({ status: 'error', error: chrome.runtime.lastError.message || 'runtime_message_failed' });
            return;
          }
          resolve(response || { status: 'error', error: 'empty_response' });
        });
      } catch (error) {
        clearTimeout(timer);
        resolve({ status: 'error', error: error?.message || String(error) });
      }
    })`;
    const evaluated = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, attached.sessionId);
    const data = evaluated?.result?.value || { status: 'error', error: 'empty_evaluation' };
    return {
      chrome,
      debugPort,
      extensionId,
      runtimeExtensionDir: paths.runtimeExtensionDir,
      activeExtensionDir: paths.activeExtensionDir,
      chromeProfileDir: paths.chromeProfileDir,
      profileName: paths.profileName,
      cookiesApplied,
      headless: true,
      durationMs: Date.now() - startedAt,
      data
    };
  } finally {
    cdp.close();
    stopChromeForProfile(paths.chromeProfileDir);
  }
}
