// คำสั่ง ESC/POS + แปลงภาพเป็น raster: โหลด printer.js เข้า vm เปล่า (ไม่มี DOM / WebUSB)
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js/printer.js'), 'utf8'), ctx, {filename:'printer.js'});
const ev = c => vm.runInContext(c, ctx), arr = c => Array.from(ev(c));
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };

// ตรงกับ docs/hardware.md
eq('init ESC @', arr('ESCPOS.init()'), [0x1B, 0x40]);
eq('partial cut GS V 66 0', arr('ESCPOS.cut()'), [0x1D, 0x56, 0x42, 0x00]);
eq('drawer ESC p 0 25 250', arr('ESCPOS.drawer()'), [0x1B, 0x70, 0x00, 0x19, 0xFA]);
eq('drawer pin 5', arr('ESCPOS.drawer(1)')[2], 1);
eq('text ASCII + LF, non-ASCII → ?', arr("ESCPOS.text('Ab1ก')"), [65, 98, 49, 63, 10]);
eq('bytes concat', arr('bytes([1,2], new Uint8Array([3]), [])'), [1, 2, 3]);
eq('PRINTER.dots 80mm', ev('PRINTER.dots'), 576);

// ภาพ 10×3: แถว 0 ดำทั้งแถว, แถว 1 เฉพาะ x=0 และ x=9, แถว 2 สีเทาอ่อน (ขาว) + โปร่งใสดำ (ขาว)
ctx.img = (() => { const w = 10, h = 3, d = new Uint8ClampedArray(w * h * 4).fill(255);
  const px = (x, y, v, a = 255) => { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = a; };
  for(let x = 0; x < w; x++) px(x, 0, 0);
  px(0, 1, 0); px(9, 1, 0); px(3, 2, 200); px(4, 2, 0, 0);
  return {width:w, height:h, data:d}; })();
const r = ev('rasterize(img)');
eq('raster widthBytes = ceil(10/8)', r.widthBytes, 2);
eq('raster bits', Array.from(r.bits), [0xFF, 0xC0, 0x80, 0x40, 0x00, 0x00]);
eq('threshold: light grey black when threshold high', Array.from(ev('rasterize(img, 220).bits')).slice(4), [0x10, 0x00]);
eq('GS v 0 single band', arr('rasterCmds(rasterize(img))'), [0x1D, 0x76, 0x30, 0x00, 2, 0, 3, 0, 0xFF, 0xC0, 0x80, 0x40, 0x00, 0x00]);
const banded = arr('rasterCmds(rasterize(img), 2)');
eq('GS v 0 split into bands of 2 rows', [banded.slice(0, 8), banded.slice(12, 20)], [[0x1D, 0x76, 0x30, 0x00, 2, 0, 2, 0], [0x1D, 0x76, 0x30, 0x00, 2, 0, 1, 0]]);
eq('banded total length', banded.length, 8 + 4 + 8 + 2);
// ภาพกว้าง 576 สูง 300: header xL/xH/yL/yH
ctx.big = {width:576, height:300, data:new Uint8ClampedArray(576 * 300 * 4)};
const b = arr('rasterCmds(rasterize(big))');
const BD = ev('PRINTER.band'), last = 300 % BD || BD, nb = Math.ceil(300 / BD), lastAt = (nb - 1) * (8 + 72 * BD);
eq(`576 dots = 72 bytes/row, bands of ${BD} rows (last ${last}) · total = data + 8 per band`, [b.slice(4, 8), b.slice(lastAt + 4, lastAt + 8), b.length], [[72, 0, BD, 0], [72, 0, last, 0], 72 * 300 + 8 * nb]);

// เลือก endpoint: bulk OUT ใน interface class 7 ก่อน
const cfg = {interfaces:[
  {interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:255, endpoints:[{endpointNumber:2, direction:'out', type:'bulk', packetSize:64}]}]},
  {interfaceNumber:1, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'in', type:'bulk', packetSize:64}, {endpointNumber:3, direction:'out', type:'bulk', packetSize:64}]}]},
]};
ctx.cfg = cfg;
eq('findOut prefers printer class', ev('UsbPrinter.findOut(cfg)'), {iface:1, alt:0, ep:3, cls:7, packet:64});
ctx.cfg2 = {interfaces:[{interfaceNumber:0, alternates:[{alternateSetting:0, interfaceClass:7, endpoints:[{endpointNumber:1, direction:'in', type:'bulk', packetSize:64}]}]}]};
eq('findOut none', ev('UsbPrinter.findOut(cfg2)'), null);
eq('no WebUSB in node', ev('UsbPrinter.supported()'), false);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
