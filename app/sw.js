/* Service worker: เก็บไฟล์แอปทั้งหมดไว้ในเครื่อง เปิดได้แม้ไม่มีเน็ต
   - VERSION และ FILES สร้างโดย npm run build:prototype (tools/build-prototype.js) ห้ามแก้มือ
   - ไฟล์ใน app/ เปลี่ยนเมื่อไร VERSION เปลี่ยน → เบราว์เซอร์โหลดชุดใหม่เบื้องหลังตอนออนไลน์
     หน้าที่เปิดอยู่ใช้ชุดเดิมต่อจนกว่าจะปิดแล้วเปิดใหม่ (ไม่สลับกลางการขาย)
   - ข้อมูลยอดขายอยู่ใน IndexedDB ไม่เกี่ยวกับ cache นี้ อัปเดตแอปแล้วข้อมูลไม่หาย */
const VERSION = '905b5cde8714';
const FILES = ["./","css/pos.css","icons/icon-192.png","icons/icon-512.png","img/acai.jpg","img/banana-choco.jpg","img/greek-yogurt.jpg","index.html","js/config.js","js/core.js","js/pricing.js","js/printer.js","js/reports.js","js/store.js","js/ui/builder.js","js/ui/cart.js","js/ui/main.js","js/ui/modal.js","js/ui/pay.js","js/ui/print.js","js/ui/summary.js","manifest.webmanifest"];
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
