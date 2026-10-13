/* Service worker: เก็บไฟล์แอปทั้งหมดไว้ในเครื่อง เปิดได้แม้ไม่มีเน็ต
   - VERSION และ FILES สร้างโดย npm run build:prototype (tools/build-prototype.js) ห้ามแก้มือ
   - ไฟล์ใน app/ เปลี่ยนเมื่อไร VERSION เปลี่ยน → เบราว์เซอร์โหลดชุดใหม่เบื้องหลังตอนออนไลน์
     หน้าที่เปิดอยู่ใช้ชุดเดิมต่อจนกว่าจะปิดแล้วเปิดใหม่ (ไม่สลับกลางการขาย)
   - ข้อมูลยอดขายอยู่ใน IndexedDB ไม่เกี่ยวกับ cache นี้ อัปเดตแอปแล้วข้อมูลไม่หาย */
const VERSION = '88bc75126c44';
const FILES = ["./","css/pos.css","icons/icon-192.png","icons/icon-512.png","img/acai.jpg","img/banana-choco.jpg","img/greek-yogurt.jpg","img/promptpay.png","img/thai-chuay-thai.png","index.html","js/auth.js","js/backup.js","js/cash.js","js/config.js","js/core.js","js/icons.js","js/pricing.js","js/printer.js","js/promo.js","js/promptpay.js","js/reports.js","js/settings.js","js/store.js","js/ui/builder.js","js/ui/cart.js","js/ui/close-ui.js","js/ui/codepad.js","js/ui/login.js","js/ui/main.js","js/ui/modal.js","js/ui/pay.js","js/ui/print.js","js/ui/promo-ui.js","js/ui/settings-ui.js","js/ui/summary.js","js/vendor/qrcode.js","manifest.webmanifest"];
const CACHE = 'geek-pos-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, {cache: 'reload'}))))   // ข้ามแคช HTTP ให้ได้ไฟล์ล่าสุดจริง
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('geek-pos-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE)
    .then(c => c.match(e.request, {ignoreSearch: true}))
    .then(r => r || fetch(e.request)));
});
