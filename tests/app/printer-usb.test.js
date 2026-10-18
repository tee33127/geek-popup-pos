// พิมพ์ตรงผ่าน USB ในแอป: จำลอง WebUSB + canvas ใน jsdom แล้วขาย 1 บิล
// - เคยอนุญาตเครื่องแล้ว → เชื่อมเองตอนเปิดแอป · ส่ง ESC/POS (ภาพ GS v 0 + ตัดกระดาษ 2 ใบ) ไม่เรียก window.print
// - ส่งไม่สำเร็จ → แถบส้ม ไม่เด้ง window.print เอง + ปุ่มกลับเป็น "เชื่อมปริ้นเตอร์" (Tee 2026-10-17)
// - หลังชำระเงิน (Tee 2026-10-17): ตั๋วครัวทุกบิล · ใบเสร็จตามตั้งค่า (ทุกบิล / เมื่อลูกค้าขอ) · สถานะ กำลังพิมพ์ → พิมพ์แล้ว · ยังไม่ได้เชื่อม → บอกชัด + ปุ่มเชื่อม · กดรัวๆ ไม่พิมพ์ซ้อน
// - ปริ้นเตอร์ไม่ตอบ (transferOut ค้าง) → หมดเวลาต่องาน ล้างคิว เชื่อมใหม่ แถบแจ้ง + พิมพ์ซ้ำเฉพาะใบที่ขาด (Tee 2026-10-16)
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {finish} = require('../flow-helper');
const {EscPosEmu} = require('../escpos-emu');   // ปริ้นเตอร์จำลองที่แปลคำสั่งจริง (H29)
const A = require('../auth-helper');
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }
let errors = [], printed = 0, sent = [], failNext = false, usbListeners = {};
/* ค้าง: hangJob = งานที่เท่าไร (นับจาก ESC @ ต้นงาน) ที่ transferOut ไม่ตอบ · ปิดการเชื่อมแล้ว transferOut ที่ค้างถูกยกเลิก (แบบ WebUSB) · closeHang = close ไม่ตอบ */
let emu = new EscPosEmu(), hangPart = 0, statusHang = false, statusOverride = null;   // statusOverride = ตอบสถานะค่านี้แทนเครื่องจำลอง (ค่าผิดรูป)   // hangPart = ปริ้นเตอร์รับก้อนที่ค้างไปแล้วกี่ byte (ค้างกลางรูป)
let jobs = 0, hangJob = 0, pending = null, closeHang = false, lateSent = 0, hangAt = -1, lateOk = false;   // lateOk = งานค้างตอบ ok หลังเชื่อมใหม่ (แทนที่จะถูกยกเลิก)   // hangAt = byte ที่ส่งแล้วตอนเริ่มค้าง
/* ฟอนต์ตั๋วจำลอง: โหลดเสร็จหลังเปิดหน้า 200 ms · timeline เช็กว่าวาดตั๋ว (getContext) หลังฟอนต์พร้อมเท่านั้น */
const timeline = []; let fontLoaded = false;
const dev = {opened:false, productName:'XP-Q807K', configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}, {endpointNumber:2, direction:'in', type:'bulk', packetSize:64}]}]}]}],   // ตรงกับ XP-Q807K จริง (log printer-test 15 ต.ค.)
  /* แบบ WebUSB: transferIn ค้างรอจนเครื่องมีอะไรส่งกลับ (statusHang = เครื่องไม่ส่งอะไรกลับ) · statusOverride = ตอบสถานะค่านี้แทน · ปิดการเชื่อม = ยกเลิก */
  transferIn(){ const me = this; return new Promise((ok, no) => { const t = setInterval(() => { if(!me.opened){ clearInterval(t); no(new Error('transfer cancelled')); return; } if(statusHang || !emu.replies.length) return; clearInterval(t);
    let v = emu.replies.shift(); if(statusOverride !== null && typeof v === 'number' && (v & 0x10)) v = statusOverride; ok({status:'ok', data:new DataView(new Uint8Array([].concat(v)).buffer)}); }, 2); }); },
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){}, async releaseInterface(){},
  close(){ if(closeHang) return new Promise(() => {}); this.opened = false; if(pending){ const p = pending; pending = null; if(lateOk) setTimeout(() => p.ok({status:'ok'}), 150); else p.no(new Error('transfer cancelled')); } return Promise.resolve(); },
  async transferOut(ep, data){
    if(!this.opened){ lateSent += data.length; throw new Error('device closed'); }
    if(data[0] === 0x1B && data[1] === 0x40) jobs++;
    if(hangJob && jobs === hangJob){ hangJob = 0; hangAt = sent.length; if(hangPart) emu.feed(data.subarray(0, hangPart)); return new Promise((ok, no) => { pending = {ok, no}; }); }
    if(failNext && data[0] !== 0x10){ failNext = false; return {status:'stall'}; }   // ล้มที่งานพิมพ์ ไม่ใช่คำถามสถานะ
    sent.push(...data); emu.feed(data); return {status:'ok'}; }};
