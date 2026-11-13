'use strict';
// ตรรกะการตอบคำถาม ใช้ร่วมกันทั้ง LINE webhook และหน้าทดลองแชทบนเว็บไซต์
const store = require('./store');

const QUICK_REPLIES = ['เมนูทั้งหมด', 'เมนูแนะนำ', 'โปรโมชั่น', 'เวลาเปิด-ปิด', 'ที่อยู่ร้าน', 'ผู้จัดทำ'];

const normalize = (s) =>
  String(s || '').toLowerCase().normalize('NFC').replace(/[\s\-_.,!?'"“”‘’()/:;~*]+/g, '');

const baht = (n) => `${Number(n).toLocaleString('en-US')} บาท`;
const priceText = (p) => `${baht(p.price)}${p.unit ? ` / ${p.unit}` : ''}`;
const stockText = (p) => (p.inStock ? '✅ มีจำหน่าย' : '❌ หมดชั่วคราว');

function productLine(p) {
  return `${p.emoji} ${p.name} — ${priceText(p)}${p.inStock ? '' : ' (หมดชั่วคราว)'}`;
}

function productDetail(p, categories) {
  const cat = categories.find((c) => c.id === p.category);
  return [
    `${p.emoji} ${p.name} (${p.nameEn})`,
    `หมวด: ${cat ? cat.name : '-'}`,
    `ราคา: ${priceText(p)}`,
    `รายละเอียด: ${p.description}`,
    p.options ? `ตัวเลือก: ${p.options}` : null,
    `สถานะ: ${stockText(p)}`,
  ].filter(Boolean).join('\n');
}

// คืนคำที่ยาวที่สุดในรายการที่พบในข้อความ (ใช้เป็นคะแนนความตรง)
function longestHit(q, words) {
  let best = '';
  for (const w of words) {
    const k = normalize(w);
    if (k && q.includes(k) && k.length > best.length) best = k;
  }
  return best;
}

// หาสินค้าที่ผู้ใช้พูดถึง รองรับหลายสินค้าในข้อความเดียว
// และตัดกรณีคำซ้อน เช่น "มัทฉะลาเต้" จะไม่นับ "ลาเต้" ซ้ำ
function matchProducts(q, products) {
  const hits = products
    .map((p) => ({ p, hit: longestHit(q, [p.name, p.nameEn, ...(p.keywords || [])]) }))
    .filter((x) => x.hit);
  return hits
    .filter((x) => !hits.some((y) => y !== x && y.hit.length > x.hit.length && y.hit.includes(x.hit)))
    .map((x) => x.p);
}

const has = (q, words) => words.some((w) => q.includes(normalize(w)));

const INTENTS = {
  team: ['ผู้จัดทำ', 'สมาชิกกลุ่ม', 'สมาชิก', 'อาจารย์', 'รหัสนักศึกษา', 'ใครทำ', 'team'],
  promo: ['โปรโมชั่น', 'โปรโมชัน', 'โปร', 'ส่วนลด', 'ลดราคา', 'สะสมแต้ม', 'promotion', 'promo', 'discount'],
  hours: ['เวลาเปิด', 'เวลาปิด', 'เปิดกี่โมง', 'ปิดกี่โมง', 'เปิดวัน', 'หยุดวัน', 'วันหยุด', 'เปิดไหม', 'เปิดมั้ย', 'เปิดอยู่', 'เวลาทำการ', 'opening', 'hours'],
  location: ['ที่อยู่', 'อยู่ที่ไหน', 'อยู่ไหน', 'ร้านอยู่', 'แผนที่', 'ไปยังไง', 'เดินทาง', 'location', 'address', 'map'],
  contact: ['ติดต่อ', 'เบอร์', 'โทร', 'phone', 'contact'],
  delivery: ['จัดส่ง', 'ส่งไหม', 'ส่งมั้ย', 'ส่งได้', 'ค่าส่ง', 'เดลิเวอรี่', 'เดลิเวอรี', 'delivery', 'lineman', 'grab'],
  payment: ['ชำระ', 'จ่ายเงิน', 'จ่ายยังไง', 'จ่ายได้', 'โอน', 'พร้อมเพย์', 'บัตรเครดิต', 'สแกนจ่าย', 'payment'],
  recommend: ['แนะนำ', 'ขายดี', 'เมนูเด็ด', 'ยอดนิยม', 'recommend', 'bestseller'],
  menu: ['เมนูทั้งหมด', 'สินค้าทั้งหมด', 'ดูสินค้า', 'ดูเมนู', 'มีอะไรบ้าง', 'มีอะไรขาย', 'ขายอะไร', 'รายการสินค้า', 'ราคาทั้งหมด', 'เมนู', 'สินค้า', 'menu'],
  greet: ['สวัสดี', 'หวัดดี', 'hello', 'hi', 'ดีจ้า'],
  help: ['ช่วยเหลือ', 'วิธีใช้', 'ถามอะไรได้', 'help'],
};

const reply = (intent, text, products = []) => ({ intent, text, products, quickReplies: QUICK_REPLIES });

function menuText(categories, products) {
  const blocks = categories.map((c) => {
    const items = products.filter((p) => p.category === c.id).map(productLine);
    return `${c.emoji} ${c.name}\n${items.join('\n')}`;
  });
  return `📋 เมนูและบริการทั้งหมด\n\n${blocks.join('\n\n')}\n\nพิมพ์ชื่อสินค้าเพื่อดูรายละเอียดได้เลยครับ`;
}

/**
 * ตอบคำถามจากข้อความของลูกค้า
 * @returns {{intent:string,text:string,products:object[],quickReplies:string[]}}
 */
function answer(message, data = store.load()) {
  const { shop, categories, products } = data;
  const raw = String(message || '').trim();
  const q = normalize(raw);
  if (!q) return reply('empty', 'พิมพ์ชื่อสินค้าหรือคำถามได้เลยครับ เช่น "ลาเต้ราคาเท่าไหร่"');

  // 1) ผู้จัดทำโครงงาน
  if (has(q, INTENTS.team)) {
    const m = shop.team.members.map((x, i) => `${i + 1}. ${x.name} รหัสนักศึกษา ${x.studentId}`).join('\n');
    return reply('team', `👥 ผู้จัดทำ\n${m}\n\n👩‍🏫 อาจารย์ประจำวิชา\n${shop.team.advisor}`);
  }

  // 2) ถามถึงสินค้า/บริการโดยตรง (ราคา รายละเอียด สถานะ)
  const found = matchProducts(q, products);
  if (found.length === 1) {
    return reply('product', productDetail(found[0], categories), found);
  }
  if (found.length > 1) {
    const total = found.reduce((s, p) => s + p.price, 0);
    return reply('products',
      `พบ ${found.length} รายการ\n${found.map(productLine).join('\n')}\n\nรวม ${baht(total)} (คิดชิ้นละ 1 หน่วย)`, found);
  }

  // 3) ค้นหาตามงบประมาณ เช่น "ไม่เกิน 50 บาท"
  const budget = raw.toLowerCase().match(/(ไม่เกิน|ต่ำกว่า|น้อยกว่า|งบ|under|below|<=?)\s*(\d+)/);
  if (budget) {
    const max = Number(budget[2]);
    const list = products.filter((p) => p.price <= max).sort((a, b) => a.price - b.price);
    return list.length
      ? reply('budget', `💰 สินค้าราคาไม่เกิน ${baht(max)} มี ${list.length} รายการ\n${list.map(productLine).join('\n')}`, list)
      : reply('budget', `ขออภัยครับ ไม่มีสินค้าราคาไม่เกิน ${baht(max)}\nสินค้าราคาเริ่มต้นที่ ${baht(Math.min(...products.map((p) => p.price)))}`);
  }

  // 4) คำถามทั่วไปเกี่ยวกับร้าน
  if (has(q, INTENTS.promo)) {
    return reply('promo', `🎉 โปรโมชั่นตอนนี้\n${shop.promotions.map((p, i) => `${i + 1}. ${p.title}\n   ${p.detail}`).join('\n')}`);
  }
  if (has(q, INTENTS.hours)) return reply('hours', `🕗 เวลาทำการ\n${shop.hours}`);
  if (has(q, INTENTS.location)) return reply('location', `📍 ที่อยู่ร้าน ${shop.nameTh}\n${shop.address}\nแผนที่: ${shop.mapUrl}`);
  if (has(q, INTENTS.contact)) return reply('contact', `📞 ติดต่อร้าน\nโทร: ${shop.phone}\nLINE: ${shop.lineId}\n${shop.hours}`);
  if (has(q, INTENTS.delivery)) return reply('delivery', `🛵 การจัดส่ง\n${shop.delivery}`);
  if (has(q, INTENTS.payment)) return reply('payment', `💳 ช่องทางชำระเงิน\n${shop.payment}`);
  if (has(q, INTENTS.recommend)) {
    const list = products.filter((p) => p.featured && p.inStock);
    return reply('recommend', `⭐ เมนูแนะนำของร้าน\n${list.map(productLine).join('\n')}`, list);
  }

  // 5) ถามตามหมวดหมู่ เช่น "มีชาอะไรบ้าง", "ขนมมีอะไร"
  const cats = categories.filter((c) => has(q, [c.name, ...(c.keywords || [])]));
  if (cats.length) {
    const list = products.filter((p) => cats.some((c) => c.id === p.category));
    const title = cats.map((c) => `${c.emoji} ${c.name}`).join(' / ');
    return reply('category', `${title} มี ${list.length} รายการ\n${list.map(productLine).join('\n')}`, list);
  }

  if (has(q, INTENTS.menu)) return reply('menu', menuText(categories, products));
  if (has(q, INTENTS.greet) || has(q, INTENTS.help)) {
    return reply('greet',
      `สวัสดีครับ ยินดีต้อนรับสู่ ${shop.name} (${shop.nameTh}) ☕\n` +
      'สอบถามได้เลย เช่น\n• "ลาเต้ราคาเท่าไหร่"\n• "มีขนมอะไรบ้าง"\n• "ไม่เกิน 50 บาท มีอะไรบ้าง"\n• "โปรโมชั่น" / "เวลาเปิด"');
  }

  return reply('fallback',
    `ขออภัยครับ ไม่พบสินค้าหรือข้อมูลที่ตรงกับ "${raw}"\n` +
    'ลองพิมพ์ชื่อสินค้า เช่น "ชาไทย" หรือพิมพ์ "เมนูทั้งหมด" เพื่อดูรายการสินค้าทั้งหมด');
}

module.exports = { answer, normalize, matchProducts, priceText, stockText, baht };
