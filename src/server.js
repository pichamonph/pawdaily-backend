require('dotenv').config();
const express = require('express');
const path = require('path');
const line = require('@line/bot-sdk');
const multer = require('multer');
const { query, findOrCreateUser } = require('./db');
const { client, middlewareConfig, requireLiffAuth, pushMessage } = require('./line');

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

  if (event.type === 'follow') {
    await findOrCreateUser(lineUserId, null);
  } else if (event.type === 'message') {
    const user = await findOrCreateUser(lineUserId, null);
    const text = (event.message.text || '').trim();

    if (text === 'แจ้งปัญหา') {
      await query(
        'UPDATE users SET awaiting_feedback = TRUE, awaiting_feedback_since = now() WHERE id = $1',
        [user.id]
      );
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: 'เลือกหมวดปัญหาที่พบได้เลยค่ะ',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'postback', label: 'แจ้งเตือนไม่เข้า', data: 'feedback_category=แจ้งเตือนไม่เข้า', displayText: 'แจ้งเตือนไม่เข้า' } },
              { type: 'action', action: { type: 'postback', label: 'ปุ่ม/หน้าจอใช้งานไม่ได้', data: 'feedback_category=ปุ่ม/หน้าจอใช้งานไม่ได้', displayText: 'ปุ่ม/หน้าจอใช้งานไม่ได้' } },
              { type: 'action', action: { type: 'postback', label: 'ข้อมูลแมวผิดพลาด', data: 'feedback_category=ข้อมูลแมวผิดพลาด', displayText: 'ข้อมูลแมวผิดพลาด' } },
              { type: 'action', action: { type: 'postback', label: 'อื่นๆ', data: 'feedback_category=อื่นๆ', displayText: 'อื่นๆ' } },
            ],
          },
        }],
      });
    } else if (user.awaiting_feedback) {
      const category = user.pending_feedback_category || null;
      await query(
        'INSERT INTO feedback (user_id, message, category) VALUES ($1, $2, $3)',
        [user.id, text, category]
      );
      await query(
        'UPDATE users SET awaiting_feedback = FALSE, awaiting_feedback_since = NULL, pending_feedback_category = NULL WHERE id = $1',
        [user.id]
      );
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ได้รับเรื่องแล้วค่ะ ขอบคุณที่แจ้งให้ทราบ ทีมงานจะรีบดำเนินการ' }],
      });
      if (process.env.ADMIN_LINE_USER_ID) {
        const catLabel = category ? ` [${category}]` : '';
        await pushMessage(
          process.env.ADMIN_LINE_USER_ID,
          `แจ้งปัญหาใหม่จาก user #${user.id}${catLabel}:\n${text}`
        );
      }
    }
    // ข้อความอื่น ๆ: ไม่ตอบกลับ (ยังไม่มีฟีเจอร์เมนูอื่น)
  } else if (event.type === 'postback') {
    const params = new URLSearchParams(event.postback.data);
    if (params.get('action') === 'complete_routine') {
      const routine = await completeRoutine(params.get('routine_id'), lineUserId);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: routine
            ? `${routine.title} — บันทึกแล้ว ✓`
            : 'ไม่พบกิจวัตร หรือกิจวัตรนี้ไม่ใช่ของคุณ',
        }],
      });
    } else if (params.get('feedback_category')) {
      const category = params.get('feedback_category');
      const user = await findOrCreateUser(lineUserId, null);

      if (category === 'อื่นๆ') {
        await query(
          'UPDATE users SET awaiting_feedback_since = now(), pending_feedback_category = $2 WHERE id = $1',
          [user.id, category]
        );
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: 'พิมพ์รายละเอียดปัญหาที่เจอมาได้เลยค่ะ' }],
        });
      } else {
        await query(
          'INSERT INTO feedback (user_id, message, category) VALUES ($1, $2, $3)',
          [user.id, category, category]
        );
        await query(
          'UPDATE users SET awaiting_feedback = FALSE, awaiting_feedback_since = NULL, pending_feedback_category = NULL WHERE id = $1',
          [user.id]
        );
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `รับเรื่องแล้วค่ะ ทีมงานจะดำเนินการแก้ไขปัญหาเรื่อง "${category}" ให้เร็วที่สุด` }],
        });
        if (process.env.ADMIN_LINE_USER_ID) {
          await pushMessage(
            process.env.ADMIN_LINE_USER_ID,
            `แจ้งปัญหาใหม่จาก user #${user.id}: ${category}`
          );
        }
      }
    }
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
  const { enabled, preferred_reminder_hour } = req.body;
  if (preferred_reminder_hour !== undefined) {
    const h = parseInt(preferred_reminder_hour, 10);
    if (isNaN(h) || h < 0 || h > 23) {
      return res.status(400).json({ error: 'preferred_reminder_hour must be 0–23' });
    }
  }
  const user = await findOrCreateUser(req.lineUserId, null);
  const updated = await query(
    `UPDATE users
     SET daily_reminder_enabled = $1,
         preferred_reminder_hour = COALESCE($2::smallint, preferred_reminder_hour)
     WHERE id = $3 RETURNING *`,
    [!!enabled, preferred_reminder_hour !== undefined ? parseInt(preferred_reminder_hour, 10) : null, user.id]
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

// ฟังก์ชันกลางสำหรับบันทึกกิจวัตรสำเร็จ — ใช้ร่วมกันระหว่าง REST API และ webhook postback
// idempotent: ถ้าทำแล้ววันนี้ (CURRENT_DATE) อยู่แล้วจะไม่ insert log ซ้ำ
async function completeRoutine(routineId, lineUserId) {
  const result = await query(
    `SELECT routines.* FROM routines
     JOIN cats ON cats.id = routines.cat_id
     JOIN users ON users.id = cats.owner_id
     WHERE routines.id = $1 AND users.line_user_id = $2`,
    [routineId, lineUserId]
  );
  const routine = result.rows[0];
  if (!routine) return null;
  const alreadyDone = await query(
    'SELECT 1 FROM routines WHERE id = $1 AND last_done_at = CURRENT_DATE',
    [routine.id]
  );
  if (alreadyDone.rows.length === 0) {
    await query('INSERT INTO routine_logs (routine_id) VALUES ($1)', [routine.id]);
    await query('UPDATE routines SET last_done_at = CURRENT_DATE WHERE id = $1', [routine.id]);
  }
  return routine;
}

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
  const routine = await completeRoutine(req.params.id, req.lineUserId);
  if (!routine) return res.status(404).json({ error: 'routine not found' });
  const updated = await query('SELECT * FROM routines WHERE id = $1', [routine.id]);
  res.json(updated.rows[0]);
});