const fakeCtx = c => ({font:'', fillStyle:'', textAlign:'', textBaseline:'', measureText: s => ({width: String(s).length * 12}),
  fillRect(){}, fillText(){}, getImageData: (x, y, w, h) => { const d = new Uint8ClampedArray(w * h * 4).fill(255);   // ลายจุดคงที่ (ข้อมูลภาพมี byte หลากหลาย เหมือนตั๋วจริง)
    for(let j = 0; j < h; j++) for(let i = 0; i < w; i++) if((i * 7 + j * 13) % 11 < 4){ const k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = 0; }
    return {width:w, height:h, data:d}; }});
JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ A.seed(w);
    w.print = () => printed++; w.console.warn = () => {}; w.addEventListener('error', e => errors.push(e.message));
    w.HTMLCanvasElement.prototype.getContext = function(){ timeline.push('draw'); return fakeCtx(this); };
    Object.defineProperty(w.document, 'fonts', {value:{
      load: spec => { timeline.push('load ' + spec); return new Promise(r => setTimeout(() => { if(!fontLoaded) timeline.push('loaded'); fontLoaded = true; r([]); }, 200)); },
      check: () => fontLoaded}});
    Object.defineProperty(w.navigator, 'usb', {value:{
      getDevices: async () => [dev], requestDevice: async () => dev,
      addEventListener: (t, f) => (usbListeners[t] = f)}});
  }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms));
  /* รอจนงานพิมพ์จบจริง ไม่เดาเวลา (เทสต์เคยล้มบ้างผ่านบ้าง: เช็กที่ 250 ms หลังขาย แต่ฟอนต์จำลอง 200 ms + วาดตั๋ว + ส่ง ~76 KB จบที่ ~280 ms พอเครื่องช้าลงนิดเดียวก็เช็กก่อนพิมพ์จบ)
     1 macrotask = microtask ที่ค้างทำครบก่อนเสมอ (เชื่อมปริ้นเตอร์ / กดปุ่ม → printSale เข้าคิวแล้ว) · แล้วรอ printQueue (promise ของคิวพิมพ์จริง) วนจนคิวไม่เปลี่ยน
     printSale ผูก .then (renderDone) ก่อนเทสต์รอ จึงอัปเดตหน้าจอเสร็จก่อนเทสต์เช็กเสมอ */
  const printDone = async () => { for(let p = null;;){ await new Promise(r => setTimeout(r, 0)); const q = w.eval('printQueue'); if(q === p) return; await (p = q); } };
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const sell = () => { $('[data-menu="acai"]').click(); finish(w); $('#btnPay').click(); $('[data-dine="dinein"]').click(); $('[data-method="cash"]').click(); $('[data-q="500"]').click(); $('#payOk').click(); };
  /* byte ข้อมูลพิมพ์ (ไม่นับคำถามสถานะ DLE EOT · เปิด ASB GS a · GS r ที่แอปส่งตอนเชื่อม/ท้ายงาน) */
  const dataOnly = a => { let n = 0; for(let i = 0; i < a.length; i++){ if((a[i] === 0x10 && a[i + 1] === 0x04) || (a[i] === 0x1D && (a[i + 1] === 0x61 || a[i + 1] === 0x72))){ i += 2; continue; } n++; } return n; };
  const count = (arr, seq) => { let n = 0; for(let i = 0; i + seq.length <= arr.length; i++) if(seq.every((b, k) => arr[i + k] === b)) n++; return n; };
  w.addEventListener('load', async () => {
    A.signIn(w); w.eval('PRINT_RESUME.ms = 1e9; PRINT_CONFIRM.ms = 0; PRINT_WATCH.rate = 1e9');   // ปริ้นเตอร์ปลอมพิมพ์ทันที   // พิมพ์ต่อเองเมื่อพร้อม เทสต์แยกใน printer-resume.test.js · ที่นี่ทดสอบแบบกดเอง
    await printDone();
    eq('auto reconnect to allowed printer', $('#btnPrinter').textContent.trim(), 'ปริ้นเตอร์พร้อม');
    sell();
    eq('success screen at once: printing status, buttons below next order, busy buttons disabled', [$('#prStatus').textContent.trim(), !!$('#nextOrder'), $('#prReceipt').disabled, $('#prKitchen').disabled,
      $('#nextOrder').compareDocumentPosition($('#prReceipt')) & 4 ? 'below' : 'above'], ['กำลังพิมพ์ตั๋วครัว + ใบเสร็จ…', true, true, true, 'below']);
    await printDone();
    eq('sent ESC/POS, no browser print', [sent.length > 0, printed], [true, 0]);
    eq('status after print: printed ✓ both · buttons enabled again', [$('#prStatus').textContent.trim(), $('#prStatus').className.includes('ok'), $('#prReceipt').disabled, $('#prKitchen').disabled], ['พิมพ์แล้ว ✓ ตั๋วครัว + ใบเสร็จ', true, false, false]);
    eq('fonts: both slip weights requested at app start', timeline.filter(t => t.startsWith('load')).slice(0, 2), ['load 400 26px "IBM Plex Sans Thai Looped"', 'load 700 26px "IBM Plex Sans Thai Looped"']);
    eq('fonts: first slip drawn only after fonts loaded', timeline.indexOf('loaded') >= 0 && timeline.indexOf('loaded') < timeline.indexOf('draw'), true);
    const R0 = w.eval('ESCPOS.recover(false).length'), z = R0 - 2;
    eq('first job after connecting: clears any half-received image command first (zeros ≥ one band, then ESC @), no extra cut', [sent.slice(0, z).every(b => b === 0), sent.slice(z, R0), z >= 8 + 72 * w.eval('PRINTER.band')], [true, [0x1B, 0x40], true]);
    eq('then turns ASB on (GS a 14) and asks status via ep2 IN (DLE EOT 2, DLE EOT 4 · this fake printer sends no ASB)', [w.eval('usbPrinter.epIn'), sent.slice(R0, R0 + 9)], [2, [0x1D, 0x61, 0x0E, 0x10, 0x04, 0x02, 0x10, 0x04, 0x04]]);
    const S0 = R0 + 9;
    eq('2 slips: 2 cuts', count(sent, [0x1D, 0x56, 0x42, 0x00]), 2);
    eq('slip starts with ESC @ + ASB on again (ESC @ may turn it off) · raster image 576 dots wide (72 bytes) · short bands', [sent.slice(S0, S0 + 2), sent.slice(S0 + 2, S0 + 5), sent.slice(S0 + 5, S0 + 11), sent[S0 + 11], sent[S0 + 12]], [[0x1B, 0x40], [0x1D, 0x61, 0x0E], [0x1D, 0x76, 0x30, 0x00, 72, 0], w.eval('PRINTER.band'), 0]);
    const tail = (() => { let e = sent.length; while(e >= 3 && sent[e - 3] === 0x10 && sent[e - 2] === 0x04) e -= 3; return sent.slice(e - 7, e); })();   // ท้ายสุดอาจเป็นคำถามสถานะยืนยันหลังพิมพ์
    eq('ends with cut + GS r 1 (printer answers when printed and cut · then only status questions)', tail, [0x1D, 0x56, 0x42, 0x00, 0x1D, 0x72, 0x01]);
    eq('blocks: kitchen ticket content', w.eval('kitchenBlocks(lastSale)').slice(0, 2).map(b => b.text), ['#001', 'กินเลย']);
    eq('blocks: dine-in is a framed box, no solid black band', w.eval('kitchenBlocks(lastSale)').slice(1, 2).map(b => [b.box, !!b.invert]), [['single', false]]);
    eq('blocks: receipt total + change', w.eval('receiptBlocks(lastSale)').filter(b => b.left === 'รวม' || b.left === 'เงินทอน').map(b => b.right), ['฿189', '฿311']);
    // กดรัวๆ บนหน้าสำเร็จ → ใบละครั้งเดียว ไม่พิมพ์ซ้อน
    sent = []; for(let i = 0; i < 4; i++){ $('#prKitchen').click(); $('#prReceipt').click(); } await printDone();
    eq('rapid taps (4× each): one kitchen + one receipt only', [count(sent, [0x1D, 0x56, 0x42, 0x00]), count(sent, [0x1B, 0x40])], [2, 2]);
    // พิมพ์ซ้ำทีละใบหลังใบก่อนเสร็จ → ส่งต่อกันเป็นลำดับ ไม่ปนกัน
    sent = []; w.eval('printSale(lastSale, "receipt", true)'); await printDone(); w.eval('printSale(lastSale, "kitchen", true)'); await printDone();
    eq('one job per slip (status asked first): receipt and kitchen each start with ESC @ and end with a cut', [count(sent, [0x1D, 0x56, 0x42, 0x00]), count(sent, [0x1B, 0x40]), sent.slice(0, 8)], [2, 2, [0x10, 0x04, 0x02, 0x10, 0x04, 0x04, 0x1B, 0x40]]);
    // ส่งไม่สำเร็จ → แถบส้ม ห้ามเด้งหน้าพิมพ์ของระบบเอง
    failNext = true; w.eval('printSale(lastSale)'); await printDone();
    eq('send failure: no browser print popped, fail bar + status say not out', [printed, !!$('#printFail'), $('#prStatus').className.includes('warn')], [0, true, true]);
    eq('button back to connect', $('#btnPrinter').textContent.trim(), 'เชื่อมปริ้นเตอร์');
    // กดเชื่อมใหม่ → พิมพ์ซ้ำจากแถบ → พิมพ์ทดสอบ
    $('#btnPrinter').click(); await printDone();
    eq('connect again', $('#btnPrinter').textContent.trim(), 'ปริ้นเตอร์พร้อม');
    sent = []; d.querySelector('#printFail .pfbtn').click(); await printDone();
    eq('reprint from bar after send failure: clear + cut old fragment, then both slips · bar gone', [count(sent, [0x1D, 0x56, 0x42, 0x00]), sent[0], !!$('#printFail')], [3, 0, false]);

    // ---------- ยังไม่ได้เชื่อมปริ้นเตอร์ตอนชำระเงิน (Tee 2026-10-17) ----------
    $('#nextOrder').click(); w.eval('usbPrinter.forget(); renderPrinterBtn()'); sent = []; printed = 0;
    sell(); await printDone();
    eq('not connected: bill saved, nothing sent, no browser print popped by itself', [w.eval('loadSales().some(s => s.id === lastSale.id)'), sent.length, printed], [true, 0, 0]);
    eq('not connected: clear message + connect button on success screen · fail bar too', [$('#prStatus').textContent.includes('ยังไม่ได้เชื่อมปริ้นเตอร์ — ตั๋วยังไม่ออก'), !!$('#prConnect'), !!$('#printFail') && $('#printFail').textContent.includes('ยังไม่ได้เชื่อมปริ้นเตอร์')], [true, true, true]);
    $('#prConnect').click(); await printDone();
    eq('connect from success screen: pending slips print by themselves · status printed · bar gone', [count(sent, [0x1D, 0x56, 0x42, 0x00]), $('#prStatus').textContent.trim(), !!$('#printFail'), printed], [2, 'พิมพ์แล้ว ✓ ตั๋วครัว + ใบเสร็จ', false, 0]);
    // กดพิมพ์ตอนยังไม่เชื่อม → หน้าต่างเลือกปริ้นเตอร์ แล้วพิมพ์ (ไม่ใช่หน้าพิมพ์ของระบบ)
    w.eval('usbPrinter.forget(); renderPrinterBtn()'); sent = [];
    $('#prKitchen').click(); await printDone();
    eq('tap print while not connected: connects then prints that slip only', [$('#btnPrinter').textContent.trim(), count(sent, [0x1D, 0x56, 0x42, 0x00]), printed], ['ปริ้นเตอร์พร้อม', 1, 0]);

    // ---------- ใบเสร็จ: เมื่อลูกค้าขอ (เจ้าของตั้ง) ----------
    $('#nextOrder').click();
    $('#btnSettings').click();
    eq('owner sees receipt setting (default = every bill)', [...d.querySelectorAll('#modal [data-rcpt]')].map(b => [b.textContent, b.classList.contains('on')]), [['ทุกบิล', true], ['เมื่อลูกค้าขอ', false]]);
    $('#modal [data-rcpt="ask"]').click(); eq('saved on this device', w.eval('SETTINGS.receiptMode'), 'ask'); w.eval('closeModal()');
    sent = []; sell(); await printDone();
    eq('ask mode: kitchen auto (1 job) · receipt button stands out · status kitchen only', [count(sent, [0x1D, 0x56, 0x42, 0x00]), $('#prReceipt').classList.contains('accent'), $('#prStatus').textContent.trim(), w.eval('PRINTED.get(lastSale.id).receipt')], [1, true, 'พิมพ์แล้ว ✓ ตั๋วครัว', undefined]);
    sent = []; $('#prReceipt').click(); $('#prReceipt').click(); await printDone();
    eq('customer asks: tap receipt (twice) → 1 receipt · status both', [count(sent, [0x1D, 0x56, 0x42, 0x00]), $('#prStatus').textContent.trim()], [1, 'พิมพ์แล้ว ✓ ตั๋วครัว + ใบเสร็จ']);
    A.signIn(w, '1111'); $('#nextOrder').click(); $('#btnSettings').click();
    eq('staff: no receipt setting', d.querySelectorAll('#modal [data-rcpt]').length, 0);
    w.eval('setReceiptMode("all")'); eq('staff cannot change it from code either', w.eval('SETTINGS.receiptMode'), 'ask');
    A.signIn(w, '1234'); w.eval("setReceiptMode('all'); closeModal()"); eq('owner back to every bill', w.eval('receiptMode()'), 'all');
    $('#btnPrinter').click(); eq('info modal shows device', $('#modal').textContent.includes('XP-Q807K'), true);
    sent = []; $('#prTest').click(); await printDone();
    eq('test print: 1 cut', count(sent, [0x1D, 0x56, 0x42, 0x00]), 1);
    // ถอดสาย → ปุ่มกลับเป็นเชื่อม
    usbListeners.disconnect({device:dev}); eq('unplug resets button', $('#btnPrinter').textContent.trim(), 'เชื่อมปริ้นเตอร์');

    // ---------- ปริ้นเตอร์ไม่ตอบ: หมดเวลาต่องาน (Tee 2026-10-16) ----------
    eq('timeout per job: min 15 s · long 5-cup kitchen ticket (141,472 byte ≈ 2.7 s) still 15 s · huge job scales with bytes',
      w.eval('[jobTimeout(64760), jobTimeout(141472), jobTimeout(2000000) > 15000]'), [15000, 15000, true]);
    $('#btnPrinter').click(); await printDone();   // เชื่อมกลับหลังถอดสาย
    w.eval('PRINT_TIMEOUT.min = 300; PRINT_TIMEOUT.rate = 1e9; PRINT_TIMEOUT.close = 300');   // เทสต์เร็ว: หมดเวลา 300 ms w.eval('closeModal()');
    const nBills = () => w.eval('loadSales().length'), n0 = nBills();
    sent = []; jobs = 0; hangJob = 2;   // ตั๋วครัวออก (พิมพ์ก่อน) ใบเสร็จค้าง
    sell(); const s1 = w.eval('lastSale.id');
    eq('stuck: success screen shows at once, next order button works (UI not blocked)', [!!$('#nextOrder'), (() => { $('#nextOrder').click(); return !$('#modal').classList.contains('show'); })()], [true, true]);
    sell(); const s2 = w.eval('lastSale.id');   // บิลถัดไประหว่างปริ้นเตอร์ค้าง: เข้าคิว
    await printDone();
    const sentAtHang = hangAt;
    eq('after timeout: both bills saved', nBills() - n0, 2);
    eq('after timeout: kitchen of bill 1 out (printed first), receipt not · queued bill 2 dropped (nothing sent for it)', [w.eval(`PRINTED.get(${s1})`), w.eval(`PRINTED.get(${s2})`), dataOnly(sent.slice(sentAtHang)) === 0],
      [{kitchen:'ok', receipt:'fail', sent:{kitchen:true, receipt:true}, redo:{receipt:true}}, {kitchen:'fail', receipt:'fail'}, true]);   // ใบเสร็จสะดุดกลางใบ = ใบแทน · บิล 2 ยังไม่ได้เริ่ม = พิมพ์ปกติ
    eq('after timeout: connection closed (pending transfer cancelled) and reconnected by itself', [dev.opened, $('#btnPrinter').textContent.trim()], [true, 'ปริ้นเตอร์พร้อม']);
    const bar = $('#printFail');
    eq('fail bar: message + one reprint button per bill, only the missing slip', [!!bar && bar.textContent.includes('ปริ้นเตอร์ไม่ตอบ — เช็กกระดาษและฝาปิด แล้วกดพิมพ์ซ้ำ'), bar && bar.textContent.includes('ล้างงานค้างไม่ได้'), [...d.querySelectorAll('#printFail .pfbtn')].map(b => b.textContent)],
      [true, false, w.eval(`[${s1}, ${s2}].map(id => pad(loadSales().find(s => s.id === id).no, 3))`).map((n, i) => `พิมพ์ซ้ำ #${n} ${i ? 'ตั๋วครัว + ใบเสร็จ' : 'ใบเสร็จ'}`)]);
    eq('success screen (bill 2) says which slips are not out', [$('#prStatus').textContent.includes('ตั๋วครัว + ใบเสร็จยังไม่ออก'), $('#prStatus').className.includes('warn')], [true, true]);
    await wait(400); eq('no leftover bytes of the old job sent later (after reconnect · only ASB on)', [dataOnly(sent.slice(sentAtHang)), lateSent], [0, 0]);
    // เติมกระดาษแล้วกดพิมพ์ซ้ำ: เฉพาะใบที่ขาด
    hangJob = 0; sent = [];
    d.querySelector('#printFail .pfbtn').click(); await printDone();
    eq('reprint bill 1 from bar after timeout: clear + cut old fragment, then receipt only · bar keeps bill 2 only', [count(sent, [0x1D, 0x56, 0x42, 0x00]), count(sent, [0x1B, 0x40]), w.eval(`PRINTED.get(${s1}).receipt`), [...d.querySelectorAll('#printFail .pfbtn')].length], [2, 2, 'ok', 1]);
    sent = []; $('#prKitchen').click(); $('#prReceipt').click(); await printDone();
    eq('reprint bill 2 from success screen buttons: both slips · bar gone · status printed', [count(sent, [0x1D, 0x56, 0x42, 0x00]), !!$('#printFail'), $('#prStatus').textContent.trim()], [2, false, 'พิมพ์แล้ว ✓ ตั๋วครัว + ใบเสร็จ']);
    // ส่งครบแล้วแต่พนักงานบอกกระดาษไม่ออก → กดพิมพ์ตั๋วครัวซ้ำ
    sent = []; $('#nextOrder') && $('#nextOrder').click(); sell(); await printDone(); sent = []; $('#prKitchen').click(); await printDone();
    eq('all sent but no paper: reprint kitchen only', count(sent, [0x1D, 0x56, 0x42, 0x00]), 1);
    // งานค้างดันตอบ ok หลังเชื่อมใหม่: ส่วนที่เหลือของงานเก่าต้องไม่ถูกส่งผ่านการเชื่อมใหม่
    $('#nextOrder') && $('#nextOrder').click(); jobs = 0; hangJob = 2; lateOk = true; sell(); await printDone();
    const tailFrom = hangAt; hangJob = 0; await wait(300);
    eq('late "ok" from the stuck transfer after reconnect: rest of the old job is not sent', dataOnly(sent.slice(tailFrom)), 0);
    lateOk = false;
    // ---------- H29 ค้างกลางรูป แล้วพิมพ์ซ้ำ: ต้องไม่มีตัวมั่ว (บั๊กเครื่องจริง H23 2026-10-17) ----------
    // ปริ้นเตอร์รับก้อนแรกของใบเสร็จไปครึ่งก้อน (ESC @ + header + ภาพบางส่วน) แล้วค้าง (ฝาเปิด) → หมดเวลา เชื่อมใหม่ → กดพิมพ์ซ้ำจากแถบ
    $('#nextOrder') && $('#nextOrder').click(); w.eval('PRINT_FAILS = []; renderFailBar()');
    emu = new EscPosEmu(); jobs = 0; hangJob = 1; hangPart = 2048; lateSent = 0;
    sell(); const sH = w.eval('lastSale.id'); await printDone();
    eq('H29 stuck mid-image: fail bar, bill saved, connection reset', [!!$('#printFail'), w.eval(`loadSales().some(s => s.id === ${sH})`), $('#btnPrinter').textContent.trim()], [true, true, 'ปริ้นเตอร์พร้อม']);
    eq('H29 hypothesis (ข) ruled out: nothing of the old job sent after the timeout (app side · only ASB on)', [dataOnly(sent.slice(hangAt)), lateSent], [0, 0]);
    hangPart = 0;
    const wantNow = {}; ['kitchen', 'receipt'].forEach(k => { wantNow[k] = EscPosEmu.ink(new EscPosEmu().feed(w.eval(`slipBytes([slipBlocks(loadSales().find(s => s.id === ${sH}), '${k}', PRINTED.get(${sH}))])`)).pages[0]).join(); });   // ก่อนพิมพ์ซ้ำ: ตั๋วครัวเคยส่งแล้ว = ใบแทน · ใบเสร็จยังไม่เคยส่ง = ปกติ
    const want = k => wantNow[k];
    d.querySelector('#printFail .pfbtn').click(); await printDone();
    const pages = emu.pages, last2 = pages.slice(-2).map(p => EscPosEmu.ink(p).join());
    eq('H29 reprint after mid-image stop: no garbage text anywhere · kitchen then receipt complete and exact · old fragment cut off as its own piece',
      [pages.map(p => p.text).join('') + emu.page.text, last2[0] === want('kitchen'), last2[1] === want('receipt'), EscPosEmu.ink(pages[pages.length - 3]).length > 0], ['', true, true, true]);
    // ---------- H30 สถานะก่อนพิมพ์ (DLE EOT 2/4) เฉพาะเครื่องที่มี bulk IN · XP-Q807K ที่วัดจริงมีแต่ ep1 OUT จึงข้ามข้อนี้บนเครื่องจริง ----------
    eq('H30 parse: normal 0x12 · lid 0x16 · paper stop 0x32 / sensor 0x72 · near end 0x1E · bad shapes invalid', w.eval(`[[0x12, 0x12], [0x16, 0x12], [0x32, 0x12], [0x12, 0x72], [0x12, 0x1E], [0xFF, 0x12], [0x12, null]].map(([a, b]) => { const p = UsbPrinter.parseStatus(a, b); return [p.valid, p.cover, p.paper, p.near]; })`),
      [[true, false, false, false], [true, true, false, false], [true, false, true, false], [true, false, true, false], [true, false, false, true], [false, false, false, false], [false, false, false, false]]);
    w.eval('usbPrinter.forget(); renderPrinterBtn()'); $('#btnPrinter').click(); await printDone();
    eq('H30 printer with bulk IN found (ep2)', w.eval('usbPrinter.epIn'), 2);
    $('#nextOrder') && $('#nextOrder').click(); w.eval('PRINT_FAILS = []; renderFailBar()');
    emu.cover = true; sent = []; sell(); const sC = w.eval('lastSale.id'); await printDone();
    eq('H30 lid open: slips not sent · bar says lid open · success screen says so', [count(sent, [0x1D, 0x56, 0x42, 0x00]), $('#printFail') && $('#printFail').textContent.includes('ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วจะพิมพ์ต่อให้'), $('#prStatus').textContent.includes('ฝาปริ้นเตอร์เปิดอยู่'), w.eval(`PRINTED.get(${sC})`)],
      [0, true, true, {kitchen:'fail', receipt:'fail', blocked:true}]);
    sent = []; d.querySelector('#printFail .pfbtn').click(); await printDone();
    eq('H30 status still says lid open but staff presses reprint: send anyway (a misread must never block printing)', [count(sent, [0x1D, 0x56, 0x42, 0x00]), !!$('#printFail')], [2, false]);
    emu.cover = false; $('#nextOrder').click(); emu.cover = true; sell(); await printDone(); emu.cover = false; sent = []; d.querySelector('#printFail .pfbtn').click(); await printDone();
    eq('H30 lid closed → reprint: both slips · bar gone', [count(sent, [0x1D, 0x56, 0x42, 0x00]), !!$('#printFail')], [2, false]);
    $('#nextOrder').click(); statusOverride = 0xFF; const warns = []; w.console.warn = (...a) => warns.push(a.join(' ')); sent = []; sell(); await printDone();
    eq('H30 answer looks wrong (0xFF): print anyway + log · keeps asking next time', [count(sent, [0x1D, 0x56, 0x42, 0x00]), warns.some(x => x.includes('looks wrong')), w.eval('usbPrinter.noStatus')], [2, true, false]);
    statusOverride = null; w.console.warn = () => {};
    $('#nextOrder').click(); emu.near = true; sent = []; sell(); await printDone();
    eq('H30 paper near end: still prints (not blocked) + heads-up message', [count(sent, [0x1D, 0x56, 0x42, 0x00]), d.body.textContent.includes('กระดาษใกล้หมด')], [2, true]);
    emu.near = false;
    $('#nextOrder').click(); emu.paper = false; sent = []; sell(); await printDone();
    eq('H30 out of paper: not sent · bar says out of paper', [count(sent, [0x1D, 0x56, 0x42, 0x00]), $('#printFail') && $('#printFail').textContent.includes('กระดาษหมด — ใส่กระดาษแล้วจะพิมพ์ต่อให้')], [0, true]);
    emu.paper = true; d.querySelector('#printFail .pfbtn').click(); await printDone(); $('#nextOrder').click();
    emu.near = false; statusHang = true; sent = []; sell(); await printDone();
    eq('H30 printer does not answer status within 500 ms: prints anyway (no polling during the job after a miss)', count(sent, [0x1D, 0x56, 0x42, 0x00]), 2);
    for(let n = 0; n < 2; n++){ $('#nextOrder').click(); sell(); await printDone(); }
    eq('H30 no answer 3 times → stops asking until reconnect', w.eval('usbPrinter.noStatus'), true);
    statusHang = false;
    // ปิดการเชื่อมไม่ได้ → บอกในข้อความ
    jobs = 0; hangJob = 1; closeHang = true; sell(); await printDone();
    eq('cannot clear (close hangs): message says unplug first · button back to connect', [$('#printFail').textContent.includes('ล้างงานค้างไม่ได้ ถอดสายปริ้นเตอร์แล้วเสียบใหม่ก่อนพิมพ์ซ้ำ'), $('#btnPrinter').textContent.trim()], [true, 'เชื่อมปริ้นเตอร์']);
    eq('no runtime errors', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
