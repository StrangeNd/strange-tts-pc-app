import { startServer } from '../app/server.mjs';
import { launchChrome } from '../app/chrome-launcher.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const portArg = process.argv.find(arg => arg.startsWith('--port='));
const extensionPageArg = process.argv.find(arg => arg.startsWith('--extension-page='));
const port = portArg ? Number(portArg.split('=')[1]) : Number(process.env.PORT || 48731);
const url = `http://127.0.0.1:${port}`;

async function readExistingHealth(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${targetUrl}/api/health`, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function printAdminHint() {
  console.log('[Strange TTS PC App] Admin login file: data/private/INITIAL_ADMIN_PASSWORD.txt');
}

async function launchIfRequested(targetUrl) {
  if (!args.has('--launch')) return;
  const requestedPage = extensionPageArg ? extensionPageArg.split('=').slice(1).join('=') : '';
  const extensionPage = requestedPage || (args.has('--popup') ? 'pages/login.html' : 'pages/dashboard.html');
  const launch = await launchChrome(rootDir, {
    appUrl: targetUrl,
    extensionPage,
    closeInitialPage: Boolean(extensionPage),
    closeOtherPages: Boolean(extensionPage)
  });
  console.log(`[Strange TTS PC App] Chrome launched with extension runtime: ${launch.runtimeExtensionDir}`);
  if (launch.extensionId) console.log(`[Strange TTS PC App] Extension visible page: chrome-extension://${launch.extensionId}/${extensionPage}`);
}

const existing = await readExistingHealth(url);
if (existing?.app === 'Strange TTS PC App') {
  console.log(`[Strange TTS PC App] Already running: ${url}`);
  console.log(`[Strange TTS PC App] Extension version: ${existing.version}`);
  printAdminHint();
  await launchIfRequested(url);
  process.exit(0);
}

try {
  const started = await startServer({ port });
  console.log(`[Strange TTS PC App] Production server: ${started.url}`);
  printAdminHint();
  await launchIfRequested(started.url);

  process.on('SIGINT', () => started.server.close(() => process.exit(0)));
  process.on('SIGTERM', () => started.server.close(() => process.exit(0)));
} catch (error) {
  if (error?.code === 'EADDRINUSE') {
    console.error(`[Strange TTS PC App] Port ${port} is already in use by another process.`);
    console.error(`[Strange TTS PC App] Check it: powershell "Get-NetTCPConnection -LocalPort ${port} -State Listen"`);
    console.error('[Strange TTS PC App] Or stop this app with: npm run stop');
    process.exit(1);
  }
  throw error;
}
