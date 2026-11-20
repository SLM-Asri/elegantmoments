require('dotenv').config();

const bool = (v, d = false) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3000),
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  trustProxy: bool(process.env.TRUST_PROXY),
  cookieSecure: bool(process.env.COOKIE_SECURE),
  jwtSecret: process.env.JWT_SECRET,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'elegant_moments',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Elegant Moments <no-reply@localhost>',
    notifyTo: process.env.NOTIFY_EMAIL || '',
  },
  formRateLimitPerHour: int(process.env.RATE_LIMIT_FORMS_PER_HOUR, 15),
  capacity: {
    weddings: int(process.env.MAX_WEDDINGS_PER_DAY, 1),
    photography: int(process.env.MAX_PHOTOGRAPHY_PER_DAY, 4),
  },
};

env.isProd = env.nodeEnv === 'production';

module.exports = env;
