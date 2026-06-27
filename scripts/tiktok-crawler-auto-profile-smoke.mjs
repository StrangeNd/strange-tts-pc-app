import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { finalizeCdpUnavailableJobForStatus, finalizeNoProgressJobForStatus } from '../app/server.mjs';

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

assert(server.includes('finalizeActiveJobOnCdpDrop'), 'server should finalize active jobs when CDP drops');
assert(server.includes('writeSellerCenterRunStatusMarker'), 'server should create a safe Seller Center run marker before capture work');
assert(server.includes('finalizeActiveJobOnNoProgress'), 'server should finalize timed-out no-progress target capture jobs');
assert(server.includes('NO_PROGRESS_NEXT_ACTION'), 'server should expose safe no-progress retry copy');
assert(server.includes('outputDirMissing'), 'server should expose outputDirMissing metadata');
assert(server.includes('TARGET_CAPTURE_FAILED'), 'server should expose target capture failure classification');

const finalized = finalizeCdpUnavailableJobForStatus({
  job: {
    id: 'smoke-run-001',
    mode: 'seller-center',
    status: 'running',
    shopId: 'smoke-shop',
    sellerId: 'smoke-seller',
    startedAt: '2026-06-27T00:00:00.000Z'
  },
  shopId: 'smoke-shop',
  sellerId: 'smoke-seller',
  artifactExists: false,
  finishedAt: '2026-06-27T00:01:00.000Z'
});
assert.equal(finalized.status, 'partial', 'CDP drop finalizer should mark running job partial');
assert.equal(finalized.readiness, 'partial', 'CDP drop finalizer should mark readiness partial');
assert.equal(finalized.activeJob, false, 'CDP drop finalizer should clear activeJob');
assert.equal(finalized.failureReason, 'cdp_unavailable', 'CDP drop finalizer should expose cdp_unavailable failure');
assert.equal(finalized.partialReason, 'cdp_unavailable', 'CDP drop finalizer should expose cdp_unavailable partial reason');
assert.equal(finalized.retryable, true, 'CDP drop finalizer should remain retryable');
assert.equal(finalized.outputDirMissing, true, 'missing artifact should set outputDirMissing');
assert.equal(finalized.targetInventory.classification, 'TARGET_CAPTURE_FAILED', 'missing artifact should expose failed target inventory classification');
assert.equal(finalized.targetInventory.reason, 'cdp_unavailable_before_artifact', 'missing artifact should expose safe target inventory reason');
assert.deepEqual(finalized.targetInventory.counts, { endpoint: 0, raw: 0, normalized: 0, export: 0 }, 'missing artifact counts should be zero');

const timedOut = finalizeNoProgressJobForStatus({
  job: {
    id: 'smoke-run-002',
    runId: 'smoke-run-002',
    mode: 'seller-center',
    target: 'overview',
    status: 'running',
    shopId: 'smoke-shop',
    sellerId: 'smoke-seller',
    startedAt: '2026-06-27T00:00:00.000Z',
    cdpPort: 9222,
    summary: { apiEndpoints: 0, rawFiles: 0, normalizedRows: 0, exportRequests: 0 }
  },
  shopId: 'smoke-shop',
  sellerId: 'smoke-seller',
  outputDirMissing: true,
  finishedAt: '2026-06-27T00:11:00.000Z'
});
assert.equal(timedOut.status, 'partial', 'no-progress finalizer should mark status partial');
assert.equal(timedOut.readiness, 'partial', 'no-progress finalizer should mark readiness partial');
assert.equal(timedOut.activeJob, false, 'no-progress finalizer should clear activeJob');
assert.equal(timedOut.failureReason, 'no_progress_timeout', 'no-progress finalizer should expose no_progress_timeout failure');
assert.equal(timedOut.partialReason, 'no_progress_timeout', 'no-progress finalizer should expose no_progress_timeout partial reason');
assert.equal(timedOut.retryable, true, 'no-progress timeout should be retryable');
assert.equal(timedOut.outputDirMissing, true, 'missing expected run folder should set outputDirMissing');
assert.equal(timedOut.targetInventory.classification, 'TARGET_CAPTURE_FAILED', 'no-progress finalizer should classify target capture failure');
assert.equal(timedOut.targetInventory.reason, 'no_progress_before_artifact', 'no-progress finalizer should expose before-artifact reason');
assert.deepEqual(timedOut.targetInventory.counts, { endpoint: 0, raw: 0, normalized: 0, export: 0 }, 'no-progress missing folder counts should be zero');

const withFiles = finalizeNoProgressJobForStatus({
  job: {
    id: 'smoke-run-003',
    runId: 'smoke-run-003',
    mode: 'seller-center',
    target: 'overview',
    status: 'running',
    shopId: 'smoke-shop',
    sellerId: 'smoke-seller',
    startedAt: '2026-06-27T00:00:00.000Z'
  },
  shopId: 'smoke-shop',
  sellerId: 'smoke-seller',
  outputDirMissing: false,
  summary: { apiEndpoints: 1, rawFiles: 1, normalizedRows: 1, exportRequests: 0 },
  finishedAt: '2026-06-27T00:11:00.000Z'
});
assert.equal(withFiles.outputDirMissing, false, 'existing expected run folder should keep outputDirMissing false');
assert.deepEqual(withFiles.summary, { apiEndpoints: 1, rawFiles: 1, normalizedRows: 1, exportRequests: 0 }, 'existing artifact counts should be preserved');

console.log('TikTok crawler auto-profile smoke passed.');
