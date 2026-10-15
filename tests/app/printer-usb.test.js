// พิมพ์ตรงผ่าน USB ในแอป: จำลอง WebUSB + canvas ใน jsdom แล้วขาย 1 บิล
// - เคยอนุญาตเครื่องแล้ว → เชื่อมเองตอนเปิดแอป · ส่ง ESC/POS (ภาพ GS v 0 + ตัดกระดาษ 2 ใบ) ไม่เรียก window.print
// - ส่งไม่สำเร็จ → กลับไปใช้ window.print + ปุ่มกลับเป็น "เชื่อมปริ้นเตอร์"
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {finish} = require('../flow-helper');
const A = require('../auth-helper');
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }
let errors = [], printed = 0, sent = [], failNext = false, usbListeners = {};
/* ฟอนต์ตั๋วจำลอง: โหลดเสร็จหลังเปิดหน้า 200 ms · timeline เช็กว่าวาดตั๋ว (getContext) หลังฟอนต์พร้อมเท่านั้น */
const timeline = []; let fontLoaded = false;
const dev = {opened:false, productName:'XP-Q807K', configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){}, async releaseInterface(){}, async close(){ this.opened = false; },
  async transferOut(ep, data){ if(failNext){ failNext = false; return {status:'stall'}; } sent.push(...data); return {status:'ok'}; }};
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
    sent = []; $('#prBoth').click(); $('#prBoth').click(); await wait(150);
    eq('double reprint queued: 4 cuts, 2 inits', [count(sent, [0x1D, 0x56, 0x42, 0x00]), sent[0] === 0x1B && sent[1] === 0x40], [4, true]);
    // ส่งไม่สำเร็จ → window.print แทน
    failNext = true; $('#prBoth').click(); await wait(250);
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
    eq('no runtime errors', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
