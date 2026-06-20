import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const html = await readFile(join(rootDir, 'public', 'index.html'), 'utf8');
const appJs = await readFile(join(rootDir, 'public', 'app.js'), 'utf8');

assert(html.includes('id="btnGmvMaxDashboard"'), 'GMV Max menu button should exist');
assert(appJs.includes("bindClick('#btnGmvMaxDashboard', renderGmvMaxDashboardWorkspace)"), 'GMV Max menu button should be bound');
assert(appJs.includes('function renderGmvMaxDashboardWorkspace'), 'GMV Max workspace renderer should exist');
assert(appJs.includes('function gmvMaxEntryUrl'), 'GMV Max entry URL builder should exist');
assert(appJs.includes('data-gmv-profile-check'), 'GMV Max cards should link to profile check');
assert(appJs.includes('data-gmv-open-extension'), 'GMV Max cards should open existing extension dashboard flow');
assert(appJs.includes('Confirm before opening'), 'GMV Max cards should require profile confirmation before opening');
assert(appJs.includes('Loaded shops'), 'GMV Max workspace should show loaded shop count');
assert(appJs.includes('Ready with Seller + Ads IDs'), 'GMV Max workspace should show metadata readiness');
assert(appJs.includes('No shops loaded yet'), 'GMV Max workspace should have an empty state');
assert(!appJs.includes('speechSynthesis'), 'GMV Max dashboard must not add Text-To-Speech behavior');

console.log('GMV Max dashboard smoke passed.');
