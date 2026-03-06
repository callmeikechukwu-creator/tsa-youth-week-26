const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const store = require('../lib/store');
const accounts = require('../lib/accounts');
const fs = require('fs');
const path = require('path');

// CSRF check middleware for state-changing routes
function csrfCheck(req, res, next) {
  const sent = req.body._csrf || req.headers['x-csrf-token'];
  if (!sent || !req.session._csrf || sent !== req.session._csrf) {
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest'
               || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) return res.status(403).json({ ok: false, success: false, error: 'Invalid or expired security token. Please refresh the page.' });
    return res.status(403).send('Invalid security token. Please refresh and try again.');
  }
  next();
}

// ── Embed TSA logo as base64 once at startup ──
let tsaLogoBase64 = '';
try {
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'tsa-logo.png');
  tsaLogoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
} catch (e) { /* logo unavailable — template falls back to text */ }

// Simple in-memory login rate limiter
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const record = loginAttempts.get(ip);
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept === 'application/json';

  if (record && now - record.first < WINDOW_MS) {
    if (record.count >= MAX_ATTEMPTS) {
      const msg = 'Too many login attempts. Please try again in 15 minutes.';
      if (isAjax) return res.status(429).json({ success: false, error: msg });
      return res.render('admin/login', {
        title: 'Admin Login', page: 'admin',
        description: 'Admin login for IBCC Youth Week 26.',
        error: msg
      });
    }
  } else if (record && now - record.first >= WINDOW_MS) {
    loginAttempts.delete(ip);
  }
  next();
}

function recordAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && now - record.first < WINDOW_MS) {
    record.count++;
  } else {
    loginAttempts.set(ip, { count: 1, first: now });
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// Login page
router.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.render('admin/login', {
    title: 'Admin Login',
    page: 'admin',
    description: 'Admin login for IBCC Youth Week 26.',
    error: null
  });
});

// Login handler
router.post('/login', rateLimit, (req, res) => {
  const { email, password } = req.body;
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept === 'application/json';

  if (!email || !password) {
    const msg = 'Please enter both email and password.';
    if (isAjax) return res.status(400).json({ success: false, error: msg });
    return res.render('admin/login', {
      title: 'Admin Login', page: 'admin',
      description: 'Admin login for IBCC Youth Week 26.',
      error: msg
    });
  }

  const account = accounts.authenticate(email, password);
  if (!account) {
    recordAttempt(req.ip);
    const msg = 'Invalid email or password. Please try again.';
    if (isAjax) return res.status(401).json({ success: false, error: msg });
    return res.render('admin/login', {
      title: 'Admin Login', page: 'admin',
      description: 'Admin login for IBCC Youth Week 26.',
      error: msg
    });
  }
  clearAttempts(req.ip);
  req.session.admin = true;
  req.session.accountId = account.id;
  req.session.accountEmail = account.email;
  req.session.lastPassword = password;
  if (isAjax) return res.json({ success: true, redirect: '/admin' });
  res.redirect('/admin');
});

// Dashboard
router.get('/', requireAuth, (req, res) => {
  const registrations = store.readAll('registrations');
  const contacts = store.readAll('contacts');

  const stats = {
    total: registrations.length,
    byAge: {},
    byRole: {},
    contacts: contacts.length
  };

  registrations.forEach(r => {
    stats.byAge[r.age] = (stats.byAge[r.age] || 0) + 1;
    stats.byRole[r.role] = (stats.byRole[r.role] || 0) + 1;
  });

  res.render('admin/dashboard', {
    title: 'Dashboard — Admin',
    page: 'admin',
    description: 'Admin dashboard for IBCC Youth Week 26.',
    registrations,
    contacts,
    stats
  });
});

// ── Individual Registration ──
router.get('/registrations/:id', requireAuth, (req, res) => {
  const entry = store.findById('registrations', req.params.id);
  if (!entry) return res.status(404).render('404', { title: 'Not Found', page: 'admin', description: '' });
  res.render('admin/registrant', {
    title: `${entry.name} — Registration`,
    page: 'admin',
    description: '',
    entry,
    regCount: store.count('registrations'),
    contactCount: store.count('contacts')
  });
});

// ── Individual Contact ──
router.get('/contacts/:id', requireAuth, (req, res) => {
  const entry = store.findById('contacts', req.params.id);
  if (!entry) return res.status(404).render('404', { title: 'Not Found', page: 'admin', description: '' });
  res.render('admin/contact-detail', {
    title: `${entry.name} — Message`,
    page: 'admin',
    description: '',
    entry,
    regCount: store.count('registrations'),
    contactCount: store.count('contacts')
  });
});

