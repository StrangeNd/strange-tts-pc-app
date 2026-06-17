import fs from 'node:fs';
import path from 'node:path';

const SENSITIVE_KEY = /(cookie|token|secret|password|authorization|csrf|session|header|value)/i;
const SAFE_COOKIE_META = /^(cookieCount|cookieStorage|cookieUpdatedAt)$/i;

function logRoot(rootDir) {
  return path.join(rootDir, 'data', 'logs');
}

export function auditLogPath(rootDir) {
  return path.join(logRoot(rootDir), 'audit.ndjson');
}

function redact(value) {
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (SAFE_COOKIE_META.test(key)) return [key, item];
    if (SENSITIVE_KEY.test(key)) return [key, '[redacted]'];
    return [key, redact(item)];
  }));
}

export function appendAudit(rootDir, event, details = {}) {
  fs.mkdirSync(logRoot(rootDir), { recursive: true, mode: 0o700 });
  const record = {
    ts: new Date().toISOString(),
    event,
    details: redact(details)
  };
  fs.appendFileSync(auditLogPath(rootDir), `${JSON.stringify(record)}\n`, { mode: 0o600 });
  return record;
}
