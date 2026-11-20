const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { loginSchema, isoDate } = require('../utils/validation');
const { signIn, signOut, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Writes that carry a body must be JSON. HTML forms on other sites cannot send application/json,
// so this (plus SameSite=Strict cookies) blocks cross-site form posts. DELETE has no body and
// cannot be sent by a plain HTML form, so it is not restricted here.
router.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ ok: false, error: 'JSON required.' });
  }
  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});

// A real bcrypt hash of a random string, so unknown emails take the same time as wrong passwords
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/* ---------------- Auth ---------------- */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const [[admin]] = await db.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
    const ok = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !ok) return res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
    await db.query('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id]);
    signIn(res, admin);
    res.json({ ok: true, admin: { name: admin.name, email: admin.email } });
  })
);

router.post('/logout', (req, res) => {
  signOut(res);
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => res.json({ ok: true, admin: req.admin }));

// Everything below needs a signed-in admin
router.use(requireAdmin);

router.post(
  '/password',
  asyncHandler(async (req, res) => {
    const { current, next } = z
      .object({ current: z.string().min(1).max(200), next: z.string().min(10, 'Use at least 10 characters').max(200) })
      .parse(req.body);
    const [[admin]] = await db.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    if (!admin || !(await bcrypt.compare(current, admin.password_hash))) {
      return res.status(400).json({ ok: false, error: 'Current password is incorrect.' });
    }
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 12), admin.id]);
    res.json({ ok: true });
  })
);

/* ---------------- Dashboard stats ---------------- */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [byStatus] = await db.query('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status');
    const [[msgs]] = await db.query("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'");
    const [[month]] = await db.query(
      "SELECT COUNT(*) AS n FROM bookings WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')"
    );
    const [upcoming] = await db.query(
      `SELECT id, reference, brand, service, name, phone, event_date, status FROM bookings
       WHERE event_date >= CURDATE() AND status IN ('pending','confirmed')
       ORDER BY event_date ASC LIMIT 8`
    );
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    byStatus.forEach((r) => (counts[r.status] = r.n));
    res.json({ ok: true, bookings: counts, newMessages: msgs.n, bookingsThisMonth: month.n, upcoming });
  })
);

/* ---------------- Bookings ---------------- */
const BOOKING_STATUS = ['pending', 'confirmed', 'completed', 'cancelled'];

function bookingFilter(q) {
  const where = [], args = [];
  if (BOOKING_STATUS.includes(q.status)) { where.push('status = ?'); args.push(q.status); }
  if (['weddings', 'photography'].includes(q.brand)) { where.push('brand = ?'); args.push(q.brand); }
  if (q.from && isoDate.safeParse(q.from).success) { where.push('event_date >= ?'); args.push(q.from); }
  if (q.to && isoDate.safeParse(q.to).success) { where.push('event_date <= ?'); args.push(q.to); }
  if (q.q && String(q.q).trim()) {
    const like = '%' + String(q.q).trim().replace(/[\\%_]/g, '\\$&') + '%';
    where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR reference LIKE ?)');
    args.push(like, like, like, like);
  }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const per = Math.min(100, Math.max(1, parseInt(req.query.per, 10) || 20));
    const f = bookingFilter(req.query);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM bookings ${f.sql}`, f.args);
    const [rows] = await db.query(
      `SELECT * FROM bookings ${f.sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...f.args, per, (page - 1) * per]
    );
    res.json({ ok: true, total, page, per, rows });
  })
);

