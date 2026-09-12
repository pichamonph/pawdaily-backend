// ตัวช่วยติดต่อ LINE: ส่งข้อความ (push) และตรวจสอบตัวตนผู้ใช้จากหน้า LIFF
const line = require('@line/bot-sdk');

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const middlewareConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// ส่งข้อความ push หา user คนเดียว (นับโควตา LINE OA)
async function pushMessage(lineUserId, text) {
  return client.pushMessage({
    to: lineUserId,
    messages: [{ type: 'text', text }],
  });
}

// ตรวจสอบ LIFF ID token ที่ frontend ส่งมา ว่าถูกต้องจริงและได้ LINE user id อะไร
// LIFF ฝั่งหน้าเว็บต้องเรียก liff.getIDToken() แล้วส่งมาใน header Authorization: Bearer <token>
async function verifyIdToken(idToken) {
  const params = new URLSearchParams();
  params.append('id_token', idToken);
  params.append('client_id', process.env.LINE_LOGIN_CHANNEL_ID);

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.sub; // LINE user id
}

// Middleware สำหรับ route ฝั่ง LIFF: เช็ค token แล้วแนบ req.lineUserId ให้ route ถัดไปใช้
async function requireLiffAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'missing token' });

  const lineUserId = await verifyIdToken(token);
  if (!lineUserId) return res.status(401).json({ error: 'invalid token' });

  req.lineUserId = lineUserId;
  next();
}

module.exports = { client, middlewareConfig, pushMessage, verifyIdToken, requireLiffAuth };
