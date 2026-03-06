const crypto = require('crypto');
const store = require('./store');

const COLLECTION = 'accounts';

/**
 * Hash a password with a random salt using scrypt.
 * Returns "salt:hash" hex string.
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return salt + ':' + hash;
}

/**
 * Verify a plain password against a stored "salt:hash" string.
 * Uses timing-safe comparison.
 */
function verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(plain, salt, 64);
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

/**
 * Get all accounts (returns array of { id, email, role, createdAt, updatedAt }).
 * Never returns password hashes to callers.
 */
function getAll() {
  return store.readAll(COLLECTION).map(a => ({
    id: a.id,
    email: a.email,
    role: a.role || 'admin',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt || null
  }));
}

/**
 * Get all accounts with hashes (internal use only).
 */
function _getAllRaw() {
  return store.readAll(COLLECTION);
}

/**
 * Find account by email (case-insensitive). Returns raw record with hash.
 */
function findByEmail(email) {
  const lower = email.trim().toLowerCase();
  return _getAllRaw().find(a => a.email.toLowerCase() === lower) || null;
}

/**
 * Find account by ID. Returns raw record with hash.
 */
function findById(id) {
  return _getAllRaw().find(a => a.id === id) || null;
}

/**
 * Authenticate: check email + password. Returns account (without hash) or null.
 */
function authenticate(email, password) {
  const account = findByEmail(email);
  if (!account) return null;

  // Support legacy unhashed passwords (from .env migration)
  let valid = false;
  if (account.passwordHash && account.passwordHash.includes(':')) {
    valid = verifyPassword(password, account.passwordHash);
  } else if (account.passwordHash) {
    // Plain-text fallback for first migration — then upgrade
    const pwBuf = Buffer.from(password);
    const storedBuf = Buffer.from(account.passwordHash);
    valid = pwBuf.length === storedBuf.length && crypto.timingSafeEqual(pwBuf, storedBuf);
    if (valid) {
      // Upgrade to hashed
      const all = _getAllRaw();
      const idx = all.findIndex(a => a.id === account.id);
      if (idx !== -1) {
        all[idx].passwordHash = hashPassword(password);
        store.writeAll(COLLECTION, all);
      }
    }
  }

  if (!valid) return null;
  return { id: account.id, email: account.email, role: account.role || 'admin' };
}

/**
 * Add a new account. Returns the new account (without hash).
 */
function addAccount(email, password, role) {
  const existing = findByEmail(email);
  if (existing) return { error: 'An account with this email already exists.' };
  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const all = _getAllRaw();
  const id = 'ACC-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const account = {
    id,
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    role: role || 'admin',
    createdAt: new Date().toISOString()
  };
  all.push(account);
  store.writeAll(COLLECTION, all);
  return { id: account.id, email: account.email, role: account.role, createdAt: account.createdAt };
}

/**
 * Update an account's email and/or password.
 */
function updateAccount(id, fields) {
  const all = _getAllRaw();
  const idx = all.findIndex(a => a.id === id);
  if (idx === -1) return { error: 'Account not found.' };

  if (fields.email) {
    const lower = fields.email.trim().toLowerCase();
    const dup = all.find(a => a.email.toLowerCase() === lower && a.id !== id);
    if (dup) return { error: 'Another account already uses this email.' };
    all[idx].email = lower;
  }

  if (fields.password) {
    if (fields.password.length < 8) return { error: 'Password must be at least 8 characters.' };
    all[idx].passwordHash = hashPassword(fields.password);
  }

  if (fields.role) {
    all[idx].role = fields.role;
  }

  all[idx].updatedAt = new Date().toISOString();
  store.writeAll(COLLECTION, all);
  return { id: all[idx].id, email: all[idx].email, role: all[idx].role };
}

/**
 * Delete an account by ID. Will refuse if it's the last account.
 */
function deleteAccount(id) {
  const all = _getAllRaw();
  if (all.length <= 1) return { error: 'Cannot delete the last admin account.' };
  const idx = all.findIndex(a => a.id === id);
  if (idx === -1) return { error: 'Account not found.' };
  const removed = all.splice(idx, 1)[0];
  store.writeAll(COLLECTION, all);
  return { success: true, email: removed.email };
}

/**
 * Ensure at least one account exists.
 * If accounts.json is empty, seed from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
function ensureSeeded() {
  const all = _getAllRaw();
  if (all.length > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('[Accounts] No accounts in store and no ADMIN_EMAIL/ADMIN_PASSWORD in .env. Cannot seed.');
    return;
  }

  console.log('[Accounts] Seeding initial admin account from .env');
  addAccount(email, password, 'admin');
}

/**
 * Get count of accounts.
 */
function count() {
  return _getAllRaw().length;
}

module.exports = {
  getAll,
  findByEmail,
  findById,
  authenticate,
  addAccount,
  updateAccount,
  deleteAccount,
  ensureSeeded,
  hashPassword,
  verifyPassword,
  count
};
