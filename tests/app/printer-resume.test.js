// พิมพ์ใบที่ขาดต่อเองเมื่อเครื่องพร้อม + ตั๋วครัวก่อน + ปริ้นเตอร์ถูกอีกหน้าจับไว้ (H31–H34 · Tee 2026-10-17)
// ปริ้นเตอร์จำลองแบบเครื่องจริง XP-Q807K: ฝาเปิด = ไม่รับข้อมูล (transferOut ค้าง) แต่ตอบสถานะ (DLE EOT) ได้ 0x36/0x72 · กระดาษหมด 0x32/0x72
// ทุกอย่างที่ส่งผ่าน tests/escpos-emu.js (แปลคำสั่งจริง) แล้วนับใบที่ออกจริง: ครบ 1 ชุด ตั๋วครัวก่อน ไม่ซ้ำ ไม่มีตัวมั่ว
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const {finish} = require('../flow-helper');
const {EscPosEmu} = require('../escpos-emu');
const A = require('../auth-helper');
const APP = path.join(__dirname, '../../app');
class AppFiles extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(APP, new URL(u).pathname))); } }
let errors = [], emu = new EscPosEmu(), pending = null, trip = null, jobs = 0, lateSent = 0, statusHang = false, claimBusy = false, claims = 0;
/* trip = {job, part, cover, paper}: งานที่ job (นับ ESC @) รับไป part byte แล้วฝาเปิด/กระดาษหมด/ค้างเงียบ (cover:false paper:true = ค้างโดยสถานะยังปกติ) */
const dev = {opened:false, productName:'XP-Q807K', configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'out', type:'bulk', packetSize:64}, {endpointNumber:2, direction:'in', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async selectConfiguration(){ this.configuration = this.configurations[0]; this.configuration.interfaces.forEach(i => i.alternate = i.alternates[0]); },
  async claimInterface(){ claims++; if(claimBusy){ const e = new Error("Failed to execute 'claimInterface' on 'USBDevice': Unable to claim interface."); e.name = 'NetworkError'; throw e; } }, async releaseInterface(){},
  async close(){ this.opened = false; if(pending){ const p = pending; pending = null; p.no(new Error('transfer cancelled')); } },
  async transferIn(){ if(statusHang) return new Promise(() => {}); const v = emu.replies.shift(); return {status:'ok', data:new DataView(new Uint8Array(v === undefined ? [] : [v]).buffer)}; },
  async transferOut(ep, data){
    if(!this.opened){ lateSent += data.length; throw new Error('device closed'); }
    if(data[0] === 0x10 && data[1] === 0x04){ emu.feed(data); return {status:'ok'}; }            // คำถามสถานะ: ตอบได้แม้ฝาเปิด
    if(data[0] === 0x1B && data[1] === 0x40) jobs++;
    const hang = () => new Promise((ok, no) => { pending = {ok, no}; });
    if(trip && jobs === trip.job){ const t = trip; trip = null; emu.feed(data.subarray(0, t.part)); emu.cover = t.cover !== false; if(t.paper === false) emu.paper = false; return hang(); }
    if(emu.cover || !emu.paper) return hang();                                                 // ฝาเปิด/ไม่มีกระดาษ: เครื่องไม่รับ
    await new Promise(r => setTimeout(r, 6));                                                  // ส่งทีละก้อนใช้เวลา (งานหนึ่งใบ ~0.1 วิ) ให้กดแทรกระหว่างพิมพ์ได้จริง
    emu.feed(data); return {status:'ok'}; }};
const fakeCtx = c => ({font:'', fillStyle:'', textAlign:'', textBaseline:'', measureText: s => ({width: String(s).length * 12}),
  fillRect(){}, fillText(){}, getImageData: (x, y, w, h) => { const d = new Uint8ClampedArray(w * h * 4).fill(255);
    for(let j = 0; j < h; j++) for(let i = 0; i < w; i++) if((i * 5 + j * 3) % 7 < 3){ const k = (j * w + i) * 4; d[k] = d[k + 1] = d[k + 2] = 0; }
    return {width:w, height:h, data:d}; }});
