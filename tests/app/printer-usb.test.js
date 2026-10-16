// พิมพ์ตรงผ่าน USB ในแอป: จำลอง WebUSB + canvas ใน jsdom แล้วขาย 1 บิล
// - เคยอนุญาตเครื่องแล้ว → เชื่อมเองตอนเปิดแอป · ส่ง ESC/POS (ภาพ GS v 0 + ตัดกระดาษ 2 ใบ) ไม่เรียก window.print
// - ส่งไม่สำเร็จ → กลับไปใช้ window.print + ปุ่มกลับเป็น "เชื่อมปริ้นเตอร์"
// - ปริ้นเตอร์ไม่ตอบ (transferOut ค้าง) → หมดเวลาต่องาน ล้างคิว เชื่อมใหม่ แถบแจ้ง + พิมพ์ซ้ำเฉพาะใบที่ขาด (Tee 2026-10-16)
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {finish} = require('../flow-helper');
const A = require('../auth-helper');
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }
let errors = [], printed = 0, sent = [], failNext = false, usbListeners = {};
/* ค้าง: hangJob = งานที่เท่าไร (นับจาก ESC @ ต้นงาน) ที่ transferOut ไม่ตอบ · ปิดการเชื่อมแล้ว transferOut ที่ค้างถูกยกเลิก (แบบ WebUSB) · closeHang = close ไม่ตอบ */
let jobs = 0, hangJob = 0, pending = null, closeHang = false, lateSent = 0, hangAt = -1, lateOk = false;   // lateOk = งานค้างตอบ ok หลังเชื่อมใหม่ (แทนที่จะถูกยกเลิก)   // hangAt = byte ที่ส่งแล้วตอนเริ่มค้าง
/* ฟอนต์ตั๋วจำลอง: โหลดเสร็จหลังเปิดหน้า 200 ms · timeline เช็กว่าวาดตั๋ว (getContext) หลังฟอนต์พร้อมเท่านั้น */
const timeline = []; let fontLoaded = false;
const dev = {opened:false, productName:'XP-Q807K', configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){}, async releaseInterface(){},
  close(){ if(closeHang) return new Promise(() => {}); this.opened = false; if(pending){ const p = pending; pending = null; if(lateOk) setTimeout(() => p.ok({status:'ok'}), 150); else p.no(new Error('transfer cancelled')); } return Promise.resolve(); },
  async transferOut(ep, data){
    if(!this.opened){ lateSent += data.length; throw new Error('device closed'); }
    if(data[0] === 0x1B && data[1] === 0x40) jobs++;
    if(hangJob && jobs === hangJob){ hangJob = 0; hangAt = sent.length; return new Promise((ok, no) => { pending = {ok, no}; }); }
    if(failNext){ failNext = false; return {status:'stall'}; } sent.push(...data); return {status:'ok'}; }};
