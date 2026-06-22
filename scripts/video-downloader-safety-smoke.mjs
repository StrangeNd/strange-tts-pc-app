import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const appJs = await readFile(join(rootDir, 'public', 'app.js'), 'utf8');
const videoDownloadJs = await readFile(join(rootDir, 'app', 'video-download.mjs'), 'utf8');
const serverJs = await readFile(join(rootDir, 'app', 'server.mjs'), 'utf8');

assert(appJs.includes('function renderDownloadWorkspace'), 'Video downloader workspace should exist');
assert(appJs.includes('operator-provided URL only'), 'Downloader should describe operator-provided URL scope');
assert(appJs.includes('operatorCanView'), 'Downloader should require operator authorization confirmation');
assert(appJs.includes('downloadProfileCheck'), 'Downloader should offer profile check action');
assert(appJs.includes('renderShopSessionSafety(selectedShop.id)'), 'Downloader profile check should reuse session safety flow');
assert(appJs.includes('Khong dung de bypass DRM'), 'Downloader should warn against DRM/access-control bypass');
assert(appJs.includes('shop/profile dang chon co quyen xem video'), 'Downloader should show selected profile authorization copy');
assert(appJs.includes('operatorCanView: true'), 'Downloader client should send explicit operator authorization confirmation');
assert(appJs.includes("profileId: selectedShop.id || 'default-profile'"), 'Downloader client should send selected profile metadata');
assert(!appJs.includes('speechSynthesis'), 'Downloader safety must not add Text-To-Speech behavior');

assert(serverJs.includes("url.pathname === '/api/video/download'"), 'Server should expose video download endpoint');
assert(serverJs.includes('body.operatorCanView !== true'), 'Server should reject direct video download calls without operator confirmation');
assert(serverJs.includes("appendAudit(rootDir, 'video.download_start'"), 'Server should audit metadata-only video download start');
assert(serverJs.includes("appendAudit(rootDir, 'video.download_done'"), 'Server should audit metadata-only video download completion');

assert(!videoDownloadJs.includes('cookie'), 'Downloader engine should not add cookie handling in this slice');
assert(!videoDownloadJs.includes('token'), 'Downloader engine should not add token handling in this slice');
assert(!serverJs.includes('video.download_start\', { cookie'), 'Video audit should not include cookies');
assert(!serverJs.includes('video.download_start\', { token'), 'Video audit should not include tokens');

console.log('Video downloader safety smoke passed.');
