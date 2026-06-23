import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();

const reportFiles = readdirSync(rootDir)
  .filter((name) => name.endsWith('_PR_REPORT.md'))
  .sort();

assert(reportFiles.length > 0, 'Expected at least one PR report to scan');

const rawSecretPatterns = [
  {
    name: 'private key marker',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i
  },
  {
    name: 'Bearer authorization value',
    regex: /\bBearer\s+(?!\[redacted\]|redacted|<redacted>|xxx)[A-Za-z0-9._~+/=-]{16,}/i
  },
  {
    name: 'cookie header value',
    regex: /\b(?:cookie|set-cookie)\s*[:=]\s*(?!\[redacted\]|redacted|<redacted>|none|no\b)[^\s`'"]{12,}/i
  },
  {
    name: 'session id value',
    regex: /\b(?:sessionid|session_id|sid)\s*[:=]\s*(?!\[redacted\]|redacted|<redacted>|none)[A-Za-z0-9._-]{12,}/i
  },
  {
    name: 'token assignment value',
    regex: /\b(?:token|api[_-]?key|secret|password)\s*[:=]\s*(?!\[redacted\]|redacted|<redacted>|none)[A-Za-z0-9._~+/=-]{16,}/i
  },
  {
    name: 'Google/Gemini API key',
    regex: /\bAIza[0-9A-Za-z_-]{20,}\b/
  },
  {
    name: 'Telegram bot token',
    regex: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/
  }
];

const findings = [];

for (const file of reportFiles) {
  const text = readFileSync(join(rootDir, file), 'utf8');
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of rawSecretPatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push(`${file}:${index + 1} matched ${pattern.name}`);
      }
    }
  }
}

assert.equal(
  findings.length,
  0,
  `PR reports should not contain raw secret-like evidence:\n${findings.join('\n')}`
);

console.log(`PR report sensitive-content smoke passed for ${reportFiles.length} reports.`);
