// screenshot ชุดตรวจ UI (Tee 2026-10-17 งานจัดระเบียบ UI) · 4 จอ × หน้าหลัก → docs/qa/screens/<วันที่>/ui/<tag>/
// รัน: node tests/qa/ui-shots.js <tag> (เช่น before / after / r2-after)  (ใช้ prototype/pos-demo.html ต้อง build ก่อน)
// ไม่ใช่เทสต์ (ไม่มีผ่าน/ไม่ผ่าน) ไว้เทียบก่อน/หลังด้วยตา
const {chromium, webkit} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');
const tag = process.argv[2] || 'after';
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const OUT = path.join(ROOT, 'docs/qa/screens', today, 'ui', tag); fs.mkdirSync(OUT, {recursive:true});
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json'};
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const safari = await webkit.launch().catch(() => browser);
  const SCREENS = [['landscape', {width:1280, height:800}, browser], ['portrait', {width:800, height:1280}, browser],
    ['ipad-landscape', {width:1180, height:820}, safari], ['ipad-portrait', {width:820, height:1180}, safari]];
  const enter = async (page, code) => { for(const c of code) await page.click(`[data-kp="${c}"]`); await page.click('#lgGo'); };
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:!label.startsWith('ipad'), reducedMotion:'reduce', deviceScaleFactor:1});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage();
    const shot = (n, o = {}) => page.screenshot({path:path.join(OUT, `${label}-${n}.png`), ...o});
    const closeX = () => page.click('#closeX');
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]');
    await enter(page, '1234'); if(await page.$('#floatSkip')) await page.click('#floatSkip');
    await page.evaluate(() => document.fonts.ready);
    // 1 Greek เลือกขนาดแล้ว
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]'); await page.click('[data-pick="Banana"]');
    await page.evaluate(() => scrollTo(0, 0)); await shot('1-greek');
    // 2 Acai + ปุ่มเพิ่มท็อปปิ้ง · หน้าต่างเพิ่มท็อปปิ้ง
    await page.click('[data-menu="acai"]'); await page.evaluate(() => scrollTo(0, 0)); await shot('2-acai');
    await page.click('[data-addopen]'); await shot('2b-acai-adds'); await page.click('#addsDone');
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd');
    await page.click('[data-menu="acai"]'); await page.click('[data-honey="normal"]'); await page.click('#btnAdd');
    // 4 โปรโมชัน
    if(await page.isVisible('#cartMini')) await page.click('#cartMini');
    await page.click('#promoOpen'); const p = await page.$('.popt:not([disabled])'); if(p) await p.click();
    await shot('4-promo'); await page.click('#promoCancel').catch(() => closeX());
    // 3 ชำระเงิน
    if(await page.isVisible('#cartMini')) await page.click('#cartMini');
    await page.click(await page.isVisible('#btnPay') ? '#btnPay' : '#btnPay2');
    await page.click('[data-dine="takeaway"]'); await page.click('[data-method="cash"]'); await shot('3-pay');
    await page.click('[data-q="1000"]'); await shot('3a-pay-cash');
    await page.evaluate(() => { saveSettings({...SETTINGS, promptpay:'0812345678'}); renderPay(); });   // เลขสมมติ
    await page.click('[data-method="promptpay"]'); await shot('3b-pay-promptpay');
    await page.click('[data-method="tcp"]'); await shot('3c-pay-tcp');
    await page.click('#payCancel');
    // หน้าต่างยืนยัน: ล้างออเดอร์
    if(await page.isVisible('#cartMini')) await page.click('#cartMini');
    await page.click('#btnClear'); await shot('8-confirm-clear'); await page.click('#cfNo');
    // 5 ตั้งค่า · 6 สินค้าหมด
    await page.click('#btnSettings'); await shot('5-settings');
    if(await page.$('#stockOpen')){ await page.click('#stockOpen'); await shot('6-stock'); }
    else { await page.evaluate(() => { const b = document.querySelector('#modal .mbody'); b.scrollTop = 0; }); await shot('6-stock'); }
    await closeX();
    // 7 สรุปยอด เลื่อนลงแล้ว
    await page.click('#btnSummary'); await page.evaluate(() => { const b = document.querySelector('#modal .mbody'); b.scrollTop = b.scrollHeight; });
    await shot('7-summary-scrolled');
    // หน้าต่างยืนยัน: ยกเลิกบิล · ออกจากระบบ
    await page.evaluate(() => { document.querySelector('#modal .mbody').scrollTop = 0; });
    await page.click('[data-tab="bills"]'); await page.click('[data-v]'); await shot('9-confirm-void'); await page.click('#cfNo'); await closeX();
    await page.click('#btnUser'); await shot('10-confirm-logout'); await page.click('#cfNo');
    await ctx.close();
    console.log('shots', label);
  }
  await browser.close(); if(safari !== browser) await safari.close(); server.close();
  console.log('→', path.relative(ROOT, OUT));
})().catch(e => { console.error(e); process.exit(1); });
