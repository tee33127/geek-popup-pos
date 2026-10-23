// ปริ้นเตอร์ ES-8805U + ลิ้นชัก CD330 (Tee 2026-10-23) ด้วยปริ้นเตอร์จำลองตามค่าที่วัดจากเครื่องจริง (printer-test 23 ต.ค. 2569 · Redmi Pad 2):
//   - รับข้อมูลตอนบัฟเฟอร์ว่าง ~74 KB/วิ (GS r: 57,884 byte ส่งครบใน 779 ms) · หัวพิมพ์ ~40 KB/วิ (GS r ตอบที่ 1,444 ms)
//   - บัฟเฟอร์เล็ก (จำลอง 40 KB): ตั๋วยาวสองใบ 172,830 byte ส่งครบใน ~3.5 วิ (เฉลี่ย ~50 KB/วิ) = เต็มแล้วรับได้เท่าที่พิมพ์ออก · ห้ามนับเป็นสะดุด
//   - ASB ค่าจริง: ปกติ 14 00 00 0F · ฝาเปิด 3C 00 00 0F / 3C 00 0C 0F · กระดาษหมด (ฝาปิด) 1C 00 0C 0F · GS r 1 ตอบ 0x00 เมื่อพิมพ์ + ตัดจบ
//   - ESC p 0 25 250 (ขา 2) ลิ้นชักเปิด · ปริ้นเตอร์จำลองบันทึกว่าเปิดตอนตัดไปแล้วกี่ใบ (ต้องก่อนตั๋วครัวของบิลนั้น)
// เทสต์: ขายปกติ 10 บิลไม่มีใบแทน + ทุกกรณีลิ้นชัก (เงินสดเท่านั้น · ไม่เปิดซ้ำตอนพิมพ์ซ้ำ/ใบแทน/พิมพ์ต่อ · ไม่ได้เชื่อม · ฝาเปิด · ปุ่มบนแถบหัว + log · เปิด/ปิดร้าน · ตั้งค่า)
// เวลาเดินด้วยนาฬิกาจำลอง (tests/vclock.js) ค่าเวลาในแอปเป็นค่าจริงทั้งหมด (ไม่ย่อ)
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {EscPosEmu} = require('../escpos-emu');
const A = require('../auth-helper');
const {VClock} = require('../vclock'), clock = new VClock(), {setInterval, clearInterval, setTimeout} = clock.api;
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }

/* ---------- ปริ้นเตอร์จำลอง ES-8805U (byte ต่อ tick 2 ms) ---------- */
const SIM = {cap:40960, low:20480, usb:148, print:80, tick:2};   // รับ 74 KB/วิ · พิมพ์ 40 KB/วิ · บัฟเฟอร์ 40 KB เต็มแล้วหยุดรับจนเหลือครึ่ง (บิลยาว 2 ใบเฉลี่ย ~49 KB/วิ ตรงกับเครื่องจริง)
const errors = [];
let emu, buf, pipe, accepting, streamTotal, maxStall, fulls, trigger, sendLog;
const reset0 = () => {
  emu = new EscPosEmu(); emu.asbCapable = true; emu.initClearsAsb = true; emu.asbMode = 0x0E;   // เชื่อมอยู่แล้ว ASB เปิดค้าง
  if(pipe) pipe.forEach(p => p.no(new Error('reset')));
  buf = []; pipe = []; accepting = true; streamTotal = 0; maxStall = 0; fulls = 0; trigger = null; sendLog = [];
};
reset0(); emu.asbMode = 0;
setInterval(() => {
  if(!emu.cover && emu.paper && buf.length){ const out = buf.splice(0, Math.min(SIM.print, buf.length)); emu.feedParser(out); if(trigger && trigger.at <= emu.pages.length && emu.page.rows.length >= trigger.rows){ const t = trigger; trigger = null; t.fire(); } }
  if(accepting && SIM.cap - buf.length < 512){ accepting = false; fulls++; }
  if(!accepting && buf.length <= SIM.low) accepting = true;
  let room = accepting ? Math.min(SIM.usb, SIM.cap - buf.length) : 0;
  if(pipe.length && !room){ pipe[0].wait = (pipe[0].wait || 0) + SIM.tick; maxStall = Math.max(maxStall, pipe[0].wait); }
  while(room > 0 && pipe.length){
    const p = pipe[0], n = Math.min(room, p.data.length - p.i);
    for(let j = 0; j < n; j++) buf.push(p.data[p.i + j]);
    p.i += n; room -= n; streamTotal += n;
    if(p.i >= p.data.length){ pipe.shift(); p.ok({status:'ok'}); }
  }
}, SIM.tick).unref();
const dev = {opened:false, productName:'ES-8805U', vendorId:0x0483, productId:0x5743, configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}, {endpointNumber:2, direction:'in', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){}, async releaseInterface(){},
  async close(){ this.opened = false; pipe.forEach(p => p.no(new Error('transfer cancelled'))); pipe = []; },
  transferIn(){ const me = this; return new Promise((ok, no) => { const t = setInterval(() => { if(!me.opened){ clearInterval(t); no(new Error('transfer cancelled')); return; } if(!emu.replies.length) return; clearInterval(t); ok({status:'ok', data:new DataView(new Uint8Array([].concat(emu.replies.shift())).buffer)}); }, 2); }); },
  transferOut(ep, data){
    if(!this.opened) return Promise.reject(new Error('device closed'));
    sendLog.push({at:clock.now, n:data.length, head:Array.from(data.slice(0, 3))});
    return new Promise((ok, no) => pipe.push({data:data.slice(), i:0, ok, no})); }};

