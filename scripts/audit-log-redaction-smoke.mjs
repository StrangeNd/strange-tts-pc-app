import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendAudit, auditLogPath } from '../app/audit-log.mjs';

const rootDir = mkdtempSync(path.join(tmpdir(), 'strange-audit-log-smoke-'));
const secretNeedles = [
  'secret-cookie',
  'secret-token',
  'secret-password',
  'secret-session',
  'secret-csrf',
  'secret-authorization',
  'secret-header',
  'secret-value'
];

const record = appendAudit(rootDir, 'smoke.audit_redaction', {
  shopId: 'shop-safe',
  cookieCount: 3,
  cookieStorage: 'encrypted',
  cookieUpdatedAt: '2026-06-20T00:00:00.000Z',
  cookie: 'secret-cookie',
  token: 'secret-token',
  password: 'secret-password',
  nested: {
    sessionId: 'secret-session',
    csrfToken: 'secret-csrf',
    authorization: 'secret-authorization',
    requestHeaders: {
      value: 'secret-value',
      header: 'secret-header'
    }
  },
  rows: [{ token: 'secret-token' }, { cookie: 'secret-cookie' }]
});

assert.equal(record.details.cookieCount, 3, 'safe cookieCount metadata should remain visible');
assert.equal(record.details.cookieStorage, 'encrypted', 'safe cookieStorage metadata should remain visible');
assert.equal(record.details.cookieUpdatedAt, '2026-06-20T00:00:00.000Z', 'safe cookieUpdatedAt metadata should remain visible');
assert.equal(record.details.cookie, '[redacted]', 'cookie value should be redacted');
assert.equal(record.details.token, '[redacted]', 'token value should be redacted');
assert.equal(record.details.password, '[redacted]', 'password value should be redacted');
assert.equal(record.details.nested.sessionId, '[redacted]', 'nested sessionId should be redacted');
assert.equal(record.details.nested.csrfToken, '[redacted]', 'nested csrfToken should be redacted');
assert.equal(record.details.nested.authorization, '[redacted]', 'nested authorization should be redacted');
assert.equal(record.details.nested.requestHeaders, '[redacted]', 'header-like object should be redacted');
assert.equal(record.details.rows, '[array:2]', 'arrays should be summarized rather than logged raw');

const logText = readFileSync(auditLogPath(rootDir), 'utf8');
assert(logText.includes('"event":"smoke.audit_redaction"'), 'audit log should contain the smoke event');
assert(logText.includes('"cookieCount":3'), 'audit log should preserve safe cookie metadata');
assert(logText.includes('[redacted]'), 'audit log should contain redacted markers');

for (const needle of secretNeedles) {
  assert(!logText.includes(needle), `${needle} should not appear in audit log output`);
}

console.log('Audit log redaction smoke passed.');
