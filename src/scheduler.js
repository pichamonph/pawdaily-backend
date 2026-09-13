// สคริปต์นี้ตั้งใจให้รันทุกชั่วโมง (Render Cron Job: 0 * * * *)
// หน้าที่: ส่งสรุปกิจวัตรประจำวันให้ผู้ใช้ที่เลือกเวลาแจ้งเตือนตรงกับชั่วโมงปัจจุบัน (เวลาไทย)
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
  // แปลงเวลาปัจจุบันเป็นเวลาไทย (UTC+7) แล้วดึงชั่วโมง
  const thaiHour = new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
  console.log(`scheduler รัน ชั่วโมงไทยปัจจุบัน: ${thaiHour}`);

  const usersResult = await query(
    `SELECT * FROM users
     WHERE daily_reminder_enabled = TRUE
       AND preferred_reminder_hour = $1
       AND (membership_expires_at IS NULL OR membership_expires_at >= CURRENT_DATE)`,
    [thaiHour]
  );

  if (usersResult.rows.length === 0) {
    console.log('ไม่มีผู้ใช้ที่ตั้งเวลาแจ้งเตือนตรงกับชั่วโมงนี้');
    await pool.end();
    return;
  }

  for (const user of usersResult.rows) {
    // กิจวัตรถึงกำหนดวันนี้
    const routinesResult = await query(
      `SELECT routines.title, routines.frequency_days, routines.last_done_at, cats.name AS cat_name
       FROM routines
       JOIN cats ON cats.id = routines.cat_id
       WHERE cats.owner_id = $1 AND routines.active = TRUE`,
      [user.id]
    );
    const due = routinesResult.rows.filter((r) => isDue(r.last_done_at, r.frequency_days));

    // นัดหมอ/วัคซีนที่ next_due_date อยู่ในช่วง เลยมาแล้ว 1 วัน ถึง อีก 7 วัน
    const medicalResult = await query(
      `SELECT medical_events.name, medical_events.next_due_date, medical_events.type, cats.name AS cat_name
       FROM medical_events
       JOIN cats ON cats.id = medical_events.cat_id
       WHERE cats.owner_id = $1
         AND medical_events.next_due_date IS NOT NULL
         AND medical_events.next_due_date BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE + INTERVAL '7 days'`,
      [user.id]
    );
    const upcomingMedical = medicalResult.rows;

    if (due.length === 0 && upcomingMedical.length === 0) continue;

    const lines = [];

    if (due.length > 0) {
      lines.push('วันนี้ต้องทำ:');
      due.forEach((r) => lines.push(`• ${r.cat_name}: ${r.title}`));
    }

    if (upcomingMedical.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('นัดหมอ/วัคซีนใกล้ถึง:');
      upcomingMedical.forEach((m) => {
        const daysUntil = Math.ceil((new Date(m.next_due_date) - new Date()) / (1000 * 60 * 60 * 24));
        const when = daysUntil <= 0 ? '(เลยกำหนดแล้ว)' : daysUntil === 1 ? '(พรุ่งนี้)' : `(อีก ${daysUntil} วัน)`;
        lines.push(`• ${m.cat_name}: ${m.name} ${when}`);
      });
    }

    lines.push('');
    lines.push('เปิดแอปเพื่อดูรายละเอียด');

    try {
      await pushMessage(user.line_user_id, lines.join('\n'));
      console.log(`ส่งแจ้งเตือนให้ user ${user.id} แล้ว (กิจวัตร: ${due.length}, นัดหมอ: ${upcomingMedical.length})`);
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
