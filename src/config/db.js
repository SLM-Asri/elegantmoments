const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: true,        // DATE columns come back as 'YYYY-MM-DD' strings (no timezone shifts)
  timezone: '+05:30',       // Sri Lanka
});

module.exports = pool;
