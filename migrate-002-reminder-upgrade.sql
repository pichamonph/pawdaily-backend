-- Migration 002: อัปเกรดระบบแจ้งเตือน
-- รันใน Supabase SQL Editor

-- ให้แต่ละ user เลือกชั่วโมงที่อยากรับสรุปกิจวัตรประจำวัน (0-23, เวลาไทย)
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_reminder_hour SMALLINT NOT NULL DEFAULT 8;

-- เพิ่มเวลานัดหมายและ flag กันส่งซ้ำใน medical_events
ALTER TABLE medical_events ADD COLUMN IF NOT EXISTS next_due_time TIME;
ALTER TABLE medical_events ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
