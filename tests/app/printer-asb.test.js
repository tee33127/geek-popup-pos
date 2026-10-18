// ASB เป็นสัญญาณหลัก + ยืนยันพิมพ์จบด้วย GS r + ไม่มีใบแทนเปล่า (H39 H40 H41 · Tee 2026-10-17 · ผลเครื่องจริง #026 บน 97b14f046d1e)
// ปริ้นเตอร์จำลองแบบที่วัดจากเครื่องจริง (printer-test H38):
//   - บัฟเฟอร์ใหญ่ รับเร็วกว่าพิมพ์ (~2 เท่า) ตั๋วครัวยาวทั้งใบเข้าเครื่องก่อนพิมพ์ครึ่งใบ · บัฟเฟอร์เต็ม = หยุดรับจนพิมพ์ออกไปครึ่งหนึ่ง (รับช้าเป็นช่วงๆ ตอนมีของเก่าค้าง)
//   - ฝาเปิด = หัวพิมพ์หยุด บัฟเฟอร์เต็มแล้วช่องส่งค้าง · คำถามสถานะ (DLE EOT) ติดคิวเดียวกับข้อมูล ถามไม่ได้ระหว่างค้าง
//   - ปิดฝา = พิมพ์ต่อจากบัฟเฟอร์เอง แต่แถวตรงรอยต่อหาย (บรรทัด "แยกท็อปปิ้ง" ขาดครึ่ง แบบ #026)
//   - ASB (GS a) แจ้งทันทีทาง bulk IN ไม่ติดคิว: ปกติ 14 00 00 0F · ฝาเปิด 3C 00 00 0F แล้ว 3C 00 0C 0F · ESC @ ปิด ASB (กรณีแย่สุด แอปต้องเปิดซ้ำ)
//   - GS r 1 ตอบ 0x00 เมื่อหัวพิมพ์ทำงานถึงจุดนั้นจริง (noAck = เครื่องไม่รองรับ)
// ถอดข้อความจากภาพ (canvas จำลองเขียนข้อความเป็นแถวจุด) เทียบกับบิลทุกบรรทัด: ใบแทนเปล่า / ใบแทนขาด / ใบแทนเกิน จับได้
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {EscPosEmu} = require('../escpos-emu');
const A = require('../auth-helper');
/* นาฬิกาจำลอง (tests/vclock.js): หน้า + ปริ้นเตอร์จำลองใช้เวลาเดียวกัน ผลไม่ขึ้นกับความเร็วเครื่อง · setTimeout/setInterval ในไฟล์นี้ = ของนาฬิกาจำลอง
   wait(ms) = เดินเวลาจำลอง ms (ทุกตัวจับเวลาถึงกำหนดทำตามลำดับ) · until(cond, ms) = เดินจน cond จริง เพดาน ms เป็นเวลาจำลอง */
const {VClock} = require('../vclock'), clock = new VClock(), {setTimeout, setInterval, clearTimeout, clearInterval} = clock.api;
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }

