const express = require('express');
const router = express.Router();
const store = require('../lib/store');

// Auth check — only logged-in admins can access stats
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Get registration count (protected)
router.get('/stats', requireAuth, async (req, res) => {
  res.json({
    registrations: await store.count('registrations'),
    contacts: await store.count('contacts')
  });
});

module.exports = router;
