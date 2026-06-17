import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decryptJsonFromFile, encryptJsonToFile } from './crypto-store.mjs';

const LICENSE_VERSION = 1;
const LICENSE_PREFIX = 'STTS1';
const PRODUCT_ID = 'strange-tts-pc-app';

function privateRoot(rootDir) {
  return path.join(rootDir, 'data', 'private');
}

function licenseFile(rootDir) {
  return path.join(privateRoot(rootDir), 'license.enc.json');
}

function publicKeyPath(rootDir) {
  return path.join(privateRoot(rootDir), 'license-public.pem');
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseBase64urlJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

export function getMachineFingerprint() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.userInfo().username,
    process.env.COMPUTERNAME || '',
    process.env.USERDOMAIN || ''
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function getLicensePublicKey(rootDir) {
  const envKey = String(process.env.STTS_LICENSE_PUBLIC_KEY || '').trim();
  if (envKey) return envKey.replace(/\\n/g, '\n');
  const file = publicKeyPath(rootDir);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  return '';
}

export function encodeLicenseKey(payload, privateKeyPem) {
  const normalized = {
    version: LICENSE_VERSION,
    product: PRODUCT_ID,
    issuedAt: new Date().toISOString(),
    ...payload
  };
  const payloadPart = base64urlJson(normalized);
  const signature = crypto.sign(null, Buffer.from(payloadPart), privateKeyPem).toString('base64url');
  return `${LICENSE_PREFIX}-${payloadPart}.${signature}`;
}

export function verifyLicenseKey(rootDir, key) {
  const rawKey = String(key || '').trim();
  if (!rawKey) return { ok: false, error: 'Missing license key.' };
  if (!rawKey.startsWith(`${LICENSE_PREFIX}-`) || !rawKey.includes('.')) {
    return { ok: false, error: 'Invalid license key format.' };
  }

  const publicKey = getLicensePublicKey(rootDir);
  if (!publicKey) {
    return { ok: false, error: 'License public key is not configured.' };
  }

  const [payloadPart, signaturePart] = rawKey.slice(`${LICENSE_PREFIX}-`.length).split('.');
  let payload;
  try {
    payload = parseBase64urlJson(payloadPart);
  } catch {
    return { ok: false, error: 'License payload is unreadable.' };
  }

  const signatureOk = crypto.verify(
    null,
    Buffer.from(payloadPart),
    publicKey,
    Buffer.from(signaturePart || '', 'base64url')
  );
  if (!signatureOk) return { ok: false, error: 'License signature is invalid.' };
  if (payload.version !== LICENSE_VERSION) return { ok: false, error: 'Unsupported license version.' };
  if (payload.product !== PRODUCT_ID) return { ok: false, error: 'License is not for this product.' };

  const now = Date.now();
  if (payload.notBefore && Date.parse(payload.notBefore) > now) {
    return { ok: false, error: 'License is not active yet.' };
  }
  if (payload.expiresAt && Date.parse(payload.expiresAt) <= now) {
    return { ok: false, error: 'License has expired.' };
  }

  const machineId = getMachineFingerprint();
  if (payload.machineId && payload.machineId !== '*' && payload.machineId !== machineId) {
    return { ok: false, error: 'License is for another device.', payload, machineId };
  }

  return { ok: true, payload, machineId };
}

function readStoredLicense(rootDir) {
  const file = licenseFile(rootDir);
  if (!fs.existsSync(file)) return null;
  try {
    return decryptJsonFromFile(rootDir, file);
  } catch {
    return null;
  }
}

export function getLicenseStatus(rootDir) {
  const machineId = getMachineFingerprint();
  const stored = readStoredLicense(rootDir);
  if (!stored?.key) {
    return {
      ok: true,
      active: false,
      machineId,
      error: 'Chua kich hoat license.'
    };
  }

  const verified = verifyLicenseKey(rootDir, stored.key);
  if (!verified.ok) {
    return {
      ok: true,
      active: false,
      machineId,
      error: verified.error,
      activatedAt: stored.activatedAt || ''
    };
  }

  if (stored.machineId && stored.machineId !== machineId) {
    return {
      ok: true,
      active: false,
      machineId,
      error: 'License local binding does not match this device.'
    };
  }

  return {
    ok: true,
    active: true,
    machineId,
    activatedAt: stored.activatedAt || '',
    customer: verified.payload.customer || '',
    plan: verified.payload.plan || 'standard',
    expiresAt: verified.payload.expiresAt || '',
    features: verified.payload.features || [],
    licenseId: verified.payload.licenseId || ''
  };
}

export function activateLicense(rootDir, key) {
  const verified = verifyLicenseKey(rootDir, key);
  if (!verified.ok) return { ok: false, active: false, error: verified.error, machineId: verified.machineId || getMachineFingerprint() };

  const record = {
    key: String(key || '').trim(),
    machineId: verified.machineId,
    activatedAt: new Date().toISOString(),
    licenseId: verified.payload.licenseId || '',
    customer: verified.payload.customer || '',
    plan: verified.payload.plan || 'standard'
  };
  encryptJsonToFile(rootDir, licenseFile(rootDir), record);
  return { ok: true, active: true, status: getLicenseStatus(rootDir) };
}

export function deactivateLicense(rootDir) {
  const file = licenseFile(rootDir);
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  return { ok: true, active: false, machineId: getMachineFingerprint() };
}

export function getLicenseMetadata(rootDir) {
  return {
    product: PRODUCT_ID,
    machineId: getMachineFingerprint(),
    publicKeyConfigured: Boolean(getLicensePublicKey(rootDir)),
    publicKeyPath: publicKeyPath(rootDir),
    licenseFile: licenseFile(rootDir)
  };
}