const fakeCtx = c => ({font:'', fillStyle:'', textAlign:'', textBaseline:'', measureText: s => ({width: String(s).length * 12}),
  fillRect(){}, fillText(){}, getImageData: (x, y, w, h) => ({width:w, height:h, data:new Uint8ClampedArray(w * h * 4).fill(255)})});
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
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const sell = () => { $('[data-menu="acai"]').click(); finish(w); $('#btnPay').click(); $('[data-dine="dinein"]').click(); $('[data-method="cash"]').click(); $('[data-q="500"]').click(); $('#payOk').click(); };
  const count = (arr, seq) => { let n = 0; for(let i = 0; i + seq.length <= arr.length; i++) if(seq.every((b, k) => arr[i + k] === b)) n++; return n; };
  w.addEventListener('load', async () => {
    A.signIn(w);
    await wait(100);
    eq('auto reconnect to allowed printer', $('#btnPrinter').textContent.trim(), 'ปริ้นเตอร์พร้อม');
    sell(); await wait(250);
    eq('sent ESC/POS, no browser print', [sent.length > 0, printed], [true, 0]);
    eq('fonts: both slip weights requested at app start', timeline.filter(t => t.startsWith('load')).slice(0, 2), ['load 400 26px "IBM Plex Sans Thai Looped"', 'load 700 26px "IBM Plex Sans Thai Looped"']);
    eq('fonts: first slip drawn only after fonts loaded', timeline.indexOf('loaded') >= 0 && timeline.indexOf('loaded') < timeline.indexOf('draw'), true);
    eq('starts with ESC @', sent.slice(0, 2), [0x1B, 0x40]);
    eq('2 slips: 2 cuts', count(sent, [0x1D, 0x56, 0x42, 0x00]), 2);
    eq('raster image 576 dots wide (72 bytes)', sent.slice(2, 8), [0x1D, 0x76, 0x30, 0x00, 72, 0]);
    eq('ends with cut', sent.slice(-4), [0x1D, 0x56, 0x42, 0x00]);
    eq('blocks: kitchen ticket content', w.eval('kitchenBlocks(lastSale)').slice(0, 2).map(b => b.text), ['#001', 'กินเลย']);
    eq('blocks: dine-in is a framed box, no solid black band', w.eval('kitchenBlocks(lastSale)').slice(1, 2).map(b => [b.box, !!b.invert]), [['single', false]]);
    eq('blocks: receipt total + change', w.eval('receiptBlocks(lastSale)').filter(b => b.left === 'รวม' || b.left === 'เงินทอน').map(b => b.right), ['฿189', '฿311']);
    // พิมพ์ซ้ำ 2 ครั้งติดกัน → ส่งต่อกันเป็นลำดับ ไม่ปนกัน
    sent = []; w.eval('printSale(lastSale); printSale(lastSale)'); await wait(150);
    eq('double reprint queued: 4 cuts, 2 inits', [count(sent, [0x1D, 0x56, 0x42, 0x00]), sent[0] === 0x1B && sent[1] === 0x40], [4, true]);
    eq('one job per slip: receipt and kitchen each start with ESC @ and end with a cut', count(sent, [0x1B, 0x40]) >= 4, true);
    // ส่งไม่สำเร็จ → window.print แทน
    failNext = true; w.eval('printSale(lastSale)'); await wait(250);
    eq('send failure falls back to window.print', [printed, $('#printArea').querySelectorAll('.slip').length], [1, 2]);
    eq('button back to connect', $('#btnPrinter').textContent.trim(), 'เชื่อมปริ้นเตอร์');
    // กดเชื่อมใหม่ → พิมพ์ทดสอบ
    $('#btnPrinter').click(); await wait(100);
    eq('connect again', $('#btnPrinter').textContent.trim(), 'ปริ้นเตอร์พร้อม');
    $('#btnPrinter').click(); eq('info modal shows device', $('#modal').textContent.includes('XP-Q807K'), true);
    sent = []; $('#prTest').click(); await wait(150);
    eq('test print: 1 cut', count(sent, [0x1D, 0x56, 0x42, 0x00]), 1);
    // ถอดสาย → ปุ่มกลับเป็นเชื่อม
    usbListeners.disconnect({device:dev}); eq('unplug resets button', $('#btnPrinter').textContent.trim(), 'เชื่อมปริ้นเตอร์');

    // ---------- ปริ้นเตอร์ไม่ตอบ: หมดเวลาต่องาน (Tee 2026-10-16) ----------
    eq('timeout per job: min 15 s · long 5-cup kitchen ticket (141,472 byte ≈ 2.7 s) still 15 s · huge job scales with bytes',
      w.eval('[jobTimeout(64760), jobTimeout(141472), jobTimeout(2000000) > 15000]'), [15000, 15000, true]);
    $('#btnPrinter').click(); await wait(100);   // เชื่อมกลับหลังถอดสาย
    w.eval('PRINT_TIMEOUT.min = 300; PRINT_TIMEOUT.rate = 1e9; PRINT_TIMEOUT.close = 300');   // เทสต์เร็ว: หมดเวลา 300 ms w.eval('closeModal()');
    const nBills = () => w.eval('loadSales().length'), n0 = nBills();
    sent = []; jobs = 0; hangJob = 2;   // ใบเสร็จออก ตั๋วครัวค้าง
    sell(); const s1 = w.eval('lastSale.id');
    eq('stuck: success screen shows at once, next order button works (UI not blocked)', [!!$('#nextOrder'), (() => { $('#nextOrder').click(); return !$('#modal').classList.contains('show'); })()], [true, true]);
    sell(); const s2 = w.eval('lastSale.id');   // บิลถัดไประหว่างปริ้นเตอร์ค้าง: เข้าคิว
    await wait(600);
    const sentAtHang = hangAt;
    eq('after timeout: both bills saved', nBills() - n0, 2);
    eq('after timeout: receipt of bill 1 out, kitchen not · queued bill 2 dropped (nothing sent for it)', [w.eval(`PRINTED.get(${s1})`), w.eval(`PRINTED.get(${s2})`), sent.length === sentAtHang],
      [{receipt:'ok', kitchen:'fail'}, {receipt:'fail', kitchen:'fail'}, true]);
    eq('after timeout: connection closed (pending transfer cancelled) and reconnected by itself', [dev.opened, $('#btnPrinter').textContent.trim()], [true, 'ปริ้นเตอร์พร้อม']);
    const bar = $('#printFail');
    eq('fail bar: message + one reprint button per bill, only the missing slip', [!!bar && bar.textContent.includes('ปริ้นเตอร์ไม่ตอบ — เช็กกระดาษและฝาปิด แล้วกดพิมพ์ซ้ำ'), bar && bar.textContent.includes('ล้างงานค้างไม่ได้'), [...d.querySelectorAll('#printFail .pfbtn')].map(b => b.textContent)],
      [true, false, ['พิมพ์ซ้ำ #002 ตั๋วครัว', 'พิมพ์ซ้ำ #003 ใบเสร็จ + ตั๋วครัว']]);
    eq('success screen button (bill 2) says what will be reprinted', $('#prBoth').textContent.includes('พิมพ์ซ้ำใบเสร็จ + ตั๋วครัว'), true);
    await wait(400); eq('no leftover bytes of the old job sent later (after reconnect)', [sent.length === sentAtHang, lateSent], [true, 0]);
    // เติมกระดาษแล้วกดพิมพ์ซ้ำ: เฉพาะใบที่ขาด
    hangJob = 0; sent = [];
    d.querySelector('#printFail .pfbtn').click(); await wait(150);
    eq('reprint bill 1 from bar: kitchen only (1 job, 1 cut) · bar keeps bill 2 only', [count(sent, [0x1D, 0x56, 0x42, 0x00]), w.eval(`PRINTED.get(${s1}).kitchen`), [...d.querySelectorAll('#printFail .pfbtn')].length], [1, 'ok', 1]);
    sent = []; $('#prBoth').click(); await wait(150);
    eq('reprint bill 2 from success screen: both slips · bar gone', [count(sent, [0x1D, 0x56, 0x42, 0x00]), !!$('#printFail')], [2, false]);
    // ส่งครบแล้วแต่พนักงานบอกกระดาษไม่ออก → ไม่แน่ใจ ให้เลือก
    sent = []; $('#nextOrder') && $('#nextOrder').click(); sell(); await wait(150); $('#prBoth').click();
    eq('all sent but staff says no paper: choose receipt / kitchen / both', [...d.querySelectorAll('#modal [data-rp]')].map(b => b.textContent), ['ใบเสร็จ', 'ตั๋วครัว', 'ใบเสร็จ + ตั๋วครัว']);
    sent = []; $('#modal [data-rp="kitchen"]').click(); await wait(150);
    eq('chosen: kitchen only', count(sent, [0x1D, 0x56, 0x42, 0x00]), 1);
    // งานค้างดันตอบ ok หลังเชื่อมใหม่: ส่วนที่เหลือของงานเก่าต้องไม่ถูกส่งผ่านการเชื่อมใหม่
    $('#nextOrder') && $('#nextOrder').click(); jobs = 0; hangJob = 2; lateOk = true; sell(); await wait(900);
    const tailFrom = hangAt; hangJob = 0; await wait(300);
    eq('late "ok" from the stuck transfer after reconnect: rest of the old job is not sent', sent.length, tailFrom);
    lateOk = false;
    // ปิดการเชื่อมไม่ได้ → บอกในข้อความ
    jobs = 0; hangJob = 1; closeHang = true; sell(); await wait(900);
    eq('cannot clear (close hangs): message says unplug first · button back to connect', [$('#printFail').textContent.includes('ล้างงานค้างไม่ได้ ถอดสายปริ้นเตอร์แล้วเสียบใหม่ก่อนพิมพ์ซ้ำ'), $('#btnPrinter').textContent.trim()], [true, 'เชื่อมปริ้นเตอร์']);
    eq('no runtime errors', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