/* ---------- ปริ้นเตอร์จำลอง ---------- */
const SIM = {cap:65536, low:32768, usb:360, print:180, tick:2, blink:1000};   // byte ต่อ tick (2 ms): รับ ~180 KB/วิ · พิมพ์ ~90 KB/วิ (เร็วกว่าเครื่องจริง 2 เท่า เทสต์ไม่นาน อัตราส่วนเท่าเดิม)
const errors = [];
let emu, buf, pipe, accepting, streamTotal, printedTotal, jobStarts, jobAt, trigger, lidClosedAt, maxStall, fulls, peak;
const reset0 = () => {
  emu = new EscPosEmu(); emu.asbCapable = true; emu.initClearsAsb = true;
  if(pipe) pipe.forEach(p => p.no(new Error('reset')));
  buf = []; pipe = []; accepting = true; streamTotal = 0; printedTotal = 0; jobStarts = []; jobAt = []; trigger = null; lidClosedAt = 0; maxStall = 0; fulls = 0; peak = 0;
};
reset0();
const lid = ms => { emu.setCover(true); emu.loseRows = 40; setTimeout(() => { emu.setCover(false); lidClosedAt = clock.now; }, ms); };   // เปิดแป๊บเดียวแล้วปิด
setInterval(() => {
  if(!emu.cover && emu.paper && buf.length){                 // หัวพิมพ์
    const out = buf.splice(0, Math.min(SIM.print, buf.length)); emu.feedParser(out); printedTotal += out.length;
    if(trigger && trigger.on === 'head' && jobStarts[trigger.job - 1] !== undefined && printedTotal >= jobStarts[trigger.job - 1] + trigger.at && (!trigger.sent || streamTotal >= jobStarts[trigger.job - 1] + trigger.len)){
      trigger.fired = {sent:streamTotal - jobStarts[trigger.job - 1], head:printedTotal - jobStarts[trigger.job - 1]}; const t = trigger; trigger = null; lid(t.ms);
    }
  }
  if(accepting && SIM.cap - buf.length < 512){ accepting = false; fulls++; }   // บัฟเฟอร์ (เกือบ) เต็ม: หยุดรับจนเหลือครึ่ง
  if(!accepting && buf.length <= SIM.low) accepting = true;
  peak = Math.max(peak, buf.length);
  let room = accepting ? Math.min(SIM.usb, SIM.cap - buf.length) : 0;
  if(pipe.length && !room){ pipe[0].wait = (pipe[0].wait || 0) + SIM.tick; maxStall = Math.max(maxStall, pipe[0].wait);
    if(trigger && trigger.on === 'full' && jobStarts[trigger.job - 1] !== undefined && streamTotal >= jobStarts[trigger.job - 1]){ trigger.fired = {sent:streamTotal - jobStarts[trigger.job - 1], head:printedTotal - jobStarts[trigger.job - 1]}; const t = trigger; trigger = null; lid(t.ms); }   // ฝาเปิดตอนเครื่องหยุดรับพอดี: ก้อนที่กำลังส่งค้างทั้งช่วงที่ฝาเปิด
  }
  while(room > 0 && pipe.length){                            // ช่องส่ง USB: ก้อนเรียงคิว รับตามที่บัฟเฟอร์ว่าง
    const p = pipe[0];
    if(p.data[0] === 0x10 && p.data[1] === 0x04){ emu.reply(p.data[2]); buf.push(...p.data); room -= 3; pipe.shift(); p.ok({status:'ok'}); continue; }   // DLE EOT: ตอบตอนเครื่องรับได้ (ติดคิวหลังข้อมูล)
    const n = Math.min(room, p.data.length - p.i);
    for(let j = 0; j < n; j++) buf.push(p.data[p.i + j]);
    p.i += n; room -= n; streamTotal += n;
    if(trigger && trigger.on === 'usb' && jobStarts[trigger.job - 1] !== undefined && streamTotal >= jobStarts[trigger.job - 1] + trigger.at){
      trigger.fired = {sent:streamTotal - jobStarts[trigger.job - 1], head:printedTotal - jobStarts[trigger.job - 1]}; const t = trigger; trigger = null; lid(t.ms);
    }
    if(p.i >= p.data.length){ pipe.shift(); p.ok({status:'ok'}); }
  }
}, SIM.tick).unref();
const dev = {opened:false, productName:'XP-Q807K', configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}, {endpointNumber:2, direction:'in', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){}, async releaseInterface(){},
  async close(){ this.opened = false; pipe.forEach(p => p.no(new Error('transfer cancelled'))); pipe = []; },
  transferIn(){ const me = this; return new Promise((ok, no) => { const t = setInterval(() => { if(!me.opened){ clearInterval(t); no(new Error('transfer cancelled')); return; } if(!emu.replies.length) return; clearInterval(t); ok({status:'ok', data:new DataView(new Uint8Array([].concat(emu.replies.shift())).buffer)}); }, 2); }); },
  transferOut(ep, data){
    if(!this.opened) return Promise.reject(new Error('device closed'));
    if(data[0] === 0x1B && data[1] === 0x40){ jobStarts.push(streamTotal + pipe.reduce((a, p) => a + (p.data.length - p.i), 0)); jobAt.push(clock.now); }
    return new Promise((ok, no) => pipe.push({data:data.slice(), i:0, ok, no})); }};

/* ---------- canvas จำลอง: ข้อความ → แถวจุด (0xA5 len chk data) · อ่านกลับจากกระดาษ ---------- */
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

JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ clock.install(w); A.seed(w);
    w.print = () => errors.push('window.print called'); w.console.warn = () => {}; w.addEventListener('error', e => errors.push(e.message));
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    Object.defineProperty(w.navigator, 'usb', {value:{getDevices: async () => [dev], requestDevice: async () => dev, addEventListener(){}}});
  }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => clock.advance(ms);
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const until = (fn, ms = 4000) => clock.until(fn, ms, 15);   // เช็กทุก 15 ms เวลาจำลอง (เท่าที่เทสต์เดิมเช็ก) · cond ถอดข้อความจากกระดาษ หนัก
  const idle = () => !w.eval('[...PRINTED.values()].some(s => s.kitchen === "wait" || s.receipt === "wait")') && !buf.length && !pipe.length;
  /* บิลยาวแบบ #026: Greek ท็อปปิ้งเยอะ + แยกท็อปปิ้ง ใส่ถ้วยแยก + หมายเหตุ · Greek · Banana Choco */
  let seq = 0;
  const sellLong = () => w.eval(`(() => {
    if(document.getElementById('nextOrder')) document.getElementById('nextOrder').click();
    const now = new Date(), sales = loadSales(), no = sales.filter(s => s.date === bizDate(now)).length % 999 + 1;
    const s = {id:now.getTime() * 100 + ${++seq % 100}, no, date:bizDate(now), ts:now.toISOString(), dining:'dinein', method:'cash', received:500, change:161, void:false, staff:'ทดสอบ', staffId:'u1', total:339,
      items:[{menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Banana', n:2, extra:0}, {name:'Mango', n:1, extra:0}, {name:'Granola', n:1, extra:0}, {name:'Chia', n:1, extra:15}, {name:'Cherry Jelly', n:1, extra:15}, {name:'Biscoff Crumble', n:1, extra:15}], honey:'lots', sep:5, note:'ช้อน 2 อัน', unit:119, qty:1},
        {menu:'greek', name:'Greek Yogurt', sizeName:'1 สกู๊ป', tops:[{name:'Banana', n:1, extra:0}, {name:'Granola', n:1, extra:0}, {name:'Mango', n:1, extra:0}], honey:'normal', note:'', unit:69, qty:1},
        {menu:'banana', name:'Banana Choco', sizeName:'', tops:[{name:'Banana', n:1, extra:0, from:null}, {name:'Cacao peanut butter', n:1, extra:0, from:null, removed:true}, {name:'Kiwi', n:2, extra:30, from:null, add:true}], unit:179, qty:1, note:'ไม่เอาถั่ว'}]};
    sales.push(s); saveSales(sales); lastSale = s;
    openModal(doneHtml(s)); printSale(s, receiptMode() === 'all' ? 'both' : 'kitchen');
    return s.id; })()`);
  const expect = (id, k, redo) => readText(new EscPosEmu().feed(w.eval(`slipBytes([slipBlocks(loadSales().find(s => s.id === ${id}), '${k}', ${redo ? '{redo:{' + k + ':true}}' : 'null'})])`)).pages[0]);
  /* กระดาษที่ออกมา (ทั้งหมดตั้งแต่ reset) → k ตั๋วครัว · K ตั๋วครัวใบแทน · r ใบเสร็จ · R ใบเสร็จใบแทน · f เศษ/ไม่ครบ · x ใบแทนที่ไม่ครบ (ใบแทนเปล่า/ขาด) · ใบว่างไม่นับ */
  const paper = id => { const S = {k:expect(id, 'kitchen'), K:expect(id, 'kitchen', 1), r:expect(id, 'receipt'), R:expect(id, 'receipt', 1)};
    return emu.pages.map(p => { const t = readText(p); if(!t.length) return ''; const hit = Object.keys(S).find(c => S[c].join('\n') === t.join('\n')); return hit || (t[0].startsWith('ใบแทน') ? 'x' : 'f'); }).join(''); };
  const garbage = () => emu.pages.map(p => p.text).join('') + emu.page.text;
  const settle = async () => { await until(() => idle() && w.eval('UNCONF.length') === 0 && !$('#printFail') && !($('#prKitchen') && $('#prKitchen').disabled), 8000); };
  /* เวลาย่อตามความเร็วจำลอง (2 เท่า): ก้อนค้าง 250 ms (จริง 500) · grace 600 ms (จริง 3 วิ) · โค้ดก่อนแก้ไม่มี PRINT_ACK (รันเทียบได้) */
  const RATE = () => `PRINT_WATCH.rate = ${Math.round(SIM.print / SIM.tick * 1000 * 0.9)}; PRINT_WATCH.stall = 250; PRINT_CONFIRM.ms = 150; if(typeof PRINT_ACK !== 'undefined'){ PRINT_ACK.grace = 600; PRINT_ACK.max = 3000; } PRINT_RESUME.ms = 100; PRINT_RESUME.okMs = 300`;

  w.addEventListener('load', async () => {
    A.signIn(w);
    w.eval('PRINT_TIMEOUT.min = 6000; PRINT_TIMEOUT.close = 300; PRINTER.statusMs = 300; ' + RATE());
    await wait(200);
    // ---------- H39 เชื่อมแล้วเปิด ASB เอง ----------
    eq('H39 connect: ASB turned on by itself (GS a 14) · printer reports ready · app uses ASB as the main signal', [$('#btnPrinter').textContent.trim(), emu.asbMode, w.eval('!!usbPrinter.asbSeen'), w.eval("typeof asbLive === 'function' && asbLive()")], ['ปริ้นเตอร์พร้อม', 0x0E, true, true]);

    const runLid = async ({label, on, at, ack = true, tap = false, cap = 65536, ms = SIM.blink, during, want}) => {
      await settle(); reset0(); SIM.cap = cap; SIM.low = cap / 2; emu.noAck = !ack; w.eval('usbPrinter.ackMode = "unknown"; usbPrinter.ackMiss = 0; ' + RATE());
      emu.asbMode = 0x0E;   // เชื่อมอยู่แล้ว ASB เปิดค้างจากรอบก่อน (ปริ้นเตอร์จำลองเริ่มใหม่ทุกเคส)
      const id = sellLong(), K = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${id}))]).length`), R = w.eval(`slipBytes([receiptBlocks(loadSales().find(s => s.id === ${id}))]).length`);
      const job = want.startsWith('k') ? 2 : 1, len = job === 1 ? K : R;
      trigger = {on, job, at:Math.round(len * at), len, sent:on === 'head', ms}; const tr = trigger;
      await until(() => emu.cover, 6000); const t0 = clock.now;
      if(during) await during();
      if(tap){ await until(() => !emu.cover, 3000); await wait(150); const b = $('#printFail .pfbtn'); if(b) b.click(); }   // พนักงานกดพิมพ์ซ้ำเองด้วย (แข่งกับที่แอปพิมพ์เอง)
      await until(() => idle() && !$('#printFail') && paper(id).replace(/f|x/g, '').endsWith(want), 12000); await wait(400);
      const got = paper(id), clean = got.replace(/f/g, '').replace(/^k(?=K)/, ''), heads = emu.pages.map(readText).filter(t => t[0] && t[0].startsWith('ใบแทน'));
      const repl = jobAt.length > (want.startsWith('k') ? 2 : 1) ? jobAt[want.startsWith('k') ? 2 : 1] - lidClosedAt : null;
      const log = w.eval('PLOG.slice(-14).join(" | ")');
      console.log(`INFO ${label}: กระดาษ ${got} (f เศษใบเก่า · K/R ใบแทนครบ · x ใบแทนไม่ครบ) · ฝาเปิดตอนส่งแล้ว ${tr.fired ? tr.fired.sent : '?'} / พิมพ์แล้ว ${tr.fired ? tr.fired.head : '?'} จาก ${len} byte · ใบแทนเริ่มส่ง ${repl} ms หลังปิดฝา · ก้อนค้างนานสุด ${maxStall} ms · บัฟเฟอร์เต็ม ${fulls} ครั้ง`);
      SIM.cap = 65536; SIM.low = 32768;
      eq(`H39 ${label}: no staff action · old piece cut off (or old slip complete when the lost rows were blank) · exactly ONE replacement, complete (every line) · no empty/partial replacement · ${want.startsWith('k') ? 'receipt replaced' : 'receipt complete after it'} · no garbage`,
        [!$('#printFail'), clean, heads.length, got.includes('x'), garbage()],
        [true, want, 1, false, '']);
      eq(`H39 ${label}: replacement starts right after the lid closes (< 1.5 s)`, repl !== null && repl < 1500, true);
      if(!eqLogOk(log)) console.log('INFO log', log);
      return {id, got};
    };
    const eqLogOk = log => /ASB/.test(log);

    // ---------- H39 ฝาเปิดค้างนานกว่าเวลาหมดของงาน ตอนช่องส่งค้าง: บอกว่าฝาเปิด (ไม่ใช่ "ไม่ตอบ") ไม่ปิด USB · ปิดฝาแล้วใบแทนเอง ----------
    {
      const seen = {};
      await runLid({label:'lid open 8 s (longer than the job timeout) while USB is stalled', on:'full', at:0, cap:24576, ms:8000, want:'Kr', during: async () => {
        await wait(1500); seen.bar = $('#printFail') ? $('#printFail').textContent : ''; seen.status = $('#prStatus') ? $('#prStatus').textContent : '';
        await wait(5500); seen.late = ($('#printFail') ? $('#printFail').textContent : '') + ($('#prStatus') ? $('#prStatus').textContent : ''); seen.opened = dev.opened;
      }});
      eq('H39 lid open long while USB is stalled: orange bar + success screen say the lid is open at once · after the job timeout still "lid open" (no "not responding", USB not closed)',
        [seen.bar.includes('ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วจะพิมพ์ต่อให้'), seen.status.includes('ฝาปริ้นเตอร์เปิดอยู่ ปิดฝาแล้วจะพิมพ์ต่อให้'), seen.late.includes('ไม่ตอบ'), seen.opened], [true, true, false, true]);
    }

    // ---------- H39 + H41 เปิดฝาแป๊บเดียว 3 ตำแหน่ง (เครื่องตอบ GS r) ----------
    await runLid({label:'lid blinks while the kitchen ticket is still sending', on:'usb', at:0.6, want:'Kr'});
    await runLid({label:'lid blinks while sending with a full buffer (USB stalls, status cannot be asked · #026 / printer-test round 2)', on:'full', at:0, cap:24576, want:'Kr'});
    await runLid({label:'lid blinks after the whole kitchen ticket is in the printer, head at 40%', on:'head', at:0.4, want:'Kr'});
    await runLid({label:'lid blinks near the end of the kitchen ticket (head at 95%)', on:'head', at:0.95, want:'Kr'});
    await runLid({label:'lid blinks while the receipt prints (kitchen already confirmed by GS r)', on:'head', at:0.5, want:'kR'});
    // ---------- H41 พนักงานกดพิมพ์ซ้ำเองด้วย (บั๊ก #026: ได้ใบแทนเปล่าแล้วใบแทนเต็ม) ----------
    await runLid({label:'staff also taps reprint right after closing the lid (sending case, USB stalled)', on:'full', at:0, cap:24576, tap:true, want:'Kr'});
    await runLid({label:'staff also taps reprint right after closing the lid (printing case)', on:'head', at:0.4, tap:true, want:'Kr'});
    // ---------- H40 เครื่องไม่ตอบ GS r: ใช้เวลาประมาณ + ASB เฝ้าต่อ ----------
    await runLid({label:'printer without GS r: lid blinks after kitchen is in the printer (head 40%)', on:'head', at:0.4, ack:false, want:'Kr'});
    await runLid({label:'printer without GS r: lid blinks while sending', on:'usb', at:0.6, ack:false, want:'Kr'});

    // ---------- H40 รู้ว่าพิมพ์จบจริง: GS r ----------
    {
      await settle(); reset0(); emu.asbMode = 0x0E; emu.noAck = false; w.eval('usbPrinter.ackMode = "unknown"; usbPrinter.ackMiss = 0; PLOG.length = 0; ' + RATE());
      const id = sellLong(); await until(() => idle() && paper(id) === 'kr', 8000); await settle();
      const log = w.eval('PLOG.join(" | ")'), kAck = emu.acks;
      const gap = jobAt[1] - jobAt[0], kLen = w.eval(`slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${id}))]).length`);
      console.log(`INFO H40 GS r: ใบเสร็จเริ่มส่ง ${gap} ms หลังเริ่มส่งตั๋วครัว (ตั๋วครัว ${kLen} byte พิมพ์จริง ≈ ${Math.round(kLen / (SIM.print / SIM.tick))} ms) · ${log.match(/ออกแล้ว · kitchen[^|]*/)}`);
      eq('H40 each slip ends with GS r · printer answers when printed + cut → counted as printed by the answer (not by guessing) · receipt waits for the kitchen answer', [kAck, /ออกแล้ว · kitchen · เครื่องตอบ GS r/.test(log), /ออกแล้ว · receipt · เครื่องตอบ GS r/.test(log), w.eval('usbPrinter.ackMode'), gap >= kLen / (SIM.print / SIM.tick)], [2, true, true, 'yes', true]);
    }
    {
      await settle(); reset0(); emu.asbMode = 0x0E; emu.noAck = true; w.eval('usbPrinter.ackMode = "unknown"; usbPrinter.ackMiss = 0; PLOG.length = 0; ' + RATE());
      const a = sellLong(); await until(() => idle() && paper(a) === 'kr', 8000); await settle();
      const b = sellLong(); await until(() => idle() && paper(b) === 'kr', 8000); await settle();
      const log = w.eval('PLOG.join(" | ")');
      eq('H40 printer never answers GS r: slips counted by estimated time + ASB quiet · after 2 misses stop sending GS r (until reconnect)', [/นับด้วยเวลา \(ASB ไม่แจ้งปัญหา\)/.test(log), w.eval('usbPrinter.ackMode'), w.eval(`Array.from(slipBytes([kitchenBlocks(loadSales().find(s => s.id === ${b}))]).slice(-4))`)], [true, 'no', [0x1D, 0x56, 0x42, 0x00]]);
      emu.noAck = false; w.eval('usbPrinter.ackMode = "unknown"; usbPrinter.ackMiss = 0');
    }

    // ---------- H41 ขายปกติ 10 บิลติดกัน ไม่แตะฝา → ไม่มีใบแทนเลย (กันจับผิด) ----------
    for(const ack of [true, false]){
      await settle(); reset0(); SIM.cap = 32768; SIM.low = 16384; emu.asbMode = 0x0E; emu.noAck = !ack; w.eval('usbPrinter.ackMode = "unknown"; usbPrinter.ackMiss = 0; PLOG.length = 0; ' + RATE());   // บัฟเฟอร์เล็กลง: รับช้าเป็นช่วงๆ บ่อยขึ้น (เคยทำให้จับผิดว่าสะดุด)
      const ids = [];
      for(let i = 0; i < 10; i++){ ids.push(sellLong()); await wait(250); }   // พนักงานขายเร็ว: บิลใหม่ก่อนบิลก่อนพิมพ์จบ (เครื่องมีของเก่าค้าง รับช้าเป็นช่วงๆ)
      await until(() => idle() && w.eval('UNCONF.length') === 0 && emu.pages.filter(p => readText(p).length).length >= 20, 40000); await wait(300);
      const S = new Map(ids.map(id => [id, {k:expect(id, 'kitchen').join('\n'), r:expect(id, 'receipt').join('\n')}]));
      const seqOut = emu.pages.map(p => readText(p).join('\n')).filter(Boolean).map(t => { for(const [id, s] of S){ if(t === s.k) return 'k'; if(t === s.r) return 'r'; } return t.startsWith('ใบแทน') ? 'R!' : '?'; }).join('');
      const log = w.eval('PLOG.join(" | ")'); SIM.cap = 65536; SIM.low = 32768;
      console.log(`INFO H41 10 บิลติดกัน (${ack ? 'เครื่องตอบ GS r' : 'ไม่ตอบ GS r'}): ก้อนค้างนานสุด ${maxStall} ms · บัฟเฟอร์เต็ม ${fulls} ครั้ง สูงสุด ${peak} byte`);
      eq(`H41 10 bills in a row, lid never touched (${ack ? 'with' : 'without'} GS r): every slip once, kitchen then receipt per bill · no replacement · no orange bar · no stumble in the log`,
        [seqOut, /ใบแทน|stumble|stall|asb →/.test(log), !!$('#printFail'), w.eval(`[${ids}].filter(id => { const st = PRINTED.get(id) || {}; return st.redo; }).length`)],
        ['kr'.repeat(10), false, false, 0]);
    }

    // ---------- H39 ปล่อยปริ้นเตอร์ = ปิด ASB ก่อน ----------
    await settle(); const sent0 = []; const tOut = dev.transferOut; dev.transferOut = function(ep, data){ sent0.push(Array.from(data)); return tOut.call(this, ep, data); };
    $('#btnPrinter').click(); $('#prOff').click(); await wait(300); dev.transferOut = tOut;
    eq('H39 "disconnect printer": turns ASB off first (GS a 0) then releases', [sent0.some(a => a[0] === 0x1D && a[1] === 0x61 && a[2] === 0), emu.asbMode, $('#btnPrinter').textContent.trim()], [true, 0, 'เชื่อมปริ้นเตอร์']);

    eq('no runtime errors, never window.print', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