/* canvas จำลอง: ข้อความ → แถวจุด (เหมือน printer-asb.test.js) · อ่านกลับจากกระดาษได้ */
const enc = new TextEncoder(), dec = new TextDecoder();
const fakeCtx = c => ({font:'', fillStyle:'', textAlign:'', textBaseline:'', measureText: s => ({width: String(s).length * 12}),
  fillRect(){}, fillText(t, x, y){ (c.__ops = c.__ops || []).push({t:String(t), x, y:Math.round(y)}); },
  getImageData: (x0, y0, w, h) => {
    const d = new Uint8ClampedArray(w * h * 4).fill(255), wb = Math.ceil(w / 8), lines = new Map();
    (c.__ops || []).forEach(o => { const k = Math.max(0, o.y - 20); (lines.get(k) || lines.set(k, []).get(k)).push(o); });
    for(const [y, ops] of lines){
      const b = enc.encode(ops.sort((a, b2) => a.x - b2.x).map(o => o.t).join(' ')), chk = b.reduce((a, v) => (a + v) & 255, 0);
      [0xA5, b.length >> 8, b.length & 255, chk, ...b].forEach((v, i) => { const r = y + Math.floor(i / wb), cb = i % wb; if(r < 0 || r >= h) return;
        for(let bit = 0; bit < 8; bit++) if(v & (0x80 >> bit)){ const px = cb * 8 + bit; if(px < w){ const k = (r * w + px) * 4; d[k] = d[k + 1] = d[k + 2] = 0; } } });
    }
    return {width:w, height:h, data:d}; }});
function readText(page){
  const rows = page.rows, out = [];
  for(let r = 0; r < rows.length; r++){
    const row = rows[r]; if(row[0] !== 0xA5) continue;
    const len = row[1] << 8 | row[2], chk = row[3], wb = row.length, need = 4 + len, flat = [];
    for(let i = 0; i < Math.ceil(need / wb) && rows[r + i]; i++) flat.push(...rows[r + i]);
    const data = flat.slice(4, need);
    if(data.length < len || data.reduce((a, v) => (a + v) & 255, 0) !== chk){ out.push('⟂'); continue; }
    out.push(dec.decode(new Uint8Array(data))); r += Math.ceil(need / wb) - 1;
  }
  return out;
}

