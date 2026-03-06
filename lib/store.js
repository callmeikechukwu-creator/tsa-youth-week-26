const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readAll(name) {
  ensureDir();
  const fp = getFilePath(name);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    // Attempt to read backup if primary is corrupted
    const bak = fp + '.bak';
    if (fs.existsSync(bak)) {
      try {
        console.error(`[store] ${name}.json corrupted, restoring from backup`);
        return JSON.parse(fs.readFileSync(bak, 'utf8'));
      } catch { /* backup also bad */ }
    }
    console.error(`[store] ${name}.json corrupted and no valid backup — returning empty`);
    return [];
  }
}

// Atomic write: write to temp file, then rename (atomic on same filesystem)
function writeAll(name, data) {
  ensureDir();
  const fp = getFilePath(name);
  const tmp = fp + '.tmp.' + process.pid;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, json, 'utf8');
  // Keep a backup of the previous version before overwriting
  if (fs.existsSync(fp)) {
    try { fs.copyFileSync(fp, fp + '.bak'); } catch { /* best effort */ }
  }
  fs.renameSync(tmp, fp);
}

const ID_PREFIXES = { registrations: 'REG', contacts: 'MSG' };
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateId(name) {
  const prefix = ID_PREFIXES[name] || 'REC';
  const now = new Date();
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  // Use crypto.randomInt for unpredictable IDs
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
  return prefix + '-' + date + '-' + suffix;
}

function add(name, entry) {
  const all = readAll(name);
  entry.id = generateId(name);
  entry.createdAt = new Date().toISOString();
  all.push(entry);
  writeAll(name, all);
  return entry;
}

function findById(name, id) {
  return readAll(name).find(e => e.id === id) || null;
}

function remove(name, id) {
  const all = readAll(name);
  const idx = all.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const [removed] = all.splice(idx, 1);
  writeAll(name, all);
  return removed;
}

function count(name) {
  return readAll(name).length;
}

function update(name, id, fields) {
  const all = readAll(name);
  const idx = all.findIndex(e => e.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...fields, updatedAt: new Date().toISOString() };
  writeAll(name, all);
  return all[idx];
}

/* ── Download log ── */
function logDownload({ type, dataset, filename, ip }) {
  const logs = readAll('download-log');
  logs.push({
    id: 'DL-' + Date.now() + '-' + crypto.randomInt(9999).toString().padStart(4,'0'),
    type,      // CSV | JSON | PDF
    dataset,   // registrations | contacts | credentials | analytics
    filename,
    ip: ip || 'unknown',
    createdAt: new Date().toISOString()
  });
  // Keep last 500 entries only
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  writeAll('download-log', logs);
}

module.exports = { readAll, writeAll, add, update, findById, remove, count, logDownload };
