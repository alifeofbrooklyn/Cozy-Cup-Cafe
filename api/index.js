// จุดเข้าใช้งานบน Vercel: ทุกคำขอ /api/*, /webhook, /health ถูกส่งมาที่ Express app ตัวเดียวกับที่รันบนเครื่อง
module.exports = require('../server');
