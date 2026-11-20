const db = require('../config/db');
const env = require('../config/env');

/**
 * Is the date free for this brand?
 * Blocked if: the admin blocked the date (for this brand or 'all'),
 * or confirmed bookings already reach the daily capacity.
 * Pending enquiries do NOT block a date (the studio has not accepted them yet).
 */
async function checkDate(brand, date) {
  const [blocked] = await db.query(
    "SELECT reason FROM blocked_dates WHERE blocked_date = ? AND brand IN ('all', ?) LIMIT 1",
    [date, brand]
  );
  if (blocked.length) return { available: false, reason: 'blocked' };

  const [[row]] = await db.query(
    "SELECT COUNT(*) AS n FROM bookings WHERE brand = ? AND event_date = ? AND status = 'confirmed'",
    [brand, date]
  );
  if (row.n >= env.capacity[brand]) return { available: false, reason: 'full' };
  return { available: true };
}

module.exports = { checkDate };
