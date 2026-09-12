# PawDaily Backend

เซิร์ฟเวอร์หลังบ้านของระบบ PawDaily — รับ webhook จาก LINE, ให้ API สำหรับหน้าจอ LIFF, และส่งแจ้งเตือนกิจวัตรประจำวัน

## โครงสร้างไฟล์

- `schema.sql` — คำสั่งสร้างตารางฐานข้อมูล (รันครั้งเดียวตอนเริ่มต้น)
- `src/db.js` — เชื่อมต่อฐานข้อมูล
- `src/line.js` — เชื่อมต่อ LINE Messaging API + ตรวจสอบตัวตนจาก LIFF
- `src/server.js` — เว็บเซิร์ฟเวอร์หลัก (webhook + API + เสิร์ฟหน้าจอ LIFF)
- `src/scheduler.js` — สคริปต์ส่งแจ้งเตือนประจำวัน (รันแยกจาก server.js)
- `public/index.html` — หน้าจอ LIFF ที่ผู้ใช้เห็นจริง (วันนี้ / แมวของฉัน / ตั้งค่า)

### ก่อนอัปโหลด: ใส่ LIFF ID ให้ถูก

เปิดไฟล์ `public/index.html` หาบรรทัด:
```js
const LIFF_ID = 'PUT-YOUR-LIFF-ID-HERE';
```
แก้เป็น LIFF ID จริงที่คัดลอกเก็บไว้ตอนสร้าง LIFF app ใน LINE Developers Console

## ขั้นตอน Deploy

### 1. สร้างตารางในฐานข้อมูล

1. เข้า Supabase dashboard ของโปรเจกต์ pawdaily
2. ไปที่เมนู **SQL Editor** (แถบซ้าย)
3. วางเนื้อหาทั้งหมดจากไฟล์ `schema.sql` แล้วกด Run

### 2. อัปโหลดโค้ดขึ้น GitHub

ไปที่ repo `pawdaily-backend` ที่สร้างไว้ กด **"Add file" > "Upload files"** แล้วลากไฟล์/โฟลเดอร์ทั้งหมดในนี้ขึ้นไป (ยกเว้น `.env` ถ้ามี — ไฟล์นี้ห้ามอัปโหลดเด็ดขาดเพราะมีค่าลับ)

### 3. สร้าง Web Service บน Render

1. เข้า Render dashboard กด **New > Web Service**
2. เชื่อมกับ repo `pawdaily-backend`
3. ตั้งค่า:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. ไปที่แท็บ **Environment** ใส่ตัวแปรตามไฟล์ `.env.example`:
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_LOGIN_CHANNEL_ID`
   - `DATABASE_URL` (ใช้ค่า Session pooler จาก Supabase)
5. กด Deploy รอสักครู่ จะได้ URL แบบ `https://pawdaily-backend.onrender.com`

### 4. สร้าง Cron Job สำหรับแจ้งเตือนประจำวัน

1. ใน Render กด **New > Cron Job**
2. เชื่อมกับ repo เดียวกัน
3. **Command**: `npm run scheduler`
4. **Schedule**: `0 1 * * *` (รันทุกวันตอนตี 8 เวลาไทย เพราะ Render ใช้เวลา UTC, 1:00 UTC = 08:00 ไทย)
5. ใส่ Environment variables ชุดเดียวกับ Web Service

### 5. อัปเดต URL จริงกลับเข้า LINE Developers Console

- **Messaging API channel > Messaging API tab > Webhook URL**: ใส่ `https://pawdaily-backend.onrender.com/webhook` แล้วกด Verify
- **LINE Login channel > LIFF tab > (LIFF app ที่สร้างไว้) > Endpoint URL**: เปลี่ยนจาก `https://example.com` เป็น URL เดียวกับ Render โดยตรง เช่น `https://pawdaily-backend.onrender.com` (หน้า `public/index.html` จะถูกเสิร์ฟจาก URL นี้อัตโนมัติ ไม่ต้องมี URL แยก)

## หมายเหตุ

- แพลนฟรีของ Render จะ "หลับ" หลังไม่มีใครเรียกใช้ 15 นาที คำขอแรกหลังจากนั้นจะช้าประมาณ 1 นาที (ปกติสำหรับช่วงเริ่มต้น)
- ถ้าอยากทดสอบในเครื่องตัวเองก่อน deploy จริง: คัดลอก `.env.example` เป็น `.env` ใส่ค่าจริง แล้วรัน `npm install && npm start`
