const jwt = require('jsonwebtoken');
const env = require('../config/env');

const COOKIE = 'em_admin';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function cookieOptions() {
  return { httpOnly: true, sameSite: 'strict', secure: env.cookieSecure, maxAge: MAX_AGE_MS, path: '/' };
}

function signIn(res, admin) {
  const token = jwt.sign({ sub: admin.id, email: admin.email, name: admin.name }, env.jwtSecret, { expiresIn: '8h' });
  res.cookie(COOKIE, token, cookieOptions());
}

function signOut(res) {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ ok: false, error: 'Please sign in.' });
  try {
    const p = jwt.verify(token, env.jwtSecret);
    req.admin = { id: p.sub, email: p.email, name: p.name };
    next();
  } catch (e) {
    res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });
  }
}

module.exports = { signIn, signOut, requireAdmin };
