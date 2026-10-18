// ใบที่สะดุดกลางคัน → ตัดเศษทิ้ง พิมพ์ใหม่ทั้งใบเป็น "ใบแทน" + พิมพ์ต่อเองเมื่อเครื่องพร้อม + ตั๋วครัวก่อน + ปริ้นเตอร์ถูกอีกหน้าจับไว้
// (H32 H33 H34 H35 · Tee 2026-10-17)
// ปริ้นเตอร์จำลองแบบมีบัฟเฟอร์ (เหมือนเครื่องจริง): USB รับข้อมูลเข้าบัฟเฟอร์ 8 KB แล้วถือว่า "ส่งครบ" ทั้งที่ยังไม่ได้พิมพ์ · หัวพิมพ์ค่อยๆ พิมพ์ออก
//   ฝาเปิด = หัวพิมพ์หยุด บัฟเฟอร์เต็มแล้ว USB ค้าง · ตอบสถานะ (DLE EOT) ทันที 0x36/0x72 · กระดาษหมด 0x32/0x72
//   drop = 'close' เครื่องทิ้งข้อมูลในบัฟเฟอร์ตอน USB ถูกปิด/เชื่อมใหม่ · 'cover' ทิ้งตอนฝาเปิด (ไม่รู้ว่า XP-Q807K แบบไหน ทดสอบทั้งสอง)
// ถอดข้อความจากภาพ: canvas จำลองเขียนข้อความแต่ละบรรทัดเป็นแถวจุด (มี checksum) → อ่านกลับจากกระดาษที่ปริ้นเตอร์จำลองพิมพ์ เทียบกับบิล บรรทัดขาด/ครึ่งบรรทัดจับได้
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {finish} = require('../flow-helper');
const {EscPosEmu} = require('../escpos-emu');
const A = require('../auth-helper');
/* นาฬิกาจำลอง (tests/vclock.js): หน้า + ปริ้นเตอร์จำลองใช้เวลาเดียวกัน ผลไม่ขึ้นกับความเร็วเครื่อง · setTimeout/setInterval ในไฟล์นี้ = ของนาฬิกาจำลอง
   wait(ms) = เดินเวลาจำลอง ms (ทุกตัวจับเวลาถึงกำหนดทำตามลำดับ) · until(cond, ms) = เดินจน cond จริง เพดาน ms เป็นเวลาจำลอง */
const {VClock} = require('../vclock'), clock = new VClock(), {setTimeout, setInterval, clearTimeout, clearInterval} = clock.api;
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }

/* ---------- ปริ้นเตอร์มีบัฟเฟอร์ ---------- */
const BP = {cap:8192, per:4096, tick:3, drop:'close', jam:false, nak:false};   // nak = บัฟเฟอร์เต็มแล้วคำถามสถานะก็ส่งไม่เข้า (USB NAK ทุก OUT)   // per = หัวพิมพ์พิมพ์กี่ byte ต่อ tick
const errors = [];
let emu, buf, waiter, streamTotal, printedTotal, jobStarts, trigger, lost, statusHang = false, claimBusy = false, claims = 0, lateSent = 0;
const reset0 = () => { emu = new EscPosEmu(); buf = []; if(waiter){ waiter.no(new Error('reset')); waiter = null; } streamTotal = 0; printedTotal = 0; jobStarts = []; trigger = null; lost = 0; BP.jam = false; };
reset0();
/* ตำแหน่งใน stream = ทุก byte ที่เข้าบัฟเฟอร์ (ข้อมูล + คำถามสถานะ) · หัวพิมพ์พิมพ์ตามลำดับเดียวกัน */
function pump(){
  if(!waiter) return;
  while(waiter.i < waiter.data.length && buf.length < BP.cap){ const n = Math.min(64, waiter.data.length - waiter.i); for(let j = 0; j < n; j++) buf.push(waiter.data[waiter.i + j]); waiter.i += n; streamTotal += n; }
  if(waiter.i >= waiter.data.length){ const w = waiter; waiter = null; w.ok({status:'ok'}); }
}
setInterval(() => {
  if(!emu.cover && emu.paper && !BP.jam && buf.length){
    const stop = trigger && jobStarts[trigger.job - 1] !== undefined ? jobStarts[trigger.job - 1] + trigger.at - printedTotal : Infinity;   // หยุดตรงจุดที่ฝาเปิดพอดี
    const out = buf.splice(0, Math.max(1, Math.min(BP.per, buf.length, stop))); emu.feedParser(out); printedTotal += out.length;
    if(trigger && jobStarts[trigger.job - 1] !== undefined && printedTotal >= jobStarts[trigger.job - 1] + trigger.at){   // ฝาเปิด/กระดาษหมด ตอนหัวพิมพ์ถึงตำแหน่งนี้ของใบ
      const t = trigger; trigger = null;
      if(t.what === 'cover'){ emu.cover = true; if(BP.drop === 'cover'){ lost += buf.length; buf = []; } }
      else if(t.what === 'blink'){ emu.cover = true; emu.loseRows = 40; setTimeout(() => { emu.cover = false; }, t.ms || 1000); }   // เปิดฝาแป๊บเดียวแล้วปิดเอง: เครื่องพิมพ์ต่อเอง แต่แถวตรงรอยต่อหาย
      else emu.paper = false;
    }
  }
  pump();
}, BP.tick).unref();
const dev = {opened:false, productName:'XP-Q807K', configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}, {endpointNumber:2, direction:'in', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){ claims++; if(claimBusy){ const e = new Error("Failed to execute 'claimInterface' on 'USBDevice': Unable to claim interface."); e.name = 'NetworkError'; throw e; } }, async releaseInterface(){},
  async close(){ this.opened = false; if(waiter){ const w = waiter; waiter = null; w.no(new Error('transfer cancelled')); } if(BP.drop === 'close'){ lost += buf.length; buf = []; } },
  /* แบบ WebUSB: transferIn ค้างรอจนเครื่องมีอะไรส่งกลับ (statusHang = เครื่องไม่ส่งอะไรกลับ) · ปิดการเชื่อม = ยกเลิก */
  transferIn(){ const me = this; return new Promise((ok, no) => { const t = setInterval(() => { if(!me.opened){ clearInterval(t); no(new Error('transfer cancelled')); return; } if(statusHang || !emu.replies.length) return; clearInterval(t); ok({status:'ok', data:new DataView(new Uint8Array([].concat(emu.replies.shift())).buffer)}); }, 2); }); },
  async transferOut(ep, data){
    if(!this.opened){ lateSent += data.length; throw new Error('device closed'); }
    if(data[0] === 0x10 && data[1] === 0x04){
      if(BP.nak && (buf.length >= BP.cap || waiter)) return new Promise((ok, no) => { const t = setInterval(() => { if(!this.opened){ clearInterval(t); no(new Error('closed')); } else if(buf.length < BP.cap && !waiter){ clearInterval(t); emu.reply(data[2]); buf.push(...data); streamTotal += data.length; ok({status:'ok'}); } }, 5); });
      emu.reply(data[2]); buf.push(...data); streamTotal += data.length; return {status:'ok'}; }   // real-time: ตอบทันที byte ไหลเข้าบัฟเฟอร์ตามลำดับ
    if(data[0] === 0x1B && data[1] === 0x40) jobStarts.push(streamTotal + (waiter ? waiter.data.length - waiter.i : 0));
    return new Promise((ok, no) => { waiter = {data, i:0, ok, no}; pump(); }); }};

