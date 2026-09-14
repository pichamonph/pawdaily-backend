// สคริปต์นี้ตั้งใจให้รันวันละครั้ง (Render Cron Job: 0 2 * * * = 09:00 เวลาไทย)
// หน้าที่: แจ้งเตือนก่อนหมดอายุ 3 วัน และหลังหมดอายุ 1 วัน
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('membership-reminder: DATABASE_URL is not set — aborting');
  process.exit(1);
}
if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('membership-reminder: LINE_CHANNEL_ACCESS_TOKEN is not set — aborting');
  process.exit(1);
}

const { query, pool } = require('./db');
const { client } = require('./line');

function buildTrialEndingCard(liffUrl) {
  return {
    type: 'flex',
    altText: 'PawDaily: สมาชิกของคุณจะหมดอายุในอีก 3 วัน',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#E3982E',
        paddingAll: '14px',
        contents: [
          { type: 'text', text: 'ใกล้หมดอายุสมาชิก', weight: 'bold', size: 'lg', color: '#FFFFFF' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'สมาชิกของคุณจะหมดอายุในอีก 3 วัน', wrap: true, size: 'sm', color: '#333333' },
          { type: 'text', text: 'ต่ออายุเพื่อใช้งานต่อเนื่องไม่สะดุด', wrap: true, size: 'sm', color: '#666666' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        paddingTop: '4px',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'ต่ออายุตอนนี้ (39 บาท)', uri: liffUrl },
            style: 'primary',
            color: '#E3982E',
            height: 'sm',
          },
        ],
      },
    },
  };
}

function buildExpiredCard(liffUrl) {
  return {
    type: 'flex',
    altText: 'PawDaily: สมาชิกของคุณหมดอายุแล้ว',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#C0392B',
        paddingAll: '14px',
        contents: [
          { type: 'text', text: 'สมาชิกหมดอายุแล้ว', weight: 'bold', size: 'lg', color: '#FFFFFF' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'สมาชิกของคุณหมดอายุแล้ว', wrap: true, size: 'sm', color: '#333333' },
          { type: 'text', text: 'ต่ออายุเพื่อกลับมารับแจ้งเตือนดูแลแมวต่อได้เลย', wrap: true, size: 'sm', color: '#666666' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        paddingTop: '4px',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: 'ต่ออายุตอนนี้ (39 บาท)', uri: liffUrl },
            style: 'primary',
            color: '#C0392B',
            height: 'sm',
          },
        ],
      },
    },
  };
}

async function run() {
  const nowThai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const in3Days = new Date(nowThai.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(nowThai.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const liffUrl = process.env.LIFF_URL || 'https://liff.line.me/';

  console.log(`membership-reminder รัน: เช็ควันที่ ${in3Days} (3 วันข้างหน้า) และ ${yesterday} (เมื่อวาน)`);

  // --- กลุ่ม 1: ใกล้หมดอายุ (อีก 3 วัน) ---
  const expiringSoon = await query(
    `SELECT id, line_user_id FROM users WHERE membership_expires_at = $1`,
    [in3Days]
  );

  for (const user of expiringSoon.rows) {
    try {
      await client.pushMessage({ to: user.line_user_id, messages: [buildTrialEndingCard(liffUrl)] });
      console.log(`ส่งแจ้งเตือนใกล้หมดอายุ user ${user.id} แล้ว`);
    } catch (err) {
      console.error(`ส่งแจ้งเตือนใกล้หมดอายุ user ${user.id} ไม่สำเร็จ:`, err.message);
    }
  }

  // --- กลุ่ม 2: หมดอายุแล้ว (เมื่อวาน) ---
  const expired = await query(
    `SELECT id, line_user_id FROM users WHERE membership_expires_at = $1`,
    [yesterday]
  );

  for (const user of expired.rows) {
    try {
      await client.pushMessage({ to: user.line_user_id, messages: [buildExpiredCard(liffUrl)] });
      console.log(`ส่งแจ้งเตือนหมดอายุ user ${user.id} แล้ว`);
    } catch (err) {
      console.error(`ส่งแจ้งเตือนหมดอายุ user ${user.id} ไม่สำเร็จ:`, err.message);
    }
  }

  console.log(`สรุป: ใกล้หมดอายุ ${expiringSoon.rows.length} ราย, หมดอายุแล้ว ${expired.rows.length} ราย`);
  await pool.end();
}

run().catch((err) => {
  console.error('membership-reminder error:', err);
  process.exit(1);
});
