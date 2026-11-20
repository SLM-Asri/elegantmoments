const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./src/config/env');
const db = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/errors');

if (!env.jwtSecret || env.jwtSecret.length < 24 || /replace_with/i.test(env.jwtSecret)) {
  console.error('\n✖ JWT_SECRET is missing or too short. Copy .env.example to .env and set a long random JWT_SECRET.\n');
  process.exit(1);
}

const app = express();
if (env.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

// The website loads fonts + GSAP from CDNs and uses inline scripts/styles, so CSP allows those hosts.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        'script-src-attr': ["'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        'frame-ancestors': ["'self'"],
        'upgrade-insecure-requests': env.cookieSecure ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
if (!env.isProd) app.use(morgan('dev'));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

/* ---------- API ---------- */
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});
app.use('/api/admin', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, require('./src/routes/admin'));
app.use('/api', require('./src/routes/public'));

/* ---------- Website (static) ---------- */
const publicDir = path.join(__dirname, 'public');
app.use(
  express.static(publicDir, {
    extensions: ['html'],
    setHeaders(res, file) {
      if (/\.(webp|png|jpe?g|svg|ico|woff2?)$/i.test(file)) res.setHeader('Cache-Control', 'public, max-age=604800');
      else if (/\.(css|js)$/i.test(file)) res.setHeader('Cache-Control', 'public, max-age=3600');
      else res.setHeader('Cache-Control', 'no-cache');
      if (file.includes(`${path.sep}admin${path.sep}`)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    },
  })
);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, async () => {
  console.log(`\n  Elegant Moments running at http://localhost:${env.port}`);
  console.log(`  Admin dashboard:         http://localhost:${env.port}/admin/\n`);
  try {
    await db.query('SELECT 1');
    console.log('  ✔ MySQL connected');
  } catch (e) {
    console.error('  ✖ MySQL connection failed:', e.message);
    console.error('    Check DB_* values in .env and run: npm run db:setup\n');
  }
});

function shutdown() {
  server.close(() => db.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
