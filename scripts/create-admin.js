/* Create an admin or reset an admin's password.
   Usage: npm run admin:create -- "Name" email@example.com "StrongPassword123" */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

(async () => {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.log('Usage: npm run admin:create -- "Name" email@example.com "StrongPassword123"');
    process.exit(1);
  }
  if (password.length < 10) { console.error('Password must be at least 10 characters.'); process.exit(1); }
  const conn = await mysql.createConnection(env.db);
  const hash = await bcrypt.hash(password, 12);
  await conn.query(
    'INSERT INTO admins (name, email, password_hash) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)',
    [name, email.trim().toLowerCase(), hash]
  );
  console.log('✔ Admin saved: ' + email.trim().toLowerCase());
  await conn.end();
})().catch((e) => { console.error('✖', e.message); process.exit(1); });
