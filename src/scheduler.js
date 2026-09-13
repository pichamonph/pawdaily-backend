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
  // แปลงเวลาปัจจุบันเป็นเวลาไทย (UTC+7) แล้วดึงชั่วโมงและวันที่
  const nowThai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const thaiHour = nowThai.getUTCHours();
  const thaiDateStr = nowThai.toISOString().slice(0, 10);
  const tomorrowThaiStr = new Date(nowThai.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  console.log(`scheduler รัน วันไทย: ${thaiDateStr}, ชั่วโมงไทย: ${thaiHour}`);

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
        // แปลง next_due_date เป็น YYYY-MM-DD string (pg อาจคืนมาเป็น Date object หรือ string)
        const nextDueStr = m.next_due_date instanceof Date
          ? m.next_due_date.toISOString().slice(0, 10)
          : String(m.next_due_date).slice(0, 10);
        // เปรียบเทียบ string ตรง ๆ ไม่ผ่าน Date arithmetic เพื่อกัน timezone shift
        let when;
        if (nextDueStr < thaiDateStr) when = '(เลยกำหนดแล้ว)';
        else if (nextDueStr === thaiDateStr) when = '(วันนี้)';
        else if (nextDueStr === tomorrowThaiStr) when = '(พรุ่งนี้)';
        else {
          const diffDays = Math.round((new Date(nextDueStr) - new Date(thaiDateStr)) / (1000 * 60 * 60 * 24));
          when = `(อีก ${diffDays} วัน)`;
        }
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
