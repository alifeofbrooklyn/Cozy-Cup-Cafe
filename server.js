'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const line = require('@line/bot-sdk');
const store = require('./lib/store');
const { answer } = require('./lib/bot');
const { toLineMessages } = require('./lib/line-format');

const app = express();
const PORT = process.env.PORT || 3000;
const { LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, PUBLIC_URL } = process.env;
const lineEnabled = Boolean(LINE_CHANNEL_SECRET && LINE_CHANNEL_ACCESS_TOKEN);

// หา URL สาธารณะของเว็บ เพื่อใส่ปุ่ม "ดูบนเว็บไซต์" ในการ์ดสินค้า
function baseUrlOf(req) {
  if (PUBLIC_URL) return PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

// ---------- LINE Webhook ----------
// ต้องประกาศก่อน express.json() เพราะ middleware ของ LINE ต้องใช้ raw body ตรวจลายเซ็น
if (lineEnabled) {
  const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN });

  async function handleEvent(event, baseUrl) {
    if (!event.replyToken) return;
    let result;
    if (event.type === 'follow') {
      result = answer('สวัสดี');
    } else if (event.type === 'message' && event.message.type === 'text') {
      result = answer(event.message.text);
    } else if (event.type === 'message') {
      result = answer('สวัสดี');
      result.text = 'ขออภัยครับ ตอนนี้บอทรองรับเฉพาะข้อความตัวอักษร\n\n' + result.text;
    } else {
      return;
    }
    const { categories } = store.load();
    console.log(`[LINE] ${event.type} "${event.message?.text ?? ''}" -> ${result.intent}`);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: toLineMessages(result, { categories, baseUrl }),
    });
  }

  app.post('/webhook', line.middleware({ channelSecret: LINE_CHANNEL_SECRET }), async (req, res) => {
    try {
      const baseUrl = baseUrlOf(req);
      await Promise.all(req.body.events.map((ev) => handleEvent(ev, baseUrl)));
      res.sendStatus(200);
    } catch (err) {
      console.error('[LINE] error:', err.body || err.message || err);
      res.sendStatus(500);
    }
  });
} else {
  app.post('/webhook', (_req, res) =>
    res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN ในไฟล์ .env' }));
}

// ---------- Website API ----------
app.use(express.json());

app.get('/api/shop', (_req, res) => {
  const { shop } = store.load();
  res.json({ ...shop, lineEnabled });
});

app.get('/api/products', (_req, res) => {
  const { categories, products } = store.load();
  res.json({ categories, products });
});

// หน้าเว็บใช้ endpoint นี้ทดลองถามบอท (ตรรกะเดียวกับที่ตอบใน LINE)
app.post('/api/ask', (req, res) => {
  const message = String(req.body?.message || '').slice(0, 500);
  res.json(answer(message));
});

// ดูตัวอย่าง JSON ที่จะส่งเข้า LINE จริง (ใช้ตรวจสอบ/สาธิต)
app.get('/api/line-preview', (req, res) => {
  const { categories } = store.load();
  const result = answer(String(req.query.q || ''));
  res.json(toLineMessages(result, { categories, baseUrl: baseUrlOf(req) }));
});

app.get('/health', (_req, res) => res.json({ ok: true, lineEnabled }));

app.use(express.static(path.join(__dirname, 'public')));

// ลายเซ็น LINE ไม่ถูกต้อง (คำขอไม่ได้มาจาก LINE จริง)
app.use((err, _req, res, next) => {
  if (err instanceof line.SignatureValidationFailed) return res.status(401).send(err.signature ? 'invalid signature' : 'missing signature');
  if (err instanceof line.JSONParseError) return res.status(400).send('invalid body');
  next(err);
});

// รันบนเครื่อง: node server.js | บน Vercel: api/index.js นำ app ไปใช้เป็น Serverless Function
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌐 Website: http://localhost:${PORT}`);
    console.log(lineEnabled
      ? `🤖 LINE webhook พร้อมใช้งานที่ ${PUBLIC_URL || '<PUBLIC_URL>'}/webhook`
      : '⚠️  ยังไม่ได้ตั้งค่า LINE (ดู .env.example) — เว็บไซต์และหน้าทดลองแชทใช้งานได้ตามปกติ');
  });
}

module.exports = app;
