import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const server = readFileSync(join(rootDir, 'app/server.mjs'), 'utf8');
const app = readFileSync(join(rootDir, 'public/app.js'), 'utf8');
const crawlerRoute = server.slice(server.indexOf("/api/tiktokshop-crawler/crawl"), server.indexOf("/api/business/rules"));
assert(crawlerRoute.includes('/api/tiktokshop-crawler/crawl'), 'crawler route should be present');
assert(server.includes('async function prepareCrawlerBrowser'), 'server should prepare a crawler browser/profile before real crawls');
assert(server.includes('launchChromeWithCookies(rootDir'), 'crawler auto-open should use the existing managed profile/cookie launcher');
assert(server.includes('const autoOpenProfile ='), 'server should support explicit autoOpenProfile control');
assert(server.includes('cdpPort: launch.debugPort'), 'server should use the launch debugPort for crawler CDP');
assert(server.includes('baseUrl: targetUrl'), 'Seller Center crawler should navigate the resolved safe target URL');
assert(server.includes('cookiesApplied: launch?.cookiesApplied || 0'), 'audit should record only cookie count metadata');
assert(!crawlerRoute.includes('launch: launch,') && !crawlerRoute.includes('launch: launch }'), 'API response should not return the full launch object');
assert(!crawlerRoute.includes('cookies: launch') && !crawlerRoute.includes('cookies: cookies'), 'crawler response should not expose raw cookies');
assert(!crawlerRoute.includes('appendAudit(rootDir, \'tiktokshop_crawler.crawl_start\', { cookies'), 'crawler audit should not log raw cookies');
assert(server.includes('/api/tiktokshop-crawler/profile/open'), 'target capture should split explicit profile open/attach from crawl');
assert(server.includes('/api/tiktokshop-crawler/profile/verify'), 'target capture should expose a safe verify session endpoint');
assert(server.includes('targetedOverviewCapture'), 'target capture should use an explicit gated crawl flag');
assert(server.includes('TARGET_CAPTURE_LOGIN_ACTION'), 'blocked target capture should return a safe nextAction');

assert(app.includes('name="autoOpenProfile" checked'), 'crawler UI should default to auto-opening the selected profile');
assert(app.includes("autoOpenProfile: form.get('autoOpenProfile') === 'on'"), 'crawler request should send autoOpenProfile');
assert(app.includes("cdpPort: Number(form.get('cdpPort') || 0)"), 'manual CDP port should be optional when auto-open is enabled');
assert(app.includes('Open/Attach seller profile'), 'UI should show explicit profile open/attach action');
assert(app.includes('Refresh/Verify session'), 'UI should show explicit session verify action');
assert(app.includes('Target overview capture'), 'UI should show target overview capture action');
assert(app.includes('Chưa xác thực session'), 'UI should show unverified session copy');
assert(app.includes('Không mở browser mới khi session chưa sẵn sàng'), 'UI should warn that target capture does not open a new browser');
assert(app.includes('Target overview capture chỉ chạy sau khi session/profile đã sẵn sàng'), 'UI should block target capture until readiness is verified');

console.log('TikTok crawler auto-profile smoke passed.');
