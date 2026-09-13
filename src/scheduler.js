// สคริปต์นี้ตั้งใจให้รันทุกชั่วโมง (Render Cron Job: 0 * * * *)
// หน้าที่: ส่งสรุปกิจวัตรประจำวันให้ผู้ใช้ที่เลือกเวลาแจ้งเตือนตรงกับชั่วโมงปัจจุบัน (เวลาไทย)
require('dotenv').config();
const { query, pool } = require('./db');
const { client } = require('./line');

function isDue(lastDoneAt, frequencyDays) {
  if (!lastDoneAt) return true;
  const last = new Date(lastDoneAt);
  const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= frequencyDays;
}

// สร้าง Flex Carousel 1 bubble ต่อ 1 แมว แต่ละแถวมีปุ่ม "ทำแล้ว" แบบ postback
function buildCarousel(groups) {
  const totalItems = groups.reduce((n, g) => n + g.routines.length, 0);
  const bubbles = groups.map(({ catName, routines }) => ({
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#2E4060',
      paddingAll: '14px',
      contents: [
        { type: 'text', text: catName, weight: 'bold', size: 'lg', color: '#FFFFFF' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '12px',
      contents: routines.map(r => ({
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        spacing: 'sm',
        contents: [
          { type: 'text', text: r.title, size: 'sm', flex: 1, wrap: true, color: '#333333' },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'ทำแล้ว',
              data: `action=complete_routine&routine_id=${r.id}`,
            },
            style: 'primary',
            color: '#DD8C96',
            height: 'sm',
            flex: 0,
          },
        ],
      })),
    },
  }));

  return {
    type: 'flex',
    altText: `PawDaily: กิจวัตรวันนี้ ${totalItems} รายการ`,
    contents: { type: 'carousel', contents: bubbles },
  };
}

// สร้าง Flex bubble สำหรับนัดหมอ/วัคซีนใกล้ถึง (สีหัวต่างจากการ์ดกิจวัตรเพื่อแยกประเภท)
function buildMedicalFlex(appointments, thaiDateStr, tomorrowThaiStr) {
  const liffUrl = process.env.LIFF_URL || 'https://liff.line.me/';

  const rowItems = [];
  appointments.forEach((m, i) => {
    const nextDueStr = m.next_due_date instanceof Date
      ? m.next_due_date.toISOString().slice(0, 10)
      : String(m.next_due_date).slice(0, 10);

    let whenLabel;
    let urgent = false;
    if (nextDueStr < thaiDateStr) { whenLabel = 'เลยกำหนดแล้ว'; urgent = true; }
    else if (nextDueStr === thaiDateStr) { whenLabel = 'วันนี้'; urgent = true; }
    else if (nextDueStr === tomorrowThaiStr) whenLabel = 'พรุ่งนี้';
    else {
      const diffDays = Math.round((new Date(nextDueStr) - new Date(thaiDateStr)) / (1000 * 60 * 60 * 24));
      whenLabel = `อีก ${diffDays} วัน`;
    }

    if (i > 0) rowItems.push({ type: 'separator' });
    rowItems.push({
      type: 'box',
      layout: 'horizontal',
      alignItems: 'center',
      paddingTop: '10px',
      paddingBottom: '10px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 1,
          spacing: 'xs',
          contents: [
            { type: 'text', text: m.cat_name, size: 'xs', color: '#888888' },
            { type: 'text', text: m.name, size: 'sm', wrap: true, color: '#333333' },
          ],
        },
        {
          type: 'text',
          text: whenLabel,
          size: 'sm',
          color: urgent ? '#C86E7A' : '#4A5D80',
          weight: urgent ? 'bold' : 'regular',
          align: 'end',
          flex: 0,
        },
      ],
    });
  });

  return {
    type: 'flex',
    altText: `PawDaily: นัดหมาย ${appointments.length} รายการใกล้ถึง`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#E3982E',
        paddingAll: '14px',
        contents: [
          { type: 'text', text: 'นัดหมอ / วัคซีนใกล้ถึง', weight: 'bold', size: 'lg', color: '#FFFFFF' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: rowItems,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        paddingTop: '4px',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'ดูรายละเอียด', uri: liffUrl },
            style: 'secondary',
            height: 'sm',
          },
        ],
      },
    },
  };
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
    // ดึง routines.id ด้วยเพื่อใส่ใน postback data
    const routinesResult = await query(
      `SELECT routines.id, routines.title, routines.frequency_days, routines.last_done_at,
              cats.id AS cat_id, cats.name AS cat_name
       FROM routines
       JOIN cats ON cats.id = routines.cat_id
       WHERE cats.owner_id = $1 AND routines.active = TRUE
       ORDER BY cats.id, routines.id`,
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

    const messages = [];

    // Flex Carousel สำหรับกิจวัตร แยกการ์ดตามแมว
    if (due.length > 0) {
      const grouped = {};
      due.forEach(r => {
        if (!grouped[r.cat_id]) grouped[r.cat_id] = { catName: r.cat_name, routines: [] };
        grouped[r.cat_id].routines.push(r);
      });
      messages.push(buildCarousel(Object.values(grouped)));
    }

    // Flex bubble สำหรับนัดหมอ/วัคซีน — สีหัวต่างจากการ์ดกิจวัตรเพื่อแยกประเภท
    if (upcomingMedical.length > 0) {
      messages.push(buildMedicalFlex(upcomingMedical, thaiDateStr, tomorrowThaiStr));
    }

    try {
      await client.pushMessage({ to: user.line_user_id, messages });
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
