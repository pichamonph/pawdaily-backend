require('dotenv').config();
const express = require('express');
const path = require('path');
const line = require('@line/bot-sdk');
const multer = require('multer');
const { query, findOrCreateUser } = require('./db');
const { middlewareConfig, requireLiffAuth } = require('./line');

const app = express();

const catPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// ===== LINE Webhook =====
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
  if (event.type === 'follow' || event.type === 'message') {
    await findOrCreateUser(lineUserId, null);
  }
}

app.use(express.json());

// GET /api/me
app.get('/api/me', requireLiffAuth, async (req, res) => {
  const user = await findOrCreateUser(req.lineUserId, null);
  res.json(user);
});

// PUT /api/me/reminder
app.put('/api/me/reminder', requireLiffAuth, async (req, res) => {
  const { enabled } = req.body;
  const user = await findOrCreateUser(req.lineUserId, null);
  const updated = await query(
    'UPDATE users SET daily_reminder_enabled = $1 WHERE id = $2 RETURNING *',
    [!!enabled, user.id]
  );
  res.json(updated.rows[0]);
});

// POST /api/me/renew — stub (payment not yet implemented)
app.post('/api/me/renew', requireLiffAuth, async (_req, res) => {
  res.status(501).json({ error: 'ระบบชำระเงินกำลังจะเปิดให้ใช้เร็ว ๆ นี้' });
});

// GET /api/cats
app.get('/api/cats', requireLiffAuth, async (req, res) => {
  const user = await findOrCreateUser(req.lineUserId, null);
  const cats = await query('SELECT * FROM cats WHERE owner_id = $1 ORDER BY id', [user.id]);
  res.json(cats.rows);
});

// POST /api/cats
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

async function assertOwnsCat(lineUserId, catId) {
  const result = await query(
    `SELECT cats.* FROM cats
     JOIN users ON users.id = cats.owner_id
     WHERE cats.id = $1 AND users.line_user_id = $2`,
    [catId, lineUserId]
  );
  return result.rows[0] || null;
}

// GET /api/cats/:id/routines
app.get('/api/cats/:id/routines', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const routines = await query(
    'SELECT * FROM routines WHERE cat_id = $1 AND active = TRUE ORDER BY id',
    [cat.id]
  );
  res.json(routines.rows);
});

// POST /api/cats/:id/routines
app.post('/api/cats/:id/routines', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const { title, frequency_days, last_done_at } = req.body;
  if (!title || !frequency_days) {
    return res.status(400).json({ error: 'title and frequency_days are required' });
  }
  const inserted = await query(
    'INSERT INTO routines (cat_id, title, frequency_days, last_done_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [cat.id, title, frequency_days, last_done_at || null]
  );
  res.status(201).json(inserted.rows[0]);
});

// POST /api/routines/:id/complete
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

// GET /api/today
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

function isDue(lastDoneAt, frequencyDays) {
  if (!lastDoneAt) return true;
  const last = new Date(lastDoneAt);
  const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= frequencyDays;
}

// POST /api/cats/:id/weight
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

// GET /api/cats/:id/weight
app.get('/api/cats/:id/weight', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const logs = await query(
    'SELECT * FROM weight_logs WHERE cat_id = $1 ORDER BY recorded_at',
    [cat.id]
  );
  res.json(logs.rows);
});

// PUT /api/cats/:id — แก้ไขข้อมูลแมว (ชื่อ/พันธุ์/วันเกิด)
app.put('/api/cats/:id', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const name = req.body.name?.trim() || cat.name;
  const breed = 'breed' in req.body ? (req.body.breed || null) : cat.breed;
  const birthday = 'birthday' in req.body ? (req.body.birthday || null) : cat.birthday;
  const updated = await query(
    'UPDATE cats SET name = $1, breed = $2, birthday = $3 WHERE id = $4 RETURNING *',
    [name, breed, birthday, cat.id]
  );
  res.json(updated.rows[0]);
});

// POST /api/cats/:id/photo
app.post('/api/cats/:id/photo', requireLiffAuth, (req, res, next) => {
  catPhotoUpload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    if (err) return res.status(400).json({ error: 'รับเฉพาะไฟล์รูปภาพ' });
    next();
  });
}, async (req, res) => {
  try {
    const cat = await assertOwnsCat(req.lineUserId, req.params.id);
    if (!cat) return res.status(404).json({ error: 'cat not found' });
    if (!req.file) return res.status(400).json({ error: 'no file provided' });

    const ext = req.file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${cat.id}-${Date.now()}.${ext}`;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/cat-photos/${filename}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': req.file.mimetype,
        'x-upsert': 'true',
      },
      body: req.file.buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(500).json({ error: `Upload failed: ${errText}` });
    }

    const photoUrl = `${supabaseUrl}/storage/v1/object/public/cat-photos/${filename}`;
    const updated = await query(
      'UPDATE cats SET photo_url = $1 WHERE id = $2 RETURNING *',
      [photoUrl, cat.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('photo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cats/:id/expenses
app.post('/api/cats/:id/expenses', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const { amount, category, note, expense_date } = req.body;
  if (!amount || !category) return res.status(400).json({ error: 'amount and category are required' });
  const inserted = await query(
    'INSERT INTO expenses (cat_id, amount, category, note, expense_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [cat.id, amount, category, note || null, expense_date || null]
  );
  res.status(201).json(inserted.rows[0]);
});

// GET /api/cats/:id/expenses?month=YYYY-MM
app.get('/api/cats/:id/expenses', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  let sql = 'SELECT * FROM expenses WHERE cat_id = $1';
  const params = [cat.id];
  if (req.query.month) {
    sql += " AND to_char(expense_date, 'YYYY-MM') = $2";
    params.push(req.query.month);
  }
  sql += ' ORDER BY expense_date DESC, id DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

// POST /api/cats/:id/medical-events
app.post('/api/cats/:id/medical-events', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const { type, name, event_date, next_due_date, note } = req.body;
  if (!type || !name || !event_date) {
    return res.status(400).json({ error: 'type, name, and event_date are required' });
  }
  const inserted = await query(
    'INSERT INTO medical_events (cat_id, type, name, event_date, next_due_date, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [cat.id, type, name, event_date, next_due_date || null, note || null]
  );
  res.status(201).json(inserted.rows[0]);
});

// GET /api/cats/:id/medical-events
app.get('/api/cats/:id/medical-events', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const result = await query(
    'SELECT * FROM medical_events WHERE cat_id = $1 ORDER BY event_date DESC, id DESC',
    [cat.id]
  );
  res.json(result.rows);
});

// เสิร์ฟหน้าจอ LIFF (build output จาก frontend/ หลังรัน npm run build)
app.use(express.static(path.join(__dirname, '../public')));

// fallback: ส่ง index.html สำหรับทุก path ที่ไม่ใช่ /api
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req, res) => res.send('PawDaily backend is running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PawDaily backend listening on port ${PORT}`));
