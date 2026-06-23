import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(rootDir, 'README.md'), 'utf8');
const guide = readFileSync(join(rootDir, 'docs', 'PC_APP_USER_GUIDE.md'), 'utf8');
const combined = `${readme}\n${guide}`;

function assertLegacyRuntimeLabelContext(text, label) {
  const runtimeLabel = 'Strange TTS PC App';
  let index = text.indexOf(runtimeLabel);
  assert.notEqual(index, -1, `${label} should mention the legacy runtime shortcut label`);
  while (index !== -1) {
    const context = text.slice(Math.max(0, index - 220), Math.min(text.length, index + runtimeLabel.length + 260));
    assert.match(context, /legacy/i, `${label} should frame "${runtimeLabel}" as a legacy runtime/shortcut label`);
    assert.match(context, /TikTok Shop/i, `${label} should keep "${runtimeLabel}" tied to TikTok Shop operations`);
    index = text.indexOf(runtimeLabel, index + runtimeLabel.length);
  }
}


assert.match(readme, /^# Strange TikTok Shop PC App/m, 'README title should name TikTok Shop, not generic TTS');
assert(readme.includes('`TTS`'), 'README should explain the legacy TTS acronym');
assert(readme.includes('TikTok Shop'), 'README should define the product domain as TikTok Shop');
assert(readme.includes('khong phai Text-To-Speech'), 'README should explicitly reject Text-To-Speech meaning');
assert(readme.includes('Khong mo/chay app tu `\\\\wsl.localhost\\...`'), 'README should warn against production runtime from WSL UNC paths');
assert(readme.includes('folder Windows local'), 'README should direct production usage to a Windows local folder');
assert(readme.includes('.\\scripts\\start-pc-app.ps1'), 'README should keep the Windows start script path');
assert(readme.includes('http://127.0.0.1:48731'), 'README should label localhost as internal/debug API');
assert(readme.includes('data/shops/<shopId>/cookies.enc.json'), 'README should document encrypted local cookie storage');
assert(readme.includes('data/private/app-secret.key'), 'README should keep local secret storage guidance');

const forbiddenRuntimeClaims = [
  'speechSynthesis',
  'SpeechSynthesisUtterance',
  'voice selector',
  'audio preview workspace',
  'generated audio workflow'
];
for (const phrase of forbiddenRuntimeClaims) {
  assert(!combined.includes(phrase), `Docs should not advertise Text-To-Speech runtime behavior: ${phrase}`);
}

assert(guide.includes('Text-To-Speech'), 'User guide should preserve the explicit non-goal wording');
assert(guide.includes('Khong mo app tu `\\\\wsl.localhost\\...`'), 'User guide should warn non-technical users away from WSL UNC runtime');

assertLegacyRuntimeLabelContext(readme, 'README');
assertLegacyRuntimeLabelContext(guide, 'User guide');

console.log('README runtime domain smoke passed.');
