import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = Object.freeze({
  cloudSyncUrl: '',
  aiDataUrl: 'https://drilling-beverly-reform-optimization.trycloudflare.com/',
  productViewEnabled: true,
  videoAutoplay: true,
  videoSound: true,
  videoLoop: true
});

function configFile(rootDir) {
  return path.join(rootDir, 'data', 'private', 'app-config.json');
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function safeBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeConfig(input = {}) {
  return {
    cloudSyncUrl: '',
    aiDataUrl: safeString(input.aiDataUrl, DEFAULT_CONFIG.aiDataUrl) || DEFAULT_CONFIG.aiDataUrl,
    productViewEnabled: safeBool(input.productViewEnabled, DEFAULT_CONFIG.productViewEnabled),
    videoAutoplay: safeBool(input.videoAutoplay, DEFAULT_CONFIG.videoAutoplay),
    videoSound: safeBool(input.videoSound, DEFAULT_CONFIG.videoSound),
    videoLoop: safeBool(input.videoLoop, DEFAULT_CONFIG.videoLoop)
  };
}

export function getAppConfig(rootDir) {
  const file = configFile(rootDir);
  if (!fs.existsSync(file)) return normalizeConfig();
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return normalizeConfig();
  }
}

export function updateAppConfig(rootDir, patch = {}) {
  const file = configFile(rootDir);
  const next = normalizeConfig({ ...getAppConfig(rootDir), ...patch });
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}
