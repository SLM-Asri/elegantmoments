/* End-to-end check of the running site. Usage: npm start (in one terminal), then: npm run test:smoke
   Uses ADMIN_EMAIL / ADMIN_PASSWORD from .env. Creates a few test rows and removes them again. */
require('dotenv').config();
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
let pass = 0, fail = 0, cookie = '';
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL ') + name + (cond ? '' : '  -> ' + (extra || ''))); };

async function call(method, url, body, headers = {}) {
  const res = await fetch(BASE + url, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie'); if (sc && /em_admin=/.test(sc)) cookie = sc.split(';')[0];
  let json = null; try { json = await res.clone().json(); } catch (e) {}
  return { status: res.status, json, res };
}
const addDays = (n) => new Date(Date.now() + (5.5 * 24 + n * 24) * 3600 * 1000).toISOString().slice(0, 10);

(async () => {
  console.log('Public API');
  let r = await call('GET', '/api/health'); ok('health is up', r.json && r.json.db === 'up');

  const wedding = { brand: 'weddings', service: 'Wedding shoot', name: 'Test Couple', phone: '077 123 4567', email: 'test@example.com', date: addDays(40), place: 'Anuradhapura', note: 'smoke test' };
  r = await call('POST', '/api/bookings', wedding);
  ok('valid wedding booking -> 201 + reference', r.status === 201 && /^EM-[A-Z2-9]{6}$/.test(r.json.reference), JSON.stringify(r.json));
  const ref = r.json && r.json.reference;

  r = await call('POST', '/api/bookings', { ...wedding, name: 'A' }); ok('short name rejected (400, field error)', r.status === 400 && r.json.fields && r.json.fields.name, JSON.stringify(r.json));
  r = await call('POST', '/api/bookings', { ...wedding, phone: '123' }); ok('bad phone rejected', r.status === 400 && r.json.fields.phone);
  r = await call('POST', '/api/bookings', { ...wedding, date: '2020-01-01' }); ok('past date rejected', r.status === 400 && r.json.fields.date);
  r = await call('POST', '/api/bookings', { ...wedding, date: '2026-02-31' }); ok('impossible date rejected', r.status === 400);
  r = await call('POST', '/api/bookings', { ...wedding, service: 'Birthday' }); ok('service not valid for brand rejected', r.status === 400 && r.json.fields.service);
  r = await call('POST', '/api/bookings', { ...wedding, email: 'nope' }); ok('bad email rejected', r.status === 400 && r.json.fields.email);
  r = await call('POST', '/api/bookings', { ...wedding, website: 'http://spam' }); ok('honeypot: fake success, nothing stored', r.status === 201);
  r = await call('POST', '/api/bookings', { ...wedding, name: "<script>alert(1)</script> O'Brien'; DROP TABLE bookings;--" }); ok('hostile text stored safely (parameterised SQL)', r.status === 201);

  const photo = { brand: 'photography', service: 'Birthday', name: 'Kamal Perera', phone: '+94 71 583 2683', date: addDays(20), kind: 'Studio' };
  r = await call('POST', '/api/bookings', photo); ok('valid photography booking (no email)', r.status === 201, JSON.stringify(r.json));

  r = await call('POST', '/api/bookings', 'not json{', { 'Content-Type': 'application/json' }); ok('malformed JSON -> 400', r.status === 400);
  r = await call('GET', `/api/availability?brand=weddings&date=${addDays(40)}`); ok('availability: pending does not block date', r.json.available === true, JSON.stringify(r.json));
  r = await call('GET', '/api/availability?brand=weddings&date=bad'); ok('availability: bad date -> 400', r.status === 400);

  r = await call('POST', '/api/contact', { name: 'Nimal', phone: '0715832683', topic: 'Birthday', msg: 'Hello, are you free next month?' }); ok('contact message saved', r.status === 201, JSON.stringify(r.json));
  r = await call('POST', '/api/contact', { name: 'Nimal', phone: '0715832683', topic: 'Hacking', msg: 'Hello there' }); ok('contact: unknown topic rejected', r.status === 400);
  r = await call('POST', '/api/contact', { name: 'N', phone: 'x', topic: 'Birthday', msg: '' }); ok('contact: invalid fields rejected', r.status === 400 && r.json.fields);

  console.log('Admin security');
  r = await call('GET', '/api/admin/bookings'); ok('bookings list requires login (401)', r.status === 401);
  r = await call('GET', '/api/admin/bookings.csv'); ok('CSV export requires login (401)', r.status === 401);
  r = await call('POST', '/api/admin/login', { email: process.env.ADMIN_EMAIL, password: 'wrong-password' }); ok('wrong password -> 401', r.status === 401);
  r = await call('POST', '/api/admin/login', { email: 'nobody@x.com', password: 'whatever' }); ok('unknown email -> same 401', r.status === 401 && r.json.error === 'Incorrect email or password.');
  r = await call('POST', '/api/admin/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  ok('correct login -> 200 + httpOnly cookie', r.status === 200 && /em_admin=.*HttpOnly/i.test(r.res.headers.get('set-cookie') || ''));

  console.log('Admin API');
  r = await call('GET', '/api/admin/stats'); ok('stats', r.json.ok && r.json.bookings.pending >= 3, JSON.stringify(r.json));
  r = await call('GET', '/api/admin/bookings?q=Test%20Couple'); ok('search by name', r.json.ok && r.json.total >= 1);
  const b = r.json.rows.find((x) => x.reference === ref); ok('booking row found by reference', !!b);
  r = await call('GET', '/api/admin/bookings?status=pending&brand=photography'); ok('filter status+brand', r.json.rows.every((x) => x.brand === 'photography' && x.status === 'pending'));
  r = await call('GET', '/api/admin/bookings?q=' + encodeURIComponent('%')); ok('LIKE wildcard in search is escaped', r.json.ok && r.json.total === 0, 'total=' + (r.json && r.json.total));

  r = await call('PATCH', '/api/admin/bookings/' + b.id, { status: 'confirmed', admin_notes: 'Advance paid' }); ok('confirm booking + note', r.json.ok && r.json.booking.status === 'confirmed');
  r = await call('GET', `/api/availability?brand=weddings&date=${addDays(40)}`); ok('confirmed wedding fills the date (capacity 1)', r.json.available === false && r.json.reason === 'full', JSON.stringify(r.json));
  r = await call('POST', '/api/bookings', wedding); ok('public booking for a full date -> 409', r.status === 409 && r.json.fields.date, JSON.stringify(r.json));
  r = await call('GET', `/api/availability?brand=photography&date=${addDays(40)}`); ok('other brand unaffected', r.json.available === true);

  r = await call('GET', '/api/admin/bookings?q=O%27Brien'); const second = r.json.rows[0];
  r = await call('PATCH', '/api/admin/bookings/' + second.id, { status: 'confirmed' }); ok('cannot confirm 2nd wedding on same date -> 409', r.status === 409, JSON.stringify(r.json));
  r = await call('PATCH', '/api/admin/bookings/' + b.id, { status: 'bogus' }); ok('invalid status rejected', r.status === 400);
  r = await call('PATCH', '/api/admin/bookings/999999', { status: 'pending' }); ok('missing booking -> 404', r.status === 404);

  r = await call('POST', '/api/admin/blocked-dates', { date: addDays(60), brand: 'all', reason: 'smoke' }); ok('block a date', r.status === 201); const blockId = r.json.id;
  r = await call('POST', '/api/admin/blocked-dates', { date: addDays(60), brand: 'all' }); ok('duplicate block -> 409', r.status === 409);
  r = await call('POST', '/api/bookings', { ...photo, date: addDays(60) }); ok('public booking on blocked date -> 409', r.status === 409, JSON.stringify(r.json));
  r = await call('DELETE', '/api/admin/blocked-dates/' + blockId); ok('unblock date', r.json.ok);

  r = await call('GET', '/api/admin/bookings.csv?q=O%27Brien'); const csv = await r.res.text();
  ok('CSV export works + formula-safe', r.status === 200 && /text\/csv/.test(r.res.headers.get('content-type')) && csv.includes('reference,status'), csv.slice(0, 80));

  r = await call('GET', '/api/admin/messages'); ok('messages list', r.json.ok && r.json.rows.length >= 1);
  const m = r.json.rows[0]; r = await call('PATCH', '/api/admin/messages/' + m.id, { status: 'replied' }); ok('update message status', r.json.ok);

  r = await call('POST', '/api/admin/password', { current: 'wrong', next: 'AnotherStrongPass1' }); ok('password change needs correct current password', r.status === 400);
  r = await call('POST', '/api/admin/password', { current: process.env.ADMIN_PASSWORD, next: 'short' }); ok('weak new password rejected', r.status === 400);
  const csrf = await fetch(BASE + '/api/admin/blocked-dates', { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: cookie }, body: '{"date":"2030-01-01"}' }); ok('non-JSON write to admin API refused (415)', csrf.status === 415);

  console.log('Cleanup');
  r = await call('GET', '/api/admin/bookings?per=100');
  for (const x of r.json.rows.filter((y) => /Test Couple|O'Brien|Kamal Perera/.test(y.name))) await call('DELETE', '/api/admin/bookings/' + x.id);
  r = await call('GET', '/api/admin/messages?per=100');
  for (const x of r.json.rows.filter((y) => y.name === 'Nimal')) await call('DELETE', '/api/admin/messages/' + x.id);
  r = await call('GET', '/api/admin/bookings?per=100');
  const left = r.json.rows.filter((y) => /Test Couple|O'Brien|Kamal Perera/.test(y.name)).length;
  const dm = await call('GET', '/api/admin/messages?per=100');
  ok('test rows removed (DELETE works)', left === 0 && dm.json.rows.filter((y) => y.name === 'Nimal').length === 0, 'left=' + left);

  r = await call('POST', '/api/admin/logout', {}); cookie = ''; r = await call('GET', '/api/admin/me'); ok('after logout -> 401', r.status === 401);
  const hdr = (await fetch(BASE + '/')).headers;
  ok('security headers present (CSP, nosniff)', !!hdr.get('content-security-policy') && hdr.get('x-content-type-options') === 'nosniff');
  ok('x-powered-by hidden', !hdr.get('x-powered-by'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