/* บิลยาวแบบ #026 (ตั๋วครัว ~100 KB) ขายผ่าน confirmPay จริง */
const ITEMS = [{menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Banana', n:2, extra:0}, {name:'Mango', n:1, extra:0}, {name:'Granola', n:1, extra:0}, {name:'Chia', n:1, extra:15}, {name:'Cherry Jelly', n:1, extra:15}, {name:'Biscoff Crumble', n:1, extra:15}], honey:'lots', sep:5, note:'ช้อน 2 อัน', unit:119, qty:1},
  {menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Banana', n:1, extra:0}, {name:'Granola', n:1, extra:0}, {name:'Mango', n:1, extra:0}], honey:'normal', note:'', unit:69, qty:1},
  {menu:'banana', name:'Banana Choco', sizeName:'', tops:[{name:'Banana', n:1, extra:0, from:null}, {name:'Cacao peanut butter', n:1, extra:0, from:null, removed:true}, {name:'Kiwi', n:2, extra:30, from:null, add:true}], unit:179, qty:1, note:'ไม่เอาถั่ว'}];

JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ clock.install(w); A.seed(w);
    w.print = () => errors.push('window.print called'); w.console.warn = () => {}; w.addEventListener('error', e => errors.push(e.message));
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    Object.defineProperty(w.navigator, 'usb', {value:{getDevices: async () => [dev], requestDevice: async () => dev, addEventListener(){}}});
  }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => clock.advance(ms);
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const until = (fn, ms = 8000) => clock.until(fn, ms, 20);
  const busy = () => w.eval('[...PRINTED.values()].some(s => s.kitchen === "wait" || s.receipt === "wait")');
  const idle = () => !busy() && !buf.length && !pipe.length;
  const settle = async () => { await until(() => idle() && w.eval('UNCONF.length') === 0, 30000); await wait(50); };
  const sell = (method = 'cash') => { clock.bump(); return w.eval(`(() => {
    if(document.getElementById('nextOrder')) document.getElementById('nextOrder').click(); else closeModal();
    cart = ${JSON.stringify(ITEMS)}; promo = null; pay = {dining:'dinein', method:'${method}', received:${method === 'cash' ? 1000 : 0}};
    confirmPay(); return lastSale.id; })()`); };
  const S = id => { const k = (kind, redo) => readText(new EscPosEmu().feed(w.eval(`slipBytes([slipBlocks(loadSales().find(s => s.id === ${id}), '${kind}', ${redo ? `{redo:{${kind}:true}}` : 'null'})])`)).pages[0]).join('\n');
    return {k:k('kitchen'), K:k('kitchen', 1), r:k('receipt'), R:k('receipt', 1)}; };
  /* กระดาษที่ออกมา → k/r ใบปกติ · K/R ใบแทนครบ · f เศษ · x ใบแทนไม่ครบ · ใบว่างไม่นับ */
  const paperOf = ids => { const all = ids.map(S); return emu.pages.map(p => { const t = readText(p).join('\n'); if(!t) return ''; for(const s of all) for(const c of 'kKrR') if(s[c] === t) return c; return t.startsWith('ใบแทน') ? 'x' : 'f'; }).join(''); };
  const pulses = () => emu.drawers.map(x => [x.pin, x.t1, x.t2]);
  const drawerLog = () => w.eval('JSON.stringify(cashLog().filter(c => c.type === "drawer").map(c => [c.reason, c.ok, c.by, c.why || null]))');
  const drText = () => (($('#drStatus') || {}).textContent || '').trim();

  w.addEventListener('load', async () => {
    A.signIn(w);
    await until(() => w.eval('!!usbPrinter.asbSeen'), 3000); await settle();
    eq('connect (ES-8805U · board 0483:5743): ASB on by itself, printer ready · header shows "เปิดลิ้นชัก" (drawer on by default)',
      [$('#btnPrinter').textContent.trim(), emu.asbMode, w.eval('asbLive()'), $('#btnDrawer').style.display, $('#btnDrawer').textContent.trim(), w.eval('drawerOn()'), w.eval('drawerPin()')],
      ['ปริ้นเตอร์พร้อม', 0x0E, true, '', 'เปิดลิ้นชัก', true, 2]);
    eq('timings for ES-8805U: head rate 36 KB/s (below measured 40) · job timeout rate 40 KB/s · 5-cup kitchen ticket still 15 s',
      w.eval('[PRINT_WATCH.rate, PRINT_TIMEOUT.rate, jobTimeout(141472), jobTimeout(64760)]'), [36000, 40000, 15000, 15000]);

    // ---------- ปริ้นเตอร์จำลองตรงกับเครื่องจริง: บิลยาว 1 บิล (ตั๋วครัว + ใบเสร็จ) ส่งครบเฉลี่ย ~50 KB/วิ ----------
    {
      reset0(); const id = sell(); await until(() => sendLog.length && !pipe.length && !busy(), 20000);
      const first = sendLog.find(x => x.head[0] === 0x1B && x.head[1] === 0x40).at, n = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${id}))]).length + slipBytes([receiptBlocks(loadSales().find(s => s.id === ${id}))]).length`);
      const kbs = n / ((clock.now - first) / 1000) / 1000;
      console.log(`INFO บิลยาว 1 บิล: ${n} byte ส่งครบใน ${clock.now - first} ms ≈ ${kbs.toFixed(1)} KB/วิ (เครื่องจริง 172,830 byte ใน ~3,470 ms ≈ 50 KB/วิ)`);
      eq('simulated ES-8805U takes data at ~50 KB/s on a long 2-slip bill (real: 172,830 B in ~3.5 s)', kbs > 42 && kbs < 58, true);
      await settle();
    }

    // ---------- ขายเงินสด 10 บิลติดกัน: ลิ้นชักเปิดก่อนตั๋วครัวทุกบิล · ไม่มีใบแทน ----------
    {
      reset0(); w.eval('PLOG.length = 0; usbPrinter.ackMode = "unknown"; usbPrinter.ackMiss = 0'); const ack0 = w.eval('usbPrinter.ackSent');
      const ids = [], t0 = clock.now;
      for(let i = 0; i < 10; i++){ ids.push(sell()); await wait(250); }   // ขายเร็ว: บิลใหม่ก่อนบิลก่อนพิมพ์จบ (บัฟเฟอร์เต็ม รับช้าเป็นช่วงๆ)
      await until(() => idle() && w.eval('UNCONF.length') === 0 && emu.pages.filter(p => readText(p).length).length >= 20, 90000); await wait(300);
      const log = w.eval('PLOG.join(" | ")'), secs = (clock.now - t0) / 1000;
      console.log(`INFO 10 บิล ES-8805U จำลอง: ส่ง ${streamTotal} byte · เฉลี่ย ${Math.round(streamTotal / secs / 1000)} KB/วิ ทั้งช่วง · บัฟเฟอร์เต็ม ${fulls} ครั้ง · ก้อนค้างนานสุด ${maxStall} ms`);
      eq('10 cash bills in a row on a small-buffer printer (~50 KB/s): USB chunks wait longer than PRINT_WATCH.stall, yet with ASB that is NOT a stumble · every slip once, kitchen then receipt · no replacement · no orange bar · no stall/stumble in the log',
        [maxStall > w.eval('PRINT_WATCH.stall'), paperOf(ids), /ใบแทน|stumble|stall|slow|asb →/.test(log), !!$('#printFail'), w.eval(`[${ids}].filter(id => (PRINTED.get(id) || {}).redo).length`)], [true, 'kr'.repeat(10), false, false, 0]);
      eq('10 cash bills: drawer opened exactly once per bill (pin 2 = ESC p 0 25 250), each time BEFORE that bill\'s kitchen ticket',
        [pulses().length, emu.drawers.map(x => x.pages), pulses().every(p => JSON.stringify(p) === '[0,25,250]')], [10, ids.map((_, i) => i * 2), true]);
      eq('drawer command is not a slip: GS r only on the 20 slips (all answered) · no drawer entry in PRINTED/UNCONF · sales do not add drawer log rows',
        [w.eval('usbPrinter.ackSent') - ack0, emu.acks, w.eval('UNCONF.length'), w.eval(`[${ids}].every(id => Object.keys(PRINTED.get(id)).sort().join() === 'kitchen,receipt,sent')`), drawerLog()], [20, 20, 0, true, '[]']);
      eq('success screen of a cash bill: drawer opened fine = no drawer warning', [!!$('#drStatus'), drText()], [true, '']);
    }

    // ---------- PromptPay / ไทยช่วยไทย ไม่เปิดลิ้นชัก ----------
    {
      await settle(); reset0();
      const a = sell('promptpay'); await settle(); const b = sell('tcp'); await settle();
      eq('PromptPay and ไทยช่วยไทย: slips print, drawer NOT opened, no drawer line on the success screen', [paperOf([a, b]), pulses().length, !!$('#drStatus')], ['krkr', 0, false]);
    }

    // ---------- ฝาเปิดแป๊บเดียวกลางตั๋วครัว: ใบแทนพิมพ์ต่อเอง ลิ้นชักไม่เปิดซ้ำ · กดพิมพ์ซ้ำ/สรุปยอด ก็ไม่เปิด ----------
    {
      await settle(); reset0();
      const id = sell();
      trigger = {at:0, rows:300, fire: () => { emu.setCover(true); emu.loseRows = 40; setTimeout(() => emu.setCover(false), 1000); }};   // หัวพิมพ์ถึงแถว 300 ของตั๋วครัว
      await until(() => emu.cover, 10000); await until(() => !emu.cover, 3000);
      await until(() => idle() && !$('#printFail') && paperOf([id]).replace(/f/g, '').endsWith('Kr'), 20000); await settle();
      eq('lid blinks mid kitchen ticket (cash bill): replacement kitchen + receipt print by themselves · drawer opened ONCE (not again on resume)', [paperOf([id]).replace(/f/g, '').replace(/^k(?=K)/, ''), pulses().length, emu.drawers[0].pages], ['Kr', 1, 0]);
      $('#prKitchen').click(); await settle(); $('#prReceipt').click(); await settle();
      w.eval(`printSale(loadSales().find(s => s.id === ${id}), 'both', true)`); await settle();   // = ปุ่มใบเสร็จ/ตั๋วครัวในสรุปยอด แท็บบิล
      eq('reprint from success screen and from summary: slips print again as replacements · drawer still opened once', [paperOf([id]).replace(/f/g, '').slice(-4), pulses().length], ['KRKR', 1]);
    }

    // ---------- ฝาเปิดอยู่ตอนรับเงินสด: ไม่ส่งคำสั่งลิ้นชัก บอกให้ใช้กุญแจ · ปิดฝาแล้วตั๋วออก ลิ้นชักไม่เด้งเองทีหลัง ----------
    {
      await settle(); reset0();
      emu.setCover(true); await until(() => w.eval('!!UsbPrinter.asbTrouble(usbPrinter.asb)'), 2000);
      const id = sell(); await wait(300);
      eq('lid open while taking cash: bill saved · drawer command not sent · success screen says use the key + why', [w.eval(`loadSales().some(s => s.id === ${id})`), pulses().length, sendLog.some(x => x.head[0] === 0x1B && x.head[1] === 0x70), drText(), $('#drStatus').className.includes('warn')],
        [true, 0, false, 'ลิ้นชักไม่เปิด — ใช้กุญแจเปิด · ปริ้นเตอร์ไม่พร้อม (ฝาเปิดหรือกระดาษหมด)', true]);
      emu.setCover(false); await until(() => idle() && !$('#printFail') && paperOf([id]).includes('k'), 15000); await settle();
      eq('lid closed: slips print by themselves · drawer never opens later', [paperOf([id]).replace(/f/g, ''), pulses().length], ['kr', 0]);
    }

    // ---------- กระดาษหมด (ASB 1C 00 0C 0F) ตอนรับเงินสด ----------
    {
      await settle(); reset0();
      emu.setPaper(false); await until(() => w.eval('UsbPrinter.asbTrouble(usbPrinter.asb)') === 'paper', 2000);
      eq('paper out ASB = 1C 00 0C 0F (measured on ES-8805U) → app reads "paper"', w.eval('usbPrinter.asb.raw'), [0x1C, 0x00, 0x0C, 0x0F]);
      const id = sell(); await wait(300);
      eq('paper out while taking cash: drawer not sent · use the key', [pulses().length, drText().startsWith('ลิ้นชักไม่เปิด — ใช้กุญแจเปิด')], [0, true]);
      emu.setPaper(true); await until(() => idle() && !$('#printFail') && paperOf([id]).includes('r'), 15000); await settle();
      eq('paper back: slips print, drawer not opened later', [paperOf([id]).replace(/f/g, ''), pulses().length], ['kr', 0]);
    }

    // ---------- ปริ้นเตอร์ไม่ได้เชื่อม: ขายต่อได้ บอกให้ใช้กุญแจ · เชื่อมทีหลังพิมพ์ตั๋วที่ค้าง ไม่เปิดลิ้นชัก ----------
    {
      await settle(); reset0();
      w.eval('usbPrinter.forget(); renderPrinterBtn()');
      const id = sell(); await wait(100);
      eq('not connected: bill saved · success screen says the drawer did not open (use the key) and why · header button still there', [w.eval(`loadSales().some(s => s.id === ${id})`), drText(), $('#btnDrawer').style.display],
        [true, 'ลิ้นชักไม่เปิด — ใช้กุญแจเปิด · ยังไม่ได้เชื่อมปริ้นเตอร์', '']);
      $('#prConnect').click(); await until(() => idle() && paperOf([id]).includes('r'), 15000); await settle();
      eq('connect afterwards: pending slips print · drawer NOT opened (staff already used the key)', [paperOf([id]).replace(/f/g, ''), pulses().length], ['kr', 0]);
    }

    // ---------- ปุ่ม "เปิดลิ้นชัก" บนแถบหัว: เลือกเหตุผล → เปิด + บันทึก (ใคร/เวลา/เหตุผล) ----------
    {
      await settle(); reset0(); w.eval('closeModal()');
      const ack0 = w.eval('usbPrinter.ackSent');
      $('#btnDrawer').click();
      eq('header "เปิดลิ้นชัก": asks a reason first (แลกเงิน / นับเงิน / อื่นๆ) · nothing sent yet', [[...d.querySelectorAll('#modal [data-drwhy]')].map(b => b.textContent), pulses().length], [['แลกเงิน', 'นับเงิน', 'อื่นๆ'], 0]);
      $('#modal [data-drwhy="change"]').click(); await settle();
      A.signIn(w, '1111'); $('#btnDrawer').click(); $('#modal [data-drwhy="other"]').click(); await settle();
      eq('pick reason → drawer opens · staff can use it too · log has who + reason · not a slip (no GS r, no PRINTED change)',
        [pulses().length, drawerLog(), w.eval('usbPrinter.ackSent') - ack0, emu.pages.length], [2, JSON.stringify([['change', true, 'เจ้าของ', null], ['other', true, 'แพร', null]]), 0, 0]);
      w.eval('usbPrinter.forget(); renderPrinterBtn()');
      $('#btnDrawer').click(); $('#modal [data-drwhy="count"]').click(); await wait(50);
      eq('header button while printer not connected: nothing sent · message says use the key · logged as not opened', [pulses().length, d.body.textContent.includes('ลิ้นชักไม่เปิด — ใช้กุญแจเปิด'), JSON.parse(drawerLog()).pop()], [2, true, ['count', false, 'แพร', 'nocon']]);
      $('#btnPrinter').click(); await settle(); A.signIn(w, '1234');
    }

    // ---------- เปิดร้าน (เงินทอนตั้งต้น) และปิดร้าน (นับเงิน): เปิดลิ้นชักให้ 1 ครั้ง + log ----------
    {
      await settle(); reset0();
      w.eval('askFloat()'); await settle();
      eq('open shop (starting change): drawer opens once by itself · logged "เปิดร้าน" · no warning in the window', [pulses().length, JSON.parse(drawerLog()).pop(), drText()], [1, ['open', true, 'เจ้าของ', null], '']);
      $('#floatIn').value = '1000'; w.eval('floatInput()'); $('#floatOk').click();
      w.eval('openClose()'); await settle();
      $('#clCount').value = '1000'; w.eval('closeInput()'); await wait(50);
      eq('close shop / count cash: drawer opens once when the window opens (typing does not reopen) · logged "ปิดร้าน"', [pulses().length, JSON.parse(drawerLog()).pop()], [2, ['close', true, 'เจ้าของ', null]]);
      w.eval("REP.from = REP.to = bizDate(new Date()); REP.tab = 'pay'; renderSummary()");
      const tblText = [...d.querySelectorAll('#modal .sec2')].map(x => x.textContent);
      const csv = w.eval('repCsv.rows'), hdr = csv.findIndex(r => r[1] === 'เวลาเปิดลิ้นชัก');
      eq('summary → payment tab: "เปิดลิ้นชัก" table lists reason / who / result · CSV of the tab has the same rows',
        [tblText.includes('เปิดลิ้นชัก'), d.querySelector('#modal').textContent.includes('แลกเงิน'), hdr > 0, csv.slice(hdr + 1).map(r => [r[2], r[3], r[4]])],
        [true, true, true, [['ปิดร้าน / นับเงิน', 'เจ้าของ', 'เปิดแล้ว'], ['เปิดร้าน', 'เจ้าของ', 'เปิดแล้ว'], ['นับเงิน', 'แพร', 'ไม่เปิด (ยังไม่ได้เชื่อมปริ้นเตอร์)'], ['อื่นๆ', 'แพร', 'เปิดแล้ว'], ['แลกเงิน', 'เจ้าของ', 'เปิดแล้ว']]]);
      eq('drawer rows do not change the cash count (float / expected stay from open + close entries)', w.eval('dayFloat(bizDate(new Date()))'), 1000);
    }

    // ---------- ตั้งค่า (เจ้าของ): ทดสอบ · ขั้นสูง ขา 5 · ปิดใช้ลิ้นชัก ----------
    {
      await settle(); reset0();
      $('#btnSettings').click();
      eq('owner settings: "ใช้ลิ้นชักเก็บเงิน" switch on · test button · pin choice hidden under ขั้นสูง (pin 2 default)',
        [$('#drSwitch').getAttribute('aria-checked'), !!$('#drTest'), $('#drAdv').open, [...d.querySelectorAll('#modal [data-drpin]')].map(b => [b.textContent, b.classList.contains('on')])],
        ['true', true, false, [['ขา 2 (ปกติ)', true], ['ขา 5', false]]]);
      $('#modal [data-drpin="5"]').click();
      eq('pick pin 5: saved · ขั้นสูง stays open after redraw', [w.eval('SETTINGS.drawerPin'), $('#drAdv').open, $('#modal [data-drpin="5"]').classList.contains('on')], [5, true, true]);
      $('#drTest').click(); await settle();
      eq('test button: ESC p 1 (pin 5) · logged "ทดสอบ"', [pulses(), JSON.parse(drawerLog()).pop()], [[[1, 25, 250]], ['test', true, 'เจ้าของ', null]]);
      $('#modal [data-drpin="2"]').click(); eq('back to pin 2', w.eval('drawerPin()'), 2);
      $('#drSwitch').click();
      eq('switch off: saved · header button hidden · test/pin hidden', [w.eval('SETTINGS.drawer'), $('#btnDrawer').style.display, !!$('#drTest'), !!$('#drAdv')], [false, 'none', false, false]);
      w.eval('closeModal()'); const n = pulses().length;
      const id = sell(); await settle(); w.eval('closeModal(); openClose()'); await settle();
      eq('drawer off: cash sale prints normally, no drawer command, no drawer line · open/close shop does not open it either', [paperOf([id]).replace(/f/g, ''), pulses().length - n, !!$('#drStatus')], ['kr', 0, false]);
      w.eval('closeModal()'); A.signIn(w, '1111'); $('#btnSettings').click();
      eq('staff: no drawer settings · cannot change from code', [!!$('#drSwitch'), w.eval('setDrawer({...SETTINGS, drawer:true})'), w.eval('SETTINGS.drawer')], [false, false, false]);
      A.signIn(w, '1234'); $('#btnSettings').click(); $('#drSwitch').click();
      eq('owner turns it back on: header button back', [w.eval('drawerOn()'), $('#btnDrawer').style.display, 'drawer' in w.eval('SETTINGS')], [true, '', false]);
    }

    eq('no runtime errors, never window.print', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
