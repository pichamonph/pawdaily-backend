// สคริปต์นี้ตั้งใจให้รันทุก 5 นาที (Render Cron Job: */5 * * * *)
// หน้าที่: ปิดจบการสนทนา "แจ้งปัญหา" ที่ผู้ใช้ไม่ตอบสนองเกิน 10 นาที
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('feedback-timeout: DATABASE_URL is not set — aborting');
  process.exit(1);
}
if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('feedback-timeout: LINE_CHANNEL_ACCESS_TOKEN is not set — aborting');
  process.exit(1);
}

const { query, pool } = require('./db');
const { pushMessage } = require('./line');

async function run() {
  console.log('feedback-timeout รัน:', new Date().toISOString());

  const result = await query(
    `SELECT users.id, users.line_user_id
     FROM users
     WHERE awaiting_feedback = TRUE
       AND awaiting_feedback_since < now() - INTERVAL '10 minutes'`
  );

  if (result.rows.length === 0) {
    console.log('ไม่มี session แจ้งปัญหาที่หมดเวลา');
    await pool.end();
    return;
  }

  for (const user of result.rows) {
    try {
      await pushMessage(
        user.line_user_id,
        'เนื่องจากไม่ได้รับข้อมูลเพิ่มเติม ขออนุญาตจบการให้บริการในครั้งนี้ค่ะ'
      );
      await query(
        'UPDATE users SET awaiting_feedback = FALSE, awaiting_feedback_since = NULL, pending_feedback_category = NULL WHERE id = $1',
        [user.id]
      );
      console.log(`จบ session แจ้งปัญหา user ${user.id} แล้ว`);
    } catch (err) {
      console.error(`จบ session user ${user.id} ไม่สำเร็จ:`, err.message);
    }
  }

  await pool.end();
}

run().catch((err) => {
  console.error('feedback-timeout error:', err);
  process.exit(1);
});
