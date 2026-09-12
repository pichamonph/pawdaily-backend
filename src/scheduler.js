// สคริปต์นี้ตั้งใจให้รันวันละ 1 ครั้ง (ผ่าน Render Cron Job) ไม่ใช่รันค้างตลอดเวลา
// หน้าที่: ไล่เช็คทุก user ว่าวันนี้แมวตัวไหนต้องทำอะไรบ้าง แล้วส่งสรุปเข้า LINE ให้คนที่เปิดแจ้งเตือนไว้
require('dotenv').config();
const { query, pool } = require('./db');
const { pushMessage } = require('./line');

function isDue(lastDoneAt, frequencyDays) {
  if (!lastDoneAt) return true;
  const last = new Date(lastDoneAt);
  const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= frequencyDays;
}

async function run() {
  // ดึงเฉพาะผู้ใช้ที่เปิดแจ้งเตือนไว้ และยังไม่หมดอายุสมาชิก (หรือยังไม่เคยตั้งวันหมดอายุ)
  const usersResult = await query(
    `SELECT * FROM users
     WHERE daily_reminder_enabled = TRUE
       AND (membership_expires_at IS NULL OR membership_expires_at >= CURRENT_DATE)`
  );

  for (const user of usersResult.rows) {
    const routinesResult = await query(
      `SELECT routines.title, routines.frequency_days, routines.last_done_at, cats.name AS cat_name
       FROM routines
       JOIN cats ON cats.id = routines.cat_id
       WHERE cats.owner_id = $1 AND routines.active = TRUE`,
      [user.id]
    );

    const due = routinesResult.rows.filter((r) => isDue(r.last_done_at, r.frequency_days));
    if (due.length === 0) continue;

    const lines = due.map((r) => `• ${r.cat_name}: ${r.title}`);
    const text = `🐱 วันนี้ต้องทำ:\n${lines.join('\n')}\n\nเปิดแอปเพื่อกดทำแล้ว`;

    try {
      await pushMessage(user.line_user_id, text);
      console.log(`ส่งแจ้งเตือนให้ user ${user.id} แล้ว (${due.length} รายการ)`);
    } catch (err) {
      console.error(`ส่งแจ้งเตือนให้ user ${user.id} ไม่สำเร็จ:`, err.message);
    }
  }

  await pool.end();
}

run().catch((err) => {
  console.error('scheduler error:', err);
  process.exit(1);
});