// CSV export (opens in Excel / Google Sheets). Defined before /bookings/:id.
function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
}
router.get(
  '/bookings.csv',
  asyncHandler(async (req, res) => {
    const f = bookingFilter(req.query);
    const [rows] = await db.query(`SELECT * FROM bookings ${f.sql} ORDER BY event_date ASC, id ASC`, f.args);
    const cols = ['reference', 'status', 'brand', 'service', 'event_date', 'name', 'phone', 'email', 'location', 'shoot_type', 'note', 'admin_notes', 'created_at'];
    const out = [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
    res.send('\uFEFF' + out.join('\r\n'));
  })
);

router.get(
  '/bookings/:id(\\d+)',
  asyncHandler(async (req, res) => {
    const [[row]] = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Booking not found.' });
    res.json({ ok: true, booking: row });
  })
);

router.patch(
  '/bookings/:id(\\d+)',
  asyncHandler(async (req, res) => {
    const body = z
      .object({ status: z.enum(BOOKING_STATUS).optional(), admin_notes: z.string().max(4000).nullable().optional() })
      .refine((v) => v.status !== undefined || v.admin_notes !== undefined, 'Nothing to update')
      .parse(req.body);

    const [[current]] = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ ok: false, error: 'Booking not found.' });

    // Confirming must respect the daily capacity
    if (body.status === 'confirmed' && current.status !== 'confirmed') {
      const { checkDate } = require('../utils/availability');
      const a = await checkDate(current.brand, current.event_date);
      if (!a.available) {
        return res.status(409).json({
          ok: false,
          error: a.reason === 'blocked' ? 'That date is blocked in your calendar.' : 'That date already has the maximum number of confirmed bookings.',
        });
      }
    }
    const sets = [], args = [];
    if (body.status !== undefined) { sets.push('status = ?'); args.push(body.status); }
    if (body.admin_notes !== undefined) { sets.push('admin_notes = ?'); args.push(body.admin_notes || null); }
    await db.query(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`, [...args, req.params.id]);
    const [[row]] = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ ok: true, booking: row });
  })
);

router.delete(
  '/bookings/:id(\\d+)',
  asyncHandler(async (req, res) => {
    const [r] = await db.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, error: 'Booking not found.' });
    res.json({ ok: true });
  })
);

/* ---------------- Contact messages ---------------- */
const MSG_STATUS = ['new', 'read', 'replied', 'archived'];

router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const per = Math.min(100, Math.max(1, parseInt(req.query.per, 10) || 20));
    const where = [], args = [];
    if (MSG_STATUS.includes(req.query.status)) { where.push('status = ?'); args.push(req.query.status); }
    if (req.query.q && String(req.query.q).trim()) {
      const like = '%' + String(req.query.q).trim().replace(/[\\%_]/g, '\\$&') + '%';
      where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR message LIKE ?)');
      args.push(like, like, like, like);
    }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM contact_messages ${w}`, args);
    const [rows] = await db.query(
      `SELECT * FROM contact_messages ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...args, per, (page - 1) * per]
    );
    res.json({ ok: true, total, page, per, rows });
  })
);

router.patch(
  '/messages/:id(\\d+)',
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(MSG_STATUS) }).parse(req.body);
    const [r] = await db.query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, error: 'Message not found.' });
    res.json({ ok: true });
  })
);

router.delete(
  '/messages/:id(\\d+)',
  asyncHandler(async (req, res) => {
    const [r] = await db.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, error: 'Message not found.' });
    res.json({ ok: true });
  })
);

/* ---------------- Blocked dates ---------------- */
router.get(
  '/blocked-dates',
  asyncHandler(async (req, res) => {
    const [rows] = await db.query('SELECT * FROM blocked_dates WHERE blocked_date >= CURDATE() ORDER BY blocked_date ASC');
    res.json({ ok: true, rows });
  })
);

router.post(
  '/blocked-dates',
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        date: isoDate,
        brand: z.enum(['all', 'weddings', 'photography']).default('all'),
        reason: z.string().trim().max(150).optional(),
      })
      .parse(req.body);
    try {
      const [r] = await db.query('INSERT INTO blocked_dates (blocked_date, brand, reason) VALUES (?,?,?)', [b.date, b.brand, b.reason || null]);
      res.status(201).json({ ok: true, id: r.insertId });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, error: 'That date is already blocked.' });
      throw e;
    }
  })
);

router.delete(
  '/blocked-dates/:id(\\d+)',
  asyncHandler(async (req, res) => {
    await db.query('DELETE FROM blocked_dates WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  })
);

module.exports = router;
