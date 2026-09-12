// ตัวเชื่อมต่อฐานข้อมูล Supabase (PostgreSQL) ผ่าน Session pooler
const { Pool } = require('pg');

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
    'INSERT INTO users (line_user_id, display_name) VALUES ($1, $2) RETURNING *',
    [lineUserId, displayName || null]
  );
  return inserted.rows[0];
}

module.exports = { pool, query, findOrCreateUser };
