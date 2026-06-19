import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(rootDir, 'public');

const html = await readFile(join(publicDir, 'index.html'), 'utf8');
const appJs = await readFile(join(publicDir, 'app.js'), 'utf8');

const shellIds = [
  'healthPill',
  'appPanel',
  'shopQuickSelect',
  'btnAppDashboard',
  'btnSellerAds',
  'btnCloudSync',
  'btnAiData',
  'btnBusinessAnalysis',
  'btnTikTokCrawler',
  'btnOpsChecklist',
  'btnBusinessPlan',
  'btnGuide',
  'btnDownloadVideo',
  'btnProductToggle',
  'btnVideoSettings',
  'btnRuntimeStatus',
  'workspacePanel',
  'workspaceContent',
  'statusPanel',
  'shopList',
  'statusList',
  'outputBox'
];

const appJsReferencedShellIds = shellIds.filter(id => id !== 'workspacePanel');

const expectedBoundButtons = [
  'btnAppDashboard',
  'btnSellerAds',
  'btnCloudSync',
  'btnAiData',
  'btnBusinessAnalysis',
  'btnTikTokCrawler',
  'btnOpsChecklist',
  'btnBusinessPlan',
  'btnGuide',
  'btnDownloadVideo',
  'btnProductToggle',
  'btnVideoSettings',
  'btnRuntimeStatus'
];

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const missingShellIds = shellIds.filter(id => !htmlIds.has(id));
if (missingShellIds.length) {
  throw new Error(`public/index.html is missing shell IDs: ${missingShellIds.join(', ')}`);
}

const missingSelectors = appJsReferencedShellIds
  .filter(id => !appJs.includes(`'#${id}'`) && !appJs.includes(`"#${id}"`));
if (missingSelectors.length) {
  throw new Error(`public/app.js does not reference shell IDs: ${missingSelectors.join(', ')}`);
}

const missingBoundButtons = expectedBoundButtons
  .filter(id => !appJs.includes(`bindClick('#${id}'`) && !appJs.includes(`bindClick("#${id}"`));
if (missingBoundButtons.length) {
  throw new Error(`public/app.js is missing click bindings for: ${missingBoundButtons.join(', ')}`);
}

const buttonIds = [...html.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)]
  .map(match => ({
    id: match[1],
    text: match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }));
const emptyButtons = buttonIds.filter(button => !button.text);
if (emptyButtons.length) {
  throw new Error(`Shell buttons need visible labels: ${emptyButtons.map(button => button.id).join(', ')}`);
}

const hasReplacementCharacter = [
  ['public/index.html', html],
  ['public/app.js', appJs]
].filter(([, content]) => content.includes('\uFFFD'));
if (hasReplacementCharacter.length) {
  throw new Error(`Replacement character found in: ${hasReplacementCharacter.map(([name]) => name).join(', ')}`);
}

if (!html.includes('<script src="/app.js') || !html.includes('<link rel="stylesheet" href="/styles.css')) {
  throw new Error('Shell must load /app.js and /styles.css assets.');
}

console.log(`UI shell smoke passed: ${shellIds.length} shell IDs, ${expectedBoundButtons.length} click bindings.`);
