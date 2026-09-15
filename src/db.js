// ตัวเชื่อมต่อฐานข้อมูล Supabase (PostgreSQL) ผ่าน Session pooler
const { Pool, types } = require('pg');

// Return DATE/TIMESTAMP columns as plain strings instead of Date objects.
// Without this, String(dateObj).slice(0,10) gives "Tue Sep 15 ..." not "2026-09-15".
types.setTypeParser(1082, (val) => val); // DATE
types.setTypeParser(1114, (val) => val); // TIMESTAMP

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase ต้องการ SSL
});

async function query(text, params) {
  return pool.query(text, params);
}

// หา user จาก LINE user id ถ้ายังไม่มีให้สร้างใหม่ (ใช้ทุกครั้งที่มีการติดต่อจากผู้ใช้)
async function findOrCreateUser(lineUserId, displayName) {
  const existing = await query('SELECT * FROM users WHERE line_user_id = $1', [lineUserId]);
  if (existing.rows.length > 0) return existing.rows[0];

  const inserted = await query(
    `INSERT INTO users (line_user_id, display_name, membership_expires_at)
     VALUES ($1, $2, CURRENT_DATE + INTERVAL '30 days')
     RETURNING *`,
    [lineUserId, displayName || null]
  );
  return inserted.rows[0];
}

module.exports = { pool, query, findOrCreateUser };
