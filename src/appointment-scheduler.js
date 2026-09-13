// สคริปต์นี้ตั้งใจให้รันทุกชั่วโมง (Render Cron Job: 0 * * * *)
// หน้าที่: ส่งแจ้งเตือนนัดหมายเฉพาะจุด (วัคซีน/หาหมอ) ที่ตรงกับวันและชั่วโมงปัจจุบัน (เวลาไทย)
require('dotenv').config();
const { query, pool } = require('./db');
const { pushMessage } = require('./line');

async function run() {
  // แปลงเวลาปัจจุบันเป็นเวลาไทย (UTC+7) — จุดที่พลาดบ่อยที่สุดคือลืมแปลง timezone
  const nowThai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const thaiHour = nowThai.getUTCHours();
  // วันที่ไทยในรูปแบบ YYYY-MM-DD
  const thaiDateStr = nowThai.toISOString().split('T')[0];

  console.log(`appointment-scheduler รัน วันไทย: ${thaiDateStr}, ชั่วโมงไทย: ${thaiHour}`);

  const result = await query(
    `SELECT medical_events.id,
            medical_events.name,
            medical_events.next_due_time,
            medical_events.type,
            cats.name AS cat_name,
            users.line_user_id
     FROM medical_events
     JOIN cats ON cats.id = medical_events.cat_id
     JOIN users ON users.id = cats.owner_id
     WHERE medical_events.next_due_date = $1
       AND medical_events.next_due_time IS NOT NULL
       AND EXTRACT(HOUR FROM medical_events.next_due_time) = $2
       AND medical_events.reminder_sent = FALSE
       AND users.daily_reminder_enabled = TRUE
       AND (users.membership_expires_at IS NULL OR users.membership_expires_at >= CURRENT_DATE)`,
    [thaiDateStr, thaiHour]
  );

  if (result.rows.length === 0) {
    console.log('ไม่มีนัดหมายที่ต้องแจ้งเตือนในชั่วโมงนี้');
    await pool.end();
    return;
  }

  for (const appt of result.rows) {
    // next_due_time มาจาก PostgreSQL เป็น string "HH:MM:SS" ตัดให้เหลือ HH:MM
    const timeStr = String(appt.next_due_time).slice(0, 5);
    const msg = `นัดหมายวันนี้: ${appt.cat_name} ต้อง ${appt.name} เวลา ${timeStr} น.`;
    try {
      await pushMessage(appt.line_user_id, msg);
      await query('UPDATE medical_events SET reminder_sent = TRUE WHERE id = $1', [appt.id]);
      console.log(`ส่งแจ้งเตือนนัดหมาย id=${appt.id} (${appt.cat_name}: ${appt.name}) ให้ ${appt.line_user_id} แล้ว`);
    } catch (err) {
      console.error(`ส่งแจ้งเตือนนัดหมาย id=${appt.id} ไม่สำเร็จ:`, err.message);
    }
  }

  await pool.end();
}

run().catch((err) => {
  console.error('appointment-scheduler error:', err);
  process.exit(1);
});
