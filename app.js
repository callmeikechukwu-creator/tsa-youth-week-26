require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const mongoose = require('mongoose');
const compression = require('compression');
const crypto = require('crypto');
const path = require('path');

// ── Startup guard: require a real session secret ──
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
  console.error('[FATAL] SESSION_SECRET env var is missing or too short (min 16 chars). Refusing to start.');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('[FATAL] MONGODB_URI env var is missing. Refusing to start.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy in production (for secure cookies behind reverse proxy)
// Render (and most PaaS) terminate SSL at their edge — trust one hop
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// ── Security: Remove fingerprinting header ──
app.disable('x-powered-by');

// ── Security headers middleware ──
app.use((req, res, next) => {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Disallow embedding in iframes
  res.setHeader('X-Frame-Options', 'DENY');
  // Legacy XSS filter (IE/Edge)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Restrict browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HSTS in production only (requires HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://flagcdn.com",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

// ── Middleware ──
// Gzip/Brotli compression for all responses
app.use(compression());
// Limit request body size to prevent payload flooding
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/images', express.static(path.join(__dirname, 'assets', 'images'), { maxAge: '7d' }));

// ── Session (MongoDB-backed) ──
// Secure cookies whenever running in production (behind HTTPS proxy).
const useSecureCookie = process.env.NODE_ENV === 'production';
app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 7200,
    autoRemove: 'native'
  }),
  name: 'yw26.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie
  }
}));

// ── CSRF token generation (per-session, stable) ──
function ensureCsrfToken(session) {
  if (!session._csrf) {
    session._csrf = crypto.randomBytes(32).toString('hex');
  }
  return session._csrf;
}

// ── Simple rate limiter for form submission routes ──
const formSubmissions = new Map();
const FORM_MAX = 10;          // max 10 submissions
const FORM_WINDOW = 60 * 1000; // per minute per IP

function formRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const rec = formSubmissions.get(ip);
  if (rec && now - rec.first < FORM_WINDOW) {
    if (rec.count >= FORM_MAX) {
      return res.status(429).json({ ok: false, message: 'Too many submissions. Please slow down.' });
    }
    rec.count++;
  } else {
    formSubmissions.set(ip, { count: 1, first: now });
  }
  // Clean up old entries periodically
  if (formSubmissions.size > 5000) {
    for (const [k, v] of formSubmissions)
      if (now - v.first >= FORM_WINDOW) formSubmissions.delete(k);
  }
  next();
}

// Make common vars available to all views
app.use((req, res, next) => {
  res.locals.gaId = process.env.GA_TRACKING_ID || '';
  // Dynamic siteUrl: always derived from the live request so it works
  // correctly on every host — local dev, staging, and production alike.
  // (Express's 'trust proxy' ensures req.protocol is 'https' on Render.)
  res.locals.siteUrl = req.protocol + '://' + req.get('host');
  // CSRF token — generate if not present, keep stable per session
  if (req.session) ensureCsrfToken(req.session);
  res.locals.csrfToken = (req.session && req.session._csrf) || '';
  next();
});

// Routes
const publicRouter  = require('./routes/public');
const adminRouter   = require('./routes/admin');

// Apply form rate limit to public POST endpoints only
publicRouter.post = (function(original) {
  return function(path, ...handlers) {
    return original.call(this, path, formRateLimit, ...handlers);
  };
})(publicRouter.post.bind(publicRouter));

app.use('/', publicRouter);
app.use('/admin', adminRouter);

// API routes — require auth for stats
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// 404 — don't leak server info
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    statusCode: 404,
    page: '',
    description: 'The page you\'re looking for doesn\'t exist or may have been moved.'
  });
});

// 500 error handler — never expose stack traces in production
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[Error]', err.stack || err.message);
  const status = err.status || 500;
  res.status(status).render('error', {
    title: status === 404 ? 'Page Not Found' : 'Server Error',
    statusCode: status,
    page: '',
    description: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again later.' : err.message
  });
});

// ── Connect to MongoDB, seed accounts, then start server ──
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[MongoDB] Connected successfully');

    // Seed admin accounts from .env if no accounts exist yet
    const accounts = require('./lib/accounts');
    await accounts.ensureSeeded();

    const server = app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // ── Graceful shutdown ──
    function gracefulShutdown(signal) {
      console.log(`\n[${signal}] Shutting down gracefully…`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('All connections closed. Exiting.');
        process.exit(0);
      });
      // Force exit after 10s if connections won't close
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    }
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    console.error('[FATAL] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

// ── Crash safety: log and exit cleanly ──
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.stack || err.message);
  mongoose.connection.close().finally(() => process.exit(1));
});

start();
