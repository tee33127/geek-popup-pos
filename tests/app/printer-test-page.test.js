// หน้า printer-test กับปริ้นเตอร์ปลอม (jsdom ไม่มี canvas จึงทดสอบเฉพาะปุ่มที่ไม่ใช้ภาพ)
const {JSDOM, ResourceLoader} = require('jsdom'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../..');
class Files extends ResourceLoader { fetch(u){ return Promise.resolve(fs.readFileSync(path.join(ROOT, new URL(u).pathname))); } }
let claimBusy = false, released = 0;
let errors = [], sent = [], permitted = [], usbEvents = new EventTarget(), stat = {2:0x12, 4:0x12}, lastAsk = 0, statHang = false;   // stat = ค่าที่เครื่องปลอมตอบ DLE EOT n
const fakeDevice = () => ({vendorId:0x0483, productId:0x5743, manufacturerName:'Xprinter', productName:'XP-Q807K', opened:false, configuration:null,
  configurations:[{configurationValue:1, interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'in', type:'bulk', packetSize:64}, {endpointNumber:2, direction:'out', type:'bulk', packetSize:64}]}]}]}],
  async open(){ this.opened = true; }, async close(){ this.opened = false; },
  async selectConfiguration(){ this.configuration = this.configurations[0]; },
  async claimInterface(){ if(claimBusy){ const e = new Error("Failed to execute 'claimInterface' on 'USBDevice': Unable to claim interface."); e.name = 'NetworkError'; throw e; } }, async releaseInterface(){ released++; },
  async transferOut(ep, data){ if(data[0] === 0x10 && data[1] === 0x04){ lastAsk = data[2]; return {status:'ok', bytesWritten:3}; } sent.push({ep, data:Array.from(data)}); return {status:'ok', bytesWritten:data.length}; },
  async transferIn(ep){ if(statHang) return new Promise(() => {}); return {status:'ok', data:new DataView(new Uint8Array([stat[lastAsk]]).buffer)}; }});
