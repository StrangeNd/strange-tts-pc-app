import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const indexHtml = readFileSync(join(rootDir, 'public/index.html'), 'utf8');
const appJs = readFileSync(join(rootDir, 'public/app.js'), 'utf8');

assert(indexHtml.includes('id="btnAiData"'), 'AI Data button ID should remain for existing binding');
assert(indexHtml.includes('External AI Data'), 'AI Data shell label should be explicitly external');
assert(!indexHtml.includes('STRANGE TTS AI DATA'), 'Public shell should not present AI Data as a native STRANGE TTS feature');

const requiredWorkspaceCopy = [
  '<h2>External AI Data</h2>',
  'External link only. Out of scope for local TikTok Shop metrics, crawler data, and business analysis.',
  'External AI Data URL',
  'Mo external link',
  "window.open(url, '_blank', 'noopener,noreferrer')"
];

for (const copy of requiredWorkspaceCopy) {
  assert(appJs.includes(copy), `AI Data workspace should preserve external-link copy/behavior: ${copy}`);
}

const forbiddenRuntimeMarkers = [
  'runAiDataCrawler',
  'aiDataCrawler',
  'aiDataMetrics',
  'aiDataBusinessAnalysis',
  'nativeAiData',
  'speechSynthesis'
];

for (const marker of forbiddenRuntimeMarkers) {
  assert(!appJs.includes(marker), `AI Data should not add native crawler/metrics/audio behavior: ${marker}`);
}

console.log('AI Data external scope smoke passed.');
