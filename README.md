# Cozy Cup Café — เว็บไซต์เชื่อมต่อ LINE OA ตอบคำถามสินค้าและบริการ

**ผู้จัดทำ**
1. นายยืนยง ขานสันเทียะ รหัสนักศึกษา 66034346
2. นายธีรภัทร์ คำยวง รหัสนักศึกษา 66017994
3. นายสุรศักดิ์ กัลยาลักษณ์ รหัสนักศึกษา 66051250

**อาจารย์ประจำวิชา** ดร.สุขสวัสดี ณัฏฐวุฒิสิทธิ์

---

## ภาพรวมระบบ

```
ลูกค้า ──พิมพ์คำถาม──▶ LINE OA ──Webhook──▶ server.js ──▶ lib/bot.js ──อ่าน──▶ data/products.json
                                                │                               ▲
ผู้เข้าชมเว็บ ◀── public/ (หน้าเว็บ) ◀── /api/products ─────────────────────────┘
```

- **ข้อมูลชุดเดียว**: สินค้าทั้งหมดอยู่ใน `data/products.json` ข้อมูลร้านอยู่ใน `data/shop.json`
  หน้าเว็บและบอท LINE อ่านจากไฟล์เดียวกัน → **LINE ตอบราคา/รายละเอียดตรงกับเว็บไซต์เสมอ**
  (แก้ไฟล์แล้วมีผลทันทีทั้งสองช่องทาง ไม่ต้องรีสตาร์ต)
- บอทตอบได้: ชื่อสินค้า/ราคา/รายละเอียด/สถานะสต็อก, ถามหลายสินค้าพร้อมกัน, ตามหมวดหมู่,
  ตามงบประมาณ ("ไม่เกิน 50 บาท"), เมนูทั้งหมด, เมนูแนะนำ, โปรโมชั่น, เวลาเปิด-ปิด, ที่อยู่,
  การจัดส่ง, การชำระเงิน, ผู้จัดทำ
- คำตอบใน LINE เป็นข้อความ + **การ์ดสินค้า (Flex Message)** พร้อมปุ่ม "ดูบนเว็บไซต์" ที่ลิงก์ไปยังสินค้านั้นบนเว็บ
  และมี **Quick Reply** ให้กดถามต่อ
- หน้าเว็บมีส่วน **"ทดลองถามบอท"** ที่ใช้ตรรกะเดียวกับ LINE ไว้สาธิตได้แม้ไม่มีโทรศัพท์

| ไฟล์ | หน้าที่ |
|---|---|
| `server.js` | เว็บเซิร์ฟเวอร์ Express + LINE Webhook (`/webhook`) + API |
| `api/index.js`, `vercel.json` | ตั้งค่าสำหรับ deploy บน Vercel |
| `lib/bot.js` | ตรรกะวิเคราะห์คำถามและสร้างคำตอบ |
| `lib/line-format.js` | แปลงคำตอบเป็น Text / Flex / Quick Reply ของ LINE |
| `data/products.json` | หมวดหมู่และสินค้า/บริการ |
| `data/shop.json` | ข้อมูลร้าน โปรโมชั่น และรายชื่อผู้จัดทำ |
| `public/` | หน้าเว็บไซต์ |
| `test/bot.test.js` | ทดสอบว่าบอทตอบตรงกับข้อมูลสินค้าทุกรายการ |

## 1. รันบนเครื่อง

ต้องมี Node.js 18 ขึ้นไป

```bash
npm install
npm test        # ทดสอบความถูกต้องของคำตอบ (11 ชุดทดสอบ)
npm start       # เปิด http://localhost:3000
```

ถึงยังไม่ตั้งค่า LINE หน้าเว็บและหน้าทดลองแชทก็ใช้งานได้

## 2. สร้าง LINE Official Account + Messaging API

1. เข้า <https://manager.line.biz> สร้าง LINE Official Account
2. ในหน้า OA Manager → **Settings → Messaging API → Enable** แล้วเลือก/สร้าง Provider
3. เข้า <https://developers.line.biz/console> → เลือก Channel ที่สร้าง
   - แท็บ **Basic settings** → คัดลอก **Channel secret**
   - แท็บ **Messaging API** → กด **Issue** ที่ **Channel access token (long-lived)** แล้วคัดลอก
4. คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่า:
   ```
   LINE_CHANNEL_SECRET=...
   LINE_CHANNEL_ACCESS_TOKEN=...
   PUBLIC_URL=https://<โดเมนของเว็บ>
   ```
