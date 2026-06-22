import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const files = {
  openDesktop: readFileSync(join(rootDir, 'scripts/open-desktop-app.ps1'), 'utf8'),
  startPs1: readFileSync(join(rootDir, 'scripts/start-pc-app.ps1'), 'utf8'),
  createShortcut: readFileSync(join(rootDir, 'scripts/create-desktop-shortcut.ps1'), 'utf8'),
  startMjs: readFileSync(join(rootDir, 'scripts/start-pc-app.mjs'), 'utf8'),
  packageJson: readFileSync(join(rootDir, 'package.json'), 'utf8'),
  readme: readFileSync(join(rootDir, 'README.md'), 'utf8')
};

assert(files.openDesktop.includes('$Port = 48731'), 'desktop opener should use the expected local app port');
assert(files.openDesktop.includes('$Url = "http://127.0.0.1:$Port"'), 'desktop opener should target localhost only');
assert(files.openDesktop.includes('Invoke-RestMethod -Uri "$Url/api/health"'), 'desktop opener should check app health before launch');
assert(files.openDesktop.includes('-WorkingDirectory $AppDir'), 'desktop opener should start npm from the local app directory');
assert(files.openDesktop.includes('-WindowStyle Hidden'), 'desktop opener should hide the helper console window');
assert(files.openDesktop.includes('/api/app/open-dashboard-app'), 'desktop opener should call the dashboard app-window endpoint');
assert(files.openDesktop.includes('desktop-app-dashboard.json'), 'desktop opener should write launch metadata to local logs');

assert(files.startPs1.includes('Set-Location $AppDir'), 'start wrapper should switch to the app directory');
assert(files.startPs1.includes('"scripts/start-pc-app.mjs"'), 'start wrapper should call the Node launcher');
assert(files.startPs1.includes('"--production"'), 'start wrapper should run production mode by default');
assert(files.startPs1.includes('"--launch"'), 'start wrapper should support launch mode');

assert(files.createShortcut.includes('Strange TTS PC App.lnk'), 'shortcut creator should keep the expected desktop shortcut name');
assert(files.createShortcut.includes('powershell.exe'), 'shortcut should run PowerShell');
assert(files.createShortcut.includes('-ExecutionPolicy Bypass'), 'shortcut should bypass execution policy for local script launch');
assert(files.createShortcut.includes('scripts\\open-desktop-app.ps1'), 'shortcut should target the desktop opener script');
assert(files.createShortcut.includes('$shortcut.WorkingDirectory = $AppDir'), 'shortcut should run from the app directory');

assert(files.startMjs.includes("existing?.app === 'Strange TTS PC App'"), 'Node launcher should detect an existing app instance');
assert(files.startMjs.includes('startServer({ port })'), 'Node launcher should start the local server on the requested port');
assert(files.startMjs.includes('launchChrome(rootDir'), 'Node launcher should launch the managed browser when requested');
assert(files.startMjs.includes('pages/dashboard.html'), 'Node launcher should default to the extension dashboard page');
assert(files.startMjs.includes('EADDRINUSE'), 'Node launcher should report occupied port conflicts');

assert(files.packageJson.includes('"start": "node scripts/start-pc-app.mjs"'), 'npm start should use the Node launcher');
assert(files.packageJson.includes('"desktop": "powershell -ExecutionPolicy Bypass -File scripts/open-desktop-app.ps1"'), 'npm run desktop should use the desktop opener');
assert(files.packageJson.includes('"app": "powershell -ExecutionPolicy Bypass -File scripts/open-desktop-app.ps1"'), 'npm run app should use the desktop opener');
assert(files.packageJson.includes('"pc:start": "node scripts/start-pc-app.mjs --launch"'), 'npm run pc:start should launch the app window');
assert(files.packageJson.includes('"desktop:shortcut": "powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1"'), 'desktop shortcut npm script should target the shortcut creator');
assert(files.packageJson.includes('"desktop:launch-smoke": "node scripts/desktop-launch-smoke.mjs"'), 'desktop launch smoke should remain available as an npm script');

assert(files.readme.includes('Khong mo/chay app tu `\\\\wsl.localhost\\...`'), 'README should warn users not to run production from WSL UNC paths');
assert(files.readme.includes('.\\scripts\\start-pc-app.ps1'), 'README should document the local Windows start script');

const combined = Object.values(files).join('\n');
assert(!combined.includes('speechSynthesis'), 'desktop launch flow should not add Text-To-Speech behavior');
assert(!combined.includes('STTS_LICENSE_ENFORCE=0'), 'desktop launch docs/scripts should not bypass license enforcement');

console.log('Desktop launch smoke passed.');