/* ---------- canvas จำลอง: ข้อความ → แถวจุด (0xA5 len chk data) ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const fakeCtx = c => ({font:'', fillStyle:'', textAlign:'', textBaseline:'', measureText: s => ({width: String(s).length * 12}),
  fillRect(){}, fillText(t, x, y){ (c.__ops = c.__ops || []).push({t:String(t), x, y:Math.round(y)}); },
  getImageData: (x0, y0, w, h) => {
    const d = new Uint8ClampedArray(w * h * 4).fill(255), wb = Math.ceil(w / 8), lines = new Map();
    (c.__ops || []).forEach(o => { const k = Math.max(0, o.y - 20); (lines.get(k) || lines.set(k, []).get(k)).push(o); });
    for(const [y, ops] of lines){
      const b = enc.encode(ops.sort((a, b2) => a.x - b2.x).map(o => o.t).join(' ')), chk = b.reduce((a, v) => (a + v) & 255, 0);
      const bytes = [0xA5, b.length >> 8, b.length & 255, chk, ...b];
      bytes.forEach((v, i) => { const r = y + Math.floor(i / wb), cb = i % wb; if(r < 0 || r >= h) return;
        for(let bit = 0; bit < 8; bit++) if(v & (0x80 >> bit)){ const px = cb * 8 + bit; if(px < w){ const k = (r * w + px) * 4; d[k] = d[k + 1] = d[k + 2] = 0; } } });
    }
    return {width:w, height:h, data:d}; }});
/* อ่านข้อความจากแถวภาพของ 1 ใบ · ครึ่งบรรทัด/ข้อมูลขาด = '⟂' */
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

JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ clock.install(w); A.seed(w);
    w.print = () => errors.push('window.print called'); w.console.warn = () => {}; w.addEventListener('error', e => errors.push(e.message));
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    Object.defineProperty(w.navigator, 'usb', {value:{getDevices: async () => [dev], requestDevice: async () => dev, addEventListener(){}}});
  }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => clock.advance(ms);
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const toasts = [];
  const until = (fn, ms = 4000) => clock.until(fn, ms, 15);   // เช็กทุก 15 ms เวลาจำลอง (เท่าที่เทสต์เดิมเช็ก) · cond ถอดข้อความจากกระดาษ หนัก
  const bar = () => $('#printFail') ? $('#printFail').textContent : '';
  const idle = () => !w.eval('[...PRINTED.values()].some(s => s.kitchen === "wait" || s.receipt === "wait")') && !buf.length && !waiter;
  /* บิลยาวแบบ #017 (Greek ท็อปปิ้งเยอะ + Greek + Banana Choco กินเลย) บันทึกแล้วสั่งพิมพ์แบบหลังชำระเงิน */
  let seq = 0;
  const sellLong = () => w.eval(`(() => {
    if(document.getElementById('nextOrder')) document.getElementById('nextOrder').click();
    const now = new Date(), sales = loadSales(), no = sales.filter(s => s.date === bizDate(now)).length % 999 + 1;
    const s = {id:now.getTime() * 10 + ${++seq % 10}, no, date:bizDate(now), ts:now.toISOString(), dining:'dinein', method:'cash', received:500, change:161, void:false, staff:'ทดสอบ', staffId:'u1', total:339,
      items:[{menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Banana', n:2, extra:0}, {name:'Mango', n:1, extra:0}, {name:'Granola', n:1, extra:0}, {name:'Chia', n:1, extra:15}, {name:'Cherry Jelly', n:1, extra:15}, {name:'Biscoff Crumble', n:1, extra:15}], honey:'lots', note:'ท็อปปิ้งแยกถ้วย ช้อน 2 อัน', unit:114, qty:1},
        {menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Banana', n:1, extra:0}, {name:'Granola', n:1, extra:0}, {name:'Mango', n:1, extra:0}], honey:'normal', note:'', unit:69, qty:1},
        {menu:'banana', name:'Banana Choco', sizeName:'', tops:[{name:'Banana', n:1, extra:0, from:null}, {name:'Cacao peanut butter', n:1, extra:0, from:null, removed:true}, {name:'Kiwi', n:2, extra:30, from:null, add:true}], unit:179, qty:1, note:'ไม่เอาถั่ว'}]};
    sales.push(s); saveSales(sales); lastSale = s;
    openModal(doneHtml(s)); printSale(s, receiptMode() === 'all' ? 'both' : 'kitchen');
    return s.id; })()`);
  const sellShort = () => { clock.bump(); if($('#nextOrder')) $('#nextOrder').click(); $('[data-menu="acai"]').click(); finish(w); $('#btnPay').click(); $('[data-dine="dinein"]').click(); $('[data-method="cash"]').click(); $('[data-q="500"]').click(); $('#payOk').click(); return w.eval('lastSale.id'); };
  /* ข้อความที่ใบควรมี (ปกติ / ใบแทน) จากบล็อกเดียวกับที่แอปส่ง ผ่านปริ้นเตอร์จำลองแบบไม่สะดุด */
  const expect = (id, k, redo) => readText(new EscPosEmu().feed(w.eval(`slipBytes([slipBlocks(loadSales().find(s => s.id === ${id}), '${k}', ${redo ? '{redo:{' + k + ':true}}' : 'null'})])`)).pages[0]);
  /* กระดาษที่ออกมาจริง → k ตั๋วครัว · K ตั๋วครัวใบแทน · r ใบเสร็จ · R ใบเสร็จใบแทน · f เศษ/ไม่ครบ · (ใบว่างไม่นับ) */
  const paper = id => { const S = {k:expect(id, 'kitchen'), K:expect(id, 'kitchen', 1), r:expect(id, 'receipt'), R:expect(id, 'receipt', 1)};
    return emu.pages.map(p => { const t = readText(p); if(!t.length) return ''; const hit = Object.keys(S).find(c => S[c].join('\n') === t.join('\n')); return hit || 'f'; }).join(''); };
  /* ใบที่ตรงกับใบสมบูรณ์ (ปกติ/ใบแทน) ทุกบรรทัด · เศษใบเก่าไม่นับ (เครื่องทิ้งข้อมูลกลางภาพเองแล้วเศษเพี้ยนได้ แอปกันไม่ได้) */
  const completeSlips = id => { const S = [expect(id, 'kitchen'), expect(id, 'kitchen', 1), expect(id, 'receipt'), expect(id, 'receipt', 1)].map(x => x.join('\n'));
    return emu.pages.filter(p => S.includes(readText(p).join('\n'))); };
  const garbage = () => emu.pages.map(p => p.text).join('') + emu.page.text;

  w.addEventListener('load', async () => {
    let id;
    /* เริ่มเคสใหม่: รอบิลก่อนหน้ายืนยันว่าออกแล้ว (ไม่งั้นเปิดฝาทันทีหลังบิลก่อน = บิลก่อนอาจขาด → ใบแทน ซึ่งถูกตามกฎ แต่ทำให้เคสพึ่งกัน) */
    const settle = async () => { await until(() => idle() && w.eval('UNCONF.length') === 0 && !$('#printFail') && !($('#prKitchen') && $('#prKitchen').disabled), 3000); };   // ปุ่มบนหน้าสำเร็จกดได้แล้ว = งานจบจริง
    A.signIn(w);
    /* รันกับโค้ดก่อนแก้ได้ (ยืนยันว่าเทสต์จับบั๊ก): โค้ดเก่าไม่มีใบแทน/การยืนยัน = ถือว่าส่งครบคือออกแล้ว */
    w.eval(`if(typeof slipBlocks === 'undefined') window.slipBlocks = (s, k, st) => (st && st.redo && st.redo[k] ? [{box:'single', text:'ใบแทน — ทิ้งใบก่อนหน้าของ #' + pad(s.no, 3), size:28, bold:true}] : []).concat(k === 'receipt' ? receiptBlocks(s) : kitchenBlocks(s));
      if(typeof PRINT_CONFIRM === 'undefined') window.PRINT_CONFIRM = {ms:0}; if(typeof UNCONF === 'undefined') window.UNCONF = []; if(typeof PRINT_WATCH === 'undefined') window.PRINT_WATCH = {}; if(typeof PLOG === 'undefined') window.PLOG = [];`);
    const t0 = w.toast; w.toast = (m, ...a) => { toasts.push(m); return t0(m, ...a); };
    const WATCH = () => `PRINT_CONFIRM.ms = 150; PRINT_WATCH.ms = 60; PRINT_WATCH.stall = 500; PRINT_WATCH.rate = ${BP.per * 200}`;   // rate ≈ หัวพิมพ์จำลอง (ช้ากว่าไว้นิด)
    w.eval('PRINT_TIMEOUT.min = 2500; PRINT_TIMEOUT.rate = 1e9; PRINT_TIMEOUT.close = 300; PRINT_RESUME.ms = 100; PRINT_RESUME.okMs = 400; PRINTER.statusMs = 150; ' + WATCH());
    await wait(150);
    eq('connected by itself, status endpoint ep2', [$('#btnPrinter').textContent.trim(), w.eval('usbPrinter.epIn')], ['ปริ้นเตอร์พร้อม', 2]);
    if(process.env.EXP){
      for(const [cap, nak] of [[262144, false], [262144, true], [32768, true], [8192, true]]){
        await settle(); reset0(); BP.cap = cap; BP.nak = nak; BP.per = 300; w.eval('PRINT_CONFIRM.ms = 1200; PRINT_RESUME.ms = 2000; PRINTER.statusMs = 500');
        id = sellLong(); const kLen = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${id}))]).length`);
        trigger = {job:1, at:Math.round(kLen * 0.4), what:'cover'};
        await until(() => emu.cover, 5000); const t0 = clock.now;
        await until(() => !!$('#printFail'), 20000); const tBar = clock.now - t0;
        const st1 = JSON.stringify(w.eval(`PRINTED.get(${id})`)), ns = w.eval('usbPrinter.noStatus');
        emu.cover = false; await wait(100); const b = d.querySelector('#printFail .pfbtn'); if(b) b.click();
        await until(() => idle() && !$('#printFail'), 8000); await wait(500);
        console.log(`EXP cap ${cap} nak ${nak}: bar after ${tBar} ms · state ${st1} · noStatus ${ns} · after tap ${JSON.stringify(w.eval(`PRINTED.get(${id})`))} · paper ${paper(id)} · first lines ${JSON.stringify(emu.pages.map(p => readText(p)[0]).filter(Boolean))}`);
      }
      process.exit(0);
    }

    // ---------- H32 ตั๋วครัวก่อนใบเสร็จ · ถอดข้อความได้ครบ ----------
    await settle(); reset0(); id = sellLong(); await until(idle); await wait(300);
    const K0 = expect(id, 'kitchen');
    eq('H32 long bill: kitchen first, then receipt · decoded kitchen text has every item incl. Banana Choco details', [paper(id), K0.some(t => t.includes('Banana Choco')), K0.some(t => t.includes('ไม่เอาถั่ว')), K0.filter(t => t.includes('Greek Yogurt')).length], ['kr', true, true, 2]);
    eq('H32 reprint chooser + success screen: kitchen listed first', w.eval('SLIP_NAME.both'), 'ตั๋วครัว + ใบเสร็จ');

    // ---------- H35 บั๊ก #017: ฝาเปิดตอนท้ายตั๋วครัว ----------
    /* (ก) แบบเดิม "ส่งครบ = ออกแล้ว" (ยืนยันทันทีไม่รอ): ตั๋วครัวทั้งใบเข้าบัฟเฟอร์เครื่องแล้ว แต่หัวพิมพ์ยังไม่ถึงท้าย · ฝาเปิด · ใบเสร็จค้าง → หมดเวลา
       → ปิด/เชื่อมใหม่ → เครื่องทิ้งบัฟเฟอร์ → ท้ายตั๋วครัว (Banana Choco) หาย แต่แอปนับว่าออกแล้ว พิมพ์ต่อเองแค่ใบเสร็จ = อาการเครื่องจริง */
    const lidNearKitchenEnd = async (confirmMs, openWhen) => {
      await settle(); reset0(); BP.drop = 'close'; BP.cap = 24576; w.eval(confirmMs ? WATCH() : 'PRINT_CONFIRM.ms = 0; PRINT_WATCH.ms = 1e9; PRINT_WATCH.stall = 1e9; PRINT_WATCH.rate = 1e9');
      emu.noAck = !confirmMs; w.eval(`usbPrinter.ackMode = '${confirmMs ? 'unknown' : 'no'}'`);   // แบบเดิม = ไม่มี GS r ยืนยัน (ยืนยันด้วย GS r คือกฎใหม่ H40)   // 0 = แบบเดิม: ส่งครบ = ออก ไม่เฝ้าระหว่างพิมพ์ ·   // บัฟเฟอร์ใหญ่พอให้ท้ายตั๋วครัวที่มีข้อความ (Banana Choco) ค้างอยู่ได้ เหมือนที่เกิดจริง
      const sid = sellLong(), kLen = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${sid}))]).length`);
      if(openWhen === 'receipt-start'){ await until(() => jobStarts.length >= 2, 4000); trigger = null; emu.cover = true; }   // ใบเสร็จเริ่มส่งแล้ว ท้ายตั๋วครัวยังอยู่ในบัฟเฟอร์
      else trigger = {job:1, at:kLen - 16000, what:'cover'};
      await until(() => emu.cover, 4000);
      const kStart = jobStarts[0], acc = Math.min(streamTotal - kStart, kLen), pr = printedTotal - kStart;
      await until(() => !!$('#printFail'), 6000);
      return {sid, kLen, acc, pr};
    };
    {
      BP.per = 300;                                           // หัวพิมพ์ช้ากว่า USB (เหมือนเครื่องจริง: ส่งตั๋วครัวครบแล้ว ท้ายใบยังค้างในบัฟเฟอร์)
      const r = await lidNearKitchenEnd(0, 'kitchen-end');
      const st = w.eval(`PRINTED.get(${r.sid})`);
      emu.cover = false; await until(() => !$('#printFail') && idle(), 6000); await wait(300);
      const K = expect(r.sid, 'kitchen'), got = emu.pages.map(readText).filter(t => t.length), kOut = got.find(t => t[0] === K[0]) || [];
      console.log(`INFO H35 (ก) แบบเดิม: ฝาเปิดตอนท้ายตั๋วครัว · หัวพิมพ์อยู่ byte ${r.pr.toLocaleString()} ของตั๋วครัว ${r.kLen.toLocaleString()} byte · USB ส่งตั๋วครัวครบแล้ว ${r.acc.toLocaleString()} byte → แอปนับ "ออกแล้ว" · หมดเวลาตอนใบเสร็จ → ปิด USB → เครื่องทิ้ง ${lost.toLocaleString()} byte · ตั๋วครัวที่ออก ${kOut.length}/${K.length} บรรทัด จบที่ "${kOut.filter(t => t !== '⟂').slice(-1)[0] || ''}" · กระดาษ: ${paper(r.sid)}`);
      eq('H35 (ก) "handed over = printed" reproduces #017: kitchen counted as printed, its end (Banana Choco details) missing, only the receipt reprinted',
        [st.kitchen, r.acc === r.kLen, kOut.length < K.length, kOut.join('\n').includes('ไม่เอาถั่ว'), paper(r.sid).replace(/f/g, '')], ['ok', true, true, false, 'R']);
      BP.per = 4096;
    }
    // (ข) กฎใหม่: สถานะยืนยันต้องรอให้หัวพิมพ์พิมพ์บัฟเฟอร์ออกก่อน → ฝาเปิดกลางนั้น = ตั๋วครัวยังไม่ยืนยัน → ใบแทนครบทุกบรรทัด
    for(const [label, when, want] of [['lid opens while the kitchen end is still in the buffer', 'kitchen-end', 'Kr'], ['lid opens as the receipt starts sending (kitchen already confirmed by the pause)', 'receipt-start', 'kR']]){
      BP.per = 600;
      const r = await lidNearKitchenEnd(150, when), st = w.eval(`PRINTED.get(${r.sid})`);
      emu.cover = false; await until(() => !$('#printFail') && idle() && /K/.test(paper(r.sid)), 6000); await wait(300);
      const K = expect(r.sid, 'kitchen'), shown = emu.pages.map(readText).filter(t => t.length), repl = shown.find(t => t[0] && t[0].startsWith('ใบแทน')) || [];
      const clean = paper(r.sid).replace(/f/g, ''), done = completeSlips(r.sid);
      console.log(`INFO H35 (ข) กฎใหม่ · ${label}: กระดาษ ${paper(r.sid)} (f เศษ · k ใบเดิมที่เครื่องพิมพ์ต่อเองจนจบ · K ใบแทน · r ใบเสร็จ) · ใบแทน ${repl.length} บรรทัด`);
      const slip = want[0] === 'K' ? 'kitchen' : 'receipt', E = expect(r.sid, slip);
      const rp = shown.find(t => t[0] && t[0].startsWith('ใบแทน')) || [];
      eq(`H35 (ข) ${label}: replacement only for the slip not yet confirmed ("ใบแทน" frame + every line of the bill) · old piece cut off separately · kitchen first · no garbage on complete slips`,
        [!!(st.redo && st.redo.kitchen), !!(st.redo && st.redo.receipt), clean.endsWith(want), rp[0], rp.slice(1).join('\n') === E.join('\n'), done.map(p => p.text).join('')],
        [want.includes('K'), want.includes('R'), true, `ใบแทน — ทิ้งใบก่อนหน้าของ #${w.eval(`pad(loadSales().find(s => s.id === ${r.sid}).no, 3)`)}`, true, '']);
      BP.per = 4096;
    }
    BP.cap = 8192; w.eval(WATCH());

    /* ---------- H33/H35 ตำแหน่งต่างๆ × (รอเฉยๆ / กดพิมพ์ซ้ำแทรก) × (เครื่องทิ้งบัฟเฟอร์ตอนปิด USB / ตอนฝาเปิด) ---------- */
    const CASES = [
      ['lid at start of long kitchen', 'cover', 1, 3000, 'Kr'],
      ['lid mid long kitchen', 'cover', 1, 0.5, 'Kr'],
      ['lid at end of long kitchen', 'cover', 1, -2500, 'Kr'],
      ['lid during receipt', 'cover', 2, 0.5, 'kR'],
      ['paper runs out mid kitchen', 'paper', 1, 0.5, 'Kr'],
    ];
    for(const drop of ['close', 'cover']) for(const [name, what, job, at, want] of CASES) for(const mode of ['wait', 'tap']){
      await settle(); reset0(); BP.drop = drop; toasts.length = 0; id = sellLong();
      const len = w.eval(`slipBytes([${job === 1 ? 'kitchen' : 'receipt'}Blocks(loadSales().find(s => s.id === ${id}))]).length`);
      trigger = {job, at: at < 0 ? len + at : at < 1 ? Math.round(len * at) : at, what};
      await until(() => !!$('#printFail'), 5000);
      const msg = what === 'cover' ? 'ฝาปริ้นเตอร์เปิดอยู่' : 'กระดาษหมด';
      await until(() => bar().includes(msg), 2000);
      const tag = `${name} · drop on ${drop} · ${mode}`;
      eq(`H33 ${tag}: orange bar "${msg}" · nothing reprinted while not ready`, [bar().includes(msg), paper(id).replace(/f/g, '')], [true, job === 2 ? 'k' : '']);
      emu.cover = false; emu.paper = true;
      if(mode === 'tap'){ const b = d.querySelector('#printFail .pfbtn'); if(b) b.click(); }
      await until(() => !$('#printFail') && idle() && paper(id).replace(/f/g, '').length >= 2, 6000); await wait(300);
      const redo = w.eval(`PRINTED.get(${id}).redo || {}`);
      const clean = paper(id).replace(/f/g, ''), extra = clean.slice(0, -want.length), done = completeSlips(id);
      const okExtra = [...extra].every(c => (c === 'k' && want.includes('K')) || (c === 'r' && want.includes('R')) || (c === 'k' && want.startsWith('k')));   // ก่อนชุดสุดท้ายมีได้แค่ใบเดิมของใบที่สะดุด (เครื่องพิมพ์ต่อเองจนจบ) หรือตั๋วครัวที่ออกครบก่อนสะดุด
      eq(`H33 ${tag}: ends with a complete set decoded line by line, kitchen first · replacement only for the slip that stumbled · old piece separate · no garbage on complete slips · bar gone`,
        [clean.endsWith(want), okExtra, done.map(p => p.text).join(''), !!$('#printFail'), !!redo.kitchen, !!redo.receipt], [true, true, '', false, want.includes('K'), want.includes('R')]);
    }

    // ---------- H36 เปิดฝาแป๊บเดียว (~1 วิ ก่อนแถบเตือนขึ้น) เครื่องพิมพ์ต่อเอง แต่บรรทัดตรงรอยต่อหาย (บั๊กเครื่องจริง #018 กรณี A) ----------
    // บัฟเฟอร์เล็ก: USB ค้างระหว่างฝาเปิด → จับจากก้อนที่ค้างนานผิดปกติ · บัฟเฟอร์ใหญ่: ส่งครบทันที → จับจากการถามสถานะระหว่างหัวพิมพ์กำลังพิมพ์
    for(const [label, cap] of [['small buffer (USB stalls while the lid is open)', 8192], ['big buffer (whole slip already in the printer)', 262144]]) for(const at of [0.3, 0.7]){
      await settle(); reset0(); BP.cap = cap; BP.drop = 'close'; w.eval(WATCH()); toasts.length = 0;
      id = sellLong(); const len = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${id}))]).length`);
      trigger = {job:1, at:Math.round(len * at), what:'blink', ms:1000};
      await until(() => emu.cover, 4000); await until(() => !emu.cover, 3000);
      await until(() => idle() && !$('#printFail') && /K/.test(paper(id)) && /[rR]$/.test(paper(id).replace(/f/g, '')), 8000); await wait(300);
      const got = paper(id), clean = got.replace(/f/g, ''), log = w.eval('PLOG.slice(-12).join(" | ")');
      const K = expect(id, 'kitchen'), repl = emu.pages.map(readText).find(t => t[0] && t[0].startsWith('ใบแทน') && t.slice(1).join('\n') === K.join('\n'));
      eq(`H36 short lid blink at ${Math.round(at * 100)}% of kitchen · ${label}: detected (no staff action) → old kitchen with lost rows cut off · complete kitchen replacement with "ใบแทน" frame (every line) · receipt complete · kitchen first · no garbage`,
        [/(stall|status)/.test(log), got.includes('f') || got.startsWith('k'), !!repl, clean.slice(-2), completeSlips(id).map(p => p.text).join('')], [true, true, true, clean.slice(-1) === 'R' ? 'KR' : 'Kr', '']);
    }
    BP.cap = 8192;

    // ---------- H37 ใบที่พิมพ์ซ้ำมีกรอบ "ใบแทน" เสมอ (ตรวจจากภาพที่ส่งไปปริ้นเตอร์) ----------
    {
      // กรณี B: เปิดฝาค้างจนแถบเตือนขึ้น → ปิดฝา → กด "พิมพ์ซ้ำ" บนแถบ · บัฟเฟอร์ใหญ่ (ทั้งสองใบอาจเข้าเครื่องแล้ว)
      await settle(); reset0(); BP.cap = 262144; w.eval(WATCH());
      id = sellLong(); const len = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${id}))]).length`);
      trigger = {job:1, at:Math.round(len * 0.4), what:'cover'};
      await until(() => !!$('#printFail'), 5000); await wait(300);
      const sentBefore = JSON.parse(w.eval(`JSON.stringify(PRINTED.get(${id}).sent || {})`));   // สำเนา (w.eval คืนตัวจริง ถ้าไม่คัดลอกจะเปลี่ยนตามตอนพิมพ์ซ้ำ)
      emu.cover = false; const b = d.querySelector('#printFail .pfbtn'); if(b) b.click();
      await until(() => idle() && !$('#printFail') && paper(id).replace(/f/g, '').length >= 2, 6000); await wait(300);
      const shown = emu.pages.map(readText).filter(t => t.length), heads = shown.filter(t => t[0] && t[0].startsWith('ใบแทน')).length;
      const no = w.eval(`pad(loadSales().find(s => s.id === ${id}).no, 3)`);
      eq('H37 case B (lid open long, then tap reprint): every reprinted slip that had already been sent shows "ใบแทน — ทิ้งใบก่อนหน้าของ #NNN" on paper (decoded from the image)',
        [heads, shown.filter(t => t[0] && t[0].startsWith('ใบแทน')).every(t => t[0] === `ใบแทน — ทิ้งใบก่อนหน้าของ #${no}`), paper(id).replace(/f/g, '').slice(-2)],
        [(sentBefore.kitchen ? 1 : 0) + (sentBefore.receipt ? 1 : 0), true, (sentBefore.kitchen ? 'K' : 'k') + (sentBefore.receipt ? 'R' : 'r')]);
      BP.cap = 8192;
      // พิมพ์ซ้ำปกติจากหน้าสำเร็จ (ใบแรกออกครบ) → ใบที่สองมีกรอบใบแทน
      await settle(); reset0(); w.eval(WATCH()); id = sellShort(); await until(() => idle() && paper(id) === 'kr', 4000); await settle();
      $('#prKitchen').click(); await until(() => idle() && paper(id).length >= 3, 4000); await wait(200);
      const last = readText(emu.pages[emu.pages.length - 1]);
      eq('H37 normal reprint from the success screen ("พิมพ์ตั๋วครัวซ้ำ"): printed slip starts with the "ใบแทน" frame', [paper(id), last[0]], ['krK', `ใบแทน — ทิ้งใบก่อนหน้าของ #${w.eval(`pad(loadSales().find(s => s.id === ${id}).no, 3)`)}`]);
    }

    // ---------- ฝาเปิดก่อนพิมพ์ / กระดาษหมดก่อนพิมพ์ → พิมพ์ปกติ (ไม่ใช่ใบแทน เพราะยังไม่ได้เริ่ม) ----------
    for(const what of ['cover', 'paper']){
      await settle(); reset0(); BP.drop = 'close'; if(what === 'cover') emu.cover = true; else emu.paper = false;
      id = sellShort(); await until(() => !!$('#printFail'), 3000);
      const msg = what === 'cover' ? 'ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วจะพิมพ์ต่อให้' : 'กระดาษหมด — ใส่กระดาษแล้วจะพิมพ์ต่อให้';
      eq(`H33 ${what} before printing: bar "${msg}" · lid open never says paper out · nothing printed`, [bar().includes(msg), what === 'cover' ? !bar().includes('กระดาษหมด') : true, paper(id)], [true, true, '']);
      emu.cover = false; emu.paper = true;
      await until(() => !$('#printFail') && idle() && paper(id).length >= 2, 4000); await wait(200);
      eq(`H33 ${what} before printing → ready → kitchen then receipt, plain (not replacement)`, paper(id), 'kr');
    }

    // ---------- กดแทรกตอนแอปเริ่มพิมพ์ต่อเอง → ชุดเดียว ----------
    await settle(); reset0(); emu.cover = true; id = sellShort(); await until(() => !!$('#printFail'), 3000); toasts.length = 0; emu.cover = false;
    await until(() => w.eval(`PRINTED.get(${id})`).kitchen === 'wait', 3000);
    w.eval(`reprint(loadSales().find(s => s.id === ${id}))`);
    await until(() => idle() && paper(id).length >= 2, 4000); await wait(300);
    eq('H33 staff reprint lands while app is already printing → "printing" note, one set only', [toasts.includes('กำลังพิมพ์อยู่'), paper(id)], [true, 'kr']);

    // ---------- แถบเขียว "พิมพ์แล้ว ✓" แล้วหาย ----------
    await until(() => !$('#printOk'), 2000);
    await settle(); reset0(); emu.cover = true; id = sellShort(); await until(() => !!$('#printFail')); emu.cover = false;
    await until(() => !!$('#printOk') && paper(id) === 'kr', 4000); const okText = $('#printOk') ? $('#printOk').textContent : ''; await until(() => !$('#printOk'), 2000);
    eq('H33 green "printed ✓ #NNN kitchen + receipt" then gone · polling stopped', [okText.startsWith('พิมพ์แล้ว ✓ #') && okText.includes('ตั๋วครัว + ใบเสร็จ'), !!$('#printOk'), w.eval('resumeTimer')], [true, false, null]);

    // ---------- ไม่วน: พิมพ์ต่อเองแล้วค้างอีก (สถานะยังปกติ) → แถบเดิม จนกว่าจะเห็นไม่พร้อมแล้วกลับมาพร้อม ----------
    await settle(); reset0(); emu.cover = true; id = sellShort(); await until(() => !!$('#printFail'));
    BP.jam = true; emu.cover = false;                         // ปิดฝา แต่หัวพิมพ์ค้างเงียบ
    await until(() => w.eval(`PRINTED.get(${id})`).kitchen === 'wait', 3000);
    await until(() => !!$('#printFail') && w.eval(`PRINTED.get(${id})`).kitchen === 'fail', 5000);
    const n1 = jobStarts.length; await wait(900);
    eq('H33 auto print stuck again: orange bar back · no second auto print', [!!$('#printFail'), jobStarts.length - n1], [true, 0]);
    BP.jam = false; buf = []; emu.cover = true; await wait(300); emu.cover = false;
    await until(() => !$('#printFail') && idle() && /K/.test(paper(id)), 5000); await wait(300);
    eq('H33 lid opened + closed again → one more auto print · kitchen replacement + receipt', paper(id).replace(/f/g, '').slice(-2), 'Kr');

    // ---------- อ่านสถานะไม่ได้ → กดเอง ----------
    await settle(); reset0(); BP.jam = true; id = sellShort(); await until(() => !!$('#printFail'), 5000);
    statusHang = true; await wait(700);
    eq('H33 status no answer: stop polling · bar says press reprint', [w.eval('resumeTimer'), w.eval('usbPrinter.noStatus'), bar().includes('กดพิมพ์ซ้ำ'), bar().includes('จะพิมพ์ใบที่ขาดให้เอง')], [null, true, true, false]);
    statusHang = false; BP.jam = false; buf = []; w.eval('usbPrinter.noStatus = false');
    d.querySelector('#printFail .pfbtn').click(); await until(() => idle() && /K/.test(paper(id)) && /r/.test(paper(id)), 5000); await wait(200);
    eq('H33 staff reprint still works (stumbled kitchen = replacement)', paper(id).replace(/f/g, '').slice(-2), 'Kr');

    // ---------- H34 ปริ้นเตอร์ถูกอีกหน้าจับไว้ ----------
    w.eval('usbPrinter.forget(); renderPrinterBtn()'); dev.opened = false;
    claimBusy = true; toasts.length = 0; $('#btnPrinter').click(); await wait(100);
    const busyMsg = 'ปริ้นเตอร์ถูกใช้อยู่ในหน้าอื่น — ปิดหน้าอื่น (แอป POS หรือหน้าทดสอบ) แล้วกดเชื่อมอีกครั้ง';
    eq('H34 claim fails: plain message · button stays "connect" · device handle closed again', [toasts.includes(busyMsg), $('#btnPrinter').textContent.trim(), dev.opened], [true, 'เชื่อมปริ้นเตอร์', false]);
    toasts.length = 0; const c0 = claims;
    d.dispatchEvent(new w.Event('visibilitychange')); await wait(100);
    eq('H34 back to app while still busy: one quiet try, no message', [claims - c0, toasts.length], [1, 0]);
    w.dispatchEvent(new w.Event('focus')); await wait(50);
    eq('H34 visibilitychange + focus together = one try', claims - c0, 1);
    claimBusy = false; await wait(1600);
    w.eval("TAB_STATE = 'other'"); d.dispatchEvent(new w.Event('visibilitychange')); await wait(100);
    eq('H34 page locked by another tab (D03): does not grab the printer', [claims - c0, $('#btnPrinter').textContent.trim()], [1, 'เชื่อมปริ้นเตอร์']);
    w.eval("TAB_STATE = 'own'"); await wait(1600); d.dispatchEvent(new w.Event('visibilitychange')); await wait(150);
    eq('H34 other page closed → back to app → connects quietly', [$('#btnPrinter').textContent.trim(), toasts.length], ['ปริ้นเตอร์พร้อม', 0]);

    eq('no old-job bytes sent after a reset', lateSent, 0);
    eq('no runtime errors, never window.print', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
