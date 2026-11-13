'use strict';
// ทดสอบว่าบอทตอบข้อมูลสินค้าตรงกับข้อมูลบนเว็บไซต์ (data/products.json) ทุกรายการ
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../lib/store');
const { answer, baht } = require('../lib/bot');
const { toLineMessages } = require('../lib/line-format');

const data = store.load();
const ask = (q) => answer(q, data);

test('ถามชื่อสินค้าทุกรายการ บอทตอบสินค้าถูกตัว ราคาและสถานะตรงกับเว็บไซต์', () => {
  for (const p of data.products) {
    for (const q of [p.name, `${p.name}ราคาเท่าไหร่`, `ขอดู ${p.nameEn} หน่อย`]) {
      const r = ask(q);
      assert.equal(r.intent, 'product', `"${q}" ควรเป็นคำถามสินค้า`);
      assert.deepEqual(r.products.map((x) => x.id), [p.id], `"${q}" ควรได้ ${p.id}`);
      assert.ok(r.text.includes(baht(p.price)), `"${q}" ควรมีราคา ${p.price}`);
      assert.ok(r.text.includes(p.inStock ? 'มีจำหน่าย' : 'หมดชั่วคราว'), `"${q}" สถานะสต็อกไม่ตรง`);
    }
  }
});

test('ทุก keyword ของสินค้าชี้ไปที่สินค้านั้นเท่านั้น', () => {
  for (const p of data.products) {
    for (const k of p.keywords) {
      assert.deepEqual(ask(k).products.map((x) => x.id), [p.id], `keyword "${k}"`);
    }
  }
});

test('แยก "มัทฉะลาเต้" กับ "ลาเต้" ได้ถูกต้อง', () => {
  assert.deepEqual(ask('มัทฉะลาเต้ เย็น 1 แก้ว').products.map((p) => p.id), ['matcha-latte']);
  assert.deepEqual(ask('ลาเต้ร้อน').products.map((p) => p.id), ['latte']);
});

test('ถามหลายสินค้าในข้อความเดียว', () => {
  const r = ask('ลาเต้กับครัวซองต์ราคาเท่าไหร่');
  assert.deepEqual(r.products.map((p) => p.id).sort(), ['croissant', 'latte']);
  assert.ok(r.text.includes(baht(65 + 55)));
});

test('สินค้าหมดแจ้งสถานะถูกต้อง', () => {
  const r = ask('ชีสเค้กมีไหม');
  assert.equal(r.products[0].inStock, false);
  assert.match(r.text, /หมดชั่วคราว/);
});

test('ค้นหาตามหมวดหมู่', () => {
  const r = ask('มีขนมอะไรบ้าง');
  assert.equal(r.intent, 'category');
  const expected = data.products.filter((p) => p.category === 'bakery').map((p) => p.id);
  assert.deepEqual(r.products.map((p) => p.id), expected);
});

test('ค้นหาตามงบประมาณ', () => {
  const r = ask('ไม่เกิน 50 บาท มีอะไรบ้าง');
  assert.equal(r.intent, 'budget');
  assert.ok(r.products.length > 0);
  assert.ok(r.products.every((p) => p.price <= 50));
  assert.equal(r.products.length, data.products.filter((p) => p.price <= 50).length);
});

test('คำถามเกี่ยวกับร้าน', () => {
  assert.equal(ask('ร้านเปิดกี่โมง').intent, 'hours');
  assert.equal(ask('ร้านอยู่ที่ไหน').intent, 'location');
  assert.equal(ask('มีโปรอะไรบ้าง').intent, 'promo');
  assert.equal(ask('ส่งไหมครับ').intent, 'delivery');
  assert.equal(ask('จ่ายด้วยพร้อมเพย์ได้ไหม').intent, 'payment');
  assert.equal(ask('เมนูแนะนำ').intent, 'recommend');
  assert.equal(ask('เมนูทั้งหมด').intent, 'menu');
  assert.equal(ask('สวัสดีครับ').intent, 'greet');
  assert.equal(ask('asdfgh').intent, 'fallback');
});

test('เมนูทั้งหมดแสดงทุกสินค้าพร้อมราคาที่ถูกต้อง', () => {
  const r = ask('เมนูทั้งหมด');
  for (const p of data.products) assert.ok(r.text.includes(`${p.name} — ${baht(p.price)}`), p.id);
});

test('ผู้จัดทำแสดงชื่อสมาชิก รหัสนักศึกษา และอาจารย์ประจำวิชา', () => {
  const r = ask('ผู้จัดทำ');
  for (const m of data.shop.team.members) {
    assert.ok(r.text.includes(m.name));
    assert.ok(r.text.includes(m.studentId));
  }
  assert.ok(r.text.includes('ดร.สุขสวัสดี ณัฏฐวุฒิสิทธิ์'));
});

test('ข้อความที่ส่งเข้า LINE อยู่ในข้อจำกัดของ Messaging API', () => {
  for (const q of ['เมนูทั้งหมด', 'ลาเต้', 'ไม่เกิน 1000', 'มีขนมอะไรบ้าง', 'ผู้จัดทำ']) {
    const msgs = toLineMessages(ask(q), { categories: data.categories, baseUrl: 'https://example.com' });
    assert.ok(msgs.length >= 1 && msgs.length <= 5);
    for (const m of msgs) {
      if (m.type === 'text') assert.ok(m.text.length > 0 && m.text.length <= 5000);
      if (m.type === 'flex') {
        assert.ok(m.altText.length <= 400);
        assert.ok(m.contents.contents.length <= 12);
        for (const b of m.contents.contents) {
          assert.equal(b.footer.contents[0].action.uri.startsWith('https://example.com/#p-'), true);
          assert.ok(b.footer.contents[0].action.label.length <= 20);
        }
      }
    }
    const qr = msgs[msgs.length - 1].quickReply.items;
    assert.ok(qr.length <= 13 && qr.every((i) => i.action.label.length <= 20));
  }
});
