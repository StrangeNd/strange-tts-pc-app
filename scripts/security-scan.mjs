import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'data', 'chrome-profile', 'extension-runtime']);
const checks = [
  { name: 'Telegram bot token', regex: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g },
  { name: 'Google/Gemini API key', regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { name: 'Apps Script deployment URL', regex: /https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec/g },
  { name: 'Known legacy auth secret', regex: new RegExp(['strangetts', 'agency', 'secure', '2024', 'v11'].join('_'), 'g') },
  { name: 'Known leaked Telegram token fragment', regex: new RegExp(['AAFw-t5', 'x86yxbS4'].join('') + '|' + ['AAEbbR2', 'b7439'].join(''), 'g') }
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const findings = [];
for (const file of walk(rootDir)) {
  const rel = path.relative(rootDir, file).replaceAll('\\', '/');
  if (!/\.(js|mjs|json|html|css|md|ps1|txt)$/i.test(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const check of checks) {
    for (let i = 0; i < lines.length; i += 1) {
      check.regex.lastIndex = 0;
      if (check.regex.test(lines[i])) {
        findings.push({ file: rel, line: i + 1, type: check.name });
      }
    }
  }
}

const legacyCookieFiles = [];
const shopsDir = path.join(rootDir, 'data', 'shops');
if (fs.existsSync(shopsDir)) {
  const stack = [shopsDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === 'cookies.json') legacyCookieFiles.push(path.relative(rootDir, full).replaceAll('\\', '/'));
    }
  }
}
if (legacyCookieFiles.length) {
  console.error('Security scan failed. Legacy raw cookie files found; run `npm run data:migrate` first:');
  for (const file of legacyCookieFiles) console.error(`- ${file}`);
  process.exit(1);
}

if (findings.length) {
  console.error('Security scan failed. Hardcoded secret-like values found:');
  for (const finding of findings) {
    console.error(`- ${finding.type}: ${finding.file}:${finding.line}`);
  }
  process.exit(1);
}

console.log('Security scan passed: no known hardcoded production secrets found.');