JSDOM.fromFile(path.join(APP, 'index.html'), {runScripts:'dangerously', resources:new AppFiles(), url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){ A.seed(w);
    w.print = () => errors.push('window.print called'); w.console.warn = () => {}; w.addEventListener('error', e => errors.push(e.message));
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    Object.defineProperty(w.navigator, 'usb', {value:{getDevices: async () => [dev], requestDevice: async () => dev, addEventListener(){}}});
  }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  const toasts = [];
  const sell = () => { if($('#nextOrder')) $('#nextOrder').click(); $('[data-menu="acai"]').click(); finish(w); $('#btnPay').click(); $('[data-dine="dinein"]').click(); $('[data-method="cash"]').click(); $('[data-q="500"]').click(); $('#payOk').click(); return w.eval('lastSale.id'); };
  /* หมึกของใบที่ควรได้ (ภาพเดียวกับที่แอปส่ง) */
  const ink = (id, k) => EscPosEmu.ink(new EscPosEmu().feed(w.eval(`slipBytes([${k}Blocks(loadSales().find(s => s.id === ${id}))])`)).pages[0]).join();
  /* ใบที่ออกจริงจากปริ้นเตอร์จำลอง: k = ตั๋วครัว · r = ใบเสร็จ · f = เศษ/อื่นๆ · - = ใบว่าง (ตัดตอนล้าง ไม่มีหมึก) */
  const paper = id => { const K = ink(id, 'kitchen'), Rc = ink(id, 'receipt'); return emu.pages.map(p => { const x = EscPosEmu.ink(p).join(); return x === K ? 'k' : x === Rc ? 'r' : x ? 'f' : '-'; }).filter(c => c !== '-').join(''); };
  const text = () => emu.pages.map(p => p.text).join('') + emu.page.text;
  const bar = () => $('#printFail') ? $('#printFail').textContent : '';
  const until = async (fn, ms = 3000) => { const t = Date.now(); while(!fn() && Date.now() - t < ms) await wait(20); return fn(); };
  const reset = () => { emu = new EscPosEmu(); jobs = 0; trip = null; };

  w.addEventListener('load', async () => {
    A.signIn(w);
    const t0 = w.toast; w.toast = (m, ...a) => { toasts.push(m); return t0(m, ...a); };
    w.eval('PRINT_TIMEOUT.min = 300; PRINT_TIMEOUT.rate = 1e9; PRINT_TIMEOUT.close = 300; PRINT_RESUME.ms = 120; PRINT_RESUME.okMs = 400; PRINTER.statusMs = 150');
    await wait(150);
    eq('connected by itself, status endpoint ep2', [$('#btnPrinter').textContent.trim(), w.eval('usbPrinter.epIn')], ['ปริ้นเตอร์พร้อม', 2]);

    // ---------- H32 ตั๋วครัวก่อนใบเสร็จ ----------
    reset(); let id = sell(); await until(() => !w.eval('[...PRINTED.values()].some(s => s.kitchen === "wait" || s.receipt === "wait")'));
    eq('H32 after payment: kitchen ticket comes out first, then receipt', [paper(id), text()], ['kr', '']);
    reset(); w.eval(`printSale(loadSales().find(s => s.id === ${id}), 'both', true)`); await wait(200);
    eq('H32 reprint both: kitchen first', paper(id), 'kr');
    eq('H32 reprint chooser + success screen: kitchen listed first', w.eval('SLIP_NAME.both'), 'ตั๋วครัว + ใบเสร็จ');

    /* 4 แบบ × (รอเฉยๆ / กดพิมพ์ซ้ำแทรก) → กลับมาพร้อม → ได้ครบ 1 ชุด ตั๋วครัวก่อน ไม่ซ้ำ ไม่มีตัวมั่ว */
    const CASES = {
      'lid opens mid kitchen (1st slip)':  {trip:{job:1, part:2048}, wantFirst:'', want:'fkr', why:'ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วจะพิมพ์ต่อให้'},
      'lid opens mid receipt (2nd slip)':  {trip:{job:2, part:2048}, wantFirst:'k', want:'kfr', why:'ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วจะพิมพ์ต่อให้'},
      'lid open before printing':          {before:'cover', wantFirst:'', want:'kr', why:'ฝาปริ้นเตอร์เปิดอยู่ — ปิดฝาแล้วจะพิมพ์ต่อให้'},
      'paper out before printing':         {before:'paper', wantFirst:'', want:'kr', why:'กระดาษหมด — ใส่กระดาษแล้วจะพิมพ์ต่อให้'},
    };
    for(const [name, c] of Object.entries(CASES)) for(const mode of ['wait', 'tap', 'tap-while-resuming']){
      reset(); toasts.length = 0;
      if(c.trip) trip = {...c.trip};
      if(c.before === 'cover') emu.cover = true;
      if(c.before === 'paper') emu.paper = false;
      id = sell();
      await until(() => bar().includes(c.why), 3000);
      const shown = bar().includes(c.why), noPaperWord = c.why.startsWith('ฝา') ? !bar().includes('กระดาษหมด') : true;
      eq(`H33 ${name} · ${mode}: bill saved · orange bar "${c.why}" (lid open never says paper out) · nothing reprinted while not ready`,
        [w.eval(`loadSales().some(s => s.id === ${id})`), shown, noPaperWord, paper(id)], [true, true, true, c.wantFirst]);
      await wait(400);
      eq(`H33 ${name} · ${mode}: still not ready → keeps waiting, no auto print`, paper(id), c.wantFirst);
      const held = d.querySelector('#printFail .pfbtn');      // ปุ่มบนแถบที่พนักงานกำลังจะกด
      emu.cover = false; emu.paper = true;                     // ปิดฝา / ใส่กระดาษ
      if(mode === 'tap') held.click();
      if(mode === 'tap-while-resuming'){                       // กดตอนแอปเริ่มพิมพ์ต่อเองพอดี
        await until(() => { const st = w.eval(`PRINTED.get(${id})`); return st.kitchen === 'wait' || st.receipt === 'wait'; }, 2000);
        if(held.isConnected) held.click(); else w.eval(`reprint(loadSales().find(s => s.id === ${id}))`);   // แถบหายทันทีที่เริ่มพิมพ์เอง กดปุ่มเดิมไม่ได้แล้ว → เรียกสิ่งที่ปุ่มทำตรงๆ
        eq(`H33 ${name}: tap lands while app is already printing → "printing" note, no chooser, no second set`, [toasts.includes('กำลังพิมพ์อยู่'), !!$('#modal [data-rp]')], [true, false]);
      }
      await until(() => !$('#printFail') && paper(id).endsWith('r'), 3000); await wait(500);
      eq(`H33 ${name} · ${mode}: ready → missing slips once, kitchen first · no duplicates · no garbage · bar gone`,
        [paper(id), text(), !!$('#printFail'), w.eval(`PRINTED.get(${id}).kitchen + '/' + PRINTED.get(${id}).receipt`)], [c.want, '', false, 'ok/ok']);
      eq(`H33 ${name} · ${mode}: no slips left → status polling stopped`, w.eval('resumeTimer'), null);
    }
    // แถบเขียว "พิมพ์แล้ว ✓"
    reset(); emu.cover = true; id = sell(); await until(() => !!$('#printFail')); emu.cover = false;
    await until(() => !!$('#printOk'), 2000);
    const okText = $('#printOk') ? $('#printOk').textContent : '';
    await wait(600);
    eq('H33 after auto print: green "printed ✓ #NNN kitchen + receipt" then disappears', [okText.startsWith('พิมพ์แล้ว ✓ #') && okText.includes('ตั๋วครัว + ใบเสร็จ'), !!$('#printOk'), w.eval('resumeTimer')], [true, false, null]);

    // ---------- ไม่วนพิมพ์เอง: ล้มอีกตอนพิมพ์ต่อ → แถบเดิม จนกว่าจะเห็นเครื่องไม่พร้อมแล้วกลับมาพร้อม ----------
    reset(); emu.cover = true; id = sell(); await until(() => !!$('#printFail'));
    trip = {job:1, part:1000, cover:false};                    // ปิดฝาแล้ว พิมพ์ต่อ แต่เครื่องค้างเงียบ (สถานะยังปกติ)
    emu.cover = false;
    await until(() => jobs >= 1, 2000); await until(() => !!$('#printFail') && w.eval(`PRINTED.get(${id}).kitchen`) === 'fail', 3000);
    const j1 = jobs; emu.cover = false; await wait(1000);
    eq('H33 auto print failed again (printer silent, status still normal): orange bar back · no second auto print', [!!$('#printFail'), jobs - j1], [true, 0]);
    emu.cover = true; await wait(400); emu.cover = false; await until(() => !$('#printFail'), 3000); await wait(300);
    eq('H33 lid opened + closed again → one more auto print, complete (old fragment cut off)', [!!$('#printFail'), paper(id).slice(-2), text()], [false, 'kr', '']);

    // ---------- อ่านสถานะไม่ได้ → แบบเดิม (พนักงานกดเอง) ----------
    reset(); trip = {job:1, part:1000, cover:false}; id = sell(); await until(() => !!$('#printFail'), 3000);
    statusHang = true; await wait(700);
    eq('H33 status no answer: stop polling · bar says press reprint · nothing printed by itself', [w.eval('resumeTimer'), w.eval('usbPrinter.noStatus'), bar().includes('กดพิมพ์ซ้ำ'), bar().includes('จะพิมพ์ใบที่ขาดให้เอง')], [null, true, true, false]);
    statusHang = false; w.eval('usbPrinter.noStatus = false');
    d.querySelector('#printFail .pfbtn').click(); await until(() => paper(id).endsWith('kr'), 3000);
    eq('H33 staff reprint still works', paper(id).slice(-2), 'kr');

    // ---------- H34 ปริ้นเตอร์ถูกอีกหน้าจับไว้ ----------
    w.eval('usbPrinter.forget(); renderPrinterBtn()'); dev.opened = false;
    claimBusy = true; toasts.length = 0; $('#btnPrinter').click(); await wait(100);
    const busyMsg = 'ปริ้นเตอร์ถูกใช้อยู่ในหน้าอื่น — ปิดหน้าอื่น (แอป POS หรือหน้าทดสอบ) แล้วกดเชื่อมอีกครั้ง';
    eq('H34 claim fails: plain message · button stays "connect" · device handle closed again (not half-held)', [toasts.includes(busyMsg), $('#btnPrinter').textContent.trim(), dev.opened], [true, 'เชื่อมปริ้นเตอร์', false]);
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
