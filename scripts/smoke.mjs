import { startServer } from '../app/server.mjs';

const port = process.env.PORT ? Number(process.env.PORT) : 0;
const started = await startServer({ port });

try {
  const health = await fetch(`${started.url}/api/health`).then(res => res.json());
  if (!health.ok || health.host !== '127.0.0.1') {
    throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
  }
  const html = await fetch(`${started.url}/`).then(res => res.text());
  if (!html.includes('Strange TTS PC App')) {
    throw new Error('Static UI did not render index.html.');
  }
  const cssStatus = await fetch(`${started.url}/styles.css`).then(res => res.status);
  const jsStatus = await fetch(`${started.url}/app.js`).then(res => res.status);
  if (cssStatus !== 200 || jsStatus !== 200) {
    throw new Error(`Static assets failed: css=${cssStatus}, js=${jsStatus}`);
  }
  const licenseStatus = await fetch(`${started.url}/api/license/status`).then(res => res.json());
  if (!licenseStatus.ok || !licenseStatus.license) {
    throw new Error(`License status API failed: ${JSON.stringify(licenseStatus)}`);
  }

  const statusResponse = await fetch(`${started.url}/api/status`);
  const status = await statusResponse.json();
  if (!licenseStatus.license.active) {
    if (statusResponse.status !== 402 || status.ok !== false) {
      throw new Error(`Unlicensed app should block protected APIs: ${JSON.stringify(status)}`);
    }
    console.log(`Production smoke passed in unlicensed mode: ${started.url}`);
  } else {
    if (!status.ok || status.admin?.username !== 'admin') {
      throw new Error(`Status API failed in local app mode: ${JSON.stringify(status)}`);
    }
    if (!status.dataSecurity?.cookieEncryption?.enabled) {
      throw new Error(`Cookie encryption is not enabled in status API: ${JSON.stringify(status.dataSecurity)}`);
    }
    const shops = await fetch(`${started.url}/api/shops`).then(res => res.json());
    if (!shops.ok || !Array.isArray(shops.library?.shops)) {
      throw new Error(`Shops API failed: ${JSON.stringify(shops)}`);
    }
    if (shops.library.shops.some(shop => shop.cookieFile || shop.cookies)) {
      throw new Error(`Shops API exposed cookie internals: ${JSON.stringify(shops.library.shops)}`);
    }
    const extensions = await fetch(`${started.url}/api/extensions`).then(res => res.json());
    if (!extensions.ok || !extensions.library?.active) {
      throw new Error(`Bundled extension is not active: ${JSON.stringify(extensions)}`);
    }
    console.log(`Production smoke passed in licensed mode: ${started.url}`);
  }
} finally {
  await new Promise(resolve => started.server.close(resolve));
}
