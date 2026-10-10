/* สร้างต้นแบบไฟล์เดียวจาก app/ : npm run build:prototype
   - prototype/pos.html      = app/index.html ที่รวม CSS, JS และรูปไว้ในไฟล์เดียว (เปิดได้เลย ไม่ต้องมีโฟลเดอร์ app)
   - prototype/pos-demo.html = เหมือน pos.html + ข้อมูลตัวอย่าง (prototype/demo-seed.js) เก็บแยก key */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'app'), OUT = path.join(ROOT, 'prototype');
const read = f => fs.readFileSync(f, 'utf8');

let html = read(path.join(APP, 'index.html'));
const once = (s, a, b) => { if(s.split(a).length !== 2) throw new Error('ต้องเจอพอดี 1 ครั้ง: ' + a); return s.replace(a, () => b); };

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${read(path.join(APP, f))}</style>`);
html = html.replace(/<!--.*?-->\n/g, '');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
  const js = read(path.join(APP, f)).replace(/'(img\/[^']+\.jpg)'/g, (_, img) =>
    `'data:image/jpeg;base64,${fs.readFileSync(path.join(APP, img)).toString('base64')}'`);
  return `<script>\n/* ===== ${f} ===== */\n${js}</script>`;
});
fs.writeFileSync(path.join(OUT, 'pos.html'), html);

let demo = html;
for(const [a, b] of [
  ["const KEY = 'geek_popup_sales_v2';", "const KEY = 'geek_popup_sales_DEMO2';"],
  ['autoPrint: true,', 'autoPrint: false,'],
  ['<h1>Geek <span>Pop-up</span> POS</h1>', '<h1>Geek <span>Pop-up</span> POS · DEMO</h1>'],
  ['<title>Geek Pop-up POS</title>', '<title>Geek Pop-up POS (DEMO)</title>'],
  ['<button class="hbtn" id="btnSummary">', '<button class="hbtn" id="btnReseed" style="margin-right:6px">🔄 ข้อมูลตัวอย่างใหม่</button>\n  <button class="hbtn" id="btnSummary">'],
  ['<script>\n/* ===== js/ui/main.js', `<script>\n/* ===== demo-seed.js ===== */\n${read(path.join(OUT, 'demo-seed.js'))}</script>\n<script>\n/* ===== js/ui/main.js`],
]) demo = once(demo, a, b);
fs.writeFileSync(path.join(OUT, 'pos-demo.html'), demo);

const kb = s => Math.round(Buffer.byteLength(s) / 1024);
console.log(`built pos.html ${kb(html)} KB / pos-demo.html ${kb(demo)} KB`);
