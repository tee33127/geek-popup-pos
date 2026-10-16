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
        const payVis = ['btnPay', 'btnPay2', 'cartMini'].some(id => { /* แนวนอนระหว่างเลือกแก้ว: แถบออเดอร์ที่ยุบ แตะแล้วเห็นปุ่มชำระเงิน (Tee 2026-10-15) */ const e = document.getElementById(id); if(!e || !vis(e)) return false; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= H && b.left >= 0 && b.right <= W; });
        return {hscroll: document.documentElement.scrollWidth > W + 1, offscreen: btns.filter(b => { const x = b.getBoundingClientRect(); return x.right > W + 1 || x.left < -1; }).map(label),
          payVis, small: btns.map(b => { const x = b.getBoundingClientRect(); return {l:label(b), w:Math.round(x.width), h:Math.round(x.height), cls:b.className}; }).filter(x => x.w < 44 || x.h < 44)};
      });
      r.small.forEach(s => { const k = `${s.l} (${s.cls || '-'})`; const cur = small.get(k); if(!cur || s.h * s.w < cur.h * cur.w) small.set(k, {...s, where:`${label}/${name}`}); });
      return r;
    };
    const L = {};
    /* ข้อความล้นกล่อง: element ที่มีข้อความตรงๆ กว้างเกินกล่องตัวเอง (ไม่นับกล่องที่ตั้งใจให้เลื่อน และที่ตั้งใจตัด … เช่นรายละเอียดตะกร้า) */
    const overflow = () => page.evaluate(() => [...document.querySelectorAll('main *, #modal *, #actBar *, header *')].filter(el => {
      const st = getComputedStyle(el), b = el.getBoundingClientRect();
      if(st.display === 'none' || st.visibility === 'hidden' || !b.width || /auto|scroll/.test(st.overflowX) || (st.textOverflow === 'ellipsis' && st.overflowX === 'hidden') || /^(INPUT|TEXTAREA|SELECT|svg|path)$/i.test(el.tagName)) return false;
      if(![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
      return el.scrollWidth > el.clientWidth + 1;
    }).map(el => `${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 20)}" ${el.scrollWidth}>${el.clientWidth}`));
    L.home = await check('home'); await page.screenshot({path:path.join(SHOTS, `${label}-02-home.png`)});
    /* ฟอนต์ที่ใช้จริง = IBM Plex Sans Thai Looped (ฝังใน pos-demo.html) */
    L.font = await page.evaluate(async () => { await document.fonts.ready;
      return [getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g, ''), ...[400, 700].map(w => document.fonts.check(`${w} 16px "IBM Plex Sans Thai Looped"`)),
        [...document.fonts].filter(f => f.family.replace(/"/g, '') === 'IBM Plex Sans Thai Looped' && f.status === 'loaded').length >= 2]; });
    await page.click('[data-menu="acai"]'); await page.click('[data-swap="0"]');
    L.swapOver = await overflow(); await page.screenshot({path:path.join(SHOTS, `${label}-03b-acai-swap.png`)}); await page.click('#closeX'); await page.click('[data-addopen]'); await page.click('#addsDone');
    L.acai = await check('acai'); L.acaiOver = await overflow(); await page.screenshot({path:path.join(SHOTS, `${label}-03-acai.png`), fullPage:true});
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd');
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]'); for(const t of ['Banana', 'Mango', 'Kiwi', 'Granola']) await page.click(`[data-pick="${t}"]`);
    L.greek = await check('greek'); L.greekOver = await overflow(); await page.screenshot({path:path.join(SHOTS, `${label}-04-greek.png`), fullPage:true});
    await page.click('[data-honey="lots"]'); await page.click('[data-noteopen]');
    await page.fill('#note', 'ลูกค้าแพ้ถั่วลิสงขอไม่ใส่เนยถั่วและช็อกโกแลตชิพ '.repeat(10) + '😀👍🏽 ฮ่าาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาาา่');   // X02 หมายเหตุยาว
    await page.click('#btnAdd');
    /* H20 (เดิม C10) ตะกร้าจัดกลุ่มเหมือนใบเสร็จ: กลุ่มละบรรทัดเดียว (ยาวตัด …) · ไม่รับ = ส้ม ไม่ใช่แดง · แตะ = ดูเต็ม */
    L.cartGroups = await page.evaluate(() => { const cg = [...document.querySelectorAll('#cart .line:not(.full) .cg')];
      const one = cg.every(c => c.getBoundingClientRect().height <= parseFloat(getComputedStyle(c).fontSize) * 1.6);
      const no = [...document.querySelectorAll('#cart .cg.no')], noColor = no.map(c => getComputedStyle(c).color);
      return [cg.length > 0, one, noColor.every(c => c === 'rgb(163, 84, 0)')]; });
    L.cart = await check('cart'); L.cartOver = await overflow(); await page.screenshot({path:path.join(SHOTS, `${label}-05-cart.png`), fullPage:true});
    await page.click(await page.isVisible('#btnPay') ? '#btnPay' : '#btnPay2');
    await page.click('[data-dine="takeaway"]'); await page.click('[data-method="cash"]');
    L.pay = await check('pay'); L.payOver = await overflow(); await page.screenshot({path:path.join(SHOTS, `${label}-06-pay.png`)});
    await page.click('#payCancel');
    /* ขาย 1 บิลจริงก่อนเปิดสรุปยอด: พนักงานเห็นเฉพาะรอบวันนี้ (หลัง 23:00 รอบใหม่ยังไม่มีบิล เทสต์ไม่ขึ้นกับเวลาที่รัน) */
    await page.click(await page.isVisible('#btnPay') ? '#btnPay' : '#btnPay2'); await page.click('[data-dine="takeaway"]'); await page.click('[data-method="cash"]'); await page.click('[data-q]'); await page.click('#payOk'); await page.click('#nextOrder');
    await page.click('#btnSummary'); L.summary = await check('summary'); await page.screenshot({path:path.join(SHOTS, `${label}-07-summary.png`)});
    await page.click('[data-tab="bills"]'); await page.click('[data-v]');   // พนักงานกดยกเลิกบิล → แป้นรหัสเจ้าของ
    L.owner = await check('owner'); L.ownerPad = await page.evaluate(() => { const i = document.getElementById('pinIn'); return [i.type, i.inputMode, getComputedStyle(i).webkitTextSecurity, document.activeElement === i, document.querySelectorAll('input[type=password]').length]; });
    await page.screenshot({path:path.join(SHOTS, `${label}-08-owner-code.png`)});
    await page.click('#pinNo'); await page.click('#closeX');
    await page.click('#btnSettings'); L.settingsOver = await overflow(); await page.screenshot({path:path.join(SHOTS, `${label}-07b-settings.png`)}); await page.click('#closeX');
    L.cartOverflow = await page.evaluate(() => [...document.querySelectorAll('#cart .line')].some(l => l.scrollWidth > l.clientWidth + 1));
    layouts[label] = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, typeof v === 'boolean' || Array.isArray(v) ? v : {hscroll:v.hscroll, offscreen:v.offscreen, payVis:v.payVis}]));
    await ctx.close();
  }
  for(const label of LABELS){
    const L = layouts[label];
    eq(`UI01 ${label}: ไม่เลื่อนแนวนอน ไม่มีปุ่มหลุดจอ (หน้าแรก Acai Greek ตะกร้า ชำระเงิน สรุป)`,
      ['home', 'acai', 'greek', 'cart', 'pay', 'summary', 'owner'].map(k => [L[k].hscroll, L[k].offscreen]), Array(7).fill([false, []]));
    eq(`U01 ${label}: รหัสเจ้าของ = ช่อง text แป้นตัวเลข ซ่อนด้วย CSS ได้ focus · ไม่มีช่อง password`, L.ownerPad, ['text', 'numeric', 'disc', true, 0]);
    eq(`UI01 ${label}: ปุ่มชำระเงิน (หรือแถบออเดอร์ที่ยุบ) เห็นเสมอระหว่างขาย (หน้าแรก Acai Greek ตะกร้า)`, ['home', 'acai', 'greek', 'cart'].map(k => L[k].payVis), [true, true, true, true]);
    eq(`X02 ${label}: หมายเหตุยาว 500+ ตัว + อีโมจิ ในตะกร้าไม่ล้นกรอบ`, L.cartOverflow, false);
    eq(`H20 ${label}: ตะกร้าจัดกลุ่มเหมือนใบเสร็จ แต่ละกลุ่มบรรทัดเดียว (ยาวตัด …) · ไม่รับ สีส้มไม่ใช่แดง`, L.cartGroups, [true, true, true]);
    eq(`F01 ${label}: ฟอนต์ที่ใช้จริง IBM Plex Sans Thai Looped (400 + 700 โหลดแล้ว)`, L.font, ['IBM Plex Sans Thai Looped', true, true, true]);
    eq(`F02 ${label}: ไม่มีข้อความล้นกล่อง (Acai, หน้าต่างเปลี่ยน, Greek, ตะกร้า, ชำระเงิน+แป้น, ตั้งค่า)`, [L.acaiOver, L.swapOver, L.greekOver, L.cartOver, L.payOver, L.settingsOver], Array(6).fill([]));
  }
  const smallList = [...small.values()].sort((a, b) => a.h - b.h);
  console.log(`INFO UI02 ปุ่มที่เล็กกว่า 44 px (${smallList.length}):`);
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
    await page.tap('[data-menu="acai"]');   // เลือกแก้วค้างไว้ แล้วจ่ายบิล (แนวนอน: แตะแถบออเดอร์ที่ยุบก่อน · ถามเรื่องแก้วค้าง → ทิ้งแก้ว)
    if(await page.isVisible('#cartMini')) await page.tap('#cartMini');
    await page.tap(await page.isVisible('#btnPay') ? '#btnPay' : '#btnPay2'); await page.tap('#pendDrop'); await page.tap('[data-dine="dinein"]'); await page.tap('[data-method="cash"]'); await page.tap('[data-q]'); await page.tap('#payOk');
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
    const clipped = (root) => page.evaluate(root => {
      const vis = el => { const st = getComputedStyle(el), b = el.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
      const bad = [];
      document.querySelectorAll(root ? `${root} button, ${root} .tn` : '#builder button, #builder .tn, #actBar button, #actBar .cupsum').forEach(b => {
        if(!vis(b)) return;
        const name = (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
        if(b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) bad.push('overflow:' + name);
        [b, ...b.querySelectorAll('*')].forEach(e => { if(getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) bad.push('ellipsis:' + name); });
      });
      return bad;
    }, root);
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
    /* UI14 placeholder ทุกช่องที่เห็น: วัดความกว้างข้อความด้วยฟอนต์จริง เทียบกับพื้นที่ในช่อง */
    const phClip = () => page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d'), bad = [];
      document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(i => {
        const st = getComputedStyle(i), b = i.getBoundingClientRect(); if(st.display === 'none' || !b.width) return;
        cv.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
        const room = i.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
        if(cv.measureText(i.placeholder).width > room + 1) bad.push(`${i.id || i.className}: "${i.placeholder}"`);
      });
      return bad;
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
    await page.click('[data-noteopen]'); await nap(); C.notePh = await phClip();
    /* UI13 แนว: วงกลม หัวขั้น ทุกขั้นตรงกัน · เนื้อหาเต็มความกว้าง (เริ่มที่ขอบเดียวกับวงกลม) */
    const align = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect(), secs = [...document.querySelectorAll('#builder .sec')];
      const rows = secs.map(s => { const sn = r(s.querySelector('.sn')), st = r(s.querySelector('.stitle')), sb = s.querySelector('.sb');
        return {inline:s.classList.contains('inline'), snL:sn.left, stL:st.left, sbL:r(sb).left, sbW:r(sb).width, inner:r(s).width - 2 * parseFloat(getComputedStyle(s).borderLeftWidth) - 2 * parseFloat(getComputedStyle(s).paddingLeft), sz:Math.round(sn.width) + 'x' + Math.round(sn.height), fs:getComputedStyle(s.querySelector('.stitle')).fontSize, mid:Math.abs((sn.top + sn.bottom) / 2 - (st.top + st.bottom) / 2)}; });
      const spread = k => Math.max(...rows.map(x => x[k])) - Math.min(...rows.map(x => x[k]));
      return [secs.length, spread('snL') <= 1, spread('stL') <= 1, rows.every(x => x.inline ? x.sbL > x.stL : Math.abs(x.sbL - x.snL) <= 1 && Math.abs(x.sbW - x.inner) <= 1), new Set(rows.map(x => x.sz)).size, new Set(rows.map(x => x.fs)).size, Math.max(...rows.map(x => x.mid)) <= 2];
    });
    await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="acai"]'); await nap(); H.push(await barH());
    await page.click('[data-swap="0"]'); await nap(); C.swap = await clipped('#modal'); await page.click('#closeX');
    await page.click('[data-addopen]'); await nap(); C.adds = await clipped('#modal'); await page.click('#addsDone');
    await page.click('.sep'); await nap(); C.acai = await clipped(); clear.acai = await lastRowClear();
    await page.screenshot({path:path.join(SHOTS, `${label}-12-acai-v3.png`)});
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="banana"]'); await nap(); H.push(await barH());
    await page.click('.sep'); await nap(); C.banana = await clipped(); clear.banana = await lastRowClear();
    await page.screenshot({path:path.join(SHOTS, `${label}-13-banana-v3.png`)});
    /* placeholder ในหน้าต่าง: ชำระเงิน (รับเงิน) · ปิดร้าน (ตั้งต้น นับได้ หมายเหตุ) · เงินทอนตั้งต้น · PromptPay */
    await page.click('[data-menu="banana"]'); await page.click('#btnAdd'); await nap();
    await page.click(await page.isVisible('#btnPay2') ? '#btnPay2' : '#btnPay'); await page.click('[data-dine="dinein"]'); await page.click('[data-method="cash"]'); await nap(); C.payPh = await phClip(); await page.click('#closeX');
    await page.evaluate(() => openClose()); await nap(); C.closePh = await phClip(); await page.click('#closeX');
    await page.evaluate(() => { openModal(''); closeModal(); const d = bizDate(new Date()); if(dayFloat(d) === null) askFloat(); }); await nap(); C.floatPh = await phClip(); await page.evaluate(() => closeModal());
    await page.evaluate(() => { USER = {id:'x', name:'x', role:'owner'}; openPromptPay(); }); await nap(); C.ppPh = await phClip(); await page.evaluate(() => closeModal());
    await page.evaluate(() => { USER = users().find(u => u.role === 'staff') || USER; });
    while(await page.$('#cart .rm')) await page.click('#cart .rm');
    console.log(`INFO v3 ${label}: แถบล่างสูง ${JSON.stringify(H)} · ตัด ${JSON.stringify(C)} · แถวสุดท้าย ${JSON.stringify(clear)} · ปุ่มเทา ${JSON.stringify(grey)} · แนว ${JSON.stringify(align)}`);
    eq(`UI11 ${label}: แถวสุดท้ายของทุกเมนู (รวมสวิตช์แยกท็อปปิ้ง) เลื่อนมาเห็นครบ ไม่ถูกแถบบัง`, clear, {greek:true, acai:true, banana:true});
    eq(`UI11 ${label}: แถบล่างสูงเท่ากันทุกขั้น (เปิดหน้า / เมนู / ขนาด / ท็อปปิ้ง / น้ำผึ้ง / Acai / Banana)`, new Set(H).size, 1);
    eq(`UI11 ${label}: กดปุ่มสีเทา → เลื่อนไปขั้นน้ำผึ้งที่ขาด กรอบกะพริบ ไม่เพิ่มลงออเดอร์`, grey, [true, true, 0]);
    eq(`UI14 ${label}: ไม่มีข้อความในปุ่มไหนถูกตัด/มี … และ placeholder ไม่ล้นช่อง (หน้าขาย หมายเหตุ ชำระเงิน ปิดร้าน เงินทอนตั้งต้น PromptPay)`, Object.values(C).flat(), []);
    eq(`UI13 ${label}: วงกลม/หัวขั้นตรงแนว ≤1px · เนื้อหาเต็มความกว้างกล่อง (ขั้นแถวเดียว: ตัวเลือกอยู่ขวาหัวขั้น) · วงกลม/ตัวหัวขั้นขนาดเดียว · กึ่งกลางแนวตั้ง`, align, [4, true, true, true, 1, 1, true]);
    await ctx.close();
  }

  // ---------- UI15 หน้าต่าง: เลื่อนในกล่องอย่างเดียว · หน้าหลังไม่ขยับ · X อยู่ในจอทุกตำแหน่ง · ปิดแล้วหน้าขายกลับที่เดิม (Tee 2026-10-13) ----------
  // WebKit โหมดมือถือส่ง wheel ไม่ได้ จอ iPad จึงใช้ WebKit แบบไม่ isMobile (Safari บน iPad รายงานตัวเป็นเดสก์ท็อปอยู่แล้ว)
  for(const [label, vp, br] of SCREENS){
    const mobile = !label.startsWith('ipad');
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:mobile});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui15-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1234'); await skipFloat(page);
    await page.click('[data-menu="acai"]'); await page.click('[data-honey="normal"]'); await page.click('#btnAdd');
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]');
    const nap = ms => page.waitForTimeout(ms || 150);
    const Y0 = await page.evaluate(() => { scrollTo(0, Math.min(400, document.documentElement.scrollHeight - innerHeight)); return Math.round(scrollY); }); await nap();
    const pageTop = () => page.evaluate(() => Math.round(document.getElementById('builder').getBoundingClientRect().top));
    const top0 = await pageTop();
    /* บิลรอบนี้พอให้หน้าต่างสรุปยอดต้องเลื่อน (ข้อมูลตัวอย่างช่วงเช้ามีบิลน้อย จอแนวตั้งสูงพอใส่ได้หมด) · ใส่ผ่าน saveSales เท่านั้น */
    await page.evaluate(() => { const all = loadSales(), now = new Date();
      for(let i = 0; i < 15; i++) all.push({id: now.getTime() - 1000 - i, no: 900 + i, date: bizDate(now), ts: now.toISOString(), dining: 'dinein',
        items: [{menu:'acai', name:'Acai', tops:[], honey:'normal', note:'', unit:189, qty:1}], total: 189, method: 'cash', received: 200, change: 11, void: false, staff: USER.name, staffId: USER.id});
      saveSales(all); });
    const mb = () => page.evaluate(() => { const m = document.querySelector('#modal .mbody'); return {st:Math.round(m.scrollTop), max:m.scrollHeight - m.clientHeight}; });
    /* ปัดด้วย wheel ในกล่อง: ลงสุด → ลงต่อ (ห้ามส่งต่อหน้าหลัง) → ขึ้นสุด */
    const gesture = async () => {
      const b = await page.locator('#modal .mbody').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      for(let i = 0; i < 6; i++){ await page.mouse.wheel(0, 3000); await nap(80); }
      await nap(500); const down = await mb(); const pDown = await pageTop();
      for(let i = 0; i < 4; i++){ await page.mouse.wheel(0, 3000); await nap(80); }
      await nap(300); const pMore = await pageTop();
      for(let i = 0; i < 12; i++){ await page.mouse.wheel(0, -3000); await nap(80); }
      await nap(600); const up = await mb();
      return [down.max > 0 && down.st >= down.max - 1, up.st, pDown === top0 && pMore === top0];
    };
    /* X อยู่ในจอและกดถึงได้ ที่ตำแหน่งเลื่อน บน / กลาง / ล่าง */
    const xVisible = () => page.evaluate(async () => {
      const m = document.querySelector('#modal .mbody'), max = m.scrollHeight - m.clientHeight, out = [];
      for(const t of [0, max / 2, max]){ m.scrollTop = t; await new Promise(r => setTimeout(r, 30));
        const x = document.getElementById('closeX').getBoundingClientRect(), hit = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2);
        out.push(x.top >= 0 && x.bottom <= innerHeight && x.left >= 0 && x.right <= innerWidth && x.width >= 44 && x.height >= 44 && !!hit && !!hit.closest('#closeX')); }
      return out.every(Boolean);
    });
    const G = {}, X = {};
    await page.click('#btnSettings'); await nap(); G.settings = await gesture(); X.settings = await xVisible();
    await page.click('#closeX'); await nap(); const backS = [await page.evaluate(() => Math.round(scrollY)), await pageTop()];
    await page.click('#btnSummary'); await nap(); await page.click('[data-tab="bills"]'); await nap(); G.summary = await gesture(); X.summary = await xVisible();
    await page.click('#csvTab'); await nap(); X.export = await xVisible(); await page.click('#closeX');
    await page.click('#btnSummary'); await page.click('#closeDay'); await nap(); X.close = await xVisible(); await page.click('#closeX');
    await nap(); const backM = [await page.evaluate(() => Math.round(scrollY)), await pageTop()];
    /* ปุ่มชำระเงินในแถบล่าง (ถ้ามี) ไม่ทำให้หน้าเลื่อนก่อนเปิดหน้าต่าง */
    /* แนวนอนกล่องออเดอร์ยุบอยู่ (มีแก้ว Greek ค้าง) ปุ่มชำระเงินไม่แสดง → เปิดด้วยโค้ด · มีแก้วค้าง = ถามก่อน (ตรวจใน UI21) ที่นี่ตรวจหน้าต่างชำระเงินเอง */
    if(await page.isVisible('#btnPay2')) await page.click('#btnPay2'); else await page.evaluate(() => openPay());
    await nap(); if(await page.$('#pendBack')) await page.evaluate(() => { pay = {dining:null, method:null, received:0}; renderPay(); });
    await page.click('[data-dine="dinein"]'); await page.click('[data-method="cash"]'); X.pay = await xVisible(); await page.click('#closeX');
    await page.evaluate(() => { document.getElementById('promoOpen').click(); }); await nap(); X.promo = await xVisible(); await page.click('#closeX');
    for(const [k, js] of [['user', 'openUserForm(null)'], ['promptpay', 'openPromptPay()'], ['restore', 'openRestore(false)']]){ await page.evaluate(js); await nap(); X[k] = await xVisible(); await page.click('#closeX'); }
    await nap(); const backEnd = [await page.evaluate(() => Math.round(scrollY)), await pageTop(), await page.evaluate(() => document.body.style.position)];
    console.log(`INFO UI15 ${label}: หน้าเลื่อนไว้ ${Y0}px · ปัดในตั้งค่า ${JSON.stringify(G.settings)} สรุปยอด ${JSON.stringify(G.summary)} · X ${JSON.stringify(X)} · ปิดแล้ว ${JSON.stringify([backS, backM, backEnd])}`);
    eq(`UI15 ${label}: ตั้งค่า/สรุปยอด ปัดลงสุดแล้วปัดกลับขึ้นบนสุดได้ · ปัดเกินไม่ทำให้หน้าขายข้างหลังขยับ`, [G.settings, G.summary], [[true, 0, true], [true, 0, true]]);
    eq(`UI15 ${label}: ปุ่ม X (≥44px) อยู่ในจอและกดถึงได้ทุกตำแหน่งการเลื่อน ทุกหน้าต่าง`, X, {settings:true, summary:true, export:true, close:true, pay:true, promo:true, user:true, promptpay:true, restore:true});
    eq(`UI15 ${label}: ปิดหน้าต่างแล้วหน้าขายกลับที่เดิม · ปลดล็อกหน้า`, [backS, backM, backEnd], [[Y0, top0], [Y0, top0], [Y0, top0, '']]);
    await ctx.close();
  }

  // ---------- UI16 เห็นครบในจอเดียว ไม่ต้องเลื่อน (Tee 2026-10-14) · Redmi แนวนอน = ต้องผ่าน · iPad แนวนอน = รายงาน ----------
  for(const [label, vp, br, must] of [['landscape', {width:1280, height:800}, browser, true], ['ipad-landscape', {width:1180, height:820}, safari, false]]){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:label === 'landscape', reducedMotion:'reduce'});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui16-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const nap = ms => page.waitForTimeout(ms || 200);
    /* ทุกขั้นอยู่ระหว่างแถบหัวกับแถบล่าง ตอนหน้าอยู่บนสุด */
    const fits = async () => { await page.evaluate(() => scrollTo(0, 0)); await nap(120); return page.evaluate(() => {
      const hdr = document.querySelector('header').getBoundingClientRect().bottom, bar = document.getElementById('actBar').getBoundingClientRect().top;
      const secs = [...document.querySelectorAll('#builder .sec')].map(s => s.getBoundingClientRect());
      return {ok: secs[0].top >= hdr - 1 && secs[secs.length - 1].bottom <= bar + 1, spare: Math.round(bar - secs[secs.length - 1].bottom)}; }); };
    const F = {};
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]');
    for(const t of ['Banana', 'Mango', 'Kiwi', 'Granola']) await page.click(`[data-pick="${t}"]`);
    await page.click('.sep'); await page.click('[data-honey="normal"]'); await nap(); F.greek = await fits();
    await page.screenshot({path:path.join(SHOTS, `${label}-16-fit-greek.png`)});
    await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="acai"]'); await page.click('.sep'); await page.click('[data-honey="normal"]'); await nap(); F.acai = await fits();
    await page.screenshot({path:path.join(SHOTS, `${label}-16-fit-acai.png`)});
    await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="banana"]'); await page.click('.sep'); await nap(); F.banana = await fits();
    await page.screenshot({path:path.join(SHOTS, `${label}-16-fit-banana.png`)});
    await page.click('#btnAdd'); await nap();
    /* หน้าต่างโปร: โปร 3 แบบ + ปุ่มใช้โปร ไม่ต้องเลื่อน */
    await page.click('#promoOpen'); await nap();
    F.promo = await page.evaluate(() => { const m = document.querySelector('#modal .mbody'), ok = document.getElementById('promoOk').getBoundingClientRect();
      return {ok: m.scrollHeight <= m.clientHeight + 1 && document.querySelectorAll('.popt').length === 3 && ok.bottom <= innerHeight, spare: m.clientHeight - m.scrollHeight}; });
    await page.click('#closeX');
    /* หน้าต่างชำระเงิน: ทุกส่วนไม่ต้องเลื่อน · แป้นตัวเลขขึ้น (จอเหลือ 420px) ช่องรับเงิน เงินทอน ปุ่มยืนยันยังอยู่ในจอ */
    await page.click('#btnPay'); await page.click('[data-dine="dinein"]'); await page.click('[data-method="cash"]'); await page.click('[data-q="500"]'); await nap();
    F.pay = await page.evaluate(() => { const m = document.querySelector('#modal .mbody'); return {ok: m.scrollHeight <= m.clientHeight + 1, spare: m.clientHeight - m.scrollHeight}; });
    await page.screenshot({path:path.join(SHOTS, `${label}-16-fit-pay.png`)});
    F.payPad = await page.evaluate(() => { const r = document.getElementById('recv'); return {ok: r.readOnly && r.getAttribute('inputmode') === 'none' && !!document.querySelector('#modal .mpad'), spare: 0}; });
    await page.click('#payCancel');
    await page.evaluate(() => openClose()); await nap();
    F.close = await page.evaluate(() => { const m = document.querySelector('#modal .mbody'); return {ok: m.scrollHeight <= m.clientHeight + 1 && !!document.querySelector('#modal .mpad') && document.getElementById('clCount').readOnly, spare: m.clientHeight - m.scrollHeight}; });
    await page.screenshot({path:path.join(SHOTS, `${label}-16-fit-close.png`)});
    /* ช่องตัวอักษร (หมายเหตุ) ใช้แป้นระบบ: จอเหลือ 420px แล้วช่องที่พิมพ์ + ปุ่มบันทึกยังเห็น */
    await page.focus('#clNote'); await page.setViewportSize({width:vp.width, height:420}); await nap(600);
    F.textKeyboard = await page.evaluate(() => { const inView = id => { const r = document.querySelector(id).getBoundingClientRect(), vh = window.visualViewport ? visualViewport.height : innerHeight; return r.top >= 0 && r.bottom <= vh + 1; };
      return {ok: inView('#clNote') && inView('#clSave'), spare: 0}; });
    await page.screenshot({path:path.join(SHOTS, `${label}-16-fit-close-keyboard.png`)});
    await page.setViewportSize(vp); await page.click('#closeX'); await nap();
    console.log(`INFO UI16 ${label}: ${JSON.stringify(F)}`);
    const res = Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.ok]));
    const want = {greek:true, acai:true, banana:true, promo:true, pay:true, payPad:true, close:true, textKeyboard:true};
    if(must) eq(`UI16 ${label} (Redmi): Greek / Acai / Banana / โปร / ชำระเงิน เห็นครบในจอเดียวไม่ต้องเลื่อน ไม่ถูกแถบล่างบัง · ชำระเงินสด/ปิดร้าน ใช้แป้นตัวเลขของแอป (แป้นระบบไม่ขึ้น) พอดีจอรวมแป้น · ช่องหมายเหตุตอนแป้นระบบขึ้น ช่อง + ปุ่มบันทึกยังเห็น`, res, want);
    if(must) eq(`UI16 ${label} (Redmi): Greek เลือก 4 อย่าง + แยก + น้ำผึ้ง เหลือที่ว่าง ≥ 60px (เผื่อแถบสถานะ Android)`, F.greek.spare >= 60, true);
    else console.log(`INFO UI16 ${label} (รายงาน ไม่บังคับ): ${JSON.stringify(res)}`);
    await ctx.close();
  }

  // ---------- UI17 toast (Tee 2026-10-15): ลอยเหนือแถบล่างตรงปุ่มเพิ่มลงออเดอร์ · ไม่ทับหน้าต่าง ยอดเงิน ปุ่มหลัก กล่องออเดอร์ที่ขยาย ·
  //            มีหน้าต่าง = แสดงในตัวหน้าต่าง (ไม่มี toast ลอย) · ไม่มี toast ทักทายตอนเข้าระบบ · ทั้ง 4 จอ ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:!label.startsWith('ipad'), reducedMotion:'reduce'});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui17-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111');
    const nap = ms => page.waitForTimeout(ms || 150);
    const check = () => page.evaluate(() => {
      const t = document.getElementById('toast'), shown = getComputedStyle(t).display !== 'none', modal = document.getElementById('modal').classList.contains('show');
      if(modal){ const m = document.querySelector('#modal .box > .mtoast');
        return shown ? ['toast ลอยทับหน้าต่าง'] : !m ? ['ไม่มีข้อความในหน้าต่าง'] : m.nextElementSibling && m.nextElementSibling.classList.contains('mbody') ? [] : ['ข้อความไม่อยู่ใต้หัวหน้าต่าง']; }
      if(!shown) return ['toast not shown'];
      const a = t.getBoundingClientRect(), vis = e => { const st = getComputedStyle(e), b = e.getBoundingClientRect(); return st.display !== 'none' && st.visibility !== 'hidden' && b.width && b.height; };
      const sel = '#btnAdd, #btnPay, #btnPay2, #total, #barTotal, .cupsum, .xtra, #nextNo, .cartmini .cm-tot' + (document.body.classList.contains('cartopen') ? ', aside.cart' : '');
      const out = [...document.querySelectorAll(sel)].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return b.left < a.right - 1 && b.right > a.left + 1 && b.top < a.bottom - 1 && b.bottom > a.top + 1; })
        .map(e => (e.id || e.className) + ':' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 16));
      if(a.left < 0 || a.right > innerWidth || a.top < 0 || a.bottom > innerHeight) out.push('หลุดจอ');
      return out; });
    const T = {};
    await nap(100); T.signIn = await page.evaluate(() => getComputedStyle(document.getElementById('toast')).display === 'none' ? [] : ['มี toast: ' + document.getElementById('toast').textContent]); await skipFloat(page);
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]'); for(const t of ['Banana', 'Mango', 'Kiwi', 'Granola']) await page.click(`[data-pick="${t}"]`);
    await page.click('[data-honey="lots"]'); await page.evaluate(() => toast('ส่งงานพิมพ์แล้ว', 'check')); T.greek = await check();
    if(await page.isVisible('#cartMini')){ await page.click('#cartMini'); await nap(); await page.evaluate(() => toast('ยกเลิกโปร 1 แถม 1 · ต้องมี Acai หรือ Banana Choco อย่างน้อย 2 แก้ว', 'alert')); T.cartOpen = await check(); await page.click('#cartBack'); }
    else T.cartOpen = [];
    await page.click('#btnAdd'); await nap(); T.added = await check();
    await page.screenshot({path:path.join(SHOTS, `${label}-17-toast-added.png`)});
    await page.evaluate(() => toast('ยกเลิกโปร 1 แถม 1 · ต้องมี Acai หรือ Banana Choco อย่างน้อย 2 แก้ว', 'alert')); T.longMsg = await check();
    await page.click('#btnSettings'); await nap(); await page.evaluate(() => toast('บันทึกไม่สำเร็จ', 'alert')); T.settings = await check(); await page.click('#closeX');
    await page.click(await page.isVisible('#btnPay2') ? '#btnPay2' : '#btnPay'); await page.click('[data-dine="dinein"]'); await page.click('[data-method="cash"]'); await page.click('[data-q="500"]');
    await page.evaluate(() => toast('ส่งงานพิมพ์แล้ว', 'check')); T.payPad = await check();
    T.payStill = await page.evaluate(() => { const m = document.querySelector('#modal .mbody'); return m.scrollHeight <= m.clientHeight + 1 ? [] : ['ข้อความในหน้าต่างทำให้ต้องเลื่อน']; });
    await page.screenshot({path:path.join(SHOTS, `${label}-17-toast-pay.png`)}); await page.click('#payCancel');
    await page.evaluate(() => openClose()); await page.focus('#clNote'); await page.setViewportSize({width:vp.width, height:Math.round(vp.height * 0.52)}); await nap(600);
    await page.evaluate(() => toast('บันทึกไม่สำเร็จ', 'alert')); T.textKeyboard = await check();
    await page.setViewportSize(vp); await page.click('#closeX'); await nap();
    const hide = await page.evaluate(async () => { toast('ทดสอบ'); const t = document.getElementById('toast'); t.click(); return getComputedStyle(t).display; });
    console.log(`INFO UI17 ${label}: ${JSON.stringify(T)}`);
    eq(`UI17 ${label}: ไม่มี toast ทักทาย · toast ลอยไม่ทับปุ่มหลัก ยอดเงิน กล่องออเดอร์ที่ขยาย · มีหน้าต่าง = ข้อความในหน้าต่างใต้หัว ไม่ทับยอด/เงินทอน (ชำระเงินสด + แป้น ไม่ต้องเลื่อน) · แตะแล้วหาย`, [T, hide],
      [{signIn:[], greek:[], cartOpen:[], added:[], longMsg:[], settings:[], payPad:[], payStill:[], textKeyboard:[]}, 'none']);
    await ctx.close();
  }

  // ---------- UI18 ปุ่มท็อปปิ้ง: ขนาดเท่ากันทุกสถานะ · ไม่ตัดคำไทยกลางคำ (Tee 2026-10-14 Redmi จริง) ทั้ง 4 จอ ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:!label.startsWith('ipad'), reducedMotion:'reduce'});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui18-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const nap = ms => page.waitForTimeout(ms || 150);
    const sizes = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].map(b => { const r = b.getBoundingClientRect(); return Math.round(r.height) + 'x' + Math.round(r.width); }), sel);
    /* ข้อความในปุ่มขึ้นบรรทัดใหม่เฉพาะที่ขอบคำ (Intl.Segmenter word) · ชื่อท็อปปิ้งต้องบรรทัดเดียว */
    const midWord = root => page.evaluate(root => {
      const seg = new Intl.Segmenter('th', {granularity:'word'}), bad = [];
      document.querySelectorAll(`${root} .tn, ${root} button`).forEach(el => {
        const tn = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
        tn.forEach(node => { const text = node.textContent, ok = new Set([0, ...[...seg.segment(text)].map(x => x.index), text.length]);
          let lastTop = null; for(let i = 0; i < text.length; i++){ const rg = document.createRange(); rg.setStart(node, i); rg.setEnd(node, i + 1); const r = rg.getClientRects()[0]; if(!r) continue;
            if(lastTop !== null && r.top > lastTop + 4 && !ok.has(i) && text[i] !== ' ') bad.push(text.trim().slice(0, 20) + ' @' + i); lastTop = r.top; } });
        if(el.classList.contains('tn') && el.scrollWidth > el.clientWidth + 1) bad.push('clip:' + el.textContent);
      });
      return bad;
    }, root);
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]'); await nap();
    const before = await sizes('#builder .tops .topw .top');
    await page.click('[data-pick="Cashew"]'); await page.click('[data-pick="Banana"]'); await page.click('[data-pick="Banana"]'); await page.click('[data-pick="Chocolate crumble"]'); await page.click('[data-pick="Granola"]'); await nap();
    const after = await sizes('#builder .tops .topw .top');
    const heights = new Set(after.map(x => x.split('x')[0]));
    const mw = await midWord('#builder');
    /* ชื่อไม่ลอดใต้ปุ่ม − (เว้นห่าง ≥ 2px) ทุกปุ่มที่เลือก */
    const under = await page.evaluate(() => [...document.querySelectorAll('#builder .topw.on')].filter(w => { const rg = document.createRange(); rg.selectNodeContents(w.querySelector('.tn'));
      const t = rg.getBoundingClientRect(), c = w.querySelector('.tminus span').getBoundingClientRect(); return t.right > c.left - 2 && t.top < c.bottom; }).map(w => w.textContent.trim().slice(0, 16)));
    mw.push(...under.map(x => 'under −: ' + x));
    await page.screenshot({path:path.join(SHOTS, `${label}-18-greek-chips.png`)});
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd'); await nap();
    await page.click('[data-menu="acai"]'); await page.click('[data-swap="1"]'); await nap();
    const swapH = new Set((await sizes('#modal .tops .topw .top')).map(x => x.split('x')[0])); const mwSwap = await midWord('#modal');
    await page.screenshot({path:path.join(SHOTS, `${label}-18-acai-swap.png`)}); await page.click('#closeX');
    console.log(`INFO UI18 ${label}: ความสูงปุ่ม ${[...heights]} · หน้าต่างเปลี่ยน ${[...swapH]} · ตัดคำ ${JSON.stringify(mw.concat(mwSwap))}`);
    eq(`UI18 ${label}: ปุ่มท็อปปิ้งขนาดเท่ากันก่อน/หลังเลือก (เลือก 1 / 2 ชิ้น / เกินโควตา / ชื่อยาว) · ทุกปุ่มสูงเท่ากัน · หน้าต่างเปลี่ยนสูงเท่ากัน · ไม่ตัดคำกลางคำ`,
      [JSON.stringify(before) === JSON.stringify(after), heights.size, swapH.size, mw.concat(mwSwap)], [true, 1, 1, []]);
    await ctx.close();
  }

  // ---------- UI20 เลือกปุ่มติดกันทุกคู่ในแถว: ไม่มีส่วนของปุ่มหนึ่งทับปุ่มอื่น ไม่ยื่นนอกขอบ (Tee 2026-10-15) ตาราง Greek + หน้าต่างเพิ่ม · ทั้ง 4 จอ ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:!label.startsWith('ipad'), reducedMotion:'reduce'});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, `ui20-${label}`);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const clash = root => page.evaluate(root => { const ws = [...document.querySelectorAll(root + ' .tops .topw')], bad = [];
      ws.forEach((w, i) => { const wb = w.getBoundingClientRect(), parts = [...w.querySelectorAll('*')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
        if(parts.some(r => r.left < wb.left - 0.5 || r.right > wb.right + 0.5 || r.top < wb.top - 0.5 || r.bottom > wb.bottom + 0.5)) bad.push('out:' + w.textContent.trim().slice(0, 10));
        ws.forEach((o, j) => { if(i === j) return; const b = o.getBoundingClientRect(); if(parts.some(r => r.left < b.right - 0.5 && r.right > b.left + 0.5 && r.top < b.bottom - 0.5 && r.bottom > b.top + 0.5)) bad.push(w.textContent.trim().slice(0, 10) + '→' + o.textContent.trim().slice(0, 10)); });
        const m = w.querySelector('.tminus'); if(m){ const mb = m.getBoundingClientRect(); if(mb.width < 44 || mb.height < 44) bad.push('tap<44:' + w.textContent.trim().slice(0, 10)); } });
      return [...new Set(bad)]; }, root);
    /* ทุกแถวของ Greek: เลือกทุกปุ่ม (ติดกันทุกคู่) · บางปุ่ม 2 ชิ้น · เกินโควตา */
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]');
    const names = await page.evaluate(() => [...document.querySelectorAll('#builder [data-pick]')].filter(b => !b.disabled).map(b => b.dataset.pick));
    for(const n of names) await page.click(`[data-pick="${n}"]`);
    await page.click(`[data-pick="${names[1]}"]`);
    const g = await clash('#builder');
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd'); if(await page.$('#fewOk')) await page.click('#fewOk');
    await page.click('[data-menu="acai"]'); await page.click('[data-addopen]');
    const addNames = await page.evaluate(() => [...document.querySelectorAll('#modal [data-add]')].filter(b => !b.disabled).map(b => b.dataset.add));
    for(const n of addNames) await page.click(`#modal [data-add="${n}"]`);
    const m = await clash('#modal'); await page.click('#addsDone');
    eq(`UI20 ${label}: เลือกทุกปุ่มติดกัน (ตาราง Greek ${names.length} ปุ่ม · หน้าต่างเพิ่ม ${addNames.length} ปุ่ม) ไม่มีอะไรทับปุ่มอื่น ไม่ยื่นนอกขอบ ปุ่ม − แตะ ≥ 44px`, [g, m], [[], []]);
    await ctx.close();
  }

  // ---------- UI21 กล่องออเดอร์ยุบ/ขยาย (Tee 2026-10-15) แนวนอนเท่านั้น · แนวตั้งคงแบบเดิม ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:!label.startsWith('ipad'), reducedMotion:'reduce', deviceScaleFactor: label === 'landscape' ? 2 : 1});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui21-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const nap = ms => page.waitForTimeout(ms || 150), wide = vp.width > 900;
    const st = () => page.evaluate(() => { const v = id => { const e = document.getElementById(id); if(!e) return false; const b = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && b.width > 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.top >= 0; };
      return {cls:['picking', 'cartopen'].filter(c => document.body.classList.contains(c)).join(' '), mini:v('cartMini'), pay:v('btnPay') || v('btnPay2'), back:v('cartBack'), card:Math.round(document.querySelector('main > .card').getBoundingClientRect().width)}; });
    const chips = () => page.evaluate(() => [...document.querySelectorAll('#builder .tops .topw')].map(w => { const b = w.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','); }).join(' '));
    const R = {};
    /* ขายไว้ 1 แก้วก่อน (มีของในตะกร้า กดชำระเงินได้) */
    await page.click('[data-menu="acai"]'); await page.click('[data-honey="normal"]'); await page.click('#btnAdd'); await nap();
    R.home = await st();
    await page.click('[data-menu="greek"]'); await nap(); R.picked = await st();
    await page.click('[data-size="g1"]'); for(const t of ['Banana', 'Banana', 'Mango', 'Kiwi', 'Granola']) await page.click(`[data-pick="${t}"]`);
    await page.click('.sep'); await page.click('[data-honey="normal"]'); await nap();
    const sel0 = await page.evaluate(() => JSON.stringify(sel)), c0 = await chips();
    /* Greek ทั้งขั้นอยู่ระหว่างแถบหัวกับแถบล่าง ตอนกล่องยุบ */
    R.fit = await page.evaluate(() => { scrollTo(0, 0); const hdr = document.querySelector('header').getBoundingClientRect().bottom, bar = document.getElementById('actBar').getBoundingClientRect().top, secs = [...document.querySelectorAll('#builder .sec')].map(s => s.getBoundingClientRect());
      return {ok: secs[0].top >= hdr - 1 && secs[secs.length - 1].bottom <= bar + 1, spare: Math.round(bar - secs[secs.length - 1].bottom)}; });
    if(label === 'landscape') await page.screenshot({path:path.join(SHOTS, `${label}-21-greek-collapsed.png`)});
    if(wide){
      await page.click('#cartMini'); await nap(250); R.open = await st(); const c1 = await chips();
      if(label === 'landscape') await page.screenshot({path:path.join(SHOTS, `${label}-21-cart-overlay.png`)});
      await page.click('#cartBack'); await nap(); R.closed = await st(); const c2 = await chips();
      R.chipsStill = [c0 === c1, c0 === c2]; R.selKept = (await page.evaluate(() => JSON.stringify(sel))) === sel0;
      await page.click('#cartMini'); await nap(250); await page.click('#btnPay');
    } else { R.chipsStill = [true, true]; R.selKept = true; await page.click(await page.isVisible('#btnPay2') ? '#btnPay2' : '#btnPay'); }
    await nap();
    R.ask = await page.evaluate(() => [document.querySelector('#modal h3') && document.querySelector('#modal h3').textContent.trim(), document.querySelector('#modal button.pay') && document.querySelector('#modal button.pay').textContent, !!document.getElementById('pendDrop')]);
    if(label === 'landscape') await page.screenshot({path:path.join(SHOTS, `${label}-21-pending-cup.png`)});
    await page.click('#pendBack'); await nap(); R.afterBack = [await st(), (await page.evaluate(() => JSON.stringify(sel))) === sel0];
    if(wide){ await page.click('#cartMini'); await nap(250); await page.click('#btnPay'); } else await page.click(await page.isVisible('#btnPay2') ? '#btnPay2' : '#btnPay');
    await page.click('#pendDrop'); await nap(); R.dropped = [await page.evaluate(() => sel.menu), !!(await page.$('[data-dine]'))];
    await page.click('[data-dine="dinein"]'); await page.click('[data-method="cash"]'); await page.click('[data-q]'); await page.click('#payOk'); await page.click('#nextOrder'); await nap();
    R.afterPay = await st();
    console.log(`INFO UI21 ${label}: ${JSON.stringify(R)}`);
    const full = wide ? {cls:'', mini:false, pay:true, back:false} : {cls:'', mini:false, pay:true, back:false};
    const pick = (o) => ({cls:o.cls, mini:o.mini, pay:o.pay, back:o.back});
    eq(`UI21 ${label}: ${wide ? 'ปกติ = กล่องเต็ม · เลือกเมนูแล้ว = แถบแคบ (ไม่มีปุ่มชำระ) หน้าเลือกเมนูกว้างขึ้น · แตะแถบ = overlay มีปุ่มกลับไปเลือกต่อ · ยุบกลับ · ชำระเสร็จกลับสถานะปกติ' : 'แนวตั้งคงแบบเดิม (ไม่มีแถบยุบ ปุ่มชำระเงินเห็นตลอด)'}`,
      [pick(R.home), pick(R.picked), wide && R.open ? pick(R.open) : null, wide && R.closed ? pick(R.closed) : null, pick(R.afterPay), wide ? R.picked.card > R.home.card : true],
      wide ? [full, {cls:'picking', mini:true, pay:false, back:false}, {cls:'picking cartopen', mini:false, pay:true, back:true}, {cls:'picking', mini:true, pay:false, back:false}, full, true]
           : [full, {cls:'picking', mini:false, pay:true, back:false}, null, null, full, true]);
    eq(`UI21 ${label}: เปิด/ปิด overlay ปุ่มท็อปปิ้งไม่ขยับ · ตัวเลือกแก้วไม่หาย`, [R.chipsStill, R.selKept], [[true, true], true]);
    eq(`UI21 ${label}: กดชำระเงินตอนแก้วค้าง → ถามก่อน · กลับไปเพิ่มก่อน = ตัวเลือกอยู่ครบ กล่องยุบ · ทิ้งแก้ว = ล้างแก้วแล้วเปิดหน้าชำระเงิน`,
      [R.ask, R.afterBack[1], R.afterBack[0].cls, R.dropped], [['แก้วที่กำลังเลือกยังไม่ได้เพิ่มลงออเดอร์', 'กลับไปเพิ่มก่อน', true], true, 'picking', [null, true]]);
    if(label === 'landscape') eq(`UI21 ${label} (Redmi): Greek ทั้งขั้น (4 อย่าง + แยก + น้ำผึ้ง) เห็นครบในจอตอนกล่องยุบ เหลือ ≥ 60px`, [R.fit.ok, R.fit.spare >= 60], [true, true]);
    await ctx.close();
  }

  // ---------- UI22 หมวดท็อปปิ้ง (Tee 2026-10-15): ไม่มีหมวด Extra แยก · ในหมวดเรียงของฟรีก่อน คิดเงินท้าย · ป้ายราคาของที่คิดเงินสีส้มเสมอ ·
  //            หัวข้อหมวดอยู่บนกลุ่ม ชิดซ้ายแนวเดียวกับปุ่ม · ระยะระหว่างหมวด ≥ 2 เท่าระยะระหว่างแถว · แนวนอน ≥ 5 คอลัมน์ (ยุบแล้ว 6) · ตาราง Greek + หน้าต่างเพิ่ม/เปลี่ยน ----------
  for(const [label, vp, br] of SCREENS){
    const ctx = await br.newContext({viewport:vp, hasTouch:true, isMobile:!label.startsWith('ipad'), reducedMotion:'reduce'});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const page = await ctx.newPage(); watch(page, 'ui22-' + label);
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]'); await enter(page, '1111'); await skipFloat(page);
    const grid = root => page.evaluate(root => {
      const ITEMS = {}; CONFIG.items.forEach(i => ITEMS[i.name] = i);
      const name = w => { const b = w.querySelector('[data-pick],[data-add],[data-choose]'); return b.dataset.pick || b.dataset.add || b.dataset.choose; };
      const orange = s => { const m = getComputedStyle(s).color.match(/\d+/g).map(Number); return m[0] > 140 && m[2] < 60; };
      const cats = [...document.querySelectorAll(root + ' .tcat')], bad = [];
      const rowGaps = [], catGaps = [];
      cats.forEach((c, ci) => {
        const ws = [...c.querySelectorAll('.topw')], names = ws.map(name), gt = c.querySelector('.gt');
        if(gt.textContent.trim() === 'Extra') bad.push('มีหมวด Extra');
        if(new Set(names.map(n => ITEMS[n].cat)).size !== 1) bad.push('ปนหมวด: ' + gt.textContent);
        const firstPaid = names.findIndex(n => ITEMS[n].price > 0); if(firstPaid >= 0 && names.slice(firstPaid).some(n => !(ITEMS[n].price > 0))) bad.push('ของฟรีอยู่หลังของคิดเงิน: ' + gt.textContent);
        ws.forEach((w, i) => { const s = w.querySelector('.top small'); if(ITEMS[names[i]].price > 0 && s.textContent && !orange(s)) bad.push('ป้ายไม่ส้ม: ' + names[i]); if(!(ITEMS[names[i]].price > 0) && s.textContent && orange(s) && !w.classList.contains('over')) bad.push('ป้ายส้มผิด: ' + names[i]); });
        const g = gt.getBoundingClientRect(), f = ws[0].getBoundingClientRect();
        if(g.bottom > f.top + 1 || Math.abs(g.left - f.left) > 1.5) bad.push('หัวข้อไม่อยู่บนกลุ่ม/ไม่ชิดซ้าย: ' + gt.textContent);
        if(parseFloat(getComputedStyle(gt).fontWeight) < 600) bad.push('หัวข้อไม่หนา');
        const tops = [...new Set(ws.map(w => w.getBoundingClientRect().top))]; if(tops.length > 1) rowGaps.push(+(tops[1] - ws[0].getBoundingClientRect().bottom).toFixed(2));
        if(ci) catGaps.push(+(g.top - Math.max(...[...cats[ci - 1].querySelectorAll('.topw')].map(w => w.getBoundingClientRect().bottom))).toFixed(2));
      });
      const cols = getComputedStyle(cats[0].querySelector('.tops')).gridTemplateColumns.split(' ').length;
      return {bad, cols, rowGap: Math.max(0, ...rowGaps), catGap: Math.min(...catGaps)};
    }, root);
    await page.click('[data-menu="greek"]'); await page.click('[data-size="g1"]'); await page.click('[data-pick="Granola"]'); await page.click('[data-pick="Banana"]');
    const G = await grid('#builder');
    await page.click('[data-honey="normal"]'); await page.click('#btnAdd'); if(await page.$('#fewOk')) await page.click('#fewOk');
    await page.click('[data-menu="acai"]'); await page.click('[data-addopen]'); await page.click('#modal [data-add="Blueberries"]'); const A = await grid('#modal'); await page.click('#addsDone');
    await page.click('[data-swap="0"]'); const S = await grid('#modal'); await page.click('#closeX');
    console.log(`INFO UI22 ${label}: Greek ${JSON.stringify(G)} · เพิ่ม ${JSON.stringify(A)} · เปลี่ยน ${JSON.stringify(S)}`);
    const wide = vp.width > 900, okGap = x => x.catGap >= 2 * x.rowGap || x.rowGap === 0;
    eq(`UI22 ${label}: ไม่มีหมวด Extra · ฟรีก่อน คิดเงินท้ายหมวด · ป้ายของที่คิดเงินสีส้ม · หัวข้อหมวดบนกลุ่มชิดซ้าย ตัวหนา · ระหว่างหมวด ≥ 2 เท่าระหว่างแถว${wide ? ' · ตาราง Greek ตอนยุบ 6 คอลัมน์ หน้าต่าง ≥ 5' : ''}`,
      [G.bad, A.bad, S.bad, okGap(G), okGap(A), wide ? G.cols : 6, wide ? A.cols >= 5 : true], [[], [], [], true, true, 6, true]);
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

  eq('UI02 ปุ่มระหว่างขาย (หน้าแรก Acai Greek ตะกร้า ชำระเงิน) ≥ 44×44 px ทั้ง 4 จอ', smallList.filter(s => !/summary$/.test(s.where)).map(s => `${s.l} ${s.w}×${s.h}`), []);

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

  // ---------- D03 เปิดแอป 2 แท็บพร้อมกัน (app/ แบบติดตั้ง ใช้ IndexedDB จริง) · ขายได้ทีละหน้า (tablock.js, Tee 2026-10-16) · UI08 ----------
  {
    const ctx = await browser.newContext({viewport:{width:1280, height:800}});
    await ctx.addInitScript(() => { window.print = () => {}; });
    const shown = pg => pg.evaluate(() => { const e = document.getElementById('tabLock'); return !!e && e.classList.contains('show') && getComputedStyle(e).display !== 'none'; });
    const settle = async pg => { await pg.waitForFunction(() => typeof TAB_STATE !== 'undefined' && TAB_STATE !== 'wait', null, {timeout:6000}); return pg.evaluate(() => TAB_STATE); };
    const A = await ctx.newPage(); watch(A, 'tabA');
    await A.goto(`${BASE}/app/index.html`); await A.waitForSelector('#lgName');
    await A.fill('#lgName', 'เจ้าของ'); await A.fill('#lgCode', '1234'); await A.fill('#lgCode2', '1234'); await A.click('#lgSave'); await A.click('#lgDone'); await skipFloat(A);
    const stA = await settle(A);
    const sell = async (pg, menu) => { await pg.click(`[data-menu="${menu}"]`); if(await pg.$('[data-honey]')) await pg.click('[data-honey="normal"]'); await pg.click('#btnAdd');
      await pg.click('#btnPay'); await pg.click('[data-dine="dinein"]'); await pg.click('[data-method="tcp"]'); await pg.click('#payOk'); const s = await pg.evaluate(() => ({id:lastSale.id, no:lastSale.no})); await pg.click('#nextOrder'); return s; };
    const mode = await A.evaluate(() => STORE_MODE);
    const a1 = await sell(A, 'acai');

    // แท็บที่สอง: ขึ้นจอ "แอปเปิดอยู่อีกหน้าแล้ว" ขายไม่ได้ แม้เรียก confirmPay ตรง
    const B = await ctx.newPage(); watch(B, 'tabB');
    await B.goto(`${BASE}/app/index.html`); await B.waitForSelector('#builder');
    const stB = await settle(B);
    await B.screenshot({path:path.join(SHOTS, 'd03-second-tab.png')});
    const bTry = await B.evaluate(() => { const n = loadSales().length; cart = [{menu:'banana', name:'Banana Choco', sizeName:'', tops:[], note:'', unit:149, qty:1, key:'x'}]; pay = {dining:'dinein', method:'tcp', received:0}; confirmPay(); return loadSales().length - n; });
    eq('D03 แท็บแรกขายได้ · แท็บที่สองขึ้นจอ "แอปเปิดอยู่อีกหน้าแล้ว" + ปุ่ม "ใช้หน้านี้แทน" และบันทึกบิลไม่ได้', [stA, stB, await shown(A), await shown(B), await B.textContent('#tabLock .lgtitle').then(t => t.trim()), await B.textContent('#tabTake'), bTry],
      ['own', 'other', false, true, 'แอปเปิดอยู่อีกหน้าแล้ว', 'ใช้หน้านี้แทน', 0]);

    // กด "ใช้หน้านี้แทน": แท็บเก่าหยุดขายทันทีและขึ้นจอเดียวกัน · แท็บนี้โหลดใหม่ได้บิลล่าสุด เลขต่อจากแท็บเก่า
    await Promise.all([B.waitForEvent('load'), B.click('#tabTake')]); await B.waitForSelector('#builder'); await skipFloat(B);
    const stB2 = await settle(B);
    await A.waitForFunction(() => TAB_STATE === 'other', null, {timeout:4000}).catch(() => {});
    await A.screenshot({path:path.join(SHOTS, 'd03-old-tab-stopped.png')});
    const aTry = await A.evaluate(() => { const n = loadSales().length; cart = [{menu:'banana', name:'Banana Choco', sizeName:'', tops:[], note:'', unit:149, qty:1, key:'x'}]; pay = {dining:'dinein', method:'tcp', received:0}; confirmPay(); return loadSales().length - n; });
    const b1 = await sell(B, 'banana'), b2 = await sell(B, 'acai');
    eq('D03 ใช้หน้านี้แทน: แท็บใหม่ขายได้ ไม่ต้องเข้าระบบใหม่ · แท็บเก่าหยุดขาย ขึ้นข้อความเดียวกัน บันทึกไม่ได้ · เลขต่อกัน', [stB2, await shown(B), await A.evaluate(() => TAB_STATE), await shown(A), await A.textContent('#tabLock .lgtitle').then(t => t.trim()), aTry, [a1.no, b1.no, b2.no]],
      ['own', false, 'other', true, 'แอปเปิดอยู่อีกหน้าแล้ว', 0, [1, 2, 3]]);

    // รีเฟรช / แอปถูกปิดแล้วเปิดใหม่: ห้ามติดหน้านี้
    await B.reload(); await B.waitForSelector('#builder'); await skipFloat(B);
    const stR = await settle(B), shR = await shown(B);
    await B.close();
    const C = await ctx.newPage(); watch(C, 'tabC');
    await C.goto(`${BASE}/app/index.html`); await C.waitForSelector('#builder'); await skipFloat(C);
    const stC = await settle(C), shC = await shown(C);
    eq('D03 รีเฟรชหน้าที่ขายอยู่ = ไม่ติดจอเปิดซ้อน · ปิดหน้าแล้วเปิดใหม่ = ขายได้ทันที', [stR, shR, stC, shC], ['own', false, 'own', false]);
    const c1 = await sell(C, 'banana');
    await A.reload(); await A.waitForSelector('#builder'); await settle(A);
    const after = await C.evaluate(() => loadSales().map(s => s.no));
    const lsCount = await C.evaluate(() => JSON.parse(localStorage.getItem(KEY)).length);
    console.log(`INFO D03 โหมด ${mode} · A #${a1.no} · B #${b1.no} #${b2.no} · C #${c1.no} · หลังรีโหลด ${JSON.stringify(after)} · localStorage ${lsCount} บิล · A หลังรีโหลด ${await A.evaluate(() => TAB_STATE)}`);
    eq('D03 บิลครบ 4 ใบ เลขออเดอร์ไม่ซ้ำ · สำเนา localStorage ครบ · แท็บเก่ารีโหลดขณะอีกหน้าขายอยู่ = ขึ้นจอเปิดซ้อน', [after.length, new Set(after).size, lsCount, await A.evaluate(() => TAB_STATE), await shown(A)], [4, 4, 4, 'other', true]);
    await A.close();
    // UI08 5,000 บิลในเบราว์เซอร์จริง
    await C.evaluate(() => { const base = Date.now() - 5000 * 6 * 3600000, list = [];
      for(let i = 0; i < 5000; i++){ const t = base + i * 6 * 3600000; const P = priceItem(MENU.acai, {comps:MENU.acai.defaults.slice(), adds:[], sep:false});
        list.push({id:t, no:(i % 4) + 1, date:bizDate(new Date(t)), ts:new Date(t).toISOString(), dining:'dinein', items:[{menu:'acai', name:'Acai', sizeName:'', tops:P.tops, honey:'normal', note:'', unit:P.unit, qty:1}], total:P.unit, method:'cash', received:P.unit, change:0, void:false, staff:'เจ้าของ'}); }
      saveSales(list); });
    await C.waitForTimeout(500);
    const ms = async fn => { const t = Date.now(); await fn(); return Date.now() - t; };
    const tAll = await ms(async () => { await C.click('#btnSummary'); await C.click('[data-range="all"]'); });
    const tBills = await ms(() => C.click('[data-tab="bills"]'));
    await C.click('#closeX');
    const tSale = await ms(() => sell(C, 'banana'));
    console.log(`INFO UI08 Chromium (เดสก์ท็อป) 5,000 บิล: สรุปทั้งหมด ${tAll} ms · แท็บบิล ${tBills} ms · ขาย 1 บิลทั้งขั้นตอน ${tSale} ms`);
    eq('UI08 Chromium: เปิดสรุปทั้งหมด / แท็บบิล / ขาย 1 บิล กับ 5,000 บิล < 1.5 วินาที', [tAll < 1500, tBills < 1500, tSale < 1500], [true, true, true]);
    await ctx.close();
  }

  // ---------- S01 ตั๋วตัวอย่างในเบราว์เซอร์จริง (ฟอนต์จริง) → PNG ขาวดำแบบที่ส่งไปปริ้นเตอร์ ----------
  {
    const SL = path.join(SHOTS, 'slips'); fs.mkdirSync(SL, {recursive:true});
    const ctx = await browser.newContext({viewport:{width:1280, height:800}});
    const page = await ctx.newPage(); watch(page, 'slips');
    await page.goto(`${BASE}/prototype/pos-demo.html`); await page.waitForSelector('[data-kp="1"]');
    const res = await page.evaluate(async () => {
      const t0 = performance.now(), ready = await slipFontsReady(), wait = Math.round(performance.now() - t0);
      const g = document.createElement('canvas').getContext('2d'), w = f => { g.font = f; return g.measureText('กขฃคฅฆง ฿1,234').width; };
      const usesPlex = w(`400 26px ${SLIP_FONT}`) !== w('400 26px sans-serif');
      const ts = new Date(2026, 9, 15, 12, 30).toISOString();
      const acai = [{name:'Mango', n:1, extra:0, from:'Banana'}, {name:'Strawberries', n:1, extra:0, from:null, removed:true}, {name:'Blueberries', n:1, extra:0, from:null},
        {name:'Granola', n:1, extra:0, from:null, removed:true}, {name:'Flaxseeds', n:1, extra:0, from:null}];
      const greek = {menu:'greek', name:'Greek Yogurt', sizeName:'2 สกู๊ป', tops:[{name:'Banana', n:3, extra:0}, {name:'Mango', n:1, extra:15}, {name:'Granola', n:1, extra:10}], honey:'normal', note:'แพ้ถั่ว', unit:154, qty:1};
      const base = {no:42, ts, dining:'dinein', staff:'ทดสอบ', method:'cash', total:562, received:1000, change:438,
        items:[greek, {menu:'acai', name:'Acai', sizeName:'', tops:[...acai, {name:'Chia', n:1, extra:15, from:null, add:true}], honey:'none', unit:204, qty:2}]};
      const long = {no:108, ts, dining:'takeaway', staff:'ทดสอบ', method:'promptpay', total:1062, items:[
        {...greek, note:'แพ้ถั่วลิสง ห้ามใส่เนยถั่ว ใช้ช้อนใหม่'},
        {menu:'acai', name:'Acai', sizeName:'', tops:acai.map(t => t.name === 'Flaxseeds' || t.name === 'Blueberries' ? {...t, removed:true} : t), honey:'side', note:'', unit:189, qty:2, sep:5},
        {menu:'banana', name:'Banana Choco', sizeName:'', tops:[{name:'Banana', n:1, extra:0, from:null}, {name:'Cacao peanut butter', n:1, extra:0, from:null, removed:true}, {name:'Cashew', n:1, extra:0, from:null, removed:true}, {name:'Chocolate Chips', n:1, extra:0, from:null, removed:true}, {name:'Kiwi', n:2, extra:30, from:null, add:true}], unit:179, qty:1, note:'ไม่เอาช็อกโกแลต'},
        {menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Chia', n:1, extra:0}, {name:'Cherry Jelly', n:2, extra:0}, {name:'Biscoff Crumble', n:1, extra:0}, {name:'Hazelnut spread', n:1, extra:15}], honey:'little', unit:104, qty:3, fewTops:undefined, note:'แก้วที่ 3 ใส่ถ้วยใหญ่'}]};
      const shots = {'1-receipt': receiptBlocks(base), '2-kitchen-dinein': kitchenBlocks(base), '3-kitchen-takeaway': kitchenBlocks({...base, no:43, dining:'takeaway'}), '4-long-order-receipt': receiptBlocks(long), '4-long-order-kitchen': kitchenBlocks(long)};
      return {ready, wait, usesPlex, out:Object.entries(shots).map(([k, b]) => {
        const c = renderSlip(b), r = rasterize(c.getContext('2d').getImageData(0, 0, c.width, c.height)), v = document.createElement('canvas'); v.width = c.width; v.height = c.height;
        const x = v.getContext('2d'), img = x.createImageData(c.width, c.height);
        for(let y = 0; y < c.height; y++) for(let i = 0; i < c.width; i++){ const k2 = (y * c.width + i) * 4, on = r.bits[y * r.widthBytes + (i >> 3)] & (0x80 >> (i & 7)); img.data[k2] = img.data[k2 + 1] = img.data[k2 + 2] = on ? 0 : 255; img.data[k2 + 3] = 255; }
        x.putImageData(img, 0, 0);
        return {k, w:c.width, h:c.height, bytes:canvasCmds(c).length, png:v.toDataURL('image/png')};
      })};
    });
    res.out.forEach(o => { fs.writeFileSync(path.join(SL, o.k + '.png'), Buffer.from(o.png.split(',')[1], 'base64')); console.log(`INFO S01 ${o.k}: ${o.w}×${o.h} จุด · ${o.bytes.toLocaleString()} byte`); });
    const pair = res.out.filter(o => /^[12]-/.test(o.k)).reduce((a, o) => a + o.bytes, 0);
    console.log(`INFO S01 ใบเสร็จ + ตั๋วครัว (บิลตัวอย่าง 2 แก้ว) รวม ${pair.toLocaleString()} byte · เดิมที่ทดสอบจริง 109,434 byte ≈ 2.1 วิ → ประมาณ ${(pair / 109434 * 2.1).toFixed(1)} วิ · รอฟอนต์ ${res.wait} ms`);
    eq('S01 ตั๋ววาดหลังฟอนต์พร้อม และใช้ Plex จริง (ความกว้างข้อความต่างจาก sans-serif)', [res.ready, res.usesPlex], [true, true]);
    eq('S01 ตั๋วทุกใบกว้าง 576 จุด', res.out.map(o => o.w), res.out.map(() => 576));
    await ctx.close();
  }

  eq('Z08 ไม่มี console error ระหว่างใช้งานทุกหน้า', consoleErrors, []);
  if(safari !== browser) await safari.close();
  await browser.close(); server.close();
  console.log('INFO screenshots:', path.relative(ROOT, SHOTS));
  done();
})().catch(async e => { console.error('TEST CRASH', e); process.exit(2); });
