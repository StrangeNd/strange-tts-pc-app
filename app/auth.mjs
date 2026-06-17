import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashPassword(password, salt = randomToken(24)) {
  const hash = crypto.scryptSync(password, salt, KEYLEN, SCRYPT_OPTS).toString('base64url');
  return { salt, hash, algo: 'scrypt:N16384:r8:p1' };
}

export function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const expected = Buffer.from(record.hash, 'base64url');
  const actual = crypto.scryptSync(password, record.salt, expected.length, SCRYPT_OPTS);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function ensureAdmin(privateDir) {
  fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const adminFile = path.join(privateDir, 'admin.json');
  if (fs.existsSync(adminFile)) {
    return JSON.parse(fs.readFileSync(adminFile, 'utf8'));
  }

  const initialPassword = randomToken(18);
  const password = hashPassword(initialPassword);
  const admin = {
    username: 'admin',
    password,
    createdAt: new Date().toISOString(),
    mustChangePassword: true
  };

  fs.writeFileSync(adminFile, JSON.stringify(admin, null, 2), { mode: 0o600 });
  fs.writeFileSync(
    path.join(privateDir, 'INITIAL_ADMIN_PASSWORD.txt'),
    [
      'Strange TTS PC App initial admin password',
      '',
      `Username: admin`,
      `Password: ${initialPassword}`,
      '',
      'Login at http://127.0.0.1:48731 and change this password before commercial use.',
      ''
    ].join('\n'),
    { mode: 0o600 }
  );
  return admin;
}

export function saveAdmin(privateDir, admin) {
  fs.writeFileSync(path.join(privateDir, 'admin.json'), JSON.stringify(admin, null, 2), { mode: 0o600 });
}
