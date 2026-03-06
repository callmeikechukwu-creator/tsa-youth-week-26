const express = require('express');
const router = express.Router();
const store = require('../lib/store');

// CSRF check middleware for POST routes
function csrfCheck(req, res, next) {
  const sent = req.body._csrf || req.headers['x-csrf-token'];
  if (!sent || !req.session._csrf || sent !== req.session._csrf) {
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest'
               || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) return res.status(403).json({ ok: false, message: 'Invalid or expired security token. Please refresh the page.' });
    return res.status(403).send('Invalid security token. Please refresh and try again.');
  }
  next();
}

// Home
router.get('/', (req, res) => {
  res.render('index', {
    title: 'IBCC Youth Week 26 — The Salvation Army',
    page: 'home',
    description: 'Youth Week 26 at The Salvation Army Ibadan Central Corps. Youth Retreat 2026 — Built for Greater Impact.'
  });
});

// About
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About — IBCC Youth Week 26',
    page: 'about',
    description: 'Learn about IBCC Youth Fellowship and the vision behind Youth Week 26 at The Salvation Army Ibadan Central Corps.'
  });
});

// Activities
router.get('/activities', (req, res) => {
  res.render('activities', {
    title: 'Activities — IBCC Youth Week 26',
    page: 'activities',
    description: 'Full programme and schedule for the Youth Retreat 2026 — Built for Greater Impact. Three days of worship, equipping, and fellowship.'
  });
});

// Gallery
router.get('/gallery', (req, res) => {
  res.render('gallery', {
    title: 'Gallery — IBCC Youth Week 26',
    page: 'gallery',
    description: 'Photos and memories from Youth Week 26 and past editions at The Salvation Army Ibadan Central Corps.'
  });
});

// Speakers
router.get('/speakers', (req, res) => {
  res.render('speakers', {
    title: 'Speakers — IBCC Youth Week 26',
    page: 'speakers',
    description: 'Meet the speakers and resource persons at the Youth Retreat 2026 — Built for Greater Impact.'
  });
});

// Join (GET)
router.get('/join', (req, res) => {
  res.render('join', {
    title: 'Join — IBCC Youth Week 26',
    page: 'join',
    description: 'Register for the Youth Retreat 2026 at The Salvation Army Ibadan Central Corps. Free for all young people.'
  });
});

// Join (POST — registration)
router.post('/join', csrfCheck, (req, res) => {
  let { name, email, age, church, role, heard } = req.body;

  // Sanitize: strip tags, trim, enforce max lengths
  name   = String(name   || '').trim().slice(0, 120);
  email  = String(email  || '').trim().slice(0, 254).toLowerCase();
  age    = String(age    || '').trim().slice(0, 30);
  church = String(church || '').trim().slice(0, 200);
  role   = String(role   || '').trim().slice(0, 60);
  heard  = String(heard  || '').trim().slice(0, 60);

  if (!name || !email || !age || !role) {
    return res.status(400).json({ ok: false, message: 'Please fill all required fields.' });
  }
  // Basic email format check
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  const entry = store.add('registrations', { name, email, age, church, role, heard });
  res.json({ ok: true, message: 'Registration successful!', id: entry.id, name: entry.name });
});

// Contact (GET)
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact — IBCC Youth Week 26',
    page: 'contact',
    description: 'Get in touch with IBCC Youth Fellowship. Questions, speaker nominations, or enquiries about Youth Week 26.'
  });
});

// Contact (POST)
router.post('/contact', csrfCheck, (req, res) => {
  let { name, email, phone, subject, message } = req.body;

  // Sanitize & enforce max lengths
  name    = String(name    || '').trim().slice(0, 120);
  email   = String(email   || '').trim().slice(0, 254).toLowerCase();
  phone   = String(phone   || '').trim().slice(0, 30);
  subject = String(subject || '').trim().slice(0, 60);
  message = String(message || '').trim().slice(0, 2000);

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, message: 'Please fill all required fields.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  const entry = store.add('contacts', { name, email, phone, subject, message });
  res.json({ ok: true, message: 'Message sent successfully!', id: entry.id, name: entry.name });
});

// Thank-you pages
router.get('/thank-you/registration', (req, res) => {
  res.render('thank-you', {
    title: 'Registration Confirmed — IBCC Youth Week 26',
    page: 'join',
    description: 'Your registration for IBCC Youth Week 26 has been confirmed.',
    type: 'registration',
    name: req.query.name || ''
  });
});

router.get('/thank-you/contact', (req, res) => {
  res.render('thank-you', {
    title: 'Message Sent — IBCC Youth Week 26',
    page: 'contact',
    description: 'Your message has been received by IBCC Youth Fellowship.',
    type: 'contact',
    name: req.query.name || ''
  });
});

module.exports = router;
