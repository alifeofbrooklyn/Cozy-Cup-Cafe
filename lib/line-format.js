'use strict';
// แปลงคำตอบของบอทให้เป็นรูปแบบข้อความของ LINE Messaging API (Text + Flex Carousel + Quick Reply)
const { priceText, stockText } = require('./bot');

const MAX_BUBBLES = 12; // ข้อจำกัดของ Flex carousel

function productBubble(p, categories, baseUrl) {
  const cat = categories.find((c) => c.id === p.category);
  const bubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: '#F3E6D8', paddingAll: '16px',
      contents: [{ type: 'text', text: p.emoji || '☕', size: '3xl', align: 'center' }],
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        { type: 'text', text: p.name, weight: 'bold', size: 'lg', wrap: true },
        { type: 'text', text: `${p.nameEn || p.name} · ${cat ? cat.name : ''}`, size: 'xs', color: '#8A7A6A', wrap: true },
        { type: 'text', text: priceText(p), size: 'xl', weight: 'bold', color: '#B5562B' },
        { type: 'text', text: p.description || '-', size: 'sm', color: '#555555', wrap: true },
        ...(p.options ? [{ type: 'text', text: `ตัวเลือก: ${p.options}`, size: 'xs', color: '#777777', wrap: true }] : []),
        { type: 'text', text: stockText(p), size: 'sm', weight: 'bold', color: p.inStock ? '#2E7D32' : '#C62828' },
      ],
    },
  };
  if (baseUrl && /^https:\/\//.test(baseUrl)) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [{
        type: 'button', style: 'primary', color: '#6B4226', height: 'sm',
        action: { type: 'uri', label: 'ดูบนเว็บไซต์', uri: `${baseUrl.replace(/\/$/, '')}/#p-${p.id}` },
      }],
    };
  }
  return bubble;
}

function toLineMessages(result, { categories = [], baseUrl = '' } = {}) {
  const messages = [{ type: 'text', text: result.text.slice(0, 5000) }];

  if (result.products && result.products.length) {
    const items = result.products.slice(0, MAX_BUBBLES);
    messages.push({
      type: 'flex',
      altText: `สินค้า: ${items.map((p) => `${p.name} ${priceText(p)}`).join(', ')}`.slice(0, 400),
      contents: { type: 'carousel', contents: items.map((p) => productBubble(p, categories, baseUrl)) },
    });
  }

  if (result.quickReplies && result.quickReplies.length) {
    messages[messages.length - 1].quickReply = {
      items: result.quickReplies.slice(0, 13).map((label) => ({
        type: 'action', action: { type: 'message', label: label.slice(0, 20), text: label },
      })),
    };
  }
  return messages;
}

module.exports = { toLineMessages, productBubble };
