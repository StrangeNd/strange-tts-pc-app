import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ALGO = 'aes-256-gcm';
const KEY_FILE = 'app-secret.key';
const VERSION = 1;

function privateRoot(rootDir) {
  return path.join(rootDir, 'data', 'private');
}

function keyPath(rootDir) {
  return path.join(privateRoot(rootDir), KEY_FILE);
}

function ensureKey(rootDir) {
  fs.mkdirSync(privateRoot(rootDir), { recursive: true, mode: 0o700 });
  const file = keyPath(rootDir);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString('base64url'), { mode: 0o600 });
  }
  const key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64url');
  if (key.length !== 32) {
    throw new Error('Invalid local encryption key length.');
  }
  return key;
}

export function encryptionStatus(rootDir) {
  return {
    enabled: true,
    algorithm: ALGO,
    keyFile: keyPath(rootDir)
  };
}

export function encryptJsonToFile(rootDir, file, value) {
  const key = ensureKey(rootDir);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from('strange-tts-pc-app-cookie-store'));
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const payload = {
    version: VERSION,
    algorithm: ALGO,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url')
  };
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

export function decryptJsonFromFile(rootDir, file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (payload.version !== VERSION || payload.algorithm !== ALGO) {
    throw new Error('Unsupported encrypted data format.');
  }
  const decipher = crypto.createDecipheriv(ALGO, ensureKey(rootDir), Buffer.from(payload.iv, 'base64url'));
  decipher.setAAD(Buffer.from('strange-tts-pc-app-cookie-store'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64url')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}
