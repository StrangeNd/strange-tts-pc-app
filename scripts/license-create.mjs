import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeLicenseKey, getMachineFingerprint } from '../app/license.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const privateDir = path.join(rootDir, 'data', 'private');
const privateKeyFile = path.join(privateDir, 'license-private.pem');
const publicKeyFile = path.join(privateDir, 'license-public.pem');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function ensureKeypair() {
  fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(privateKeyFile) && fs.existsSync(publicKeyFile)) {
    return {
      privateKey: fs.readFileSync(privateKeyFile, 'utf8'),
      publicKey: fs.readFileSync(publicKeyFile, 'utf8')
    };
  }

  const pair = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });
  fs.writeFileSync(privateKeyFile, pair.privateKey, { mode: 0o600 });
  fs.writeFileSync(publicKeyFile, pair.publicKey, { mode: 0o600 });
  return pair;
}

const { privateKey } = ensureKeypair();
const now = new Date();
const days = Number(arg('days', '365'));
const expiresAt = new Date(now.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
const machine = arg('machine', flag('this-machine') ? getMachineFingerprint() : '*');

const payload = {
  licenseId: arg('id', crypto.randomUUID()),
  customer: arg('customer', 'Customer'),
  plan: arg('plan', 'standard'),
  machineId: machine,
  expiresAt,
  features: arg('features', 'dashboard,headless,seller-panel')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
};

const key = encodeLicenseKey(payload, privateKey);
console.log(JSON.stringify({
  ok: true,
  key,
  payload,
  publicKeyFile,
  privateKeyFile,
  warning: 'Keep license-private.pem outside customer builds. Ship only license-public.pem with the app.'
}, null, 2));
