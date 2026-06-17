import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appExtensionDir = path.join(rootDir, 'extension');
const originalExtensionDir = process.env.ORIGINAL_EXTENSION_PATH
  || 'C:\\Users\\Stephen Strange\\Downloads\\Telegram Desktop\\Strange_TTS_Solution (2)\\Strange_TTS_Solution';

const allowedChangedFiles = new Set([
  'manifest.json',
  'pages/dashboard.html',
  'pages/login.html',
  'src/background.js',
  'src/content.js',
  'src/dashboard.js',
  'src/login.js',
  'src/report.js',
  'styles/strangetts-theme.css'
]);

function walk(dir, files = new Map(), base = dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files, base);
    else {
      const rel = path.relative(base, full).replaceAll('\\', '/');
      files.set(rel, hashFile(full));
    }
  }
  return files;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(originalExtensionDir)) {
  console.error(`Original extension path not found: ${originalExtensionDir}`);
  process.exit(1);
}

const original = walk(originalExtensionDir);
const current = walk(appExtensionDir);
const changed = [];
const unexpectedChanged = [];
const missing = [];
const added = [];

for (const [rel, originalHash] of original.entries()) {
  if (!current.has(rel)) {
    missing.push(rel);
    continue;
  }
  if (current.get(rel) !== originalHash) {
    changed.push(rel);
    if (!allowedChangedFiles.has(rel)) unexpectedChanged.push(rel);
  }
}

for (const rel of current.keys()) {
  if (!original.has(rel)) added.push(rel);
}

const report = {
  originalExtensionDir,
  appExtensionDir,
  originalFileCount: original.size,
  appFileCount: current.size,
  changed,
  allowedChangedFiles: [...allowedChangedFiles],
  unexpectedChanged,
  missing,
  added,
  auditedAt: new Date().toISOString()
};

fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(rootDir, 'dist', 'extension-parity-audit.json'), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
if (unexpectedChanged.length || missing.length || added.length) process.exit(1);
