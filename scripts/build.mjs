import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function run(name, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status}`);
  }
}

const manifestPath = path.join(rootDir, 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const required of ['manifest_version', 'name', 'version', 'permissions', 'host_permissions']) {
  if (!manifest[required]) throw new Error(`manifest.json missing ${required}`);
}

run('security scan', ['scripts/security-scan.mjs']);
run('parity audit', ['scripts/parity-audit.mjs']);

const distDir = path.join(rootDir, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  path.join(distDir, 'production-build.json'),
  JSON.stringify({
    ok: true,
    builtAt: new Date().toISOString(),
    extensionName: manifest.name,
    extensionVersion: manifest.version,
    serverHost: '127.0.0.1'
  }, null, 2)
);

console.log('Production build checks passed.');