// ── Export filename helper ──
function exportStamp() {
  const d = new Date();
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');
}

// CSV-safe: prefix formula-triggering characters to prevent CSV injection in Excel
function csvSafe(val) {
  const s = String(val || '').replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}

// ── Export: Registrations CSV ──
router.get('/export/registrations', requireAuth, (req, res) => {
  const registrations = store.readAll('registrations');
  const filename = `yw26-registrations-${exportStamp()}.csv`;
  const header = 'ID,Name,Email,Age Group,Church,Role,Referral,Date\n';
  const rows = registrations.map(r =>
    `"${csvSafe(r.id)}","${csvSafe(r.name)}","${csvSafe(r.email)}","${csvSafe(r.age)}","${csvSafe(r.church)}","${csvSafe(r.role)}","${csvSafe(r.heard)}","${csvSafe(r.createdAt)}"`
  ).join('\n');
  store.logDownload({ type: 'CSV', dataset: 'registrations', filename, ip: req.ip });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(header + rows);
});

// ── Export: Contacts CSV ──
router.get('/export/contacts', requireAuth, (req, res) => {
  const contacts = store.readAll('contacts');
  const filename = `yw26-contacts-${exportStamp()}.csv`;
  const header = 'ID,Name,Email,Phone,Subject,Message,Date\n';
  const rows = contacts.map(c =>
    `"${csvSafe(c.id)}","${csvSafe(c.name)}","${csvSafe(c.email)}","${csvSafe(c.phone)}","${csvSafe(c.subject)}","${csvSafe(c.message)}","${csvSafe(c.createdAt)}"`
  ).join('\n');
  store.logDownload({ type: 'CSV', dataset: 'contacts', filename, ip: req.ip });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(header + rows);
});

// ── Export: Registrations JSON ──
router.get('/export/registrations/json', requireAuth, (req, res) => {
  const registrations = store.readAll('registrations');
  const filename = `yw26-registrations-${exportStamp()}.json`;
  store.logDownload({ type: 'JSON', dataset: 'registrations', filename, ip: req.ip });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(JSON.stringify(registrations, null, 2));
});

// ── Export: Contacts JSON ──
router.get('/export/contacts/json', requireAuth, (req, res) => {
  const contacts = store.readAll('contacts');
  const filename = `yw26-contacts-${exportStamp()}.json`;
  store.logDownload({ type: 'JSON', dataset: 'contacts', filename, ip: req.ip });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(JSON.stringify(contacts, null, 2));
});