5. แก้ `lineId` ใน `data/shop.json` เป็น Basic ID ของ OA (เช่น `@123abcde`) เพื่อให้ปุ่ม/QR เพิ่มเพื่อนบนเว็บถูกต้อง
6. ใน OA Manager → **Settings → Response settings**: ปิด **Auto-response** และ **Greeting message**, เปิด **Webhooks**
   (ไม่เช่นนั้น LINE จะตอบข้อความอัตโนมัติซ้อนกับบอท)

## 3. นำเว็บขึ้นออนไลน์ (LINE ต้องการ URL แบบ HTTPS)

**ทางเลือก A — Vercel (ฟรี, แนะนำสำหรับส่งงาน)**
1. โค้ดอยู่บน GitHub: <https://github.com/alifeofbrooklyn/Cozy-Cup-Cafe> (ไฟล์ `.env` ถูก ignore ไว้แล้ว ห้ามอัปโหลด)
2. ที่ <https://vercel.com/new> → **Import** repo นี้ → Framework Preset ปล่อยตามที่ `vercel.json` กำหนด (Other)
3. ใส่ **Environment Variables** ก่อนกด Deploy:
   | Key | Value |
   |---|---|
   | `LINE_CHANNEL_SECRET` | Channel secret |
   | `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token (long-lived) |
   | `PUBLIC_URL` | URL ที่ Vercel ให้ เช่น `https://cozy-cup-cafe.vercel.app` |
   | `NODEJS_HELPERS` | `0` ← **สำคัญ** ไม่ใส่แล้ว LINE Verify จะไม่ผ่าน (ปิดตัวแปลง body อัตโนมัติของ Vercel เพื่อให้ตรวจลายเซ็น LINE ได้) |
4. ถ้าเพิ่ม/แก้ Environment Variables หลัง deploy ต้องกด **Redeploy** จึงจะมีผล
5. บน Vercel แก้ไฟล์ในเซิร์ฟเวอร์ตรง ๆ ไม่ได้ — แก้ `data/products.json` ในเครื่องแล้ว `git push` Vercel จะ deploy ใหม่ให้อัตโนมัติ (~1 นาที)

โครงสร้างสำหรับ Vercel: หน้าเว็บใน `public/` เสิร์ฟผ่าน CDN ส่วน `/api/*`, `/webhook`, `/health`
ถูกส่งไปที่ `api/index.js` (Serverless Function ที่ใช้ Express app ตัวเดียวกับ `server.js`) — ดู `vercel.json`

**ทางเลือก B — ngrok (ทดสอบจากเครื่องตัวเอง)**
```bash
npm start
ngrok http 3000      # ได้ URL เช่น https://xxxx.ngrok-free.app
```
แล้วตั้ง `PUBLIC_URL` ใน `.env` เป็น URL นั้นและรีสตาร์ต `npm start`

**ตั้งค่า Webhook**: LINE Developers Console → แท็บ Messaging API → **Webhook URL** = `https://<โดเมน>/webhook`
→ กด **Verify** (ต้องขึ้น Success) → เปิด **Use webhook**

## 4. ทดสอบ

แอด LINE OA เป็นเพื่อน (สแกน QR ในแท็บ Messaging API) แล้วลองพิมพ์:

| พิมพ์ | ผลที่ได้ |
|---|---|
| `ลาเต้ราคาเท่าไหร่` | รายละเอียดลาเต้ 65 บาท + การ์ดสินค้า |
| `ลาเต้กับครัวซองต์` | 2 รายการ พร้อมราคารวม |
| `ชีสเค้กมีไหม` | แจ้ง "หมดชั่วคราว" ตรงกับหน้าเว็บ |
| `มีขนมอะไรบ้าง` | รายการเบเกอรี่ทั้งหมด |
| `ไม่เกิน 50 บาท` | สินค้าราคา ≤ 50 บาท |
| `เมนูทั้งหมด` / `โปรโมชั่น` / `เวลาเปิด` / `ส่งไหม` | ข้อมูลร้าน |
| `ผู้จัดทำ` | ชื่อสมาชิก รหัสนักศึกษา และอาจารย์ประจำวิชา |

ดู JSON ที่ส่งให้ LINE จริงได้ที่ `/api/line-preview?q=ลาเต้`

## 5. แก้ไขสินค้า

เพิ่ม/แก้รายการใน `data/products.json` (ฟิลด์ `keywords` คือคำที่ลูกค้าอาจพิมพ์ เช่นสะกดหลายแบบ)
แล้วรัน `npm test` เพื่อตรวจว่าทุก keyword ชี้ไปที่สินค้าที่ถูกต้องและไม่ชนกับสินค้าอื่น
