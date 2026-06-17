import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const releaseName = 'StrangeTTS-PC-App-Test';
const releaseDir = path.join(distDir, releaseName);

function assertInsideDist(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(distDir))) {
    throw new Error(`Refusing to write outside dist: ${resolved}`);
  }
}

function copyRecursive(src, dst, options = {}) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const rel = entry.name;
      if (options.exclude?.some(pattern => pattern.test(rel))) continue;
      copyRecursive(path.join(src, rel), path.join(dst, rel), options);
    }
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function writeFile(rel, content) {
  const file = path.join(releaseDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
}

assertInsideDist(releaseDir);
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

for (const dir of ['app', 'extension', 'public']) {
  copyRecursive(path.join(rootDir, dir), path.join(releaseDir, dir));
}

copyRecursive(path.join(rootDir, 'node_modules'), path.join(releaseDir, 'node_modules'));

copyRecursive(path.join(rootDir, 'scripts'), path.join(releaseDir, 'scripts'), {
  exclude: [/^license-create\.mjs$/i, /^package-release\.mjs$/i]
});

for (const file of ['README.md', 'package-lock.json']) {
  copyRecursive(path.join(rootDir, file), path.join(releaseDir, file));
}

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
delete packageJson.scripts['license:create'];
fs.writeFileSync(path.join(releaseDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');

const publicKeySrc = path.join(rootDir, 'data', 'private', 'license-public.pem');
if (!fs.existsSync(publicKeySrc)) {
  throw new Error('Missing data/private/license-public.pem. Run `npm run license:create -- --customer Owner --this-machine` once on the seller machine first.');
}
copyRecursive(publicKeySrc, path.join(releaseDir, 'data', 'private', 'license-public.pem'));

writeFile('RUN_ME_FIRST.cmd', `@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm chua duoc cai. Cai Node.js 22 LTS truoc roi chay lai file nay.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "%~dp0node_modules\\xlsx" (
  echo Dang cai thu vien can thiet lan dau...
  npm install --omit=dev
  if errorlevel 1 (
    echo Cai thu vien that bai. Kiem tra mang hoac lien he ben ban.
    pause
    exit /b 1
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\create-desktop-shortcut.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\open-desktop-app.ps1"
pause
`);

writeFile('README-KHACH-HANG.txt', `STRANGE TTS PC APP - BAN TEST

1. Giai nen thu muc nay vao may khach.
2. Chay RUN_ME_FIRST.cmd.
3. App se mo dashboard va hien man hinh kich hoat neu chua co license.
4. Gui Machine ID tren man hinh kich hoat cho ben ban de nhan license key.
5. Dan license key vao o kich hoat va bam Kich hoat.

Luu y:
- Khong doi ten/xoa file trong thu muc app.
- May can co Node.js 22 LTS hoac moi hon.
- License test duoc khoa theo Machine ID neu ben ban phat key theo may.
`);

console.log(JSON.stringify({
  ok: true,
  releaseDir,
  includesPublicKey: true,
  excludesPrivateKey: !fs.existsSync(path.join(releaseDir, 'data', 'private', 'license-private.pem')),
  excludesActiveLicense: !fs.existsSync(path.join(releaseDir, 'data', 'private', 'license.enc.json'))
}, null, 2));