const dev = fakeDevice();
JSDOM.fromFile(path.join(ROOT, 'printer-test/index.html'), {runScripts:'dangerously', resources:new Files(), url:'http://localhost/printer-test/index.html', pretendToBeVisual:true,
  beforeParse(w){
    w.addEventListener('error', e => errors.push(e.message));
    Object.defineProperty(w.navigator, 'usb', {value:{
      requestDevice: async () => { permitted = [dev]; return dev; }, getDevices: async () => permitted,
      addEventListener: (t, f) => usbEvents.addEventListener(t, f)}});
  }}).then(dom => {
  const w = dom.window, d = w.document, $ = s => d.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms));
  const logText = () => $('#log').textContent;
  let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };
  w.addEventListener('load', async () => {
    await wait(50);
    eq('env shows WebUSB', $('#env').textContent.includes('✓ ใช้ได้'), true);
    eq('tests disabled before connect', $('[data-test="text"]').disabled, true);
    eq('no permitted device on load', logText().includes('เครื่องที่เคยอนุญาตไว้ 0 เครื่อง'), true);
    claimBusy = true; $('#btnConnect').click(); await wait(50);
    eq('claim fails (POS app holds the printer): plain message · not connected · page not stuck', [logText().includes('ปริ้นเตอร์ถูกใช้อยู่ในหน้าอื่น — ปิดหน้าอื่น (แอป POS หรือหน้าทดสอบ) แล้วกดเชื่อมอีกครั้ง'), $('#status').textContent, dev.opened, $('#btnConnect').disabled], [true, 'ยังไม่เชื่อม', false, false]);
    claimBusy = false;
    $('#btnConnect').click(); await wait(50);
    eq('connected status', $('#status').textContent, 'เชื่อมแล้ว · XP-Q807K');
    eq('tests enabled', $('[data-test="text"]').disabled, false);
    eq('device described in log · status comes back on the IN endpoint', [logText().includes('vendor 0x0483 product 0x5743') && logText().includes('class 7 (Printer)'), logText().includes('รับสถานะกลับทาง ep1')], [true, true]);
    // อ่านสถานะเครื่อง: byte ดิบ + บิต + ความหมาย
    $('[data-test="status"]').click(); await wait(50);
    eq('status normal: raw bytes with bits + meaning', [logText().includes('DLE EOT 2 (สาเหตุหยุด): 0x12 (00010010)'), logText().includes('DLE EOT 4 (กระดาษ): 0x12 (00010010)'), logText().includes('แปลว่า: ปกติ')], [true, true, true]);
    stat = {2:0x36, 4:0x72}; $('[data-test="status"]').click(); await wait(50);   // ค่าจริง XP-Q807K เปิดฝา
    eq('real lid open 0x36/0x72: says lid open only (paper sensor sits under the lid)', [logText().includes('แปลว่า: ฝาเปิด'), logText().includes('แปลว่า: ฝาเปิด · กระดาษหมด')], [true, false]);
    stat = {2:0x32, 4:0x72}; $('[data-test="status"]').click(); await wait(50);   // ค่าจริง ไม่มีกระดาษ ฝาปิด
    eq('real paper out 0x32/0x72: paper out', logText().trim().split('\n').pop().includes('แปลว่า: กระดาษหมด'), true);
    stat = {2:0x12, 4:0x1E}; $('[data-test="status"]').click(); await wait(50);
    eq('paper near end', logText().includes('แปลว่า: กระดาษใกล้หมด'), true);
    stat = {2:0xFF, 4:0x12}; $('[data-test="status"]').click(); await wait(50);
    eq('odd value: says cannot read, app keeps printing', logText().includes('อ่านค่าไม่ออก (รูปแบบไม่ตรงมาตรฐาน · แอปจะพิมพ์ต่อตามปกติ)'), true);
    statHang = true; $('[data-test="status"]').click(); await wait(1150); statHang = false; stat = {2:0x12, 4:0x12};
    eq('no answer: says so after timeout, page not stuck', [logText().includes('อ่านสถานะไม่ได้ · ไม่ตอบใน 1000 ms'), $('[data-test="text"]').disabled], [true, false]);
    $('[data-test="text"]').click(); await wait(50);
    eq('text sent to OUT ep2, starts with ESC @', [sent[0].ep, sent[0].data.slice(0, 2)], [2, [0x1B, 0x40]]);
    eq('text content', String.fromCharCode(...sent[0].data).includes('Geek Pop-up POS - printer test'), true);
    sent = []; $('[data-test="cut"]').click(); await wait(50);
    eq('cut bytes', sent[0].data, [0x1B, 0x64, 1, 0x1D, 0x56, 0x42, 0x00]);
    sent = []; $('#optCut').value = 'full'; $('[data-test="cut"]').click(); await wait(50);
    eq('full cut option', sent[0].data.slice(3), [0x1D, 0x56, 0x41, 0x00]);
    sent = []; $('[data-test="drawer"]').click(); await wait(50);
    eq('drawer bytes', sent[0].data, [0x1B, 0x70, 0, 25, 250]);
    sent = []; $('#optPin').value = '1'; $('[data-test="drawer"]').click(); await wait(50);
    eq('drawer pin 5 option', sent[0].data[2], 1);
    $('#optChunk').value = '256'; sent = []; $('[data-test="text"]').click(); await wait(50);
    eq('chunk size respected', sent.every(s => s.data.length <= 256), true);
    // ถอดสาย แล้วเสียบใหม่ → เชื่อมเองโดยไม่ต้องเลือก
    const ev = (t) => { const e = new Event(t); e.device = dev; usbEvents.dispatchEvent(e); };
    ev('disconnect'); dev.opened = false; await wait(20);
    eq('unplug → disconnected', [$('#status').textContent, $('[data-test="text"]').disabled], ['ยังไม่เชื่อม', true]);
    ev('connect'); await wait(50);
    eq('replug → auto reconnect', [$('#status').textContent, logText().includes('เสียบสายใหม่ · ไม่ต้องเลือกใหม่')], ['เชื่อมแล้ว · XP-Q807K', true]);
    // ปล่อยปริ้นเตอร์ให้แอป POS: ปุ่ม + ปิดหน้า
    released = 0; $('[data-test="disconnect"]').click(); await wait(50);
    eq('"release printer" button: releaseInterface + close · says the POS app can connect', [released, dev.opened, $('#status').textContent, logText().includes('ปล่อยปริ้นเตอร์แล้ว')], [1, false, 'ยังไม่เชื่อม', true]);
    $('#btnConnect').click(); await wait(50); released = 0;
    w.dispatchEvent(new w.Event('pagehide')); await wait(50);
    eq('closing the page (pagehide) releases the printer by itself', [released, dev.opened], [1, false]);
    $('#btnConnect').click(); await wait(50);
    // เช็กลิสต์ + คัดลอก
    $('[data-i="3"][data-v="pass"]').click(); $('[data-i="7"][data-v="fail"]').click();
    let copied = ''; Object.defineProperty(w.navigator, 'clipboard', {value:{writeText: async t => { copied = t; }}});
    $('#btnCopy').click(); await wait(20);
    eq('report has checklist marks + log', [copied.includes('[✓] 4.'), copied.includes('[✗] 8.'), copied.includes('XP-Q807K')], [true, true, true]);
    eq('checklist saved', JSON.parse(w.localStorage.getItem('geek_printer_test_v1')), {3:'pass', 7:'fail'});
    eq('no runtime errors', errors, []);
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
  });
}).catch(e => { console.error('CRASH', e); process.exit(2); });