// ── Export: Registrations PDF (print-optimised HTML) ──
router.get('/export/registrations/pdf', requireAuth, (req, res) => {
  const registrations = store.readAll('registrations');
  const now = new Date().toLocaleString('en-NG', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const rows = registrations.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="id-col">${escHtml(r.id)}</td>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td>${escHtml(r.email)}</td>
      <td>${escHtml(r.age)}</td>
      <td>${escHtml(r.church || '—')}</td>
      <td>${escHtml(r.role)}</td>
      <td>${escHtml(r.heard || '—')}</td>
      <td class="date-col">${new Date(r.createdAt).toLocaleDateString('en-NG', {day:'2-digit', month:'short', year:'numeric'})}</td>
    </tr>`).join('');

  const html = pdfTemplate({
    title: 'Registrations Report',
    fileName: `yw26-registrations-${exportStamp()}`,
    subtitle: `Youth Week 26 · IBCC Youth Fellowship · The Salvation Army, Ibadan Central Corps`,
    generated: now,
    count: registrations.length,
    label: 'registrations',
    tableHead: `<tr><th>#</th><th>Record ID</th><th>Name</th><th>Email</th><th>Age</th><th>Church / Corps</th><th>Role</th><th>Heard Via</th><th>Date</th></tr>`,
    tableBody: rows
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Export: Contacts PDF (print-optimised HTML) ──
router.get('/export/contacts/pdf', requireAuth, (req, res) => {
  const contacts = store.readAll('contacts');
  const now = new Date().toLocaleString('en-NG', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const rows = contacts.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="id-col">${escHtml(c.id)}</td>
      <td><strong>${escHtml(c.name)}</strong></td>
      <td>${escHtml(c.email)}</td>
      <td>${escHtml(c.phone || '—')}</td>
      <td>${escHtml(c.subject || 'general')}</td>
      <td class="msg-col">${escHtml(c.message || '')}</td>
      <td class="date-col">${new Date(c.createdAt).toLocaleDateString('en-NG', {day:'2-digit', month:'short', year:'numeric'})}</td>
    </tr>`).join('');

  const html = pdfTemplate({
    title: 'Messages / Contacts Report',
    fileName: `yw26-contacts-${exportStamp()}`,
    subtitle: `Youth Week 26 · IBCC Youth Fellowship · The Salvation Army, Ibadan Central Corps`,
    generated: now,
    count: contacts.length,
    label: 'messages',
    tableHead: `<tr><th>#</th><th>Record ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Subject</th><th>Message</th><th>Date</th></tr>`,
    tableBody: rows
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Delete Registration ──
router.delete('/registrations/:id', requireAuth, csrfCheck, (req, res) => {
  const removed = store.remove('registrations', req.params.id);
  if (!removed) return res.status(404).json({ success: false, error: 'Record not found.' });
  res.json({ success: true });
});

// ── Delete Contact ──
router.delete('/contacts/:id', requireAuth, csrfCheck, (req, res) => {
  const removed = store.remove('contacts', req.params.id);
  if (!removed) return res.status(404).json({ success: false, error: 'Record not found.' });
  res.json({ success: true });
});

// ── Credentials API (authenticated, returns account list) ──
router.get('/api/credentials', requireAuth, (req, res) => {
  const allAccounts = accounts.getAll();
  const primary = allAccounts[0] || {};
  res.json({
    email: primary.email || '',
    password: req.session.lastPassword || '(stored securely — change password to include it here)',
    accounts: allAccounts.map(a => ({ id: a.id, email: a.email, role: a.role }))
  });
});

// Logout
router.post('/logout', csrfCheck, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

/* ================================================================
   DEDICATED ADMIN PAGES
   ================================================================ */

// ── Registrations Page ──
router.get('/registrations', requireAuth, (req, res) => {
  const registrations = store.readAll('registrations');
  const logs = store.readAll('download-log').reverse().slice(0, 30);
  res.render('admin/registrations', {
    title: 'Registrations — Admin',
    page: 'admin',
    description: '',
    registrations,
    logs
  });
});

// ── Contacts Page ──
router.get('/contacts', requireAuth, (req, res) => {
  const contacts = store.readAll('contacts');
  const logs = store.readAll('download-log').reverse().slice(0, 30);
  res.render('admin/contacts', {
    title: 'Messages — Admin',
    page: 'admin',
    description: '',
    contacts,
    logs
  });
});

// ── Analytics Page ──
router.get('/analytics', requireAuth, (req, res) => {
  res.render('admin/analytics', {
    title: 'Analytics — Admin',
    page: 'admin',
    description: ''
  });
});

// ── Accounts Page ──
router.get('/accounts', requireAuth, (req, res) => {
  res.render('admin/accounts', {
    title: 'Accounts — Admin',
    page: 'admin',
    description: '',
    accounts: accounts.getAll(),
    regCount: store.count('registrations'),
    contactCount: store.count('contacts'),
    success: null,
    error: null
  });
});

// ── Accounts API: List ──
router.get('/api/accounts', requireAuth, (req, res) => {
  res.json({ ok: true, accounts: accounts.getAll() });
});

// ── Accounts API: Add ──
router.post('/api/accounts', requireAuth, csrfCheck, (req, res) => {
  const { email, password, role } = req.body;
  const result = accounts.addAccount(email, password, role || 'admin');
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  res.json({ ok: true, account: result });
});

// ── Accounts API: Update ──
router.put('/api/accounts/:id', requireAuth, csrfCheck, (req, res) => {
  const { email, password, role } = req.body;
  const fields = {};
  if (email) fields.email = email;
  if (password) fields.password = password;
  if (role) fields.role = role;
  const result = accounts.updateAccount(req.params.id, fields);
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  res.json({ ok: true, account: result });
});

// ── Accounts API: Delete ──
router.delete('/api/accounts/:id', requireAuth, csrfCheck, (req, res) => {
  const result = accounts.deleteAccount(req.params.id);
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  res.json({ ok: true });
});

// ── Profile Page ──
router.get('/profile', requireAuth, (req, res) => {
  const email = req.session.accountEmail || '';
  res.render('admin/profile', {
    title: 'Profile — Admin',
    page: 'admin',
    description: '',
    email,
    success: null,
    error: null
  });
});

// ── Profile: Change Password ──
router.post('/profile/password', requireAuth, csrfCheck, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const accountId = req.session.accountId;
  const email = req.session.accountEmail || '';

  const render = (error, success) => res.render('admin/profile', {
    title: 'Profile — Admin', page: 'admin', description: '',
    email, error, success
  });

  if (!currentPassword || !newPassword) return render('Please fill in all fields.', null);

  // Verify current password
  const account = accounts.authenticate(email, currentPassword);
  if (!account) return render('Current password is incorrect.', null);

  if (newPassword.length < 8) return render('New password must be at least 8 characters.', null);

  const result = accounts.updateAccount(accountId, { password: newPassword });
  if (result.error) return render(result.error, null);

  // Store in session so Credentials PDF can include it until session ends
  req.session.lastPassword = newPassword;

  render(null, 'Password updated successfully.');
});

// ── Profile: Generate Strong Password (API) ──
router.get('/api/generate-password', requireAuth, (req, res) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*-_=+?';
  const all = upper + lower + digits + special;
  let pwd = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)]
  ];
  for (let i = 4; i < 20; i++) pwd.push(all[crypto.randomInt(all.length)]);
  // Fisher-Yates shuffle
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  res.json({ password: pwd.join('') });
});

// ── Download log API (last 50) ──
router.get('/api/download-log', requireAuth, (req, res) => {
  const logs = store.readAll('download-log').reverse().slice(0, 50);
  res.json({ ok: true, logs });
});

// ── Log a client-side download (for jsPDF etc.) ──
router.post('/api/log-download', requireAuth, express.json(), csrfCheck, (req, res) => {
  const { type, dataset, filename } = req.body;
  if (!type || !dataset || !filename) return res.status(400).json({ ok: false });
  store.logDownload({ type, dataset, filename, ip: req.ip });
  res.json({ ok: true });
});

/* ================================================================
   ANALYTICS API ROUTES
   ================================================================ */
const analytics = require('../lib/analytics');

// Full dashboard data (sessions, trends, pages, sources, devices, countries)
router.get('/analytics-data', requireAuth, async (req, res) => {
  if (!analytics.isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: analytics.initError() || 'Analytics not configured',
      unconfigured: true
    });
  }
  try {
    const data = await analytics.getDashboardData();
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[Analytics] getDashboardData error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Realtime active users (polled every 30s from the client)
router.get('/analytics-realtime', requireAuth, async (req, res) => {
  if (!analytics.isConfigured()) {
    return res.json({ ok: true, activeUsers: null });
  }
  try {
    const activeUsers = await analytics.getRealtimeUsers();
    res.json({ ok: true, activeUsers });
  } catch (err) {
    res.json({ ok: false, activeUsers: null });
  }
});

// ── Helpers ──
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pdfTemplate({ title, subtitle, generated, count, label, tableHead, tableBody, fileName }) {
  const logoHtml = tsaLogoBase64
    ? `<img src="${tsaLogoBase64}" alt="TSA Logo" style="width:64px;height:64px;object-fit:contain;border-radius:10px;flex-shrink:0;filter:brightness(0) invert(1);" />`
    : `<div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;font-weight:900;">&#9829;</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(fileName || title)}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif;
    background: #fff;
    color: #1a1a2e;
    font-size: 12px;
    line-height: 1.5;
    padding: 0;
  }

  /* ── Header ── */
  .pdf-header {
    background: linear-gradient(135deg, #cc0000 0%, #6b0000 45%, #001a8c 100%);
    color: #fff;
    padding: 28px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .pdf-header-brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .pdf-header-text h1 { font-size: 22px; font-weight: 800; letter-spacing: .5px; margin-bottom: 2px; }
  .pdf-header-text p  { font-size: 11px; opacity: .8; }
  .pdf-header-right   { text-align: right; font-size: 10px; opacity: .8; line-height: 1.8; white-space: nowrap; }
  .pdf-header-right strong { display: block; font-size: 12px; font-weight: 700; opacity: 1; }

  /* ── Accent bar ── */
  .pdf-accent {
    height: 4px;
    background: linear-gradient(90deg, #cc0000, #ffd700, #0033a0, #cc0000);
    background-size: 300% 100%;
  }

  /* ── Meta bar ── */
  .pdf-meta {
    background: #f4f4fa;
    border-bottom: 2px solid #cc0000;
    padding: 14px 40px;
    display: flex;
    gap: 40px;
    align-items: center;
  }
  .pdf-meta-item { display: flex; flex-direction: column; }
  .pdf-meta-item .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #888; }
  .pdf-meta-item .val { font-size: 20px; font-weight: 800; color: #cc0000; line-height: 1.2; }
  .pdf-meta-item .val.date-val { font-size: 15px; color: #333; }

  /* ── Action bar (hidden on print) ── */
  .pdf-actions {
    padding: 16px 40px;
    background: #fff;
    border-bottom: 1px solid #eee;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .print-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    background: #cc0000;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background .2s;
  }
  .print-btn:hover { background: #a30000; }
  .pdf-tip {
    font-size: 12px;
    color: #888;
  }

  /* ── Table body ── */
  .pdf-body { padding: 24px 40px 48px; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    table-layout: fixed;
  }
  thead tr { background: #1a1a2e; color: #fff; }
  thead th {
    padding: 9px 8px;
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .8px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
  }
  tbody tr:nth-child(even) { background: #f5f5fb; }
  tbody tr:hover { background: #eeeef8; }
  tbody td {
    padding: 9px 8px;
    border-bottom: 1px solid #e8e8f0;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  tbody td strong { font-weight: 700; }

  thead th:first-child, tbody td:first-child { width: 30px; text-align: center; }
  .id-col  { font-family: 'Bebas Neue', monospace; font-size: 13px; font-weight: 400; color: #555; white-space: nowrap; letter-spacing: 1px; }
  .date-col { white-space: nowrap; font-size: 10px; color: #666; }
  .msg-col  { word-wrap: break-word; overflow-wrap: break-word; }

  /* ── Footer ── */
  .pdf-footer {
    margin-top: 28px;
    padding-top: 14px;
    border-top: 1px solid #e0e0ee;
    font-size: 10px;
    color: #aaa;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .no-data { text-align: center; padding: 48px; color: #aaa; font-size: 14px; }

  /* Standalone wrapper — ensures correct colours when rendered off-screen */
  #pdf-content { background: #fff; color: #1a1a2e; }

  /* ── Print overrides ── */
  @media print {
    .pdf-actions { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pdf-header, .pdf-accent, .pdf-meta,
    thead tr, tbody tr:nth-child(even) {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tbody tr:hover { background: #f5f5fb; }
    table { font-size: 10px; }
    thead th { font-size: 8px; padding: 7px 6px; }
    tbody td  { padding: 6px 6px; font-size: 10px; }
    .pdf-actions { display: none !important; }
  }

  @page { size: landscape; margin: 10mm; }

  /* Loading overlay */
  #pdf-loading {
    position: fixed; inset: 0;
    background: rgba(255,255,255,0.92);
    z-index: 9999;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 16px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px; font-weight: 700; color: #cc0000;
  }
  .pdf-spinner {
    width: 44px; height: 44px;
    border: 4px solid #f0f0f0;
    border-top-color: #cc0000;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div id="pdf-content">

<div class="pdf-header">
  <div class="pdf-header-brand">
    ${logoHtml}
    <div class="pdf-header-text">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
  </div>
  <div class="pdf-header-right">
    <strong>IBCC Youth Week 26</strong>
    Generated: ${generated}
  </div>
</div>

<div class="pdf-accent"></div>

<div class="pdf-meta">
  <div class="pdf-meta-item">
    <span class="lbl">Total ${label}</span>
    <span class="val">${count}</span>
  </div>
  <div class="pdf-meta-item">
    <span class="lbl">Report Date</span>
    <span class="val date-val">${generated}</span>
  </div>
</div>

<div class="pdf-body">
  ${count === 0 ? '<div class="no-data">No records found.</div>' : `
  <table>
    <thead>${tableHead}</thead>
    <tbody>${tableBody}</tbody>
  </table>
  <div class="pdf-footer">
    <span>IBCC Youth Fellowship · The Salvation Army, Ibadan Central Corps</span>
    <span>Youth Week 26 · ${new Date().getFullYear()}</span>
  </div>`}
</div>

</div><!-- /#pdf-content -->

<div class="pdf-actions">
  <button class="print-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1"/><path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2zm1 2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H5zm-1 7 .5.5h5l.5-.5v-2H4zm7 0V9H4v3h8z"/></svg>
    Save as PDF
  </button>
  <span class="pdf-tip">In the print dialog, set Destination to &ldquo;Save as PDF&rdquo; and Orientation to Landscape.</span>
</div>

</body>
</html>`;
}

module.exports = router;
