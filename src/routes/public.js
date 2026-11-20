const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { bookingSchema, contactSchema, isoDate, todayLK } = require('../utils/validation');
const { checkDate } = require('../utils/availability');
const mailer = require('../utils/mailer');
const env = require('../config/env');

const router = express.Router();

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.formRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later or contact us on WhatsApp.' },
});
const lookupLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

// Unambiguous characters only (no 0/O, 1/I)
function makeReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return 'EM-' + s;
}

const SHOOT = { Studio: 'studio', Outdoor: 'outdoor', Both: 'both' };

/* ---------- GET /api/availability?brand=weddings&date=2026-12-20 ---------- */
router.get(
  '/availability',
  lookupLimiter,
  asyncHandler(async (req, res) => {
    const brand = req.query.brand;
    if (!['weddings', 'photography'].includes(brand)) return res.status(400).json({ ok: false, error: 'Invalid brand.' });
    const parsed = isoDate.safeParse(req.query.date);
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid date.' });
    if (parsed.data < todayLK()) return res.json({ ok: true, available: false, reason: 'past' });
    const r = await checkDate(brand, parsed.data);
    res.json({ ok: true, ...r });
  })
);

/* ---------- POST /api/bookings ---------- */
router.post(
  '/bookings',
  formLimiter,
  asyncHandler(async (req, res) => {
    const data = bookingSchema.parse(req.body);

    // Honeypot: bots fill the hidden field. Pretend success, store nothing.
    if (data.website) return res.status(201).json({ ok: true, reference: makeReference() });

    const avail = await checkDate(data.brand, data.date);
    if (!avail.available && avail.reason === 'full') {
      return res.status(409).json({
        ok: false,
        error: 'Sorry, that date is already fully booked. Please choose another date or message us on WhatsApp.',
        fields: { date: 'This date is no longer available.' },
      });
    }
    if (!avail.available && avail.reason === 'blocked') {
      return res.status(409).json({
        ok: false,
        error: 'The studio is not available on that date. Please choose another date.',
        fields: { date: 'The studio is not available on this date.' },
      });
    }

    let reference, id;
    for (let attempt = 0; attempt < 5; attempt++) {
      reference = makeReference();
      try {
        const [r] = await db.query(
          `INSERT INTO bookings
             (reference, brand, service, name, phone, email, event_date, location, shoot_type, note, ip_address, user_agent)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            reference, data.brand, data.service, data.name, data.phone.replace(/\s+/g, ' '),
            data.email || null, data.date, data.place || null,
            data.brand === 'photography' && data.kind ? SHOOT[data.kind] : null,
            data.note || null, req.ip || null, (req.get('user-agent') || '').slice(0, 255),
          ]
        );
        id = r.insertId;
        break;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e; // reference collision -> try again
      }
    }
    if (!id) throw new Error('Could not generate a unique booking reference');

    const booking = {
      id, reference, brand: data.brand, service: data.service, name: data.name, phone: data.phone,
      email: data.email, event_date: data.date, location: data.place, shoot_type: data.kind, note: data.note,
    };
    // Fire and forget — email failure must never fail the request
    mailer.notifyNewBooking(booking);
    if (booking.email) mailer.confirmBookingReceived(booking);

    res.status(201).json({ ok: true, reference, message: 'Booking request received.' });
  })
);

/* ---------- POST /api/contact ---------- */
router.post(
  '/contact',
  formLimiter,
  asyncHandler(async (req, res) => {
    const data = contactSchema.parse(req.body);
    if (data.website) return res.status(201).json({ ok: true });

    const [r] = await db.query(
      'INSERT INTO contact_messages (name, phone, email, topic, message, ip_address) VALUES (?,?,?,?,?,?)',
      [data.name, data.phone.replace(/\s+/g, ' '), data.email || null, data.topic, data.msg, req.ip || null]
    );
    mailer.notifyNewMessage({ id: r.insertId, name: data.name, phone: data.phone, email: data.email, topic: data.topic, message: data.msg });
    res.status(201).json({ ok: true, message: 'Message received.' });
  })
);

module.exports = router;