// DELETE /api/routines/:id/complete  — undo today's completion
app.delete('/api/routines/:id/complete', requireLiffAuth, async (req, res) => {
  const result = await query(
    `SELECT routines.* FROM routines
     JOIN cats ON cats.id = routines.cat_id
     JOIN users ON users.id = cats.owner_id
     WHERE routines.id = $1 AND users.line_user_id = $2`,
    [req.params.id, req.lineUserId]
  );
  const routine = result.rows[0];
  if (!routine) return res.status(404).json({ error: 'routine not found' });
  // Delete today's log entry
  await query(
    `DELETE FROM routine_logs WHERE routine_id = $1 AND done_at::date = CURRENT_DATE`,
    [routine.id]
  );
  // Recalculate last_done_at from remaining logs
  const prev = await query(
    `SELECT done_at FROM routine_logs WHERE routine_id = $1 ORDER BY done_at DESC LIMIT 1`,
    [routine.id]
  );
  const newLastDoneAt = prev.rows.length > 0 ? prev.rows[0].done_at : null;
  await query('UPDATE routines SET last_done_at = $1 WHERE id = $2', [newLastDoneAt, routine.id]);
  res.json({ ok: true });
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
  const lastStr = String(lastDoneAt).slice(0, 10);
  const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor(
    (new Date(todayStr + 'T00:00:00') - new Date(lastStr + 'T00:00:00')) / msPerDay
  );
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
  const { type, name, event_date, next_due_date, note, next_due_time } = req.body;
  if (!type || !name || !event_date) {
    return res.status(400).json({ error: 'type, name, and event_date are required' });
  }
  const inserted = await query(
    'INSERT INTO medical_events (cat_id, type, name, event_date, next_due_date, note, next_due_time) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [cat.id, type, name, event_date, next_due_date || null, note || null, next_due_time || null]
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

// POST /api/cats/:id/diary — multipart/form-data: mood, note?, entry_date?, photo?
app.post('/api/cats/:id/diary', requireLiffAuth, (req, res, next) => {
  catPhotoUpload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    if (err) return res.status(400).json({ error: 'รับเฉพาะไฟล์รูปภาพ' });
    next();
  });
}, async (req, res) => {
  try {
    const cat = await assertOwnsCat(req.lineUserId, req.params.id);
    if (!cat) return res.status(404).json({ error: 'cat not found' });

    const { mood, note, entry_date } = req.body;
    if (!mood) return res.status(400).json({ error: 'mood is required' });

    let photoUrl = null;
    if (req.file) {
      const ext = req.file.mimetype.split('/')[1].replace('jpeg', 'jpg');
      const filename = `diary-${cat.id}-${Date.now()}.${ext}`;
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

      photoUrl = `${supabaseUrl}/storage/v1/object/public/cat-photos/${filename}`;
    }

    const inserted = await query(
      'INSERT INTO diary_entries (cat_id, mood, note, photo_url, entry_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [cat.id, mood, note || null, photoUrl, entry_date || null]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    console.error('diary insert error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cats/:id/diary
app.get('/api/cats/:id/diary', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const result = await query(
    'SELECT * FROM diary_entries WHERE cat_id = $1 ORDER BY entry_date DESC, id DESC',
    [cat.id]
  );
  res.json(result.rows);
});

// GET /api/cats/:id/dashboard
app.get('/api/cats/:id/dashboard', requireLiffAuth, async (req, res) => {
  const cat = await assertOwnsCat(req.lineUserId, req.params.id);
  if (!cat) return res.status(404).json({ error: 'cat not found' });
  const catId = cat.id;

  const [weightRes, apptRes, expenseRes, routineTotalRes, routineDoneRes] = await Promise.all([
    query('SELECT weight_kg, recorded_at FROM weight_logs WHERE cat_id=$1 ORDER BY recorded_at DESC LIMIT 2', [catId]),
    query(`SELECT name, next_due_date, type FROM medical_events
           WHERE cat_id=$1 AND next_due_date >= CURRENT_DATE ORDER BY next_due_date ASC LIMIT 1`, [catId]),
    query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses
           WHERE cat_id=$1 AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)`, [catId]),
    query('SELECT COUNT(*)::int AS total FROM routines WHERE cat_id=$1 AND active=TRUE', [catId]),
    query(`SELECT COUNT(DISTINCT rl.routine_id)::int AS done FROM routine_logs rl
           JOIN routines r ON r.id = rl.routine_id
           WHERE r.cat_id=$1 AND rl.done_at::date = CURRENT_DATE`, [catId]),
  ]);

  const weights = weightRes.rows;
  const latestWeight = weights[0] ? {
    weight_kg: parseFloat(weights[0].weight_kg),
    recorded_at: weights[0].recorded_at,
    trend: weights[1]
      ? (parseFloat(weights[0].weight_kg) > parseFloat(weights[1].weight_kg) ? 'up'
        : parseFloat(weights[0].weight_kg) < parseFloat(weights[1].weight_kg) ? 'down' : 'same')
      : null,
  } : null;

  res.json({
    latestWeight,
    nextAppointment: apptRes.rows[0] || null,
    monthExpenseTotal: parseFloat(expenseRes.rows[0].total),
    routines: { total: routineTotalRes.rows[0].total, doneToday: routineDoneRes.rows[0].done },
  });
});

// GET /api/calendar?month=YYYY-MM
app.get('/api/calendar', requireLiffAuth, async (req, res) => {
  try {
    const user = await findOrCreateUser(req.lineUserId, null);
    const month = req.query.month; // e.g. "2026-09"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month param must be YYYY-MM' });
    }

    // Determine month start/end as strings
    const [year, mon] = month.split('-').map(Number);
    const monthStart = month + '-01';
    // last day of month
    const lastDay = new Date(year, mon, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    const result = {};

    // Helper to ensure a date key exists
    function addEvent(dateStr, ev) {
      if (!result[dateStr]) result[dateStr] = [];
      result[dateStr].push(ev);
    }

    // 1) medical_events: next_due_date falls within the month
    const medResult = await query(
      `SELECT me.next_due_date, me.name, c.name AS cat_name
       FROM medical_events me
       JOIN cats c ON c.id = me.cat_id
       WHERE c.owner_id = $1
         AND me.next_due_date IS NOT NULL
         AND me.next_due_date::text >= $2
         AND me.next_due_date::text <= $3`,
      [user.id, monthStart, monthEnd]
    );
    for (const row of medResult.rows) {
      const dateStr = String(row.next_due_date).slice(0, 10);
      addEvent(dateStr, { type: 'medical_event', pet_name: row.cat_name, title: row.name });
    }

    // 2) routines: project occurrences within the month using last_done_at + frequency_days stepping
    const routResult = await query(
      `SELECT r.id, r.title, r.frequency_days, r.last_done_at, c.name AS cat_name
       FROM routines r
       JOIN cats c ON c.id = r.cat_id
       WHERE c.owner_id = $1 AND r.active = TRUE AND r.last_done_at IS NOT NULL`,
      [user.id]
    );

    for (const r of routResult.rows) {
      const freq = parseInt(r.frequency_days, 10);
      if (!freq || freq <= 0) continue;

      // Start from last_done_at + freq_days, step by freq until past monthEnd
      // Use local-date string arithmetic to avoid UTC bugs
      let current = new Date(String(r.last_done_at).slice(0, 10) + 'T00:00:00');
      current.setDate(current.getDate() + freq);

      // Safety cap: avoid infinite loop
      let safety = 0;
      while (safety < 200) {
        safety++;
        const dateStr = current.toLocaleDateString('sv'); // YYYY-MM-DD in local TZ
        if (dateStr > monthEnd) break;
        if (dateStr >= monthStart) {
          addEvent(dateStr, { type: 'routine', pet_name: r.cat_name, title: r.title });
        }
        current.setDate(current.getDate() + freq);
      }
    }

    res.json(result);
  } catch (err) {
    console.error('calendar error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Ownership helpers for edit/delete =====
async function assertOwnsRoutine(lineUserId, routineId) {
  const r = await query(
    `SELECT routines.* FROM routines JOIN cats ON cats.id = routines.cat_id JOIN users ON users.id = cats.owner_id WHERE routines.id = $1 AND users.line_user_id = $2`,
    [routineId, lineUserId]
  );
  return r.rows[0] || null;
}

async function assertOwnsWeightLog(lineUserId, logId) {
  const r = await query(
    `SELECT weight_logs.* FROM weight_logs JOIN cats ON cats.id = weight_logs.cat_id JOIN users ON users.id = cats.owner_id WHERE weight_logs.id = $1 AND users.line_user_id = $2`,
    [logId, lineUserId]
  );
  return r.rows[0] || null;
}

async function assertOwnsMedicalEvent(lineUserId, eventId) {
  const r = await query(
    `SELECT medical_events.* FROM medical_events JOIN cats ON cats.id = medical_events.cat_id JOIN users ON users.id = cats.owner_id WHERE medical_events.id = $1 AND users.line_user_id = $2`,
    [eventId, lineUserId]
  );
  return r.rows[0] || null;
}

async function assertOwnsExpense(lineUserId, expenseId) {
  const r = await query(
    `SELECT expenses.* FROM expenses JOIN cats ON cats.id = expenses.cat_id JOIN users ON users.id = cats.owner_id WHERE expenses.id = $1 AND users.line_user_id = $2`,
    [expenseId, lineUserId]
  );
  return r.rows[0] || null;
}

async function assertOwnsDiaryEntry(lineUserId, entryId) {
  const r = await query(
    `SELECT diary_entries.* FROM diary_entries JOIN cats ON cats.id = diary_entries.cat_id JOIN users ON users.id = cats.owner_id WHERE diary_entries.id = $1 AND users.line_user_id = $2`,
    [entryId, lineUserId]
  );
  return r.rows[0] || null;
}

// PUT /api/routines/:id
app.put('/api/routines/:id', requireLiffAuth, async (req, res) => {
  const routine = await assertOwnsRoutine(req.lineUserId, req.params.id);
  if (!routine) return res.status(404).json({ error: 'routine not found' });
  const { title, frequency_days } = req.body;
  const updated = await query(
    'UPDATE routines SET title = COALESCE($1, title), frequency_days = COALESCE($2, frequency_days) WHERE id = $3 RETURNING *',
    [title || null, frequency_days || null, routine.id]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/routines/:id
app.delete('/api/routines/:id', requireLiffAuth, async (req, res) => {
  const routine = await assertOwnsRoutine(req.lineUserId, req.params.id);
  if (!routine) return res.status(404).json({ error: 'routine not found' });
  await query('UPDATE routines SET active = FALSE WHERE id = $1', [routine.id]);
  res.status(204).end();
});

// PUT /api/weight/:id
app.put('/api/weight/:id', requireLiffAuth, async (req, res) => {
  const log = await assertOwnsWeightLog(req.lineUserId, req.params.id);
  if (!log) return res.status(404).json({ error: 'weight log not found' });
  const { weight_kg } = req.body;
  const updated = await query(
    'UPDATE weight_logs SET weight_kg = COALESCE($1, weight_kg) WHERE id = $2 RETURNING *',
    [weight_kg || null, log.id]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/weight/:id
app.delete('/api/weight/:id', requireLiffAuth, async (req, res) => {
  const log = await assertOwnsWeightLog(req.lineUserId, req.params.id);
  if (!log) return res.status(404).json({ error: 'weight log not found' });
  await query('DELETE FROM weight_logs WHERE id = $1', [log.id]);
  res.status(204).end();
});

// PUT /api/medical-events/:id
app.put('/api/medical-events/:id', requireLiffAuth, async (req, res) => {
  const ev = await assertOwnsMedicalEvent(req.lineUserId, req.params.id);
  if (!ev) return res.status(404).json({ error: 'medical event not found' });
  const { name, event_date, next_due_date, next_due_time, note, type } = req.body;
  const updated = await query(
    `UPDATE medical_events SET
      type = COALESCE($1, type),
      name = COALESCE($2, name),
      event_date = COALESCE($3, event_date),
      next_due_date = $4,
      next_due_time = $5,
      note = $6
     WHERE id = $7 RETURNING *`,
    [type || null, name || null, event_date || null, next_due_date || null, next_due_time || null, note || null, ev.id]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/medical-events/:id
app.delete('/api/medical-events/:id', requireLiffAuth, async (req, res) => {
  const ev = await assertOwnsMedicalEvent(req.lineUserId, req.params.id);
  if (!ev) return res.status(404).json({ error: 'medical event not found' });
  await query('DELETE FROM medical_events WHERE id = $1', [ev.id]);
  res.status(204).end();
});

// PUT /api/expenses/:id
app.put('/api/expenses/:id', requireLiffAuth, async (req, res) => {
  const expense = await assertOwnsExpense(req.lineUserId, req.params.id);
  if (!expense) return res.status(404).json({ error: 'expense not found' });
  const { amount, category, note, expense_date } = req.body;
  const updated = await query(
    `UPDATE expenses SET
      amount = COALESCE($1, amount),
      category = COALESCE($2, category),
      note = $3,
      expense_date = COALESCE($4, expense_date)
     WHERE id = $5 RETURNING *`,
    [amount || null, category || null, note !== undefined ? note : expense.note, expense_date || null, expense.id]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', requireLiffAuth, async (req, res) => {
  const expense = await assertOwnsExpense(req.lineUserId, req.params.id);
  if (!expense) return res.status(404).json({ error: 'expense not found' });
  await query('DELETE FROM expenses WHERE id = $1', [expense.id]);
  res.status(204).end();
});

// PUT /api/diary/:id
app.put('/api/diary/:id', requireLiffAuth, async (req, res) => {
  const entry = await assertOwnsDiaryEntry(req.lineUserId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'diary entry not found' });
  const { mood, note } = req.body;
  const updated = await query(
    'UPDATE diary_entries SET mood = COALESCE($1, mood), note = $2 WHERE id = $3 RETURNING *',
    [mood || null, note !== undefined ? note : entry.note, entry.id]
  );
  res.json(updated.rows[0]);
});

// DELETE /api/diary/:id
app.delete('/api/diary/:id', requireLiffAuth, async (req, res) => {
  const entry = await assertOwnsDiaryEntry(req.lineUserId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'diary entry not found' });
  await query('DELETE FROM diary_entries WHERE id = $1', [entry.id]);
  res.status(204).end();
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
