'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = (n) => `${Number(n).toLocaleString('en-US')} บาท`;

let categories = [];
let products = [];
let activeCat = 'all';

async function init() {
  const [shop, catalog] = await Promise.all([
    fetch('/api/shop').then((r) => r.json()),
    fetch('/api/products').then((r) => r.json()),
  ]);
  categories = catalog.categories;
  products = catalog.products;
  renderShop(shop);
  renderFilters();
  renderGrid();
  highlightFromHash();
  ask('สวัสดี', { silentUser: true });
}

function renderShop(shop) {
  document.title = `${shop.name} — สั่งและสอบถามผ่าน LINE`;
  $('#brand-name').textContent = shop.name;
  $('#footer-name').textContent = shop.name;
  $('#chat-title').textContent = shop.name;
  $('#shop-name-th').textContent = `${shop.name} · ${shop.nameTh}`;
  $('#shop-tagline').textContent = shop.tagline;
  $('#shop-hours').textContent = shop.hours;
  $('#shop-address').innerHTML = `${esc(shop.address)}<br><a href="${esc(shop.mapUrl)}" target="_blank" rel="noopener">เปิดแผนที่</a>`;
  $('#shop-contact').textContent = `โทร ${shop.phone} · LINE ${shop.lineId}`;
  $('#promo-list').innerHTML = shop.promotions.map((p) => `<div class="promo"><b>${esc(p.title)}</b><span>${esc(p.detail)}</span></div>`).join('');

  const addUrl = `https://line.me/R/ti/p/${encodeURIComponent(shop.lineId)}`;
  $('#add-friend').href = addUrl;
  $('#add-friend-2').href = addUrl;
  $('#line-id').textContent = shop.lineId;
  if (window.QRCode) new QRCode($('#qr'), { text: addUrl, width: 180, height: 180, colorDark: '#2b2018' });

  $('#members').innerHTML = shop.team.members.map((m) =>
    `<div class="member"><div class="icon">🎓</div><b>${esc(m.name)}</b><span class="muted">รหัสนักศึกษา ${esc(m.studentId)}</span></div>`).join('');
  $('#advisor').textContent = shop.team.advisor;
  $('#year').textContent = new Date().getFullYear() + 543;
}

function renderFilters() {
  const all = [{ id: 'all', name: 'ทั้งหมด', emoji: '🗂️' }, ...categories];
  $('#filters').innerHTML = all.map((c) =>
    `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${c.id === activeCat}">${c.emoji} ${esc(c.name)}</button>`).join('');
}

function productCard(p) {
  const cat = categories.find((c) => c.id === p.category);
  return `<article class="card${p.inStock ? '' : ' out'}" id="p-${p.id}">
    <div class="art">${p.emoji}${p.featured ? '<span class="badge">แนะนำ</span>' : ''}</div>
    <div class="body">
      <h3>${esc(p.name)}</h3>
      <span class="en">${esc(p.nameEn)} · ${esc(cat ? cat.name : '')}</span>
      <span class="price">${baht(p.price)}<small> / ${esc(p.unit)}</small></span>
      <p class="desc">${esc(p.description)}</p>
      ${p.options ? `<p class="opt">ตัวเลือก: ${esc(p.options)}</p>` : ''}
      <span class="stock ${p.inStock ? 'ok' : 'bad'}">${p.inStock ? '✅ มีจำหน่าย' : '❌ หมดชั่วคราว'}</span>
    </div>
  </article>`;
}

function renderGrid() {
  const term = $('#search').value.trim().toLowerCase();
  const list = products.filter((p) =>
    (activeCat === 'all' || p.category === activeCat) &&
    (!term || [p.name, p.nameEn, p.description, ...(p.keywords || [])].join(' ').toLowerCase().includes(term)));
  $('#grid').innerHTML = list.map(productCard).join('');
  $('#empty').hidden = list.length > 0;
}

function highlightFromHash() {
  const m = location.hash.match(/^#p-(.+)$/);
  if (!m) return;
  activeCat = 'all'; $('#search').value = ''; renderFilters(); renderGrid();
  const el = document.getElementById(`p-${m[1]}`);
  if (el) { el.classList.add('highlight'); el.scrollIntoView({ block: 'center' }); }
}

// ---------- แชทจำลอง LINE ----------
function addMsg(who, html) {
  const box = $('#messages');
  box.insertAdjacentHTML('beforeend', html.startsWith('<div class="carousel') ? html : `<div class="msg ${who}">${html}</div>`);
  box.scrollTop = box.scrollHeight;
}

function miniCard(p) {
  return `<div class="mini"><div class="art">${p.emoji}</div><div class="b">
    <b>${esc(p.name)}</b><span class="price">${baht(p.price)} / ${esc(p.unit)}</span><br>
    <span class="stock ${p.inStock ? 'ok' : 'bad'}">${p.inStock ? '✅ มีจำหน่าย' : '❌ หมดชั่วคราว'}</span>
    <a href="#p-${p.id}">ดูบนเว็บไซต์</a></div></div>`;
}

async function ask(text, { silentUser = false } = {}) {
  if (!silentUser) addMsg('user', esc(text));
  try {
    const res = await fetch('/api/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }),
    }).then((r) => r.json());
    addMsg('bot', esc(res.text));
    if (res.products.length) addMsg('bot', `<div class="carousel">${res.products.slice(0, 12).map(miniCard).join('')}</div>`);
    $('#quick').innerHTML = res.quickReplies.map((q) => `<button type="button">${esc(q)}</button>`).join('');
  } catch {
    addMsg('bot', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
  }
}

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  activeCat = b.dataset.cat; renderFilters(); renderGrid();
});
$('#search').addEventListener('input', renderGrid);
$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#chat-input').value.trim(); if (!v) return;
  $('#chat-input').value = ''; ask(v);
});
$('#quick').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') ask(e.target.textContent); });
window.addEventListener('hashchange', highlightFromHash);

init();
