import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const guideHtml = readFileSync(join(rootDir, 'extension/pages/guide.html'), 'utf8');

const requiredCopy = [
  'Cloud Sync trong PC app Phase 0',
  'Cloud Sync Phase 0 của PC app chỉ dùng cho sao lưu local',
  'Không upload cookie export, session, token',
  'Cloud Sync thật cần một PR riêng',
  'Dùng Cloud Sync local backup trong PC app'
];

for (const copy of requiredCopy) {
  assert(
    guideHtml.includes(copy),
    `Extension guide should include Phase 0 local-only copy: ${copy}`
  );
}

const forbiddenCopy = [
  /Cloud Sync dùng để lưu danh sách shop, cookie export/i,
  /dùng để lưu[^<]{0,160}cookie export[^<]{0,160}lên server/i,
  /Upload[^<]{0,80}cookie shop[^<]{0,80}cloud/i,
  /Thiết lập Cloud Sync URL/i,
  /Dùng Upload Cloud nếu muốn sao lưu/i,
  /Kiểm tra lại Cloud Sync URL/i,
  /<code>Lên Cloud<\/code>\s*và\s*<code>Về<\/code>/i
];

for (const pattern of forbiddenCopy) {
  assert(
    !pattern.test(guideHtml),
    `Extension guide should not advertise legacy remote Cloud Sync copy: ${pattern}`
  );
}

console.log('Extension guide Cloud Sync copy smoke passed.');
