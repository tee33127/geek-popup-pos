// พิมพ์ต่อหลังงานถูกตัดกลางรูป (H29 · Tee 2026-10-17): ปริ้นเตอร์จำลองแปลคำสั่งจริง (tests/escpos-emu.js)
// บั๊กเครื่องจริง H23: เปิดฝากลางใบ → กดพิมพ์ซ้ำ ได้ส่วนบนของใบเก่า + ตัวมั่วยาว ~1 เมตร
// สาเหตุ: เครื่องค้างอยู่กลางคำสั่ง GS v 0 (รู้ความสูงแล้ว รอข้อมูลภาพที่เหลือ) งานใหม่ทั้งก้อน (รวม ESC @) ถูกกินเป็นข้อมูลภาพ แล้วข้อมูลภาพของงานใหม่ที่เหลือถูกอ่านเป็นตัวอักษร
// แก้: แถบภาพสั้น (PRINTER.band) + ESCPOS.recover() ส่ง 0x00 ยาวเกินหนึ่งแถบ ปิดคำสั่งภาพที่ค้าง แล้ว ESC @ (+ ตัดเศษใบเก่าแยก) ก่อนงานจริง
const vm = require('vm'), fs = require('fs'), path = require('path');
const {EscPosEmu} = require('../escpos-emu');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js/printer.js'), 'utf8'), ctx, {filename:'printer.js'});
const ev = c => vm.runInContext(c, ctx);
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };

/* ใบตั๋วสมมติ กว้าง 576 จุด (72 byte) ข้อมูลภาพสุ่มแบบกำหนดได้ (มี byte ที่พิมพ์เป็นตัวอักษรได้ เหมือนภาพจริง) */
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 255;
const slip = h => { const bits = new Uint8Array(72 * h); for(let i = 0; i < bits.length; i++) bits[i] = rnd() | 1; return {widthBytes:72, height:h, bits}; };
const A = slip(400), B = slip(300);
ctx.A = A; ctx.B = B;
const job = r => Array.from(ev(`bytes(ESCPOS.init(), rasterCmds(${r}), ESCPOS.cut())`));
const jobA = job('A'), jobB = job('B');
const inkB = EscPosEmu.ink(new EscPosEmu().feed(jobB).pages[0]);
const band = ev('PRINTER.band'), bandBytes = 8 + 72 * band;

eq('band ≤ 48 rows (stuck printer waits at most one short band)', band <= 48 && band >= 8, true);
eq('normal job prints all rows, no text', [inkB.length, new EscPosEmu().feed(jobB).pages[0].text], [300, '']);

/* ตำแหน่งที่ตัด: หลัง ESC @ · กลาง header แถบแรก · กลางแถบ · พอดีระหว่างแถบ · กลาง header แถบที่ 3 · ก่อน yH · แถบสุดท้าย */
const cuts = {afterInit:2, midHeader1:2 + 5, midBand:2 + 8 + 72 * 7 + 13, betweenBands:2 + bandBytes, midHeader3:2 + bandBytes * 2 + 3, beforeYH:2 + bandBytes + 7, lastBand:jobA.length - 4 - 100};
const run = (stream) => { const e = new EscPosEmu().feed(stream); return {pages:e.pages, last:e.pages[e.pages.length - 1], text:e.pages.map(p => p.text).join('') + e.page.text}; };

// ก่อนแก้ (ส่งงานใหม่ตรงๆ): ยืนยันสมมติฐาน (ก) ด้วยแถบยาวแบบเดิม 256 แถว
{
  ctx.oldA = Array.from(ev('bytes(ESCPOS.init(), rasterCmds(A, 256))'));
  const r = run([...ctx.oldA.slice(0, 2 + 8 + 72 * 30), ...jobB]);
  eq('hypothesis (ก) reproduced: old 256-row band cut mid-image + new job sent as is → new job eaten as image data, rest printed as garbage text',
    [r.text.length > 1000, EscPosEmu.ink(r.last).join() === inkB.join()], [true, false]);
}

// หลังแก้: ทุกตำแหน่งที่ตัด → recover() แล้วงานใหม่ → ใบสุดท้ายคืองานใหม่ครบทุกแถว ไม่มีตัวอักษรเลย
for(const [name, k] of Object.entries(cuts)){
  const r = run([...jobA.slice(0, k), ...Array.from(ev('ESCPOS.recover(true)')), ...jobB]);
  eq(`cut ${name} (byte ${k}) → recover + reprint: new slip complete & exact · no garbage text · old fragment cut off separately`,
    [r.text, EscPosEmu.ink(r.last).join() === inkB.join(), r.pages.length], ['', true, 2]);
}
// เชื่อมใหม่ปกติ (ไม่รู้ว่าค้าง): recover(false) ไม่ตัด · ไม่ค้างก็ไม่มีอะไรออก (0x00 = เครื่องข้าม)
{
  const clean = run([...Array.from(ev('ESCPOS.recover(false)')), ...jobB]);
  eq('recover on a clean printer: nothing printed before the job, no extra cut', [clean.pages.length, clean.text, EscPosEmu.ink(clean.last).join() === inkB.join(), clean.last.rows.length], [1, '', true, 300]);
  const dirty = run([...jobA.slice(0, cuts.midBand), ...Array.from(ev('ESCPOS.recover(false)')), ...jobB]);
  eq('recover(false) after a hidden mid-band stop: no garbage, new slip rows intact (old fragment on top)', [dirty.text, EscPosEmu.ink(dirty.last).slice(-300).join() === inkB.join()], ['', true]);
}
eq('recover size: zeros cover one full band + header', ev('ESCPOS.recover(false).length') >= bandBytes, true);

// ขนาดข้อมูล: แถบสั้นเพิ่ม header 8 byte ต่อแถบ
const sz = h => ev(`rasterCmds({widthBytes:72, height:${h}, bits:new Uint8Array(72 * ${h})}, ${'BAND'}).length`.replace('BAND', 'PRINTER.band'));
const sz256 = h => ev(`rasterCmds({widthBytes:72, height:${h}, bits:new Uint8Array(72 * ${h})}, 256).length`);
console.log(`INFO ขนาดภาพ 899 แถว (ใบเสร็จตัวอย่าง): แถบ 256 = ${sz256(899)} byte · แถบ ${band} = ${sz(899)} byte (+${sz(899) - sz256(899)}) · recover = ${ev('ESCPOS.recover(true).length')} byte`);

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
