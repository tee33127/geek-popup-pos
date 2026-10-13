// QA ผ่านเบราว์เซอร์จริง (Playwright): UI01 UI02 C06 E01 Z08 D03 UI08 X02(จอ)
// จอ: Redmi Pad 2 (Chromium 1280×800 / 800×1280) + iPad (WebKit แบบ Safari 1180×820 / 820×1180 · ไม่มี WebKit ใช้ Chromium แทน)
// ติดตั้ง WebKit ครั้งแรก: npx playwright install webkit
// รัน: npm run qa:e2e · ไม่อยู่ใน npm test (ช้า) · screenshot → docs/qa/screens/YYYY-MM-DD/
const {chromium, webkit} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const {eq, done} = require('./qa-helper');
const ROOT = path.join(__dirname, '../..');
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const SHOTS = path.join(ROOT, 'docs/qa/screens', today); fs.mkdirSync(SHOTS, {recursive:true});
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.json':'application/json'};
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const safari = await webkit.launch().catch(() => { console.log('INFO ไม่มี WebKit (npx playwright install webkit) · จอ iPad ใช้ Chromium แทน'); return browser; });
  /* จอที่ตรวจ: [ชื่อ, ขนาด, เบราว์เซอร์] */
  const SCREENS = [['landscape', {width:1280, height:800}, browser], ['portrait', {width:800, height:1280}, browser],
    ['ipad-landscape', {width:1180, height:820}, safari], ['ipad-portrait', {width:820, height:1180}, safari]];
  const LABELS = SCREENS.map(x => x[0]);
  const consoleErrors = [];
  const watch = (page, tag) => { page.on('pageerror', e => consoleErrors.push(`${tag}: ${e.message}`)); page.on('console', m => { if(m.type() === 'error') consoleErrors.push(`${tag}: ${m.text()}`); }); };
  const enter = async (page, code) => { for(const c of code) await page.click(`[data-kp="${c}"]`); await page.click('#lgGo'); };
  const skipFloat = async page => { if(await page.$('#floatSkip')) await page.click('#floatSkip'); };

  // ---------- UI01 / UI02 สองทิศทางจอ ----------
  const small = new Map();
  const layouts = {};
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:true, deviceScaleFactor: label.startsWith('ipad') ? 2 : 1.5});
    await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    const page = await ctx.newPage(); watch(page, label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]');
    await page.screenshot({path:path.join(SHOTS, `${label}-01-login.png`)});
    await enter(page, '1111'); await skipFloat(page);
    const check = async name => {
      const r = await page.evaluate(() => {
        const W = innerWidth, H = innerHeight, vis = el => { const s = getComputedStyle(el), b = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
        const btns = [...document.querySelectorAll('button')].filter(vis);
        const label = b => (b.getAttribute('aria-label') || b.textContent || b.id || b.className).replace(/\s+/g, ' ').trim().slice(0, 30);
        const payVis = ['btnPay', 'btnPay2'].some(id => { const e = document.getElementById(id); if(!e || !vis(e)) return false; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= H && b.left >= 0 && b.right <= W; });
        return {hscroll: document.documentElement.scrollWidth > W + 1, offscreen: btns.filter(b => { const x = b.getBoundingClientRect(); return x.right > W + 1 || x.left < -1; }).map(label),
          payVis, small: btns.map(b => { const x = b.getBoundingClientRect(); return {l:label(b), w:Math.round(x.width), h:Math.round(x.height), cls:b.className}; }).filter(x => x.w < 48 || x.h < 48)};
      });
      r.small.forEach(s => { const k = `${s.l} (${s.cls || '-'})`; const cur = small.get(k); if(!cur || s.h * s.w < cur.h * cur.w) small.set(k, {...s, where:`${label}/${name}`}); });
      return r;
    };
    const L = {};
    L.home = await check('home'); await page.screenshot({path:path.join(SHOTS, `${label}-02-home.png`)});
    await page.click('[data-menu="acai"]'); await page.click('[data-swap="0"]'); await page.click('[data-addopen]');
    L.acai = await check('acai'); await page.screenshot({path:path.join(SHOTS, `${label}-03-acai.png`), fullPage:true});
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd');
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]'); for(const t of ['Banana', 'Mango', 'Kiwi', 'Granola']) await page.click(`[data-pick="${t}"]`);
    L.greek = await check('greek'); await page.screenshot({path:path.join(SHOTS, `${label}-04-greek.png`), fullPage:true});
    await page.click('[data-honey="lots"]'); await page.click('[data-noteopen]');
    await page.fill('#note', 'ลูกค้าแพ้ถั่วลิสงขอไม่ใส่เนยถั่วและช็อกโกแลตชิพ '.repeat(10) + '😀👍🏽 ฮ่าาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาา่');   // X02 หมายเหตุยาว
    await page.click('#btnAdd');
    L.cart = await check('cart'); await page.screenshot({path:path.join(SHOTS, `${label}-05-cart.png`), fullPage:true});
    await page.click(await page.isVisible('#btnPay') ? '#btnPay' : '#btnPay2');
    await page.click('[data-dine="takeaway"]'); await page.click('[data-method="cash"]');
    L.pay = await check('pay'); await page.screenshot({path:path.join(SHOTS, `${label}-06-pay.png`)});
    await page.click('#payCancel');
    await page.click('#btnSummary'); L.summary = await check('summary'); await page.screenshot({path:path.join(SHOTS, `${label}-07-summary.png`)});
    await page.click('[data-tab="bills"]'); await page.click('[data-v]');   // พนักงานกดยกเลิกบิล → แป้นรหัสเจ้าของ
    L.owner = await check('owner'); L.ownerPad = await page.evaluate(() => { const i = document.getElementById('pinIn'); return [i.type, i.inputMode, getComputedStyle(i).webkitTextSecurity, document.activeElement === i, document.querySelectorAll('input[type=password]').length]; });
    await page.screenshot({path:path.join(SHOTS, `${label}-08-owner-code.png`)});
    await page.click('#pinNo'); await page.click('#closeX');
    L.cartOverflow = await page.evaluate(() => [...document.querySelectorAll('#cart .line')].some(l => l.scrollWidth > l.clientWidth + 1));
    layouts[label] = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, typeof v === 'boolean' || Array.isArray(v) ? v : {hscroll:v.hscroll, offscreen:v.offscreen, payVis:v.payVis}]));
    await ctx.close();
  }
  for(const label of LABELS){
    const L = layouts[label];
    eq(`UI01 ${label}: ไม่เลื่อนแนวนอน ไม่มีปุ่มหลุดจอ (หน้าแรก Acai Greek ตะกร้า ชำระเงิน สรุป)`,
      ['home', 'acai', 'greek', 'cart', 'pay', 'summary', 'owner'].map(k => [L[k].hscroll, L[k].offscreen]), Array(7).fill([false, []]));
    eq(`U01 ${label}: รหัสเจ้าของ = ช่อง text แป้นตัวเลข ซ่อนด้วย CSS ได้ focus · ไม่มีช่อง password`, L.ownerPad, ['text', 'numeric', 'disc', true, 0]);
    eq(`UI01 ${label}: ปุ่มชำระเงินเห็นเสมอระหว่างขาย (หน้าแรก Acai Greek ตะกร้า)`, ['home', 'acai', 'greek', 'cart'].map(k => L[k].payVis), [true, true, true, true]);
    eq(`X02 ${label}: หมายเหตุยาว 500+ ตัว + อีโมจิ ในตะกร้าไม่ล้นกรอบ`, L.cartOverflow, false);
  }
  const smallList = [...small.values()].sort((a, b) => a.h - b.h);
  console.log(`INFO UI02 ปุ่มที่เล็กกว่า 48 px (${smallList.length}):`);
  smallList.forEach(s => console.log(`INFO UI02   ${s.w}×${s.h}  "${s.l}"  .${s.cls || '-'}  @${s.where}`));
  fs.writeFileSync(path.join(SHOTS, 'ui02-small-buttons.json'), JSON.stringify(smallList, null, 1));
  // ---------- UI10 หลัง "เพิ่มลงออเดอร์" / "ออเดอร์ถัดไป" กลับขั้นเลือกเมนู + เลื่อนขึ้นบนสุด (Tee เจอบน iPad 2026-10-13) ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:true});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui10-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const at = () => page.evaluate(() => ({y: Math.round(scrollY), can: document.documentElement.scrollHeight > innerHeight + 1, menu: sel.menu, top: Math.round(document.querySelector('[data-step="menu"]').getBoundingClientRect().top)}));
    for(const h of ['none', 'little', 'lots', 'side']){ await page.tap('[data-menu="acai"]'); await page.tap(`[data-honey="${h}"]`); await page.tap('#btnAdd'); }   // ตะกร้ายาว (แนวตั้งอยู่ใต้หน้าขาย)
    await page.tap('[data-menu="acai"]'); await page.tap('[data-honey="normal"]');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));   // พนักงานเลื่อนลงไปดูตะกร้า/หมายเหตุ ก่อนกดเพิ่ม
    const down = await at();
    await page.tap('#btnAdd'); const afterAdd = await at();
    await page.tap('[data-menu="acai"]');   // เลือกแก้วค้างไว้ แล้วจ่ายบิล
    await page.tap(await page.isVisible('#btnPay') ? '#btnPay' : '#btnPay2'); await page.tap('[data-dine="dinein"]'); await page.tap('[data-method="cash"]'); await page.tap('[data-q]'); await page.tap('#payOk');
    await page.tap('#nextOrder'); const afterNext = await at();
    await page.screenshot({path:path.join(SHOTS, `${label}-09-after-next-order.png`)});
    console.log(`INFO UI10 ${label}: ก่อนกดเพิ่มเลื่อนลง ${down.y}px${down.can ? '' : ' (หน้าสั้น เลื่อนไม่ได้)'} · หลังเพิ่ม ${JSON.stringify(afterAdd)} · หลังออเดอร์ถัดไป ${JSON.stringify(afterNext)}`);
    eq(`UI10 ${label}: หลังเพิ่มลงออเดอร์ และหลังออเดอร์ถัดไป อยู่ขั้นเลือกเมนู บนสุดของหน้า`, [down.y > 0 || !down.can, afterAdd.y, afterAdd.menu, afterAdd.top > 0, afterNext.y, afterNext.menu, afterNext.top > 0], [true, 0, null, true, 0, null, true]);
    await ctx.close();
  }

  // ---------- UI11 / UI13 / UI14 หน้าเลือกออเดอร์ v3 (Tee 2026-10-13): แถบล่าง · แนว · ข้อความไม่ถูกตัด ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:true, reducedMotion:'reduce'});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'v3-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const nap = ms => page.waitForTimeout(ms || 120);
    const barH = () => page.evaluate(() => Math.round(document.getElementById('actBar').getBoundingClientRect().height));
    /* UI14 ทุกปุ่มที่เห็น: ข้อความไม่ล้น (scrollWidth/Height) และไม่มี … (text-overflow: ellipsis ที่ตัดจริง) */
    const clipped = () => page.evaluate(() => {
      const vis = el => { const st = getComputedStyle(el), b = el.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
      const bad = [];
      document.querySelectorAll('#builder button, #actBar button, #actBar .cupsum').forEach(b => {
        if(!vis(b)) return;
        const name = (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
        if(b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) bad.push('overflow:' + name);
        [b, ...b.querySelectorAll('*')].forEach(e => { if(getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) bad.push('ellipsis:' + name); });
      });
      return bad;
    });
    /* UI11 เลื่อนให้แถวสุดท้ายของกล่องเลือก (รวมสวิตช์แยก) ไปอยู่ชิดเหนือแถบล่าง แล้วต้องเห็นครบ ไม่ถูกบัง */
    const lastRowClear = () => page.evaluate(async () => {
      const bar = document.getElementById('actBar').getBoundingClientRect(), hdr = document.querySelector('header').getBoundingClientRect().bottom;
      const secs = [...document.querySelectorAll('#builder .sec')], last = secs[secs.length - 1];
      const rows = [...last.querySelectorAll('.sb > *')].filter(e => e.getBoundingClientRect().height > 0), row = rows[rows.length - 1];
      const sep = document.querySelector('.sep');
      const targets = [row, sep].filter(Boolean), out = [];
      for(const t of targets){
        scrollTo(0, scrollY + t.getBoundingClientRect().bottom - (bar.top - 6)); await new Promise(r => setTimeout(r, 60));
        const b = t.getBoundingClientRect(), bt = document.getElementById('actBar').getBoundingClientRect().top;
        out.push(b.bottom <= bt + 0.5 && b.top >= hdr - 0.5);
      }
      return out.every(Boolean) && out.length > 0;
    });
    const H = [await barH()], C = {}, clear = {};
    C.home = await clipped();
    await page.click('[data-menu="greek"]'); await nap(); H.push(await barH()); C.size = await clipped();
    await page.click('[data-size="g1"]'); await nap(); H.push(await barH());
    for(const t of ['Cashew', 'Chocolate crumble', 'Biscoff Crumble']) await page.click(`[data-pick="${t}"]`);
    await page.click('.sep'); await nap(); H.push(await barH()); C.greek = await clipped(); clear.greek = await lastRowClear();
    await page.screenshot({path:path.join(SHOTS, `${label}-11-greek-v3.png`)});
    /* กดปุ่มสีเทา (ยังไม่เลือกน้ำผึ้ง) → เลื่อนไปขั้นน้ำผึ้ง + กรอบกะพริบ ไม่เพิ่มลงออเดอร์ */
    await page.evaluate(() => scrollTo(0, 0)); await nap();
    const n0 = await page.evaluate(() => cart.length);
    await page.click('#btnAdd'); await nap(400);
    const grey = await page.evaluate(() => { const h = document.querySelector('[data-step="honey"]'), r = h.getBoundingClientRect(), bar = document.getElementById('actBar').getBoundingClientRect();
      return [r.top >= document.querySelector('header').getBoundingClientRect().bottom - 1 && r.top < bar.top, h.classList.contains('flash'), cart.length]; });
    grey[2] -= n0;
    await page.click('[data-honey="normal"]'); await nap(); H.push(await barH()); C.honey = await clipped();
    /* UI13 แนว: วงกลม หัวขั้น ทุกขั้นตรงกัน · เนื้อหาเต็มความกว้าง (เริ่มที่ขอบเดียวกับวงกลม) */
    const align = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect(), secs = [...document.querySelectorAll('#builder .sec')];
      const rows = secs.map(s => { const sn = r(s.querySelector('.sn')), st = r(s.querySelector('.stitle')), sb = s.querySelector('.sb');
        return {snL:sn.left, stL:st.left, sbL:r(sb).left, sbW:r(sb).width, inner:r(s).width - 2 * parseFloat(getComputedStyle(s).borderLeftWidth) - 2 * parseFloat(getComputedStyle(s).paddingLeft), sz:Math.round(sn.width) + 'x' + Math.round(sn.height), fs:getComputedStyle(s.querySelector('.stitle')).fontSize, mid:Math.abs((sn.top + sn.bottom) / 2 - (st.top + st.bottom) / 2)}; });
      const spread = k => Math.max(...rows.map(x => x[k])) - Math.min(...rows.map(x => x[k]));
      return [secs.length, spread('snL') <= 1, spread('stL') <= 1, rows.every(x => Math.abs(x.sbL - x.snL) <= 1 && Math.abs(x.sbW - x.inner) <= 1), new Set(rows.map(x => x.sz)).size, new Set(rows.map(x => x.fs)).size, Math.max(...rows.map(x => x.mid)) <= 2];
    });
    await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="acai"]'); await nap(); H.push(await barH());
    await page.click('[data-swap="0"]'); await page.click('[data-addopen]'); await page.click('.sep'); await nap(); C.acai = await clipped(); clear.acai = await lastRowClear();
    await page.screenshot({path:path.join(SHOTS, `${label}-12-acai-v3.png`)});
    await page.click('[data-swap="0"]'); await page.click('[data-honey="normal"]'); await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="banana"]'); await nap(); H.push(await barH());
    await page.click('.sep'); await nap(); C.banana = await clipped(); clear.banana = await lastRowClear();
    await page.screenshot({path:path.join(SHOTS, `${label}-13-banana-v3.png`)});
    console.log(`INFO v3 ${label}: แถบล่างสูง ${JSON.stringify(H)} · ตัด ${JSON.stringify(C)} · แถวสุดท้าย ${JSON.stringify(clear)} · ปุ่มเทา ${JSON.stringify(grey)} · แนว ${JSON.stringify(align)}`);
    eq(`UI11 ${label}: แถวสุดท้ายของทุกเมนู (รวมสวิตช์แยกท็อปปิ้ง) เลื่อนมาเห็นครบ ไม่ถูกแถบบัง`, clear, {greek:true, acai:true, banana:true});
    eq(`UI11 ${label}: แถบล่างสูงเท่ากันทุกขั้น (เปิดหน้า / เมนู / ขนาด / ท็อปปิ้ง / น้ำผึ้ง / Acai / Banana)`, new Set(H).size, 1);
    eq(`UI11 ${label}: กดปุ่มสีเทา → เลื่อนไปขั้นน้ำผึ้งที่ขาด กรอบกะพริบ ไม่เพิ่มลงออเดอร์`, grey, [true, true, 0]);
    eq(`UI14 ${label}: ไม่มีข้อความในปุ่มไหนถูกตัด/มี … (หน้าแรก ขนาด ท็อปปิ้งชื่อยาว น้ำผึ้ง Acai Banana + แถบล่าง)`, Object.values(C).flat(), []);
    eq(`UI13 ${label}: วงกลม/หัวขั้นตรงแนว ≤1px · เนื้อหาเต็มความกว้างกล่อง · วงกลม/ตัวหัวขั้นขนาดเดียว · กึ่งกลางแนวตั้ง`, align, [4, true, true, true, 1, 1, true]);
    await ctx.close();
  }

  // ---------- iPad เครื่องใหม่: ตั้งเจ้าของครั้งแรกด้วยแป้นของแอป ----------
  {
    const ctx = await safari.newContext({viewport:{width:820, height:1180}, hasTouch:true, isMobile:true, deviceScaleFactor:2});
    const page = await ctx.newPage(); watch(page, 'ipad-setup');
    await page.goto(`${BASE}/prototype/pos.html`); await page.waitForSelector('#lgName');
    const focus0 = await page.evaluate(() => document.activeElement.id);
    await page.fill('#lgName', 'เจ้าของ'); await page.fill('#lgCode', '12x3'); const filtered = await page.inputValue('#lgCode');
    await page.fill('#lgCode', '1234'); await page.fill('#lgCode2', '1234');
    const eye = await page.locator('[data-eye="lgCode"]').boundingBox();
    await page.mouse.move(eye.x + 24, eye.y + 24); await page.mouse.down();
    const held = await page.evaluate(() => [getComputedStyle(lgCode).webkitTextSecurity, document.activeElement.id]);
    await page.screenshot({path:path.join(SHOTS, 'ipad-portrait-00-setup-eye.png')});
    await page.mouse.up(); const released = await page.evaluate(() => getComputedStyle(lgCode).webkitTextSecurity);
    await page.screenshot({path:path.join(SHOTS, 'ipad-portrait-00-setup.png')});
    const r = await page.evaluate(() => [document.querySelectorAll('input[type=password]').length, lgCode.value, lgCode.inputMode, getComputedStyle(lgCode).webkitTextSecurity]);
    await page.press('#lgCode2', 'Enter'); const done = await page.isVisible('#lgDone');
    eq('U01 iPad ตั้งค่าครั้งแรก: ชื่อได้ focus · ช่องรหัสแป้นตัวเลข ซ่อน · กรองตัวเลข · ตากดค้างแล้วเห็น ปล่อยแล้วซ่อน focus ไม่หลุด · Enter สร้างเจ้าของ', [focus0, filtered, ...r, held, released, done], ['lgName', '123', 0, '1234', 'numeric', 'disc', ['none', 'lgCode2'], 'disc', true]);
    await ctx.close();
  }

  eq('UI02 ปุ่มระหว่างขาย (หน้าแรก Acai Greek ตะกร้า ชำระเงิน) ≥ 48×48 px', smallList.filter(s => !/summary$/.test(s.where)).map(s => `${s.l} ${s.w}×${s.h}`), []);

  // ---------- C06 กดยืนยันชำระเงินรัวๆ · E01 ส่งออกไม่ออกจากหน้า ----------
  {
    const ctx = await browser.newContext({viewport:{width:1280, height:800}, hasTouch:true, isMobile:true, acceptDownloads:true});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'c06');
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1234'); await skipFloat(page);
    const bills = () => page.evaluate(() => loadSales().length);
    const prep = async () => { await page.click('[data-menu="banana"]'); await page.click('#btnAdd'); await page.click('#btnPay'); await page.click('[data-dine="dinein"]'); await page.click('[data-method="cash"]'); await page.click('[data-q="500"]'); };
    const res = {};
    await prep(); let n0 = await bills();
    await page.click('#payOk', {clickCount:2, delay:0}); await page.waitForTimeout(300);
    res.dbl = [await bills() - n0, await page.isVisible('#nextOrder')];
    if(await page.isVisible('#nextOrder')) await page.click('#nextOrder');
    await prep(); n0 = await bills();
    const box = await page.locator('#payOk').boundingBox();
    for(let i = 0; i < 5; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    res.tap5 = [await bills() - n0, await page.isVisible('#nextOrder')];
    if(await page.isVisible('#nextOrder')) await page.click('#nextOrder');
    await prep(); n0 = await bills();
    await page.evaluate(() => { const b = document.getElementById('payOk'); for(let i = 0; i < 5; i++) b.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
    await page.waitForTimeout(200);
    res.dispatch5 = await bills() - n0;
    if(await page.isVisible('#nextOrder')) await page.click('#nextOrder');
    eq('C06 Chromium: ดับเบิลคลิก / แตะ 5 ครั้ง / dispatch 5 ครั้ง ได้บิลเดียวทุกแบบ', [res.dbl[0], res.tap5[0], res.dispatch5], [1, 1, 1]);
    eq('C06 หลังแตะรัว หน้า "เงินทอน" ยังอยู่ (แตะที่เกินไม่ไปโดนปุ่ม "ออเดอร์ถัดไป")', [res.dbl[1], res.tap5[1]], [true, true],
      'S3 แตะ "ยืนยันการชำระเงิน" 2 ครั้งเร็วๆ ครั้งที่ 2 ไปโดน "ออเดอร์ถัดไป" ที่อยู่ตำแหน่งเดียวกัน หน้าที่บอกเงินทอนหายไปทันที พนักงานอาจไม่เห็นยอดทอน');

    const url0 = page.url();
    await page.click('#btnSummary'); await page.click('[data-range="all"]'); await page.click('[data-tab="bills"]');
    await page.click('#csvTab'); const dl1 = page.waitForEvent('download', {timeout:5000}).catch(() => null); await page.click('#csvDl'); const d1 = await dl1;
    await page.click('#csvBack'); await page.click('#csvAll'); const dl2 = page.waitForEvent('download', {timeout:5000}).catch(() => null); await page.click('#csvDl'); const d2 = await dl2;
    await page.click('#csvBack'); await page.click('#closeX');
    await page.click('#btnSettings'); await page.click('#bkSet'); const dl3 = page.waitForEvent('download', {timeout:5000}).catch(() => null); await page.click('#csvDl'); const d3 = await dl3;
    let bom = null; if(d1){ const pth = await d1.path(); bom = fs.readFileSync(pth)[0] === 0xEF; }
    await page.waitForTimeout(300);
    eq('E01 CSV แท็บ / CSV ทั้งหมด / สำรองข้อมูล: ได้ไฟล์ ไม่ออกจากหน้า POS', [!!d1, !!d2, !!d3, page.url() === url0, await page.isVisible('#builder'), bom], [true, true, true, true, true, true]);
    await page.screenshot({path:path.join(SHOTS, 'e01-after-export.png')});
    await ctx.close();
  }

  // ---------- D03 เปิดแอป 2 แท็บพร้อมกัน (app/ แบบติดตั้ง ใช้ IndexedDB จริง) · UI08 ----------
  {
    const ctx = await browser.newContext({viewport:{width:1280, height:800}});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const A = await ctx.newPage(); watch(A, 'tabA');
    await A.goto(`${BASE}/app/index.html`); await A.waitForSelector('#lgName');
    await A.fill('#lgName', 'เจ้าของ'); await A.fill('#lgCode', '1234'); await A.fill('#lgCode2', '1234'); await A.click('#lgSave'); await A.click('#lgDone'); await skipFloat(A);
    const B = await ctx.newPage(); watch(B, 'tabB');
    await B.goto(`${BASE}/app/index.html`); await B.waitForSelector('#builder'); await B.waitForTimeout(300); await skipFloat(B);
    const sell = async (pg, menu) => { await pg.click(`[data-menu="${menu}"]`); if(await pg.$('[data-honey]')) await pg.click('[data-honey="normal"]'); await pg.click('#btnAdd');
      await pg.click('#btnPay'); await pg.click('[data-dine="dinein"]'); await pg.click('[data-method="tcp"]'); await pg.click('#payOk'); const s = await pg.evaluate(() => ({id:lastSale.id, no:lastSale.no})); await pg.click('#nextOrder'); return s; };
    const mode = await A.evaluate(() => STORE_MODE);
    const a1 = await sell(A, 'acai'), b1 = await sell(B, 'banana'), a2 = await sell(A, 'acai');
    const lsCount = await A.evaluate(() => JSON.parse(localStorage.getItem(KEY)).length);
    await A.reload(); await A.waitForSelector('#builder'); await A.waitForTimeout(400);
    const after = await A.evaluate(() => loadSales().map(s => s.no));
    console.log(`INFO D03 โหมด ${mode} · แท็บ A ได้ #${a1.no} #${a2.no} · แท็บ B ได้ #${b1.no} · localStorage ก่อนรีโหลดมี ${lsCount} บิล · หลังรีโหลด ${JSON.stringify(after)}`);
    eq('D03 ขาย 2 แท็บพร้อมกัน: รีโหลดแล้วบิลครบ 3 ใบ (IndexedDB)', after.length, 3);
    eq('D03 เลขออเดอร์ไม่ซ้ำกันระหว่าง 2 แท็บ', new Set([a1.no, b1.no, a2.no]).size, 3, 'S3 ⚠️ แต่ละแท็บนับเลขจากหน่วยความจำของตัวเอง แท็บ B ได้ #001 ซ้ำกับแท็บ A และ localStorage (สำเนาสำรอง) ถูกแท็บหลังเขียนทับ (บิลยังอยู่ใน IndexedDB)');

    // UI08 5,000 บิลในเบราว์เซอร์จริง
    await A.evaluate(() => { const base = Date.now() - 5000 * 6 * 3600000, list = [];
      for(let i = 0; i < 5000; i++){ const t = base + i * 6 * 3600000; const P = priceItem(MENU.acai, {comps:MENU.acai.defaults.slice(), adds:[], sep:false});
        list.push({id:t, no:(i % 4) + 1, date:bizDate(new Date(t)), ts:new Date(t).toISOString(), dining:'dinein', items:[{menu:'acai', name:'Acai', sizeName:'', tops:P.tops, honey:'normal', note:'', unit:P.unit, qty:1}], total:P.unit, method:'cash', received:P.unit, change:0, void:false, staff:'เจ้าของ'}); }
      saveSales(list); });
    await A.waitForTimeout(500);
    const ms = async fn => { const t = Date.now(); await fn(); return Date.now() - t; };
    const tAll = await ms(async () => { await A.click('#btnSummary'); await A.click('[data-range="all"]'); });
    const tBills = await ms(() => A.click('[data-tab="bills"]'));
    await A.click('#closeX');
    const tSale = await ms(() => sell(A, 'banana'));
    console.log(`INFO UI08 Chromium (เดสก์ท็อป) 5,000 บิล: สรุปทั้งหมด ${tAll} ms · แท็บบิล ${tBills} ms · ขาย 1 บิลทั้งขั้นตอน ${tSale} ms`);
    eq('UI08 Chromium: เปิดสรุปทั้งหมด / แท็บบิล / ขาย 1 บิล กับ 5,000 บิล < 1.5 วินาที', [tAll < 1500, tBills < 1500, tSale < 1500], [true, true, true]);
    await ctx.close();
  }

  eq('Z08 ไม่มี console error ระหว่างใช้งานทุกหน้า', consoleErrors, []);
  if(safari !== browser) await safari.close();
  await browser.close(); server.close();
  console.log('INFO screenshots:', path.relative(ROOT, SHOTS));
  done();
})().catch(async e => { console.error('TEST CRASH', e); process.exit(2); });
