-- PawDaily database schema
-- รันไฟล์นี้ครั้งเดียวตอน setup ฐานข้อมูล (ผ่าน Supabase SQL editor หรือ psql)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  membership_expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cats (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birthday DATE,
  breed TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- กิจวัตรที่ตั้งเอง เช่น เช็ดตา (ทุก 1 วัน), ล้างกระบะทราย (ทุก 7 วัน), วัคซีน (ทุก 30 วัน)
CREATE TABLE IF NOT EXISTS routines (
  id SERIAL PRIMARY KEY,
  cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency_days INTEGER NOT NULL, -- ทำซ้ำทุกกี่วัน (1=รายวัน, 7=รายสัปดาห์, 30=รายเดือน)
  last_done_at DATE, -- วันที่ทำล่าสุด (NULL = ยังไม่เคยทำ ถือว่าถึงกำหนดทันที)
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ประวัติการทำกิจวัตรแต่ละครั้ง (เก็บไว้ดูย้อนหลัง)
CREATE TABLE IF NOT EXISTS routine_logs (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  done_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- บันทึกน้ำหนัก
CREATE TABLE IF NOT EXISTS weight_logs (
  id SERIAL PRIMARY KEY,
  cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2) NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cats_owner ON cats(owner_id);
CREATE INDEX IF NOT EXISTS idx_routines_cat ON routines(cat_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_cat ON weight_logs(cat_id);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medical_events (
  id SERIAL PRIMARY KEY,
  cat_id INTEGER NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  next_due_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_cat ON expenses(cat_id);
CREATE INDEX IF NOT EXISTS idx_medical_events_cat ON medical_events(cat_id);
