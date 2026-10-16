/* สร้างต้นแบบไฟล์เดียวจาก app/ : npm run build:prototype
   - prototype/pos.html      = app/index.html ที่รวม CSS, JS และรูปไว้ในไฟล์เดียว (เปิดได้เลย ไม่ต้องมีโฟลเดอร์ app)
   - prototype/pos-demo.html = เหมือน pos.html + ข้อมูลตัวอย่าง (prototype/demo-seed.js) เก็บแยก key */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'app'), OUT = path.join(ROOT, 'prototype');
const read = f => fs.readFileSync(f, 'utf8');

let html = read(path.join(APP, 'index.html'));
const once = (s, a, b) => { if(s.split(a).length !== 2) throw new Error('ต้องเจอพอดี 1 ครั้ง: ' + a); return s.replace(a, () => b); };

/* app/sw.js: รายการไฟล์ทั้งหมดใน app/ + VERSION จาก hash เนื้อหา (ไฟล์เปลี่ยน → แท็บเล็ตโหลดชุดใหม่)
   app/js/version.js: VERSION เดียวกัน + วันเวลา build ให้หน้าตั้งค่าแสดง (เช็กว่าแท็บเล็ตอัปเดตแล้วหรือยัง)
   ไม่นับ version.js ใน hash (ไม่งั้นวนไม่จบ) · เขียนวันที่ใหม่เฉพาะตอน VERSION เปลี่ยน build ซ้ำแล้วไฟล์ไม่เปลี่ยน */
const VER_FILE = 'js/version.js', verPath = path.join(APP, VER_FILE);
const appFiles = (dir, pre = '') => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e =>
  e.isDirectory() ? appFiles(path.join(dir, e.name), pre + e.name + '/') : [pre + e.name]).sort();
const hash = crypto.createHash('sha256');
appFiles(APP).filter(f => f !== 'sw.js' && f !== VER_FILE && !f.endsWith('.svg') && !f.startsWith('.'))
  .forEach(f => hash.update(f + '\0').update(fs.readFileSync(path.join(APP, f))));
const VERSION = hash.digest('hex').slice(0, 12);
const oldVer = fs.existsSync(verPath) ? read(verPath) : '';
if(!oldVer.includes(`v:'${VERSION}'`)) fs.writeFileSync(verPath,
  `/* สร้างโดย npm run build:prototype ห้ามแก้มือ · VERSION ตรงกับ app/sw.js · built = เวลาที่ build เวอร์ชันนี้ */\nconst APP_VERSION = {v:'${VERSION}', built:'${new Date().toISOString()}'};\n`);
const swFiles = appFiles(APP).filter(f => f !== 'sw.js' && !f.endsWith('.svg') && !f.startsWith('.'));
const swPath = path.join(APP, 'sw.js'), sw = read(swPath);
const sw2 = sw.replace(/^const VERSION = .*$/m, `const VERSION = '${VERSION}';`)
  .replace(/^const FILES = .*$/m, `const FILES = ${JSON.stringify(['./', ...swFiles])};`);
if(sw2 !== sw) fs.writeFileSync(swPath, sw2);

html = html.replace(/<link rel="(manifest|icon|preload)"[^>]*>\n/g, '');   // ต้นแบบไฟล์เดียวไม่ใช่ PWA · preload ฟอนต์ใช้ไม่ได้บน file://
/* ฟอนต์ใน CSS → base64 ในไฟล์ (file:// โหลดไฟล์ฟอนต์ข้างๆ ไม่ได้) */
const inlineFonts = (css, from) => css.replace(/url\(([^)]+\.woff2)\)/g, (_, f) =>
  `url(data:font/woff2;base64,${fs.readFileSync(path.join(path.dirname(from), f)).toString('base64')})`);
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${inlineFonts(read(path.join(APP, f)), path.join(APP, f))}</style>`);
html = html.replace(/<!--.*?-->\n/g, '');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
  const js = read(path.join(APP, f)).replace(/'(img\/[^']+\.(jpg|png))'/g, (_, img, ext) =>
    `'data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(APP, img)).toString('base64')}'`);
  return `<script>\n/* ===== ${f} ===== */\n${js}</script>`;
});
fs.writeFileSync(path.join(OUT, 'pos.html'), html);

let demo = html;
for(const [a, b] of [
  ["const KEY = 'geek_popup_sales_v2';", "const KEY = 'geek_popup_sales_DEMO2';"],
  ["const SETTINGS_KEY = 'geek_popup_settings';", "const SETTINGS_KEY = 'geek_popup_settings_DEMO';"],
  ['<h1>Geek <span>Pop-up</span> POS</h1>', '<h1>Geek <span>Pop-up</span> POS · DEMO</h1>'],
  ['<title>Geek Pop-up POS</title>', '<title>Geek Pop-up POS (DEMO)</title>'],
  ['<button class="hbtn" id="btnSummary">', '<button class="hbtn" id="btnReseed" style="margin-right:6px">ข้อมูลตัวอย่างใหม่</button>\n  <button class="hbtn" id="btnSummary">'],
  ['<script>\n/* ===== js/ui/main.js', `<script>\n/* ===== demo-seed.js ===== */\n${read(path.join(OUT, 'demo-seed.js'))}</script>\n<script>\n/* ===== js/ui/main.js`],
]) demo = once(demo, a, b);
fs.writeFileSync(path.join(OUT, 'pos-demo.html'), demo);

const kb = s => Math.round(Buffer.byteLength(s) / 1024);
console.log(`built pos.html ${kb(html)} KB / pos-demo.html ${kb(demo)} KB`);
