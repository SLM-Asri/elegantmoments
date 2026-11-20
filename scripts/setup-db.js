/* Creates the database + tables from database/schema.sql, then creates the admin user from .env */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');

(async () => {
  const name = env.db.database;
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('DB_NAME may only contain letters, numbers and underscores.');

  const conn = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, charset: 'utf8mb4',
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${name}\``);

  // Run schema.sql, skipping its own CREATE DATABASE / USE lines (we already did that with DB_NAME)
  const sql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8')
    .replace(/^--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !/^(CREATE DATABASE|USE)\b/i.test(s));
  for (const stmt of sql) await conn.query(stmt);
  console.log('✔ Tables ready in database "' + name + '"');

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const adminName = process.env.ADMIN_NAME || 'Studio Admin';
  if (email && password) {
    if (password.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters.');
    const [[exists]] = await conn.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (exists) {
      console.log('• Admin already exists (' + email + ') — password left unchanged. Use `npm run admin:create` to reset it.');
    } else {
      await conn.query('INSERT INTO admins (name, email, password_hash) VALUES (?,?,?)', [adminName, email, await bcrypt.hash(password, 12)]);
      console.log('✔ Admin created: ' + email);
    }
  } else {
    console.log('• ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — run `npm run admin:create` to add an admin.');
  }
  await conn.end();
  console.log('\nDone. Start the site with: npm start');
})().catch((e) => {
  console.error('✖ Setup failed:', e.message);
  process.exit(1);
});
