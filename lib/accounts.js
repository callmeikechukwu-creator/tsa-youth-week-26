const crypto = require('crypto');
const Account = require('../models/Account');

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
async function getAll() {
  const docs = await Account.find().lean();
  return docs.map(a => ({
    id: a.id,
    email: a.email,
    role: a.role || 'admin',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt || null
  }));
}

/**
 * Find account by email (case-insensitive). Returns raw record with hash.
 */
async function findByEmail(email) {
  const lower = email.trim().toLowerCase();
  const doc = await Account.findOne({ email: lower }).lean();
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}

/**
 * Find account by ID. Returns raw record with hash.
 */
async function findById(id) {
  const doc = await Account.findOne({ id }).lean();
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}

/**
 * Authenticate: check email + password. Returns account (without hash) or null.
 */
async function authenticate(email, password) {
  const account = await findByEmail(email);
  if (!account) return null;

  let valid = false;
  if (account.passwordHash && account.passwordHash.includes(':')) {
    valid = verifyPassword(password, account.passwordHash);
  } else if (account.passwordHash) {
    // Plain-text fallback for first migration — then upgrade
    const pwBuf = Buffer.from(password);
    const storedBuf = Buffer.from(account.passwordHash);
    valid = pwBuf.length === storedBuf.length && crypto.timingSafeEqual(pwBuf, storedBuf);
    if (valid) {
      await Account.updateOne({ id: account.id }, { $set: { passwordHash: hashPassword(password) } });
    }
  }

  if (!valid) return null;
  return { id: account.id, email: account.email, role: account.role || 'admin' };
}

/**
 * Add a new account. Returns the new account (without hash).
 */
async function addAccount(email, password, role) {
  const existing = await findByEmail(email);
  if (existing) return { error: 'An account with this email already exists.' };
  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const id = 'ACC-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const account = {
    id,
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    role: role || 'admin',
    createdAt: new Date().toISOString()
  };
  await Account.create(account);
  return { id: account.id, email: account.email, role: account.role, createdAt: account.createdAt };
}

/**
 * Update an account's email and/or password.
 */
async function updateAccount(id, fields) {
  const account = await Account.findOne({ id }).lean();
  if (!account) return { error: 'Account not found.' };

  const update = { updatedAt: new Date().toISOString() };

  if (fields.email) {
    const lower = fields.email.trim().toLowerCase();
    const dup = await Account.findOne({ email: lower, id: { $ne: id } }).lean();
    if (dup) return { error: 'Another account already uses this email.' };
    update.email = lower;
  }

  if (fields.password) {
    if (fields.password.length < 8) return { error: 'Password must be at least 8 characters.' };
    update.passwordHash = hashPassword(fields.password);
  }

  if (fields.role) {
    update.role = fields.role;
  }

  const doc = await Account.findOneAndUpdate({ id }, { $set: update }, { new: true, lean: true });
  return { id: doc.id, email: doc.email, role: doc.role };
}

/**
 * Delete an account by ID. Will refuse if it's the last account.
 */
async function deleteAccount(id) {
  const total = await Account.countDocuments();
  if (total <= 1) return { error: 'Cannot delete the last admin account.' };
  const doc = await Account.findOneAndDelete({ id }).lean();
  if (!doc) return { error: 'Account not found.' };
  return { success: true, email: doc.email };
}

/**
 * Ensure at least one account exists.
 * If accounts collection is empty, seed from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
async function ensureSeeded() {
  const total = await Account.countDocuments();
  if (total > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('[Accounts] No accounts in store and no ADMIN_EMAIL/ADMIN_PASSWORD in .env. Cannot seed.');
    return;
  }

  console.log('[Accounts] Seeding initial admin account from .env');
  await addAccount(email, password, 'admin');
}

/**
 * Get count of accounts.
 */
async function count() {
  return Account.countDocuments();
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
