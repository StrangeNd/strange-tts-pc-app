import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CATALOG_FILE = 'catalog.json';
const PACKAGES_DIR = 'packages';
const BUNDLED_ID = 'bundled-current';

function libraryRoot(rootDir) {
  return path.join(rootDir, 'data', 'extensions');
}

function packagesRoot(rootDir) {
  return path.join(libraryRoot(rootDir), PACKAGES_DIR);
}

function catalogPath(rootDir) {
  return path.join(libraryRoot(rootDir), CATALOG_FILE);
}

function safeId(value) {
  return String(value || 'extension')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'extension';
}

function readManifest(extensionDir) {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Extension manifest not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.manifest_version !== 3) {
    throw new Error('Only Chrome Manifest V3 extensions are supported.');
  }
  if (!manifest.name || !manifest.version) {
    throw new Error('Extension manifest must include name and version.');
  }
  return manifest;
}

function hashDir(dir) {
  const hash = crypto.createHash('sha256');
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(dir);
  files.sort();
  for (const file of files) {
    const rel = path.relative(dir, file).replaceAll('\\', '/');
    hash.update(rel);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function loadCatalog(rootDir) {
  const file = catalogPath(rootDir);
  if (!fs.existsSync(file)) {
    return { activeId: BUNDLED_ID, extensions: [] };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveCatalog(rootDir, catalog) {
  fs.mkdirSync(libraryRoot(rootDir), { recursive: true, mode: 0o700 });
  fs.writeFileSync(catalogPath(rootDir), JSON.stringify(catalog, null, 2), { mode: 0o600 });
}

function upsertExtension(catalog, record) {
  const idx = catalog.extensions.findIndex(item => item.id === record.id);
  if (idx === -1) catalog.extensions.push(record);
  else catalog.extensions[idx] = record;
}

function copyExtension(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true, mode: 0o700 });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function extractZip(zipFile) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stts-extension-'));
  if (process.platform === 'win32') {
    const result = spawnSync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath ${JSON.stringify(zipFile)} -DestinationPath ${JSON.stringify(tempDir)} -Force`
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`Cannot extract zip: ${result.stderr || result.stdout}`);
    }
  } else {
    const result = spawnSync('unzip', ['-q', zipFile, '-d', tempDir], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Cannot extract zip: ${result.stderr || result.stdout}`);
  }

  if (fs.existsSync(path.join(tempDir, 'manifest.json'))) return tempDir;
  const children = fs.readdirSync(tempDir, { withFileTypes: true }).filter(entry => entry.isDirectory());
  for (const child of children) {
    const maybe = path.join(tempDir, child.name);
    if (fs.existsSync(path.join(maybe, 'manifest.json'))) return maybe;
  }
  throw new Error('Zip does not contain a manifest.json at root or first folder level.');
}

function makeRecord({ id, dir, sourceType, sourcePath }) {
  const manifest = readManifest(dir);
  return {
    id,
    name: manifest.name,
    version: manifest.version,
    sourceType,
    sourcePath,
    packageDir: dir,
    hash: hashDir(dir),
    importedAt: new Date().toISOString(),
    permissions: manifest.permissions || [],
    hostPermissions: manifest.host_permissions || []
  };
}

export function ensureExtensionLibrary(rootDir) {
  fs.mkdirSync(packagesRoot(rootDir), { recursive: true, mode: 0o700 });
  const sourceDir = path.join(rootDir, 'extension');
  const targetDir = path.join(packagesRoot(rootDir), BUNDLED_ID);
  copyExtension(sourceDir, targetDir);

  const catalog = loadCatalog(rootDir);
  const record = makeRecord({
    id: BUNDLED_ID,
    dir: targetDir,
    sourceType: 'bundled',
    sourcePath: sourceDir
  });
  upsertExtension(catalog, record);
  if (!catalog.activeId || !catalog.extensions.some(item => item.id === catalog.activeId)) {
    catalog.activeId = BUNDLED_ID;
  }
  saveCatalog(rootDir, catalog);
  return getExtensionLibrary(rootDir);
}

export function getExtensionLibrary(rootDir) {
  const catalog = loadCatalog(rootDir);
  const active = catalog.extensions.find(item => item.id === catalog.activeId) || null;
  return { ...catalog, active };
}

export function getActiveExtensionDir(rootDir) {
  const library = ensureExtensionLibrary(rootDir);
  if (!library.active?.packageDir || !fs.existsSync(path.join(library.active.packageDir, 'manifest.json'))) {
    throw new Error('Active extension package is missing.');
  }
  return library.active.packageDir;
}

export function importExtensionFromPath(rootDir, inputPath) {
  if (!inputPath || typeof inputPath !== 'string') throw new Error('Extension path is required.');
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) throw new Error(`Extension path not found: ${resolved}`);

  const stat = fs.statSync(resolved);
  const sourceDir = stat.isDirectory()
    ? resolved
    : /\.zip$/i.test(resolved)
      ? extractZip(resolved)
      : null;
  if (!sourceDir) throw new Error('Only extension folders or .zip files are supported.');

  const manifest = readManifest(sourceDir);
  const idBase = safeId(`${manifest.name}-${manifest.version}-${Date.now()}`);
  const id = idBase;
  const targetDir = path.join(packagesRoot(rootDir), id);
  copyExtension(sourceDir, targetDir);

  const catalog = loadCatalog(rootDir);
  const record = makeRecord({
    id,
    dir: targetDir,
    sourceType: stat.isDirectory() ? 'manual-folder' : 'manual-zip',
    sourcePath: resolved
  });
  upsertExtension(catalog, record);
  catalog.activeId = id;
  saveCatalog(rootDir, catalog);
  return getExtensionLibrary(rootDir);
}

export function setActiveExtension(rootDir, id) {
  const catalog = loadCatalog(rootDir);
  const found = catalog.extensions.find(item => item.id === id);
  if (!found) throw new Error(`Extension package not found: ${id}`);
  catalog.activeId = id;
  saveCatalog(rootDir, catalog);
  return getExtensionLibrary(rootDir);
}
