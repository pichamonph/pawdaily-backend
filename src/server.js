require('dotenv').config();
const express = require('express');
const path = require('path');
const line = require('@line/bot-sdk');
const { query, findOrCreateUser } = require('./db');
const { middlewareConfig, requireLiffAuth } = require('./line');

const app = express();

// ===== LINE Webhook =====
// รับ event จาก LINE (เช่น มีคนแอดเป็นเพื่อน, พิมพ์ข้อความมา)
// ต้องอยู่ก่อน express.json() เพราะ line middleware ต้องอ่าน raw body เพื่อตรวจลายเซ็น
app.post('/webhook', line.middleware(middlewareConfig), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  const lineUserId = event.source && event.source.userId;
  if (!lineUserId) return;

  // ทุกครั้งที่มีคนแอดเพื่อนหรือทักมา ให้แน่ใจว่ามี record ผู้ใช้ในฐานข้อมูลแล้ว
  if (event.type === 'follow' || event.type === 'message') {
    await findOrCreateUser(lineUserId, null);
  }
}

// ===== ส่วนที่เหลือใช้ JSON body ปกติ (สำหรับ API ที่ LIFF เรียก) =====
app.use(express.json());

// GET /api/me — ข้อมูลผู้ใช้ปัจจุบัน (สร้างใหม่อัตโนมัติถ้ายังไม่เคยมี)
app.get('/api/me', requireLiffAuth, async (req, res) => {
  const user = await findOrCreateUser(req.lineUserId, null);
  res.json(user);
});

// PUT /api/me/reminder — เปิด/ปิดแจ้งเตือนรายวัน
app.put('/api/me/reminder', requireLiffAuth, async (req, res) => {
  const { enabled } = req.body;
  const user = await findOrCreateUser(req.lineUserId, null);
  const updated = await query(
    'UPDATE users SET daily_reminder_enabled = $1 WHERE id = $2 RETURNING *',
    [!!enabled, user.id]
  );
  res.json(updated.rows[0]);
});

// GET /api/cats — รายชื่อแมวทั้งหมดของผู้ใช้
app.get('/api/cats', requireLiffAuth, async (req, res) => {
  const user = await findOrCreateUser(req.lineUserId, null);
  const cats = await query('SELECT * FROM cats WHERE owner_id = $1 ORDER BY id', [user.id]);
  res.json(cats.rows);
});

// POST /api/cats — เพิ่มแมวตัวใหม่
app.post('/api/cats', requireLiffAuth, async (req, res) => {
  const { name, birthday, breed, photo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const user = await findOrCreateUser(req.lineUserId, null);
  const inserted = await query(
    'INSERT INTO cats (owner_id, name, birthday, breed, photo_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [user.id, name, birthday || null, breed || null, photo_url || null]
  );
  res.status(201).json(inserted.rows[0]);
});

// ตัวช่วยเช็คว่าแมวตัวนี้เป็นของผู้ใช้ที่ล็อกอินอยู่จริงไหม (กันเปิดดู/แก้ข้อมูลของคนอื่น)
async function assertOwnsCat(lineUserId, catId) {
  const result = await query(
    `SELECT cats.* FROM cats
     JOIN users ON users.id = cats.owner_id
     WHERE cats.id = $1 AND users.line_user_id = $2`,
    [catId, lineUserId]
  );
  return result.rows[0] || null;
}

// GET /api/cats/:id/routines — กิจวัตรของแมวตัวนี้
app.get('/api/cats/:id/routines', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });

  const routines = await query(
    'SELECT * FROM routines WHERE cat_id = $1 AND active = TRUE ORDER BY id',
    [cat.id]
  );
  res.json(routines.rows);
});

// POST /api/cats/:id/routines — ตั้งกิจวัตรใหม่ให้แมว
app.post('/api/cats/:id/routines', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });

  const { title, frequency_days } = req.body;
  if (!title || !frequency_days) {
    return res.status(400).json({ error: 'title and frequency_days are required' });
  }

  const inserted = await query(
    'INSERT INTO routines (cat_id, title, frequency_days) VALUES ($1, $2, $3) RETURNING *',
    [cat.id, title, frequency_days]
  );
  res.status(201).json(inserted.rows[0]);
});

// POST /api/routines/:id/complete — กดทำแล้ว
app.post('/api/routines/:id/complete', requireLiffAuth, async (req, res) => {
  const result = await query(
    `SELECT routines.* FROM routines
     JOIN cats ON cats.id = routines.cat_id
     JOIN users ON users.id = cats.owner_id
     WHERE routines.id = $1 AND users.line_user_id = $2`,
    [req.params.id, req.lineUserId]
  );
  const routine = result.rows[0];
  if (!routine) return res.status(404).json({ error: 'routine not found' });

  await query('INSERT INTO routine_logs (routine_id) VALUES ($1)', [routine.id]);
  const updated = await query(
    'UPDATE routines SET last_done_at = CURRENT_DATE WHERE id = $1 RETURNING *',
    [routine.id]
  );
  res.json(updated.rows[0]);
});

// GET /api/today — เช็คลิสต์วันนี้ รวมทุกแมวของผู้ใช้
app.get('/api/today', requireLiffAuth, async (req, res) => {
  const user = await findOrCreateUser(req.lineUserId, null);
  const result = await query(
    `SELECT routines.id, routines.title, routines.frequency_days, routines.last_done_at,
            cats.id AS cat_id, cats.name AS cat_name
     FROM routines
     JOIN cats ON cats.id = routines.cat_id
     WHERE cats.owner_id = $1 AND routines.active = TRUE
     ORDER BY cats.id, routines.id`,
    [user.id]
  );

  const dueToday = result.rows.filter((r) => isDue(r.last_done_at, r.frequency_days));
  res.json(dueToday);
});

// เช็คว่าถึงกำหนดหรือยัง: ยังไม่เคยทำ หรือ ผ่านมาแล้ว >= จำนวนวันที่ตั้งไว้
function isDue(lastDoneAt, frequencyDays) {
  if (!lastDoneAt) return true;
  const last = new Date(lastDoneAt);
  const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= frequencyDays;
}

// POST /api/cats/:id/weight — บันทึกน้ำหนัก
app.post('/api/cats/:id/weight', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });

  const { weight_kg } = req.body;
  if (!weight_kg) return res.status(400).json({ error: 'weight_kg is required' });

  const inserted = await query(
    'INSERT INTO weight_logs (cat_id, weight_kg) VALUES ($1, $2) RETURNING *',
    [cat.id, weight_kg]
  );
  res.status(201).json(inserted.rows[0]);
});

// GET /api/cats/:id/weight — ประวัติน้ำหนัก
app.get('/api/cats/:id/weight', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });

  const logs = await query(
    'SELECT * FROM weight_logs WHERE cat_id = $1 ORDER BY recorded_at',
    [cat.id]
  );
  res.json(logs.rows);
});

// เสิร์ฟหน้าจอ LIFF (build output จาก frontend/ หลังรัน npm run build)
app.use(express.static(path.join(__dirname, '../public')));

// fallback: ส่ง index.html สำหรับทุก path ที่ไม่ใช่ /api (รองรับ client-side routing ในอนาคต)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
// เช็คว่าเซิร์ฟเวอร์ยังทำงานอยู่ไหม (ใช้เทสหลัง deploy)
app.get('/health', (req, res) => res.send('PawDaily backend is running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PawDaily backend listening on port ${PORT}`));
