'use strict';
// อ่านข้อมูลจากไฟล์ JSON ทุกครั้งที่เรียก เพื่อให้เว็บไซต์และ LINE ใช้ข้อมูลชุดเดียวกันเสมอ
// (แก้ไข data/products.json แล้วมีผลทันทีทั้งสองช่องทาง ไม่ต้องรีสตาร์ต)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

function load() {
  const { categories, products } = read('products.json');
  return { shop: read('shop.json'), categories, products };
}

module.exports = { load };
